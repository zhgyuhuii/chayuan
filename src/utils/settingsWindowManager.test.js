/**
 * 设置窗口「撤销+重开」回归锁定（2026-11-21 macOS 真机 bug）：
 * 设置窗口藏在 WPS 文档窗口后面时，焦点通道（window.focus）抬不动 ShowDialog
 * 原生窗口 → 点击「立即配置模型」永远无可见反应。修法：macOS 上锁新鲜时写 revoke
 * 让旧窗口自关并重开新窗口；claimOwnership 在 revoke 窗口期内允许接管旧锁。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function installWindowStub({ mac = true } = {}) {
  const store = new Map()
  const calls = { showDialog: [], windowOpen: [] }
  const listeners = new Map()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(fn)
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
    Application: {
      PluginStorage: { getItem: () => '' },
      ShowDialog: (...args) => calls.showDialog.push(args)
    },
    location: { protocol: 'https:', origin: 'http://127.0.0.1:62588', pathname: '/index.html', href: 'http://127.0.0.1:62588/index.html' },
    open: (...args) => calls.windowOpen.push(args),
    focus: () => {}
  })
  // navigator 在 Node ≥21 是 getter-only，须 defineProperty 覆写
  Object.defineProperty(globalThis, 'navigator', {
    value: { platform: mac ? 'MacIntel' : 'Win32' },
    configurable: true,
    writable: true
  })
  return { store, calls, listeners, emit: (type, event) => listeners.get(type)?.forEach(fn => fn(event)) }
}

async function loadModule() {
  // 动态引入保证 stub 先于模块内 window 访问就绪（模块顶层不碰 window，但稳妥起见）
  return import('./settingsWindowManager.js')
}

describe('openSettingsWindow · 锁新鲜时的通道选择', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete globalThis.window
  })

  it('macOS：写 revoke 并调度重开，不发焦点请求', async () => {
    const { store, calls } = installWindowStub({ mac: true })
    const { openSettingsWindow } = await loadModule()
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'old_1', updatedAt: Date.now() }))
    const ret = openSettingsWindow({ menu: 'model-settings' }, { title: '模型设置' })
    expect(ret).toBe(true)
    const revoke = JSON.parse(store.get('nd_settings_window_revoke'))
    expect(revoke.targetInstanceId).toBe('old_1')
    expect(store.has('nd_settings_window_request')).toBe(false)
    expect(calls.showDialog).toHaveLength(0)
    vi.advanceTimersByTime(400)
    expect(calls.showDialog).toHaveLength(1)
    const [url, title, width, height] = calls.showDialog[0]
    expect(url).toContain('#/settings?')
    expect(url).toContain('menu=model-settings')
    expect(title).toBe('模型设置')
    expect(width).toBe(1000)
    expect(height).toBe(680)
  })

  it('macOS：重开前锁被别的窗口接管 → 跳过重开避免双窗', async () => {
    const { store, calls } = installWindowStub({ mac: true })
    const { openSettingsWindow } = await loadModule()
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'old_1', updatedAt: Date.now() }))
    openSettingsWindow({ menu: 'model-settings' }, {})
    // 旧窗口自关前，另一个窗口抢先接管了锁
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'new_2', updatedAt: Date.now() }))
    vi.advanceTimersByTime(400)
    expect(calls.showDialog).toHaveLength(0)
  })

  it('macOS：锁已死（超过 STALE_MS）→ 首开路径立即 ShowDialog', async () => {
    const { store, calls } = installWindowStub({ mac: true })
    const { openSettingsWindow } = await loadModule()
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'dead', updatedAt: Date.now() - 20000 }))
    openSettingsWindow({ menu: 'model-settings' }, {})
    expect(calls.showDialog).toHaveLength(1)
    expect(store.has('nd_settings_window_revoke')).toBe(false)
  })

  it('非 macOS：保持焦点请求通道不变（回归锁定）', async () => {
    const { store, calls } = installWindowStub({ mac: false })
    const { openSettingsWindow } = await loadModule()
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'old_1', updatedAt: Date.now() }))
    openSettingsWindow({ menu: 'model-settings' }, {})
    const req = JSON.parse(store.get('nd_settings_window_request'))
    expect(req.targetInstanceId).toBe('old_1')
    expect(store.has('nd_settings_window_revoke')).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(calls.showDialog).toHaveLength(0)
  })
})

describe('createSettingsWindowSession · revoke 监听与接管', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete globalThis.window
  })

  it('收到指向自己的 revoke → 释放锁并触发 onRevoke（自关让路）', async () => {
    const { store, calls, emit } = installWindowStub({ mac: true })
    const { createSettingsWindowSession } = await loadModule()
    const revoked = vi.fn()
    const session = createSettingsWindowSession(vi.fn(), revoked)
    const claimed = session.claimOwnership({})
    expect(claimed.ok).toBe(true)
    const myInstanceId = JSON.parse(store.get('nd_settings_window_lock')).instanceId
    store.set('nd_settings_window_revoke', JSON.stringify({ targetInstanceId: myInstanceId, at: Date.now() }))
    emit('storage', { key: 'nd_settings_window_revoke' })
    expect(revoked).toHaveBeenCalledTimes(1)
    expect(store.has('nd_settings_window_lock')).toBe(false)
    // 后续 revoke 再来一次不再触发（已非锁主）
    store.set('nd_settings_window_revoke', JSON.stringify({ targetInstanceId: myInstanceId, at: Date.now() }))
    emit('storage', { key: 'nd_settings_window_revoke' })
    expect(revoked).toHaveBeenCalledTimes(1)
    expect(calls.showDialog).toHaveLength(0)
  })

  it('别人的 revoke 不触发自关', async () => {
    const { store, emit } = installWindowStub({ mac: true })
    const { createSettingsWindowSession } = await loadModule()
    const revoked = vi.fn()
    const session = createSettingsWindowSession(vi.fn(), revoked)
    session.claimOwnership({})
    store.set('nd_settings_window_revoke', JSON.stringify({ targetInstanceId: 'someone_else', at: Date.now() }))
    emit('storage', { key: 'nd_settings_window_revoke' })
    expect(revoked).not.toHaveBeenCalled()
    expect(store.has('nd_settings_window_lock')).toBe(true)
  })

  it('claimOwnership：锁新鲜但被 revoke 指向 → 接管而非自关', async () => {
    const { store } = installWindowStub({ mac: true })
    const { createSettingsWindowSession } = await loadModule()
    // 模拟死窗口留下的新鲜锁 + openSettingsWindow 已写 revoke
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'dead_1', updatedAt: Date.now() }))
    store.set('nd_settings_window_revoke', JSON.stringify({ targetInstanceId: 'dead_1', at: Date.now() }))
    const session = createSettingsWindowSession(vi.fn(), vi.fn())
    const claimed = session.claimOwnership({})
    expect(claimed.ok).toBe(true)
    // 锁已换主：不再指向被撤销的死实例
    expect(JSON.parse(store.get('nd_settings_window_lock')).instanceId).not.toBe('dead_1')
  })

  it('claimOwnership：锁新鲜且无 revoke → duplicate（原行为回归锁定）', async () => {
    const { store } = installWindowStub({ mac: true })
    const { createSettingsWindowSession } = await loadModule()
    store.set('nd_settings_window_lock', JSON.stringify({ instanceId: 'alive_1', updatedAt: Date.now() }))
    const session = createSettingsWindowSession(vi.fn(), vi.fn())
    const claimed = session.claimOwnership({})
    expect(claimed.ok).toBe(false)
    expect(claimed.reason).toBe('duplicate')
    expect(claimed.ownerInstanceId).toBe('alive_1')
  })
})
