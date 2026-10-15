/**
 * 文档会话作用域单测（node 直跑，无构建依赖）：
 *   node scripts/test-doc-scope-adoption.mjs
 *
 * 覆盖（真机缺陷"打开文档历史对话丢失"的修复面）：
 * 1. 三宿主身份载体读写 roundtrip（Writer=Variables / WPP=Tags / ET=Names 公式字面量）
 * 2. resolveDocumentScope 只读性：解析绝不写文档（旧实现在此写身份 → 不保存即漂移）
 * 3. 键优先级：doc_ → path_ → name_ → no_active_document
 * 4. 采纳探针：doc_ 键探 path_ 与 name_ 键；path_ 键探 name_ 键；name_ 与 no_active_document 不探
 * 5. 同文档身份升级判定（busy 期间推迟翻转的依据）
 * 6. 模拟端到端：未保存关闭→重开（身份丢失）→ path_ 键稳定 → 懒嵌身份+保存 →
 *    翻转 doc_ → 采纳探针命中旧 path_ 键 → 历史不丢
 */
import assert from 'node:assert/strict'
import { ensureDocumentChatLinkId, readDocumentChatLinkId } from '../src/utils/documentIdentity.js'
import {
  getActiveHostDocument,
  resolveDocumentScope,
  computeFallbackScopeKeys,
  isSameDocumentScopeChange,
  fnv1a32
} from '../src/utils/chat/docScope.js'

let passed = 0
let chain = Promise.resolve()
function ok(name, fn) {
  chain = chain.then(async () => {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  })
}

// ── 三类宿主的假活动对象 ─────────────────────────────────────────────
function makeWriterDoc({ fullName = '/Users/demo/报告.docx', name = '报告.docx' } = {}) {
  const vars = new Map()
  return {
    FullName: fullName,
    Name: name,
    Variables: {
      Item: (k) => (vars.has(k) ? { Value: vars.get(k) } : null),
      Add: (k, v) => vars.set(k, v)
    },
    _vars: vars
  }
}
function makeEtDoc({ fullName = '/Users/demo/台账.xlsx', name = '台账.xlsx' } = {}) {
  const names = new Map()
  return {
    FullName: fullName,
    Name: name,
    Names: {
      Item: (k) => (names.has(k) ? { Value: names.get(k), RefersTo: names.get(k) } : null),
      // 真机实证：RefersTo 第二参必须字符串字面量公式 '="value"'
      Add: (k, formula) => names.set(k, formula)
    },
    _names: names
  }
}
function makeWppDoc({ fullName = '/Users/demo/汇报.pptx', name = '汇报.pptx' } = {}) {
  const tags = new Map()
  return {
    FullName: fullName,
    Name: name,
    // 真机语义：tag 名大写化（大小写不敏感）；Count 是属性非方法
    Tags: {
      get Count() { return tags.size },
      Item: (k) => {
        const up = String(k).toUpperCase()
        return tags.has(up) ? tags.get(up) : null
      },
      Add: (k, v) => tags.set(String(k).toUpperCase(), v),
      Name: (i) => [...tags.keys()][i - 1],
      Value: (i) => [...tags.values()][i - 1]
    },
    _tags: tags
  }
}

// ── 1. 载体 roundtrip ────────────────────────────────────────────────
console.log('载体 roundtrip（三宿主）')
for (const [label, make] of [['Writer/Variables', makeWriterDoc], ['ET/Names', makeEtDoc], ['WPP/Tags', makeWppDoc]]) {
  ok(`${label}：ensure 写入后可读回且幂等`, () => {
    const doc = make()
    const id1 = ensureDocumentChatLinkId(doc)
    assert.ok(id1 && id1.startsWith('docchat_'), `${label} 应生成身份`)
    assert.equal(readDocumentChatLinkId(doc), id1, `${label} 应读回同一身份`)
    const id2 = ensureDocumentChatLinkId(doc)
    assert.equal(id2, id1, '幂等：已有身份不得重新生成')
  })
}

