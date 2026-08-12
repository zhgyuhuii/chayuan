/**
 * Minimal MCP JSON-RPC over Streamable HTTP (2025-03-26 style).
 * Session is optional/pluggable for future stateless RC.
 */
import fs from 'node:fs'
import { listDomains, searchDomainsOffline } from './catalog.mjs'
import {
  findWpsExecutable,
  isDocumentVisibleInWindows,
  listVisibleWpsWindows,
  normalizePath,
  openPathWithOs
} from './platformBridge.mjs'
import { SERVER_INFO, SERVER_INSTRUCTIONS, TOOLS } from './toolCatalog.mjs'
import {
  AGGREGATE_TOOL_NAMES,
  LEGACY_TOOL_ALIASES,
  resolveAggregateCall
} from './aggregateTools.mjs'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pathsMatchDoc(doc, filePath) {
  const target = normalizePath(filePath).toLowerCase()
  if (!doc?.open || !target) return false
  const full = normalizePath(doc.fullName || '').toLowerCase()
  const name = String(doc.name || '').toLowerCase()
  const targetName = target.split(/[/\\]/).filter(Boolean).pop() || ''
  if (full && full === target) return true
  if (targetName && name === targetName) return true
  return false
}

const PROTOCOL = '2025-03-26'

function jsonResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data
  }
}

function jsonError(code, message, data) {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ code, message, ...(data || {}) }) }],
    structuredContent: { code, message, ...(data || {}) }
  }
}

function staticResources() {
  const idx = listDomains()
  return [
    {
      uri: 'chayuan://wps/health',
      name: 'WPS Health',
      description: 'sidecar / agent / document 分层健康状态',
      mimeType: 'application/json'
    },
    {
      uri: 'chayuan://guide/user-intents',
      name: 'User intent → tool playbook',
      description:
        '用户自然语言意图到工具编排（用户无需知道工具名）。含「逐段翻译插到段后」等常见话术。',
      mimeType: 'application/json'
    },
    {
      uri: 'chayuan://guide/tool-routing',
      name: 'Tool layer routing',
      description:
        '层路由：改字 vs 改样子 vs 批注/修订 vs 版式。供 LLM 准确选型，避免 replace↔format 混用。',
      mimeType: 'application/json'
    },
    {
      uri: 'chayuan://assistants/manifest',
      name: 'Assistants Manifest',
      description: `领域清单（${idx.domainCount} domains / ${idx.assistantTotal} assistants）`,
      mimeType: 'application/json'
    }
  ]
}

/** MCP prompts: teach clients how to map NL user requests → tools. */
const PROMPTS = [
  {
    name: 'para_translate_insert_after',
    title: '逐段翻译并插入段落后',
    description:
      '用户说「翻译每一段，把译文放到对应段落后面」时使用。用户无需知道任何工具名。',
    arguments: [
      {
        name: 'targetLanguage',
        description: '目标语言，默认 English',
        required: false
      }
    ]
  },
  {
    name: 'open_local_document',
    title: '打开本地文档',
    description: '用户说「用 WPS 打开某某文件/桌面某文件夹里的文档」时使用。',
    arguments: [
      {
        name: 'path',
        description: '本地绝对路径',
        required: true
      }
    ]
  }
]

