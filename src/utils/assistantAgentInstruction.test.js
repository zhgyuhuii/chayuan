/**
 * 助手 agent instruction 编译器回归锁定（A-1）
 * 覆盖：documentAction→写工具契约映射、{{input}} 渲染、内联阈值分流、宿主落点、none 不写回
 */
import { describe, it, expect } from 'vitest'
import {
  buildAssistantAgentInstruction,
  renderPromptTemplate,
  extractOutputBody,
  INLINE_INPUT_LIMIT
} from './assistantAgentInstruction.js'

describe('renderPromptTemplate', () => {
  it('{{input}} 占位替换', () => {
    expect(renderPromptTemplate('扩写以下内容：{{input}}', '你好')).toBe('扩写以下内容：你好')
  })
  it('无占位模板原样返回', () => {
    expect(renderPromptTemplate('把内容翻译成英文', 'hi')).toBe('把内容翻译成英文')
  })
  it('空模板回退 {{input}}', () => {
    expect(renderPromptTemplate('', 'hi')).toBe('hi')
  })
})

describe('buildAssistantAgentInstruction 写回契约', () => {
  it('insert → document_insert 契约 + 防误用提示', () => {
    const r = buildAssistantAgentInstruction({
      label: '扩写', userPromptTemplate: '扩写：{{input}}', inputText: '短正文',
      inputSource: 'selection', hasSelection: true, effectiveDocumentAction: 'insert'
    })
    expect(r.expectWrite).toBe(true)
    expect(r.expectedWriteTools).toEqual(['document_insert', 'document_apply_ops'])
    expect(r.instruction).toContain('chayuan__document_insert')
    expect(r.instruction).toContain('严禁用 document_replace')
    expect(r.instruction).toContain('扩写：')
    expect(r.instruction).toContain('短正文')
  })

  it('replace → document_replace 契约（含 locate 语义）', () => {
    const r = buildAssistantAgentInstruction({ effectiveDocumentAction: 'replace', inputText: 'x' })
    expect(r.expectedWriteTools).toEqual(['document_replace', 'document_apply_ops'])
    expect(r.instruction).toContain('document_locate')
  })

  it('none → 不写回', () => {
    const r = buildAssistantAgentInstruction({ effectiveDocumentAction: 'none', inputText: 'q' })
    expect(r.expectWrite).toBe(false)
    expect(r.expectedWriteTools).toEqual([])
    expect(r.instruction).not.toContain('写回契约')
  })

  it('append → position=append 落点', () => {
    const r = buildAssistantAgentInstruction({ effectiveDocumentAction: 'append', inputText: 'x' })
    expect(r.expectedWriteTools).toEqual(['document_insert', 'document_apply_ops'])
    expect(r.instruction).toContain('position=append')
  })
})

describe('输入分流', () => {
  it('短选区内联原文', () => {
    const r = buildAssistantAgentInstruction({
      inputText: '选区内容', inputSource: 'selection', hasSelection: true, effectiveDocumentAction: 'insert'
    })
    expect(r.instruction).toContain('<input>')
    expect(r.instruction).toContain('选区内容')
    expect(r.instruction).not.toContain('原文较长')
  })

  it('超阈值全文不内联 → 自读指令', () => {
    const long = 'x'.repeat(INLINE_INPUT_LIMIT + 1)
    const r = buildAssistantAgentInstruction({
      inputText: long, inputSource: 'document', inputLength: long.length, effectiveDocumentAction: 'replace'
    })
    expect(r.instruction).not.toContain('<input>')
    expect(r.instruction).toContain('document_chunks')
    expect(r.instruction).toContain('约')
  })

  it('inputText 为空但 inputLength 大（全文场景由 agent 自读）', () => {
    const r = buildAssistantAgentInstruction({
      inputText: '', inputSource: 'document', inputLength: 50000, effectiveDocumentAction: 'replace'
    })
    expect(r.instruction).toContain('document_meta')
  })

  it('宿主感知落点（et → spreadsheet 工具提示）', () => {
    const r = buildAssistantAgentInstruction({
      inputText: '', inputSource: 'document', inputLength: 50000,
      effectiveDocumentAction: 'replace', host: 'et'
    })
    expect(r.instruction).toContain('spreadsheet')
    expect(r.instruction).not.toContain('document_chunks')
  })
})

describe('extractOutputBody（direct 轨输出纯度）', () => {
  it('守约模型：标记间正文提取', () => {
    expect(extractOutputBody('【OUTPUT】润色后的正文【/OUTPUT】')).toBe('润色后的正文')
  })
  it('未闭合标记：取标记后全部', () => {
    expect(extractOutputBody('【OUTPUT】只有开头')).toBe('只有开头')
  })
  it('未守约模型：无标记原样返回', () => {
    expect(extractOutputBody('直接输出的正文')).toBe('直接输出的正文')
  })
  it('前后噪音剥离', () => {
    expect(extractOutputBody('好的，以下是正式化版本：\n【OUTPUT】\n正文\n【/OUTPUT】\n希望有帮助')).toBe('正文')
  })
})

describe('extractOutputBody 模型自创标签剥离', () => {
  it('<body_default> 包裹剥离（真机案例）', () => {
    expect(extractOutputBody('<body_default> 润色后的正文 </body_default>')).toBe('润色后的正文')
  })
  it('OUTPUT 标记内嵌 body_default 双层剥离', () => {
    expect(extractOutputBody('【OUTPUT】<body_default>正文</body_default>【/OUTPUT】')).toBe('正文')
  })
  it('其它常见伪标签（answer/output）剥离', () => {
    expect(extractOutputBody('<answer>内容X</answer>')).toBe('内容X')
    expect(extractOutputBody('<output>内容Y</output>')).toBe('内容Y')
  })
  it('正文含合法尖括号文本不误剥（非标签形态）', () => {
    expect(extractOutputBody('比较 a < b 与 c > d 的情况')).toBe('比较 a < b 与 c > d 的情况')
  })
})
