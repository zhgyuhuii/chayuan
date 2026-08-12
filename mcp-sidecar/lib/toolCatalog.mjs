/**
 * MCP tool catalog optimized for LLM tool-selection.
 *
 * Description template (keep under ~900 chars each):
 *   1) WHAT — domain outcome
 *   2) WHEN — Chinese/English user trigger phrases
 *   3) NOT  — wrong tool / common mistakes
 *   4) HOW  — key args + confirmation rules
 *   5) EXAMPLE — minimal JSON args
 *
 * Annotations follow MCP 2025-03-26 hints (advisory for clients).
 *
 * Architecture: domain-aggregated tools + action (see aggregateTools.mjs).
 * Fine-grained P1/P2 names are not advertised; legacy aliases still resolve in tools/call.
 */

import {
  AGGREGATE_TOOLS,
  REPLACED_FINE_GRAINED
} from './aggregateTools.mjs'

function tool(def) {
  return def
}

export const SERVER_INFO = { name: 'chayuan-wps-mcp', version: '0.10.0' }

export const SERVER_INSTRUCTIONS = [
  'You are connected to 察元 WPS MCP. End users speak natural Chinese/English only — they never name tools.',
  'Architecture: prefer DOMAIN tools with action=… (comment/revision/layout/nav/toc/bookmark/table/image/hyperlink/headerfooter/watermark/style/export). Do not invent fine-grained tool names.',
  'Map intent → tools yourself using each tool description (WHEN / NOT / EXAMPLE). Prefer resource chayuan://guide/tool-routing for layer routing.',
  'Division of labor: YOU (the LLM) reason, translate, rewrite, decide; WPS Agent only reads/locates/writes/exports.',
  'Layer order: wps_* → document_* (read/locate/words/lifecycle/switch) → format_run|format_para|format_apply_ops → style(action) → comment|revision → layout|nav|toc|bookmark → table|caption|field|image|hyperlink|headerfooter|watermark|export → proofread_*/declassify_*/kb_*/assistants_*.',
  'Destructive writes need confirmed=true after preview (confirmed=false or omit).',
  'Never confuse replace with format: 改错别字 → document_replace / document_apply_ops; 加粗变色字号 → format_run; 对齐行距 → format_para; 标题样式 → style action=apply.',
  'Multi-span edits: one format_apply_ops or document_apply_ops — never N×(locate+single write).',
  'For「翻译每一段并插到段后」: document_list_paragraphs → translate yourself → document_apply_ops(insert-after) from last paragraph upward.',
  'Switch docs: document_list_open then document_activate (query/name/path).',
  'If the user cannot see the document window, prefer document_open with viaOs=true and force=true; check ui fields in the response.',
  'Read resource chayuan://guide/user-intents or prompt para_translate_insert_after when unsure.'
].join(' ')

