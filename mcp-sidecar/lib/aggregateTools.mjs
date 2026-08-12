/**
 * Domain-aggregated MCP tools (action discriminator).
 * Corrects fine-grained P1/P2 sprawl per plans/mcp-tool-architecture.zh-CN.md §11.1
 */
function tool(def) {
  return def
}

/** Old advertised name → { tool, action } for one-release compat in tools/call */
export const LEGACY_TOOL_ALIASES = {
  comment_list: { tool: 'comment', action: 'list' },
  comment_delete: { tool: 'comment', action: 'delete' },
  document_add_comment: { tool: 'comment', action: 'add' },
  revision_mode: { tool: 'revision', action: 'mode' },
  revision_list: { tool: 'revision', action: 'list' },
  revision_apply: { tool: 'revision', action: 'apply' },
  layout_page: { tool: 'layout', action: 'page' },
  layout_columns: { tool: 'layout', action: 'columns' },
  break_insert: { tool: 'layout', action: 'break' },
  page_blank_insert: { tool: 'layout', action: 'blank_page' },
  nav_location: { tool: 'nav', action: 'location' },
  nav_outline: { tool: 'nav', action: 'outline' },
  nav_pane_set: { tool: 'nav', action: 'pane_set' },
  toc_insert: { tool: 'toc', action: 'insert' },
  toc_update: { tool: 'toc', action: 'update' },
  bookmark_list: { tool: 'bookmark', action: 'list' },
  bookmark_goto: { tool: 'bookmark', action: 'goto' },
  table_insert: { tool: 'table', action: 'insert' },
  image_list: { tool: 'image', action: 'list' },
  image_insert: { tool: 'image', action: 'insert' },
  image_delete: { tool: 'image', action: 'delete' },
  image_export: { tool: 'image', action: 'export' },
  hyperlink_list: { tool: 'hyperlink', action: 'list' },
  hyperlink_add: { tool: 'hyperlink', action: 'add' },
  hyperlink_delete: { tool: 'hyperlink', action: 'delete' },
  headerfooter_get: { tool: 'headerfooter', action: 'get' },
  headerfooter_set: { tool: 'headerfooter', action: 'set' },
  watermark_set: { tool: 'watermark', action: 'set' },
  watermark_clear: { tool: 'watermark', action: 'clear' },
  style_list: { tool: 'style', action: 'list' },
  style_apply: { tool: 'style', action: 'apply' },
  style_audit: { tool: 'style', action: 'audit' },
  document_export: { tool: 'export', action: 'file' }
}

/** Names removed from tools/list after aggregation */
export const REPLACED_FINE_GRAINED = new Set(Object.keys(LEGACY_TOOL_ALIASES))

/**
 * Agent method + optional arg reshape for each domain action.
 * Returns { method, args } for agentHub.callAgent
 */
