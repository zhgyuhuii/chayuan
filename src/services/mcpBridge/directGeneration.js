/**
 * 直出车道共享核心（2026-11-25 审计 F7/F8 治理）：
 * 「写一篇…」类生成意图不走 agent 循环——一次【无工具流式请求】产出全文（实时流给
 * 用户；文档大小的内容走 tool arguments 会在网关侧静默缓冲到 JSON 完整，长文必撞
 * 空闲超时——genoffice doc-writer.ts 头注释实证），流完一次写入落盘。
 *
 * 此前这条车道只存在于远程 chat_turn（chatTurnRunner），面板本地 fallback 路径
 * 没有——同一个「写一篇…」两条体验分裂；且直出分支不消费附加技能（静默丢弃）。
 * 现在抽成共享模块：远程 chatTurnRunner 与面板本地回合走同一条实现，门控一致
 * （生成意图 + 无选区 + 无 KB + 无附件 + 无技能，带技能必须落 agent 轨兑现技能）。
 */
import { streamChatCompletion } from '../../utils/chatApi.js'
import { shouldDisableThinking } from '../../utils/assistantAgentDispatch.js'

export const GEN_INTENT_RE = /(写一篇|写一份|写个|帮我写|生成一篇|生成一份|起草|撰写)/
export const EDIT_INTENT_RE = /(修改|替换|校对|润色|改写|定位|查找|删除|批注|插入到|移到)/

export function isGenerationIntent(text) {
  const t = String(text || '').trim()
  if (!t || t.length > 600) return false
  if (EDIT_INTENT_RE.test(t)) return false
  return GEN_INTENT_RE.test(t)
}

const DIRECT_SYSTEM_PROMPT = [
  '你是文档写作助手。直接输出【文档正文】的 Markdown，规则：',
  '1. 结构：第一行 # 文档主标题；随后一行副题/日期；正文用 ## 二级标题分节（章节标题必须用 ## 语法——绝不用 - 列表冒充章节）；结语收束。',
  '2. 【最高优先级·源码级排版铁律】每个段落必须输出为连续的一整行——绝对禁止在句子中间手动换行断句；换行只允许出现在：标题行之后、列表行之后、段落之间的空行。',
  '3. 不要输出「目录」章节或目录列表——系统会在写入后自动插入可刷新的真实目录域，你写了反而会重复。',
  '4. 严格按用户要求的字数与结构执行；排版用 Markdown 语法表达（## 标题 / **加粗** / - 列表 / | 表格 |），落盘时自动转真实文档格式。',
  '5. 只输出正文本身——不要解释、不要代码围栏、不要「好的我来写」之类的对话语。',
  '6. 不要调用任何工具（你没有工具）——正文就是全部输出。'
].join('\n')

/**
 * 直出生成：一次无工具流式请求产出全文。
 * @param {object} opts
 * @param {string} opts.userText
 * @param {Array<{role:string, text?:string, content?:string}>} [opts.historyMessages] 连续性种子（内部取最近 6 条）
 * @param {{providerId?, modelId?, id?, name?}} opts.model
 * @param {AbortSignal} [opts.signal]
 * @param {boolean} [opts.thinkingEnabled]
 * @param {(accText: string) => void} [opts.onText] 全量累计文本（调用方自行节流渲染）
 * @param {(delta: string) => void} [opts.onReasoning] 思考增量
 * @returns {Promise<{content: string}>} 去代码围栏后的正文；空响应/流失败 reject
 */
export async function generateDirectContent({ userText, historyMessages = [], model, signal, thinkingEnabled = false, onText, onReasoning } = {}) {
  const history = Array.isArray(historyMessages) ? historyMessages.slice(-6) : []
  const messages = [
    { role: 'system', content: DIRECT_SYSTEM_PROMPT },
    ...history.map(m => ({ role: m?.role === 'user' ? 'user' : 'assistant', content: String(m?.text || m?.content || '') })),
    { role: 'user', content: String(userText || '') }
  ]
  let acc = ''
  return await new Promise((resolve, reject) => {
    streamChatCompletion({
      providerId: model?.providerId,
      modelId: model?.modelId,
      messages,
      // 思考开关随调用方（面板 🧠 / chat_turn 参数）下发：关闭时智谱 GLM 系禁思考
      ...(shouldDisableThinking(model?.providerId, model?.apiUrl, thinkingEnabled) ? { thinking: { type: 'disabled' } } : {}),
      signal,
      onEvent: (obj) => {
        const delta = obj?.choices?.[0]?.delta
        if (!delta) return
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
          onReasoning?.(delta.reasoning_content)
        }
        if (typeof delta.content === 'string' && delta.content) {
          acc += delta.content
          onText?.(acc)
        }
      },
      onDone: () => {
        const content = String(acc || '').trim().replace(/^```(?:markdown)?\s*\n?|\n?```\s*$/g, '').trim()
        if (!content) reject(new Error('直出生成未返回内容（模型空响应）'))
        else resolve({ content })
      },
      onError: (m2) => reject(new Error(m2 || '流式请求失败'))
    })
  })
}
