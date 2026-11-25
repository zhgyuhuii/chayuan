/**
 * 文档写锁 OCC 基线语义回归锁定（2026-11-21 扩写「活动文档已切换」误报修复）：
 * 1. 助手任务启动时刷新匿名槽基线（executeAssistantTask），杜绝继承 chat 回合的陈旧基线
 * 2. docId 变化但内容指纹一致（未保存文档被保存）→ 放行，不再误报「活动文档已切换」
 * 3. 内容真被改动（指纹变化）→ 仍拦下（OCC 本意不变）
 */
import { describe, it, expect, beforeEach } from 'vitest'

/** 可控的假 WPS 文档环境：docId 与内容文本均可注入变化 */
function installFakeWps({ docId = '文档1', text = '初始正文' } = {}) {
  const doc = {
    get FullName() { return state.fullName },
    get Name() { return state.name },
    Content: { get Text() { return state.text } },
    Paragraphs: { get Count() { return state.paraCount } }
  }
  const state = {
    fullName: '',
    name: docId,
    text,
    paraCount: 3
  }
  globalThis.window = { Application: { ActiveDocument: doc, ActiveWorkbook: null, ActivePresentation: null } }
  return state
}

const { setWriteBaseline, getWriteBaseline, withDocumentWriteLock } = await import('./documentWriteLock.js')

const write = (label) => withDocumentWriteLock({ label }, async () => 'written').promise

beforeEach(() => {
  // 匿名槽是模块级状态：每个用例重置并重装假 WPS 环境
  globalThis.window = undefined
  // 动态 import 的模块级 baselines Map 通过重新 setWriteBaseline 覆盖即可
})

describe('OCC 基线：匿名槽语义', () => {
  it('基线后文档无变化 → 写回成功', async () => {
    installFakeWps()
    setWriteBaseline()
    await expect(write('t1')).resolves.toBe('written')
  })

  it('继承陈旧基线（先 A 后切 B，不刷新基线）→ 拦下（旧行为保留，证明拦截语义仍有效）', async () => {
    const state = installFakeWps({ docId: '文档A' })
    setWriteBaseline()
    // 切到另一篇内容不同的文档
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '完全不同的内容'
    state.paraCount = 9
    await expect(write('t2')).rejects.toThrow(/活动文档已切换/)
  })

  it('任务启动刷新基线（修后语义：B 环境重新 setWriteBaseline）→ 写回成功', async () => {
    const state = installFakeWps({ docId: '文档A' })
    setWriteBaseline()
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '完全不同的内容'
    state.paraCount = 9
    // executeAssistantTask 启动时做的事：以当前文档重新记录基线
    setWriteBaseline()
    await expect(write('t3')).resolves.toBe('written')
  })

  it('未保存文档被保存（docId 变、内容指纹不变）→ 放行，不再误报', async () => {
    const state = installFakeWps({ docId: '文档1', text: '同一份正文' })
    setWriteBaseline()
    // 任务运行期间用户 ⌘S：FullName 出现、Name 不再是兜底依据，内容一字未动
    state.fullName = '/Users/x/文档1.docx'
    await expect(write('t4')).resolves.toBe('written')
  })

  it('docId 变且内容也变（真切到另一篇文档）→ 仍拦下', async () => {
    const state = installFakeWps({ docId: '文档1', text: '同一份正文' })
    setWriteBaseline()
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '另一篇文档的正文'
    state.paraCount = 7
    await expect(write('t5')).rejects.toThrow(/活动文档已切换/)
  })

  it('内容被手动编辑（指纹变）→ 拦下要求重读', async () => {
    const state = installFakeWps({ docId: '文档1', text: '原始正文' })
    setWriteBaseline()
    state.text = '原始正文+用户手动加的一句'
    await expect(write('t6')).rejects.toThrow(/已被修改/)
  })
})

describe('baselineToken=null 与 occAdvisory（2026-11-21 派发写误报修复）', () => {
  it('baselineToken=null：环境任意漂移（docId+内容全变）→ OCC 显式跳过，写回成功', async () => {
    const state = installFakeWps({ docId: '文档A', text: 'A 的内容' })
    setWriteBaseline()
    // 跨 webview 直写语义：基线表不可达，null 必须穿透到 OCC 闸门（不能被 String() 吞成匿名槽）
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '完全另一篇'
    state.paraCount = 11
    const w = withDocumentWriteLock({ label: 'null-token', baselineToken: null }, async () => 'written')
    await expect(w.promise).resolves.toBe('written')
  })

  it('baselineToken=null：不滚匿名槽（写后匿名槽基线保持原值）', async () => {
    const state = installFakeWps({ docId: '文档A', text: 'A 的内容' })
    setWriteBaseline()
    const before = getWriteBaseline() // 匿名槽
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '完全另一篇'
    const w = withDocumentWriteLock({ label: 'null-token-no-roll', baselineToken: null }, async () => 'written')
    await w.promise
    const after = getWriteBaseline()
    expect(after.fp).toBe(before.fp)
    expect(after.docId).toBe(before.docId)
  })

  it('occAdvisory=true：OCC 判败也放行（MCP 派发写降级语义）', async () => {
    const state = installFakeWps({ docId: '文档A', text: 'A 的内容' })
    setWriteBaseline(undefined, undefined, 'turn-token-1')
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '完全另一篇'
    state.paraCount = 11
    const w = withDocumentWriteLock({ label: 'advisory', baselineToken: 'turn-token-1', occAdvisory: true }, async () => 'written')
    await expect(w.promise).resolves.toBe('written')
  })

  it('带 token 且不带 advisory（本地直调链路）：环境漂移仍硬拦（OCC 本意不降级）', async () => {
    const state = installFakeWps({ docId: '文档A', text: 'A 的内容' })
    setWriteBaseline(undefined, undefined, 'turn-token-2')
    state.name = '文档B'
    state.fullName = '/Users/x/文档B.docx'
    state.text = '完全另一篇'
    state.paraCount = 11
    const w = withDocumentWriteLock({ label: 'hard', baselineToken: 'turn-token-2' }, async () => 'written')
    await expect(w.promise).rejects.toThrow(/活动文档已切换|已被修改/)
  })
})
