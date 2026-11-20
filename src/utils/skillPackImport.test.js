/**
 * skillPackImport 规则测试：md / zip / folder 三路径 + 安全用例
 * （收割自 chayuan-office skills-store 的导入规则回归锁定）
 */
import { describe, it, expect } from 'vitest'
import {
  parsePackFromMdBytes,
  parsePackFromZipBytes,
  parsePackFromDirFiles,
  MAX_IMPORT_BYTES
} from './skillPackImport.js'

const enc = new TextEncoder()
const mdOk = enc.encode(
  '---\nname: demo-skill\ndescription: 测试技能\ncategory: office\n---\n\n正文内容。'
)

describe('parsePackFromMdBytes', () => {
  it('正常导入：名称/正文/单条目', () => {
    const r = parsePackFromMdBytes('demo-skill.md', mdOk)
    expect(r.ok).toBe(true)
    expect(r.pack.name).toBe('demo-skill')
    expect(r.pack.body).toContain('正文内容')
    expect(r.pack.entries).toHaveLength(1)
    expect(r.pack.entries[0].path).toBe('SKILL.md')
  })
  it('无 frontmatter 拒绝', () => {
    const r = parsePackFromMdBytes('bad.md', enc.encode('没有 frontmatter'))
    expect(r.ok).toBe(false)
    expect(r.message).toContain('frontmatter')
  })
  it('导入上限口径 = 10240MB（10GB，2026-11-21 用户指定）；超限拦截由 File.size 预检承担', () => {
    expect(MAX_IMPORT_BYTES).toBe(10240 * 1024 * 1024)
  })
})

describe('parsePackFromZipBytes', () => {
  const makeZip = async (build) => {
    const JSZip = (await import('jszip')).default
    const z = new JSZip()
    build(z)
    return z.generateAsync({ type: 'uint8array' })
  }
  it('根 SKILL.md + 附属文件随包保留', async () => {
    const b = await makeZip((z) => {
      z.file('SKILL.md', mdOk)
      z.file('assets/tpl.xlsx', enc.encode('x'))
    })
    const r = await parsePackFromZipBytes('demo-skill.zip', b)
    expect(r.ok).toBe(true)
    expect(r.pack.entries).toHaveLength(2)
    expect(r.pack.body).toContain('正文内容')
  })
  it('恰一个顶层文件夹：文件夹名作技能名', async () => {
    const b = await makeZip((z) => {
      z.folder('demo-skill').file('SKILL.md', mdOk)
    })
    const r = await parsePackFromZipBytes('whatever.zip', b)
    expect(r.ok).toBe(true)
    expect(r.pack.name).toBe('demo-skill')
  })
  it('无 SKILL.md 拒绝', async () => {
    const b = await makeZip((z) => {
      z.file('other/readme.md', enc.encode('x'))
    })
    const r = await parsePackFromZipBytes('x.zip', b)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('SKILL.md')
  })
  it('__MACOSX 忽略', async () => {
    const b = await makeZip((z) => {
      z.folder('__MACOSX').file('junk', enc.encode('x'))
      z.file('SKILL.md', mdOk)
    })
    const r = await parsePackFromZipBytes('x.zip', b)
    expect(r.ok).toBe(true)
  })
  it('.. 条目拒绝（dir 路径覆盖同一 checkEntryNames 分支）', () => {
    const r = parsePackFromDirFiles([{ relativePath: '../x/SKILL.md', bytes: mdOk }])
    expect(r.ok).toBe(false)
    expect(r.message).toContain('不安全')
  })
  it('__MACOSX 忽略', async () => {
    const b = await makeZip((z) => {
      z.folder('__MACOSX').file('junk', enc.encode('x'))
      z.file('SKILL.md', mdOk)
    })
    const r = await parsePackFromZipBytes('x.zip', b)
    expect(r.ok).toBe(true)
  })
})

describe('parsePackFromDirFiles', () => {
  it('一层文件夹导入', () => {
    const r = parsePackFromDirFiles([
      { relativePath: 'my-pack/SKILL.md', bytes: mdOk },
      { relativePath: 'my-pack/data/t.csv', bytes: enc.encode('a,b') }
    ])
    expect(r.ok).toBe(true)
    expect(r.pack.name).toBe('my-pack')
    expect(r.pack.entries).toHaveLength(2)
  })
  it('根 SKILL.md + 附属目录照收（office 同语义）', () => {
    const r = parsePackFromDirFiles([
      { relativePath: 'SKILL.md', bytes: mdOk },
      { relativePath: 'helper/notes.md', bytes: enc.encode('x') }
    ])
    expect(r.ok).toBe(true)
    expect(r.pack.entries).toHaveLength(2)
  })
  it('绝对路径拒绝', () => {
    const r = parsePackFromDirFiles([{ relativePath: '/abs/SKILL.md', bytes: mdOk }])
    expect(r.ok).toBe(false)
    expect(r.message).toContain('不安全')
  })
})
