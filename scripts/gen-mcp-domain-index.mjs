/**
 * Export DOMAIN_MANIFEST → mcp-sidecar/data/domain-index.json for L1 offline catalog.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'src/utils/assistant/assistantDomainManifest.js')
const outDir = path.join(root, 'mcp-sidecar/data')
const out = path.join(outDir, 'domain-index.json')

const mod = await import(pathToFileURL(src).href)
const { DOMAIN_MANIFEST, DOMAIN_ORDER, DOMAIN_COUNT, ASSISTANT_TOTAL } = mod

// 从各域的助手定义包提取功能关键词（助手中文 label + id），供 L1 离线搜索：
// agent 离线时 assistants_search 只有这份索引，若只有域壳（"餐饮/食品"），
// 模型搜功能词（"改写/摘要/润色"）永远空结果而放弃（2026-09-09 实测）。
async function extractDomainKeywords(id, packs) {
  const keywords = new Set()
  for (const pack of packs || []) {
    try {
      const mod = await import(pathToFileURL(path.join(root, `src/utils/assistant/builtinAssistants${pack}.js`)).href)
      // 包导出形如 { <PACK>_BUILTIN_ASSISTANTS: Assistant[], default: {...}, mergeXIntoBuiltins }
      const list = [...Object.values(mod)].find(v => Array.isArray(v) && v.length && typeof v[0] === 'object')
      for (const a of Array.isArray(list) ? list : []) {
        const label = String(a.label || a.shortLabel || '').trim()
        if (label) keywords.add(label)
        if (a.key) keywords.add(String(a.key))
      }
    } catch { /* 包缺失时跳过 */ }
  }
  return [...keywords].slice(0, 400)
}

const domains = []
for (const id of (DOMAIN_ORDER || Object.keys(DOMAIN_MANIFEST))) {
  const d = DOMAIN_MANIFEST[id] || {}
  domains.push({
    id,
    label: d.label || id,
    count: Number(d.count || 0),
    packs: d.packs || [],
    keywords: await extractDomainKeywords(id, d.packs)
  })
}

const payload = {
  generatedAt: new Date().toISOString(),
  domainCount: DOMAIN_COUNT || domains.length,
  assistantTotal: ASSISTANT_TOTAL || domains.reduce((s, d) => s + d.count, 0),
  domains
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`[gen-mcp-domain-index] wrote ${out} (${payload.domainCount} domains, ${payload.assistantTotal} assistants)`)