const CORE_TOOLS = [
  tool({
    name: 'wps_status',
    description: [
      'WHAT: Return layered health — sidecar, Agent online flag, active document name/path, and whether a visible WPS window title matches that document.',
      'WHEN user asks: 「WPS连上了吗」「现在打开的是哪个文件」「能不能操作文档」「agent online?」「is the doc visible?」. Call this first before document writes if unsure.',
      'NOT: Does not open files (use document_open) and does not start WPS (use wps_launch).',
      'RETURNS: agent.agentOnline, document.*, ui.visibleWpsWindows, ui.warning when Agent says open but UI title missing (background Preview/-Embedding).',
      'EXAMPLE: {}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  }),

  tool({
    name: 'wps_launch',
    description: [
      'WHAT: Start WPS Writer via OS process and wait until the 察元 Agent connects.',
      'WHEN: 「启动WPS」「打开WPS软件」「agent offline / 先把WPS拉起来」. Use when wps_status.agentOnline is false.',
      'NOT: Does not open a specific .docx path (after launch use document_open). Not for reading document text.',
      'HOW: Optional waitAgentMs (default 20000, clamp 3000–120000).',
      'EXAMPLE: {"waitAgentMs":20000}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        waitAgentMs: {
          type: 'number',
          description: 'Milliseconds to wait for Agent heartbeat. Default 20000. Example: 20000'
        }
      }
    }
  }),

  tool({
    name: 'document_open',
    description: [
      'WHAT: Open a local Word/WPS file so it becomes the active document in a user-visible window.',
      'WHEN: 「用WPS打开…」「打开桌面\\工作文档\\年度战略规划报告.docx」「open this file in WPS」. Always prefer absolute Windows paths.',
      'NOT: Do not use fs_read / read_file for .docx binary. Do not assume alreadyOpen means the user can see it — check ui.documentVisibleInWindowTitle.',
      'HOW: Default viaOs=true (shell/wps.exe /wps) to avoid headless Preview/-Embedding hosts; force=true re-opens even if Agent reports alreadyOpen; activate=true brings window forward.',
      'EXAMPLE: {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\工作文档\\\\年度战略规划报告.docx","viaOs":true,"force":true,"activate":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description: 'Absolute local file path. Example: C:\\Users\\me\\Desktop\\工作文档\\年度战略规划报告.docx'
        },
        activate: {
          type: 'boolean',
          description: 'Default true. Activate/show document after open.'
        },
        viaOs: {
          type: 'boolean',
          description: 'Default true. Open via OS/wps.exe so a real window appears (recommended).'
        },
        force: {
          type: 'boolean',
          description: 'Default false. true = OS-open again even when Agent alreadyOpen (use when UI not visible).'
        }
      }
    }
  }),

  tool({
    name: 'document_ensure_open',
    description: [
      'WHAT: No-op if ActiveDocument already matches path; otherwise open that path.',
      'WHEN: Pipeline guard before edits — 「确保年度战略规划报告是当前文档」.',
      'NOT: Prefer document_open(viaOs/force) when the user reports they cannot see the window. To switch among already-open docs use document_activate.',
      'EXAMPLE: {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\工作文档\\\\年度战略规划报告.docx"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: { type: 'string', description: 'Absolute path that must be the active document.' }
      }
    }
  }),

  tool({
    name: 'document_list_open',
    description: [
      'WHAT: List documents currently open in this WPS instance (name/path/active flag).',
      'WHEN: 「现在开了几个文档」「有哪些窗口」「list open docs」 before switching.',
      'NOT: Does not open files (document_open). Does not switch (document_activate).',
      'EXAMPLE: {} or {"query":"妈妈"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Optional filter on name/path substring.' }
      }
    }
  }),

  tool({
    name: 'document_activate',
    description: [
      'WHAT: Switch the active editing document among already-open WPS windows/docs.',
      'WHEN: 「切换到爱唠叨的妈妈」「编辑另一个文档」「activate 合同.docx」「把当前文档切到xxx」.',
      'NOT: Prefer this over re-opening when the file is already open. Use document_open/document_ensure_open to open from disk. Use document_list_open if unsure which titles exist.',
      'HOW: Pass name (file name), path (full path), query (fuzzy title), or index (1-based from list_open). openIfMissing=true + path will Open if not already loaded.',
      'EXAMPLE: {"query":"爱唠叨的妈妈"} or {"name":"合同.docx"} or {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\a.docx"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Document Name, e.g. 爱唠叨的妈妈.docx' },
        path: { type: 'string', description: 'Absolute FullName path.' },
        query: { type: 'string', description: 'Fuzzy match against open doc titles/paths.' },
        title: { type: 'string', description: 'Alias of query.' },
        index: { type: 'number', description: '1-based index from document_list_open.' },
        openIfMissing: {
          type: 'boolean',
          description: 'If true and path given but not open, Documents.Open then activate.'
        }
      }
    }
  }),

  tool({
    name: 'document_meta',
    description: [
      'WHAT: Lightweight metadata — name, charCount, paragraphCount, recommendChunks.',
      'WHEN: 「这篇有多长」「多少段」「要不要分段读」 before choosing get_text vs chunks/list_paragraphs.',
      'NOT: Does not return body text. For body use document_get_text / document_chunks / document_list_paragraphs.',
      'EXAMPLE: {}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chunkLength: { type: 'number', description: 'Optional chunk size hint for estimates. Typical 1200–4000.' },
        overlapLength: { type: 'number', description: 'Optional overlap for estimates. Typical 80–200.' }
      }
    }
  }),

  tool({
    name: 'document_list_paragraphs',
    description: [
      'WHAT: List paragraph texts with WPS start/end anchors (paginated). Best entry for per-paragraph workflows.',
      'WHEN user says: 「每一段」「逐段」「翻译每一段并把译文放到段落后面」「逐段润色/改写后插在段后」「for each paragraph translate and insert after」.',
      'NOT: You (the LLM) must produce translations/rewrites — this tool only lists paragraphs. Do not dump whole novel via document_get_text then guess offsets.',
      'HOW: cursor is 1-based paragraph index; limit default 40 max 120; skipEmpty default true. Then write with document_apply_ops(action=insert-after) or document_insert(position=after), preferably last→first.',
      'EXAMPLE: {"cursor":1,"limit":40,"skipEmpty":true}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cursor: { type: 'number', description: '1-based paragraph index to start from. Default 1. Example: 1' },
        limit: { type: 'number', description: 'Page size 1–120. Default 40.' },
        skipEmpty: { type: 'boolean', description: 'Default true. Skip empty paragraphs.' }
      }
    }
  }),

  tool({
    name: 'document_chunks',
    description: [
      'WHAT: Page through long documents as text chunks with start/end anchors (not necessarily one paragraph each).',
      'WHEN: 「很长的文档」「分段读」「百万字」「document too large」 or document_meta.recommendChunks=true / charCount>~80k.',
      'NOT: For explicit paragraph tasks (translate each paragraph) prefer document_list_paragraphs. Do not force document_get_text on huge docs.',
      'HOW: cursor=chunkIndex from 0; limit 1–8 (default 2); follow nextCursor until hasMore=false.',
      'EXAMPLE: {"cursor":0,"limit":2,"chunkLength":1200,"overlapLength":80}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cursor: { type: 'number', description: 'chunkIndex, 0-based. Default 0.' },
        limit: { type: 'number', description: 'Chunks per page, 1–8. Default 2.' },
        chunkLength: { type: 'number', description: 'Target chars per chunk. Example: 1200' },
        overlapLength: { type: 'number', description: 'Overlap chars between chunks. Example: 80' },
        scope: { type: 'string', enum: ['document', 'selection'], description: 'Default document.' }
      }
    }
  }),

  tool({
    name: 'document_get_text',
    description: [
      'WHAT: Return plain text of the active document or selection (short/medium docs).',
      'WHEN: 「读一下全文」「看看文档内容」「summarize this short doc」 and meta shows modest size.',
      'NOT: Over ~80k chars returns DOCUMENT_TOO_LARGE unless force=true (discouraged). Prefer document_chunks or document_list_paragraphs for long/per-paragraph work.',
      'EXAMPLE: {"scope":"document"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string', enum: ['document', 'selection'], description: 'Default document.' },
        force: { type: 'boolean', description: 'Allow oversized full-text pull. Default false. Avoid when possible.' }
      }
    }
  }),

  tool({
    name: 'document_locate',
    description: [
      'WHAT: Find occurrences of a phrase; return start/end matches for anchoring writes/comments.',
      'WHEN: 「找到这句话」「定位某词」「where is … in the doc」 before replace/comment/insert.',
      'NOT: Not a semantic search. For listing all paragraphs use document_list_paragraphs.',
      'EXAMPLE: {"text":"执行摘要","hintStart":0,"maxMatches":5}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Exact or near-exact phrase to find. Prefer a distinctive substring.' },
        hintStart: { type: 'number', description: 'Search hint offset. Default 0.' },
        maxMatches: { type: 'number', description: 'Max matches to return, up to 50. Default 20.' }
      }
    }
  }),

  tool({
    name: 'document_replace',
    description: [
      'WHAT: Replace an anchored span of text in the active document.',
      'WHEN: 「把A改成B」「替换错别字」「replace this sentence」.',
      'NOT: Not for changing bold/color/size (use format_run). Not for alignment/line-spacing (format_para). Not for heading styles (style_apply). For inserting translations after a paragraph use document_insert(position=after) or document_apply_ops(insert-after), not replace.',
      'HOW: Call once with confirmed=false for preview; then confirmed=true to commit. Anchor with originalText and/or start/end.',
      'EXAMPLE: {"originalText":"永鹅","newText":"咏鹅","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        originalText: { type: 'string', description: 'Expected live text to replace (recommended).' },
        newText: { type: 'string', description: 'Replacement text.' },
        start: { type: 'number', description: 'Optional absolute start.' },
        end: { type: 'number', description: 'Optional absolute end.' },
        hintStart: { type: 'number', description: 'Locate hint when using originalText.' },
        confirmed: { type: 'boolean', description: 'false/omit=preview only; true=write.' }
      }
    }
  }),

  tool({
    name: 'document_insert',
    description: [
      'WHAT: Insert text relative to an anchor or document ends.',
      'WHEN: 「插到这段后面」「加在文末」「prepend」「translate this paragraph and put English right after it」.',
      'NOT: Do not append all translations at document end when user asked per-paragraph after each block — use position=after per paragraph (or apply_ops insert-after).',
      'HOW: position=after|before|append|prepend|insert. For after-paragraph: originalText=<paragraph>, text=<new content>, confirmed=true. Preview with confirmed=false first. When editing many paragraphs, apply from bottom to top.',
      'EXAMPLE: {"text":"\\nSpring has come…","position":"after","originalText":"春天来了，河边的柳树抽出了嫩芽。","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Text to insert. Often prefix with \\n for a new paragraph.' },
        position: {
          type: 'string',
          enum: ['insert', 'before', 'after', 'append', 'prepend', 'insert-after'],
          description: 'after=after anchored paragraph/range; append=document end; before/prepend=before anchor/start.'
        },
        originalText: { type: 'string', description: 'Anchor paragraph/snippet for after/before.' },
        start: { type: 'number', description: 'Optional absolute start of anchor.' },
        end: { type: 'number', description: 'Optional absolute end of anchor.' },
        confirmed: { type: 'boolean', description: 'false/omit=preview; true=write.' }
      }
    }
  }),

  tool({
    name: 'document_add_comment',
    description: [
      'WHAT: Add a WPS comment anchored to text or a range.',
      'WHEN: 「加批注」「标注敏感信息」「comment on this sentence」.',
      'NOT: Does not change body text (use document_replace for wording). Does not set bold/color (format_run). For proofread batch comments prefer proofread_apply_comments after proofread_run. Prefer comment_list first when user asks what comments already exist.',
      'HOW: confirmed must be true. Anchor with originalText and/or start/end/hintStart.',
      'EXAMPLE: {"text":"【涉密】疑似身份证号","originalText":"412724198012084832","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['text', 'confirmed'],
      properties: {
        text: { type: 'string', description: 'Comment body shown in WPS.' },
        confirmed: { type: 'boolean', description: 'Must be true to write the comment.' },
        originalText: { type: 'string', description: 'Anchor text in the document.' },
        start: { type: 'number' },
        end: { type: 'number' },
        hintStart: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'document_apply_ops',
    description: [
      'WHAT: Batch writebacks with one action for many anchored operations.',
      'WHEN: 「每一段翻译后插到段落后面」「批量替换」「batch insert-after / replace / comment」 after you prepared per-item outputs.',
      'NOT: This tool does not translate — fill outputText yourself. Prefer this over N round-trips when you already have all paragraph translations.',
      'HOW: action=insert-after|replace|comment|comment-replace. operations[{start,end,originalText,outputText}]. confirmed=false preview; true commit. insert-after applies safely from higher offsets.',
      'EXAMPLE: {"action":"insert-after","confirmed":true,"operations":[{"start":0,"end":18,"originalText":"春天来了，河边的柳树抽出了嫩芽。","outputText":"Spring has come; the willow trees by the river have sprouted tender buds."}]}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['operations'],
      properties: {
        action: {
          type: 'string',
          enum: ['replace', 'comment', 'comment-replace', 'insert-after'],
          description: 'insert-after = put outputText after each anchored paragraph/range.'
        },
        operations: {
          type: 'array',
          description: 'Up to 200 ops. Each should include originalText and outputText; start/end strongly recommended.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              start: { type: 'number' },
              end: { type: 'number' },
              originalText: { type: 'string' },
              outputText: { type: 'string', description: 'New text / translation / replacement body.' },
              expectedText: { type: 'string' },
              commentText: { type: 'string' }
            }
          }
        },
        confirmed: { type: 'boolean', description: 'false/omit=preview; true=write all ops.' },
        title: { type: 'string', description: 'Optional undo/title label.' }
      }
    }
  }),

  tool({
    name: 'document_new',
    description: [
      'WHAT: Create a blank document, or open templatePath as a new working copy.',
      'WHEN: 「新建文档」「从模板开一份」 before writing sample content.',
      'NOT: Does not save to a path (use document_save).',
      'EXAMPLE: {} or {"templatePath":"C:\\\\Templates\\\\blank.dotx"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        templatePath: { type: 'string', description: 'Optional local template/doc path.' }
      }
    }
  }),

  tool({
    name: 'document_save',
    description: [
      'WHAT: Save the active document; optional path to Save-As.',
      'WHEN: 「保存」「另存为」 after edits.',
      'NOT: Does not export PDF.',
      'EXAMPLE: {} or {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\out.docx"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Optional Save-As absolute path.' }
      }
    }
  }),

  tool({
    name: 'declassify_status',
    description: [
      'WHAT: Query whether the active document is in a declassified/redacted state.',
      'WHEN: 「脱密了吗」「能不能还原」.',
      'NOT: Does not perform declassification (use declassify_preview/apply).',
      'EXAMPLE: {}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  }),

  tool({
    name: 'declassify_preview',
    description: [
      'WHAT: Build a redaction preview map from client-supplied keywords (no document write).',
      'WHEN: 「先预览脱密结果」「these PII terms should be masked」 after you detected terms.',
      'NOT: You must supply keywords[{term,category,riskLevel}]; tool does not invent detections alone.',
      'EXAMPLE: {"keywords":[{"term":"张辉","category":"人名","riskLevel":"high"}]}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['keywords'],
      properties: {
        keywords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              category: { type: 'string' },
              riskLevel: { type: 'string' }
            }
          }
        },
        text: { type: 'string', description: 'Optional text override; default uses active document.' }
      }
    }
  }),

  tool({
    name: 'declassify_apply',
    description: [
      'WHAT: Apply irreversible-until-restore redaction to the document.',
      'WHEN: User explicitly confirms declassification with a password after preview.',
      'NOT: Never invent a password. Requires confirmed=true, password, keywords.',
      'EXAMPLE: {"confirmed":true,"password":"****","keywords":[{"term":"13283825889","category":"手机号","riskLevel":"high"}]}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed', 'password', 'keywords'],
      properties: {
        confirmed: { type: 'boolean', description: 'Must be true.' },
        password: { type: 'string', description: 'User-provided restore password (do not log).' },
        keywords: { type: 'array', items: { type: 'object' } }
      }
    }
  }),

  tool({
    name: 'declassify_restore',
    description: [
      'WHAT: Restore a previously declassified document using the password.',
      'WHEN: 「还原脱密」「undo redaction」 with the correct password.',
      'NOT: Without the password this fails — do not brute force.',
      'EXAMPLE: {"confirmed":true,"password":"****"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed', 'password'],
      properties: {
        confirmed: { type: 'boolean', description: 'Must be true.' },
        password: { type: 'string', description: 'Password set at declassify_apply time.' }
      }
    }
  }),

  tool({
    name: 'kb_retrieve',
    description: [
      'WHAT: Retrieve knowledge-base snippets for you to reason over (retrieval only).',
      'WHEN: 「根据知识库核对」「查一下资料再改文档」.',
      'NOT: Does not write the document. You synthesize the answer, then use insert/replace/comment tools if needed.',
      'EXAMPLE: {"query":"物业费诉讼时效三年如何起算","topK":5}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Natural-language retrieval query.' },
        kbNames: { type: 'array', items: { type: 'string' }, description: 'Optional KB name filter.' },
        kuIds: { type: 'array', items: { type: 'string' } },
        topK: { type: 'number', description: 'Default 5.' },
        connectionId: { type: 'string' },
        binding: { type: 'object', description: 'Optional explicit KB binding object.' }
      }
    }
  }),

  tool({
    name: 'proofread_run',
    description: [
      'WHAT: Run typo/grammar proofreading on the active document; default dryRun returns issues only.',
      'WHEN: 「校对」「错别字检查」「proofread」「找语法问题」.',
      'NOT: dryRun=true does not write comments — follow with proofread_apply_comments. Not a general translator.',
      'HOW: Prefer dryRun=true then apply_comments. Avoid dryRun=false unless confirmed=true.',
      'EXAMPLE: {"dryRun":true,"scope":"document","mode":"assistant"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: ['assistant', 'model'], description: 'Default assistant.' },
        dryRun: { type: 'boolean', description: 'Default true — issues only, no comments written.' },
        scope: { type: 'string', enum: ['document', 'selection'] },
        confirmed: {
          type: 'boolean',
          description: 'Only relevant when dryRun=false; must be true to write while running.'
        }
      }
    }
  }),

  tool({
    name: 'proofread_apply_comments',
    description: [
      'WHAT: Turn issues from a prior proofread_run(dryRun) into WPS comments.',
      'WHEN: After proofread_run, user says 「写成批注」「apply the proofread results」.',
      'NOT: Requires taskId from proofread_run. confirmed must be true.',
      'EXAMPLE: {"taskId":"<from proofread_run>","confirmed":true,"maxComments":30}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['taskId', 'confirmed'],
      properties: {
        taskId: { type: 'string', description: 'Task id returned by proofread_run.' },
        confirmed: { type: 'boolean', description: 'Must be true.' },
        maxComments: { type: 'number', description: 'Cap comments written. Example: 30' },
        targets: {
          type: 'array',
          description: 'Optional subset of issues.',
          items: {
            type: 'object',
            properties: {
              itemIndex: { type: 'number' },
              issueIndex: { type: 'number' }
            }
          }
        }
      }
    }
  }),

  tool({
    name: 'proofread_job_poll',
    description: [
      'WHAT: Poll async proofread job progress when proofread_run returned a job/jobId mode.',
      'WHEN: Long proofread still running.',
      'NOT: Not used for ordinary dryRun sync results that already include issues.',
      'EXAMPLE: {"jobId":"<id>"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['jobId'],
      properties: {
        jobId: { type: 'string', description: 'Async job id from proofread_run.' }
      }
    }
  }),

  tool({
    name: 'assistants_list_domains',
    description: [
      'WHAT: List assistant domain catalog (works even when Agent is offline).',
      'WHEN: 「有哪些助手领域」「list domains」 before searching a specific assistant.',
      'NOT: Does not return full assistant prompts — use assistants_search / assistants_get.',
      'EXAMPLE: {}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', additionalProperties: false, properties: {} }
  }),

  tool({
    name: 'assistants_search',
    description: [
      'WHAT: Search ~thousands of 察元 assistants by query/domain; returns summaries.',
      'WHEN: 「有没有合同审查助手」「search assistants for proofreading」.',
      'NOT: Do not register every assistant as a tool. Fetch definition via assistants_get, then YOU execute the workflow with document_* tools.',
      'EXAMPLE: {"query":"错别字","domain":"校对","limit":10}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Search keywords in Chinese or English.' },
        domain: { type: 'string', description: 'Optional domain id/label filter.' },
        limit: { type: 'number', description: 'Max hits. Example: 10' }
      }
    }
  }),

  tool({
    name: 'assistants_get',
    description: [
      'WHAT: Export one assistant’s full definition/prompt for the external LLM to follow.',
      'WHEN: After assistants_search, user wants that assistant’s behavior applied to the open doc.',
      'NOT: Calling this does not auto-run the assistant inside WPS — you must perform the steps (read → reason → write).',
      'EXAMPLE: {"id":"<assistantId>","domain":"校对"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Assistant id from search results.' },
        domain: { type: 'string', description: 'Optional domain to speed loading.' }
      }
    }
  }),

  // ─── P0: format / comment review / revision / nav / breaks ───────────────
  tool({
    name: 'comment_list',
    description: [
      'WHAT: List comments in the active document (author, body, anchor snippet, index).',
      'WHEN: 「有哪些批注」「列出全文批注」「show all comments」.',
      'NOT: Does not add comments (document_add_comment). Does not return full body text (document_get_text).',
      'EXAMPLE: {"limit":50}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'number', description: 'Max comments to return (default 100, max 300).' },
        author: { type: 'string', description: 'Optional author filter (substring match).' }
      }
    }
  }),

  tool({
    name: 'format_run',
    description: [
      'WHAT: Change character LOOK of anchored text: bold/italic/underline/strike, font name/size/sizeDelta, color, highlight, phonetic guide.',
      'WHEN: 「加粗这段」「字号加大」「改成宋体」「标红」「加删除线」「给这两个字加拼音」「bold / enlarge font / red text」.',
      'NOT: Not for changing wording (document_replace). Not for paragraph align/line-spacing (format_para). Not for Heading styles (style_apply). Not for page orientation (layout_page).',
      'HOW: Set only fields in changes{}. Anchor with originalText and/or start/end, or scope=selection|paragraph|document. Preview confirmed=false; commit confirmed=true. Multi-span → format_apply_ops.',
      'EXAMPLE: {"originalText":"重点工作","changes":{"bold":true,"color":"#FF0000"},"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['changes'],
      properties: {
        changes: {
          type: 'object',
          additionalProperties: false,
          properties: {
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            underline: { type: 'boolean' },
            strike: { type: 'boolean' },
            name: { type: 'string', description: 'Font family; prefer system_fonts_list names.' },
            size: { type: 'number', description: 'Absolute font size in pt.' },
            sizeDelta: { type: 'number', description: 'Relative pt change, e.g. 2 or -1.' },
            color: { type: 'string', description: 'Text color hex or Chinese color name.' },
            highlight: { type: 'string', description: 'Highlight / background color.' },
            phonetic: { type: 'string', description: 'PhoneticGuide text (拼音).' }
          }
        },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        hintStart: { type: 'number' },
        scope: { type: 'string', enum: ['selection', 'paragraph', 'document'] },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'format_para',
    description: [
      'WHAT: Change paragraph LOOK: alignment, line spacing, space before/after, first-line indent.',
      'WHEN: 「这段居中」「行距1.5」「段前段后」「两端对齐」.',
      'NOT: Not for bold/color (format_run). Not for wording (document_replace). Not for paper orientation (layout_page).',
      'HOW: changes{align,lineSpacing,spaceBefore,spaceAfter,firstLineIndent}. Anchor or scope. confirmed preview/commit.',
      'EXAMPLE: {"originalText":"第一章 总则","changes":{"align":"center","lineSpacing":1.5},"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['changes'],
      properties: {
        changes: {
          type: 'object',
          additionalProperties: false,
          properties: {
            align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
            lineSpacing: { type: 'number', description: 'e.g. 1 / 1.5 / 2, or host-specific rule value.' },
            spaceBefore: { type: 'number' },
            spaceAfter: { type: 'number' },
            firstLineIndent: { type: 'number', description: 'First-line indent in character units when supported.' }
          }
        },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        hintStart: { type: 'number' },
        scope: { type: 'string', enum: ['selection', 'paragraph', 'document'] },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'format_apply_ops',
    description: [
      'WHAT: Apply many format_run/format_para style ops in one call (batch).',
      'WHEN: 「把文中所有“注意”标红加粗」「多处同时改字号」.',
      'NOT: Not for wording batch (document_apply_ops replace). Do not loop locate+format_run.',
      'HOW: operations[{originalText|start|end, changes, kind?:run|para}]. confirmed=false preview; true commit. Max 100 ops.',
      'EXAMPLE: {"confirmed":true,"operations":[{"originalText":"注意","changes":{"bold":true,"color":"#FF0000"}}]}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['operations'],
      properties: {
        operations: {
          type: 'array',
          maxItems: 100,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['changes'],
            properties: {
              kind: { type: 'string', enum: ['run', 'para'], description: 'Default run.' },
              changes: { type: 'object' },
              originalText: { type: 'string' },
              start: { type: 'number' },
              end: { type: 'number' },
              hintStart: { type: 'number' }
            }
          }
        },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'system_fonts_list',
    description: [
      'WHAT: List available font family names on this machine / host.',
      'WHEN: 「有哪些字体」「系统字体列表」「before setting 仿宋 check fonts」.',
      'NOT: Does not change document. To apply a font use format_run changes.name.',
      'EXAMPLE: {"limit":80,"query":"宋"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'number', description: 'Max names (default 100, max 400).' },
        query: { type: 'string', description: 'Optional substring filter.' }
      }
    }
  }),

  tool({
    name: 'style_list',
    description: [
      'WHAT: List paragraph/character styles in the active document.',
      'WHEN: 「有哪些样式」「列出标题样式」「style list」.',
      'NOT: Does not apply styles (style_apply).',
      'EXAMPLE: {"headingOnly":true,"limit":60}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'number' },
        headingOnly: { type: 'boolean', description: 'If true, prefer heading-like style names.' },
        query: { type: 'string' }
      }
    }
  }),

  tool({
    name: 'style_apply',
    description: [
      'WHAT: Apply a named style (e.g. Heading 1 / 标题 1) to anchored text or scope.',
      'WHEN: 「设为一级标题」「应用标题2样式」「set heading style」.',
      'NOT: Not a substitute for mere bold (format_run). Not for changing words (document_replace).',
      'HOW: styleName required. Anchor or scope. confirmed preview/commit.',
      'EXAMPLE: {"styleName":"标题 1","originalText":"第一章 总则","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['styleName'],
      properties: {
        styleName: { type: 'string' },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        hintStart: { type: 'number' },
        scope: { type: 'string', enum: ['selection', 'paragraph', 'document'] },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'nav_location',
    description: [
      'WHAT: Get page number / line number information for an anchor or selection.',
      'WHEN: 「这段在第几页」「行号是多少」「where is this on the page」.',
      'NOT: Does not insert page-number fields. Does not open navigation pane (nav_pane_set).',
      'EXAMPLE: {"originalText":"执行摘要"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' },
        hintStart: { type: 'number' },
        scope: { type: 'string', enum: ['selection', 'paragraph'] }
      }
    }
  }),

  tool({
    name: 'break_insert',
    description: [
      'WHAT: Insert a break at selection or after an anchor (page / section / column).',
      'WHEN: 「插入分页符」「分节」「分栏符」.',
      'NOT: Not blank-page helper (page_blank_insert). Not for inserting paragraphs of text (document_insert).',
      'HOW: kind=page|section|column. confirmed required to write.',
      'EXAMPLE: {"kind":"page","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'confirmed'],
      properties: {
        kind: { type: 'string', enum: ['page', 'section', 'column'] },
        originalText: { type: 'string', description: 'Optional: insert after this anchor.' },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'page_blank_insert',
    description: [
      'WHAT: Insert a blank page (page break + empty content) at cursor or after anchor.',
      'WHEN: 「插入空白页」「加一页空白」.',
      'NOT: Not a mere page break without blank intent (break_insert kind=page may suffice).',
      'EXAMPLE: {"confirmed":true,"position":"after","originalText":"附录"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        position: { type: 'string', enum: ['atSelection', 'after'], description: 'Default atSelection.' },
        originalText: { type: 'string' },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'revision_mode',
    description: [
      'WHAT: Turn track-changes (修订模式) on or off; optionally show/hide revisions.',
      'WHEN: 「打开修订」「关闭修订模式」「track changes on」.',
      'NOT: Does not accept/reject revisions (revision_apply). Does not list them (revision_list).',
      'EXAMPLE: {"enabled":true,"show":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean' },
        show: { type: 'boolean', description: 'ShowRevisions when supported.' }
      }
    }
  }),

  tool({
    name: 'revision_list',
    description: [
      'WHAT: List track-change revisions in the document.',
      'WHEN: 「有哪些修订」「列出修改痕迹」.',
      'NOT: Does not accept/reject (revision_apply).',
      'EXAMPLE: {"limit":50}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'revision_apply',
    description: [
      'WHAT: Accept or reject revisions (all or by index).',
      'WHEN: 「全部接受修订」「拒绝这些修改」「accept all changes」.',
      'NOT: Does not toggle track-changes mode (revision_mode).',
      'HOW: action=accept|reject; scope=all|indexes; confirmed=true required.',
      'EXAMPLE: {"action":"accept","scope":"all","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'confirmed'],
      properties: {
        action: { type: 'string', enum: ['accept', 'reject'] },
        scope: { type: 'string', enum: ['all', 'indexes'], description: 'Default all.' },
        indexes: {
          type: 'array',
          items: { type: 'number' },
          description: '1-based revision indexes when scope=indexes.'
        },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'nav_pane_set',
    description: [
      'WHAT: Show or hide the navigation / document-map pane (UI only; does not change document bytes).',
      'WHEN: 「打开导航窗格」「显示文档结构图」「hide navigation pane」.',
      'NOT: Does not return outline data (future nav_outline). Does not jump to a heading.',
      'EXAMPLE: {"visible":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['visible'],
      properties: {
        visible: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'layout_page',
    description: [
      'WHAT: Set page setup: orientation (portrait/landscape) and optional margins.',
      'WHEN: 「横向打印纸」「竖向」「改页边距」.',
      'NOT: Not paragraph alignment (format_para). Not columns (layout_columns when available). Not TOC (toc_insert).',
      'HOW: orientation=portrait|landscape. confirmed=true to apply.',
      'EXAMPLE: {"orientation":"landscape","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        orientation: { type: 'string', enum: ['portrait', 'landscape'] },
        marginTop: { type: 'number' },
        marginBottom: { type: 'number' },
        marginLeft: { type: 'number' },
        marginRight: { type: 'number' },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'toc_insert',
    description: [
      'WHAT: Insert an automatic table of contents (TOC) field based on heading styles.',
      'WHEN: 「插入目录」「生成目录」「加个自动目录」.',
      'NOT: Not for typing a fake “目录” list by hand (document_insert). Not blank page (page_blank_insert). Prefer style_apply Heading first so TOC has entries.',
      'HOW: confirmed=true to write. Optional originalText/position to place TOC; title defaults to 目录; upperLevel/lowerLevel default 1–3.',
      'EXAMPLE: {"confirmed":true,"title":"目录","upperLevel":1,"lowerLevel":3,"originalText":"爱唠叨的妈妈","position":"before"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        title: { type: 'string', description: 'Heading text before TOC; default 目录; empty/false to skip.' },
        upperLevel: { type: 'number', description: 'Highest heading level included (default 1).' },
        lowerLevel: { type: 'number', description: 'Lowest heading level included (default 3).' },
        originalText: { type: 'string', description: 'Anchor text; insert before/after this span.' },
        position: { type: 'string', enum: ['before', 'after'], description: 'Relative to originalText; default after.' },
        start: { type: 'number' },
        hintStart: { type: 'number' },
        includePageNumbers: { type: 'boolean' },
        rightAlignPageNumbers: { type: 'boolean' },
        useHyperlinks: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'toc_update',
    description: [
      'WHAT: Refresh an existing TOC field (entries/page numbers).',
      'WHEN: 「更新目录」「刷新目录页码」 after headings changed.',
      'NOT: Does not create a TOC (toc_insert).',
      'HOW: confirmed=true. Optional index (1-based, default 1).',
      'EXAMPLE: {"confirmed":true,"index":1}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        index: { type: 'number', description: '1-based TOC index; default 1.' }
      }
    }
  }),

  tool({
    name: 'comment_delete',
    description: [
      'WHAT: Delete comment(s) by index, matching anchor text, or all.',
      'WHEN: 「删除这条批注」「清空批注」.',
      'NOT: Does not add comments (document_add_comment). List first with comment_list.',
      'HOW: confirmed=true. Provide index OR originalText OR all:true.',
      'EXAMPLE: {"index":1,"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        index: { type: 'number' },
        originalText: { type: 'string' },
        all: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'layout_columns',
    description: [
      'WHAT: Set page text columns (分栏).',
      'WHEN: 「两栏排版」「三栏」「取消分栏」.',
      'NOT: Not table columns (table_insert). Not column break (break_insert kind=column).',
      'HOW: count=1..10; confirmed=true. Optional lineBetween, spacing.',
      'EXAMPLE: {"count":2,"lineBetween":true,"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        count: { type: 'number' },
        lineBetween: { type: 'boolean' },
        spacing: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'nav_outline',
    description: [
      'WHAT: Return heading outline tree (level + text + offsets).',
      'WHEN: 「文档大纲」「有哪些标题」「outline」.',
      'NOT: Does not show nav pane (nav_pane_set). Does not insert TOC (toc_insert).',
      'EXAMPLE: {"maxLevel":3,"limit":100}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxLevel: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'bookmark_list',
    description: [
      'WHAT: List bookmarks in the active document.',
      'WHEN: 「有哪些书签」「bookmark list」.',
      'NOT: Does not jump (bookmark_goto).',
      'EXAMPLE: {"limit":50,"query":"字段"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'number' },
        query: { type: 'string' }
      }
    }
  }),

  tool({
    name: 'bookmark_goto',
    description: [
      'WHAT: Select/jump to a bookmark by name or index.',
      'WHEN: 「跳到书签」「定位书签」.',
      'NOT: Does not create bookmarks.',
      'EXAMPLE: {"name":"字段_1"}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        index: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'table_insert',
    description: [
      'WHAT: Insert a table at selection or after an anchor.',
      'WHEN: 「插入表格」「加一个3行4列表格」.',
      'NOT: Not page columns (layout_columns).',
      'HOW: rows/columns required-ish (default 2x2). confirmed=true.',
      'EXAMPLE: {"rows":3,"columns":4,"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        rows: { type: 'number' },
        columns: { type: 'number' },
        originalText: { type: 'string' },
        pageNumber: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'image_list',
    description: [
      'WHAT: List inline and floating pictures.',
      'WHEN: 「文档里有几张图」「列出图片」.',
      'NOT: Does not export (image_export) or delete (image_delete).',
      'EXAMPLE: {"limit":50}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { limit: { type: 'number' } }
    }
  }),

  tool({
    name: 'image_insert',
    description: [
      'WHAT: Insert a local image file as InlineShape.',
      'WHEN: 「插入图片」「把这张图插进来」.',
      'HOW: path absolute; confirmed=true; optional originalText anchor.',
      'EXAMPLE: {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\a.png","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['path', 'confirmed'],
      properties: {
        path: { type: 'string' },
        confirmed: { type: 'boolean' },
        originalText: { type: 'string' },
        start: { type: 'number' },
        end: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'image_delete',
    description: [
      'WHAT: Delete one picture by index/kind or all pictures.',
      'WHEN: 「删掉这张图」「清空图片」.',
      'HOW: confirmed=true; index+kind=inline|floating OR all:true.',
      'EXAMPLE: {"index":1,"kind":"inline","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        index: { type: 'number' },
        kind: { type: 'string', enum: ['inline', 'floating'] },
        all: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'image_export',
    description: [
      'WHAT: Export inline pictures to a folder via SaveAsPicture when supported.',
      'WHEN: 「导出所有图片」.',
      'HOW: folder path; confirmed=true.',
      'EXAMPLE: {"folder":"C:\\\\Users\\\\me\\\\Desktop\\\\imgs","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['folder', 'confirmed'],
      properties: {
        folder: { type: 'string' },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'hyperlink_list',
    description: [
      'WHAT: List hyperlinks in the document.',
      'WHEN: 「有哪些超链接」.',
      'EXAMPLE: {"limit":50}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { limit: { type: 'number' } }
    }
  }),

  tool({
    name: 'hyperlink_add',
    description: [
      'WHAT: Add a hyperlink on anchored text or selection.',
      'WHEN: 「加超链接」「链接到官网」.',
      'HOW: address required; confirmed=true; optional text/originalText.',
      'EXAMPLE: {"address":"https://aidooo.com","text":"察元","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['address', 'confirmed'],
      properties: {
        address: { type: 'string' },
        confirmed: { type: 'boolean' },
        text: { type: 'string' },
        originalText: { type: 'string' },
        subAddress: { type: 'string' }
      }
    }
  }),

  tool({
    name: 'hyperlink_delete',
    description: [
      'WHAT: Delete hyperlink by index or all.',
      'WHEN: 「删除超链接」.',
      'HOW: confirmed=true; index or all:true.',
      'EXAMPLE: {"index":1,"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        index: { type: 'number' },
        all: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'headerfooter_get',
    description: [
      'WHAT: Read header/footer text of a section.',
      'WHEN: 「页眉是什么」「看页脚」.',
      'EXAMPLE: {"section":1,"which":"both"}'
    ].join(' '),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        section: { type: 'number' },
        which: { type: 'string', enum: ['header', 'footer', 'both'] }
      }
    }
  }),

  tool({
    name: 'headerfooter_set',
    description: [
      'WHAT: Set header and/or footer text.',
      'WHEN: 「设置页眉」「改页脚」.',
      'HOW: confirmed=true; provide header and/or footer strings.',
      'EXAMPLE: {"header":"内部资料","footer":"第 页","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        section: { type: 'number' },
        header: { type: 'string' },
        footer: { type: 'string' }
      }
    }
  }),

  tool({
    name: 'watermark_set',
    description: [
      'WHAT: Insert a text watermark (header shape) tagged ChayuanWatermark*.',
      'WHEN: 「加水印」「保密水印」.',
      'HOW: confirmed=true; text default 保密.',
      'EXAMPLE: {"text":"机密","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        text: { type: 'string' },
        rotation: { type: 'number' },
        fontSize: { type: 'number' }
      }
    }
  }),

  tool({
    name: 'watermark_clear',
    description: [
      'WHAT: Remove Chayuan-tagged watermarks (or all header shapes if all:true).',
      'WHEN: 「去掉水印」「清除水印」.',
      'EXAMPLE: {"confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['confirmed'],
      properties: {
        confirmed: { type: 'boolean' },
        all: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'document_export',
    description: [
      'WHAT: Export active document to docx or pdf path.',
      'WHEN: 「导出PDF」「另存为docx」.',
      'NOT: Prefer document_save for simple save-in-place.',
      'HOW: format=docx|pdf; path required; confirmed=true.',
      'EXAMPLE: {"format":"pdf","path":"C:\\\\Users\\\\me\\\\Desktop\\\\out.pdf","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['path', 'confirmed'],
      properties: {
        path: { type: 'string' },
        format: { type: 'string', enum: ['docx', 'pdf', 'doc'] },
        confirmed: { type: 'boolean' }
      }
    }
  }),

  tool({
    name: 'style_audit',
    description: [
      'WHAT: Audit styles — usage stats, unused list, or purge unused custom styles.',
      'WHEN: 「样式统计」「清理未使用样式」.',
      'NOT: Not style_apply / style_list alone.',
      'HOW: action=stats|unused|purge_unused; purge needs confirmed=true.',
      'EXAMPLE: {"action":"unused"} or {"action":"purge_unused","confirmed":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['stats', 'unused', 'purge_unused'] },
        confirmed: { type: 'boolean' },
        limit: { type: 'number' }
      }
    }
  })
]

export const TOOLS = [
  ...CORE_TOOLS.filter((t) => !REPLACED_FINE_GRAINED.has(t.name)),
  ...AGGREGATE_TOOLS
]

export default { SERVER_INFO, SERVER_INSTRUCTIONS, TOOLS }
