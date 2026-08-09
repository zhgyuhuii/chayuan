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

const domains = (DOMAIN_ORDER || Object.keys(DOMAIN_MANIFEST)).map(id => ({
  id,
  label: DOMAIN_MANIFEST[id]?.label || id,
  count: Number(DOMAIN_MANIFEST[id]?.count || 0),
  packs: DOMAIN_MANIFEST[id]?.packs || []
}))

const payload = {
  generatedAt: new Date().toISOString(),
  domainCount: DOMAIN_COUNT || domains.length,
  assistantTotal: ASSISTANT_TOTAL || domains.reduce((s, d) => s + d.count, 0),
  domains
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`[gen-mcp-domain-index] wrote ${out} (${payload.domainCount} domains, ${payload.assistantTotal} assistants)`)
