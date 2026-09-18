#!/usr/bin/env node

/**
 * AI 助手停靠管理器冒烟测试（plans/plan-ai-assistant-docking.md §7 提交 A 配套）
 *
 * 纯 node 运行，组件定向回归复用现有 compiler-sfc。伪造 WPS 宿主（Application /
 * PluginStorage / Enum / TaskPane webview 行为 / ShowDialog）与跨 webview
 * 共享的 localStorage，覆盖窗口忙碌保护和两块纯逻辑：
 *   1. aiAssistantWindowManager 交接协议（mode 字段 / handover 接管 / 心跳让位 / close 请求）
 *   2. aiAssistantDockManager 状态机（openAs / dockTo 原子交接 / 尺寸验证重试 /
 *      探测缓存 / 回退浮窗 / undockToFloat / closeAll）
 *
 * 尺寸时序（切 DockPosition 后必须延迟设宽高、以面板页回报为准）是探针实测结论，
 * 用伪造面板页的异步 resize 回报来模拟。
 */

import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { babelParse, parse } from '@vue/compiler-sfc'

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

const timerScopes = new Set()

/** 跟踪宿主回报、聚焦延迟和心跳，异常路径也可统一清理。 */
function createFakeTimers(run = (fn) => fn()) {
  const timeouts = new Set()
  const intervals = new Set()
  const timers = {
    setTimeout(fn, ms) {
      const id = setTimeout(() => {
        timeouts.delete(id)
        run(fn)
      }, ms)
      timeouts.add(id)
      return id
    },
    clearTimeout(id) {
      clearTimeout(id)
      timeouts.delete(id)
    },
    setInterval(fn, ms) {
      const id = setInterval(() => run(fn), ms)
      intervals.add(id)
      return id
    },
    clearInterval(id) {
      clearInterval(id)
      intervals.delete(id)
    },
    get intervalCount() { return intervals.size },
    dispose() {
      timeouts.forEach(clearTimeout)
      intervals.forEach(clearInterval)
      timeouts.clear()
      intervals.clear()
      timerScopes.delete(timers)
    }
  }
  timerScopes.add(timers)
  return timers
}

function withWindow(win, fn) {
  const previous = globalThis.window
  globalThis.window = win
  try {
    return fn()
  } finally {
    globalThis.window = previous
  }
}

function createFakeStorage() {
  const map = new Map()
  let writes = 0
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { writes += 1; map.set(k, String(v)) },
    removeItem: (k) => { writes += 1; map.delete(k) },
    get writeCount() { return writes },
    _map: map
  }
}

