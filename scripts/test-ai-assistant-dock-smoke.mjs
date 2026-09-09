#!/usr/bin/env node

/**
 * AI 助手停靠管理器冒烟测试（plans/plan-ai-assistant-docking.md §7 提交 A 配套）
 *
 * 纯 node 运行，无框架依赖。伪造 WPS 宿主（Application / PluginStorage / Enum /
 * TaskPane webview 行为 / ShowDialog）与跨 webview 共享的 localStorage，
 * 覆盖两块纯逻辑：
 *   1. aiAssistantWindowManager 交接协议（mode 字段 / handover 接管 / 心跳让位 / close 请求）
 *   2. aiAssistantDockManager 状态机（openAs / dockTo 原子交接 / 尺寸验证重试 /
 *      探测缓存 / 回退浮窗 / undockToFloat / closeAll）
 *
 * 尺寸时序（切 DockPosition 后必须延迟设宽高、以面板页回报为准）是探针实测结论，
 * 用伪造面板页的异步 resize 回报来模拟。
 */

let failures = 0

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`✓ ${name}`)
  } else {
    console.log(`✗ ${name}${detail ? ` - ${detail}` : ''}`)
    failures += 1
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const LOCK_KEY = 'nd_ai_assistant_window_lock'
const REQUEST_KEY = 'nd_ai_assistant_window_request'

// ---------------------------------------------------------------------------
// 伪造基础设施
// ---------------------------------------------------------------------------

function createFakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map
  }
}

/** 模拟一个 webview 的 window：localStorage 与其它窗口共享同一实例，事件监听相互独立 */
function createFakeWindow({ storage, app }) {
  const listeners = {}
  const win = {
    localStorage: storage,
    Application: app || null,
    location: { protocol: 'file:', href: 'file:///addons/chayuan_4.1.2/index.html' },
    screen: { width: 1600, availWidth: 1600 },
    devicePixelRatio: 1,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener: (type, fn) => {
      ;(listeners[type] = listeners[type] || []).push(fn)
    },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
    },
    // 手动模拟“写入方以外的窗口收到 storage 事件”
    dispatchStorage: (key) => {
      ;(listeners.storage || []).slice().forEach((fn) => fn({ key }))
    }
  }
  return win
}

/**
 * 伪造 WPS Application。面板 webview 行为：
 *   - CreateTaskPane 后 ~12ms 页面 boot：写 ready 握手 + 初始尺寸回报
 *   - Width/Height 被设置后 ~6ms 页面收到 resize 并回报真实值
 * behavior.dead / behavior.deadAxis：对应轴永远回报 14px（坏死面板，探针实测现象）
 * behavior.noBoot：页面永远不 boot（ready 超时路径）
 */
function createFakeApp(behavior = {}) {
  const storage = createFakeStorage() // PluginStorage（加载项级共享）
  const panes = new Map()
  let appPaneSeq = 0 // 面板 ID 每个 Application 实例内从 1 递增（用例间互不干扰）

  function bootPanePage(pane) {
    const bootId = `boot_${pane.ID}_${Math.random().toString(36).slice(2, 7)}`
    pane._bootId = bootId
    pane._pageWrite = (w, h) => {
      if (pane.deleted) return
      storage.setItem(
        'ai_assistant_pane_ready',
        JSON.stringify({ bootId, mode: 'taskpane', updatedAt: Date.now() })
      )
      storage.setItem(
        'ai_assistant_pane_size',
        JSON.stringify({ bootId, w, h, updatedAt: Date.now() })
      )
    }
    pane._pageWrite(300, 400) // WPS 默认面板尺寸（探针：底栏初始高 ~402）
  }

  const app = {
    Version: '12.1.28492',
    Enum: {
      msoCTPDockPositionLeft: 0,
      msoCTPDockPositionRight: 2,
      msoCTPDockPositionBottom: 3,
      msoCTPDockPositionFloating: 4
    },
    PluginStorage: storage,
    showDialogCalls: [],
    ShowDialog(url, title, w, h, modal) {
      app.showDialogCalls.push({ url, title, w, h, modal })
    },
    CreateTaskPane(url) {
      appPaneSeq += 1
      const pane = {
        ID: appPaneSeq,
        url,
        DockPosition: 4,
        Visible: false,
        deleted: false,
        Delete() {
          pane.deleted = true
          panes.delete(pane.ID)
        }
      }
      let width = 300
      let height = 400
      const scheduleReport = (axis, value) => {
        setTimeout(() => {
          if (!pane._pageWrite) return
          const dead = behavior.dead || behavior.deadAxis === axis
          if (axis === 'width') pane._pageWrite(dead ? 14 : value, 400)
          else pane._pageWrite(300, dead ? 14 : value)
        }, 6)
      }
      Object.defineProperty(pane, 'Width', {
        get: () => width,
        set: (v) => {
          if (behavior.widthIgnored) return // 模拟 WPS 忽略左右面板设宽（探针只证实过 Height 生效）
          width = Number(v)
          scheduleReport('width', width)
        }
      })
      Object.defineProperty(pane, 'Height', {
        get: () => height,
        set: (v) => {
          height = Number(v)
          scheduleReport('height', height)
        }
      })
      panes.set(pane.ID, pane)
      if (!behavior.noBoot) {
        setTimeout(() => {
          if (!pane.deleted) bootPanePage(pane)
        }, 12)
      }
      return pane
    },
    GetTaskPane(id) {
      return panes.get(Number(id)) || null
    }
  }
  return { app, storage, panes }
}

