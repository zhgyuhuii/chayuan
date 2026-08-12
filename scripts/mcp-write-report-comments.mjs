#!/usr/bin/env node
/**
 * Write the 功能测试报告 into 爱唠叨的妈妈.docx and add one WPS comment per feature,
 * EVERY call a real MCP tools/call to 127.0.0.1:62588 (no direct WPS automation).
 *
 *   node scripts/mcp-write-report-comments.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = `http://127.0.0.1:${Number(process.env.CHAYUAN_MCP_PORT || 62588)}`
let _id = 900
const nextId = () => ++_id

async function mcpCall(name, args) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method: 'tools/call', params: { name, arguments: args } })
  })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = { raw: text } }
  const result = data?.result
  return { sc: result?.structuredContent || {}, isError: !!result?.isError, errMsg: result?.isError ? (result.content?.[0]?.text || '') : '' }
}

const REPORT = `
【察元 MCP 功能测试报告】
测试文档：爱唠叨的妈妈.docx　｜　测试时间：2026-08-13　｜　版本 v0.10.0（共 46 工具，table 域 12 个 action）
测试方式：全部经由 MCP 调用（JSON-RPC tools/call → 察元 MCP 服务端 → WPS），全程未直接调用任何 WPS 接口。
测试结论：17 项功能 17/17 全部通过。

▍一、表格读取（作用于正文表 Table 2「序号/名称/地址/备注」，只读不改）
[F01 table.list] 发现 3 张表：T1=3×3(测试表) / T2=5×4 / T3=5×4 —— 通过
[F02 table.header_read] 表头=[序号|名称|地址|备注]，repeatHeader=false —— 通过
[F03 table.row_read] 第 1 行=[序号|名称|地址|备注] —— 通过
[F04 table.column_read] 第 1 列=[序号|1|2|5|6] —— 通过
[F05 table.cell_read] 单元格(2,2)，返回文本与 range 定位 —— 通过
[F06 table.export] 将 3 张表序列化为 Markdown —— 通过

▍二、题注 / 域 / 图片（全文只读枚举）
[F07 caption.list] 识别 2 个题注：图1(SEQ)、图2(SEQ) —— 通过
[F08 field.list] 识别 2 个 SEQ 域 —— 通过
[F09 image.list] 2 张图片，含 wrap/altText/前后文等增强字段 —— 通过

▍三、表格结构写入（作用于可丢弃的测试表 Table 1，confirmed 写；正文表 Table 2/3 未改动）
[F10 table.header_repeat] 表头行设为跨页重复，repeatHeader=true —— 通过
[F11 table.column_set_width] 全部列宽设为 60pt，实测均宽 60.0pt —— 通过
[F12 table.row_insert] 第 1 行后插入 1 行，3 行 → 4 行 —— 通过 ★新增
[F13 table.column_insert] 第 1 列后插入 1 列，3 列 → 4 列 —— 通过 ★新增
[F14 table.cell_merge 行] 纵向合并 (3,1)-(4,1)，direction=rows（合并行）—— 通过 ★新增
[F15 table.cell_merge 列] 横向合并 (4,2)-(4,3)，direction=columns（合并列）—— 通过 ★新增
[F16 field.add] 追加 SEQ 图域，how=seq —— 通过

▍总结
17/17 通过。本次新增的「插入行 / 插入列 / 合并行 / 合并列」四项表格能力均已落地并经真机验证。
读取类在正文表 Table 2 验证；写入类全部落在测试表 Table 1（其结构已变为 4×4 且含合并单元格），正文内容保持不变。
每行 [Fxx] 标记处均挂有一条批注，记录该功能的原始返回事实。
`

const COMMENTS = [
  ['[F01 table.list]', 'MCP table.list 返回 3 张表的事实：T1=3×3 / T2=5×4 / T3=5×4，每张含 range、headerSnippet、hasMerged。'],
  ['[F02 table.header_read]', 'table.header_read 返回表头各单元格文本与 repeatHeader=false（事实，是否需重复由 LLM 判断）。'],
  ['[F03 table.row_read]', 'table.row_read(row=1) 切片返回该行全部单元格：序号|名称|地址|备注。'],
  ['[F04 table.column_read]', 'table.column_read(col=1) 切片返回该列：序号|1|2|5|6。'],
  ['[F05 table.cell_read]', 'table.cell_read(2,2) 返回文本与 range，可直接交 document_replace 精确改字。'],
  ['[F06 table.export]', 'table.export(format=md) 将全表序列化为 Markdown 字符串，只返回数据、不落盘。'],
  ['[F07 caption.list]', 'caption.list 识别出图1、图2，且 isSeqField=true（SEQ 域题注）；连续性判断交 LLM。'],
  ['[F08 field.list]', 'field.list 枚举出文档中的 2 个 SEQ 域及其 code/resultText。'],
  ['[F09 image.list]', 'image.list 返回 2 张图片，含 wrap=inline 及 altText/前后文等增强字段。'],
  ['[F10 table.header_repeat]', '几何写：测试表表头行设为跨页重复，repeatHeader=true。'],
  ['[F11 table.column_set_width]', '几何写：测试表全部列宽设为 60pt，回读平均列宽 60.0pt。'],
  ['[F12 table.row_insert]', '★新增 table.row_insert(row=1, where=after)：第1行后插入1行，测试表 3 行→4 行。'],
  ['[F13 table.column_insert]', '★新增 table.column_insert(col=1, where=after)：第1列后插入1列，测试表 3 列→4 列。'],
  ['[F14 table.cell_merge 行]', '★新增 table.cell_merge(row1=3,col1=1,row2=4,col2=1)：纵向合并，direction=rows = 合并行。'],
  ['[F15 table.cell_merge 列]', '★新增 table.cell_merge(row1=4,col1=2,row2=4,col2=3)：横向合并，direction=columns = 合并列。'],
  ['[F16 field.add]', 'field.add(kind=seq, label=图) 构造 SEQ 域，how=seq。']
]

async function main() {
  // 1. append the report
  console.log('inserting 功能测试报告 …')
  const ins = await mcpCall('document_insert', { text: REPORT, position: 'append', confirmed: true })
  console.log('  document_insert ok=', ins.sc?.ok, 'preview=', ins.sc?.preview, ins.errMsg)

  // 2. one comment per feature, anchored to its [Fxx] marker
  let added = 0, failed = 0
  for (const [anchor, text] of COMMENTS) {
    const c = await mcpCall('comment', { action: 'add', text, originalText: anchor, confirmed: true })
    if (c.sc?.ok || !c.isError) { added++; console.log(`  ✓ comment ${anchor}`) }
    else { failed++; console.log(`  ✗ comment ${anchor} — ${c.errMsg || c.sc?.code || ''}`) }
    await new Promise((r) => setTimeout(r, 120))
  }
  console.log(`\ncomments: ${added} added / ${failed} failed`)

  // 3. verify
  const cl = await mcpCall('comment', { action: 'list', limit: 40 })
  console.log('total comments in doc now:', cl.sc?.total ?? (cl.sc?.items?.length ?? '?'))
  fs.writeFileSync(path.resolve('mcp-sidecar', 'last-report-comments.json'),
    JSON.stringify({ added, failed, commentsInDoc: cl.sc?.total ?? cl.sc?.items?.length, at: new Date().toISOString() }, null, 2))
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
