/**
 * 汇总三车道结果 → Markdown 测试报告。
 * 用法: node report.mjs [--out 路径]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ART = path.resolve(HERE, '../../artifacts/e2e-180')
const lanes = [['writer', 'wps', 'Writer 文字'], ['et', 'et', '表格'], ['wpp', 'wpp', '演示']]

const recs = {}
for (const [, host] of lanes) {
  const f = path.join(ART, `results-${host}.jsonl`)
  recs[host] = []
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (line.trim()) { try { recs[host].push(JSON.parse(line)) } catch { /* 跳过坏行 */ } }
    }
  }
}

/** 去重：同 id 保留最后一次 */
const final = {}
for (const [, host] of lanes) {
  final[host] = new Map()
  for (const r of recs[host]) final[host].set(r.id, r)
}

const outPath = path.resolve(HERE, '..', arguments0())
function arguments0() {
  const i = process.argv.indexOf('--out')
  return i >= 0 ? process.argv[i + 1] : path.join(ART, 'e2e-report.md')
}

const L = []
L.push('# 察元AI 真机 180 场景 E2E 测试报告\n')
L.push(`- 生成时间：${new Date().toLocaleString('zh-CN')}`)
L.push('- 环境：macOS arm64 · WPS Office 12.1 (28496) · 加载项 5.1.7 · sidecar chayuan-mcp · 模型 agnes-3.0-flash（OpenAI 兼容）')
L.push('- 管线：每个场景经 MCP `chat_turn` 派发到 ribbon 基座 webview 的完整 agent 循环（与用户在对话窗操作同管线），验证用 MCP 读工具做确定性断言')
L.push('- 执行方式：三车道并行（wps/et/wpp 各自打开专属测试文件），LLM 全局串行锁规避免费档速率限制；每场景失败自动重试 1 次\n')

let totalP = 0, totalN = 0
for (const [lane, host, label] of lanes) {
  const items = [...final[host].values()]
  const p = items.filter(r => r.pass).length
  totalP += p; totalN += items.length
  L.push(`## ${label}（${lane}）— ${p}/${items.length} PASS\n`)
  L.push('| 场景 | 结果 | 耗时 | 证据 |')
  L.push('| --- | --- | --- | --- |')
  for (const r of items.sort((a, b) => a.id.localeCompare(b.id))) {
    L.push(`| ${r.id} ${r.desc || ''} | ${r.pass ? '✅' : '❌'}${r.attempt > 1 ? `(重试r${r.attempt})` : ''} | ${r.secs}s | ${String(r.evidence || '').replace(/\|/g, '/').slice(0, 140)} |`)
  }
  L.push('')
}
L.push(`## 总计：${totalP}/${totalN} PASS\n`)
const fails = []
for (const [, host] of lanes) for (const [id, r] of final[host]) if (!r.pass) fails.push(`${id}: ${String(r.evidence).slice(0, 120)}`)
if (fails.length) { L.push('### 未通过项\n'); for (const f of fails) L.push(`- ${f}`) }

fs.writeFileSync(outPath, L.join('\n'), 'utf8')
console.log('report ->', outPath)
console.log(`total: ${totalP}/${totalN}`)