/** 每个用例独立的 manager + 假宿主 + 假 window（全局 window 供模块运行时读取） */
function freshDock(behavior = {}) {
  const { app, storage, panes } = createFakeApp(behavior)
  const localStorage = createFakeStorage()
  const win = createFakeWindow({ storage: localStorage, app })
  globalThis.window = win
  return { app, panes, storage, localStorage, win }
}

const TEST_TIMING = {
  settleDelayMs: 15,
  sizeTotalMs: 260,
  sizeExactGraceMs: 90,
  sizeSetAttempts: 2,
  sizePollMs: 8,
  readyTimeoutMs: 400,
  readyPollMs: 5,
  closeGraceMs: 5
}

// ---------------------------------------------------------------------------
// Part 1 · aiAssistantWindowManager 交接协议
// ---------------------------------------------------------------------------

async function testWindowManagerHandover(wam) {
  console.log('\n-- aiAssistantWindowManager 交接协议 --')
  const sharedStorage = createFakeStorage()
  const winA = createFakeWindow({ storage: sharedStorage })
  const winB = createFakeWindow({ storage: sharedStorage })
  const readLock = () => JSON.parse(sharedStorage.getItem(LOCK_KEY) || 'null')
  const readRequest = () => JSON.parse(sharedStorage.getItem(REQUEST_KEY) || 'null')

  // 浮窗 A 认领，锁带形态字段
  globalThis.window = winA
  const receivedA = []
  const sessionA = wam.createAIAssistantWindowSession((req) => receivedA.push(req), {
    heartbeatMs: 25
  })
  const claimedA = sessionA.claimOwnership({}, { mode: 'float' })
  assert('浮窗认领成功且锁 mode=float', claimedA.ok && readLock().mode === 'float')

  // B 无交接凭据认领 → duplicate + 转发 focus 给 A
  globalThis.window = winB
  const sessionB = wam.createAIAssistantWindowSession(() => {}, { heartbeatMs: 25 })
  const claimedB = sessionB.claimOwnership()
  assert(
    '重复认领被拒并请求持有者聚焦',
    claimedB.ok === false &&
      claimedB.reason === 'duplicate' &&
      readRequest()?.action === 'focus' &&
      readRequest()?.targetInstanceId === readLock().instanceId
  )

  // 交接标记：A 的心跳暂不上写，保留 handover 标记
  const ownerA = readLock().instanceId
  const mark = wam.markAIAssistantHandover('taskpane')
  assert('交接标记写入且返回原持有者', mark.ok && mark.previous?.instanceId === ownerA)
  await sleep(60)
  assert('交接期间旧实例心跳不覆盖标记', readLock().handover === true)

  // B 凭 takeOverHandover 接管；A 心跳遇新主让位
  globalThis.window = winB
  const claimedB2 = sessionB.claimOwnership({}, { mode: 'taskpane', takeOverHandover: true })
  assert('面板凭 handover 标记接管锁', claimedB2.ok && readLock().mode === 'taskpane')
  // 等待 A 的心跳观察到新持有者并彻底让位（让位后 A 不再回写锁）
  await sleep(60)
  sessionB.releaseOwnership()
  await sleep(60)
  assert(
    '旧实例已彻底让位（B 释放后锁保持空置）',
    readLock() === null,
    `实际: ${sharedStorage.getItem(LOCK_KEY)}`
  )

  // close 请求送达
  globalThis.window = winA
  const claimedA2 = sessionA.claimOwnership()
  assert('让位后的会话可重新认领', claimedA2.ok)
  const ownerA2 = readLock().instanceId
  wam.sendAIAssistantCloseRequest(ownerA2)
  winA.dispatchStorage(REQUEST_KEY)
  await sleep(20)
  const closeReq = receivedA.find((r) => r.action === 'close')
  assert('close 请求送达持有者', !!closeReq)

  // 交接失败回滚：恢复原持有者锁记录
  const mark2 = wam.markAIAssistantHandover('taskpane')
  wam.restoreAIAssistantLock(mark2.previous)
  assert('回滚恢复原持有者', readLock()?.instanceId === ownerA2 && !readLock().handover)
}