// ── 2. 只读解析 ──────────────────────────────────────────────────────
console.log('resolveDocumentScope 只读性')
ok('无身份文档：解析不写入任何载体（落到 path_ 稳定键）', () => {
  const doc = makeWriterDoc()
  const scope = resolveDocumentScope(doc)
  assert.equal(scope.source, 'document-path')
  assert.ok(scope.scopeKey.startsWith('path_'), `应落 path_ 键，实际 ${scope.scopeKey}`)
  assert.equal(readDocumentChatLinkId(doc), null, '解析不得写入身份')
  assert.equal(scope.docId, '/Users/demo/报告.docx')
})
ok('有身份文档：解析跟随 doc_ 键', () => {
  const doc = makeWriterDoc()
  const id = ensureDocumentChatLinkId(doc)
  const scope = resolveDocumentScope(doc)
  assert.equal(scope.source, 'document-variable')
  assert.equal(scope.scopeKey, `doc_${id}`)
})
ok('ignoreIdentity：hold 场景回落 path_/name_ 稳定键（身份未落盘前不当锚点）', () => {
  const doc = makeWriterDoc()
  const id = ensureDocumentChatLinkId(doc)
  const held = resolveDocumentScope(doc, { ignoreIdentity: true })
  assert.equal(held.source, 'document-path', '有 FullName 时应回落 path_')
  assert.ok(held.scopeKey.startsWith('path_'))
  assert.equal(held.documentLinkId, '', 'ignoreIdentity 不得泄露身份')
  const unsaved = makeWppDoc({ fullName: '', name: '演示1' })
  ensureDocumentChatLinkId(unsaved)
  const heldUnsaved = resolveDocumentScope(unsaved, { ignoreIdentity: true })
  assert.ok(heldUnsaved.scopeKey.startsWith('name_'), '无 FullName 时应回落 name_')
  assert.equal(heldUnsaved.docId, '演示1')
  assert.ok(id) // 身份仍在文档里，只是解析侧被 hold 压制
})

// ── 3. 键优先级 / 宿主感知 ────────────────────────────────────────────
console.log('键优先级与宿主感知')
ok('三宿主活动对象感知（ActiveDocument/Workbook/Presentation 逐项 try）', () => {
  const wpp = makeWppDoc()
  assert.equal(getActiveHostDocument({ ActivePresentation: wpp }), wpp)
  const et = makeEtDoc()
  assert.equal(getActiveHostDocument({ ActiveWorkbook: et }), et)
  const w = makeWriterDoc()
  assert.equal(getActiveHostDocument({ ActiveDocument: w }), w)
  // 非本宿主属性抛 COM 异常的形态也要能探到
  const hostile = {
    get ActiveDocument() { throw new Error('COM') },
    get ActiveWorkbook() { throw new Error('COM') },
    ActivePresentation: wpp
  }
  assert.equal(getActiveHostDocument(hostile), wpp)
})
ok('无 FullName 的未保存文档落 name_ 键；无活动对象落 no_active_document', () => {
  const unsaved = makeWriterDoc({ fullName: '', name: '文档1' })
  assert.ok(resolveDocumentScope(unsaved).scopeKey.startsWith('name_'))
  assert.equal(resolveDocumentScope(null).scopeKey, 'no_active_document')
})

