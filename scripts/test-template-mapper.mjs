#!/usr/bin/env node
/**
 * 模板内容映射器纯函数单测（2026-10-16 形状级重构：离线可测，不依赖 LLM/window）。
 * 真机根因回归：旧版把封面 texts[0]「LOGO」当标题替换，真正的大字号标题残留。
 * 用法：node scripts/test-template-mapper.mjs
 */
import assert from 'node:assert/strict'
import {
  sectionizeReference,
  fitText,
  capFor,
  readingOrder,
  orderTocEntries,
  buildDeterministicSlidePlan
} from '../src/utils/templateContentMapper.js'

let passed = 0
function ok(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const MD = [
  '# 2025年度研发工作总结',
  '覆盖周期：2025-01-01 至 2025-12-31',
  '## 一、总体概览',
  '总工时：51371.25 小时（12928条日志）',
  '参与人数：32人',
  '## 二、项目视角',
  'Top项目投入（工时）：KFSJ 11177.9 小时',
  '### 2.1 重点项目',
  'ORP 项目按期交付'
].join('\n')

// ── 1. 章节化 ──
ok('sectionize: H1 提为文档标题不作章', () => {
  const { docTitle, sections } = sectionizeReference(MD, '需求')
  assert.equal(docTitle, '2025年度研发工作总结')
  // H1 前的散段构成无题首章 + 三个实章
  assert.equal(sections.length, 4)
  assert.equal(sections[0].title, '')
  assert.deepEqual(sections.slice(1).map(s => s.title), ['一、总体概览', '二、项目视角', '2.1 重点项目'])
})
ok('sectionize: 中文序号标题识别（一、）', () => {
  const { sections } = sectionizeReference('一、总体概览\n正文甲\n二、项目视角\n正文乙', '')
  assert.deepEqual(sections.map(s => s.title), ['一、总体概览', '二、项目视角'])
  assert.deepEqual(sections.map(s => s.paras), [['正文甲'], ['正文乙']])
})
ok('sectionize: md 表格行竖线转逗号、加粗剥离', () => {
  const { sections } = sectionizeReference('一、数据\n| 项目 | 工时 |\n|---|---|\n| **KFSJ** | 11177 |\nhttp://www.1ppt.com', '')
  const body = sections[0].paras.join(' ')
  assert.ok(!body.includes('|'), '不应残留竖线')
  assert.ok(body.includes('KFSJ') && body.includes('11177'))
})
ok('sectionize: 无标题素材 → 空题章 + requirement 兜底 docTitle', () => {
  const { docTitle, sections } = sectionizeReference('散段一\n散段二', '生成年度总结PPT')
  assert.equal(docTitle, '生成年度总结PPT')
  assert.equal(sections[0].paras.length, 2)
})
ok('sectionize: 分隔线/表格分隔行跳过', () => {
  const { sections } = sectionizeReference('一、章\n---\n|---|---|\n正文', '')
  assert.equal(sections[0].paras.length, 1)
})

// ── 2. fitText/capFor ──
ok('fitText: 短文原样', () => {
  assert.equal(fitText('工作概述', 40), '工作概述')
})
ok('fitText: 超长在句读处截断', () => {
  const t = fitText('上半句内容比较长一些。下半句不重要被截掉', 12)
  assert.equal(t, '上半句内容比较长一些。')
})
ok('fitText: 无句读补省略号', () => {
  const t = fitText('一二三四五六七八九十一二三四五六七八九十一二三四五', 10)
  assert.ok(t.length <= 11 && t.endsWith('…'))
})
ok('capFor: 4 字占位副标题 ≥20 保证数据句完整', () => {
  assert.ok(capFor('subtitle', 4) >= 20)
  assert.ok(capFor('body', 4) >= 30)
  assert.ok(capFor('title', 40) <= 40)
})

// ── 3. 阅读顺序 ──
const SH = (i, x, y, combined) => ({ shapeIndex: i, role: 'body', combined, x, y })
ok('readingOrder: 上→下、同行左→右（EMU）', () => {
  const out = readingOrder([SH(0, 9144000, 0, 'a'), SH(1, 914400, 914400, 'b'), SH(2, 4572000, 0, 'c')])
  assert.deepEqual(out.map(s => s.shapeIndex), [2, 0, 1])
})
ok('readingOrder: 无坐标保持原序', () => {
  const out = readingOrder([SH(5, 0, 0, 'a'), SH(3, 0, 0, 'b')])
  assert.deepEqual(out.map(s => s.shapeIndex), [5, 3])
})
ok('orderTocEntries: 就近序号装饰排序', () => {
  const entries = [SH(2, 1870000 * 1, 1810000 * 1, '甲'), SH(12, 6030000 * 1, 1810000 * 1, '乙')]
  const decors = [
    { combined: '01.', x: 1200000 * 1, y: 1780000 * 1, shapeIndex: 1 },
    { combined: '02.', x: 5360000 * 1, y: 1780000 * 1, shapeIndex: 11 }
  ]
  // 甲在左（近01）、乙在右（近02）→ 甲先
  const out = orderTocEntries(entries, decors)
  assert.deepEqual(out.map(s => s.shapeIndex), [2, 12])
})
ok('orderTocEntries: 右侧条目（02）排后', () => {
  const entries = [SH(12, 6030000, 1810000, '右'), SH(2, 1870000, 1810000, '左')]
  const decors = [
    { combined: '01.', x: 1200000, y: 1780000, shapeIndex: 1 },
    { combined: '02.', x: 5360000, y: 1780000, shapeIndex: 11 }
  ]
  assert.deepEqual(orderTocEntries(entries, decors).map(s => s.shapeIndex), [2, 12])
})

// ── 4. 底稿计划（角色对位） ──
const PROFILE = {
  slides: [
    { index: 1, texts: ['LOGO', '旧副标题文案', '旧主标题占位'], shapes: [
      { shapeIndex: 0, role: 'decor', combined: 'LOGO', x: 100000, y: 100000 },
      { shapeIndex: 4, role: 'body', combined: '旧副标题文案', x: 2000000, y: 3000000 },
      { shapeIndex: 5, role: 'title', combined: '旧主标题占位', x: 2000000, y: 2000000 }
    ] },
    { index: 2, texts: ['01.', '目录旧条目甲', 'Lorem ipsum dolor'], shapes: [
      { shapeIndex: 1, role: 'decor', combined: '01.', x: 1000000, y: 1700000 },
      { shapeIndex: 2, role: 'subtitle', combined: '目录旧条目甲', x: 1800000, y: 1800000 },
      { shapeIndex: 3, role: 'body', combined: 'Lorem ipsum dolor', x: 1800000, y: 2100000 },
      { shapeIndex: 10, role: 'title', combined: '目录CONTENTS', x: 5000000, y: 100000 }
    ] },
    { index: 3, texts: ['PART ONE', '章节页标题占位'], shapes: [
      { shapeIndex: 0, role: 'decor', combined: 'PART ONE', x: 300000, y: 200000 },
      { shapeIndex: 12, role: 'title', combined: '章节页标题占位', x: 2000000, y: 2500000 }
    ] }
  ]
}
ok('计划: 封面标题 ← 文档标题（真机回归：不再是 LOGO）', () => {
  const plan = buildDeterministicSlidePlan(PROFILE, MD, '年度总结')
  const p1 = plan.pages.find(p => p.page === 1)
  const titleRep = p1.replaces.find(r => r.shapeIndex === 5)
  assert.equal(titleRep.replace, '2025年度研发工作总结')
  assert.equal(titleRep.find, '旧主标题占位')
  assert.ok(!p1.replaces.some(r => r.shapeIndex === 0), 'decor LOGO 不应被替换')
})
ok('计划: 每条 replace 带 shapeIndex', () => {
  const plan = buildDeterministicSlidePlan(PROFILE, MD, '需求')
  for (const p of plan.pages) for (const r of p.replaces) assert.notEqual(r.shapeIndex, undefined)
})
ok('计划: 目录页条目 ← 章节标题、正文 ← 章节首段、目录标题不动', () => {
  const plan = buildDeterministicSlidePlan(PROFILE, MD, '需求')
  const p2 = plan.pages.find(p => p.page === 2)
  const entry = p2.replaces.find(r => r.shapeIndex === 2)
  assert.equal(entry.replace, '一、总体概览')
  const body = p2.replaces.find(r => r.shapeIndex === 3)
  assert.ok(body.replace.startsWith('覆盖周期') || body.replace.includes('总工时') || body.replace.includes('一、'))
  assert.ok(!p2.replaces.some(r => r.shapeIndex === 10), '「目录CONTENTS」标题保留')
})
ok('计划: 章节页标题 ← 当前章标题', () => {
  const plan = buildDeterministicSlidePlan(PROFILE, MD, '需求')
  const p3 = plan.pages.find(p => p.page === 3)
  const t = p3.replaces.find(r => r.shapeIndex === 12)
  assert.ok(['一、总体概览', '二、项目视角'].includes(t.replace))
  assert.ok(!p3.replaces.some(r => r.shapeIndex === 0), 'PART ONE 保留')
})
ok('计划: 无 shapes 退化 texts 兜底', () => {
  const plan = buildDeterministicSlidePlan({ slides: [{ index: 1, texts: ['标题占位', '正文占位'] }] }, MD, '需求')
  assert.equal(plan.pages.length, 1)
  assert.equal(plan.pages[0].replaces[0].replace, '2025年度研发工作总结')
})

console.log(`\n共 ${passed} 项断言通过`)
