#!/usr/bin/env node

globalThis.window = globalThis.window || { Application: null, opener: null, parent: null }
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible'
}

const repoRoot = new URL('..', import.meta.url).href
let failures = 0

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`✓ ${name}`)
  } else {
    console.log(`✗ ${name}${detail ? ` - ${detail}` : ''}`)
    failures += 1
  }
}

async function main() {
  console.log('Service layer smoke tests\n')

  const exactTools = await import(repoRoot + 'src/services/documentIntelligence/exactTools.js')
  const chunkPlanner = await import(repoRoot + 'src/services/documentIntelligence/chunkPlanner.js')
  const verifier = await import(repoRoot + 'src/services/documentIntelligence/verifier.js')
  const semantic = await import(repoRoot + 'src/services/documentIntelligence/semanticExtractor.js')
  const synth = await import(repoRoot + 'src/services/documentIntelligence/synthesizer.js')
  const storage = await import(repoRoot + 'src/services/documentIntelligence/storage.js')
  const rag = await import(repoRoot + 'src/services/documentIntelligence/ragStore.js')
  const chatFlow = await import(repoRoot + 'src/services/sendPipeline/chatFlow.js')
  const documentFlow = await import(repoRoot + 'src/services/sendPipeline/documentFlow.js')
  const assistantFlow = await import(repoRoot + 'src/services/sendPipeline/assistantFlow.js')
  const generatedOutputFlow = await import(repoRoot + 'src/services/sendPipeline/generatedOutputFlow.js')
  const schema = await import(repoRoot + 'src/services/schema/jsonSchemaValidator.js')
  const toolRegistry = await import(repoRoot + 'src/services/toolRegistry/toolRegistry.js')
  const toolPolicy = await import(repoRoot + 'src/services/toolRegistry/toolExecutionPolicy.js')
  const toolAudit = await import(repoRoot + 'src/services/toolRegistry/toolAudit.js')
  const workflow = await import(repoRoot + 'src/services/workflowOrchestration/workflowValidator.js')
  const audit = await import(repoRoot + 'src/services/assistantEvolution/auditLedger.js')
  const evalSuite = await import(repoRoot + 'src/services/assistantEvolution/evaluationSuite.js')
  const evolutionPolicy = await import(repoRoot + 'src/services/assistantEvolution/evolutionPolicy.js')
  const evolutionPersistence = await import(repoRoot + 'src/services/assistantEvolution/evolutionPersistence.js')
  const virtualList = await import(repoRoot + 'src/services/ui/virtualList.js')
  const chunkWorker = await import(repoRoot + 'src/workers/chunkPlannerClient.js')
  const textWorker = await import(repoRoot + 'src/workers/textStatsWorker.js')
  const textClient = await import(repoRoot + 'src/workers/textStatsClient.js')

  const exact = exactTools.resolveExactToolRequest('统计成语数量：画蛇添足、亡羊补牢')
  assert('exactTools counts idioms', exact?.result?.stats?.total === 2)
  const dedupe = exactTools.resolveExactToolRequest('请去重：苹果、香蕉、苹果')
  assert('exactTools deduplicates items', dedupe?.tool === 'text.deduplicate' && dedupe.result.unique.length === 2)
  const found = exactTools.resolveExactToolRequest('查找 Cursor：Cursor 很好，Cursor 很快')
  assert('exactTools finds keyword positions', found?.tool === 'text.find' && found.result.count === 2)
  const plannedChunks = chunkPlanner.planTextChunks('第一段。\n\n第二段。', {
    chunkSettings: { maxChunkLength: 4, overlapLength: 0 }
  })
  assert('chunkPlanner attaches offsets and paragraph refs', plannedChunks.chunks[0].startOffset === 0 && plannedChunks.chunks[0].paragraphIndexes.length > 0)

  let stream = chatFlow.createChatStreamState({ startedAt: 100 })
  stream = chatFlow.appendChatStreamChunk(stream, '你', 120)
  stream = chatFlow.appendChatStreamChunk(stream, '好', 130)
  stream = chatFlow.completeChatStreamState(stream, 150)
  assert('chatFlow accumulates stream chunks', stream.content === '你好' && stream.chunkCount === 2 && stream.ok)

  const creationPlan = documentFlow.planDocumentFlow('请帮我写出 Cursor 的使用教程', {
    hasDocument: false,
    hasSelection: false
  })
  assert('documentFlow allows prompt-only creation on empty document', creationPlan.canProceedOnEmptyDocument && creationPlan.scope.resolvedScope === 'prompt')

  const longDocPlan = documentFlow.planDocumentFlow('请总结全文', {
    hasDocument: true,
    documentCharCount: 50000,
    chunkCount: 8
  })
  assert('documentFlow routes long document to chunked flow', longDocPlan.useChunkedDocumentFlow)

  const assistantDraft = assistantFlow.prepareAssistantConfigDraft({
    name: '合同审查助手',
    systemPrompt: '你是合同审查助手',
    userPromptTemplate: '审查 {{input}}'
  })
  assert('assistantFlow prepares valid assistant draft', assistantDraft.ok && assistantDraft.config.id)

  const repair = assistantFlow.prepareAssistantRepair(
    { id: 'a1', name: '旧助手', systemPrompt: 'old', userPromptTemplate: '{{input}}' },
    { systemPrompt: 'new' }
  )
  assert('assistantFlow builds repair audit diff', repair.changed && repair.auditRecord.diff.summary.changedCount > 0)

  const outputPlan = generatedOutputFlow.planGeneratedOutputFlow('请基于当前文档生成审查报告')
  assert('generatedOutputFlow detects report artifact', outputPlan.isGeneratedOutput && outputPlan.kind === 'report')
  const artifact = generatedOutputFlow.buildGeneratedArtifact({ kind: 'report', title: '审查报告', content: '# ok' })
  assert('generatedOutputFlow builds artifact metadata', artifact.mimeType === 'text/markdown' && artifact.content === '# ok')

  const exactVerification = verifier.verifyExactStatsResult({ total: 2, unique: 2, duplicates: [] })
  assert('verifier accepts consistent stats', exactVerification.ok)
  const citationVerification = verifier.verifyExtractionCitations([
    { chunkId: 'c1', items: [{ title: '张三', evidence: '张三负责审查' }] }
  ], [
    { id: 'c1', text: '张三负责审查合同。' }
  ])
  assert('verifier validates extraction citations', citationVerification.ok)

  const jsonSchema = {
    type: 'object',
    required: ['items'],
    properties: { items: { type: 'array', items: { type: 'object' } } }
  }
  assert('jsonSchemaValidator rejects missing required field', !schema.validateJsonSchema({}, jsonSchema).ok)

  const extracted = await semantic.extractSemanticChunks([{ id: 'c1', index: 0, text: '张三负责审查' }], {
    schema: jsonSchema,
    extractor: async () => JSON.stringify({ items: [{ title: '张三', summary: '负责审查' }] })
  })
  assert('semanticExtractor completes valid chunk', extracted.ledger.chunks[0].status === 'completed')

  const synthesized = synth.synthesizeExtractionResults(extracted.results, {
    title: '抽取结果'
  })
  assert('synthesizer renders extracted item', synthesized.content.includes('张三'))

  await storage.saveDocumentIntelligenceEntry('smoke', 'item', { ok: true })
  const cached = await storage.loadDocumentIntelligenceEntry('smoke', 'item')
  assert('documentIntelligence storage roundtrips', cached?.ok === true)
  await storage.deleteDocumentIntelligenceEntry('smoke', 'item')

  await rag.indexDocumentForRetrieval('smoke-doc', 'Cursor 是 AI 编程工具', { maxChars: 30 })
  const hits = await rag.queryDocumentRetrieval('Cursor 编程', { topK: 1 })
  assert('ragStore queries indexed text', hits.length === 1 && hits[0].docId === 'smoke-doc')
  await rag.deleteDocumentRetrievalIndex('smoke-doc')

  toolRegistry.clearTools()
  toolAudit.clearToolAuditRecords()
  toolRegistry.registerTool({ key: 'smoke.write', riskLevel: 'high', handler: () => ({ ok: true }) })
  let blocked = false
  try {
    await toolPolicy.executeToolWithPolicy('smoke.write')
  } catch (error) {
    blocked = error.code === 'TOOL_CONFIRM_REQUIRED'
  }
  assert('tool policy blocks high risk without confirmation', blocked)
  const auditRecords = toolAudit.listToolAuditRecords({ toolKey: 'smoke.write' })
  assert('tool audit records blocked attempt', auditRecords.length === 1 && auditRecords[0].ok === false)

  const wf = workflow.validateWorkflowDefinition({
    nodes: [{ id: 'a', type: 'input' }, { id: 'b', type: 'tool' }],
    edges: [{ source: 'a', target: 'b' }]
  }, {
    registeredTools: ['smoke.write']
  })
  assert('workflow validator flags missing tool key', !wf.ok && wf.issues.some(item => item.code === 'missing-tool-key'))
  const wfOk = workflow.validateWorkflowDefinition({
    nodes: [{ id: 'a', type: 'input' }, { id: 'b', type: 'tool', data: { toolKey: 'smoke.write' } }],
    edges: [{ source: 'a', target: 'b' }]
  }, {
    registeredTools: ['smoke.write']
  })
  assert('workflow validator accepts registered tool DAG', wfOk.ok)
  const wfCycle = workflow.validateWorkflowDefinition({
    nodes: [{ id: 'a', type: 'task' }, { id: 'b', type: 'task' }],
    edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }]
  })
  assert('workflow validator detects cycles', wfCycle.issues.some(item => item.code === 'cycle-detected'))

  const diff = audit.diffAssistantConfig({ systemPrompt: 'old' }, { systemPrompt: 'new' })
  assert('assistant evolution audit detects prompt diff', diff.summary.changedFields.includes('systemPrompt'))

  const suite = evalSuite.buildEvaluationSuite()
  assert('evaluation suite includes default cases', suite.summary.total >= 4)
  await evolutionPersistence.saveEvaluationSuite(suite)
  const loadedSuite = await evolutionPersistence.loadEvaluationSuite(suite.id)
  assert('evolution persistence roundtrips evaluation suite', loadedSuite?.id === suite.id)
  await evolutionPersistence.deleteEvaluationSuite(suite.id)

  const policy = evolutionPolicy.buildEvolutionPolicy({ documentAction: 'replace' })
  assert('evolution policy raises write-back thresholds', policy.risk === 'document-write' && policy.minShadowComparisons >= 60)

  const range = virtualList.computeVirtualListRange({ total: 100, itemHeight: 20, viewportHeight: 100, scrollTop: 200 })
  assert('virtualList computes visible range', range.start <= 10 && range.end >= 15)

  const workerChunks = await chunkWorker.planChunksInWorker({
    text: '第一段。\n\n第二段。',
    chunkSettings: { maxChunkLength: 4, overlapLength: 0 }
  })
  assert('chunkPlanner worker fallback plans chunks', workerChunks.chunks.length > 0 && workerChunks.chunks[0].startOffset === 0)

  const metrics = textWorker.analyzeTextStats({ text: '统计成语数量：画蛇添足、亡羊补牢' })
  assert('textStatsWorker computes exact stats', metrics.exactStats?.stats?.total === 2)

  const fallback = await textClient.analyzeTextStatsInWorker({ text: 'hello 世界' })
  assert('textStatsClient falls back in node', fallback.metrics.words === 1 && fallback.metrics.cjkChars === 2)

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`)
    process.exit(1)
  }
  console.log('\nAll service smoke tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
