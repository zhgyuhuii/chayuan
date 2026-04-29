/**
 * commandRegistry — ⌘K 命令面板的全局动作注册表
 *
 * 思路:
 *   各模块在自己的初始化阶段调用 registerCommand 把"命令"投递到中心,
 *   App 顶层只挂一个 <CommandPalette :commands="getAllCommands()" />,
 *   不需要每个模块知道 palette 的存在。
 *
 * 命令对象(与 CommandPalette.vue 的 props.commands 同型):
 *   {
 *     id:        string  // 全局唯一,用于 dedupe + 记忆"最近使用"
 *     title:     string
 *     subtitle?: string
 *     icon?:     string
 *     group?:    string  // 分组标签(如「助手」「文档」「设置」)
 *     shortcut?: string  // 显示用,例 "⌘P"
 *     keywords?: string[]  // 用于模糊匹配
 *     handler:   () => void | Promise<void>
 *     when?:     () => boolean   // 可见性谓词;返回 false 时不出现在列表
 *     priority?: number  // 越大越靠前(同分时);默认 0
 *   }
 *
 * 用法:
 *
 *   // 模块 A:
 *   import { registerCommand } from '@/utils/router/commandRegistry.js'
 *   registerCommand({
 *     id: 'doc.toggle-read-only',
 *     group: '文档',
 *     title: '切换只读模式',
 *     keywords: ['readonly', 'lock', '锁'],
 *     handler: () => toggleReadOnly()
 *   })
 *
 *   // App.vue:
 *   import { useCommandRegistry } from '@/utils/router/commandRegistry.js'
 *   const { commands } = useCommandRegistry()
 *   //  → <CommandPalette :commands="commands" />
 */

const _commands = new Map()       // id -> command
const _listeners = new Set()      // change listeners
let _opened = false               // 受控显示状态(可被 openPalette 等驱动)
const _openListeners = new Set()  // 受控显示订阅

/* ────────── 内部 ────────── */

function notifyChange() {
  for (const fn of _listeners) {
    try { fn(getAllCommands()) } catch (_) { /* listener 异常不影响其他 */ }
  }
}

function notifyOpen() {
  for (const fn of _openListeners) {
    try { fn(_opened) } catch (_) {}
  }
}

function normalizeCommand(cmd) {
  if (!cmd || typeof cmd !== 'object') return null
  const id = String(cmd.id || '').trim()
  if (!id) return null
  if (typeof cmd.handler !== 'function') return null
  return {
    id,
    title:     String(cmd.title || id),
    subtitle:  cmd.subtitle ? String(cmd.subtitle) : '',
    icon:      cmd.icon ? String(cmd.icon) : '',
    group:     cmd.group ? String(cmd.group) : '操作',
    shortcut:  cmd.shortcut ? String(cmd.shortcut) : '',
    keywords:  Array.isArray(cmd.keywords) ? cmd.keywords.filter(Boolean).map(String) : [],
    handler:   cmd.handler,
    when:      typeof cmd.when === 'function' ? cmd.when : null,
    priority:  Number.isFinite(cmd.priority) ? cmd.priority : 0
  }
}

/* ────────── 注册 / 注销 ────────── */

/**
 * 注册一条命令。同 id 已存在 → 覆盖。
 * 返回 unregister 函数。
 */
export function registerCommand(cmd) {
  const norm = normalizeCommand(cmd)
  if (!norm) return () => {}
  _commands.set(norm.id, norm)
  notifyChange()
  return () => unregisterCommand(norm.id)
}

/** 批量注册;返回一次性反注册函数。 */
export function registerCommands(list) {
  const ids = []
  for (const c of (list || [])) {
    const norm = normalizeCommand(c)
    if (!norm) continue
    _commands.set(norm.id, norm)
    ids.push(norm.id)
  }
  notifyChange()
  return () => {
    for (const id of ids) _commands.delete(id)
    notifyChange()
  }
}

export function unregisterCommand(id) {
  const key = String(id || '').trim()
  if (_commands.delete(key)) notifyChange()
}

export function unregisterByGroup(group) {
  const key = String(group || '').trim()
  let deleted = false
  for (const [id, c] of _commands) {
    if (c.group === key) { _commands.delete(id); deleted = true }
  }
  if (deleted) notifyChange()
}

/* ────────── 读取 ────────── */

/** 返回当前所有可见命令(应用 when 过滤,按 priority 排序)。 */
export function getAllCommands() {
  const out = []
  for (const c of _commands.values()) {
    if (c.when && !c.when()) continue
    out.push(c)
  }
  out.sort((a, b) => b.priority - a.priority)
  return out
}

export function getCommand(id) {
  return _commands.get(String(id || '').trim()) || null
}

export function hasCommand(id) {
  return _commands.has(String(id || '').trim())
}

