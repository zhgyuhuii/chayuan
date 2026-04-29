#!/usr/bin/env node
/**
 * test-evolution-smoke.mjs — 进化系统冒烟测试
 *
 * 不依赖真实 LLM,只跑确定性模块:
 *   signalStore + failureCluster + raceEvaluator + shadowRunner + rollbackMonitor
 *
 * 流程:
 *   1. 灌入 N 条人工 signal(成功/失败按比例)
 *   2. 验证 failureRate / acceptRate 计算正确
 *   3. 验证 computeHealthScore 返回合理 R/A/C/E + total
 *   4. 验证 shouldProposeEvolution 在高失败率下 propose=true
 *   5. 验证 shadowRunner setShadowCandidate / getShadowCandidate / clearShadowCandidate 状态机
 *   6. 验证 rollbackMonitor.startObservation / sampleAndDecide 不会假阳性回滚
 *
 * 用法:
 *   node scripts/test-evolution-smoke.mjs
 *   node scripts/test-evolution-smoke.mjs --verbose
 *
 * 退出码:0 全 PASS · 1 有 FAIL · 2 脚本异常
 */

/* ────────── 在 import 之前先打 storage 桩 ────────── */
const _store = new Map()
const fakeStorage = {
  getItem: (k) => _store.has(k) ? _store.get(k) : null,
  setItem: (k, v) => { _store.set(k, String(v)) },
  removeItem: (k) => { _store.delete(k) },
  clear: () => { _store.clear() },
  key: (i) => Array.from(_store.keys())[i] || null,
  get length() { return _store.size }
}
globalThis.window = { localStorage: fakeStorage }
globalThis.localStorage = fakeStorage
// 一些模块通过 document 探测;给个最小 stub
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible'
}

/* ────────── 工具 ────────── */
const VERBOSE = process.argv.includes('--verbose')
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m'
}
const ICON_OK = `${C.green}✓${C.reset}`
const ICON_BAD = `${C.red}✗${C.reset}`

