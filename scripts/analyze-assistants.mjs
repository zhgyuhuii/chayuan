#!/usr/bin/env node
/**
 * 全量助手梳理（助手 agent 化收敛分析前置）
 * 静态遍历 core registry + 228 领域包，统计每个助手定义的执行特征，输出分类矩阵。
 * 分类判据：
 *  - 工具类：runtimeCapabilities.isToolAssistant（加密解密/二维码/条形码等非 LLM 工具面板）
 *  - 多模态类：runtimeCapabilities.mediaKind（image/audio/video——mediaApi 独立执行）
 *  - KB 类：runtimeCapabilities.useKnowledgeBase（知识库检索注入）
 *  - 报告类：reportSettings 相关（程序化报告文档生成）
 *  - 提示词模板类（其余）：systemPrompt+userPromptTemplate+documentAction = 可塞入技能的配方
 * 占位符统计：userPromptTemplate 里的 {{xxx}} 种类（决定模板渲染器需要的变量集）
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSISTANT_DIR = join(ROOT, 'src/utils/assistant')
const REGISTRY = join(ROOT, 'src/utils/assistantRegistry.js')

// —— 从 registry 提取 core 组（404 行起到 BUILTIN_ASSISTANTS 聚合前）——
const registrySrc = readFileSync(REGISTRY, 'utf8')
function extractIds(src) {
  // 每个助手定义以 id: 'xxx' 开头，抓全字段直到下一个 id: 或数组结束
  const out = []
  const re = /id:\s*'([^']+)'/g
  let m
  while ((m = re.exec(src))) out.push(m[1])
  return out
}

/** 解析单个定义块的特征字段（从 id 位置到下一个 id 或结尾） */
function parseDefinition(src, startPos, endPos) {
  const block = src.slice(startPos, endPos)
  const pick = (re) => { const m = block.match(re); return m ? m[1] : '' }
  return {
    id: pick(/id:\s*'([^']+)'/),
    label: pick(/label:\s*'([^']+)'/),
    modelType: pick(/modelType:\s*'([^']+)'/) || 'chat',
    defaultAction: pick(/defaultAction:\s*'([^']+)'/) || 'insert',
    defaultInputSource: pick(/defaultInputSource:\s*([A-Z_]+|'[^']+')/).replace(/'/g, ''),
    isToolAssistant: /isToolAssistant:\s*true/.test(block),
    toolId: pick(/toolId:\s*'([^']+)'/),
    mediaKind: pick(/mediaKind:\s*'([^']+)'/),
    useKnowledgeBase: /useKnowledgeBase:\s*true/.test(block),
    singlePassDocument: /singlePassDocument:\s*true/.test(block),
    hasReportSettings: /reportSettings/.test(block),
    hasParameterFields: /parameterFields|formFields|needsParameter/.test(block),
    placeholders: [...block.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]),
    systemPromptLen: (pick(/systemPrompt:\s*'/) , (block.match(/systemPrompt:\s*`([^`]*)`|systemPrompt:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '').length,
    userPromptLen: (block.match(/userPromptTemplate:\s*`([^`]*)`|userPromptTemplate:\s*'((?:[^'\\]|\\.)*)'/) || [])[1]?.length || 0
  }
}

const all = []
// registry：按 id 切块
{
  const ids = [...registrySrc.matchAll(/id:\s*'([^']+)'/g)]
  ids.forEach((m, i) => {
    const start = m.index
    const end = i + 1 < ids.length ? ids[i + 1].index : Math.min(start + 3000, registrySrc.length)
    const def = parseDefinition(registrySrc, start, end)
    if (def.id) all.push({ ...def, pack: 'core-registry' })
  })
}
// 领域包
const files = readdirSync(ASSISTANT_DIR).filter((f) => /^builtinAssistants.+\.js$/.test(f))
for (const f of files) {
  const src = readFileSync(join(ASSISTANT_DIR, f), 'utf8')
  const ids = [...src.matchAll(/id:\s*'([^']+)'/g)]
  ids.forEach((m, i) => {
    const start = m.index
    const end = i + 1 < ids.length ? ids[i + 1].index : Math.min(start + 3000, src.length)
    const def = parseDefinition(src, start, end)
    if (def.id) all.push({ ...def, pack: f.replace('builtinAssistants', '').replace('.js', '') })
  })
}

// —— 汇总 ——
const by = (fn) => {
  const map = {}
  for (const a of all) { const k = fn(a); map[k] = (map[k] || 0) + 1 }
  return map
}
const toolAssistants = all.filter((a) => a.isToolAssistant)
const media = all.filter((a) => a.mediaKind)
const kb = all.filter((a) => a.useKnowledgeBase)
const report = all.filter((a) => a.hasReportSettings)
const param = all.filter((a) => a.hasParameterFields)
const template = all.filter((a) => !a.isToolAssistant && !a.mediaKind && !a.useKnowledgeBase && !a.hasReportSettings)
const placeholderKinds = {}
for (const a of all) for (const p of a.placeholders) placeholderKinds[p] = (placeholderKinds[p] || 0) + 1

const summary = {
  total: all.length,
  packs: files.length + 1,
  modelType: by((a) => a.modelType),
  defaultAction: by((a) => a.defaultAction),
  inputSource: by((a) => a.defaultInputSource),
  分类: {
    工具类_独立面板: toolAssistants.length,
    多模态类_独立执行: media.length,
    KB检索类: kb.length,
    报告类: report.length,
    参数收集类_标记: param.length,
    纯提示词模板类_可塞技能: template.length
  },
  工具类清单: toolAssistants.map((a) => `${a.id}(${a.toolId})`),
  多模态清单: media.map((a) => `${a.id}[${a.mediaKind}]`),
  KB清单: kb.map((a) => a.id),
  报告类清单: report.map((a) => a.id),
  占位符种类: placeholderKinds,
  templateAction: by.call(null, (a) => template.includes(a) ? a.defaultAction : '⌀')
}
console.log(JSON.stringify(summary, null, 2))
writeFileSync(join(ROOT, 'scripts/assistant-landscape.json'), JSON.stringify({ summary, all }, null, 2))
console.log(`\n[明细] scripts/assistant-landscape.json（${all.length} 条全量）`)
