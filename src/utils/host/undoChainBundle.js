/**
 * undoChainBundle — 把多次 doc 写回包成一次"用户级 undo"
 *
 * v2 计划 P1-B8:任务里多次连续写回(批量替换、多段插入),
 * 用户希望 Ctrl+Z 一次撤销整个任务,而不是回滚 N 次。
 *
 * WPS 不像 Word 有 Application.CustomUndo 入口,
 * 但可以用 Application.Undo + 计数实现近似:
 *   bundle.start()    记录 currentUndoCount(若可用)
 *   bundle.markStep() 每次写回后内部计数 +1
 *   bundle.commit()   什么都不做(占位 — 让用户 Ctrl+Z 自然撤销 N 次)
 *   bundle.undoAll()  代用户调 N 次 Application.Undo()
 *
 * 主要价值:在 UI 上提供"撤销整个 X"按钮,内部调 undoAll(N)。
 *
 * 注意:不直接接管系统 Ctrl+Z(代价过大),只是给程序逻辑一个清晰的"事务"边界。
 */

import { withHostOp, getApp } from './hostBridge.js'

const _bundles = new Map()
let _idSeq = 0

/* ────────── 创建 / 管理 ────────── */

/**
 * 开启一个 undo bundle。
 * 返回 bundle 句柄(对象);用 bundle.id 在跨函数调用间引用。
 */
export function startBundle(options = {}) {
  const id = `bundle_${++_idSeq}_${Date.now().toString(36)}`
  const bundle = {
    id,
    label: String(options.label || '助手任务'),
    startedAt: Date.now(),
    steps: 0,
    metadata: options.metadata || {},
    closed: false
  }
  _bundles.set(id, bundle)
  return bundle
}

/**
 * 在 bundle 内部记录一次"已写回"。
 * caller 在每次成功的 documentActions 调用之后调一次。
 */
export function markStep(bundleOrId) {
  const b = resolve(bundleOrId)
  if (!b || b.closed) return
  b.steps += 1
}

/** 关闭 bundle(可选显式调,或让 GC 处理)。 */
export function commitBundle(bundleOrId) {
  const b = resolve(bundleOrId)
  if (!b) return null
  b.closed = true
  return { ...b }
}

/**
 * 一键撤销整个 bundle:对宿主调 N 次 Application.Undo()。
 * 失败立即停止(避免越撤越多)。
 *
 * 返回 { undone, error }
 */
export async function undoAll(bundleOrId) {
  const b = resolve(bundleOrId)
  if (!b) return { undone: 0, error: 'bundle not found' }
  if (b.steps <= 0) return { undone: 0, error: '' }
  let undone = 0
  try {
    await withHostOp(async () => {
      const app = getApp()
      if (!app) throw new Error('Application 不可用')
      for (let i = 0; i < b.steps; i += 1) {
        try {
          // WPS COM 用 Application.Undo();无显式 boolean 返回
          app.Undo?.()
          undone += 1
        } catch (e) {
          // 单步失败 → 立即停
          break
        }
      }
    }, { name: 'undo-bundle' })
  } catch (e) {
    return { undone, error: String(e?.message || e) }
  }
  // 标记 bundle 已被反转(steps=0)
  b.steps = Math.max(0, b.steps - undone)
  return { undone, error: '' }
}

export function getBundle(id) {
  return _bundles.get(String(id || '')) || null
}

export function listOpenBundles() {
  return Array.from(_bundles.values()).filter(b => !b.closed)
}

export function clearBundle(id) {
  return _bundles.delete(String(id || ''))
}

/** 内部:让 API 同时支持传 bundle 对象 / id 字符串。 */
function resolve(bundleOrId) {
  if (!bundleOrId) return null
  if (typeof bundleOrId === 'string') return _bundles.get(bundleOrId) || null
  return _bundles.get(bundleOrId.id) || null
}

/* ────────── 装饰器糖 ────────── */

/**
 * 把一个 async 函数包成"自动开/标记 step/commit"的形式。
 *   const work = wrapAsBundle('批量重写', async (bundle) => {
 *     await applyDocumentAction(...);   markStep(bundle)
 *     await applyDocumentAction(...);   markStep(bundle)
 *     return result
 *   })
 *
 *   const { result, bundleId, undo } = await work()
 *   undo()   // 一键回退
 */
export function wrapAsBundle(label, fn) {
  if (typeof fn !== 'function') throw new Error('wrapAsBundle: fn is required')
  return async function bundleRunner() {
    const bundle = startBundle({ label })
    try {
      const result = await fn(bundle)
      commitBundle(bundle)
      return {
        result,
        bundleId: bundle.id,
        steps: bundle.steps,
        undo: () => undoAll(bundle)
      }
    } catch (e) {
      commitBundle(bundle)
      throw e
    }
  }
}

export default {
  startBundle,
  markStep,
  commitBundle,
  undoAll,
  getBundle,
  listOpenBundles,
  clearBundle,
  wrapAsBundle
}