/** 回调在所属 webview 执行，避免 A 的心跳读写 B 的 window 或移除 B 的监听。 */
function createFakeWindow({ storage, app }) {
  const listeners = {}
  const timers = createFakeTimers((fn) => withWindow(win, fn))
  const win = {
    localStorage: storage,
    Application: app || null,
    location: { protocol: 'file:', href: 'file:///addons/chayuan_5.1.2/index.html' },
    screen: { width: 1600, availWidth: 1600 },
    devicePixelRatio: 1,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    focusCalls: 0,
    focus() { win.focusCalls += 1 },
    get intervalCount() { return timers.intervalCount },
    get listenerCount() { return Object.values(listeners).reduce((n, list) => n + list.length, 0) },
    addEventListener: (type, fn) => {
      ;(listeners[type] = listeners[type] || []).push(fn)
    },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
    },
    // 手动模拟“写入方以外的窗口收到 storage 事件”
    dispatchStorage: (key) => withWindow(win, () => {
      ;(listeners.storage || []).slice().forEach((fn) => fn({ key }))
    }),
    dispose() {
      timers.dispose()
      Object.keys(listeners).forEach((key) => delete listeners[key])
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
  const timers = createFakeTimers()
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
    createTaskPaneCalls: [],
    deletePaneCalls: [],
    ShowDialog(url, title, w, h, modal) {
      app.showDialogCalls.push({ url, title, w, h, modal })
    },
    CreateTaskPane(url) {
      app.createTaskPaneCalls.push(url)
      appPaneSeq += 1
      const pane = {
        ID: appPaneSeq,
        url,
        DockPosition: 4,
        Visible: false,
        deleted: false,
        Delete() {
          app.deletePaneCalls.push(pane.ID)
          pane.deleted = true
          panes.delete(pane.ID)
        }
      }
      let width = 300
      let height = 400
      const scheduleReport = (axis, value) => {
        timers.setTimeout(() => {
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
        timers.setTimeout(() => {
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
  const previousWindow = globalThis.window
  const receivedA = []
  const sessionA = wam.createAIAssistantWindowSession((req) => receivedA.push(req), {
    heartbeatMs: 25
  })
  const sessionB = wam.createAIAssistantWindowSession(() => {}, { heartbeatMs: 25 })
  try {
    // 浮窗 A 认领，锁带形态字段；未提供 isBusy 的旧调用方默认空闲
    globalThis.window = winA
    const claimedA = sessionA.claimOwnership({}, { mode: 'float' })
    assert('浮窗认领成功且锁 mode=float', claimedA.ok && readLock().mode === 'float')
    assert('未提供 isBusy 时锁默认空闲', readLock()?.busy === false && !wam.isAIAssistantWindowBusy())

    // B 无交接凭据认领 → duplicate + 转发 focus 给 A
    globalThis.window = winB
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
    const claimedB2 = sessionB.claimOwnership({}, { mode: 'taskpane', takeOverHandover: true })
    assert('面板凭 handover 标记接管锁', claimedB2.ok && readLock().mode === 'taskpane')
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
  } finally {
    withWindow(winB, () => sessionB.releaseOwnership())
    withWindow(winA, () => sessionA.releaseOwnership())
    assert('交接会话释放锁、全部心跳与监听', readLock() === null &&
      winA.intervalCount + winB.intervalCount + winA.listenerCount + winB.listenerCount === 0)
    winA.dispose()
    winB.dispose()
    globalThis.window = previousWindow
  }
}

async function testWindowManagerBusy(wam) {
  console.log('\n-- aiAssistantWindowManager 忙碌保护 --')
  const storage = createFakeStorage()
  const winA = createFakeWindow({ storage })
  const winB = createFakeWindow({ storage })
  const previousWindow = globalThis.window
  const readLock = () => JSON.parse(storage.getItem(LOCK_KEY) || 'null')
  const received = []
  let busy = false
  // 长心跳确保断言只依赖 syncState 的同步效果，而非偶然等到心跳。
  const options = { heartbeatMs: 60000, isBusy: () => busy }
  const sessionA = wam.createAIAssistantWindowSession((req) => {
    received.push(req)
    if (req.action === 'close') sessionA.releaseOwnership()
  }, options)
  const sessionB = wam.createAIAssistantWindowSession(() => {}, options)
  const query = { from: 'context', prompt: '保留上下文问题', autoSend: '1', multimodal: 'image', kbMode: 'qa' }
  const deliver = (action, requestQuery = query) => {
    storage.setItem(REQUEST_KEY, JSON.stringify({
      targetInstanceId: readLock()?.instanceId,
      action,
      query: requestQuery,
      requestedAt: Date.now()
    }))
    winA.dispatchStorage(REQUEST_KEY)
  }
  try {
    globalThis.window = winA
    sessionA.syncState()
    assert('未认领会话 syncState 不创建锁', readLock() === null && !wam.isAIAssistantWindowBusy())
    const claimed = sessionA.claimOwnership({}, { mode: 'taskpane' })
    const ownerId = readLock()?.instanceId
    assert('空闲 callback 写入 busy=false', claimed.ok && readLock()?.busy === false && !wam.isAIAssistantWindowBusy())

    busy = true
    // 即使尚未发布新的 busy 锁，storage handler 也必须读取实时 callback。
    const idleLock = storage.getItem(LOCK_KEY)
    deliver('close')
    deliver('reopen')
    assert('忙碌 callback 在锁同步前即拒绝 close/reopen', received.length === 0 && storage.getItem(LOCK_KEY) === idleLock)
    sessionA.syncState()
    assert('syncState 立即发布 busy=true 且保持 owner/mode',
      readLock()?.busy === true && wam.isAIAssistantWindowBusy() &&
      readLock()?.instanceId === ownerId && readLock()?.mode === 'taskpane')
    const busyLock = storage.getItem(LOCK_KEY)
    deliver('close')
    deliver('reopen')
    assert('忙碌锁下 close/reopen 不转发、不聚焦、不释放锁',
      received.length === 0 && winA.focusCalls === 0 && storage.getItem(LOCK_KEY) === busyLock)

    assert('忙时 focus 请求仍可发送', wam.focusExistingAIAssistantWindow(query))
    winA.dispatchStorage(REQUEST_KEY)
    assert('忙时 focus 仍转发、聚焦且完整保留 query',
      isDeepStrictEqual(received, [{ action: 'focus', query }]) && winA.focusCalls > 0 &&
      storage.getItem(LOCK_KEY) === busyLock)

    globalThis.window = winB
    const reopenQuery = { ...query, reopen: '1' }
    const rejected = sessionB.claimOwnership(reopenQuery, { mode: 'float', takeOverHandover: true })
    const focusRequest = JSON.parse(storage.getItem(REQUEST_KEY) || 'null')
    assert('reopen=1 和接管选项均不能强抢忙碌实例',
      rejected.ok === false && rejected.reason === 'duplicate' &&
      rejected.ownerInstanceId === ownerId && storage.getItem(LOCK_KEY) === busyLock &&
      winB.intervalCount === 0 && winB.listenerCount === 0)
    assert('被拒的 reopen 改为 focus 且保留 query',
      focusRequest?.action === 'focus' && focusRequest?.targetInstanceId === ownerId &&
      isDeepStrictEqual(focusRequest?.query, reopenQuery))
    winA.dispatchStorage(REQUEST_KEY)
    assert('原持有者收到被拒强抢的 focus',
      isDeepStrictEqual(received[1], { action: 'focus', query: reopenQuery }))
    const beforeHandoverWrites = storage.writeCount
    const mark = wam.markAIAssistantHandover('float')
    assert('忙时 handover 失败且不写存储', mark.ok === false &&
      isDeepStrictEqual(mark.previous, readLock()) && storage.writeCount === beforeHandoverWrites &&
      storage.getItem(LOCK_KEY) === busyLock)

    globalThis.window = winA
    busy = false
    sessionA.syncState()
    assert('任务结束 syncState 立即恢复空闲锁', readLock()?.busy === false && !wam.isAIAssistantWindowBusy())
    deliver('reopen')
    assert('恢复空闲后 reopen 正常转发', isDeepStrictEqual(received[2], { action: 'reopen', query }))
    wam.sendAIAssistantCloseRequest(ownerId)
    winA.dispatchStorage(REQUEST_KEY)
    assert('恢复空闲后 close 正常转发并可释放锁',
      received.length === 4 && received[3].action === 'close' && readLock() === null)
    sessionA.syncState()
    assert('已释放会话 syncState 不复活锁', readLock() === null)

    // 过期 busy 不能永久卡住重启后的窗口，不等待真实 15 秒超时。
    const staleLock = { instanceId: 'expired_busy_owner', mode: 'taskpane', busy: true, updatedAt: Date.now() - 60000 }
    storage.setItem(LOCK_KEY, JSON.stringify(staleLock))
    assert('过期 busy 锁不被视为忙碌', !wam.isAIAssistantWindowBusy())
    const staleMark = wam.markAIAssistantHandover('float')
    assert('过期 busy 锁允许 handover 恢复', staleMark.ok && readLock()?.handover === true &&
      isDeepStrictEqual(staleMark.previous, staleLock))
    storage.setItem(LOCK_KEY, JSON.stringify(staleLock))
    globalThis.window = winB
    busy = true
    const recovered = sessionB.claimOwnership()
    assert('过期 busy 锁允许普通认领并发布新会话 busy', recovered.ok &&
      readLock()?.instanceId !== staleLock.instanceId && readLock()?.busy === true && wam.isAIAssistantWindowBusy())
  } finally {
    withWindow(winB, () => sessionB.releaseOwnership())
    withWindow(winA, () => sessionA.releaseOwnership())
    assert('忙碌回归会话清理全部心跳与监听',
      winA.intervalCount + winB.intervalCount + winA.listenerCount + winB.listenerCount === 0)
    winA.dispose()
    winB.dispose()
    globalThis.window = previousWindow
  }
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

async function testDockManagerBusy(mod) {
  console.log('\n-- aiAssistantDockManager 忙碌入口无副作用 --')
  const operations = [
    ['dockTo(right)', (dock) => dock.dockTo('right')],
    ['undockToFloat', (dock) => dock.undockToFloat({ prompt: 'keep' })],
    ['openAs(float)', (dock) => dock.openAs('float')],
    ['openAs(left)', (dock) => dock.openAs('left')],
    ['openAs(bottom)', (dock) => dock.openAs('bottom')],
    ['closeAll', (dock) => dock.closeAll()]
  ]
  const storageSnapshot = (storage) => ({ entries: [...storage._map], writes: storage.writeCount })
  const paneSnapshot = (ctx) => [...ctx.panes.values()].map((pane) => ({
    id: pane.ID, deleted: pane.deleted, visible: pane.Visible,
    dock: pane.DockPosition, width: pane.Width, height: pane.Height
  }))
  // 分别覆盖浮窗发起的全量路径、停靠面板换向/复用快路径以及删除路径。
  for (const initialMode of ['float', 'left']) {
    for (const [name, invoke] of operations) {
      const ctx = freshDock()
      const dock = mod.createAIAssistantDockManager({ getApplication: () => ctx.app, timing: TEST_TIMING })
      if (initialMode === 'left') {
        const setup = await dock.openAs('left')
        assert(`${initialMode}/${name} 初始面板就绪`, setup.ok)
        // 隐藏面板可检测 openAs 同方向复用时是否在 busy 检查前改 Visible。
        ctx.panes.get(1).Visible = false
      }
      const lock = { instanceId: 'running_task', mode: initialMode === 'float' ? 'float' : 'taskpane', busy: true, updatedAt: Date.now() }
      ctx.localStorage.setItem(LOCK_KEY, JSON.stringify(lock))
      ctx.localStorage.setItem(REQUEST_KEY, JSON.stringify({ action: 'focus', query: { prompt: 'existing' } }))
      const beforeLocal = storageSnapshot(ctx.localStorage)
      const beforePlugin = storageSnapshot(ctx.storage)
      const beforePanes = paneSnapshot(ctx)
      const beforeCalls = [ctx.app.showDialogCalls.length, ctx.app.createTaskPaneCalls.length, ctx.app.deletePaneCalls.length]
      const result = await invoke(dock)
      assert(`${initialMode}/${name} 忙时返回 assistant-busy`,
        isDeepStrictEqual(result, { ok: false, reason: 'assistant-busy' }))
      assert(`${initialMode}/${name} 不建窗口、不删或修改面板`,
        isDeepStrictEqual(beforeCalls, [ctx.app.showDialogCalls.length, ctx.app.createTaskPaneCalls.length, ctx.app.deletePaneCalls.length]) &&
        isDeepStrictEqual(beforePanes, paneSnapshot(ctx)))
      assert(`${initialMode}/${name} 不写锁、请求或 PluginStorage`,
        isDeepStrictEqual(beforeLocal, storageSnapshot(ctx.localStorage)) &&
        isDeepStrictEqual(beforePlugin, storageSnapshot(ctx.storage)))

      // 同一个入口遇到过期 busy 锁必须恢复正常，不能简单以 busy 字段永久拦截。
      ctx.localStorage.setItem(LOCK_KEY, JSON.stringify({ ...lock, updatedAt: Date.now() - 60000 }))
      const recovered = await invoke(dock)
      assert(`${initialMode}/${name} 过期 busy 锁不阻塞恢复`,
        name === 'closeAll'
          ? recovered?.reason !== 'assistant-busy' && ctx.panes.size === 0 &&
            JSON.parse(ctx.localStorage.getItem(REQUEST_KEY) || 'null')?.action === 'close'
          : recovered?.ok === true)
      ctx.win.dispose()
    }
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
// Part 4 · 组件真实 computed 定向回归（不加载 Vue/宿主依赖）
// ---------------------------------------------------------------------------

async function testComponentWindowBusy() {
  console.log('\n-- AIAssistantDialog isWindowBusy --')
  const filename = new URL('../src/components/AIAssistantDialog.vue', import.meta.url)
  const { descriptor, errors } = parse(await readFile(filename, 'utf8'), { filename: filename.pathname })
  if (errors.length) throw new Error(`SFC 解析失败: ${errors.join('; ')}`)
  const source = descriptor.script?.content
  if (!source) throw new Error('未找到组件 script')
  const ast = babelParse(source, { sourceType: 'module' })
  const component = ast.program.body.find((node) => node.type === 'ExportDefaultDeclaration')?.declaration
  const computed = component?.properties?.find((node) => node.key?.name === 'computed')?.value
  const readComputed = (name) => {
    const node = computed?.properties?.find((prop) => prop.key?.name === name)
    if (node?.type !== 'ObjectMethod') throw new Error(`未找到 computed.${name}`)
    // 只执行 AST 定位的真实方法，不复制其实现，也不执行组件 import/生命周期。
    return new Function(`return ({${source.slice(node.start, node.end)}})`)()[name]
  }
  const anyChatTurnRunning = readComputed('anyChatTurnRunning')
  const isWindowBusy = readComputed('isWindowBusy')
  const createState = (patch = {}) => {
    const state = {
      currentChatId: 'foreground',
      activeMcpTurnContexts: {},
      activeLegacyTurnContexts: {},
      isStreaming: false,
      activeDocumentRevisionRunContext: null,
      activeDocumentAwareRunContext: null,
      activeGeneratedOutputRunContext: null,
      sendRoutingLocks: {},
      docWriteLockState: { locked: false, queue: [] },
      ...patch
    }
    Object.defineProperty(state, 'anyChatTurnRunning', { get: () => anyChatTurnRunning.call(state) })
    return state
  }
  const cases = [
    ['全部空闲', {}, false],
    ['后台 MCP 聊天回合（非当前聊天且未 streaming）', { activeMcpTurnContexts: { background: {} } }, true],
    ['后台普通聊天回合（非当前聊天且未 streaming）', { activeLegacyTurnContexts: { background: {} } }, true],
    ['isStreaming', { isStreaming: true }, true],
    ...['activeDocumentRevisionRunContext', 'activeDocumentAwareRunContext', 'activeGeneratedOutputRunContext']
      .map((key) => [key, { [key]: {} }, true]),
    ['发送路由锁', { sendRoutingLocks: { background: true } }, true],
    ['文档写锁持有中', { docWriteLockState: { locked: true, queue: [] } }, true],
    ['仅排队等待文档写锁', { docWriteLockState: { locked: false, queue: [{ label: 'queued task' }] } }, true],
    ['已释放的 false 路由锁不再阻塞', { sendRoutingLocks: { foreground: false } }, false],
    ['混合路由锁仍有后台任务', { sendRoutingLocks: { foreground: false, background: true } }, true],
    ['可选锁状态缺省', { docWriteLockState: null, sendRoutingLocks: null, activeMcpTurnContexts: null, activeLegacyTurnContexts: null }, false]
  ]
  for (const [name, patch, expected] of cases) {
    const actual = isWindowBusy.call(createState(patch))
    assert(`isWindowBusy: ${name}`, actual === expected, `期望 ${expected}，实际 ${actual}`)
  }
  const state = createState({ isStreaming: true, activeMcpTurnContexts: { background: {} } })
  state.isStreaming = false
  assert('流式标记清零不能解锁仍运行的后台回合', isWindowBusy.call(state) === true)
  state.activeMcpTurnContexts = {}
  assert('最后一个回合结束后恢复空闲', isWindowBusy.call(state) === false)

  const methods = component.properties.find((node) => node.key?.name === 'methods').value
  const readMethod = (name) => {
    const node = methods.properties.find((prop) => prop.key?.name === name)
    return new Function(`return ({${source.slice(node.start, node.end)}})`)()[name]
  }
  const previousWindow = globalThis.window
  const win = createFakeWindow({ storage: createFakeStorage() })
  let closes = 0
  let releases = 0
  let saves = 0
  win.close = () => { closes += 1 }
  const session = { releaseOwnership: () => { releases += 1 } }
  const view = createState({
    aiAssistantWindowSession: session,
    aiAssistantTaskPaneMode: false,
    flushHistorySave: () => { saves += 1 }
  })
  Object.defineProperty(view, 'isWindowBusy', { get: () => isWindowBusy.call(view) })
  view.closeWindow = readMethod('closeWindow').bind(view)
  const request = readMethod('handleAIAssistantWindowRequest').bind(view)
  try {
    globalThis.window = win
    view.activeDocumentAwareRunContext = {}
    request({ action: 'close' })
    request({ action: 'reopen' })
    assert('文档任务期间实际 closeWindow 拒绝关闭', view.closeWindow() === false)
    await sleep(60)
    assert('文档任务期间关闭请求不保存、不释放、不关窗',
      closes === 0 && releases === 0 && saves === 0 && view.aiAssistantWindowSession === session)

    view.activeDocumentAwareRunContext = null
    request({ action: 'reopen' })
    assert('延迟关闭尚未执行时仍保留所有权', view.aiAssistantWindowSession === session)
    view.activeGeneratedOutputRunContext = {}
    await sleep(60)
    assert('关闭请求后启动任务的竞态被二次检查拦截',
      closes === 0 && releases === 0 && view.aiAssistantWindowSession === session)

    view.activeGeneratedOutputRunContext = null
    request({ action: 'close' })
    await sleep(60)
    assert('任务完成后实际关闭先保存历史并释放所有权',
      closes === 1 && saves === 1 && releases === 1 && view.aiAssistantWindowSession === null)
  } finally {
    win.dispose()
    globalThis.window = previousWindow
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('AI 助手停靠管理器冒烟测试\n')
  const previousWindow = globalThis.window
  const hadWindow = Object.hasOwn(globalThis, 'window')
  try {
    const repoRoot = new URL('..', import.meta.url).href
    const wam = await import(repoRoot + 'src/utils/aiAssistantWindowManager.js')
    const dockMod = await import(repoRoot + 'src/utils/host/aiAssistantDockManager.js')

    await testWindowManagerHandover(wam)
    await testWindowManagerBusy(wam)
    await testDockManager(dockMod)
    await testDockManagerBusy(dockMod)
    testPureHelpers(dockMod)
    await testComponentWindowBusy()
    assert('测试结束无遗留 session 心跳', [...timerScopes].every((timers) => timers.intervalCount === 0))
  } finally {
    timerScopes.forEach((timers) => timers.dispose())
    if (hadWindow) globalThis.window = previousWindow
    else delete globalThis.window
  }
  console.log(`\n${failures === 0 ? '全部通过 ✓' : `${failures} 项失败 ✗`}`)
  // 自然退出，不再用 process.exit 掩盖泄漏的心跳或延迟回调。
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('测试运行异常:', e)
  process.exitCode = 1
})