/* ────────── 订阅(给 Vue 用) ────────── */

/**
 * 订阅命令列表变化。返回 unsubscribe 函数。
 *
 * 在 Vue 组件里用法:
 *   data() { return { commands: getAllCommands() } }
 *   mounted() {
 *     this._unsub = subscribe(list => this.commands = list)
 *   }
 *   beforeUnmount() { this._unsub?.() }
 */
export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/* ────────── 受控显示(给 App 顶层挂载用) ────────── */

export function openPalette() {
  if (_opened) return
  _opened = true
  notifyOpen()
}

export function closePalette() {
  if (!_opened) return
  _opened = false
  notifyOpen()
}

export function togglePalette() {
  _opened = !_opened
  notifyOpen()
}

export function isPaletteOpen() {
  return _opened
}

export function subscribeOpen(fn) {
  if (typeof fn !== 'function') return () => {}
  _openListeners.add(fn)
  return () => _openListeners.delete(fn)
}

/* ────────── App 一站式接入 ────────── */

/**
 * 给 App.vue 用的 composable-ish helper。
 * 返回一个 plain object,适合塞到 data() 后再 watch / 直接绑定。
 *
 *   const ctx = useCommandRegistry()
 *   ctx.commands     // 当前所有命令(响应式由 wireUpdates 同步)
 *   ctx.show         // 当前是否打开
 *   ctx.wireUpdates(this) → 把 this.commands / this.show 与注册表挂钩,组件 unmount 时自动解绑
 */
export function useCommandRegistry() {
  return {
    get commands() { return getAllCommands() },
    get show() { return _opened },
    open: openPalette,
    close: closePalette,
    toggle: togglePalette,

    /**
     * 把 Vue 组件实例的两个字段(commands / show)与注册表双向同步。
     * 调用方需要在组件 data() 中先声明这两个字段。
     * 返回一个 cleanup 函数,组件 beforeUnmount 时调一下。
     */
    wireUpdates(vmOrSetters) {
      let setCommands, setShow, watchOpenChange
      if (typeof vmOrSetters?.setCommands === 'function') {
        setCommands = vmOrSetters.setCommands
        setShow = vmOrSetters.setShow
        watchOpenChange = vmOrSetters.onOpenChange
      } else {
        setCommands = (list) => { vmOrSetters.commands = list }
        setShow = (val) => { vmOrSetters.paletteOpen = val }
      }

      setCommands(getAllCommands())
      setShow(_opened)
      const unsubCmds = subscribe(setCommands)
      const unsubOpen = subscribeOpen((val) => {
        setShow(val)
        if (typeof watchOpenChange === 'function') watchOpenChange(val)
      })
      return () => { unsubCmds(); unsubOpen() }
    }
  }
}

/* ────────── 全局键盘:fallback ────────── */

let _keyboardBound = false
let _detachKeyboard = null

/**
 * 安装全局 ⌘K / Ctrl+K 监听 — 即使 CommandPalette 还没挂载也能捕获。
 * CommandPalette 的 autoBind 已经做这事;这里是给"还没渲染 palette 但想先开"的场景。
 *
 * 返回 detach 函数。
 */
export function installGlobalShortcut() {
  if (_keyboardBound) return _detachKeyboard
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  const handler = (e) => {
    const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')
    if (!isCmdK) return
    e.preventDefault()
    togglePalette()
  }
  document.addEventListener('keydown', handler, { capture: true })
  _keyboardBound = true
  _detachKeyboard = () => {
    document.removeEventListener('keydown', handler, { capture: true })
    _keyboardBound = false
    _detachKeyboard = null
  }
  return _detachKeyboard
}

/* ────────── 默认核心命令 ────────── */

/**
 * 项目无关的核心命令(打开自身、显示帮助等)。
 * 调用方按需 register,不强制。
 */
export const CORE_COMMANDS = Object.freeze([
  {
    id: 'core.help',
    group: '帮助',
    icon: '?',
    title: '显示快捷键帮助',
    keywords: ['help', 'shortcut', '快捷键', '说明'],
    handler: () => {
      // 默认实现就关闭面板;调用方可重新 register 同 id 覆盖
      closePalette()
    }
  },
  {
    id: 'core.close-palette',
    group: '帮助',
    title: '关闭命令面板',
    shortcut: 'Esc',
    handler: closePalette
  }
])

export default {
  registerCommand,
  registerCommands,
  unregisterCommand,
  unregisterByGroup,
  getAllCommands,
  getCommand,
  hasCommand,
  subscribe,
  openPalette,
  closePalette,
  togglePalette,
  isPaletteOpen,
  subscribeOpen,
  useCommandRegistry,
  installGlobalShortcut,
  CORE_COMMANDS
}