// ---------------------------------------------------------------------------
// Part 2 · aiAssistantDockManager 状态机
// ---------------------------------------------------------------------------

async function testDockManager(mod) {
  console.log('\n-- aiAssistantDockManager 状态机 --')
  const { createAIAssistantDockManager, buildAIAssistantPaneUrl } = mod

  // T1 默认形态 + openAs('float')
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    assert('默认形态为 float', dock.getMode() === 'float')
    const res = await dock.openAs('float', { prompt: 'hi' })
    assert(
      'openAs(float) 走 ShowDialog 且 URL 带路由',
      res.ok && ctx.app.showDialogCalls.length === 1 && /ai-assistant/.test(ctx.app.showDialogCalls[0].url)
    )
    assert('openAs(float) 记忆形态', dock.getMode() === 'float')
  }

  // T2 openAs('left') 快乐路径：延迟设宽 + 回报验证 + 记忆
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    const res = await dock.openAs('left', { from: 'context', prompt: '你好' })
    const pane = ctx.panes.get(1)
    assert('openAs(left) 成功', res.ok && res.mode === 'left')
    assert('面板先 DockPosition 后 Visible', pane.DockPosition === 0 && pane.Visible === true)
    assert('面板宽目标为屏幕一半(1600/2=800)', pane.Width === 800)
    assert(
      '面板 URL 带 taskpane 协议参数',
      /mode=taskpane/.test(pane.url) && /dock=left/.test(pane.url) && /prompt=/.test(pane.url)
    )
    assert('面板 id 与形态已记忆', ctx.storage.getItem('ai_assistant_taskpane_id') === '1' && ctx.storage.getItem('ai_assistant_dock_mode') === 'left')
    assert('验证过的宽度被记忆', ctx.storage.getItem('ai_assistant_dock_width') === '800')
    const probe = JSON.parse(ctx.storage.getItem('ai_assistant_dock_probe') || '{}')
    assert('探测缓存按版本记录 left 可用', probe.version === '12.1.28492' && probe.results.left === true)
    assert('isDockSupported 读取缓存', dock.isDockSupported('left') === true && dock.isDockSupported('bottom') === null)

    // 重复 openAs 同方向 → 复用已开面板
    const again = await dock.openAs('left')
    assert('同方向重复打开复用面板', again.ok && again.alreadyOpen === true && ctx.panes.size === 1)
  }

  // T3 底栏坏死面板（14px 回报）→ 探测缓存 false + 回退浮窗
  {
    const ctx = freshDock({ deadAxis: 'height' })
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    const res = await dock.openAs('bottom')
    assert('坏死底栏判不支持并回退浮窗', res.ok === false && res.fallback === 'float')
    assert('回退打开了浮窗', ctx.app.showDialogCalls.length === 1)
    assert('回退后形态记忆为 float', dock.getMode() === 'float')
    const probe = JSON.parse(ctx.storage.getItem('ai_assistant_dock_probe') || '{}')
    assert('坏死实证写入探测缓存', probe.results.bottom === false)
    assert('失败面板被删除', ctx.panes.size === 0)
  }

  // T4 面板页始终不 boot（ready 超时）→ 回滚锁、保持原浮窗、不误写探测缓存
  {
    const ctx = freshDock({ noBoot: true })
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    ctx.localStorage.setItem(LOCK_KEY, JSON.stringify({ instanceId: 'float_win_1', mode: 'float', updatedAt: Date.now() }))
    const res = await dock.dockTo('left')
    assert('ready 超时判失败且保持原浮窗', res.ok === false && res.keptPrevious === true)
    assert('失败不另开浮窗', ctx.app.showDialogCalls.length === 0)
    const lock = JSON.parse(ctx.localStorage.getItem(LOCK_KEY) || 'null')
    assert('交接失败回滚锁到原浮窗', lock?.instanceId === 'float_win_1' && !lock?.handover)
    const probe = JSON.parse(ctx.storage.getItem('ai_assistant_dock_probe') || '{}')
    assert('零回报不写探测缓存（避免慢机器误判）', probe.results?.left === undefined)
  }

  // T5 dockTo：浮窗在开 → 原子交接成功后向浮窗发 close 请求
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    ctx.localStorage.setItem(LOCK_KEY, JSON.stringify({ instanceId: 'float_win_1', mode: 'float', updatedAt: Date.now() }))
    const res = await dock.dockTo('right')
    assert('浮窗→右停靠成功', res.ok && res.mode === 'right')
    assert('右停靠枚举与宽度', ctx.panes.get(1).DockPosition === 2 && ctx.panes.get(1).Width === 800)
    const req = JSON.parse(ctx.localStorage.getItem(REQUEST_KEY) || 'null')
    assert('收尾向旧浮窗发 close 请求', req?.action === 'close' && req?.targetInstanceId === 'float_win_1')
  }

  // T6 dock→dock 换方向（快路径）：活面板直接改 DockPosition，不建新面板、不删旧面板
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    await dock.openAs('left')
    const res = await dock.dockTo('bottom')
    assert('左→下切换成功', res.ok && res.mode === 'bottom' && dock.getMode() === 'bottom')
    assert('快路径：复用同一面板', res.fast === true && ctx.panes.size === 1)
    assert('旧面板未被删除', ctx.panes.get(1).deleted !== true)
    assert('DockPosition 已切换为底部', ctx.panes.get(1).DockPosition === 3)
    assert('底部高度设为默认 320', ctx.panes.get(1).Height === 320)
  }

  // T12 快路径失败回落全量：活面板改 DockPosition 抛错时应走「先建后关」重建
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    await dock.openAs('left')
    const pane1 = ctx.panes.get(1)
    // 模拟 WPS 拒绝活面板改 DockPosition：快路径应抛错并回落全量「先建后关」
    const posBackup = pane1.DockPosition
    Object.defineProperty(pane1, 'DockPosition', {
      get: () => posBackup,
      set: () => { throw new Error('position rejected') }
    })
    const res = await dock.dockTo('right')
    assert('快路径失败回落全量仍成功', res.ok && res.mode === 'right' && dock.getMode() === 'right')
    assert('全量路径：新建面板 + 删除旧面板', res.fast !== true && ctx.panes.get(1) === undefined && !!ctx.panes.get(2))
    assert('新面板右停靠枚举', ctx.panes.get(2).DockPosition === 2)
  }

  // T7 undockToFloat：浮窗带 reopen 认领 → 旧面板删除
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    await dock.openAs('left')
    const res = await dock.undockToFloat({ prompt: 'keep' })
    assert('停靠→浮窗成功', res.ok && dock.getMode() === 'float')
    const last = ctx.app.showDialogCalls[ctx.app.showDialogCalls.length - 1]
    assert('浮窗以 reopen=1 打开（可认领交接锁）', /reopen=1/.test(last.url) && /prompt=keep/.test(last.url))
    assert('旧面板被删除且状态清理', ctx.panes.size === 0 && ctx.storage.getItem('ai_assistant_taskpane_id') === null)
  }

  // T8 closeAll：面板删除 + 锁持有者收到 close
  {
    const ctx = freshDock()
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    await dock.openAs('left')
    ctx.localStorage.setItem(LOCK_KEY, JSON.stringify({ instanceId: 'pane_sess_1', mode: 'taskpane', updatedAt: Date.now() }))
    dock.closeAll()
    assert('closeAll 删除面板并清状态', ctx.panes.size === 0 && ctx.storage.getItem('ai_assistant_dock_mode') === 'left')
    const req = JSON.parse(ctx.localStorage.getItem(REQUEST_KEY) || 'null')
    assert('closeAll 请求锁持有者自行关闭', req?.action === 'close' && req?.targetInstanceId === 'pane_sess_1')
  }

  // T9 底栏记忆高度越界被钳制（左右宽已改为屏幕一半策略，不再读宽记忆）
  {
    const ctx = freshDock()
    ctx.storage.setItem('ai_assistant_dock_height', '9999')
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    await dock.openAs('bottom')
    assert('底栏记忆高度钳制到上限', ctx.panes.get(1).Height === 640)
  }

  // T11 WPS 忽略左右面板设宽（探针只证实过 Height 延迟生效）→ 健康默认尺寸即接受，
  // 不写宽度记忆、方向仍判可用（计划共识 9：可设则记忆，不可设用 WPS 默认）
  {
    const ctx = freshDock({ widthIgnored: true })
    const dock = createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
    const res = await dock.openAs('left')
    assert('设宽被忽略时停靠仍成功', res.ok && res.mode === 'left')
    assert('面板保留（不再因尺寸不精确删除）', ctx.panes.size === 1 && ctx.panes.get(1).deleted !== true)
    assert('不写宽度记忆', ctx.storage.getItem('ai_assistant_dock_width') === null)
    assert('方向仍判可用', dock.isDockSupported('left') === true)
  }

  // T10 默认面板 URL 构造（file:// 场景）
  {
    const url = buildAIAssistantPaneUrl('left', { prompt: '察元' })
    assert(
      '默认 URL 带 index.html 哈希入口与协议参数',
      /index\.html#\/ai-assistant\?mode=taskpane&dock=left/.test(url) && /prompt=/.test(url)
    )
  }
}

