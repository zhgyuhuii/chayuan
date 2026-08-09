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
 */

function tool(def) {
  return def
}

export const SERVER_INFO = { name: 'chayuan-wps', version: '0.5.0' }

export const SERVER_INSTRUCTIONS = [
  'You are connected to 察元 WPS MCP. End users speak natural Chinese/English only — they never name tools.',
  'Map intent → tools yourself using each tool description (WHEN / NOT / EXAMPLE).',
  'Division of labor: YOU (the LLM) reason, translate, rewrite, decide; WPS Agent only reads/locates/writes/exports.',
  'Destructive or document-mutating writes usually need confirmed=true after a preview call.',
  'If the user cannot see the document window, prefer document_open with viaOs=true and force=true; check ui fields in the response.',
  'For「翻译每一段并插到段后」: document_list_paragraphs → translate yourself → document_apply_ops(action=insert-after) or document_insert(position=after), writing from the last paragraph upward.',
  'Read resource chayuan://guide/user-intents or prompt para_translate_insert_after when unsure.'
].join(' ')

export const TOOLS = [
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
      'WHEN: 「用WPS打开…」「打开桌面\\起诉\\答辩状.docx」「open this file in WPS」. Always prefer absolute Windows paths.',
      'NOT: Do not use fs_read / read_file for .docx binary. Do not assume alreadyOpen means the user can see it — check ui.documentVisibleInWindowTitle.',
      'HOW: Default viaOs=true (shell/wps.exe /wps) to avoid headless Preview/-Embedding hosts; force=true re-opens even if Agent reports alreadyOpen; activate=true brings window forward.',
      'EXAMPLE: {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\起诉\\\\答辩状.docx","viaOs":true,"force":true,"activate":true}'
    ].join(' '),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description: 'Absolute local file path. Example: C:\\Users\\zhgyu\\Desktop\\起诉\\答辩状.docx'
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
      'WHEN: Pipeline guard before edits — 「确保答辩状是当前文档」.',
      'NOT: Prefer document_open(viaOs/force) when the user reports they cannot see the window.',
      'EXAMPLE: {"path":"C:\\\\Users\\\\me\\\\Desktop\\\\a.docx"}'
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
      'EXAMPLE: {"text":"答辩人认为","hintStart":0,"maxMatches":5}'
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
      'NOT: For inserting translations after a paragraph use document_insert(position=after) or document_apply_ops(insert-after), not replace.',
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
      'NOT: Does not change body text. For proofread batch comments prefer proofread_apply_comments after proofread_run.',
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
  })
]

export default { SERVER_INFO, SERVER_INSTRUCTIONS, TOOLS }