export function resolveAggregateCall(toolName, args = {}) {
  const action = String(args.action || '').trim()
  if (!action) {
    const err = new Error(`${toolName} requires action`)
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const rest = { ...args }
  delete rest.action

  const table = {
    comment: {
      list: { method: 'comment.list', args: rest },
      add: {
        method: 'document.add_comment',
        args: rest,
        requireConfirmed: true
      },
      delete: { method: 'comment.delete', args: rest, requireConfirmed: true }
    },
    revision: {
      mode: { method: 'revision.mode', args: rest },
      list: { method: 'revision.list', args: rest },
      apply: {
        method: 'revision.apply',
        requireConfirmed: true,
        args: (() => {
          const a = { ...rest }
          const op = a.op || a.revisionOp || a.acceptReject
          delete a.op
          delete a.revisionOp
          delete a.acceptReject
          return { ...a, action: op || 'accept' }
        })()
      }
    },
    layout: {
      page: { method: 'layout.page', args: rest, requireConfirmed: true },
      columns: { method: 'layout.columns', args: rest, requireConfirmed: true },
      break: { method: 'break.insert', args: { kind: rest.kind || 'page', ...rest }, requireConfirmed: true },
      blank_page: { method: 'page.blank_insert', args: rest, requireConfirmed: true }
    },
    nav: {
      location: { method: 'nav.location', args: rest },
      outline: { method: 'nav.outline', args: rest },
      pane_set: { method: 'nav.pane_set', args: rest }
    },
    toc: {
      insert: { method: 'toc.insert', args: rest, requireConfirmed: true },
      update: { method: 'toc.update', args: rest, requireConfirmed: true }
    },
    bookmark: {
      list: { method: 'bookmark.list', args: rest },
      goto: { method: 'bookmark.goto', args: rest }
    },
    table: {
      insert: { method: 'table.insert', args: rest, requireConfirmed: true },
      list: { method: 'table.list', args: rest },
      header_read: { method: 'table.header_read', args: rest },
      row_read: { method: 'table.row_read', args: rest },
      column_read: { method: 'table.column_read', args: rest },
      cell_read: { method: 'table.cell_read', args: rest },
      header_repeat: { method: 'table.header_repeat', args: rest, requireConfirmed: true },
      column_set_width: { method: 'table.column_set_width', args: rest, requireConfirmed: true },
      export: { method: 'table.export', args: rest },
      row_insert: { method: 'table.row_insert', args: rest, requireConfirmed: true },
      column_insert: { method: 'table.column_insert', args: rest, requireConfirmed: true },
      cell_merge: { method: 'table.cell_merge', args: rest, requireConfirmed: true }
    },
    caption: {
      list: { method: 'caption.list', args: rest }
    },
    field: {
      list: { method: 'field.list', args: rest },
      add: { method: 'field.add', args: rest, requireConfirmed: true }
    },
    image: {
      list: { method: 'image.list', args: rest },
      insert: { method: 'image.insert', args: rest, requireConfirmed: true },
      delete: { method: 'image.delete', args: rest, requireConfirmed: true },
      export: { method: 'image.export', args: rest, requireConfirmed: true }
    },
    hyperlink: {
      list: { method: 'hyperlink.list', args: rest },
      add: { method: 'hyperlink.add', args: rest, requireConfirmed: true },
      delete: { method: 'hyperlink.delete', args: rest, requireConfirmed: true }
    },
    headerfooter: {
      get: { method: 'headerfooter.get', args: rest },
      set: { method: 'headerfooter.set', args: rest, requireConfirmed: true }
    },
    watermark: {
      set: { method: 'watermark.set', args: rest, requireConfirmed: true },
      clear: { method: 'watermark.clear', args: rest, requireConfirmed: true }
    },
    style: {
      list: { method: 'style.list', args: rest },
      apply: { method: 'style.apply', args: rest, requireConfirmed: true },
      audit: {
        method: 'style.audit',
        // style_audit used action=stats|unused|purge_unused — map to nested auditAction
        args: {
          ...rest,
          action: rest.auditAction || rest.styleAction || rest.mode || 'stats'
        }
      }
    },
    export: {
      file: { method: 'document.export', args: rest, requireConfirmed: true }
    }
  }

  const domain = table[toolName]
  if (!domain) {
    const err = new Error(`Unknown aggregate tool: ${toolName}`)
    err.code = 'TOOL_NOT_FOUND'
    throw err
  }
  const spec = domain[action]
  if (!spec) {
    const err = new Error(`${toolName}: unsupported action "${action}". Use one of: ${Object.keys(domain).join('|')}`)
    err.code = 'INVALID_PARAMS'
    throw err
  }
  return { ...spec, domain: toolName, action }
}

export const AGGREGATE_TOOL_NAMES = [
  'comment',
  'revision',
  'layout',
  'nav',
  'toc',
  'bookmark',
  'table',
  'caption',
  'field',
  'image',
  'hyperlink',
  'headerfooter',
  'watermark',
  'style',
  'export'
]

export const AGGREGATE_TOOLS = [
  tool({
    name: 'comment',
    description: [
      'WHAT: Domain tool for comments — list / add / delete.',
      'WHEN: 「有哪些批注」「加批注」「删批注」.',
      'NOT: Not for wording (document_replace). Not proofread batch (proofread_apply_comments).',
      'HOW: action=list|add|delete. add/delete need confirmed=true. add: text+originalText; delete: index|originalText|all.',
      'EXAMPLE: {"action":"add","text":"实现了MCP工具-comment","originalText":"妈妈","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'delete'] },
        confirmed: { type: 'boolean' },
        text: { type: 'string' },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        hintStart: { type: 'number' },
        index: { type: 'number' },
        all: { type: 'boolean' },
        author: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'revision',
    description: [
      'WHAT: Track-changes domain — mode / list / apply(accept|reject).',
      'WHEN: 「打开修订」「列出修订」「全部接受」.',
      'HOW: action=mode|list|apply. mode needs enabled; apply needs action accept|reject + confirmed + scope.',
      'EXAMPLE: {"action":"mode","enabled":true} ; {"action":"apply","op":"accept","scope":"all","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['mode', 'list', 'apply'] },
        confirmed: { type: 'boolean' },
        enabled: { type: 'boolean' },
        show: { type: 'boolean' },
        limit: { type: 'number' },
        // apply: prefer op to avoid clashing with domain action; also accept legacy "accept" field via handler reshape
        op: { type: 'string', enum: ['accept', 'reject'] },
        scope: { type: 'string', enum: ['all', 'ids'] },
        ids: { type: 'array', items: { type: 'string' } }
      }
    }
  }),

  tool({
    name: 'layout',
    description: [
      'WHAT: Page structure domain — paper/margins, columns, breaks, blank page.',
      'WHEN: 「横向」「两栏」「分页符」「空白页」.',
      'NOT: Not paragraph align (format_para). Not TOC (toc).',
      'HOW: action=page|columns|break|blank_page. Writes need confirmed=true.',
      'EXAMPLE: {"action":"columns","count":2,"confirmed":true} ; {"action":"break","kind":"page","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['page', 'columns', 'break', 'blank_page'] },
        confirmed: { type: 'boolean' },
        orientation: { type: 'string', enum: ['portrait', 'landscape'] },
        marginTop: { type: 'number' },
        marginBottom: { type: 'number' },
        marginLeft: { type: 'number' },
        marginRight: { type: 'number' },
        count: { type: 'number' },
        lineBetween: { type: 'boolean' },
        spacing: { type: 'number' },
        kind: { type: 'string', enum: ['page', 'section', 'column'] },
        originalText: { type: 'string' },
        position: { type: 'string' }
      }
    }
  }),

  tool({
    name: 'nav',
    description: [
      'WHAT: Navigation domain — page/line location, heading outline, nav pane UI.',
      'WHEN: 「第几页」「文档大纲」「打开导航窗格」.',
      'HOW: action=location|outline|pane_set.',
      'EXAMPLE: {"action":"outline","maxLevel":3} ; {"action":"pane_set","visible":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['location', 'outline', 'pane_set'] },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        scope: { type: 'string' },
        maxLevel: { type: 'number' },
        limit: { type: 'number' },
        visible: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'toc',
    description: [
      'WHAT: Table-of-contents domain — insert / update field.',
      'WHEN: 「插入目录」「更新目录」.',
      'NOT: Do not type a fake TOC with document_insert. Prefer style.apply Heading first.',
      'HOW: action=insert|update; confirmed=true.',
      'EXAMPLE: {"action":"insert","title":"目录","confirmed":true,"originalText":"第一章","position":"before"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['insert', 'update'] },
        confirmed: { type: 'boolean' },
        title: { type: 'string' },
        upperLevel: { type: 'number' },
        lowerLevel: { type: 'number' },
        originalText: { type: 'string' },
        position: { type: 'string', enum: ['before', 'after'] },
        index: { type: 'number' },
        includePageNumbers: { type: 'boolean' },
        useHyperlinks: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'bookmark',
    description: [
      'WHAT: Bookmarks domain — list / goto.',
      'WHEN: 「有哪些书签」「跳到书签」.',
      'HOW: action=list|goto.',
      'EXAMPLE: {"action":"goto","name":"字段_1"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'goto'] },
        limit: { type: 'number' },
        query: { type: 'string' },
        name: { type: 'string' },
        index: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'table',
    description: [
      'WHAT: Tables domain — discover & read slices (list/header/row/column/cell), structure writes (header_repeat/column_set_width/row_insert/column_insert/cell_merge), serialize (export), insert.',
      'WHEN: 「列出表格」「读表头」「看第N行/第N列」「读某个单元格」「表头重复」「统一列宽」「在某行前/后插入行」「在某列前/后插入列」「合并单元格(行/列)」「导出表格为CSV/Markdown」「插入表格」.',
      'NOT: Not page columns (layout action=columns). No judgement here — continuity/quality checks are done by you (LLM) after reading. export returns serialized DATA (md/csv/json), it does NOT write files. row_insert/column_insert take an EXPLICIT anchor row/col (YOU locate "where" via header_read/column_read); cell_merge takes explicit row1/col1/row2/col2 corners.',
      'HOW: action=list|header_read|row_read|column_read|cell_read|export (read-only, no confirmed) | header_repeat|column_set_width|insert|row_insert|column_insert|cell_merge (confirmed). Reads take tableIndex (1-based, from list); row_read/column_read/cell_read take row/col.',
      'COMPOSE: change a cell → cell_read for range → document_replace(start,end). bold/red header → header_read for range → format_run(start,end). header style → header_read for range → style(action=apply). uniform column widths → list for cols → you compute width → column_set_width(allCols=true). insert row/col "where user said" → header_read/column_read to find the anchor index → row_insert(row,where)|column_insert(col,where). merge cells → cell_merge(row1,col1,row2,col2) — same row merges across columns, same col merges across rows.',
      'EXAMPLE: {"action":"list","limit":50} ; {"action":"header_read","tableIndex":1} ; {"action":"cell_read","tableIndex":1,"row":2,"col":3} ; {"action":"row_insert","tableIndex":1,"row":2,"where":"after","count":1,"confirmed":true} ; {"action":"column_insert","tableIndex":1,"col":3,"where":"after","confirmed":true} ; {"action":"cell_merge","tableIndex":1,"row1":1,"col1":1,"row2":1,"col2":2,"confirmed":true} ; {"action":"header_repeat","tableIndex":1,"repeat":true,"confirmed":true} ; {"action":"column_set_width","tableIndex":1,"allCols":true,"widthPt":72,"confirmed":true} ; {"action":"export","format":"md","limit":20} ; {"action":"insert","rows":3,"columns":4,"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['insert', 'list', 'header_read', 'row_read', 'column_read', 'cell_read', 'header_repeat', 'column_set_width', 'export', 'row_insert', 'column_insert', 'cell_merge'] },
        confirmed: { type: 'boolean' },
        rows: { type: 'number' },
        columns: { type: 'number' },
        originalText: { type: 'string' },
        pageNumber: { type: 'number' },
        tableIndex: { type: 'number', description: '1-based table index from table.list' },
        row: { type: 'number', description: '1-based row index (row_read/cell_read anchor, or row_insert anchor)' },
        col: { type: 'number', description: '1-based column index (column_read/cell_read anchor, or column_insert anchor)' },
        count: { type: 'number', description: 'row_insert/column_insert: how many rows/columns to insert (default 1)' },
        where: { type: 'string', enum: ['before', 'after'], description: 'row_insert/column_insert: insert before|after the anchor row/col (default after)' },
        row1: { type: 'number', description: 'cell_merge: top row of merge rectangle (1-based)' },
        col1: { type: 'number', description: 'cell_merge: left col of merge rectangle (1-based)' },
        row2: { type: 'number', description: 'cell_merge: bottom row of merge rectangle (1-based)' },
        col2: { type: 'number', description: 'cell_merge: right col of merge rectangle (1-based)' },
        repeat: { type: 'boolean', description: 'header_repeat: true=repeat header row on each page (default true)' },
        widthPt: { type: 'number', description: 'column_set_width: column width in points (>0)' },
        allCols: { type: 'boolean', description: 'column_set_width: apply to all columns instead of a single col' },
        format: { type: 'string', enum: ['md', 'csv', 'json'], description: 'export: serialized table format' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'caption',
    description: [
      'WHAT: Caption (题注) domain — read-only enumeration of 图/表/式 caption facts.',
      'WHEN: 「列出所有图题注/表题注/公式编号」「有哪些题注」.',
      'NOT: This only RETURNS caption facts (kind, numberText, fullText, isSeqField, range). Continuity / gaps / numbering correctness / label consistency are judged BY YOU (LLM) — do not expect this tool to give a verdict. No renumber action.',
      'HOW: action=list; kind=图|表|式|all (default all); optional limit. numberText is best-effort parsed — gaps judged by you.',
      'EXAMPLE: {"action":"list"} ; {"action":"list","kind":"图","limit":200}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list'] },
        kind: { type: 'string', enum: ['图', '表', '式', 'all'], description: 'filter caption kind (default all)' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'field',
    description: [
      'WHAT: Domain (域) domain — enumerate fields (list) and construct SEQ/TOC fields (add).',
      'WHEN: 「文档里有哪些域/字段」「插入一个自动编号SEQ域/插入TOC目录域」.',
      'NOT: list is read-only. add only constructs SEQ (auto-numbering caption) or TOC field codes — it is the唯一 entry for field-based captioning; plain caption text still uses document_insert+format_para. No field-judgement action.',
      'HOW: action=list (type=SEQ|TOC|PAGEREF|DATE|all) | add (kind=seq|toc, label?, upperLevel?/lowerLevel? for toc, confirmed). add degrades to plain text if the host lacks Fields.Add and returns how:"seq"|"toc"|"plain".',
      'EXAMPLE: {"action":"list","type":"SEQ"} ; {"action":"add","kind":"seq","label":"图","confirmed":true} ; {"action":"add","kind":"toc","upperLevel":1,"lowerLevel":3,"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'add'] },
        confirmed: { type: 'boolean' },
        type: { type: 'string', description: 'list: filter by field type (SEQ/TOC/PAGEREF/DATE or all)' },
        kind: { type: 'string', enum: ['seq', 'toc'], description: 'add: field kind to construct' },
        label: { type: 'string', description: 'add seq: caption label name (e.g. 图/表); add toc: fallback title' },
        upperLevel: { type: 'number', description: 'add toc: top outline level (default 1)' },
        lowerLevel: { type: 'number', description: 'add toc: bottom outline level (default 3)' },
        originalText: { type: 'string' },
        position: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'image',
    description: [
      'WHAT: Pictures domain — list / insert / delete / export.',
      'WHEN: 「有几张图」「插入图片」「删图」「导出图片」.',
      'HOW: action=list|insert|delete|export. Writes need confirmed=true.',
      'EXAMPLE: {"action":"insert","path":"C:\\\\a.png","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'insert', 'delete', 'export'] },
        confirmed: { type: 'boolean' },
        path: { type: 'string' },
        folder: { type: 'string' },
        index: { type: 'number' },
        kind: { type: 'string', enum: ['inline', 'floating'] },
        all: { type: 'boolean' },
        originalText: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'hyperlink',
    description: [
      'WHAT: Hyperlinks domain — list / add / delete.',
      'WHEN: 「有哪些链接」「加超链接」「删链接」.',
      'HOW: action=list|add|delete. add needs address+confirmed.',
      'EXAMPLE: {"action":"add","address":"https://aidooo.com","text":"察元","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'delete'] },
        confirmed: { type: 'boolean' },
        address: { type: 'string' },
        text: { type: 'string' },
        originalText: { type: 'string' },
        subAddress: { type: 'string' },
        index: { type: 'number' },
        all: { type: 'boolean' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'headerfooter',
    description: [
      'WHAT: Header/footer domain — get / set.',
      'WHEN: 「页眉是什么」「设置页脚」.',
      'HOW: action=get|set. set needs confirmed=true.',
      'EXAMPLE: {"action":"set","header":"内部资料","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['get', 'set'] },
        confirmed: { type: 'boolean' },
        section: { type: 'number' },
        which: { type: 'string', enum: ['header', 'footer', 'both'] },
        header: { type: 'string' },
        footer: { type: 'string' }
      }
    }
  }),

  tool({
    name: 'watermark',
    description: [
      'WHAT: Watermark domain — set / clear (Chayuan-tagged header shapes).',
      'WHEN: 「加水印」「去掉水印」.',
      'HOW: action=set|clear; confirmed=true.',
      'EXAMPLE: {"action":"set","text":"机密","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['set', 'clear'] },
        confirmed: { type: 'boolean' },
        text: { type: 'string' },
        rotation: { type: 'number' },
        fontSize: { type: 'number' },
        all: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'style',
    description: [
      'WHAT: Styles domain — list / apply / audit(stats|unused|purge_unused).',
      'WHEN: 「有哪些样式」「设为标题1」「清理未用样式」.',
      'NOT: Mere bold → format_run. Wording → document_replace.',
      'HOW: action=list|apply|audit. apply/purge need confirmed. For audit use auditAction=stats|unused|purge_unused.',
      'EXAMPLE: {"action":"apply","styleName":"标题 1","originalText":"第一章","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'apply', 'audit'] },
        confirmed: { type: 'boolean' },
        styleName: { type: 'string' },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        scope: { type: 'string' },
        headingOnly: { type: 'boolean' },
        query: { type: 'string' },
        limit: { type: 'number' },
        auditAction: { type: 'string', enum: ['stats', 'unused', 'purge_unused'] }
      }
    }
  }),

  tool({
    name: 'export',
    description: [
      'WHAT: Export active document to a path (docx/pdf).',
      'WHEN: 「导出PDF」「另存为」.',
      'NOT: In-place save → document_save.',
      'HOW: action=file; format=docx|pdf; path; confirmed=true.',
      'EXAMPLE: {"action":"file","format":"pdf","path":"C:\\\\Users\\\\me\\\\Desktop\\\\out.pdf","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'path', 'confirmed'],
      properties: {
        action: { type: 'string', enum: ['file'] },
        path: { type: 'string' },
        format: { type: 'string', enum: ['docx', 'pdf', 'doc'] },
        confirmed: { type: 'boolean' }
      }
    }
  })
]