// ── 4. 采纳探针 ──────────────────────────────────────────────────────
console.log('采纳探针（只向下探）')
const F = '/Users/demo/报告.docx'
const N = '报告.docx'
const F_SUFFIX = 'path_users_demo_docx_' + BigInt(fnv1a32(F.toLowerCase())).toString(36)
const N_SUFFIX = 'name_docx_' + BigInt(fnv1a32(N.toLowerCase())).toString(36)
ok('doc_* 探 [path_*, name_*]（中文文件名带指纹消歧）', () => {
  assert.deepEqual(
    computeFallbackScopeKeys('doc_abc', { fullName: F, name: N }),
    [F_SUFFIX, N_SUFFIX]
  )
})
ok('path_* 只探 name_*（不跨文件上探）', () => {
  assert.deepEqual(
    computeFallbackScopeKeys(F_SUFFIX, { fullName: F, name: N }),
    [N_SUFFIX]
  )
})
ok('name_*/no_active_document 不探任何键', () => {
  assert.deepEqual(computeFallbackScopeKeys(N_SUFFIX, { fullName: F, name: N }), [])
  assert.deepEqual(computeFallbackScopeKeys('no_active_document', { fullName: F, name: N }), [])
})
ok('自身键被剔除', () => {
  const probes = computeFallbackScopeKeys('path_x', { fullName: '', name: '' })
  assert.deepEqual(probes, [])
})
ok('中文文件名不再互相坍缩（同目录不同文档键不同）', () => {
  const a = resolveDocumentScope(makeWriterDoc({ fullName: '/Users/demo/A报告.docx', name: 'A报告.docx' }))
  const b = resolveDocumentScope(makeWriterDoc({ fullName: '/Users/demo/B报告.docx', name: 'B报告.docx' }))
  assert.notEqual(a.scopeKey, b.scopeKey, '不同中文文档必须拿到不同 scope 键（旧实现同为 users_demo_docx）')
})
ok('纯 ASCII 路径键与旧实现逐字节一致（既存数据零迁移）', () => {
  const scope = resolveDocumentScope(makeWriterDoc({ fullName: '/Users/demo/report-final.docx', name: 'report-final.docx' }))
  assert.equal(scope.scopeKey, 'path_users_demo_report-final_docx')
})

// ── 5. 同文档身份升级判定 ─────────────────────────────────────────────
console.log('同文档翻转判定')
ok('docId 相同 = 同文档翻转（path_→doc_ 推迟迁移的依据）', () => {
  assert.equal(isSameDocumentScopeChange({ docId: F }, F), true)
})
ok('docId 不同 = 真切档（维持 busy 清屏防线）', () => {
  assert.equal(isSameDocumentScopeChange({ docId: '/other.docx' }, F), false)
})
ok('任一 docId 缺失 = 不同文档（保守走清屏）', () => {
  assert.equal(isSameDocumentScopeChange({ docId: '' }, F), false)
  assert.equal(isSameDocumentScopeChange({ docId: F }, ''), false)
  assert.equal(isSameDocumentScopeChange(null, F), false)
})

// ── 6. 端到端时间线模拟 ──────────────────────────────────────────────
console.log('端到端：未保存关闭→重开→聊天→保存→重开')
{
  const doc = makeWriterDoc()
  // 第 1 次会话：解析（只读）→ path_ 键稳定；聊天时懒嵌身份；未保存关闭
  const s1 = resolveDocumentScope(doc)
  assert.ok(s1.scopeKey.startsWith('path_'))
  ensureDocumentChatLinkId(doc) // 懒嵌（发消息时刻）
  const memVars = new Map(doc._vars) // 关闭不保存：内存身份丢弃
  doc._vars = memVars // 引用保留但下面重建 doc 模拟重开
  const reopened = makeWriterDoc() // 重开：盘上无身份
  const s2 = resolveDocumentScope(reopened)
  assert.equal(s2.scopeKey, s1.scopeKey, '重开后 path_ 键必须与上次一致（历史跟随）')
  assert.equal(readDocumentChatLinkId(reopened), null, '关闭不保存：盘上身份应已丢失（旧缺陷的根源场景）')
  // 继续聊天→用户保存 → 身份落盘 → 下次解析翻转为 doc_*；旧 path_ 键被采纳探针命中
  ensureDocumentChatLinkId(reopened)
  const s3 = resolveDocumentScope(reopened)
  assert.ok(s3.scopeKey.startsWith('doc_'), '保存后应翻转 doc_ 键')
  assert.deepEqual(
    computeFallbackScopeKeys(s3.scopeKey, { fullName: s3.fullName, name: s3.name })[0],
    s2.scopeKey,
    '翻转后的采纳探针第一个命中的就是旧 path_ 键'
  )
  // 另存/拷贝到新路径：身份随文件 → doc_ 键不变（历史跟随文件）
  const moved = makeWriterDoc({ fullName: '/Users/demo/归档/报告-终稿.docx', name: '报告-终稿.docx' })
  // 拷贝携带盘上身份
  const carried = readDocumentChatLinkId(reopened)
  moved.Variables.Add('chayuan_ai_chat_link_id', carried)
  const s4 = resolveDocumentScope(moved)
  assert.equal(s4.scopeKey, s3.scopeKey, '另存/拷贝后 doc_ 键不变——历史跟随文件')
}