function toolRoutingGuide() {
  return {
    principle:
      'Pick layer first, then tool. Changing LOOK ≠ changing WORDS. Prefer confirmed=false preview before writes.',
    layers: [
      { id: 'L1-host', tools: ['wps_status', 'wps_launch'] },
      { id: 'L2-read', tools: ['document_meta', 'document_get_text', 'document_chunks', 'document_list_paragraphs', 'document_list_open'] },
      { id: 'L2b-switch', tools: ['document_activate', 'document_open', 'document_ensure_open'] },
      { id: 'L3-locate', tools: ['document_locate', 'nav'] },
      { id: 'L4-words', tools: ['document_replace', 'document_insert', 'document_apply_ops'] },
      { id: 'L5-look', tools: ['format_run', 'format_para', 'format_apply_ops', 'style', 'system_fonts_list'] },
      { id: 'L6-review', tools: ['comment', 'revision'] },
      { id: 'L7-layout', tools: ['layout', 'nav', 'toc', 'bookmark'] },
      { id: 'L8-objects', tools: ['table', 'image', 'hyperlink', 'headerfooter', 'watermark', 'export'] },
      { id: 'L9-business', tools: ['proofread_run', 'proofread_apply_comments', 'declassify_preview', 'kb_retrieve', 'assistants_search'] }
    ],
    routes: [
      { intent: '改错别字/改措辞', use: ['document_replace', 'document_apply_ops'], never: ['format_run', 'style'] },
      { intent: '加粗/变色/字号/字体/删除线/拼音', use: ['format_run', 'format_apply_ops'], never: ['document_replace'] },
      { intent: '对齐/行距', use: ['format_para'], never: ['format_run'] },
      { intent: '设为标题样式', use: ['style'], never: ['format_run only'] },
      { intent: '列出/添加/删除批注', use: ['comment', 'proofread_apply_comments'], never: ['document_replace'] },
      { intent: '修订接受拒绝', use: ['revision'], never: [] },
      { intent: '横向纸/空白页/分页符/分栏', use: ['layout'], never: ['format_para'] },
      { intent: '插入/更新目录', use: ['toc', 'style'], never: ['document_insert fake TOC'] },
      { intent: '切换到某个已打开的文档', use: ['document_list_open', 'document_activate'], never: ['document_open unless not open'] },
      { intent: '第几页/行号/大纲', use: ['nav'], never: ['document_get_text'] },
      { intent: '图片/表格/超链接/页眉页脚/水印/导出', use: ['image', 'table', 'hyperlink', 'headerfooter', 'watermark', 'export'], never: [] }
    ]
  }
}

function userIntentsGuide() {
  return {
    principle:
      'End users never name tools. Match user utterances to tool descriptions (WHAT/WHEN/NOT/EXAMPLE). Tool catalog version follows serverInfo.version.',
    selectionRules: [
      'Read-only discovery first: wps_status → document_meta → list/chunks/get_text',
      'Mutations need confirmed=true after preview when the schema offers confirmed',
      'WORDS vs LOOK: replace/insert for wording; format_* / style(action=…) for appearance',
      'Domain tools use action=… (comment/revision/layout/nav/toc/image/…). Prefer aggregates over legacy fine-grained names.',
      'Per-paragraph NL (翻译/润色每一段…放到段后) → document_list_paragraphs, never whole-doc append',
      'Multi-span format → format_apply_ops once; multi-span wording → document_apply_ops once',
      'Visible-window failures → document_open viaOs+force, trust ui.* over alreadyOpen alone',
      'Assistants: search/get definition, then YOU execute with document_* (do not expect 4500 tools)',
      'See also chayuan://guide/tool-routing'
    ],
    examples: [
      {
        userSays: [
          '请帮我翻译每一段',
          '每段翻译的内容放到对应这段的后面',
          '逐段译成英文并插在段后',
          'Translate each paragraph and insert the English after it'
        ],
        doNot: ['Ask the user for tool names', 'append all EN at document end', 'Translate only in chat without writing back'],
        playbook: [
          'wps_status',
          'document_list_paragraphs (paginate with cursor)',
          'LLM translates each paragraph.text',
          'document_apply_ops action=insert-after confirmed=true OR document_insert position=after bottom→top',
          'Optional document_get_text spot-check'
        ],
        primaryTools: ['document_list_paragraphs', 'document_apply_ops', 'document_insert']
      },
      {
        userSays: ['用 WPS 打开桌面工作文档里的年度战略规划报告', 'Open the annual strategy report on my Desktop'],
        playbook: [
          'Resolve absolute path',
          'document_open viaOs=true force=true activate=true',
          'If ui.documentVisibleInWindowTitle=false, tell user / retry force'
        ],
        primaryTools: ['document_open', 'wps_status']
      },
      {
        userSays: ['校对错别字并加批注', 'Proofread and comment'],
        playbook: ['proofread_run dryRun=true', 'proofread_apply_comments confirmed=true'],
        primaryTools: ['proofread_run', 'proofread_apply_comments']
      },
      {
        userSays: ['这篇太长了分段读', 'Read this long document in chunks'],
        playbook: ['document_meta', 'document_chunks until hasMore=false'],
        primaryTools: ['document_meta', 'document_chunks']
      },
      {
        userSays: ['把这段加粗标红', '字号加大两点', '给标题加拼音'],
        doNot: ['document_replace', 'only chat without writing'],
        playbook: ['document_locate or use originalText', 'format_run confirmed=false', 'format_run confirmed=true'],
        primaryTools: ['format_run', 'format_apply_ops', 'system_fonts_list']
      },
      {
        userSays: ['这段居中', '行距改成1.5'],
        primaryTools: ['format_para'],
        playbook: ['format_para with changes.align / lineSpacing, confirmed=true']
      },
      {
        userSays: ['设为一级标题', '应用标题1样式'],
        primaryTools: ['style']
      },
      {
        userSays: ['有哪些批注', '打开修订并全部接受'],
        primaryTools: ['comment', 'revision']
      },
      {
        userSays: ['改成横向', '插入空白页', '插入分页符'],
        primaryTools: ['layout']
      }
    ]
  }
}

