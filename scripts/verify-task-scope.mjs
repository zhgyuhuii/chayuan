import { resolveDocumentTaskInputScope } from '../src/utils/documentTaskScope.js'

const cases = [
  { text: '请使用选中的内容扩写', hasSelection: true, hasDocument: true, expected: 'selection' },
  { text: '请使用选中的内容扩写', hasSelection: false, hasDocument: true, expected: 'document' },
  { text: '请按全文来润色', hasSelection: true, hasDocument: true, expected: 'document' },
  { text: '请按全文来润色', hasSelection: true, hasDocument: false, expected: 'selection' },
  { text: '只看我这句话，不要读文档', hasSelection: true, hasDocument: true, expected: 'prompt' },
  { text: '以输入为准，帮我改写', hasSelection: true, hasDocument: true, expected: 'prompt' },
  { text: '优先处理选区，但也参考全文', hasSelection: true, hasDocument: true, expected: 'selection' },
  { text: '优先处理全文，选区仅参考', hasSelection: true, hasDocument: true, expected: 'document' },
  { text: '帮我把这段改得更正式', hasSelection: true, hasDocument: true, expected: 'selection' },
  { text: '帮我把这段改得更正式', hasSelection: false, hasDocument: true, expected: 'document' },
  { text: '帮我总结一下', hasSelection: true, hasDocument: true, expected: 'selection', routeKind: 'document-operation' },
  { text: '帮我总结一下', hasSelection: false, hasDocument: true, expected: 'document', routeKind: 'document-operation' },
  { text: '帮我总结一下', hasSelection: false, hasDocument: false, expected: 'prompt', routeKind: 'document-operation' },
  { text: '按选中来处理，不要全文', hasSelection: true, hasDocument: true, expected: 'selection' },
  { text: '按全文来处理，不要选中', hasSelection: true, hasDocument: true, expected: 'document' }
]

const failed = []
for (const item of cases) {
  const result = resolveDocumentTaskInputScope(item.text, {
    routeKind: item.routeKind || 'document-operation',
    hasSelection: item.hasSelection,
    hasDocument: item.hasDocument
  })
  if (result.resolvedScope !== item.expected) {
    failed.push({
      text: item.text,
      expected: item.expected,
      actual: result.resolvedScope,
      reason: result.reason
    })
  }
}

if (failed.length > 0) {
  console.error('task scope regression failed:')
  failed.forEach((item, idx) => {
    console.error(`${idx + 1}. ${item.text}`)
    console.error(`   expected=${item.expected}, actual=${item.actual}`)
    console.error(`   reason=${item.reason}`)
  })
  process.exit(1)
}

console.log(`task scope regression passed (${cases.length} cases)`)