let failures = 0
function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ${ICON_OK} ${name}${VERBOSE && detail ? `  ${C.dim}— ${detail}${C.reset}` : ''}`)
  } else {
    console.log(`  ${ICON_BAD} ${name}  ${C.red}— ${detail || 'assertion failed'}${C.reset}`)
    failures += 1
  }
}

function section(title) {
  console.log(`\n${C.bold}${C.cyan}── ${title} ──${C.reset}`)
}

/* ────────── 主流程 ────────── */
async function main() {
  console.log(`${C.bold}进化系统冒烟测试${C.reset}  ${C.dim}(无 LLM,仅确定性模块)${C.reset}\n`)

  const repoRoot = new URL('..', import.meta.url).href
  const {
    appendSignal,
    computeFailureRate,
    computeAcceptRate,
    clearAllSignals,
    listSignalsByAssistant,
    flushSignalsSync
  } = await import(repoRoot + 'src/utils/assistant/evolution/signalStore.js')
  const {
    computeHealthScore
  } = await import(repoRoot + 'src/utils/assistant/evolution/raceEvaluator.js')
  const {
    isFailure,
    shouldProposeEvolution,
    clusterFailuresForAssistant,
    buildEvidencePackages
  } = await import(repoRoot + 'src/utils/assistant/evolution/failureCluster.js')
  const {
    inferProfile,
    getWeights,
    getThresholds,
    RACE_WEIGHTS,
    RACE_THRESHOLDS
  } = await import(repoRoot + 'src/utils/assistant/evolution/gateProfiles.js')
  const {
    registerAnchor,
    getAnchor,
    computeDriftScore,
    isDrifted,
    DRIFT_THRESHOLD
  } = await import(repoRoot + 'src/utils/assistant/evolution/anchorPrompt.js')
  const {
    evaluateNeed
  } = await import(repoRoot + 'src/utils/assistant/evolution/promotionFlow.js')
  const {
    inferModelFamily
  } = await import(repoRoot + 'src/utils/assistant/evolution/judge.js')
  const {
    buildCandidateAssistant
  } = await import(repoRoot + 'src/utils/assistant/evolution/candidateGenerator.js')
  const {
    classifyIntent,
    isHighConfidence
  } = await import(repoRoot + 'src/utils/router/localIntentClassifier.js')
  const perfMod = await import(repoRoot + 'src/utils/perfTracker.js')
  const {
    setShadowCandidate,
    getShadowCandidate,
    clearShadowCandidate,
    listShadowCandidates,
    getQuotaStatus
  } = await import(repoRoot + 'src/utils/assistant/evolution/shadowRunner.js')
  const {
    startObservation,
    sampleAndDecide,
    getObservation,
    endObservation
  } = await import(repoRoot + 'src/utils/assistant/evolution/rollbackMonitor.js')

  const ASSISTANT_ID = 'test-asst-smoke'

  /* ── 1. signalStore ── */
  section('signalStore')
  clearAllSignals()
  for (let i = 0; i < 8; i += 1) {
    appendSignal({ type: 'task', assistantId: ASSISTANT_ID, version: '1.0.0', success: true, taskId: `t-ok-${i}` })
  }
  for (let i = 0; i < 2; i += 1) {
    appendSignal({ type: 'task', assistantId: ASSISTANT_ID, version: '1.0.0', success: false, taskId: `t-fail-${i}`, userNote: '模型未返回' })
  }
  flushSignalsSync()
  const all = listSignalsByAssistant(ASSISTANT_ID)
  assert('appendSignal 写入 10 条', all.length === 10, `实际 ${all.length}`)

  const failRate = computeFailureRate(ASSISTANT_ID, 30)
  assert('computeFailureRate ≈ 0.20', Math.abs(failRate - 0.20) < 0.01, `实际 ${failRate}`)

  const acceptRate = computeAcceptRate(ASSISTANT_ID, 30)
  assert('computeAcceptRate 在 0..1 之间', acceptRate >= 0 && acceptRate <= 1, `实际 ${acceptRate}`)

  /* ── 2. failureCluster.isFailure ── */
  section('failureCluster')
  assert('isFailure(success=false) === true', isFailure({ type: 'task', success: false }) === true)
  assert('isFailure(success=true) === false', isFailure({ type: 'task', success: true }) === false)
  assert('isFailure(thumbs=down) === true',
    isFailure({ type: 'thumbs', metadata: { value: 'down' } }) === true)

  /* ── 3. raceEvaluator ── */
  section('raceEvaluator')
  const health = computeHealthScore(ASSISTANT_ID)
  assert('computeHealthScore 返回非空', !!health)
  if (health) {
    assert('R/A/C/E 都在 0..100',
      [health.R, health.A, health.C, health.E].every(v => v >= 0 && v <= 100),
      `R=${health.R} A=${health.A} C=${health.C} E=${health.E}`)
    assert('total 在 0..100',
      health.total >= 0 && health.total <= 100,
      `total=${health.total}`)
    assert('releaseGate 字段存在', !!health.releaseGate, `releaseGate=${JSON.stringify(health.releaseGate)}`)
  }

  /* ── 4. 高失败率触发 propose ── */
  section('shouldProposeEvolution(高失败率)')
  clearAllSignals()
  for (let i = 0; i < 3; i += 1) {
    appendSignal({ type: 'task', assistantId: ASSISTANT_ID, version: '1.0.0', success: true, taskId: `ok-${i}` })
  }
  for (let i = 0; i < 12; i += 1) {
    appendSignal({
      type: 'task',
      assistantId: ASSISTANT_ID,
      version: '1.0.0',
      success: false,
      taskId: `f-${i}`,
      userNote: 'JSON 解析失败',
      metadata: { errorKind: 'invalid-json' }
    })
  }
  flushSignalsSync()
  const verdict = await shouldProposeEvolution(ASSISTANT_ID, {})
  assert('failure rate ≥ 15% 时 propose=true', verdict.propose === true,
    `propose=${verdict.propose} rate=${verdict.rate?.toFixed?.(2)} reason=${verdict.reason}`)
  assert('urgency 是合法值',
    ['critical', 'high', 'normal', 'none'].includes(verdict.urgency),
    `urgency=${verdict.urgency}`)

  /* ── 5. shadowRunner 状态机 ── */
  section('shadowRunner')
  clearShadowCandidate(ASSISTANT_ID)
  assert('初始状态 getShadowCandidate=null', getShadowCandidate(ASSISTANT_ID) == null)

  const ok = setShadowCandidate(ASSISTANT_ID, 'v-test-001', { note: 'smoke' })
  assert('setShadowCandidate 返回 true', ok === true)

  const c = getShadowCandidate(ASSISTANT_ID)
  assert('读出灰度版本号', c?.versionId === 'v-test-001', `实际 ${JSON.stringify(c)}`)

  const list = listShadowCandidates()
  assert('listShadowCandidates 含此助手',
    Array.isArray(list) && list.some(x => x.assistantId === ASSISTANT_ID))

  clearShadowCandidate(ASSISTANT_ID)
  assert('clearShadowCandidate 后 getShadowCandidate=null',
    getShadowCandidate(ASSISTANT_ID) == null)

  const quota = getQuotaStatus()
  assert('getQuotaStatus 字段齐全',
    typeof quota.used === 'number' && typeof quota.max === 'number' && typeof quota.remaining === 'number',
    `quota=${JSON.stringify(quota)}`)

  /* ── 6a. gateProfiles ── */
  section('gateProfiles')
  const profKeys = Object.keys(RACE_WEIGHTS)
  assert('RACE_WEIGHTS 至少含 generic profile',
    profKeys.includes('generic'), `keys=${profKeys.join(',')}`)
  assert('RACE_WEIGHTS 与 RACE_THRESHOLDS 同型',
    profKeys.every(k => RACE_THRESHOLDS[k]),
    `weights∖thresholds=${profKeys.filter(k => !RACE_THRESHOLDS[k]).join(',')}`)
  assert('每条 weights 的 R+A+C+E 之和 ≈ 1.0',
    profKeys.every(k => {
      const w = RACE_WEIGHTS[k]
      const sum = (w.R || 0) + (w.A || 0) + (w.C || 0) + (w.E || 0)
      return Math.abs(sum - 1.0) < 0.01
    }))

  // 显式 gateProfile 优先
  const explicitProf = inferProfile({ gateProfile: 'rewriter', id: 'whatever' })
  assert('inferProfile 优先使用显式 gateProfile',
    explicitProf === 'rewriter', `实际 ${explicitProf}`)

  // 仅依赖 id 推断
  const spellProf = inferProfile({ id: 'analysis.correct-spell' })
  assert('id 含 spell 时推断出某个非 default 的 profile',
    spellProf !== 'default' || profKeys.length === 1, `实际 ${spellProf}`)

  const wRet = getWeights({ gateProfile: 'rewriter' })
  // getWeights 返回 { profile, weights: { R, A, C, E } }
  const w = wRet?.weights || wRet
  assert('getWeights 的 weights 含 R/A/C/E 四个数字',
    typeof w.R === 'number' && typeof w.A === 'number'
      && typeof w.C === 'number' && typeof w.E === 'number',
    `w=${JSON.stringify(wRet)}`)
  const t = getThresholds({ gateProfile: 'rewriter' })
  const tCore = t?.thresholds || t
  assert('getThresholds 的 thresholds.total 是数字',
    typeof tCore?.total === 'number',
    `t=${JSON.stringify(t)}`)

  /* ── 6b. anchorPrompt ── */
  section('anchorPrompt')
  const ANCHOR_ID = 'anchor-test-' + Date.now()
  const baseAnchor = {
    systemPrompt: '你是中文校对专家。识别文本中的错别字与标点误用,返回 JSON。',
    userPromptTemplate: '检查下列文本:{text}'
  }
  const reg = registerAnchor(ANCHOR_ID, baseAnchor)
  assert('registerAnchor 返回非空',
    !!reg && reg.assistantId === ANCHOR_ID,
    `reg=${JSON.stringify(reg)}`)
  assert('getAnchor 取回相同的 systemPrompt',
    getAnchor(ANCHOR_ID)?.systemPrompt === baseAnchor.systemPrompt)

  // 候选与锚点完全相同 → drift ≈ 0
  const driftSame = computeDriftScore({ ...baseAnchor }, ANCHOR_ID)
  assert('完全一致候选的 driftScore ≤ 5',
    driftSame <= 5, `实际 ${driftSame}`)

  // 候选与锚点完全不同 → drift 较高
  const driftFar = computeDriftScore({
    systemPrompt: '你是天文学家,讲解黑洞与星系的演化。',
    userPromptTemplate: '解释:{topic}'
  }, ANCHOR_ID)
  assert('不相关候选的 driftScore 显著大于 0',
    driftFar > driftSame + 20,
    `same=${driftSame} far=${driftFar}`)

  // isDrifted 返回 { drifted, score }(不是 boolean!)
  const farPrompt = {
    systemPrompt: '你是天文学家,讲解黑洞与星系的演化。',
    userPromptTemplate: '解释:{topic}'
  }
  const driftCheck = isDrifted(farPrompt, ANCHOR_ID, Math.max(0, driftFar - 1))
  assert('isDrifted 返回 { drifted, score } 结构',
    typeof driftCheck === 'object' && typeof driftCheck.drifted === 'boolean'
      && typeof driftCheck.score === 'number',
    `实际 ${JSON.stringify(driftCheck)}`)
  assert('driftFar - 1 阈值下,driftCheck.drifted === true',
    driftCheck?.drifted === true,
    `driftFar=${driftFar}, score=${driftCheck?.score}`)
  assert('低阈值下 driftCheck.score === driftFar(同一份候选 + 同一锚点)',
    driftCheck?.score === driftFar,
    `score=${driftCheck?.score} expected=${driftFar}`)

  /* ── 6c. failureCluster.clusterFailuresForAssistant ── */
  section('failureCluster.clusterFailuresForAssistant')
  // 上一段已灌入 12 失败,且 errorKind=invalid-json,应聚出 ≥1 个 cluster
  const clusters = await clusterFailuresForAssistant(ASSISTANT_ID, { minSize: 2 })
  assert('clusterFailuresForAssistant 返回数组',
    Array.isArray(clusters), `type=${typeof clusters}`)
  assert('至少聚出一个 cluster(12 条同类失败)',
    clusters.length >= 1,
    `clusters.length=${clusters.length}`)

  if (clusters.length > 0) {
    const evid = buildEvidencePackages(clusters, { currentVersion: '1.0.0' })
    assert('buildEvidencePackages 同长度返回',
      evid.length === clusters.length)
    assert('evidence 包带 samples 数组',
      evid[0]?.samples && Array.isArray(evid[0].samples))
  }

  /* ── 6d. promotionFlow.evaluateNeed ── */
  section('promotionFlow.evaluateNeed(无 LLM)')
  const need = await evaluateNeed(ASSISTANT_ID, { failure: { minSize: 2 } })
  assert('evaluateNeed 返回 propose 字段',
    typeof need?.propose === 'boolean',
    `need=${JSON.stringify(need)}`)
  assert('高失败率 → propose=true',
    need.propose === true,
    `propose=${need.propose} reason=${need.reason}`)
  assert('evidencePackages 数组非空',
    Array.isArray(need.evidencePackages) && need.evidencePackages.length >= 1)

  /* ── 6e. judge.inferModelFamily(交叉家族识别) ── */
  section('judge.inferModelFamily')
  const fams = [
    [{ providerId: 'openai',          modelId: 'gpt-4o-mini'         }, 'openai'],
    [{ providerId: 'OPENAI',          modelId: 'o1-preview'          }, 'openai'],
    [{ providerId: 'Anthropic',       modelId: 'claude-3-5-sonnet'   }, 'anthropic'],
    [{ providerId: 'google',          modelId: 'gemini-1.5-pro'      }, 'google'],
    [{ providerId: 'aliyun-bailian',  modelId: 'qwen-plus'           }, 'qwen'],
    [{ providerId: 'deepseek',        modelId: 'deepseek-chat'       }, 'deepseek'],
    [{ providerId: 'zhipu',           modelId: 'glm-4'               }, 'zhipu'],
    [{ providerId: 'moonshot',        modelId: 'kimi-128k'           }, 'moonshot'],
    [{ providerId: 'doubao',          modelId: 'doubao-pro-32k'      }, 'doubao'],
    [{ providerId: 'OLLAMA',          modelId: 'llama3:8b'           }, 'local'],
    [{ providerId: 'made-up',         modelId: 'banana-1'            }, 'unknown']
  ]
  for (const [model, expected] of fams) {
    const got = inferModelFamily(model)
    assert(`inferModelFamily(${model.providerId}/${model.modelId}) === ${expected}`,
      got === expected, `实际 ${got}`)
  }

  /* ── 6f. candidateGenerator.buildCandidateAssistant ── */
  section('candidateGenerator.buildCandidateAssistant')
  const baseAsst = {
    id: 'asst-x',
    label: '现有助手',
    systemPrompt: '原 system',
    userPromptTemplate: '原 user',
    temperature: 0.4,
    description: '原描述',
    persona: '原 persona',
    outputFormat: 'plain',
    extraField: 'should-survive'
  }
  const builtCand = buildCandidateAssistant(baseAsst, {
    candidate: {
      systemPrompt: '新 system',
      userPromptTemplate: '新 user',
      description: '新描述'
    },
    rootCause: 'json-error',
    repairReason: '增强结构化约束'
  })
  assert('buildCandidateAssistant 返回非空',
    !!builtCand)
  assert('id 保持原值', builtCand?.id === 'asst-x')
  assert('systemPrompt 用候选值', builtCand?.systemPrompt === '新 system')
  assert('temperature 在候选未给时回退原值',
    builtCand?.temperature === 0.4,
    `实际 ${builtCand?.temperature}`)
  assert('原助手的 extraField 被保留(spread)',
    builtCand?.extraField === 'should-survive')
  assert('_evolution.rootCause 已写入',
    builtCand?._evolution?.rootCause === 'json-error',
    `_evolution=${JSON.stringify(builtCand?._evolution)}`)
  assert('null currentAssistant 时返回 null',
    buildCandidateAssistant(null, { candidate: {} }) === null)
  assert('payload 缺 candidate 字段时返回 null',
    buildCandidateAssistant(baseAsst, {}) === null)

  /* ── 6g. localIntentClassifier ── */
  section('localIntentClassifier')
  const c1 = classifyIntent('帮我润色这段话,使其更正式')
  assert('润色类输入 → kind=document-operation 或 assistant-task',
    ['document-operation', 'assistant-task'].includes(c1.kind),
    `kind=${c1.kind} reason=${c1.reason}`)
  const c2 = classifyIntent('为什么天空是蓝色的?')
  assert('知识问答类输入 → kind=chat',
    c2.kind === 'chat',
    `kind=${c2.kind}`)
  const c3 = classifyIntent('')
  assert('空输入 → kind=chat 且 confidence=low',
    c3.kind === 'chat' && c3.confidence === 'low',
    `c3=${JSON.stringify(c3)}`)
  assert('isHighConfidence(score=90) === true',
    isHighConfidence({ score: 90 }) === true)
  assert('isHighConfidence(score=50) === false',
    isHighConfidence({ score: 50 }) === false)
  assert('isHighConfidence 默认阈值是 85',
    isHighConfidence({ score: 85 }) === true
      && isHighConfidence({ score: 84 }) === false)

  /* ── 6h. perfTracker.getStats(数学正确性) ── */
  section('perfTracker.getStats')
  perfMod.clear()
  // 灌入 100, 200, 300, ... 1000(10 条),全部 ok
  for (let i = 1; i <= 10; i += 1) {
    perfMod.record({
      kind: 'test.ms',
      providerId: 'p',
      modelId: 'm',
      durationMs: i * 100,
      ok: true,
      bytes: 50 * i
    })
  }
  const ps = perfMod.getStats()
  assert('count === 10', ps.count === 10, `实际 ${ps.count}`)
  assert('ok === 10, fail === 0',
    ps.ok === 10 && ps.fail === 0)
  assert('avg === 550(100..1000 等差数列)',
    ps.avg === 550, `实际 ${ps.avg}`)
  assert('p50 ≈ 600(floor(10*0.5)=5,sortedArr[5]=600)',
    ps.p50 === 600, `实际 ${ps.p50}`)
  assert('p99 === 1000(尾部)',
    ps.p99 === 1000, `实际 ${ps.p99}`)
  assert('byKind.test.ms 存在且 count=10',
    ps.byKind?.['test.ms']?.count === 10,
    `byKind=${JSON.stringify(ps.byKind)}`)
  assert('recent 数组按时间倒序',
    ps.recent[0]?.durationMs === 1000 && ps.recent[ps.recent.length - 1]?.durationMs === 100,
    `recent first=${ps.recent[0]?.durationMs} last=${ps.recent.at(-1)?.durationMs}`)

  // 失败场景
  perfMod.record({ kind: 'test.ms', providerId: 'p', modelId: 'm', durationMs: 5000, ok: false, note: 'timeout' })
  const ps2 = perfMod.getStats()
  assert('record(ok:false) 后 fail === 1',
    ps2.fail === 1)
  perfMod.clear()

  /* ── 7. rollbackMonitor 假阳性防护 ── */
  section('rollbackMonitor(健康样本不应触发回滚)')
  endObservation(ASSISTANT_ID)  // 清旧
  startObservation({
    assistantId: ASSISTANT_ID,
    versionId: 'v-test-002',
    previousVersionId: 'v-test-001',
    observationDays: 7
  })
  assert('startObservation 后 getObservation 非空',
    !!getObservation(ASSISTANT_ID))

  let rolledBack = false
  await sampleAndDecide({
    assistantId: ASSISTANT_ID,
    callRollback: () => { rolledBack = true }
  })
  assert('单次健康采样不应触发回滚', rolledBack === false)
  endObservation(ASSISTANT_ID)
  clearAllSignals()

  /* ── 8. workflow 基础设施(W1+W2) ── */
  section('workflow 基础设施')
  const wfChannel = await import(repoRoot + 'src/utils/workflow/workflowProgressChannel.js')
  const wfExtra = await import(repoRoot + 'src/utils/workflow/workflowToolsExtra.js')

  // channel emit + 订阅
  let received = null
  const unsub = wfChannel.onlyInstance('test-inst', (m) => { received = m })
  wfChannel.emit('node:ready', { instanceId: 'test-inst', nodeId: 'n1' })
  // 同窗口本地 listener 是同步触发
  assert('workflowProgressChannel 本地订阅工作',
    received?.eventType === 'node:ready' && received?.nodeId === 'n1',
    `received=${JSON.stringify(received)}`)
  unsub()

  // extra tools 注册
  const extras = wfExtra.getExtraTools()
  assert('EXTRA_TOOLS 含 4 个 P0 节点',
    extras.length === 4 &&
    extras.find(t => t.type === 'assistant-invoke') &&
    extras.find(t => t.type === 'parallel') &&
    extras.find(t => t.type === 'loop') &&
    extras.find(t => t.type === 'human-confirm'),
    `types=${extras.map(t => t.type).join(',')}`)

  // mergeWithBuiltin 不重复
  const merged = wfExtra.mergeWithBuiltin([{ type: 'parallel', title: '已存在' }, { type: 'other' }])
  assert('mergeWithBuiltin 去重(同 type 不覆盖)',
    merged.filter(t => t.type === 'parallel').length === 1,
    `count=${merged.filter(t => t.type === 'parallel').length}`)

  // human-confirm 节点超时返回 timeout
  const confirmResult = await wfExtra.executeExtraTool({
    id: 'hc1', type: 'human-confirm',
    config: { timeoutMs: 50, timeoutAction: 'reject' }
  }, {
    instanceId: 'test-inst-hc',
    requestUserConfirm: () => new Promise(() => {}),  // 永不 resolve
    input: 'preserved'
  })
  assert('human-confirm 超时 → decision=timeout',
    confirmResult.decision === 'timeout',
    `result=${JSON.stringify(confirmResult)}`)

  // parallel 节点 all 模式
  const parallelResult = await wfExtra.executeExtraTool({
    id: 'p1', type: 'parallel',
    config: {
      branches: [['a'], ['b'], ['c']],
      waitMode: 'all',
      concurrency: 4
    }
  }, {
    instanceId: 'test-inst-p',
    runChildNodes: async (ids) => `ran:${ids.join(',')}`
  })
  assert('parallel all 模式返回 3 个分支结果',
    Array.isArray(parallelResult.output) && parallelResult.output.length === 3,
    `output=${JSON.stringify(parallelResult.output)}`)

  // loop 节点 times 模式
  const loopResult = await wfExtra.executeExtraTool({
    id: 'l1', type: 'loop',
    config: { mode: 'times', times: 3, childNodeIds: ['x'] }
  }, {
    instanceId: 'test-inst-l',
    runChildNodes: async (ids, scope) => scope.loopIndex
  })
  assert('loop times 模式跑 3 轮',
    loopResult.count === 3 && loopResult.output.length === 3,
    `count=${loopResult.count}, output=${JSON.stringify(loopResult.output)}`)

  // workflowInstanceStore CRUD(skip — 需 IndexedDB,Node 没有)
  // 仅 smoke 一下 import 通过
  const wfStore = await import(repoRoot + 'src/utils/workflow/workflowInstanceStore.js')
  assert('workflowInstanceStore 导出齐全',
    typeof wfStore.persistInstance === 'function' &&
    typeof wfStore.listResumable === 'function' &&
    typeof wfStore.getInstance === 'function')

  // telemetryBridge
  const wfTelemetry = await import(repoRoot + 'src/utils/workflow/workflowTelemetryBridge.js')
  assert('workflowTelemetryBridge 导出 install/uninstall',
    typeof wfTelemetry.installTelemetryBridge === 'function' &&
    typeof wfTelemetry.uninstallTelemetryBridge === 'function')

  /* ── 9. workflow W3-W7 ── */
  section('workflow W3-W7 高级')
  const wfP1 = await import(repoRoot + 'src/utils/workflow/workflowToolsP1.js')
  const wfP2 = await import(repoRoot + 'src/utils/workflow/workflowToolsP2.js')
  const wfRetry = await import(repoRoot + 'src/utils/workflow/retryPolicy.js')
  const wfTpl = await import(repoRoot + 'src/utils/workflow/workflowTemplates.js')
  const wfShare = await import(repoRoot + 'src/utils/workflow/workflowShare.js')
  const wfDiff = await import(repoRoot + 'src/utils/workflow/workflowDiff.js')
  const wfEvo = await import(repoRoot + 'src/utils/workflow/workflowEvolution.js')
  const wfTrig = await import(repoRoot + 'src/utils/workflow/workflowTrigger.js')
  const wfReplay = await import(repoRoot + 'src/utils/workflow/workflowReplay.js')
  const wfSandbox = await import(repoRoot + 'src/utils/workflow/codeSandbox.js')

  assert('P1_TOOLS 含 4 个节点',
    wfP1.P1_TOOLS.length === 4 &&
    wfP1.P1_TOOLS.find(t => t.type === 'sub-workflow') &&
    wfP1.P1_TOOLS.find(t => t.type === 'try-catch'))

  const costRes = wfP1.estimateWorkflowCost({
    nodes: [
      { id: 'a', type: 'chat-once', config: { maxTokens: 1000 } },
      { id: 'b', type: 'parallel', config: { branches: [['a'], ['b']] } },
      { id: 'c', type: 'condition-check' }
    ]
  })
  assert('estimateWorkflowCost 累计 LLM 调用',
    costRes.llmCalls > 0 && costRes.nodeCount === 3)

  const valRes = wfP1.validateNode({ id: 'x', type: 'chat-once', config: {} })
  assert('validateNode 抓出 chat-once 缺 userPrompt',
    !valRes.ok && valRes.errors.some(e => e.includes('userPrompt')))

  let attempts = 0
  const retryRes = await wfRetry.withRetry(async () => {
    attempts++
    if (attempts < 3) throw new Error('retry me')
    return 'ok'
  }, { retries: 3, baseMs: 1, backoff: 'fixed' })
  assert('withRetry 第 3 次成功',
    retryRes.ok === true && retryRes.attempts === 3)

  const br = wfRetry.makeBreaker({ failureThreshold: 2, resetMs: 1000 })
  br.recordFailure(); br.recordFailure()
  assert('breaker 2 次失败后 open', br.isOpen() === true)
  br.reset()
  assert('breaker reset 后 closed', br.isOpen() === false)

  assert('P2_TOOLS 含 8 个节点', wfP2.P2_TOOLS.length === 8)

  const aggRes = await wfP2.executeP2Tool(
    { id: 'agg', type: 'aggregate-list', config: { sources: ['a', 'b', 'c'], filterEmpty: true } },
    { nodeOutputs: { a: 'x', b: '', c: 'y' } }
  )
  assert('aggregate-list 过滤空值', aggRes.ok && aggRes.output.length === 2)

  const mrRes = await wfP2.executeP2Tool(
    { id: 'mr', type: 'map-reduce', config: { itemsExpr: '__items__', mapExpr: 'item * 2', reduceMode: 'sum' } },
    { resolveExpr: () => [1, 2, 3] }
  )
  assert('map-reduce sum=12', mrRes.ok && mrRes.output === 12)

  assert('内置 8 个工作流模板', wfTpl.listTemplates().length === 8)
  const tplMerged = wfTpl.mergeWorkflowTemplates([{ id: 'tmpl.contract-audit', name: 'user own' }])
  assert('mergeWorkflowTemplates 不覆盖用户同 id',
    tplMerged.find(w => w.id === 'tmpl.contract-audit')?.name === 'user own')

  const exportJson = wfShare.exportWorkflowJSON({ id: 'w1', name: 'test', nodes: [], edges: [] })
  assert('exportWorkflowJSON 含 formatVersion=1',
    JSON.parse(exportJson).formatVersion === 1)
  const importRes = await wfShare.importWorkflowJSON(exportJson)
  assert('importWorkflowJSON roundtrip',
    importRes.ok && importRes.workflow.id === 'w1')
  const link = wfShare.buildShareLink({ id: 'w2', name: 't', nodes: [], edges: [] })
  assert('buildShareLink chayuan:// 协议',
    link.startsWith('chayuan://install?wf='))

  const diff = wfDiff.diffWorkflows(
    { id: 'w', nodes: [{ id: 'a', type: 'chat-once' }], edges: [] },
    { id: 'w', nodes: [{ id: 'a', type: 'chat-once', config: { x: 1 } }, { id: 'b', type: 'delay' }], edges: [{ source: 'a', target: 'b' }] }
  )
  assert('diff: 1 节点新增 + 1 节点改配置',
    diff.nodesAdded.length === 1 && diff.nodesChanged.length === 1)
  assert('recommendBump 返回 minor',
    wfDiff.recommendBump(diff) === 'minor')
  assert('semverCompare 1.2.3 < 1.3.0',
    wfDiff.semverCompare('1.2.3', '1.3.0') < 0)
  assert('bumpVersion patch',
    wfDiff.bumpVersion('1.2.3', 'patch') === '1.2.4')

  const wfHealth = wfEvo.computeWorkflowHealth('test-wf', {
    allSignals: [
      { type: 'task', assistantId: 'workflow.test-wf', timestamp: Date.now(), success: true, duration: 1500 },
      { type: 'task', assistantId: 'workflow.test-wf', timestamp: Date.now(), success: true, duration: 2000 },
      { type: 'task', assistantId: 'workflow.test-wf', timestamp: Date.now(), success: false, duration: 5000 }
    ]
  })
  assert('computeWorkflowHealth R = 67%',
    wfHealth && wfHealth.R === 67)

  const cronNow = new Date(2026, 0, 15, 3, 0)
  assert('shouldFireNow "0 3 * * *" 在 03:00 触发',
    wfTrig.shouldFireNow('0 3 * * *', cronNow) === true)
  assert('shouldFireNow "0 4 * * *" 在 03:00 不触发',
    wfTrig.shouldFireNow('0 4 * * *', cronNow) === false)

  const replayer = wfReplay.createReplayer({
    snapshot: {
      n1: { startedAt: 1000, endedAt: 1500, status: 'done' },
      n2: { startedAt: 1500, endedAt: 2200, status: 'done' }
    }
  })
  assert('replay events 返回 4 条', replayer.getEvents().length === 4)

  const lintBad = wfSandbox.lintCode('eval("1+1")')
  assert('codeSandbox 拒绝 eval', !lintBad.ok)
  const lintOk = wfSandbox.lintCode('return input.x + input.y')
  assert('codeSandbox 通过纯计算代码', lintOk.ok === true)

  /* ── 10. 任务系统 ── */
  section('任务系统(taskKernel / events / achievements / timeCapsule)')
  const tk = await import(repoRoot + 'src/utils/task/taskKernel.js')
  const tb = await import(repoRoot + 'src/utils/task/taskEventBus.js')
  const ta = await import(repoRoot + 'src/utils/task/taskAchievement.js')
  const tcap = await import(repoRoot + 'src/utils/task/taskTimeCapsule.js')

  assert('STATUS 8 个状态', Object.keys(tk.STATUS).length === 8)
  assert('canTransition pending → running 允许',
    tk.canTransition('pending', 'running') === true)
  assert('canTransition completed → running 不允许',
    tk.canTransition('completed', 'running') === false)

  const tkTask = tk.createTask({ kind: 'assistant', title: 'demo' })
  assert('createTask 默认 status pending',
    tkTask.status === 'pending' && tkTask.kind === 'assistant' && tkTask.id.startsWith('assistant_'))

  const tkTrans = tk.transitionStatus(tkTask, 'running')
  assert('transitionStatus 写入 startedAt',
    tkTrans.ok && tkTask.status === 'running' && tkTask.startedAt > 0)

  tk.updateProgress(tkTask, 0.5, 'half-done', 5, 10)
  assert('updateProgress 0.5 → 50%',
    tkTask.progress === 0.5 && tkTask.stage === 'half-done' && tkTask.current === 5)

  const ne = tk.normalizeError(new Error('429 rate limit'))
  assert('normalizeError 把 rate limit 转用户友好',
    ne.userMessage.includes('频繁'))

  const adapted = tk.adaptTask({ id: 'old1', status: 'done', progress: 87, title: 'legacy' })
  assert('adaptTask: done → completed; 87 → 0.87',
    adapted.status === 'completed' && adapted.progress === 0.87)

  let evReceived = null
  const evUnsub = tb.onlyTask('test-task', m => { evReceived = m })
  tb.emit('task:completed', { taskId: 'test-task', kind: 'workflow', success: true })
  assert('taskEventBus 本地订阅成功',
    evReceived?.eventType === 'task:completed' && evReceived?.success === true)
  evUnsub()

  ta.reset()
  for (let i = 0; i < 10; i++) {
    ta.onTaskCompleted({ id: `t${i}`, kind: 'assistant' })
  }
  const unlocked = ta.getUnlocked()
  assert('完成 10 次解锁青铜成就',
    !!unlocked.find(a => a.id === 'total-10'))

  const capEmpty = await tcap.generateCapsule({ period: 'month', hotTasks: [] })
  assert('timeCapsule 空数据 empty=true',
    capEmpty.empty === true)

  const cap = await tcap.generateCapsule({
    period: 'month',
    hotTasks: [
      { kind: 'assistant', status: 'completed', startedAt: Date.now() - 1000, endedAt: Date.now() },
      { kind: 'workflow', status: 'completed', startedAt: Date.now() - 2000, endedAt: Date.now() }
    ]
  })
  assert('timeCapsule 处理 2 条任务',
    !cap.empty && cap.total === 2 && cap.completed === 2)

  /* ── 11. 运行性缺口闭合(X 系列) ── */
  section('运行性缺口闭合')
  const installer = await import(repoRoot + 'src/utils/assistant/runtimeAssistantsInstaller.js')
  const spellPerf = await import(repoRoot + 'src/utils/spellCheckPerfWrapper.js')

  assert('NEW_ASSISTANT_COUNT === 18',
    installer.NEW_ASSISTANT_COUNT === 18)
  const autoList = await installer.listAutoInstalled()
  assert('listAutoInstalled 返回数组',
    Array.isArray(autoList))
  assert('shouldSkipJsonSchema 默认 false',
    spellPerf.shouldSkipJsonSchema('openai', 'gpt-4o-mini') === false)
  spellPerf.markJsonSchemaUnsupported('aliyun-bailian', 'qwen-plus')
  assert('markJsonSchemaUnsupported 后 shouldSkip = true',
    spellPerf.shouldSkipJsonSchema('aliyun-bailian', 'qwen-plus') === true)
  const optimized = spellPerf.optimizeSpellCheckRequest({
    providerId: 'aliyun-bailian',
    modelId: 'qwen-plus',
    messages: [{ role: 'user', content: 'test' }],
    response_format: { type: 'json_schema' }
  })
  assert('optimize 自动 strip response_format(已知不兼容)',
    !optimized.response_format && !!optimized._optimizerNote)

  /* ── 总结 ── */
  console.log()
  if (failures === 0) {
    console.log(`${C.green}${C.bold}全部通过 ✨${C.reset}`)
    process.exit(0)
  } else {
    console.log(`${C.red}${C.bold}${failures} 项失败${C.reset}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(`${C.red}${C.bold}脚本异常:${C.reset}`, err)
  process.exit(2)
})