// ── 7. 文件持久层（绕开环回/sidecar/token 的直写层）──────────────────
console.log('文件持久层 historyFileStore')
{
  // 内存假 FileSystem + 假宿主（historyFileStore 全部经 window.Application.FileSystem）
  const files = new Map()
  const norm = (p) => String(p).replace(/\\/g, '/')
  const fsFake = {
    Mkdir: (p) => { dirs.add(norm(p)) },
    writeFileString: (p, content) => { files.set(norm(p), String(content)); return true },
    readFileString: (p) => files.get(norm(p))
  }
  const dirs = new Set()
  globalThis.window = {
    Application: {
      FileSystem: fsFake,
      Env: { GetHomePath: () => '/tmp/fakehome' }
    }
  }
  const { putHistoryFile, fetchHistoryFile, historyFileName, getChatHistoryDir } =
    await import('../src/utils/chat/historyFileStore.js')

  ok('scopeKey 编码为安全文件名（base64url 无特殊字符）', () => {
    const name = historyFileName('path_users_demo_docx_abc123')
    assert.ok(name.endsWith('.json'))
    assert.match(name, /^[A-Za-z0-9_-]+\.json$/, '文件名不得含 / + = 等路径敏感字符')
    assert.equal(historyFileName(''), '')
    assert.equal(historyFileName('x'.repeat(300)), '', '超长 scopeKey 拒绝')
  })
  ok('数据目录落在用户数据根下的 chat-history/', () => {
    const dir = getChatHistoryDir()
    assert.ok(dir.endsWith('chat-history'), `实际 ${dir}`)
    assert.ok(dirs.size >= 0)
  })
  ok('put → fetch roundtrip（内容一致）', async () => {
    putHistoryFile('doc_test1', { historyJson: '[{"id":"c1"}]', currentChatId: 'c1', savedAt: 1000 })
    const got = await fetchHistoryFile('doc_test1')
    assert.equal(got.historyJson, '[{"id":"c1"}]')
    assert.equal(got.currentChatId, 'c1')
    assert.equal(got.savedAt, 1000)
  })
  ok('写序保护：旧 savedAt 拒写', async () => {
    putHistoryFile('doc_test2', { historyJson: '[{"id":"new"}]', savedAt: 2000 })
    putHistoryFile('doc_test2', { historyJson: '[{"id":"old"}]', savedAt: 1000 })
    const got = await fetchHistoryFile('doc_test2')
    assert.equal(got.historyJson, '[{"id":"new"}]', '旧写入不得覆盖新数据')
  })
  ok('墓碑语义：置空后 fetch 返回 null（不复活）', async () => {
    putHistoryFile('doc_test3', { historyJson: '[{"id":"c3"}]', savedAt: 1000 })
    putHistoryFile('doc_test3', { historyJson: '[]', savedAt: 2000 })
    assert.equal(await fetchHistoryFile('doc_test3'), null)
  })
  ok('FileSystem 不可用时全部静默降级（不抛错）', async () => {
    const savedWindow = globalThis.window
    globalThis.window = { Application: {} }
    assert.equal(putHistoryFile('doc_x', { historyJson: '[]' }), false)
    assert.equal(await fetchHistoryFile('doc_x'), null)
    globalThis.window = savedWindow
  })
}

await chain
console.log(`\n全部通过：${passed} 项`)
