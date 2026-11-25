/**
 * 助手定义 → agent instruction 编译器（助手 agent 化 A-1）
 *
 * 把助手定义（label / userPromptTemplate / documentAction / inputSource）编译成
 * AgentLoop 驱动指令 + 预期写工具契约（expectedWriteTool），供：
 *  - 面板 agent 回合（runAssistantAgentTurn）
 *  - ribbon headless / 工作流 programmatic（runAssistantHeadless）
 *
 * 写回契约（三审 P0-1 修正后）：instruction 里硬性指名写工具；orchestrator 返回后
 * 由调用方检测 expectedWriteTool 是否出现在 executed tool steps 中，未执行则经
 * sidecar 派发通道（callLocalTool）确定性补写——本模块只产出契约，不执行写回。
 *
 * 已知限制（有意为之，不破坏 vendor 纪律）：内联正文会经 loop 的 sanitizeAgentPayload
 * 脱敏改写（含 sk-/password 等 credential 模式的正文被改写后才进模型）。不改 agent-core，
 * 对扩写/改写类任务属边缘 case；如未来需要精确保真，应在调用方预处理而非改 vendor。
 */

/** 内联阈值：超过则不内联，指令让 agent 用 document_chunks 自读（控制首轮 prompt 尺寸） */
export const INLINE_INPUT_LIMIT = 8000

/**
 * documentAction → 写工具契约。
 * 工具名必须与 sidecar 工具目录（mcp-sidecar/lib/toolCatalog.mjs）实际暴露名一致
 * （MCP 前缀 chayuan__ 由 agentCoreSkill 的 namespace 约定）。
 */
const ACTION_TOOL_MAP = {
  insert: { tool: 'chayuan__document_insert', desc: '用 document_insert 锚点定位插入（有选区插到选区之后，无选区追加到文末）' },
  'insert-after': { tool: 'chayuan__document_insert', desc: '用 document_insert 插到指定锚点之后' },
  append: { tool: 'chayuan__document_insert', desc: '用 document_insert(position=append) 追加到文档末尾' },
  prepend: { tool: 'chayuan__document_insert', desc: '用 document_insert(position=prepend) 插入到文档最前' },
  replace: { tool: 'chayuan__document_replace', desc: '用 document_replace 替换选区/全文（originalText 必须先经 document_locate 或读取确认存在；写新内容严禁用 replace）' },
  'comment-replace': { tool: 'chayuan__document_apply_ops', desc: '用 document_apply_ops(action="replace") 单次批量定位替换（每 op originalText→outputText，≤200 条）' },
  comment: { tool: 'chayuan__proofread_apply_comments', desc: '以批注形式落盘（proofread_apply_comments）' },
  none: { tool: null, desc: '不写回文档：结果直接作为回答输出，不调用任何写工具' }
}

/**
 * 从模型回答中提取【OUTPUT】标记间的正文（direct 轨输出纯度保障）：
 * 模型复读原文/加前导/包代码块时，标记提取剥离这些噪音；未守约时原样返回。
 */
export function extractOutputBody(reply) {
  const text = String(reply || '')
  const m = text.match(/【\s*OUTPUT\s*】([\s\S]*?)(?:【\s*\/\s*OUTPUT\s*】|$)/)
  let body = m ? m[1].trim() : text.trim()
  // 模型自创 XML 包裹剥离（真机 2026-11-21：润色输出 <body_default>正文</body_default>
  // 被原样写进文档——LLM 对「写正文」任务的伪结构标签习惯）。已知噪音标签 +
  // 通用单层包裹兜底；剥到无匹配为止（防多层嵌套）。
  const noiseTagRe = /^<\s*([a-zA-Z][\w_-]{2,24})\s*>([\s\S]*?)<\s*\/\s*\1\s*>\s*$/
  let prev = ''
  let guard = 0
  while (body !== prev && guard < 5) {
    prev = body
    const mm = body.match(noiseTagRe)
    if (mm) body = mm[2].trim()
    guard++
  }
  return body
}

/** 渲染 userPromptTemplate：{{input}}（及常见别名）与附加变量占位替换。未匹配占位原样保留。 */
export function renderPromptTemplate(template, inputText, variables = {}) {
  const t = String(template || '{{input}}')
  const input = String(inputText ?? '')
  let out = t
    .replace(/\{\{\s*input\s*\}\}/g, input)
    .replace(/\{\{\s*(?:inputText|userInput)\s*\}\}/g, input)
  for (const [k, v] of Object.entries(variables || {})) {
    if (!k) continue
    out = out.replace(new RegExp(`\\{\\{\\s*${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*\\}\\}`, 'g'), String(v ?? ''))
  }
  return out
}

/**
 * 编译助手 agent 驱动指令。
 * @param {object} opts
 * @param {string} [opts.label] 助手显示名（指令里引用）
 * @param {string} [opts.userPromptTemplate] 助手提示词模板（{{input}} 占位）
 * @param {string} [opts.inputText] 已解析的任务输入（选区文本/全文提取/用户输入）
 * @param {string} [opts.inputSource] 'selection' | 'document' | 'none'
 * @param {boolean} [opts.hasSelection]
 * @param {number} [opts.inputLength] 输入字数（与 inputText 分离：全文场景 inputText 可能为空）
 * @param {string} [opts.effectiveDocumentAction] insert/append/replace/.../none
 * @param {string} [opts.host] 'wps' | 'et' | 'wpp'（落点名词与工具域随宿主变化）
 * @param {object} [opts.variables] 附加模板变量（{{targetLanguage}}/{{kbContext}} 等）
 * @returns {{ instruction: string, expectedWriteTools: string[], expectWrite: boolean }}
 */
