/**
 * routerParallelDecider — 多路 LLM 路由判定并行竞速
 *
 * v2 计划 P1-A3:把"是否 chat / 是否 doc-op / 是否 generated 输出 / 是否 assistant-task"
 * 等多个串行的 LLM 路由判定改成 Promise.race + Promise.all,首字符提速 1-2s。
 *
 * 用法:
 *   const winner = await raceDecisions([
 *     { label: 'chat-quick', run: () => fastChatProbe(text) },
 *     { label: 'doc-op',    run: () => docOpProbe(text) },
 *     { label: 'gen-output',run: () => genProbe(text) }
 *   ], { timeoutMs: 1500 })
 *   if (winner.label === 'chat-quick' && winner.value === 'yes') { ...take shortcut... }
 *
 * 特性:
 *   - 全部并行;最先返回**且 value 不为 null**的项胜出
 *   - 整体超时 → 返回 { label: 'timeout', value: null }
 *   - 任意一项 throw 不影响其它(单 probe 失败不致命)
 *   - 返回所有完成的 probe(非 winner 也保留),便于做交叉投票
 */

const DEFAULT_TIMEOUT_MS = 1500

/**
 * @param probes Array<{ label, run, accept? }>
 *   - accept(value): boolean — 这个值算"决定性结果"吗?默认非空即接受
 * @param options { timeoutMs, signal }
 * @returns { winner: { label, value } | null, all: Array<{ label, value, error, durationMs }> }
 */
export async function raceDecisions(probes, options = {}) {
  const list = (probes || []).filter(p => p && typeof p.run === 'function')
  if (list.length === 0) return { winner: null, all: [] }

  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS
  const all = list.map(p => ({
    label: String(p.label || ''),
    value: undefined,
    error: null,
    durationMs: 0
  }))

  let winnerIndex = -1
  let resolveOuter
  const outer = new Promise(res => { resolveOuter = res })

  const timer = setTimeout(() => {
    if (winnerIndex < 0) resolveOuter('timeout')
  }, timeoutMs)

  list.forEach((p, idx) => {
    const accept = typeof p.accept === 'function' ? p.accept : (v => v != null && v !== '')
    const t0 = Date.now()
    Promise.resolve()
      .then(() => p.run({ signal: options.signal }))
      .then(value => {
        all[idx].value = value
        all[idx].durationMs = Date.now() - t0
        if (winnerIndex < 0 && accept(value)) {
          winnerIndex = idx
          resolveOuter('won')
        }
      })
      .catch(err => {
        all[idx].error = String(err?.message || err)
        all[idx].durationMs = Date.now() - t0
      })
  })

  await outer
  clearTimeout(timer)

  return {
    winner: winnerIndex >= 0
      ? { label: all[winnerIndex].label, value: all[winnerIndex].value }
      : null,
    all
  }
}

/**
 * 全部 probe 都跑完(不抢跑),返回逐项结果。
 * 用于"投票"或"全签同意才判定"的场景。
 */
export async function awaitAllDecisions(probes, options = {}) {
  const list = (probes || []).filter(p => p && typeof p.run === 'function')
  if (list.length === 0) return []
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS

  return Promise.all(list.map(p => {
    const t0 = Date.now()
    return Promise.race([
      Promise.resolve().then(() => p.run({ signal: options.signal })),
      new Promise(res => setTimeout(() => res(undefined), timeoutMs))
    ])
      .then(value => ({
        label: String(p.label || ''),
        value,
        error: null,
        durationMs: Date.now() - t0
      }))
      .catch(err => ({
        label: String(p.label || ''),
        value: undefined,
        error: String(err?.message || err),
        durationMs: Date.now() - t0
      }))
  }))
}

export default {
  raceDecisions,
  awaitAllDecisions
}
