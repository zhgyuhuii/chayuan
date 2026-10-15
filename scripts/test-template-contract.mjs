#!/usr/bin/env node
/**
 * 模板契约纯函数单测（方案 v1.4 #11：离线可测，不依赖 LLM/window）。
 * 用法：node scripts/test-template-contract.mjs
 */
import assert from 'node:assert/strict'
import {
  CONTRACT_SCHEMA_VERSION,
  cardAspectsForKind,
  smartDefaults,
  assembleContract,
  contractToPromptLines,
  flatKeyFor,
  outlineChanged,
  P2_GATED_LEAVES
} from '../src/utils/templateContract.js'
// P2_GATED_LEAVES 供外部排查用，此处断言其内容
assert.equal(P2_GATED_LEAVES.has('sheet.logic.formulaExtend'), true)

let passed = 0
function ok(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

// ── 1. 卡片项：P2 门控过滤 ──
ok('cardAspects: P2 门控项不出现', () => {
  const docLeaves = cardAspectsForKind('doc').map(d => d.leaf)
  assert.equal(docLeaves.includes('structure.tables'), false)
  const sheetLeaves = cardAspectsForKind('sheet').map(d => d.leaf)
  assert.equal(sheetLeaves.includes('logic.formulaExtend'), false)
  assert.equal(sheetLeaves.includes('header.style'), false)
})
ok('cardAspects: 非法 kind 回退 doc', () => {
  assert.ok(cardAspectsForKind('weird').length === cardAspectsForKind('doc').length)
})

// ── 2. 智能默认 ──
const docProfileWithText = { structure: { sampleText: '第一章 总则…', headings: [{ text: '总则' }] } }
const docProfileEmpty = { structure: {} }
const slideProfileWithBg = { slides: [{ texts: ['封面标题'], pictureCount: 2 }, { texts: [] }] }
ok('smartDefaults: doc 有样例→文风预勾', () => {
  const d = smartDefaults('doc', { profile: docProfileWithText })
  assert.equal(d.asp_doc_copy_toneFollow, true)
})
ok('smartDefaults: doc 无样例→文风不勾', () => {
  const d = smartDefaults('doc', { profile: docProfileEmpty })
  assert.equal(d.asp_doc_copy_toneFollow, false)
})
ok('smartDefaults: doc 无标题树→骨架不勾', () => {
  const d = smartDefaults('doc', { profile: docProfileEmpty })
  assert.equal(d.asp_doc_structure_skeleton, false)
})
ok('smartDefaults: sampleAsReference 默认 false', () => {
  assert.equal(smartDefaults('doc', { profile: docProfileWithText }).asp_doc_content_sampleAsReference, false)
})
ok('smartDefaults: slide 有图→背景预勾', () => {
  const d = smartDefaults('slide', { profile: slideProfileWithBg })
  assert.equal(d.asp_slide_layout_backgrounds, true)
})

// ── 3. 扁平键 ↔ 契约组装 ──
ok('assembleContract: 扁平键 true/false 正确落嵌套', () => {
  const c = assembleContract({
    asp_doc_copy_toneFollow: false,
    asp_doc_style_fonts: 'true',
    asp_doc_structure_skeleton: true
  }, 'doc', {})
  assert.equal(c.aspects.copy.toneFollow, false)
  assert.equal(c.aspects.style.fonts, true)
  assert.equal(c.aspects.structure.skeleton, true)
  assert.equal(c.schemaVersion, CONTRACT_SCHEMA_VERSION)
})
ok('assembleContract: 缺省回退智能默认', () => {
  const defaults = { asp_doc_copy_toneFollow: false }
  const c = assembleContract({}, 'doc', defaults)
  assert.equal(c.aspects.copy.toneFollow, false)
})
ok('assembleContract: 未知键忽略', () => {
  const c = assembleContract({ asp_doc_hacker_field: true, junk: 1 }, 'doc', {})
  assert.equal(c.aspects.hacker_field, undefined)
})

// ── 4. prompt 注入 ──
ok('contractToPromptLines: 全开时至少含固定文案与文风行', () => {
  const c = assembleContract({}, 'doc', smartDefaults('doc', { profile: docProfileWithText }))
  const lines = contractToPromptLines(c)
  assert.match(lines, /模仿模板原文语体/)
  assert.match(lines, /一律不动/)
})
ok('contractToPromptLines: 关闭项产生"不要求"指令', () => {
  const c = assembleContract({ asp_doc_structure_skeleton: false, asp_doc_copy_toneFollow: false }, 'doc', {})
  const lines = contractToPromptLines(c)
  assert.match(lines, /不要求按模板章节骨架/)
  assert.match(lines, /自由撰写/)
})

// ── 5. 大纲变更检测 ──
ok('outlineChanged: 空白差异不算改', () => {
  assert.equal(outlineChanged('一、总则\n\n二、附则\n', '一、总则\n二、附则'), false)
})
ok('outlineChanged: 实质差异算改', () => {
  assert.equal(outlineChanged('一、总则', '一、前言'), true)
})

// ── 6. flatKey 稳定性 ──
ok('flatKeyFor: 点转下划线', () => {
  assert.equal(flatKeyFor('doc', 'copy.toneFollow'), 'asp_doc_copy_toneFollow')
})

console.log(`\n[test-template-contract] ${passed} assertions passed`)
