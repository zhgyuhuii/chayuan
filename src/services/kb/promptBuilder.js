/**
 * promptBuilder — 三种 mode 的 LLM prompt(详见 plan §3.2.8)
 *
 * 关键约束:
 *   1. 必须在每个事实结尾用 [^cN] 标注来源,N 与 sources[i].id 对应
 *   2. 不许编造来源 id;允许"知识库未覆盖"
 *   3. 答案中不允许出现 URL / 文件路径(下载链接由 UI 拼)
 *
 * 输入:
 *   - mode: 'qa' | 'verify' | 'summarize'
 *   - sources: 经 credibilityScorer 排序裁剪后的 chunks(已带 trust/stars)
 *   - userQuery / selectionText: 视 mode 而定
 *
 * 输出:
 *   - { systemPrompt, userPrompt, citationMap }
 *   - citationMap: id → chunk 引用,UI 渲染 [^cN] 占位时回查
 */

const HARD_BUDGET_CHARS = 8000  // chunks 拼起来的硬上限,详见 plan §5.1

function _truncateChunks(sources) {
  let total = 0
  const kept = []
  for (const s of sources) {
    const t = String(s.text || '').slice(0, 600)
    if (total + t.length > HARD_BUDGET_CHARS) break
    total += t.length
    kept.push({ ...s, text: t })
  }
  return kept
}

function _renderSources(sources) {
  return sources.map((s, i) => {
    const cid = `c${i + 1}`
    const meta = []
    if (s.kb_name) meta.push(`kb=${s.kb_name}`)
    if (s.file_name) meta.push(`file=${s.file_name}`)
    if (s.metadata?.section_path) {
      const path = Array.isArray(s.metadata.section_path) ? s.metadata.section_path.join('/') : s.metadata.section_path
      if (path) meta.push(`sec=${path}`)
    }
    if (typeof s.trust === 'number') meta.push(`trust=${s.trust.toFixed(2)}`)
    return `[${cid}] (${meta.join(', ')})\n${s.text}`
  }).join('\n\n')
}

function _buildCitationMap(sources) {
  const map = {}
  sources.forEach((s, i) => {
    map[`c${i + 1}`] = s
  })
  return map
}

const QA_SYSTEM = `你是基于知识库的助手。下面是检索到的若干"知识片段",
请只用这些片段回答问题;遇到不足以回答的部分,请明确说"知识库未覆盖"。
回答时,**必须在每个事实结尾用 [^cN] 标注来源**(N 与片段 id 对应);
不要编造来源 id,不要在答案里写出文件路径或 URL。
若你引用了某条片段,引用位置必须紧贴对应事实之后,不要堆在末尾。`

const VERIFY_SYSTEM = `你是核对助手。任务:核对下面"待核对原文"是否与"知识库片段"一致。
对每一句逐条给出:
- 一致(✓) / 不一致(✗) / 未覆盖(?)
- 不一致时,引用 [^cN] 给出依据并写出"应为 …"
- 末尾给整体一致率(%)。
不要编造来源 id;不要在答案里写出文件路径或 URL。`

const SUMMARIZE_SYSTEM = `你是总结助手。请把以下知识片段整理为一篇结构清晰的中文总结:
- 用 ## / ### 章节
- 每个事实后用 [^cN] 标注来源
- 末尾给"参考清单"段落,列出全部使用过的 [cN]
- 不要凭空补充未在片段中出现的信息;不要在答案里写出文件路径或 URL。`

export function build({ mode = 'qa', sources = [], userQuery = '', selectionText = '' } = {}) {
  const trimmed = _truncateChunks(sources)
  const sourcesBlock = _renderSources(trimmed)
  const citationMap = _buildCitationMap(trimmed)

  let systemPrompt
  let userPrompt
  switch (mode) {
    case 'verify':
      systemPrompt = VERIFY_SYSTEM
      userPrompt = `【待核对原文】\n${selectionText || userQuery}\n\n【知识库片段】\n${sourcesBlock}`
      break
    case 'summarize':
      systemPrompt = SUMMARIZE_SYSTEM
      userPrompt = `【片段】\n${sourcesBlock}`
      break
    case 'qa':
    default:
      systemPrompt = QA_SYSTEM
      userPrompt = `【片段】\n${sourcesBlock}\n\n【问题】\n${userQuery}`
      break
  }

  return { systemPrompt, userPrompt, citationMap, kept: trimmed.length, droppedByBudget: sources.length - trimmed.length }
}

/** 检测答案中实际出现的引用 id,用于"未引用句"灰显告警 */
export function extractCitations(text) {
  const re = /\[\^?c(\d+)\]/g
  const found = new Set()
  let m
  while ((m = re.exec(String(text || ''))) !== null) {
    found.add(`c${m[1]}`)
  }
  return [...found]
}

export default { build, extractCitations }
