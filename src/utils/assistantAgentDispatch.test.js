/**
 * 双轨分流器回归锁定（P0-4）：FC 记忆/车道判定/direct 写回参数构造
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveAssistantLane,
  markModelFcUnsupported,
  isModelFcUnsupported,
  resetModelFcMemory,
  buildDirectWriteToolArgs
} from './assistantAgentDispatch.js'

beforeEach(() => resetModelFcMemory())

describe('车道判定', () => {
  it('默认 agent（无记忆）', () => {
    expect(resolveAssistantLane({ providerId: 'ZHIPU', modelId: 'glm-4.6' })).toBe('agent')
  })
  it('标记 FC 不支持后 → direct', () => {
    markModelFcUnsupported('ZHIPU', 'glm-4-flash')
    expect(isModelFcUnsupported('ZHIPU', 'glm-4-flash')).toBe(true)
    expect(resolveAssistantLane({ providerId: 'ZHIPU', modelId: 'glm-4-flash' })).toBe('direct')
  })
  it('记忆按模型隔离：标记 flash 不影响 4.6', () => {
    markModelFcUnsupported('ZHIPU', 'glm-4-flash')
    expect(resolveAssistantLane({ providerId: 'ZHIPU', modelId: 'glm-4.6' })).toBe('agent')
  })
  it('forceLane 显式覆盖', () => {
    markModelFcUnsupported('ZHIPU', 'glm-4-flash')
    expect(resolveAssistantLane({ providerId: 'ZHIPU', modelId: 'glm-4-flash', forceLane: 'agent' })).toBe('agent')
    expect(resolveAssistantLane({ providerId: 'ZHIPU', modelId: 'glm-4.6', forceLane: 'direct' })).toBe('direct')
  })
})

describe('direct 轨写回参数构造', () => {
  it('insert + 选区 → document_insert(position=after, originalText=选区)', () => {
    const r = buildDirectWriteToolArgs({
      effectiveDocumentAction: 'insert', inputText: '春天来了', hasSelection: true,
      outputText: '扩写后的正文', title: '扩写'
    })
    expect(r.toolName).toBe('document_insert')
    expect(r.args.position).toBe('after')
    expect(r.args.originalText).toBe('春天来了')
    expect(r.args.text).toContain('扩写后的正文')
    expect(r.args.confirmed).toBe(true)
    expect(r.args.title).toBe('扩写')
  })

  it('append 无选区 → position=append', () => {
    const r = buildDirectWriteToolArgs({ effectiveDocumentAction: 'append', outputText: 'x' })
    expect(r.args.position).toBe('append')
    expect(r.args.originalText).toBeUndefined()
  })

  it('prepend → position=prepend 且不加多余换行前缀', () => {
    const r = buildDirectWriteToolArgs({ effectiveDocumentAction: 'prepend', outputText: '标题' })
    expect(r.args.position).toBe('prepend')
    expect(r.args.text).toBe('标题')
  })

  it('replace → document_replace(originalText, newText)', () => {
    const r = buildDirectWriteToolArgs({ effectiveDocumentAction: 'replace', inputText: '原文', outputText: '新文' })
    expect(r.toolName).toBe('document_replace')
    expect(r.args.originalText).toBe('原文')
    expect(r.args.newText).toBe('新文')
  })

  it('comment-replace 退化为 replace', () => {
    const r = buildDirectWriteToolArgs({ effectiveDocumentAction: 'comment-replace', inputText: 'a', outputText: 'b' })
    expect(r.toolName).toBe('document_replace')
  })

  it('comment/none/空输出 → null（无 direct 写回）', () => {
    expect(buildDirectWriteToolArgs({ effectiveDocumentAction: 'comment', outputText: 'x' })).toBeNull()
    expect(buildDirectWriteToolArgs({ effectiveDocumentAction: 'none', outputText: 'x' })).toBeNull()
    expect(buildDirectWriteToolArgs({ effectiveDocumentAction: 'insert', outputText: '' })).toBeNull()
  })
})
