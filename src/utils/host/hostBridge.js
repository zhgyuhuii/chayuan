/**
 * hostBridge - WPS 宿主单例访问层
 *
 * 收敛全项目 11+ 处自实现的 getApplication() fallback,提供:
 *   1. 统一句柄获取(window.Application > opener > parent)
 *   2. 健康检查(can read Selection / ActiveDocument)
 *   3. 主进程 op 队列骨架(P4 完整实现,P0 先留接口)
 *   4. 跨窗口 RPC 占位(BroadcastChannel,见 P4)
 *
 * 设计原则:
 *   - 永远不 throw,失败返回 null,由调用方决定降级
 *   - 不缓存 Application 引用(WPS 重启会失效)
 *   - 健康检查作为 P0 阶段"为什么没反应"问题的快速诊断入口
 */

const HEALTH_CHECK_CACHE_MS = 800

let healthCacheAt = 0
let healthCacheValue = null

/**
 * 获取 WPS Application 单例。
 * 顺序:window.Application > window.opener?.Application > window.parent?.Application
 */
export function getApp() {
  try {
    if (typeof window === 'undefined') return null
    return (
      window.Application ||
      window.opener?.Application ||
      window.parent?.Application ||
      null
    )
  } catch (_) {
    return null
  }
}

/**
 * 获取当前活动文档。失败返回 null,不 throw。
 */
export function getDoc() {
  try {
    return getApp()?.ActiveDocument || null
  } catch (_) {
    return null
  }
}

/**
 * 获取当前 Selection。失败返回 null,不 throw。
 */
export function getSelection() {
  try {
    return getApp()?.Selection || null
  } catch (_) {
    return null
  }
}

/**
 * 获取 PluginStorage(WPS 加载项专属持久化)。
 */
export function getPluginStorage() {
  try {
    return getApp()?.PluginStorage || null
  } catch (_) {
    return null
  }
}

/**
 * 获取 ribbonUI(用于 InvalidateControl)。
 */
export function getRibbonUI() {
  try {
    return getApp()?.ribbonUI || null
  } catch (_) {
    return null
  }
}

/**
 * 健康检查 — 连续 800ms 内复用结果,避免高频 COM 调用。
 *
 * 返回每个维度独立判定,便于 UI 显式提示"哪一项不可达":
 *   - app:           Application 是否可达
 *   - opener:        是否通过 opener 拿到(用于诊断对话框场景)
 *   - activeDoc:     ActiveDocument 是否存在
 *   - selection:     Selection 是否可读
 *   - pluginStorage: PluginStorage 是否可写
 *   - ribbonUI:      ribbonUI 是否存在
 */
export function checkHostHealth(options = {}) {
  const now = Date.now()
  if (
    !options.force &&
    healthCacheValue &&
    now - healthCacheAt < HEALTH_CHECK_CACHE_MS
  ) {
    return healthCacheValue
  }

  const result = {
    ok: false,
    app: false,
    opener: false,
    activeDoc: false,
    selection: false,
    pluginStorage: false,
    ribbonUI: false,
    via: 'none',
    issues: []
  }

  let app = null
  try {
    if (typeof window !== 'undefined' && window.Application) {
      app = window.Application
      result.via = 'self'
    } else if (typeof window !== 'undefined' && window.opener?.Application) {
      app = window.opener.Application
      result.via = 'opener'
      result.opener = true
    } else if (typeof window !== 'undefined' && window.parent?.Application) {
      app = window.parent.Application
      result.via = 'parent'
    }
  } catch (e) {
    result.issues.push(`app-access:${e?.message || 'fail'}`)
  }

  if (!app) {
    result.issues.push('Application 不可达')
    healthCacheValue = result
    healthCacheAt = now
    return result
  }
  result.app = true

  try {
    if (app.ActiveDocument) result.activeDoc = true
    else result.issues.push('未打开文档')
  } catch (e) {
    result.issues.push(`activeDoc:${e?.message || 'fail'}`)
  }

  try {
    if (app.Selection) result.selection = true
    else result.issues.push('Selection 不可读')
  } catch (e) {
    result.issues.push(`selection:${e?.message || 'fail'}`)
  }

  try {
    const ps = app.PluginStorage
    if (ps && typeof ps.setItem === 'function') {
      const probeKey = '__chy_health_probe__'
      ps.setItem(probeKey, '1')
      ps.setItem(probeKey, '')
      result.pluginStorage = true
    } else {
      result.issues.push('PluginStorage 不可写')
    }
  } catch (e) {
    result.issues.push(`pluginStorage:${e?.message || 'fail'}`)
  }

  try {
    if (app.ribbonUI) result.ribbonUI = true
  } catch (e) {
    result.issues.push(`ribbonUI:${e?.message || 'fail'}`)
  }

  result.ok = result.app && result.activeDoc && result.selection
  healthCacheValue = result
  healthCacheAt = now
  return result
}

/**
 * 同步执行宿主操作。如果当前窗口是对话框(via=opener),将来可在 P4
 * 通过 BroadcastChannel 投递到主窗串行执行,以避免 STA 重入风险。
 *
 * P0 实现:直接调用 fn(),只做错误捕获和上下文标记。
 */
export function withHostOp(fn, options = {}) {
  if (typeof fn !== 'function') return null
  const label = String(options.label || 'host-op').trim()
  try {
    return fn()
  } catch (e) {
    if (typeof options.onError === 'function') {
      try { options.onError(e) } catch (_) {}
    }
    if (options.rethrow !== false) {
      const err = e instanceof Error ? e : new Error(String(e))
      err.hostOpLabel = label
      throw err
    }
    return null
  }
}

/**
 * 异步版本(为 P4 主进程 op 队列预留接口)。
 * P0 实现:直接 await fn()。
 */
export async function withHostOpAsync(fn, options = {}) {
  return withHostOp(() => fn(), options)
}

/**
 * 失效健康检查缓存(测试或主动重连时调用)。
 */
export function invalidateHealthCache() {
  healthCacheValue = null
  healthCacheAt = 0
}

export default {
  getApp,
  getDoc,
  getSelection,
  getPluginStorage,
  getRibbonUI,
  checkHostHealth,
  withHostOp,
  withHostOpAsync,
  invalidateHealthCache
}