export function buildAssistantAgentInstruction({
  label = '',
  userPromptTemplate = '{{input}}',
  inputText = '',
  inputSource = 'document',
  hasSelection = false,
  inputLength = 0,
  effectiveDocumentAction = 'insert',
  host = 'wps',
  lane = 'agent',
  variables = {}
} = {}) {
  const action = String(effectiveDocumentAction || 'insert')
  const contract = ACTION_TOOL_MAP[action] || ACTION_TOOL_MAP.insert
  const expectWrite = !!contract.tool
  // 写工具族等价（三审 P0-3）：orchestrator 系统纪律允许 document_apply_ops 的
  // insert/insert_after 写新内容——只匹配单一工具名会把合法落稿判成「未写回」
  // 触发重复写入。按「写效果等价族」判定。
  const expectedWriteTools = contract.tool === 'chayuan__document_insert'
    ? ['document_insert', 'document_apply_ops']
    : contract.tool === 'chayuan__document_replace'
      ? ['document_replace', 'document_apply_ops']
      : contract.tool === 'chayuan__proofread_apply_comments'
        ? ['proofread_apply_comments', 'comment']
        : contract.tool
          ? [contract.tool.replace('chayuan__', '')]
          : []
  const targetNoun = host === 'et' ? '工作簿' : host === 'wpp' ? '演示文稿' : '文档'

  const lines = []
  lines.push(`请以「${label || '助手'}」身份完成以下任务。`)
  lines.push('')

  // 输入注入：短文本内联；超阈值让 agent 自读（控制首轮 prompt 尺寸）
  const inlineable = typeof inputText === 'string' && inputText.length > 0 && inputText.length <= INLINE_INPUT_LIMIT
  if (inlineable) {
    lines.push('【任务输入】以下是本次任务要处理的原文/要求（直接使用，无需再读文档）：')
    lines.push(`<input>\n${inputText}\n</input>`)
  } else if (inputSource === 'document' || inputLength > INLINE_INPUT_LIMIT) {
    const scopeHint = hasSelection ? '用户指定了选区，只处理选区内容' : '处理文档全文'
    lines.push(`【任务输入】本次${scopeHint}，原文较长（约 ${inputLength || '?'} 字）未内联。`)
    lines.push(host === 'wps'
      ? '先用 document_meta 了解篇幅，再按需 document_chunks（limit:8，cursor 只前进）读取必要部分，读完立即开写，把轮次留给写工具。'
      : host === 'et'
        ? '先用 spreadsheet(action=used_range|range_read) 了解数据范围，读到必要内容立即开写。'
        : '先用 presentation(action=slide_list|slide_read) 了解内容，读到必要部分立即开写。')
  } else if (inputText) {
    lines.push('【任务输入】直接处理以下要求：')
    lines.push(`<input>\n${inputText}\n</input>`)
  }

  // 任务语义：助手提示词模板渲染。非内联场景模板不注入全文（三审 P0-1：模板渲染
  // 不得击穿内联阈值分流——全文由 agent 自读），variables 提供附加占位。
  const rendered = renderPromptTemplate(userPromptTemplate, inlineable ? '' : '', variables)
  if (rendered && rendered.trim() && !/^\{\{\s*\w+\s*\}\}$/.test(rendered.trim())) {
    lines.push('【任务要求】')
    lines.push(rendered.trim())
  }

  // 写回契约段：强约束 + 预期工具
  lines.push('')
  if (expectWrite) {
    lines.push(`【写回契约】任务完成后，${contract.desc}。`)
    lines.push(`必须调用 ${contract.tool} 落盘——只输出文本不调用写工具视为未完成。`)
    lines.push('【输出格式契约】你的最终回答必须严格遵守：第一行只写标记【OUTPUT】，随后是最终写入文档的完整正文（不要任何前导语、解释、原文复述或 markdown 代码块），最后一行只写【/OUTPUT】。标记之外禁止出现正文内容；正文禁止用任何 XML/HTML 标签（如 <body>、<answer>）包裹——正文就是纯文本。')
    if (lane === 'agent') {
      lines.push('【任务清单】开始前用 todo_write 列出任务清单（与第一个真实工具调用同轮并行提交），此后每推进一项同步更新状态——用户在信息面板跟踪进度。')
    }
    lines.push('【任务清单】本任务是「读/生成 + 写回」多步任务：开始前先用 todo_write 列出任务清单（如：读取目标内容 → 生成结果 → 写入文档），todo_write 与第一个真实工具调用同轮并行提交，此后每推进一项同步更新状态——用户在信息面板的任务列表里跟踪进度。')
    if (host === 'wps' && (action === 'insert' || action === 'append' || action === 'prepend' || action === 'insert-after')) {
      lines.push('写新内容严禁用 document_replace（原文件不存在会 LOCATE_NOT_FOUND 全部失败）。')
    }
    lines.push(`完成写回后，用一句话汇报落点（写入了什么、写到哪里），不要再贴一遍全文。`)
    lines.push('【写回内容红线】只允许把任务产出的正文写入文档。写回失败/无法完成时，绝对禁止把失败说明、道歉、解释或「请手动打开文档」之类的提示文字写入文档——那些只放在回答文本里。')
  } else {
    lines.push(`【交付方式】${contract.desc}。`)
  }

  return {
    instruction: lines.filter(l => l !== '').join('\n'),
    expectedWriteTools,
    expectWrite
  }
}
