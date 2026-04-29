/**
 * capabilityBus — 能力总线
 *
 * v2 计划 P4 核心:把分散在 ribbon.OnAction 80+ case、各种 service.js 里的
 * 能力调用收敛到一个 namespace.action 路由。
 *
 *   bus.registerNamespace('declassify', handlers)
 *   bus.execute('declassify.run', { docId, level })
 *   bus.list()                  // 看所有已注册能力(支持 wildcard 'declassify.*')
 *   bus.help('declassify.run')  // 单条能力的描述
 *
 * 设计原则:
 *   - namespace 一旦注册,handler 不可热替换(避免运行时被插件偷换)
 *   - execute 内部 try/catch + perfTracker;失败时 throw,让 caller 决定怎么 UI 反馈
 *   - 描述(description)由 namespace 一并提供,自动喂给 catalog 工具
 */

import { startTimer as startPerfTimer } from '../perfTracker.js'

const _namespaces = new Map()  // ns → { handlers: Map, meta: {description, owner, ...} }

/* ────────── 注册 ────────── */

/**
 * 注册一个 namespace。同名再注册 → 抛错(避免被插件覆盖)。
 *   handlers: { actionName: { run: async (params, ctx) => any, description?, params?, returns? } }
 *   meta: { description, owner, version }
 */
export function registerNamespace(ns, handlers, meta = {}) {
  const namespace = String(ns || '').trim()
  if (!namespace) throw new Error('registerNamespace: ns 必填')
  if (_namespaces.has(namespace)) {
    throw new Error(`registerNamespace: '${namespace}' 已被注册,不允许覆盖`)
  }
  if (!handlers || typeof handlers !== 'object') {
    throw new Error('registerNamespace: handlers 必须是对象')
  }

  const map = new Map()
  for (const [actionName, def] of Object.entries(handlers)) {
    if (typeof def?.run !== 'function') {
      if (typeof console !== 'undefined') {
        console.warn(`[bus] ${namespace}.${actionName} 缺少 run 函数,跳过`)
      }
      continue
    }
    map.set(actionName, {
      name: actionName,
      run: def.run,
      description: String(def.description || ''),
      params: def.params || null,
      returns: def.returns || null
    })
  }
  _namespaces.set(namespace, { handlers: map, meta: { ...meta } })
  return () => {
    _namespaces.delete(namespace)
  }
}

/* ────────── 执行 ────────── */

/**
 * 执行 'namespace.action' 形式的能力。
 *   params:  传给 handler.run 的第一个参数
 *   ctx:     可选,签发的上下文(用户 id、跟踪 id 等)
 */
export async function execute(target, params = {}, ctx = {}) {
  const [ns, action] = String(target || '').split('.')
  if (!ns || !action) throw new Error(`execute: target 必须是 'ns.action' 形式,实际 '${target}'`)
  const entry = _namespaces.get(ns)
  if (!entry) throw new Error(`execute: namespace '${ns}' 未注册`)
  const handler = entry.handlers.get(action)
  if (!handler) throw new Error(`execute: '${ns}.${action}' 未找到`)

  const stop = startPerfTimer({ kind: `bus.${ns}.${action}`, providerId: 'capability-bus', modelId: ns })
  try {
    const result = await handler.run(params, ctx)
    stop({ ok: true, bytes: 0 })
    return result
  } catch (e) {
    stop({ ok: false, note: String(e?.message || e).slice(0, 80) })
    throw e
  }
}

/* ────────── 查询 ────────── */

/**
 * 列出所有能力。
 *   pattern: 'ns.*' / 'ns.action' / '*' 形式的过滤。
 */
export function list(pattern = '*') {
  const out = []
  const [filterNs, filterAction] = String(pattern || '*').split('.')
  for (const [ns, entry] of _namespaces) {
    if (filterNs !== '*' && filterNs !== ns) continue
    for (const [action, handler] of entry.handlers) {
      if (filterAction && filterAction !== '*' && filterAction !== action) continue
      out.push({
        target: `${ns}.${action}`,
        description: handler.description,
        params: handler.params,
        returns: handler.returns
      })
    }
  }
  return out
}

export function help(target) {
  const found = list(target)
  return found[0] || null
}

export function listNamespaces() {
  return Array.from(_namespaces.keys())
}

export function hasCapability(target) {
  return list(target).length > 0
}

export default {
  registerNamespace,
  execute,
  list,
  help,
  listNamespaces,
  hasCapability
}
