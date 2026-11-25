/**
 * 助手 agent 回合执行器回归锁定（A-2）：
 * 双轨分流 / FC 自动降级 / 写回契约兜底（补写必须走 callLocalTool 派发通道）/ fallback 透传
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const orchestratorMock = vi.fn()
const callLocalToolMock = vi.fn()
const chatCompletionMock = vi.fn()
let streamMockImpl = null

vi.mock('../mcpBridge/mcpChatOrchestrator.js', () => ({
  runMcpChatOrchestrator: (...a) => orchestratorMock(...a)
}))
vi.mock('../mcpBridge/mcpHttpClient.js', () => ({
  callLocalTool: (...a) => callLocalToolMock(...a)
}))
vi.mock('../../utils/chatApi.js', () => ({
  chatCompletion: (...a) => chatCompletionMock(...a),
  // direct 轨已改流式：mock 以 onEvent 推增量（reasoning+content）后 onDone
  streamChatCompletion: (opts) => {
    if (streamMockImpl) { streamMockImpl(opts); return { cancel() {} } }
    opts.onDone()
    return { cancel() {} }
  }
}))

const { runAssistantAgentExecution } = await import('./assistantAgentTurn.js')
const { markModelFcUnsupported, resetModelFcMemory } = await import('../../utils/assistantAgentDispatch.js')

const BASE = {
  assistantId: 'analysis.expand',
  label: '扩写',
  systemPrompt: '你是一位擅长扩展文本细节的写作助手。',
  userPromptTemplate: '扩写：{{input}}',
  inputText: '短正文',
  inputSource: 'selection',
  hasSelection: true,
  inputLength: 3,
  effectiveDocumentAction: 'insert',
  // 统一管线（2026-11-21）下 insert+选区+内联默认直出；本夹具驱动【agent 轨语义】
  //（FC 降级/续跑/轮次等机制用例），显式钉在 agent 轨
  forcePipeline: 'agent',
  model: { providerId: 'ZHIPU', modelId: 'glm-4.6' },
  writeBaselineToken: 'tok-1',
  events: {}
}

beforeEach(() => {
  orchestratorMock.mockReset()
  callLocalToolMock.mockReset()
  chatCompletionMock.mockReset()
  streamMockImpl = null
  resetModelFcMemory()
})

describe('agent 轨', () => {
  it('ok 且预期写工具已执行 → 不补写', async () => {
    orchestratorMock.mockResolvedValueOnce({
      ok: true, content: '扩写结果', executedTools: ['document_meta', 'document_insert'], steps: [], todos: []
    })
    const r = await runAssistantAgentExecution(BASE)
    expect(r.ok).toBe(true)
    expect(r.lane).toBe('agent')
    expect(r.wroteBack).toBe(true)
    expect(callLocalToolMock).not.toHaveBeenCalled()
    // persona 注入点（P0-1）：systemPrompt 经 personaSystemPrompt 进 orchestrator
    expect(orchestratorMock.mock.calls[0][0].personaSystemPrompt).toBe(BASE.systemPrompt)
    // instruction 含内联原文与写工具契约
    expect(orchestratorMock.mock.calls[0][0].userText).toContain('chayuan__document_insert')
    expect(orchestratorMock.mock.calls[0][0].userText).toContain('短正文')
  })

  it('ok 但预期写工具未执行 → callLocalTool 兜底补写（走派发通道）', async () => {
    orchestratorMock.mockResolvedValueOnce({
      ok: true, content: '扩写结果（只输出没写回）', executedTools: ['document_meta'], steps: [], todos: []
    })
    callLocalToolMock.mockResolvedValueOnce({ ok: true })
    const r = await runAssistantAgentExecution(BASE)
    expect(r.wroteBack).toBe(true)
    expect(callLocalToolMock).toHaveBeenCalledTimes(1)
    const [name, args] = callLocalToolMock.mock.calls[0]
    expect(name).toBe('document_insert')
    expect(args.position).toBe('after')
    expect(args.originalText).toBe('短正文')
    expect(args.text).toContain('扩写结果')
    expect(args.confirmed).toBe(true)
  })

  it('toolsUnsupported → 标记 FC + 自动降 direct 重跑一次', async () => {
    orchestratorMock.mockResolvedValueOnce({
      ok: false, fallback: true, reason: 'model_error', toolsUnsupported: true,
      content: '当前模型不支持工具调用', steps: []
    })
    streamMockImpl = (opts) => {
      opts.onEvent({ choices: [{ delta: { reasoning_content: '思考：先读要求' } }] })
      opts.onEvent({ choices: [{ delta: { content: '直调生成结果' } }] })
      opts.onDone()
    }
    callLocalToolMock.mockResolvedValueOnce({ ok: true })
    const r = await runAssistantAgentExecution(BASE)
    expect(r.lane).toBe('direct')
    expect(r.degraded).toBe(true)
    expect(r.ok).toBe(true)
    // 直出 lane = 写前快照（document.get_text）+ 写回（document_insert）两次调用：
    // 按写回动作计数（快照失败会被静默吞掉，不该计入写回判定）
    expect(callLocalToolMock.mock.calls.filter(c => c[0] === 'document_insert')).toHaveLength(1)
    // 记忆落盘：同模型下次直接 direct（不再撞 agent）
    const r2 = await runAssistantAgentExecution(BASE)
    expect(r2.lane).toBe('direct')
    expect(orchestratorMock).toHaveBeenCalledTimes(1)
  })

  it('基础设施 fallback（sidecar_offline）→ handled:false 交调用方回落', async () => {
    orchestratorMock.mockResolvedValueOnce({ ok: false, fallback: true, reason: 'sidecar_offline', steps: [] })
    const r = await runAssistantAgentExecution(BASE)
    expect(r.handled).toBe(false)
    expect(r.fallbackReason).toBe('sidecar_offline')
    expect(callLocalToolMock).not.toHaveBeenCalled()
  })

  it('none 动作：不检测写回、不补写', async () => {
    orchestratorMock.mockResolvedValueOnce({ ok: true, content: '答案', executedTools: [], steps: [] })
    const r = await runAssistantAgentExecution({ ...BASE, effectiveDocumentAction: 'none' })
    expect(r.wroteBack).toBe(false)
    expect(callLocalToolMock).not.toHaveBeenCalled()
  })
})

describe('direct 轨（FC 弱模型）', () => {
  it('预标记 FC 不支持 → chatCompletion 直调 + 指令式写回', async () => {
    markModelFcUnsupported('ZHIPU', 'glm-4.6')
    let chatMessages = null
    streamMockImpl = (opts) => {
      chatMessages = opts.messages
      opts.onEvent({ choices: [{ delta: { content: '直调生成正文' } }] })
      opts.onDone()
    }
    callLocalToolMock.mockResolvedValueOnce({ ok: true })
    const r = await runAssistantAgentExecution(BASE)
    expect(r.lane).toBe('direct')
    expect(r.ok).toBe(true)
    expect(r.wroteBack).toBe(true)
    expect(orchestratorMock).not.toHaveBeenCalled()
    // direct 消息含人格前缀与任务指令
    const msgs = chatMessages
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toContain('写作助手')
    expect(msgs[1].content).toContain('chayuan__document_insert')
  })

  it('超长变换分块直出（>8000）：逐块调用 + 无损重组 + 一次写回', async () => {
    const para = '原文段落内容测试用。'
    const inputText = Array.from({ length: 900 }, (_, i) => para + i).join('\n')
    let call = 0
    streamMockImpl = (opts) => {
      call += 1
      opts.onEvent({ choices: [{ delta: { content: `[译块${call}]` } }] })
      opts.onDone()
    }
    // 首次 callLocalTool = 写前快照（document.get_text）——必须在运行前设定
    callLocalToolMock.mockResolvedValueOnce({ structuredContent: { text: '写前全文快照' } })
    const r = await runAssistantAgentExecution({
      ...BASE,
      forcePipeline: undefined,
      inputText,
      inputLength: inputText.length,
      effectiveDocumentAction: 'replace',
      selectionRange: { start: 10, end: 14000 },
      expectDocId: '/tmp/doc.docx'
    })
    expect(r.ok).toBe(true)
    expect(call).toBeGreaterThanOrEqual(3)
    expect(r.content).toContain('[译块1]')
    expect(r.content).toContain(`[译块${call}]`)
    const writeCall = callLocalToolMock.mock.calls.find(c => c[0] === 'document_replace')
    expect(writeCall).toBeTruthy()
    expect(writeCall[1].paragraphWise).toBe(true)
    expect(writeCall[1].__expectedDocId).toBe('/tmp/doc.docx')
    expect(r.snapshot?.docId).toBe('/tmp/doc.docx')
  })

  it('思考模式开启 → 不注入 thinking disabled + reasoning 增量透传到思考卡', async () => {
    const reasoningDeltas = []
    let sawThinkingDisabled = false
    streamMockImpl = (opts) => {
      if (opts.thinking && opts.thinking.type === 'disabled') sawThinkingDisabled = true
      opts.onEvent({ choices: [{ delta: { reasoning_content: '先理解原文…' } }] })
      opts.onEvent({ choices: [{ delta: { reasoning_content: '再组织译文。' } }] })
      opts.onEvent({ choices: [{ delta: { content: '译文结果' } }] })
      opts.onDone()
    }
    callLocalToolMock.mockResolvedValueOnce({ structuredContent: { text: '写前快照' } })
    const r = await runAssistantAgentExecution({
      ...BASE,
      forcePipeline: undefined,
      effectiveDocumentAction: 'replace',
      selectionRange: { start: 1, end: 20 },
      thinkingEnabled: true,
      events: { onTurnReasoning: (delta) => reasoningDeltas.push(delta) }
    })
    expect(sawThinkingDisabled).toBe(false)
    expect(reasoningDeltas.join('')).toContain('先理解原文')
    expect(r.content).toBe('译文结果')
  })

  it('直调写回失败 → ok 保留 content + writeBackError（结果在消息里可见）', async () => {
    markModelFcUnsupported('ZHIPU', 'glm-4.6')
    streamMockImpl = (opts) => {
      opts.onEvent({ choices: [{ delta: { content: '结果' } }] })
      opts.onDone()
    }
    // 直出 lane 先做写前快照（失败静默吞掉），再写回——两次调用按序注入失败
    callLocalToolMock.mockRejectedValueOnce(new Error('snapshot unavailable'))
    callLocalToolMock.mockRejectedValueOnce(new Error('LOCATE_MISMATCH'))
    const r = await runAssistantAgentExecution(BASE)
    expect(r.ok).toBe(true)
    expect(r.wroteBack).toBe(false)
    expect(String(r.writeBackError?.message)).toContain('LOCATE_MISMATCH')
    expect(r.content).toBe('结果')
  })
})
