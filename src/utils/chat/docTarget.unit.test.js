/**
 * docTarget 回归锁定（2026-11-21 写通道全灭根因）：hostKind const 重赋值曾让
 * resolveBoundDocument 在缺省 host 时抛 'Assignment to constant variable'，
 * dispatch 写门全部写操作连预览一起炸。本文件在无 window 的纯 node 环境跑——
 * 任何「未定义引用/常量重赋值」都会在这里现形，不再漏到真机。
 */
import { describe, it, expect } from 'vitest'
import { resolveBoundDocument, enumerateHostDocuments, normalizeDocTargetKey } from './docTarget.js'

describe('resolveBoundDocument（无 window 环境）', () => {
  it('host 缺省（dispatch 门不传 host 的生产形态）→ 不抛错，优雅 DOC_NOT_OPEN', () => {
    expect(() => resolveBoundDocument({ docId: '文字文稿1' })).not.toThrow()
    const r = resolveBoundDocument({ docId: '文字文稿1' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('DOC_NOT_OPEN')
  })

  it('带 docLinkId pin 且 host 缺省 → 同样不抛错', () => {
    expect(() => resolveBoundDocument({ docLinkId: 'docchat_x', docId: '/tmp/a.docx' })).not.toThrow()
    expect(resolveBoundDocument({ docLinkId: 'docchat_x' }).code).toBe('DOC_NOT_OPEN')
  })

  it('空 pin → DOC_NOT_OPEN（未绑定语义）', () => {
    const r = resolveBoundDocument({})
    expect(r.ok).toBe(false)
    expect(r.message).toContain('未绑定')
  })

  it('enumerateHostDocuments 无 Application → 空数组不抛错（带/不带身份开关）', () => {
    expect(enumerateHostDocuments(null, 'wps')).toEqual([])
    expect(enumerateHostDocuments(null, 'wps', { withIdentity: true })).toEqual([])
  })

  it('normalizeDocTargetKey：大小写/尾斜杠归一', () => {
    expect(normalizeDocTargetKey('/Users/X/Doc.DOCX/')).toBe('/users/x/doc.docx')
    expect(normalizeDocTargetKey('')).toBe('')
  })
})