// ---------------------------------------------------------------------------
// Part 3 · 纯函数
// ---------------------------------------------------------------------------

function testPureHelpers(mod) {
  console.log('\n-- 纯函数 --')
  const { normalizeDockMode, clampPaneSizeValue, isAcceptableSizeReport } = mod
  assert('mode 归一化', normalizeDockMode(' LEFT ') === 'left' && normalizeDockMode('top') === null && normalizeDockMode('') === null)
  assert('尺寸钳制', clampPaneSizeValue('9999', 280, 720) === 720 && clampPaneSizeValue('100', 280, 720) === 280 && clampPaneSizeValue('x', 1, 2) === null)
  assert(
    '尺寸回报判定',
    isAcceptableSizeReport({ w: 420, h: 800 }, 'left', 420) === true &&
      isAcceptableSizeReport({ w: 14, h: 800 }, 'left', 420) === false &&
      isAcceptableSizeReport({ w: 300, h: 320 }, 'bottom', 320) === true &&
      isAcceptableSizeReport({ w: 300, h: 304 }, 'bottom', 320) === true &&
      isAcceptableSizeReport({ w: 300, h: 200 }, 'bottom', 320) === false
  )
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('AI 助手停靠管理器冒烟测试\n')
  const repoRoot = new URL('..', import.meta.url).href
  const wam = await import(repoRoot + 'src/utils/aiAssistantWindowManager.js')
  const dockMod = await import(repoRoot + 'src/utils/host/aiAssistantDockManager.js')

  await testWindowManagerHandover(wam)
  await testDockManager(dockMod)
  testPureHelpers(dockMod)

  console.log(`\n${failures === 0 ? '全部通过 ✓' : `${failures} 项失败 ✗`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('测试运行异常:', e)
  process.exit(1)
})
