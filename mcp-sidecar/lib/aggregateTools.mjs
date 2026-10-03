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
    },
    spreadsheet: {
      status: { method: 'spreadsheet.status', args: rest },
      sheet_list: { method: 'spreadsheet.sheet_list', args: rest },
      sheet_add: { method: 'spreadsheet.sheet_add', args: rest, requireConfirmed: true },
      sheet_rename: { method: 'spreadsheet.sheet_rename', args: rest, requireConfirmed: true },
      sheet_delete: { method: 'spreadsheet.sheet_delete', args: rest, requireConfirmed: true },
      used_range: { method: 'spreadsheet.used_range', args: rest },
      range_read: { method: 'spreadsheet.range_read', args: rest },
      range_write: { method: 'spreadsheet.range_write', args: rest, requireConfirmed: true },
      find: { method: 'spreadsheet.find', args: rest },
      find_replace: { method: 'spreadsheet.find_replace', args: rest, requireConfirmed: true },
      row_insert: { method: 'spreadsheet.row_insert', args: rest, requireConfirmed: true },
      row_delete: { method: 'spreadsheet.row_delete', args: rest, requireConfirmed: true },
      column_insert: { method: 'spreadsheet.column_insert', args: rest, requireConfirmed: true },
      column_delete: { method: 'spreadsheet.column_delete', args: rest, requireConfirmed: true },
      sort: { method: 'spreadsheet.sort', args: rest, requireConfirmed: true },
      autofilter: { method: 'spreadsheet.autofilter', args: rest, requireConfirmed: true },
      format: { method: 'spreadsheet.format', args: rest, requireConfirmed: true },
      chart_add: { method: 'spreadsheet.chart_add', args: rest, requireConfirmed: true },
      chart_list: { method: 'spreadsheet.chart_list', args: rest },
      chart_export: { method: 'spreadsheet.chart_export', args: rest, requireConfirmed: true },
      export: { method: 'spreadsheet.export', args: rest, requireConfirmed: true },
      security_encrypt_save: { method: 'spreadsheet.security_encrypt_save', args: rest, requireConfirmed: true },
      security_decrypt_save: { method: 'spreadsheet.security_decrypt_save', args: rest, requireConfirmed: true }
    },
    presentation: {
      status: { method: 'presentation.status', args: rest },
      slide_list: { method: 'presentation.slide_list', args: rest },
      slide_read: { method: 'presentation.slide_read', args: rest },
      shape_list: { method: 'presentation.shape_list', args: rest },
      slide_add: { method: 'presentation.slide_add', args: rest, requireConfirmed: true },
      slide_delete: { method: 'presentation.slide_delete', args: rest, requireConfirmed: true },
      slide_duplicate: { method: 'presentation.slide_duplicate', args: rest, requireConfirmed: true },
      slide_move: { method: 'presentation.slide_move', args: rest, requireConfirmed: true },
      slide_layout: { method: 'presentation.slide_layout', args: rest, requireConfirmed: true },
      text_replace: { method: 'presentation.text_replace', args: rest, requireConfirmed: true },
      text_set: { method: 'presentation.text_set', args: rest, requireConfirmed: true },
      textbox_add: { method: 'presentation.textbox_add', args: rest, requireConfirmed: true },
      picture_add: { method: 'presentation.picture_add', args: rest, requireConfirmed: true },
      table_add: { method: 'presentation.table_add', args: rest, requireConfirmed: true },
      slideshow_run: { method: 'presentation.slideshow_run', args: rest, requireConfirmed: true },
      export: { method: 'presentation.export', args: rest, requireConfirmed: true },
      slide_export_image: { method: 'presentation.slide_export_image', args: rest, requireConfirmed: true },
      notes_set: { method: 'presentation.notes_set', args: rest, requireConfirmed: true },
      format_uniform: { method: 'presentation.format_uniform', args: rest, requireConfirmed: true },
      svg_add: { method: 'presentation.svg_add', args: rest, requireConfirmed: true },
      security_encrypt_save: { method: 'presentation.security_encrypt_save', args: rest, requireConfirmed: true },
      security_decrypt_save: { method: 'presentation.security_decrypt_save', args: rest, requireConfirmed: true }
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
  'export',
  'spreadsheet',
  'presentation'
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
  }),

  tool({
    name: 'spreadsheet',
    description: [
      'WHAT: WPS 表格(ET/Spreadsheet) domain — operates the ACTIVE WORKBOOK in the WPS Spreadsheets host. status / sheet management (sheet_list|sheet_add|sheet_rename|sheet_delete) / cell IO (used_range|range_read|range_write) / search (find|find_replace) / structure (row_insert|row_delete|column_insert|column_delete) / sort|autofilter / format / charts (chart_add|chart_list|chart_export) / export (pdf|csv).',
      'WHEN: user asks anything about 表格/Excel/工作簿/单元格/sheet/公式/图表 while WPS 表格 is the host, e.g. 「把A1写入姓名」「读取A1:C10」「按B列降序排序」「给表头加底色」「做个柱状图」「导出PDF/CSV」.',
      'NOT: Not for tables inside a Writer document (use table). Not for reading files without WPS. range_write replaces cell values — it does not append; read first, then write.',
      'HOW: Ranges are A1 notation ("A1:C10"). range_write takes values as 2-D array + startCell (default A1); strings starting with "=" are written as formulas. security_encrypt_save/security_decrypt_save: 给当前工作簿设置/移除打开密码并另存（需 confirmed + password，可选 savePath 另存为副本；密码遗忘无法找回，建议先另存副本）。 format takes style {bold,italic,fontSize,fontName,fontColor,bgColor,numberFormat,align,wrapText,border,merge,columnWidth,rowHeight} with hex colors ("#FF0000"). Writes need confirmed=true (preview returned first without it). Large sheets: read in batches (≤50000 cells/call), write in batches (≤5000 cells/call fallback).',
      'EXAMPLE: {"action":"status"} ; {"action":"range_read","range":"A1:C10"} ; {"action":"range_write","startCell":"A1","values":[["姓名","分数"],["张三",90]],"confirmed":true} ; {"action":"sort","range":"A1:C20","keyColumn":2,"order":"desc","header":true,"confirmed":true} ; {"action":"format","range":"A1:C1","style":{"bold":true,"bgColor":"#DDEBF7"},"confirmed":true} ; {"action":"chart_add","dataRange":"A1:B10","type":"column","title":"月度销量","confirmed":true} ; {"action":"export","format":"pdf","path":"/Users/me/Desktop/out.pdf","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['status', 'sheet_list', 'sheet_add', 'sheet_rename', 'sheet_delete', 'used_range', 'range_read', 'range_write', 'find', 'find_replace', 'row_insert', 'row_delete', 'column_insert', 'column_delete', 'sort', 'autofilter', 'format', 'chart_add', 'chart_list', 'chart_export', 'export', 'security_encrypt_save', 'security_decrypt_save'] },
        confirmed: { type: 'boolean' },
        sheet: { type: ['string', 'number'], description: '工作表名称或 1-based 序号；缺省=活动表' },
        range: { type: 'string', description: 'A1 记法区域，如 A1:C10；缺省=UsedRange' },
        startCell: { type: 'string', description: 'range_write 起始单元格（默认 A1）' },
        values: { type: 'array', items: { type: 'array' }, description: 'range_write 二维数组；"=..." 写为公式' },
        asFormula: { type: 'boolean' },
        what: { type: 'string', description: 'find/find_replace 查找内容' },
        replace: { type: 'string', description: 'find_replace 替换为' },
        whole: { type: 'boolean', description: 'find/find_replace 整格匹配（默认部分匹配）' },
        row: { type: 'number' }, col: { type: 'number' }, count: { type: 'number' },
        name: { type: 'string', description: 'sheet_add/sheet_rename 目标名（≤31 字符）' },
        index: { type: 'number', description: 'sheet_add 插入位次 / chart 定位' },
        keyColumn: { type: 'number', description: 'sort 关键列（工作表绝对列号，D 列=4）' },
        order: { type: 'string', enum: ['asc', 'desc'] },
        header: { type: 'boolean', description: 'sort 首行是否表头' },
        field: { type: 'number', description: 'autofilter 列（区域内 1-based）' },
        criteria: { type: 'string' },
        style: {
          type: 'object',
          description: 'format 样式对象',
          properties: {
            bold: { type: 'boolean' }, italic: { type: 'boolean' }, underline: { type: 'boolean' },
            fontSize: { type: 'number' }, fontName: { type: 'string' },
            fontColor: { type: 'string' }, bgColor: { type: 'string' },
            numberFormat: { type: 'string' }, align: { type: 'string', enum: ['left', 'center', 'right'] },
            wrapText: { type: 'boolean' }, border: { type: 'string', enum: ['thin', 'none'] },
            merge: { type: 'boolean' },
            columnWidth: { type: 'number', description: '列宽（字符单位，ET 官方口径）' },
            rowHeight: { type: 'number', description: '行高（磅）' }
          }
        },
        dataRange: { type: 'string', description: 'chart_add 数据区域（A1 记法）' },
        type: { type: 'string', enum: ['column', 'columnStacked', 'bar', 'line', 'pie', 'doughnut', 'scatter', 'area', 'radar'], description: 'chart_add 图表类型（默认 column）' },
        title: { type: 'string' },
        left: { type: 'number' }, top: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' },
        format: { type: 'string', enum: ['pdf', 'csv'], description: 'export 格式；csv 走已用区域序列化' },
        path: { type: 'string', description: '导出/另存绝对路径' },
        password: { type: 'string', description: 'security_encrypt_save 的打开密码（不回显）' }
      }
    }
  }),

  tool({
    name: 'presentation',
    description: [
      'WHAT: WPS 演示(WPP/Presentation) domain — operates the ACTIVE PRESENTATION in the WPS Presentation host. status / slide IO (slide_list|slide_read|slide_add|slide_delete|slide_duplicate|slide_move|slide_layout) / text (text_replace|text_set|textbox_add) / objects (picture_add|table_add|svg_add vector graphics) / notes_set (speaker notes per slide) / format_uniform (unify fonts/sizes/colors across all slides) / slideshow_run / export (pdf|images) / slide_export_image.',
      'WHEN: user asks anything about PPT/幻灯片/演示文稿/slides while WPS 演示 is the host, e.g. 「加一页标题页」「把第2页的错别字改掉」「插入图片」「给每页写演讲备注」「统一字体」「导出PDF」「开始放映」.',
      'NOT: Not for Word documents. Text edits need shapeIndex (slide_read/shape_list first).',
      'HOW: Slides are 1-based. layout names: title|text|twoText|table|chart|titleOnly|blank (or numeric ppLayout). Writes need confirmed=true (preview returned first). notes_set: notes=[{slide,text}] or slide+text. format_uniform: fontName/titleSize/bodySize/color — table shapes are skipped. security_encrypt_save/security_decrypt_save: 给当前演示稿设置/移除打开密码并另存（需 confirmed + password，可选 savePath 另存副本；密码遗忘无法找回）。',
      'EXAMPLE: {"action":"status"} ; {"action":"slide_list"} ; {"action":"slide_add","index":1,"layout":"title","title":"年度总结","content":"2026 年度经营回顾","confirmed":true} ; {"action":"notes_set","notes":[{"slide":1,"text":"开场白：各位领导好"},{"slide":2,"text":"本页强调三个数字"}],"confirmed":true} ; {"action":"format_uniform","fontName":"微软雅黑","titleSize":28,"bodySize":18,"confirmed":true} ; {"action":"export","format":"pdf","path":"/Users/me/Desktop/out.pdf","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['status', 'slide_list', 'slide_read', 'shape_list', 'slide_add', 'slide_delete', 'slide_duplicate', 'slide_move', 'slide_layout', 'text_replace', 'text_set', 'textbox_add', 'picture_add', 'table_add', 'notes_set', 'format_uniform', 'svg_add', 'slideshow_run', 'export', 'slide_export_image', 'security_encrypt_save', 'security_decrypt_save'] },
        confirmed: { type: 'boolean' },
        index: { type: 'number', description: '幻灯片序号（1-based；缺省=最后一页或活动页视 action 而定）' },
        from: { type: 'number' }, to: { type: 'number' },
        layout: { type: 'string', description: '版式名 title|text|twoText|table|chart|titleOnly|blank 或 ppLayout 数字' },
        title: { type: 'string' }, content: { type: 'string' },
        find: { type: 'string' }, replace: { type: 'string' },
        shapeIndex: { type: 'number' }, text: { type: 'string' }, append: { type: 'boolean' },
        password: { type: 'string', description: 'security_encrypt_save 的打开密码（不回显）' },
        savePath: { type: 'string', description: 'security_* 另存路径（缺省=当前文件）' },
        notes: { type: 'array', items: { type: 'object', properties: { slide: { type: 'number' }, text: { type: 'string' } } }, description: 'notes_set 每页备注 [{slide, text}]' },
        svg: { type: 'string', description: 'svg_add 的 SVG 源文本（矢量图形，禁止 script/外链）' },
        fontName: { type: 'string', description: 'format_uniform 统一字体名' },
        titleSize: { type: 'number', description: 'format_uniform 标题字号' },
        bodySize: { type: 'number', description: 'format_uniform 正文字号' },
        fontSize: { type: 'number' }, color: { type: 'string' },
        path: { type: 'string', description: 'picture_add 图片路径 / export 导出路径' },
        rows: { type: 'number' }, cols: { type: 'number' },
        data: { type: 'array', items: { type: 'array' }, description: 'table_add 单元格文本二维数组' },
        format: { type: 'string', enum: ['pdf', 'images'] },
        width: { type: 'number' }, height: { type: 'number' }
      }
    }
  })
]
