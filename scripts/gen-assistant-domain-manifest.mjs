#!/usr/bin/env node
/**
 * gen-assistant-domain-manifest.mjs — 零 token 生成助手领域 manifest + pack loader 映射
 *
 * 产出两个文件(供 group-first 懒加载用,助手定义变更后重跑):
 *   src/utils/assistant/assistantPackLoaders.js   —— PACK_LOADERS 键化映射(字面 import,保留 Vite 切分)
 *   src/utils/assistant/assistantDomainManifest.js —— DOMAIN_MANIFEST {domain:{label,count,packs[]}}
 *
 * 数据源:assistantRegistry.js 当前的 DOMAIN_PACK_LOADERS(逐条解析,忠实复刻,不丢包)。
 * 用法:node scripts/gen-assistant-domain-manifest.mjs [--check]   (--check 只校验不写文件)
 */
import { readFile, writeFile } from 'node:fs/promises'

const WPS = '/work/chayuan-wps'
const CHECK = process.argv.includes('--check')
const OUTDIR = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : `${WPS}/src/utils/assistant`

const reg = await readFile(`${WPS}/src/utils/assistantRegistry.js`, 'utf8')

// 逐条解析当前 loader:文件名 + 导出名(顺序保留)
const re = /\(\) => import\('\.\/assistant\/(builtinAssistants[A-Za-z0-9]+)\.js'\)\.then\(m => m\.([A-Z0-9_]+)\)/g
let m, loaders = []
while ((m = re.exec(reg))) loaders.push({ pack: m[1], exp: m[2] })

// 校验:与源数组条目数一致
const declared = (reg.match(/\(\) => import\('\.\/assistant\/builtinAssistants/g) || []).length
if (loaders.length !== declared) {
  console.error(`FATAL 解析数 ${loaders.length} != 源声明数 ${declared},生成器正则需修`)
  process.exit(1)
}

// pack 短键 = 去掉 builtinAssistants 前缀
const keyOf = (pack) => pack.replace(/^builtinAssistants/, '')

// 领域中文标签
const labelBlock = reg.slice(reg.indexOf('ASSISTANT_GROUP_LABELS = {'))
const labelText = labelBlock.slice(0, labelBlock.indexOf('\n}'))
const labelRe = /^\s*'?([A-Za-z0-9_-]+)'?\s*:\s*'([^']+)'/gm
const LABELS = {}; let lm
while ((lm = labelRe.exec(labelText))) LABELS[lm[1]] = lm[2]

// 加载每个 pack → domain + count(每包 1 域)
const domainCount = {}, domainPacks = {}
let total = 0
const keySeen = new Set()
for (const { pack, exp } of loaders) {
  const key = keyOf(pack)
  if (keySeen.has(key)) { console.error('FATAL pack 短键重复', key); process.exit(1) }
  keySeen.add(key)
  let mod
  try { mod = await import(`${WPS}/src/utils/assistant/${pack}.js`) }
  catch (e) { console.error('FATAL import 失败', pack, e.message); process.exit(1) }
  const arr = mod[exp]
  if (!Array.isArray(arr)) { console.error('FATAL 导出非数组', pack, exp); process.exit(1) }
  const packDomains = new Set()
  for (const a of arr) {
    const d = a.domain || 'misc'
    domainCount[d] = (domainCount[d] || 0) + 1
    packDomains.add(d)
    total++
  }
  // 该 pack 只含 1 域(已校验);把 pack 短键登记到其 domain(去重,保留 loader 顺序=base先Ext后)
  for (const d of packDomains) {
    const list = domainPacks[d] = domainPacks[d] || []
    if (!list.includes(key)) list.push(key)
  }
}

const domains = Object.keys(domainCount)
const noLabel = domains.filter(d => !LABELS[d])
if (noLabel.length) { console.error('FATAL 缺中文标签的 domain:', noLabel.join(',')); process.exit(1) }

// domain 排序:计数降序(默认序;对话窗口仍用自身 ORDER 优先级)
const domainOrder = [...domains].sort((a, b) => domainCount[b] - domainCount[a] || a.localeCompare(b))

console.error(`解析 loader ${loaders.length} | 助手 ${total} | 领域 ${domains.length} | 标签齐全`)

if (CHECK) { console.error('--check 通过,未写文件'); process.exit(0) }

// ---- 生成 registry 用的键化 PACK_LOADERS 块(./assistant/ 路径,供一次性替换数组) ----
const loaderLines = loaders.map(({ pack, exp }) =>
  `  ${keyOf(pack)}: () => import('./assistant/${pack}.js').then(m => m.${exp}),`
).join('\n')
const packLoadersBlock = `// 领域包加载器:pack 短键 -> 动态 import。新增领域包在此加一行,并运行
// scripts/gen-assistant-domain-manifest.mjs 重生成 assistant/assistantDomainManifest.js。
export const PACK_LOADERS = {
${loaderLines}
}
`
// ---- 生成 assistantDomainManifest.js ----
const manifestEntries = domainOrder.map(d =>
  `  ${JSON.stringify(d)}: { label: ${JSON.stringify(LABELS[d])}, count: ${domainCount[d]}, packs: [${domainPacks[d].map(k => JSON.stringify(k)).join(', ')}] },`
).join('\n')
const manifestJs = `// 自动生成,请勿手工编辑 —— 运行 scripts/gen-assistant-domain-manifest.mjs 重生成。
// 领域 -> {中文名, 助手数, 所属 pack 短键[]};供对话窗口 group-first 懒加载只渲分组+计数。
export const ASSISTANT_TOTAL = ${total}
export const DOMAIN_COUNT = ${domains.length}
export const DOMAIN_ORDER = [${domainOrder.map(d => JSON.stringify(d)).join(', ')}]
export const DOMAIN_MANIFEST = {
${manifestEntries}
}
`
await writeFile(`${OUTDIR}/assistantDomainManifest.js`, manifestJs, 'utf8')
console.error(`写入 ${OUTDIR}/assistantDomainManifest.js (${domains.length} domains)`)
// 键化块仅在首次/loader 变更时用于替换 registry 数组,默认写到同目录 _packloaders_block.txt
if (process.argv.includes('--emit-block')) {
  await writeFile(`${OUTDIR}/_packloaders_block.txt`, packLoadersBlock, 'utf8')
  console.error(`写入 ${OUTDIR}/_packloaders_block.txt (一次性替换 registry 数组用)`)
}
