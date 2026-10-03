#!/usr/bin/env node
/** 文档绑定守卫单测：对话↔文档一致性强制的核心判定 */
import assert from 'node:assert/strict'
import { checkDocBinding } from '../src/services/mcpBridge/chatTurnRunner.js'

// 1) 一致 → 放行
assert.deepEqual(checkDocBinding('/a.xlsx', '/a.xlsx').ok, true, '一致放行')

// 2) 不一致 → 拒绝且消息含双文档名
{
  const r = checkDocBinding('/a.xlsx', '/b.pptx')
  assert.equal(r.ok, false)
  assert.ok(r.message.includes('/a.xlsx') && r.message.includes('/b.pptx'), '消息含两个文档名')
  assert.ok(r.message.includes('未执行'), '明确说明未执行')
}

// 3) 空缺省放行（由 expectDocId 兜底）
assert.equal(checkDocBinding('', '/a.xlsx').ok, true, '面板未声明放行')
assert.equal(checkDocBinding('/a.xlsx', '').ok, true, '探测不到放行')

// 4) 空白差异容忍（trim）
assert.deepEqual(checkDocBinding(' /a.xlsx ', '/a.xlsx').ok, true, '空白容忍')

console.log('ALL DOC-BINDING TESTS PASSED')
