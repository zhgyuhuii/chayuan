/**
 * localDistiller — T4 本地 LLM 批量蒸馏检索短语
 *
 * v1 stub:
 *   - distillBatch(reps, mode, options) 接口先稳;实现暂用"代表段截断"兜底
 *   - Phase 3 接入真实本地 LLM 调用,走 services.host.chatCompletionWithShadow
 *
 * 蒸馏 prompt 强约束(详见 plan §3.2.5.6 #1):
 *   - 输出可直接喂搜索引擎的短语;不要写完整句子;不要泛化
 *   - 每簇 1–3 条;含关键实体/专有名词/条款号
 *   - JSON 输出,parse 失败 → 走 fallback
 */

const FALLBACK_TRUNCATE = 280

const PROMPTS = {
  qa: `你是一个检索短语生成器。下面是用户原文的若干段落,请为每段提取
1–3 个"短检索短语"(8–30 字),用于在企业知识库里召回可能回答用户问题的内容。
要求:
- 必须是检索短语,不是完整句子;
- 含具体实体/专有名词/条款号/术语;
- 不要泛化、不要解释。
输出严格 JSON: { "phrases": [ "...", ... ] }`,
  verify: `你是一个事实声明提取器。下面是待核对的原文段落,请提取 1–3 条
"可被知识库证实/证伪的事实声明",用作检索短语。
要求:
- 每条 8–30 字;
- 含可量化/可对比的具体内容(数字、条款号、定义);
- 不要主观判断。
输出严格 JSON: { "phrases": [ "...", ... ] }`,
  summarize: `你是一个补充检索词生成器。下面是待总结的原文段落,请输出
1–2 个"该段需要从知识库补充背景的查询词"。
要求:
- 每条 8–30 字;
- 应能召回背景资料/相关条款/历史数据;
输出严格 JSON: { "phrases": [ "...", ... ] }`
}

function _fallback(reps) {
  const text = reps.map(r => r?.text || '').join(' ').replace(/\s+/g, ' ').trim()
  return { phrases: [text.slice(0, FALLBACK_TRUNCATE)] }
}

/**
 * @param {Array<Array<{text:string}>>} repsPerCluster  每簇代表段(1–2 个)
 * @param {'qa'|'verify'|'summarize'} mode
 * @param {{ chatCompletion?: Function, signal?: AbortSignal, maxPhrasesPerCluster?: number }} options
 * @returns {Promise<Array<{phrases:string[]}>>}  长度 = clusters 数
 */
export async function distillBatch(repsPerCluster, mode = 'qa', options = {}) {
  const max = Math.max(1, Math.min(3, options.maxPhrasesPerCluster || 3))
  const chat = typeof options.chatCompletion === 'function' ? options.chatCompletion : null

  if (!chat) {
    // v1 兜底:不调 LLM,直接用代表段截断
    return repsPerCluster.map(_fallback)
  }

  // 把所有簇拼成一次 prompt(省 RTT);LLM 输出 JSON 数组,顺序对齐
  const prompt = `${PROMPTS[mode] || PROMPTS.qa}

已知 ${repsPerCluster.length} 个段落集合,请按顺序为每个集合产出 phrases 列表。
请输出严格 JSON 数组,长度=${repsPerCluster.length},每元素形如 { "phrases": [ "..." ] }(每簇最多 ${max} 条短语)。

段落集合:
${repsPerCluster.map((reps, i) =>
  `[${i}]\n${reps.map(r => r?.text || '').join('\n---\n').slice(0, 1200)}`
).join('\n\n')}
`

  let raw = ''
  try {
    raw = await chat({ prompt, mode: 'json', signal: options.signal })
  } catch (e) {
    return repsPerCluster.map(_fallback)
  }

  let parsed
  try {
    // 容忍 LLM 在 JSON 外加废话:抓第一个 [ ... ]
    const m = raw.match(/\[[\s\S]*\]/)
    parsed = JSON.parse(m ? m[0] : raw)
  } catch (e) {
    return repsPerCluster.map(_fallback)
  }

  if (!Array.isArray(parsed) || parsed.length !== repsPerCluster.length) {
    return repsPerCluster.map(_fallback)
  }

  return parsed.map((item, i) => {
    const phrases = Array.isArray(item?.phrases) ? item.phrases : []
    const cleaned = phrases
      .map(p => String(p || '').trim())
      .filter(p => p.length >= 4 && p.length <= 80)
      .slice(0, max)
    if (cleaned.length === 0) return _fallback(repsPerCluster[i])
    return { phrases: cleaned }
  })
}

export default { distillBatch }