function buildPromptMessages(name, args = {}) {
  if (name === 'para_translate_insert_after') {
    const lang = String(args.targetLanguage || 'English').trim() || 'English'
    return {
      description: PROMPTS[0].description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `请把当前 WPS 文档每一段翻译成 ${lang}，并把每段译文插入到该段后面。`,
              '不要问我工具名称。请自行调用 MCP 工具完成：',
              '1) document_list_paragraphs 读取段落与锚点；',
              '2) 你负责翻译；',
              '3) document_apply_ops(action=insert-after, confirmed=true) 或 document_insert(position=after) 写回；',
              '4) 从文档后面的段落往前写，避免位置错乱；',
              '5) 完成后用简短中文告诉我已完成，并抽查 1～2 段。'
            ].join('\n')
          }
        }
      ]
    }
  }
  if (name === 'open_local_document') {
    const p = String(args.path || '').trim()
    return {
      description: PROMPTS[1].description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              p
                ? `请用 WPS 打开本地文件：${p}`
                : '请用 WPS 打开用户指定的本地文档。',
              '调用 document_open（viaOs=true，必要时 force=true），不要让用户填写工具名。'
            ].join('\n')
          }
        }
      ]
    }
  }
  return null
}

export function createMcpHandler({ agentHub, getServerMeta, audit, launchWpsAndWait }) {
  /** @type {Map<string, any>} */
  const sessions = new Map()

  function createSession() {
    const id = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    sessions.set(id, { id, createdAt: Date.now() })
    return id
  }

  async function readHealthResource() {
    const agent = agentHub.status()
    let document = null
    if (agent.agentOnline) {
      try {
        document = await agentHub.callAgent('wps.status', {}, { timeoutMs: 10_000 })
      } catch (e) {
        document = { error: e.code || 'AGENT_ERROR', message: e.message }
      }
    }
    return {
      wpsRunning: !!agent.agentOnline,
      agentOnline: !!agent.agentOnline,
      agentCount: agent.agentCount,
      activeDocument: document?.document || document || null,
      server: getServerMeta(),
      tiers: {
        L0_server: true,
        L1_catalog: true,
        L2_document: !!agent.agentOnline && !document?.error
      }
    }
  }

  async function handleResourcesRead(uri) {
    if (uri === 'chayuan://wps/health') {
      const data = await readHealthResource()
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2)
        }]
      }
    }
    if (uri === 'chayuan://assistants/manifest') {
      const data = listDomains()
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2)
        }]
      }
    }
    if (uri === 'chayuan://guide/user-intents') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(userIntentsGuide(), null, 2)
        }]
      }
    }
    if (uri === 'chayuan://guide/tool-routing') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(toolRoutingGuide(), null, 2)
        }]
      }
    }
    const domainMatch = String(uri || '').match(/^chayuan:\/\/assistants\/domain\/([^/]+)$/)
    if (domainMatch) {
      const domain = decodeURIComponent(domainMatch[1])
      const agent = agentHub.status()
      if (!agent.agentOnline) {
        const offline = listDomains().domains.find(d => d.id === domain)
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              domain,
              offline: true,
              summary: offline || null,
              note: 'Agent offline — only domain summary; open WPS for assistant list'
            }, null, 2)
          }]
        }
      }
      try {
        const result = await agentHub.callAgent('assistants.search', { domain, limit: 200 }, { timeoutMs: 120_000 })
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2)
          }]
        }
      } catch (e) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: e.code || 'ERROR', message: e.message }, null, 2)
          }]
        }
      }
    }
    const idMatch = String(uri || '').match(/^chayuan:\/\/assistants\/([^/]+)$/)
    if (idMatch && idMatch[1] !== 'manifest' && idMatch[1] !== 'domain') {
      const id = decodeURIComponent(idMatch[1])
      try {
        const result = await agentHub.callAgent('assistants.get', { id }, { timeoutMs: 180_000 })
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2)
          }]
        }
      } catch (e) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: e.code || 'ERROR', message: e.message }, null, 2)
          }]
        }
      }
    }
    throw Object.assign(new Error(`Unknown resource: ${uri}`), { code: -32002 })
  }

  async function handleToolsCall(name, args = {}) {
    const meta = getServerMeta()

    // Domain aggregate + one-release legacy aliases (fine-grained → {tool,action})
    let toolName = name
    let toolArgs = args && typeof args === 'object' ? { ...args } : {}
    const legacy = LEGACY_TOOL_ALIASES[name]
    if (legacy) {
      toolName = legacy.tool
      toolArgs = { ...toolArgs, action: toolArgs.action || legacy.action }
    }
    if (AGGREGATE_TOOL_NAMES.includes(toolName)) {
      try {
        const resolved = resolveAggregateCall(toolName, toolArgs)
        if (resolved.requireConfirmed && toolArgs.confirmed !== true) {
          // Still forward — agent may preview; for strict gates mirror old tools
          // comment.add was hard-gated; keep that
          if (toolName === 'comment' && resolved.action === 'add') {
            return jsonError('CONFIRMATION_REQUIRED', '必须传 confirmed: true')
          }
        }
        const timeoutMs =
          toolName === 'image' && resolved.action === 'export'
            ? 120_000
            : toolName === 'export'
              ? 120_000
              : toolName === 'style' && resolved.action === 'audit'
                ? 120_000
                : 60_000
        const result = await agentHub.callAgent(resolved.method, resolved.args, { timeoutMs })
        if (toolArgs.confirmed === true) {
          audit?.append({ tool: toolName, action: resolved.action, confirmed: true })
        }
        return jsonResult(result)
      } catch (e) {
        return jsonError(e.code || 'ERROR', e.message, e.details)
      }
    }

    switch (name) {
      case 'wps_status': {
        const agent = agentHub.status()
        let doc = null
        if (agent.agentOnline) {
          try {
            doc = await agentHub.callAgent('wps.status', {}, { timeoutMs: 15_000 })
          } catch (e) {
            doc = { error: e.code || 'AGENT_ERROR', message: e.message }
          }
        }
        const visibleWindows = listVisibleWpsWindows()
        const agentDocName = doc?.document?.name || doc?.name || ''
        const agentDocPath = doc?.document?.fullName || doc?.fullName || agentDocName
        const uiObserved = isDocumentVisibleInWindows(agentDocPath, visibleWindows)
        return jsonResult({
          server: meta,
          agent,
          document: doc,
          ui: {
            visibleWpsWindows: visibleWindows,
            agentDocumentVisibleInWindowTitle: uiObserved,
            warning: uiObserved
              ? null
              : agentDocName
                ? 'Agent 报文档已打开，但系统未见标题含该文件名的 WPS 窗口（常见于 Preview/-Embedding 后台进程）'
                : visibleWindows.length === 0
                  ? '未发现带标题的可见 WPS 窗口'
                  : null
          },
          tiers: {
            L0_server: true,
            L1_catalog: true,
            L2_document: !!agent.agentOnline && !doc?.error
          }
        })
      }
      case 'wps_launch': {
        try {
          if (typeof launchWpsAndWait !== 'function') {
            return jsonError('NOT_SUPPORTED', 'wps_launch unavailable')
          }
          const result = await launchWpsAndWait(args)
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_open': {
        try {
          const filePath = normalizePath(args.path)
          if (!filePath) return jsonError('INVALID_PARAMS', 'path required')
          if (!fs.existsSync(filePath)) {
            return jsonError('FILE_NOT_FOUND', `File not found: ${filePath}`)
          }

          const viaOs = args.viaOs !== false
          const force = args.force === true
          let agentDoc = null
          if (agentHub.status().agentOnline) {
            try {
              const st = await agentHub.callAgent('wps.status', {}, { timeoutMs: 8_000 })
              agentDoc = st?.document || st
            } catch { /* ignore */ }
          }

          const already = pathsMatchDoc(agentDoc, filePath)
          const likelyHidden = agentDoc?.ui?.likelyHidden === true
          const visibleBefore = listVisibleWpsWindows()
          const seenInUi = isDocumentVisibleInWindows(filePath, visibleBefore)

          let osOpen = null
          const shouldOsOpen = viaOs && (force || !already || likelyHidden || !seenInUi)
          if (shouldOsOpen) {
            const exe =
              getServerMeta?.()?.config?.wpsExecutable ||
              findWpsExecutable() ||
              ''
            osOpen = openPathWithOs(filePath, { wpsExe: exe })
            if (!osOpen.ok) {
              return jsonError(osOpen.code || 'OS_OPEN_FAILED', osOpen.error || 'OS open failed', osOpen)
            }
            // Give the interactive WPS a moment to create a real window.
            await sleep(1200)
          }

          let result = null
          if (agentHub.status().agentOnline) {
            try {
              result = await agentHub.callAgent(
                'document.open',
                { path: filePath, activate: args.activate !== false },
                { timeoutMs: 60_000 }
              )
            } catch (e) {
              // OS open may still have succeeded for the user-visible window.
              if (osOpen?.ok) {
                result = {
                  ok: true,
                  opened: true,
                  path: filePath,
                  agentError: { code: e.code, message: e.message },
                  note: 'Opened via OS; Agent confirm failed (possibly attached to another WPS process)'
                }
              } else {
                throw e
              }
            }
          } else if (osOpen?.ok) {
            result = {
              ok: true,
              opened: true,
              path: filePath,
              agentOnline: false,
              note: 'Opened via OS; Agent offline'
            }
          } else {
            return jsonError('WPS_AGENT_OFFLINE', 'WPS Agent offline and OS open skipped')
          }

          const visibleAfter = listVisibleWpsWindows()
          const uiObserved = isDocumentVisibleInWindows(filePath, visibleAfter)
          const payload = {
            ...result,
            path: filePath,
            openedViaOs: !!osOpen?.ok,
            osOpen,
            ui: {
              visibleWpsWindows: visibleAfter,
              documentVisibleInWindowTitle: uiObserved,
              warning: uiObserved
                ? null
                : '系统仍未看到标题含文件名的 WPS 窗口。请检查是否只有「WPS Office」主页，或结束后台 Preview/-Embedding 进程后重试 force:true'
            }
          }
          audit?.append({
            tool: name,
            path: filePath,
            ok: true,
            openedViaOs: payload.openedViaOs,
            uiObserved
          })
          return jsonResult(payload)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_ensure_open': {
        try {
          const result = await agentHub.callAgent('document.ensure_open', args, { timeoutMs: 30_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message)
        }
      }
      case 'document_list_open': {
        try {
          return jsonResult(await agentHub.callAgent('document.list_open', args, { timeoutMs: 30_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_activate': {
        try {
          return jsonResult(await agentHub.callAgent('document.activate', args, { timeoutMs: 60_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_meta': {
        try {
          const result = await agentHub.callAgent('document.meta', args, { timeoutMs: 60_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_list_paragraphs': {
        try {
          const result = await agentHub.callAgent('document.list_paragraphs', args, {
            timeoutMs: 120_000
          })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_chunks': {
        try {
          const result = await agentHub.callAgent('document.chunks', args, { timeoutMs: 180_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_locate': {
        try {
          const result = await agentHub.callAgent('document.locate', args, { timeoutMs: 60_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_replace': {
        try {
          const result = await agentHub.callAgent('document.replace', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) {
            audit?.append({ tool: name, confirmed: true, action: 'replace' })
          }
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_insert': {
        try {
          const result = await agentHub.callAgent('document.insert', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) {
            audit?.append({ tool: name, confirmed: true, position: args.position })
          }
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_add_comment': {
        if (args.confirmed !== true) {
          return jsonError('CONFIRMATION_REQUIRED', '必须传 confirmed: true')
        }
        try {
          const result = await agentHub.callAgent('document.add_comment', args, { timeoutMs: 30_000 })
          audit?.append({ tool: name, confirmed: true, textLen: String(args.text || '').length })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_apply_ops': {
        try {
          const result = await agentHub.callAgent('document.apply_ops', args, { timeoutMs: 180_000 })
          if (args.confirmed === true) {
            audit?.append({
              tool: name,
              confirmed: true,
              opCount: Array.isArray(args.operations) ? args.operations.length : 0
            })
          }
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_new': {
        try {
          const result = await agentHub.callAgent('document.new', args, { timeoutMs: 30_000 })
          audit?.append({ tool: name, ok: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_save': {
        try {
          const result = await agentHub.callAgent('document.save', args, { timeoutMs: 60_000 })
          audit?.append({ tool: name, path: args.path || '' })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'declassify_status': {
        try {
          const result = await agentHub.callAgent('declassify.status', args, { timeoutMs: 30_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'declassify_preview': {
        try {
          const result = await agentHub.callAgent('declassify.preview', args, { timeoutMs: 60_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'declassify_apply': {
        if (args.confirmed !== true) {
          return jsonError('CONFIRMATION_REQUIRED', '必须传 confirmed: true')
        }
        try {
          const result = await agentHub.callAgent('declassify.apply', args, { timeoutMs: 300_000 })
          audit?.append({ tool: name, confirmed: true, keywordCount: Array.isArray(args.keywords) ? args.keywords.length : 0 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'declassify_restore': {
        if (args.confirmed !== true) {
          return jsonError('CONFIRMATION_REQUIRED', '必须传 confirmed: true')
        }
        try {
          const result = await agentHub.callAgent('declassify.restore', args, { timeoutMs: 300_000 })
          audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'kb_retrieve': {
        try {
          const result = await agentHub.callAgent('kb.retrieve', args, { timeoutMs: 120_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_get_text': {
        try {
          const result = await agentHub.callAgent('document.get_text', args, { timeoutMs: 60_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'proofread_run': {
        const dryRun = args.dryRun !== false
        const confirmed = args.confirmed === true
        if (!dryRun && !confirmed) {
          return jsonError('CONFIRMATION_REQUIRED', '非 dryRun 写回需要 confirmed: true；建议 dryRun 后调用 proofread_apply_comments')
        }
        try {
          const result = await agentHub.callAgent(
            'proofread.run',
            { ...args, dryRun: dryRun || !confirmed },
            { timeoutMs: 600_000 }
          )
          audit?.append({
            tool: name,
            dryRun: dryRun || !confirmed,
            confirmed,
            agentOnline: true
          })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'proofread_apply_comments': {
        if (args.confirmed !== true) {
          return jsonError('CONFIRMATION_REQUIRED', '必须传 confirmed: true 才会写批注')
        }
        try {
          const result = await agentHub.callAgent('proofread.apply_comments', args, { timeoutMs: 300_000 })
          audit?.append({
            tool: name,
            confirmed: true,
            taskId: args.taskId,
            maxComments: args.maxComments,
            applied: result?.applied,
            agentOnline: true
          })
          return jsonResult(result)
        } catch (e) {
          audit?.append({
            tool: name,
            confirmed: true,
            taskId: args.taskId,
            error: e.message,
            code: e.code
          })
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'proofread_job_poll': {
        try {
          const result = await agentHub.callAgent('proofread.job_poll', args, { timeoutMs: 15_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message)
        }
      }
      case 'assistants_list_domains': {
        // L1 offline
        return jsonResult(listDomains())
      }
      case 'assistants_search': {
        const agent = agentHub.status()
        if (agent.agentOnline) {
          try {
            const result = await agentHub.callAgent('assistants.search', args, { timeoutMs: 120_000 })
            return jsonResult(result)
          } catch (e) {
            // fall through to offline
            const offline = searchDomainsOffline(args.query || args.q, { limit: args.limit })
            offline.fallbackFromAgentError = e.message
            return jsonResult(offline)
          }
        }
        return jsonResult(searchDomainsOffline(args.query || args.q, { limit: args.limit }))
      }
      case 'assistants_get': {
        try {
          const result = await agentHub.callAgent('assistants.get', args, { timeoutMs: 180_000 })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message)
        }
      }
      case 'comment_list': {
        try {
          return jsonResult(await agentHub.callAgent('comment.list', args, { timeoutMs: 60_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'format_run': {
        try {
          const result = await agentHub.callAgent('format.run', args, { timeoutMs: 90_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'format_para': {
        try {
          const result = await agentHub.callAgent('format.para', args, { timeoutMs: 90_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'format_apply_ops': {
        try {
          const result = await agentHub.callAgent('format.apply_ops', args, { timeoutMs: 180_000 })
          if (args.confirmed === true) {
            audit?.append({
              tool: name,
              confirmed: true,
              opCount: Array.isArray(args.operations) ? args.operations.length : 0
            })
          }
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'system_fonts_list': {
        try {
          return jsonResult(await agentHub.callAgent('system.fonts_list', args, { timeoutMs: 30_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'style_list': {
        try {
          return jsonResult(await agentHub.callAgent('style.list', args, { timeoutMs: 60_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'style_apply': {
        try {
          const result = await agentHub.callAgent('style.apply', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'nav_location': {
        try {
          return jsonResult(await agentHub.callAgent('nav.location', args, { timeoutMs: 30_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'break_insert': {
        try {
          const result = await agentHub.callAgent('break.insert', args, { timeoutMs: 30_000 })
          audit?.append({ tool: name, confirmed: true, kind: args.kind })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'page_blank_insert': {
        try {
          const result = await agentHub.callAgent('page.blank_insert', args, { timeoutMs: 30_000 })
          audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'toc_insert': {
        try {
          const result = await agentHub.callAgent('toc.insert', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'toc_update': {
        try {
          const result = await agentHub.callAgent('toc.update', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'comment_delete': {
        try {
          const result = await agentHub.callAgent('comment.delete', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'layout_columns': {
        try {
          const result = await agentHub.callAgent('layout.columns', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true, count: args.count })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'nav_outline': {
        try {
          return jsonResult(await agentHub.callAgent('nav.outline', args, { timeoutMs: 60_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'bookmark_list': {
        try {
          return jsonResult(await agentHub.callAgent('bookmark.list', args, { timeoutMs: 30_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'bookmark_goto': {
        try {
          return jsonResult(await agentHub.callAgent('bookmark.goto', args, { timeoutMs: 15_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'table_insert': {
        try {
          const result = await agentHub.callAgent('table.insert', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'image_list': {
        try {
          return jsonResult(await agentHub.callAgent('image.list', args, { timeoutMs: 30_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'image_insert': {
        try {
          const result = await agentHub.callAgent('image.insert', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'image_delete': {
        try {
          const result = await agentHub.callAgent('image.delete', args, { timeoutMs: 60_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'image_export': {
        try {
          const result = await agentHub.callAgent('image.export', args, { timeoutMs: 120_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'hyperlink_list': {
        try {
          return jsonResult(await agentHub.callAgent('hyperlink.list', args, { timeoutMs: 30_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'hyperlink_add': {
        try {
          const result = await agentHub.callAgent('hyperlink.add', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'hyperlink_delete': {
        try {
          const result = await agentHub.callAgent('hyperlink.delete', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'headerfooter_get': {
        try {
          return jsonResult(await agentHub.callAgent('headerfooter.get', args, { timeoutMs: 15_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'headerfooter_set': {
        try {
          const result = await agentHub.callAgent('headerfooter.set', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'watermark_set': {
        try {
          const result = await agentHub.callAgent('watermark.set', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'watermark_clear': {
        try {
          const result = await agentHub.callAgent('watermark.clear', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'document_export': {
        try {
          const result = await agentHub.callAgent('document.export', args, { timeoutMs: 120_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true, format: args.format })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'style_audit': {
        try {
          const result = await agentHub.callAgent('style.audit', args, { timeoutMs: 120_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true, action: args.action })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'revision_mode': {
        try {
          return jsonResult(await agentHub.callAgent('revision.mode', args, { timeoutMs: 15_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'revision_list': {
        try {
          return jsonResult(await agentHub.callAgent('revision.list', args, { timeoutMs: 60_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'revision_apply': {
        try {
          const result = await agentHub.callAgent('revision.apply', args, { timeoutMs: 120_000 })
          audit?.append({ tool: name, confirmed: true, action: args.action })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'nav_pane_set': {
        try {
          return jsonResult(await agentHub.callAgent('nav.pane_set', args, { timeoutMs: 15_000 }))
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      case 'layout_page': {
        try {
          const result = await agentHub.callAgent('layout.page', args, { timeoutMs: 30_000 })
          if (args.confirmed === true) audit?.append({ tool: name, confirmed: true })
          return jsonResult(result)
        } catch (e) {
          return jsonError(e.code || 'ERROR', e.message, e.details)
        }
      }
      default:
        return jsonError('TOOL_NOT_FOUND', `Unknown tool: ${name}`)
    }
  }

  async function handleMessage(msg, { sessionId } = {}) {
    if (!msg || typeof msg !== 'object') {
      return { error: { code: -32700, message: 'Parse error' } }
    }

    if (msg.method && msg.id === undefined) {
      if (msg.method === 'notifications/initialized') return { notification: true }
      return { notification: true }
    }

    const id = msg.id
    try {
      switch (msg.method) {
        case 'initialize': {
          const sid = sessionId || createSession()
          return {
            sessionId: sid,
            result: {
              protocolVersion: msg.params?.protocolVersion || PROTOCOL,
              capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false },
                prompts: { listChanged: false }
              },
              serverInfo: SERVER_INFO,
              instructions: SERVER_INSTRUCTIONS
            },
            id
          }
        }
        case 'ping':
          return { result: {}, id }
        case 'tools/list':
          return { result: { tools: TOOLS }, id }
        case 'tools/call': {
          const name = msg.params?.name
          const args = msg.params?.arguments || {}
          const toolResult = await handleToolsCall(name, args)
          return { result: toolResult, id }
        }
        case 'prompts/list':
          return { result: { prompts: PROMPTS }, id }
        case 'prompts/get': {
          const pname = msg.params?.name
          const pargs = msg.params?.arguments || {}
          const built = buildPromptMessages(pname, pargs)
          if (!built) {
            return {
              error: { code: -32602, message: `Unknown prompt: ${pname}` },
              id
            }
          }
          return { result: built, id }
        }
        case 'resources/list': {
          const resources = staticResources()
          // expose domain templates as concrete resources (top domains only to keep list small)
          const domains = listDomains().domains.slice(0, 40)
          for (const d of domains) {
            resources.push({
              uri: `chayuan://assistants/domain/${encodeURIComponent(d.id)}`,
              name: `Domain: ${d.label}`,
              description: `${d.count} assistants`,
              mimeType: 'application/json'
            })
          }
          return { result: { resources }, id }
        }
        case 'resources/templates/list':
          return {
            result: {
              resourceTemplates: [
                {
                  uriTemplate: 'chayuan://assistants/domain/{domain}',
                  name: 'Assistants by domain',
                  description: '领域下助手摘要（需 Agent 拉全量）',
                  mimeType: 'application/json'
                },
                {
                  uriTemplate: 'chayuan://assistants/{id}',
                  name: 'Assistant definition',
                  description: '完整助手定义 Export',
                  mimeType: 'application/json'
                }
              ]
            },
            id
          }
        case 'resources/read': {
          const uri = msg.params?.uri
          const result = await handleResourcesRead(uri)
          return { result, id }
        }
        default:
          return {
            error: { code: -32601, message: `Method not found: ${msg.method}` },
            id
          }
      }
    } catch (e) {
      return {
        error: { code: e.code || -32000, message: e.message || String(e) },
        id
      }
    }
  }

  return { handleMessage, sessions }
}
