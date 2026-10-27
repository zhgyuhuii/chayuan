/**
 * modelContextCatalog — 模型上下文窗口（contextWindow）推断与预算换算。
 *
 * 背景：模型配置（modelSeries）此前只有 {id,name,type}，全链路预算全是写死的
 * 字符数（spellCheckService.js 注释自认「无法按模型自动取值」）。本模块补齐：
 *   1) inferContextWindow(modelId)：按 id 正则推断常见模型的上下文窗口（tokens）
 *   2) getContextWindow(model)：显式字段 > 推断表 > 保守 8192
 *   3) getToolResultBudgetTokens(model)：工具结果预算 = min(contextWindow×0.25, 32000)
 *      ——工具结果只配占上下文 1/4（其余留给 system/历史/输出），上限防大模型
 *      一次灌满（成本 + 注意力稀释）。
 *
 * 推断值是公开标称值；未命中一律保守 8192（宁小勿大，超限比浪费危险）。
 */

const CONSERVATIVE_DEFAULT = 8192
const TOOL_BUDGET_RATIO = 0.25
const TOOL_BUDGET_MAX = 32000
const TOOL_BUDGET_MIN = 500

/** 按 id 从特殊到一般匹配；单位 tokens */
const INFERENCE_RULES = [
  // 超长上下文特化版
  { re: /qwen.{0,8}(2|3)?.{0,6}1m|qwen.{0,10}1000k/i, tokens: 1_000_000 },
  { re: /gemini.{0,10}pro|gemini-2|gemini-1\.5/i, tokens: 1_000_000 },
  { re: /gpt-4\.1|gpt-4o|chatgpt-4o|o1|o3|o4/i, tokens: 128_000 },
  { re: /claude.{0,8}(sonnet|opus|haiku)|claude-3|claude-4/i, tokens: 200_000 },
  // DeepSeek：V3/R1 64k，特化 long 128k
  { re: /deepseek.{0,6}(long|128k)/i, tokens: 128_000 },
  { re: /deepseek/i, tokens: 64_000 },
  // 通义千问：turbo/plus 128k，旧 32k
  { re: /qwen.{0,8}max|qwen3|qwen2\.5|qwen-plus|qwen-turbo|qwen3-/i, tokens: 128_000 },
  { re: /qwen/i, tokens: 32_000 },
  // 智谱 GLM：4/4.5/5 系 128k
  { re: /glm-4|glm-4\.5|glm-5/i, tokens: 128_000 },
  { re: /glm/i, tokens: 32_000 },
  // 月之暗面：128k（旧 8k 已退场）
  { re: /moonshot|kimi|k2/i, tokens: 128_000 },
  { re: /doubao|seed-/i, tokens: 128_000 },
  { re: /ernie|文心/i, tokens: 32_000 },
  { re: /hunyuan/i, tokens: 32_000 },
  { re: /minimax|abab/i, tokens: 128_000 },
  { re: /yi-/i, tokens: 32_000 },
  { re: /llama-?3.{0,6}1m/i, tokens: 1_000_000 },
  { re: /llama/i, tokens: 8_000 },
  { re: /mistral|mixtral/i, tokens: 32_000 },
  { re: /gemini.{0,8}flash/i, tokens: 1_000_000 },
  { re: /grok/i, tokens: 128_000 },
  { re: /gpt-3\.5|gpt-35/i, tokens: 16_000 },
  // 本地推理（ollama/vllm 常见 7B-14B 默认配置）：保守 8k
  { re: /llama3\.\d|qwen2?(?!\.)\d?b|7b|8b|13b|14b/i, tokens: 8_000 }
]

/**
 * 按模型 id 推断上下文窗口（tokens）；未命中返回保守 8192
 * @param {string} modelId
 * @returns {number}
 */
export function inferContextWindow(modelId) {
  const id = String(modelId || '')
  if (!id) return CONSERVATIVE_DEFAULT
  for (const rule of INFERENCE_RULES) {
    if (rule.re.test(id)) return rule.tokens
  }
  return CONSERVATIVE_DEFAULT
}

/**
 * 取模型有效上下文窗口：显式 contextWindow 字段 > 推断 > 保守默认
 * @param {{ modelId?: string, id?: string, contextWindow?: number }} model
 * @returns {number}
 */
export function getContextWindow(model) {
  const explicit = Number(model?.contextWindow)
  if (Number.isFinite(explicit) && explicit >= 1000) return Math.floor(explicit)
  return inferContextWindow(model?.modelId || model?.id)
}

/**
 * 工具结果 token 预算（file_parse 等注入型工具的默认 budgetTokens）
 * @param {{ modelId?: string, id?: string, contextWindow?: number }} model
 * @returns {number}
 */
export function getToolResultBudgetTokens(model) {
  const cw = getContextWindow(model)
  return Math.min(Math.max(Math.floor(cw * TOOL_BUDGET_RATIO), TOOL_BUDGET_MIN), TOOL_BUDGET_MAX)
}

export const MODEL_CONTEXT_DEFAULTS = { CONSERVATIVE_DEFAULT, TOOL_BUDGET_RATIO, TOOL_BUDGET_MAX }
export default { inferContextWindow, getContextWindow, getToolResultBudgetTokens }
