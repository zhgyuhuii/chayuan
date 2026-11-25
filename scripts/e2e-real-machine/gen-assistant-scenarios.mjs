#!/usr/bin/env node
/**
 * 助手 agent 回合回归场景生成器（P0-3 前置件）
 *
 * 从 assistantDomainManifest（228 领域 × ~24 助手位）分层抽样生成 e2e 场景：
 * 每领域抽 1-2 个助手 × 每个抽中助手覆盖 1 个模板位 → 输出 scenarios-assistants.mjs
 * 供 harness.mjs 消费（真机执行「打开文档→选区→发起助手→断言写回/结果」全链）。
 *
 * 用法：
 *   node scripts/e2e-real-machine/gen-assistant-scenarios.mjs --per-domain 2 --smoke 50
 *   输出：scripts/e2e-real-machine/scenarios-assistants.mjs（smoke 集 = 前 50 领域代表）
 *
 * 断言口径（与 harness 场景契约一致）：
 *   1. 助手 agent 回合终态 ok=true（无任务卡参与）
 *   2. expectWrite 助手：步骤里出现预期写工具（document_insert/replace/apply_ops）
 *      或兜底补写完成（wroteBack=true）
 *   3. none 类助手：消息内容非空
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = join(ROOT, 'scripts/e2e-real-machine')

// manifest 是静态 ESM（无 default），直接文本解析 DOMAIN_MANIFEST 的 key 列表
const manifestSrc = new URL('../../src/utils/assistant/assistantDomainManifest.js', import.meta.url)
const { readFile } = await import('node:fs/promises')
const src = await readFile(new URL(manifestSrc).pathname, 'utf8')
const keysMatch = src.match(/"([a-z0-9-]+)":\s*\{\s*label:\s*"([^"]+)",\s*count:\s*(\d+)/g) || []
const domains = keysMatch.map((m) => {
  const [, key, label, count] = m.match(/"([a-z0-9-]+)":\s*\{\s*label:\s*"([^"]+)",\s*count:\s*(\d+)/)
  return { key, label, count: Number(count) }
})

const args = process.argv.slice(2)
const argOf = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : dflt
}
const perDomain = Math.max(1, argOf('per-domain', 2))
const smokeCount = Math.max(10, argOf('smoke', 50))

// 领域内助手 id 规约：领域包助手 id = `${domain}.<slot>`（builtinAssistants<Domain> 注册）。
// slot 无法静态枚举（懒加载领域包在运行时注册），场景以「领域内首个可用助手」动态探针：
// harness 场景调用 assistants_list 域工具取该领域助手清单并取第 N 个——运行时解析。
const scenarios = []
domains.forEach((d, di) => {
  const picks = Math.min(perDomain, Math.max(1, Math.round((d.count / 24) * perDomain)))
  for (let k = 0; k < picks; k++) {
    scenarios.push({
      id: `assistant-${d.key}-${k}`,
      domain: d.key,
      domainLabel: d.label,
      desc: `领域助手冒烟：${d.label} 第 ${k + 1} 个助手（分层抽样 per-domain=${perDomain}）`,
      // harness 运行时步骤：列出该领域助手 → 选中第 k 个 → 选区输入样文 → 发起 → 断言
      selectProbe: { domain: d.key, slot: k },
      expect: { lane: 'agent', writeOrAnswer: true }
    })
  }
})

const smoke = scenarios.slice(0, smokeCount)
const fileBody = `// 自动生成（${new Date().toISOString()}）—— gen-assistant-scenarios.mjs，勿手编。
// 领域分层抽样助手 agent 回合回归场景：全量 ${scenarios.length} / 冒烟 ${smoke.length}
export const ASSISTANT_SCENARIOS_ALL = ${JSON.stringify(scenarios, null, 2)}
export const ASSISTANT_SCENARIOS_SMOKE = ${JSON.stringify(smoke, null, 2)}
export default ASSISTANT_SCENARIOS_SMOKE
`
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'scenarios-assistants.mjs'), fileBody)
console.log(`[gen-assistant-scenarios] 领域 ${domains.length} 个 → 场景全量 ${scenarios.length} / 冒烟 ${smoke.length} → scripts/e2e-real-machine/scenarios-assistants.mjs`)
