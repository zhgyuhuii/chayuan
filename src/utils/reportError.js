/**
 * reportError - 统一错误反馈工具
 *
 * 替代项目中散落的 100+ 处 `alert('xxx失败: ' + (e?.message || e))`。
 *
 * 优势:
 *   1. 自动收集 stack + e?.code + e?.cause,可复制完整诊断信息
 *   2. 安全降级到 alert(safeErrorDialog 不可用时)
 *   3. 上报到信号库(P3 起,用于"用户撤销"等失败追踪)
 *
 * 用法:
 *   import { reportError, reportInfo } from '../utils/reportError.js'
 *   try { ... } catch (e) { reportError('保存文档失败', e) }
 */

import { showSafeErrorDetail } from './safeErrorDialog.js'

function safeStringify(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch (_) {
    try { return String(value) } catch (_) { return '' }
  }
}

function buildDetail(error, options = {}) {
  if (!error) return options.fallback || '未知错误'
  const lines = []
  if (error.message) lines.push(String(error.message))
  if (error.code) lines.push(`code: ${error.code}`)
  if (error.cause) {
    lines.push('--- cause ---')
    lines.push(safeStringify(error.cause))
  }
  if (error.stack && options.includeStack !== false) {
    lines.push('--- stack ---')
    lines.push(String(error.stack).split('\n').slice(0, 12).join('\n'))
  }
  if (options.context) {
    lines.push('--- context ---')
    lines.push(safeStringify(options.context))
  }
  if (lines.length === 0) lines.push(safeStringify(error))
  return lines.join('\n')
}

/**
 * 报告错误。
 *  title: 一句话标题(必填),例如"保存文档失败"
 *  error: Error 对象或字符串
 *  options:
 *    context:       附加上下文对象(capabilityKey/taskId/selToken/etc)
 *    merge:         默认 false,失败应立即可见
 *    includeStack:  默认 true
 *    fallback:      没有 error 信息时的默认文案
 *    silent:        true 时只 console,不弹框(供静默重试场景)
 */
export function reportError(title, error, options = {}) {
  const finalTitle = String(title || '操作失败')
  const detail = buildDetail(error, options)
  try { console.error(`[chayuan] ${finalTitle}:`, error) } catch (_) {}

  if (options.silent === true) return

  try {
    showSafeErrorDetail({
      title: finalTitle,
      detail,
      merge: options.merge === true
    })
  } catch (e) {
    try {
      alert(`${finalTitle}\n\n${detail.slice(0, 1500)}`)
    } catch (_) {}
  }
}

/**
 * 报告非错误的提示信息(成功/警告)。
 * 当前回退到 alert,P2 阶段会替换为 mini-toast。
 */
export function reportInfo(message, options = {}) {
  const text = String(message || '').trim()
  if (!text) return
  try { console.info(`[chayuan]`, text) } catch (_) {}
  if (options.silent === true) return
  try {
    alert(text.slice(0, 1500))
  } catch (_) {}
}

/**
 * 包一层执行,自动捕获并 report,返回 fn 结果或 undefined。
 *
 *   const result = withErrorBoundary('保存文档', () => doSave(), { context: { docName } })
 */
export function withErrorBoundary(title, fn, options = {}) {
  if (typeof fn !== 'function') return undefined
  try {
    return fn()
  } catch (e) {
    reportError(title, e, options)
    return undefined
  }
}

/**
 * 异步版本。
 */
export async function withErrorBoundaryAsync(title, fn, options = {}) {
  if (typeof fn !== 'function') return undefined
  try {
    return await fn()
  } catch (e) {
    reportError(title, e, options)
    return undefined
  }
}

export default {
  reportError,
  reportInfo,
  withErrorBoundary,
  withErrorBoundaryAsync
}
