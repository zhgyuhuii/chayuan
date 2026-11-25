/**
 * In-page MCP chat orchestrator: merge multi-server tools, run tool loop.
 *
 * 2026-09-08 起内核切换为 chayuan-office 的 agent-core AgentLoop（vendor 于
 * src/agent-core/）：自研循环的退避重试、退化熔断（同回合重复/全错误/坏入参）、
 * no-FC 模型 JSON 协议等稳定性工事全部继承；本文件保留原有对外契约
 * （入参/结果对象/steps 进度流/AbortError 取消语义），UI 无感。
 * 领域语义（写确认闸门、proofread 进度与卡片）在 agentCoreSkill.js。
 */
import { AgentLoop, withAttachedSkills } from '../../agent-core/index'
import {
  CHAYUAN_SERVER_ID,
  getEnabledMcpServers,
  isToolAllowedCrossHost,
  namespaceToolName
} from './mcpServerRegistry.js'
import {
  callLocalTool,
  healthz,
  listLocalTools,
  listUpstreamTools,
  syncUpstreamAllowlist
} from './mcpHttpClient.js'
import { createAgentCoreTransport } from './agentCoreTransport.js'
import { createMcpDocumentSkill, normalizeTodoList } from './agentCoreSkill.js'
import { detectAddonType, hostLabel } from '../../utils/host/hostType.js'
import { loadGlobalSettings } from '../../utils/globalSettings.js'
import { logEvent } from '../../utils/globalErrorLogger.js'

// 大文档（数千字 / 百行表格）一轮「校对 + 改写」常需多次工具调用；旧值 8 会让模型
// 撞上轮次上限而中断（见「已达到工具调用轮次上限」）。16→24：整篇写作（封面+目录
// +排版+保存）按系统提示词的批量纪律 ~8 轮可完成，模型碎步化时也有缓冲；正常校对/
// 改字流程走 proofread_run / document_apply_ops 单次调用，用不到这么多轮。仍撞上限
// 且 todo 有未完成项时由下方自动续跑兜底。
const MAX_ROUNDS = 24

// 回合启动提速：工具清单短 TTL 缓存。此前每回合都要 initialize + tools/list（本机
// 两个串行 HTTP 往返，上游 MCP 每个还要白名单同步 + 拉取，动辄数百 ms 起）——连续
// 对话时这些延迟全部叠加在首字之前。缓存 5 分钟内直接复用；白名单/启用状态变化最迟
// 5 分钟后生效，对工具目录这种准静态数据是可接受的窗口。
const TOOLS_CACHE_TTL_MS = 300_000
let localToolsCache = { at: 0, tools: null }
const upstreamToolsCache = new Map() // serverId → { at, tools }

async function listLocalToolsCached({ signal } = {}) {
  if (!localToolsCache.tools || Date.now() - localToolsCache.at > TOOLS_CACHE_TTL_MS) {
    const tools = await listLocalTools({ signal })
    localToolsCache = { at: Date.now(), tools }
  }
  return localToolsCache.tools
}

function listUpstreamToolsCached(serverId, { signal } = {}) {
  const hit = upstreamToolsCache.get(serverId)
  if (hit?.tools && Date.now() - hit.at <= TOOLS_CACHE_TTL_MS) return Promise.resolve(hit.tools)
  return listUpstreamTools(serverId, { signal }).then((tools) => {
    upstreamToolsCache.set(serverId, { at: Date.now(), tools })
    return tools
  })
}

// 模型对 tools 参数报错的特征（2026-11 同步上游 agent-core 后随降级模式一同退役：
// 不再整轮重跑 JSON 兼容协议，命中即在 localizeLoopError 转为引导文案）
const TOOLS_UNSUPPORTED_RE = /tool|tools|function call|不支持/i

// agent-core 循环守卫的终态错误前缀（localizeLoopError 同一清单）。这些错误文本
// 恰好都含 "tool"，若按正则判定会误认为「模型不支持 tools」——一次 Agent 离线
// 故障会被误报成模型不支持工具调用（PR6/H4 沿革）。
const LOOP_GUARD_ERROR_PREFIXES = [
  'Tool input was unusable',
  'Every tool call failed',
  'The model kept repeating'
]

/** 是否为「模型不支持 tools 协议」错误：守卫熔断类终态错误不算 */
function isToolsUnsupportedError(message) {
  const s = String(message || '')
  if (LOOP_GUARD_ERROR_PREFIXES.some(p => s.startsWith(p))) return false
  return TOOLS_UNSUPPORTED_RE.test(s)
}

/** 模型不支持 tools 协议时的用户引导文案（不再降级重跑，见 2026-11 同步说明） */
const TOOLS_UNSUPPORTED_GUIDANCE = '当前模型不支持工具调用（Function Calling），AI 助手无法执行文档操作；请在「设置 → 模型设置」中更换支持工具调用的模型。'

/**
 * 活动文档上下文采集（I4 上下文注入，治"文档1/文档2 对话输出一样"）：
 * 三宿主各采 名称+结构性摘要，随 system 注入——模型每回合都知道自己在为
 * 哪个文档服务。全部 try 包裹（采集失败不阻塞回合），采样小、可截断。
 */
function collectActiveDocumentContext(host) {
  const app = window.Application
  if (!app) return null
  const clip = (v, n = 120) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n)
  try {
    if (host === 'et') {
      const wb = (() => { try { return app.ActiveWorkbook || null } catch (_) { return null } })()
      if (!wb) return null
      const name = String(wb.Name || '')
      let sample = ''
      try {
        const ws = app.ActiveSheet
        const ur = ws?.UsedRange
        const addrRaw = ur?.Address
        const addr = String(typeof addrRaw === 'function' ? addrRaw.call(ur) : (addrRaw || ''))
        const cells = []
        for (let r = 1; r <= 3 && cells.length < 8; r++) {
          for (let c = 1; c <= 4 && cells.length < 8; c++) {
            // Cells.Item 是方法，必须调用取值（I4 终验实证：漏括号会把
            // "function Value() { [native code] }" 当采样值注入）
            const cell = ws?.Cells?.Item(r, c)
            const v = typeof cell?.Value === 'function' ? cell.Value() : cell?.Value
            if (v !== undefined && v !== null && String(v).trim() !== '') cells.push(String(v))
          }
        }
        sample = [addr, cells.join(' | ')].filter(Boolean).join('；头几格：')
      } catch (_) { /* 采样失败仅降级 */ }
      return { kind: '工作簿', name, sample }
    }
    if (host === 'wpp') {
      const pres = (() => { try { return app.ActivePresentation || null } catch (_) { return null } })()
      if (!pres) return null
      const name = String(pres.Name || '')
      let sample = ''
      try {
        const n = Number(pres.Slides?.Count || 0)
        let firstTitle = ''
        try { firstTitle = clip(pres.Slides.Item(1).Shapes.Title.TextFrame.TextRange.Text, 60) } catch (_) { /* 无标题页 */ }
        sample = `${n} 页${firstTitle ? '；首页标题：' + firstTitle : ''}`
      } catch (_) { /* 采样失败仅降级 */ }
      return { kind: '演示文稿', name, sample }
    }
    const doc = (() => { try { return app.ActiveDocument || null } catch (_) { return null } })()
    if (!doc) return null
    const name = String(doc.Name || '')
    let sample = ''
    try { sample = clip(doc.Range(0, 240).Text) } catch (_) { /* Range 不可用仅降级 */ }
    return { kind: '文档', name, sample }
  } catch (_) {
    return null
  }
}

function buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent, previousTodos, host = 'wps', docCtx = null, attachmentCtx = '', attachedSkillCount = 0, personaSystemPrompt = '', roundBudget = 0 }) {
  const sel = selectionCtx || {}
  const hasSel = !!sel.hasSelection
  const pendingPrev = (Array.isArray(previousTodos) ? previousTodos : [])
    .filter(t => t && t.status !== 'completed' && String(t?.content || '').trim())
  const isEt = host === 'et'
  const isWpp = host === 'wpp'
  const targetNoun = isEt ? '工作簿' : isWpp ? '演示文稿' : '文档'
  const hostDomainHint = isEt
    ? '【表格工具】一律用 spreadsheet(action=…) 操作当前工作簿：读值 range_read / used_range，读选区 selection_read（用户说「选中的内容」时直接调用，无需反问区域），写值 range_write（values 二维数组，"=…" 自动成为公式），改外观 format（style 对象），结构 row_insert|column_insert|sheet_add|sheet_rename，排序筛选 sort|autofilter，图表 chart_add，插图 picture_add（浮动图片，anchor 可选），导出 export(format=pdf|csv)。改数值严禁用 format；改外观严禁用 range_write。'
    : isWpp
      ? '【演示工具】一律用 presentation(action=…) 操作当前演示文稿：读 slide_list|slide_read|shape_list，改字 text_replace（全页查替）| text_set（需 shapeIndex），加页 slide_add（layout: title|text|titleOnly|blank），插对象 textbox_add|picture_add|table_add（单位磅），删/复制/移页 slide_delete|slide_duplicate|slide_move，导出 export(format=pdf|images)，放映 slideshow_run。'
      : '【版式对象】layout / nav / toc / bookmark / table / image / hyperlink / headerfooter / watermark / export — 一律带 action。'
  const docCtxLine = docCtx
    ? `【当前${targetNoun}实况】名称「${docCtx.name}」${docCtx.sample ? '；' + docCtx.sample : ''}。本对话服务于且仅服务于这个${targetNoun}：回答与生成必须以此${targetNoun}的实际内容为准，用户未指明时不要臆造其它同名/模板${targetNoun}的内容。`
    : ''
  const lines = [
    `你是察元助手页内的${hostLabel(host)}宿主文档智能体。通过 MCP 工具操作当前${targetNoun}与其它已配置的 HTTP MCP 服务。`,
    // 助手人格（P0-1 注入点）：助手 agent 化后 systemPrompt 在此层拼接——与 attachedSkill
    // 不同（attached-skills.ts 只进首条消息、且会被历史裁剪/压缩吞掉），persona 进 system
    // 层在自动续跑/压缩后依然存活。层级：人格只定义本轮任务语义与交付要求；与
    // 【仅当前文档】等宿主安全纪律冲突时，纪律优先。
    personaSystemPrompt
      ? `【本轮助手人格】你正在以以下助手身份执行任务，任务语义与交付要求以下述定义为准：\n${String(personaSystemPrompt).slice(0, 6000)}\n（人格定义不影响上方宿主纪律——写回目标、仅当前${targetNoun}、写锁语义一律以纪律为准。）`
      : '',
    docCtxLine,
    '工具名带服务器前缀，格式 serverId__toolName（例如 chayuan__proofread_run）。调用时必须使用完整前缀名。',
    // 轮次纪律（2026-11-21 提速裁决）：碎片化轮数大头是模型行为——并行提交独立
    // 工具、生成类一轮成文、无必要不 todo/locate。提示治本，预算封顶治标。
    (roundBudget && roundBudget <= 6
      ? '轮次纪律：本任务预算仅 6 轮。第一轮就用一次写入工具提交全部正文；封面/目录/排版等独立操作在同一轮并行提交工具调用，或最迟次轮完成；不要调用 todo_write/locate 等准备性工具，除非确有必要。'
      : '轮次纪律：相互独立的工具调用在同一轮并行提交；写文档类任务一轮成文，不要把一次写入拆成多轮小调用；todo_write 只在多步任务里使用。'),
    isEt || isWpp
      ? `优先使用 chayuan__${isEt ? 'spreadsheet' : 'presentation'} 工具完成任务；可用 assistants_search / assistants_get 获取助手配方。`
      : '优先使用 chayuan__ 文档/校对工具完成文档任务；可用 assistants_search / assistants_get 获取助手配方后再用 document_* 落文档。',
    '禁止调用 declassify_*。写操作直接执行（confirmed 由系统自动处理）；较大范围的修改可先预览再落笔。',
    `【仅当前${targetNoun}】所有操作都在当前打开的${targetNoun}中完成。禁止新建文件、从模板另开文件、打开临时文件、切换活动对象或启动/重启应用；不得借助其它 MCP 服务绕过。用户要求生成内容，不等于授权创建窗口；即使明确要求新建，也请用户手动新建并打开后再继续。`,
    isEt
      ? '【写值落点】先用 spreadsheet(action=used_range 或 range_read) 确认现状与落点，再 range_write 写入；空白表直接从 A1（或用户指定单元格）写，有数据时保留原数据、写到用户指定区域或数据末尾下方，不得先清空已有数据。'
      : isWpp
        ? '【改字落点】先用 presentation(action=slide_read) 定位页与形状，再 text_set/text_replace 修改；新增内容用 textbox_add/slide_add，不得清空已有页。'
        : '【写作落点】先用 document_meta / document_get_text 或 document_locate 确认当前内容与落点，再用 document_insert 或 document_apply_ops 写入；空白文档可直接输入，有正文时保留原文，按用户指定选区/位置插入，未指定则追加到文末，不得为写作先清空全文。',
    host === 'wps'
      ? '【整篇写作·批量成稿】从零写整篇文章（如「写一篇…，1000字以上，带目录/封面，排版规范」）必须按批量打法控制轮次，全任务目标 ≤10 轮：① 计划：todo_write 列清单（正文→排版→标题样式→目录→封面→保存），与首个写工具同轮并行提交；② 正文：少量大块 document_insert(position=append) 写入（单块 text 可含多个 \\n 分段、≥400 字），严禁逐段一调用一插入；③ 统一正文排版：format_run(scope=document，字体/字号) 与 format_para(scope=document，行距/首行缩进/对齐) 同轮各一次；④ 各级标题：style_apply 套标题样式，多个标题在同一轮并行提交（一条消息多个调用），严禁一个标题占一轮；⑤ 目录：一律 toc_insert 自动目录域（基于标题样式、置于正文之前），严禁手写「一、…… 1」目录文本行再回头删，页码变动用 toc_update 刷新；⑥ 封面一轮完成：document_insert(position=prepend) 主副标题 + format_run 大字号加粗 + format_para 居中 + break_insert(kind=page) 分页；⑦ document_save 收尾。'
      : '',
    `【没有${targetNoun}或桥接失败】当前没有打开${targetNoun}时停止操作，提示用户手动打开目标文件后重试；工具失败不得以新建、重新打开文件或重启宿主作为恢复手段。`,
    `【对话↔文档绑定】本对话只服务于发起它的${targetNoun}。若执行层校验发现活动文档与本对话不一致（错误含 DOC_MISMATCH/文档不一致字样），如实告知用户"对话与当前文档不匹配，已停止"，请用户切回对应文档或开启新对话；绝不要尝试改写、移动或另存文件来"绕过"校验。`,
    isEt
      ? '【跨宿主】可只读其它宿主作数据源，但只写当前工作簿（写其它宿主会被身份校验拦截）。需要演示稿/文档内容时用 presentation(action=slide_list|slide_read) / document_get_text 只读提取。'
      : '',
    isEt
      ? '【表格配图】用户要「生成图片/插图并放入表格」时：先 chayuan__generate_image 生成（描述注明风格与配色），成功后立即 spreadsheet(action=picture_add) 插入（path 用生图返回的本地路径；anchor 可选锚定单元格，width/height 可选磅）。也可 image_search 网络搜图后 picture_add 插入真实照片。两步在同一轮并行不可行时按序执行，完成汇报注明插入位置。'
      : '',
    isWpp
        ? (() => {
            let src = 'auto'
            try { src = String(loadGlobalSettings()?.imageSource || 'auto') } catch (_) { /* 设置读不到按 auto */ }
            const imgLines = {
              auto: '【配图·三级生图】需要插图时依次尝试：① generate_image（按「默认设置→图像生成」启用的模型依次尝试，本机服务兜底）② image_search（网络搜图：自动按「默认设置→网络资源搜索」启用的 Serper/Pexels/Pixabay 等优先，必应/Openverse 免Key兜底）③ presentation(action=svg_add) 内联矢量图形兜底。上级来源失败（返回 ok:false）才降级下一级，禁止跳级硬试；插画/图标/抽象背景用 ①③，真实照片/实物用 ②。',
              model: '【配图·模型生图】插图一律 generate_image 生成（按「默认设置→图像生成」启用的模型依次尝试；描述注明风格与配色），失败改 presentation(action=svg_add) 矢量兜底；禁止改用 image_search。',
              web: '【配图·网络搜图】插图一律 image_search 搜索（自动按「默认设置→网络资源搜索」启用的资源优先，免Key兜底）后 presentation(action=picture_add) 插入，失败改 presentation(action=svg_add) 矢量兜底；禁止改用 generate_image。',
              svg: '【配图·矢量优先】插图一律 presentation(action=svg_add) 内联矢量图形（每个图形一个语义单元：图标/图示/装饰，单个 ≤1.5k 字符，一页 2-4 个），不用搜图/生图。'
            }
            const crossHost = '【跨宿主】可只读其它宿主作内容源，但只写当前演示文稿。需要 Word 内容用 document_get_text 只读提取（文档转 PPT），需要表格数据用 spreadsheet(action=range_read) 只读提取；首次写入前系统会自动校验目标身份，无需你处理。'
            return crossHost + (imgLines[src] || imgLines.auto)
          })()
        : '',
    '【任务清单·搭车提交】预计要调用 ≥2 次工具的回合（含「生成+插入+排版」类组合，如生成图片再插入再叠文字）都必须用清单：把 todo_write（列出完整计划、首项置 in_progress）与首项的第一个真实工具调用放在同一条消息里并行提交，严禁让 todo_write 单独占用一轮；此后每推进一项，把 todo_write（更新状态）与该项的真实工具调用同轮并行提交，同样严禁单独发一轮 todo_write；同一时刻至多一项 in_progress；严禁做完后一次性补写清单。真正单一的请求（一问一答、单次工具能完成）不要用 todo_write。',
    '【思维导图】用户要「思维导图/脑图/知识结构/结构梳理」时调 chayuan__generate_mindmap（一次性提交整棵树 {label, children:[…]}，标签用内容原语言短语），返回的 Mermaid 源码可直接贴出或按需写入文档；严禁用普通列表假装脑图。',
    host === 'wps'
      ? '【错别字 / 校对 / 语法检查】必须一次调用 chayuan__proofread_run(dryRun:true, scope=document 或 selection) 完成：它内部已自动分块、逐段调校对模型并返回 issues。严禁改用 document_chunks 自己逐段读再找错字——那样既慢，又会把整轮对话的轮次耗光、撞上轮次上限。'
      : '',
    host === 'wps'
      ? '【改正错别字·多处】一次改多处必须用 document_apply_ops(action:"replace", operations:[{originalText,outputText},…]) 单次批量替换——每条 originalText 自动定位、最多 200 条；同一处的正文/拼音等都作为不同 operation 一起提交。严禁「逐条 document_locate 再 document_replace」：N 处错字 = N×2 次调用，必然撞上轮次上限。仅改单处且原文已知时才用 document_replace。'
      : '',
    host === 'wps'
      ? '【写新内容≠替换】往文档里写新段落 / 新章节（起草、续写、扩写、按清单逐段落稿）必须用 document_insert（锚点定位插入）或 document_apply_ops 的 insert/insert_after 类操作；严禁用 document.replace / document_replace 写新内容——replace 只能替换文档中已存在的原文（originalText 必须先经 document.locate 或读取确认存在），空文档或定位不到原文时会全部 LOCATE_NOT_FOUND / LOCATE_MISMATCH 失败，一段都写不出去。长文按「先骨架（标题+空段落）→ 逐段 insert 填充」推进。'
      : '',
    host === 'wps'
      ? '【排版前先读】查每段字体/字号/样式/对齐/行距现状（只读）→ format_read（scope=document 或锚点；granularity=runs 看段内混排明细）；设置才用 format_run/format_para/style。用户给出排版规范（如「按438c/公文格式」）时：format_read 摸清现状 → 逐类 format_apply_ops/style 批量设置 → format_read 复核。'
      : '',
    host === 'wps'
      ? '【排版规范缺省口径】用户要求「排版要规范 / 公文格式 / 红头文件 / 按规范排版」却未给出具体字体字号时，默认按党政机关公文格式（GB/T 9704）执行并在完成汇报里说明所采用口径：正文三号(16磅)仿宋_GB2312、一级标题黑体三号、二级标题楷体三号、三级及以下仿宋三号加粗、行距固定值28磅、首行缩进2字符、页边距上3.7cm下3.5cm左2.8cm右2.6cm。标题落地必须两步走：先 style(action=apply) 套「标题 1/标题 2」（保目录域可用），再 format_run 直接指定字体+字号+黑色+加粗（覆盖主题样式的默认字体颜色，避免视觉与公文预期不符）。用户显式给出字体字号口径时以用户为准。'
      : '',
    host === 'wps'
      ? '【封面页做法】要求「带封面」时：封面=WPS 文档没有专用封面页工具，用组合模拟——首行主标题（黑体或小标宋，初号/48磅，加粗，居中），空一行副标题（楷体，三号，居中），落款（日期，仿宋，居中），然后 break.insert 分页；完成汇报里注明「封面为标题页模拟」。'
      : '',
    host === 'wps'
      ? '【改样子≠改字】加粗/变色/字号/字体/删除线/拼音 → format_run 或 format_apply_ops；对齐/行距 → format_para；标题样式 → style(action=apply)。严禁用 document_replace 做加粗变色。'
      : '',
    host === 'wps'
      ? '【批注/修订】comment(action=list|add|delete) / revision(action=mode|list|apply)；写操作 confirmed:true。'
      : '',
    pendingPrev.length
      ? `【沿用清单】上一轮任务清单尚有未完成项：${pendingPrev.map(t => t.content).join('；')}。把 todo_write 重建该清单（用户已确认/已完成的部分标 completed，本轮要做的第一项置 in_progress）与本轮第一个真实工具调用同轮并行提交，沿用原清单继续执行，不要另立新清单。`
      : '',
    hostDomainHint,
    host === 'wps'
      ? '【改正正文·流程】proofread_run 返回后汇总问题；按用户选择走「写成批注」(proofread_apply_comments) 或「改正正文」出口，不要只用批注交差。'
      : '',
    host === 'wps'
      ? '【需要通读全文（翻译 / 改写 / 摘要）才用 document_chunks】每次 limit:8 尽量多读，cursor 只前进、不回退、不重读已读段落；读够立即停，把轮次留给写作工具，而不是反复分页。'
      : '',
    host === 'wps'
      ? (hasSel
          ? `当前有选区（约 ${sel.charCount || '?'} 字）。用户提到「这段/选中」时，scope 用 selection。选区摘要：${String(sel.preview || '').slice(0, 240)}`
          : '当前无选区，默认 scope=document。')
      : '',
    // ET 选区存在性注入（与 wps 同等待遇；selectionCtx 的 ET 侧此前从未进过提示词）：
    // 模型据此「自动」想到 selection_read，不再反问用户区域
    isEt
      ? (sel.selectionAddress
          ? `当前有选区 ${sel.selectionAddress}${sel.selectionRows && sel.selectionCols ? `（约 ${sel.selectionRows}×${sel.selectionCols} 格）` : ''}。用户提到「选中的内容」等指代时，先调 spreadsheet(action=selection_read) 读取选区值再分析，不要反问区域。`
          : '当前选区未知。用户提到「选中的内容」时，先调 spreadsheet(action=selection_read) 获取当前选区（它会返回选区地址与值，含无选区时的提示），不要臆造区域。')
      : '',
    sel.fileName ? `当前文件：${sel.fileName}` : '',
    kbBound ? '用户已绑定知识库：需要事实依据时先 chayuan__kb_retrieve。' : '',
    // 附件上下文（此前 MCP 管线完全丢失附件信息：模型只知当前文档，会反问用户要附件）
    attachmentCtx
      ? `【用户本轮上传的附件】面板已收到以下附件并提取了正文，视为本任务的直接可用输入，禁止向用户索要附件或质疑其存在：\n${String(attachmentCtx).slice(0, 20000)}\n如需更完整的原文，调 chayuan__file_parse，paths 传「附件1」等附件别名（发送后 30 分钟内有效）。`
      : '',
    proofreadIntent === 'fix' ? '本轮用户意图偏「改正正文」。' : '',
    proofreadIntent === 'check' ? '本轮用户意图偏「检查/批注」。' : '',
    // 附加技能（技能库收割）：技能正文是通用写法（收割自上游 GenOffice 推荐技能库），
    // 指称到本环境实际工具的映射在此一次性说明，避免逐篇改写技能文本
    attachedSkillCount > 0
      ? `【附加技能指称映射】本轮用户附加了 ${attachedSkillCount} 个技能（见消息前部的 <skill> 块；技能与通用指导冲突时，以技能为准）。技能文本中的指称按此映射落地：
- 「本环境可用的文档工具 / the document tools」→ chayuan__document_* / format_* / style / comment / revision 等域工具；「写回当前文档」即写当前活动文档。
- 「本环境可用的表格工具 / the spreadsheet tools」→ chayuan__spreadsheet(action=…)；「工作簿」即当前工作簿。
- 「本环境可用的演示工具 / the slide tools / presentation tools」→ chayuan__presentation(action=…)；「演示文稿」即当前演示文稿。
- 「本环境可用的搜索工具 / the search tool」→ chayuan__web_search（网页文本搜索，返回标题/链接/摘要清单；需事实依据时先搜再引用来源链接。无可用搜索资源或搜索失败时，改为向用户索取资料，严禁编造来源）。
技能正文中的交付落稿要求同样受【仅当前${targetNoun}】纪律约束。`
      : ''
  ]
  return lines.filter(Boolean).join('\n')
}

function inferProofreadIntent(userText) {
  const t = String(userText || '')
  if (/(修改|改正|改掉|纠正|修正).{0,8}(错别字|别字|错字|拼写)|把.{0,6}(错别字|别字).{0,6}(改|修)/.test(t)) {
    return 'fix'
  }
  if (/(检查|核对|查找|找出|看看|标出|批注).{0,8}(错别字|别字|错字|拼写|语法)/.test(t) || /错别字|校对/.test(t)) {
    return 'check'
  }
  return 'unknown'
}

/** agent-core 退避守卫的英文终态信息 → 中文（前缀匹配，未命中原样透出） */
function localizeLoopError(message) {
  const s = String(message || '')
  if (s.startsWith('Tool input was unusable')) {
    return '连续多次工具入参无法解析（截断或非法 JSON），已中止本次执行；请重试或把操作拆小。'
  }
  if (s.startsWith('Every tool call failed')) {
    return '连续多轮工具调用全部失败，已停止；请检查文档状态后重试。'
  }
  if (s.startsWith('The model kept repeating')) {
    return '模型连续重复相同操作且无进展，已停止；请换个说法或更换模型重试。'
  }
  if (isToolsUnsupportedError(s)) {
    return TOOLS_UNSUPPORTED_GUIDANCE
  }
  return s
}

function abortError() {
  const err = new Error('已停止')
  err.name = 'AbortError'
  err.code = 'ABORTED'
  return err
}

/** 失败工具结果的 output 是 JSON 信封，进度步骤里只展示 message 字段 */
function toolErrorDetail(output) {
  try {
    const parsed = JSON.parse(output)
    return String(parsed?.message || output)
  } catch {
    return String(output || '')
  }
}

function seedHistoryFrom(historyMessages) {
  return (historyMessages || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-8)
    .map(m => (m.role === 'user'
      ? { role: 'user', text: String(m.content) }
      : { role: 'assistant', text: String(m.content) }))
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   fallback?: boolean,
 *   reason?: string,
 *   content?: string,
 *   steps?: Array,
 *   proofreadCard?: object|null,
 *   usedServers?: string[],
 *   todos?: Array
 * }>}
 */
export async function runMcpChatOrchestrator({
  userText,
  model,
  selectionCtx = null,
  attachmentCtx = '',
  kbBound = false,
  kbBinding = null,
  historyMessages = [],
  previousTodos = [],
  writeBaselineToken = '',
  // Model S：回合绑定文档身份（对话三件套），透传 agentCoreSkill 随写工具注入 __docLinkId
  targetDocLinkId = '',
  targetDocumentId,
  loopHistory = [],
  // 附加技能（技能库收割，2026-11）：[{ name, body }]，调用方已按上限整形
  // （≤4 个、单条正文 ≤16KB，见 src/utils/skillLibrary.js buildAttachments）。
  // 仅该条消息携带（withAttachedSkills 包进驱动指令），追问不带——上游同语义。
  attachedSkills = [],
  // 助手人格（助手 agent 化 P0-1）：助手 systemPrompt 经此进入 system 层，
  // 自动续跑/压缩后依然存活（区别于 attachedSkills 只进首条消息）
  personaSystemPrompt = '',
  signal,
  onProgress,
  onTurnText,
  // 思考流（对话栏实时思考区）：reasoning 增量 (delta, acc) 透传给调用方
  onTurnReasoning,
  // 分档轮数预算（2026-11-21 用户裁决 A）：生成类 6 / 改写类 12 / 缺省 MAX_ROUNDS。
  // 每轮 = 一次模型调用全额延迟，任务自适应预算比全局砍上限更治本
  roundBudget = 0,
  // 思考模式开关（用户可控）：false=智谱系模型注入 thinking disabled（快速出结果）
  thinkingDisabled = false,
  // ToolDisplay 增量回调（2026-11-25「图像先输出到对话」）：每个带 display 的工具
  // 执行完立即回调（生图完成即上屏，不等回合结束）；d = display 对象
  onToolDisplay = null,
  // 视觉输入（上游 AgentImage 收割对接，2026-11-25）：附件图片 base64 数组
  // [{base64(裸), mime}]，随首条 user 消息进模型（loop.run 第二参）；上限由调用方
  // 把关（面板 ≤2 张、单张 ≤1.5MB）。模型不支持 vision 时回合报 model_error——
  // 返回体带 usedImages 标记，调用方提示用户换支持视觉的模型
  images = null,
  onTodos,
  onSnapshot
} = {}) {
  const steps = []
  const turnLogT0 = Date.now()
  logEvent('mcp_turn_start', {
    model: String(model?.name || model?.modelId || ''),
    servers: (getEnabledMcpServers() || []).map(s => s.id).join(','),
    textPreview: String(userText || '').slice(0, 80)
  })
  // 种子清单（助手 agent 化）：调用方预置的任务清单起步——UI 立即可见进度，
  // 模型 todo_write 后整卡覆盖；工具成功时的「代推进」从这里的第一项开始
  let todos = (Array.isArray(previousTodos) && previousTodos.length)
    ? previousTodos.map((t, i) => ({ ...t, status: i === 0 ? 'in_progress' : (t.status || 'pending') }))
    : []
  if (todos.length) onTodos?.(todos.slice())
  // 执行过的工具名集合（A-2 写回契约检测：expectedWriteTool 是否被模型执行）
  const executedToolNames = new Set()
  // ToolDisplay 侧信道采集（上游 types.ts 契约：UI-only，永不进 LLM 上下文）：
  // 生图/搜图带 images 网格、思维导图带 mindmap 树——面板据此渲染缩略图/图卡
  const toolDisplays = []
  // 代推进作用域闸（2026-11-21 冒烟 S22 回归修复）：代推进只作用于【调用方种子清单】。
  // 模型 todo_write 接管清单后以模型为准——模型对自己清单的诚实状态是「轮次上限+
  // 未完成 → 自动续跑」的触发依据；代推进若继续越权标记完成，会把实际未做的项
  // 假标完成（24 个 locate「做完」了排版/目录），续跑门永不触发，撞上限的回合以
  // 中断文案收尾而非补完交付。
  let modelOwnsTodos = false
  const pushStep = (label, detail = '') => {
    const step = { at: Date.now(), label, detail }
    steps.push(step)
    onProgress?.(step, steps.slice())
  }
  // 长任务（proofread）实时进度：原地更新同一条进度步骤，避免在步骤列表里堆积重复行。
  const pushProgress = (info) => {
    const last = steps[steps.length - 1]
    if (last && last.__progress) {
      last.label = info.label
      last.detail = info.detail
      last.progress = info.progress
      last.at = Date.now()
      onProgress?.(last, steps.slice())
    } else {
      const step = { at: Date.now(), label: info.label, detail: info.detail, progress: info.progress, __progress: true }
      steps.push(step)
      onProgress?.(step, steps.slice())
    }
  }

  const hz = await healthz({ signal })
  if (!hz.online) {
    return { ok: false, fallback: true, reason: 'sidecar_offline', steps }
  }
  // sidecar 在线但 WPS 加载项未注册（长轮询断开）：所有文档工具都会返回
  // WPS_AGENT_OFFLINE。提前失败，避免模型连续多轮撞同一错误、烧完轮次上限
  // 才放弃（实测 DeepSeek 会反复重试 wps_launch/proofread_run 6 轮）。
  if (hz.ok && hz.agentOnline === false) {
    pushStep('察元AI服务未连接', '本机服务在线，但察元AI加载项未注册，文档工具不可用')
    return {
      ok: false,
      fallback: true,
      reason: 'agent_offline',
      content: '察元AI与文档的桥接未连接（服务离线）：本机服务正常，但察元AI加载项没有注册。请重启应用（或重开文档窗口）让加载项重新连接后重试。',
      steps,
      usedServers: []
    }
  }

  const enabled = getEnabledMcpServers()
  if (!enabled.length) {
    return { ok: false, fallback: true, reason: 'no_servers', steps }
  }

  const mergedTools = []
  const usedServers = []

  // 回合启动握手并行化：本机 tools/list、上游白名单同步 + 各上游 tools/list 三路
  // 同时发起（此前严格串行——上游一多，每个都要等前一个完成才开跑）。步骤日志在
  // 全部落定后按 enabled 原顺序补齐，保持 UI 步骤顺序稳定。
  const localServer = enabled.find(s => s.id === CHAYUAN_SERVER_ID)
  const upstreamServers = enabled.filter(s => s.id !== CHAYUAN_SERVER_ID)
  const [localResult, upstreamResults] = await Promise.all([
    localServer
      ? listLocalToolsCached({ signal }).then(tools => ({ tools }), error => ({ error }))
      : Promise.resolve(null),
    upstreamServers.length
      ? syncUpstreamAllowlist({ signal })
        .then(() => Promise.all(upstreamServers.map(s =>
          listUpstreamToolsCached(s.id, { signal }).then(
            tools => ({ server: s, tools }),
            error => ({ server: s, error })
          )
        )))
        .catch(error => upstreamServers.map(s => ({ server: s, error })))
      : Promise.resolve([])
  ])
  const perServerTools = new Map()
  if (localServer) {
    perServerTools.set(CHAYUAN_SERVER_ID, localResult.error ? { error: localResult.error } : { tools: localResult.tools })
  }
  for (const r of upstreamResults) {
    perServerTools.set(r.server.id, r.error ? { error: r.error } : { tools: r.tools })
  }
  for (const server of enabled) {
    const r = perServerTools.get(server.id)
    if (!r) continue
    if (r.error) {
      pushStep(`跳过 ${server.name || server.id}`, r.error.message || String(r.error))
      continue
    }
    for (const t of r.tools) {
      if (server.id === CHAYUAN_SERVER_ID && !isToolAllowedCrossHost(t.name)) continue
      mergedTools.push({
        name: namespaceToolName(server.id, t.name),
        description: `[${server.name}] ${t.description || t.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} }
      })
    }
    usedServers.push(server.id)
    if (server.id === CHAYUAN_SERVER_ID) {
      pushStep('已连接察元 MCP', `${r.tools.length} 个工具（白名单后 ${mergedTools.filter(x => x.name.startsWith(`${CHAYUAN_SERVER_ID}__`)).length}）`)
    } else {
      pushStep(`已连接 ${server.name}`, `${r.tools.length} 个工具`)
    }
  }

  if (!mergedTools.length) {
    return { ok: false, fallback: true, reason: 'no_tools', steps }
  }

  // 空/已取消请求直接按旧契约短路（loop.run 对空指令是 no-op，会悬挂）
  if (!String(userText || '').trim()) {
    return { ok: false, fallback: true, reason: 'model_error', content: '空请求', steps, usedServers }
  }
  if (signal?.aborted) throw abortError()

  const proofreadIntent = inferProofreadIntent(userText)
  const host = detectAddonType()
  const docCtx = collectActiveDocumentContext(host)
  const attachedSkillCount = Array.isArray(attachedSkills) ? attachedSkills.filter(s => s && s.name && s.body).length : 0
  const system = buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent, previousTodos, host, docCtx, attachmentCtx, attachedSkillCount, personaSystemPrompt, roundBudget })
  const seed = seedHistoryFrom(historyMessages)
  let proofreadCard = null

  // 首次变更前快照（PR7）：loop 在第一个 mutating 工具执行前调用；页面直读
  // WPS API 取全文，供消息卡「撤销本次修改」一键回滚。读不到文档返回 undefined。
  // 超长文档同步读全文会卡住 WebView 主线程（整秒级），此时放弃快照——撤销卡
  // 优雅降级（不显示），不为极端大文档牺牲整轮流畅度。
  const SNAPSHOT_MAX_TEXT_CHARS = 200_000
  const captureDocSnapshot = () => {
    try {
      const doc = window.Application?.ActiveDocument
      if (!doc) return undefined
      const text = String(doc.Content?.Text || '')
      if (text.length > SNAPSHOT_MAX_TEXT_CHARS) return undefined
      // ⚠️ 文件级备份已移除（WPS 崩溃源）：在 AgentLoop 写工具钩子时机执行
      // doc.Save()+文件复制（重 COM 操作）在 ksojscore 引擎内触发 SIGBUS
      // （17:11/17:30/17:41 三崩同栈 ksojscore+jswpsapi+wpsapi）。撤销功能挂账
      // 重设计（写后异步备份或 WPS 内建 undo）。快照仅保留文本（一致性校验），
      // backupId 缺省 → 撤销卡提示「暂不可用」，绝不走文本回写。
      return {
        docId: String(doc.FullName || doc.Name || ''),
        text,
        backupId: '',
        at: Date.now()
      }
    } catch {
      return undefined
    }
  }

  // 跨回合上下文（PR7）：上回合序列化的 loop.messages 原样 restore——上一轮读过的
  // 文档内容、工具结论全部保留，追问「刚才第二段改成什么了」可答；8 条种子窗口
  // 降级为无 loopHistory 时的兜底。compaction 打开（预算收紧），超长自动摘要。
  const restoreHistory = (loop) => {
    if (Array.isArray(loopHistory) && loopHistory.length) {
      try {
        loop.restore(loopHistory)
        return
      } catch { /* 损坏历史回落种子窗口 */ }
    }
    if (seed.length) loop.restore(seed)
  }

  // 跑一轮完整的 agent 循环。settle 为 { result }（onDone）或 { error: string }（onError）。
  // opts 供自动续跑复用：systemPrompt 覆盖领域提示词（如按未完成 todo 重建「沿用清单」）、
  // restoreMessages 直接恢复上一 loop 的完整历史、runText 换驱动指令、phaseLabel 标注
  // 进度步骤（「续跑」）。默认值 = 原始单轮行为。
  let loopRef = null
  const runLoop = (opts = {}) => new Promise((resolve) => {
    let onAbort = null
    const settle = (value) => {
      if (onAbort) signal?.removeEventListener?.('abort', onAbort)
      resolve(value)
    }
    const skill = createMcpDocumentSkill({
      systemPrompt: opts.systemPrompt || system,
      mergedTools,
      pushProgress,
      writeBaselineToken,
      writeDocLinkId: targetDocLinkId,
      targetDocumentId,
      kbBinding,
      onTodoWrite: (list) => {
        todos = normalizeTodoList(list)
        // 模型接管清单：此后代推进闸关闭（诚实清单状态是续跑门的触发依据）
        modelOwnsTodos = true
        onTodos?.(todos)
      },
      onProofreadCard: (card) => {
        proofreadCard = {
          ...card,
          intent: proofreadIntent === 'unknown' ? 'check' : proofreadIntent
        }
      }
    })
    const loop = new AgentLoop({
      transport: createAgentCoreTransport({
        model,
        signal,
        thinkingDisabled,
        onTurnStart: (turnNo) => pushStep(`模型思考（第 ${turnNo} 轮${opts.phaseLabel ? ` · ${opts.phaseLabel}` : ''}）`, model?.name || model?.modelId || ''),
        // 思考流展示：reasoning 增量 200ms 节流，原地更新「模型思考」步骤的
        // detail（尾部 200 字）——用户在执行过程列表里看到具体思考内容
        onTurnReasoning: (() => {
          let buf = ''
          let lastAt = 0
          let stepPushed = false
          return (text) => {
            buf += String(text || '')
            // 调用方累计透传（对话栏思考区实时渲染）
            onTurnReasoning?.(String(text || ''), buf)
            const now = Date.now()
            if (now - lastAt < 200) return
            lastAt = now
            const tail = buf.slice(-200)
            if (!stepPushed) {
              stepPushed = true
              pushProgress?.({ label: '模型思考中', detail: tail, progress: 0 })
            } else {
              pushProgress?.({ label: '模型思考中', detail: tail })
            }
          }
        })()
      }),
      skill,
      events: {
        // 流式透出：每轮模型的累计文本实时回调（循环层 onDelta 累加），调用方借此
        // 在等待工具轮结束前就渲染模型的过程叙述，消除整轮死寂感
        onText: (text) => onTurnText?.(text),
        onToolStart: (call) => pushStep(`调用 ${call.name}`, JSON.stringify(call.input ?? {}).slice(0, 200)),
        onToolExecuted: ({ call, execution, snapshotBefore }) => {
          // 执行过的工具名收集（助手 agent 化 A-2 写回契约检测：expectedWriteTool
          // 是否真的被模型执行过，未执行由调用方兜底补写）。只记成功执行——失败的
          // 写调用（如 LOCATE_NOT_FOUND）计入会让兜底检测误判「已写回」（三审 P0-2）。
          if (call?.name && execution && !execution.isError) {
            executedToolNames.add(String(call.name))
            // 编排器代推进（任务清单节点标记修复）：真实工具成功后顺序推进清单——
            // in_progress 项标完成、下一 pending 置进行中。模型 todo_write 更新时
            // 以模型为准（覆盖）；模型忘记更新时由这里兜底（用户反馈清单节点停滞）。
            // 排除 todo_write/生图等客户端与媒体工具自身的清单操作。
            const toolName = String(call.name || '').replace(/^chayuan__/, '')
            if (todos.length && !modelOwnsTodos && toolName !== 'todo_write') {
              const ip = todos.findIndex(t => t && t.status === 'in_progress')
              if (ip >= 0) {
                todos[ip] = { ...todos[ip], status: 'completed' }
                const next = todos.findIndex(t => t && t.status === 'pending')
                if (next >= 0) todos[next] = { ...todos[next], status: 'in_progress' }
                onTodos?.(todos.slice())
              }
            }
          }
          const detail = execution.isError ? toolErrorDetail(execution.output) : String(execution.output || '')
          pushStep(`${execution.isError ? '失败' : '完成'} ${call.name}`, detail.slice(0, 160))
          // 侧信道展示数据（images/mindmap）透传面板（成功执行才带）——
          // 增量回调让图片「生成完立即上屏」，不等回合收尾
          if (execution && !execution.isError && execution.display) {
            const displayEntry = { tool: String(call?.name || ''), ...execution.display }
            toolDisplays.push(displayEntry)
            try { onToolDisplay?.(execution.display) } catch (_) { /* UI 回调失败不影响回合 */ }
          }
          // 首个写操作的写前快照透出给 UI（撤销卡数据源）
          if (snapshotBefore) onSnapshot?.(snapshotBefore)
        },
        onDone: (result) => settle({ result }),
        onError: (error) => settle({ error })
      },
      maxTurns: roundBudget > 0 ? Math.max(3, Math.min(roundBudget, MAX_ROUNDS)) : MAX_ROUNDS,
      maxHistory: Infinity, // 单轮编排内不裁历史；跨轮由 loopHistory restore + compaction 承接
      // 压缩预算收紧 + LLM 摘要默认禁用：跨回合上下文按轻量原则保留（128KB 时代每回合
      // 全量 prefill 旧工具输出，回合耗时随对话单调上涨；超阈值时的 LLM 摘要调用还会
      // 在下一回合开头同步阻塞最多 30s）。机械摘要零额外延迟，质量对本场景够用。
      // 设置项 aiCompactionLlmSummary:true 可开启 LLM 摘要（P2 审计项：上游能力
      // 默认闲置是成本权衡——开关化后需要时一行打开，不改默认行为）
      compaction: {
        maxBytes: 48 * 1024,
        keepRecentBytes: 16 * 1024,
        disableLlmSummary: (() => {
          try { return loadGlobalSettings()?.aiCompactionLlmSummary !== true } catch (_) { return true }
        })()
      },
      captureSnapshot: captureDocSnapshot
    })
    loopRef = loop
    if (Array.isArray(opts.restoreMessages) && opts.restoreMessages.length) {
      // 续跑：restore 上一个 loop 的完整历史（本回合读过的文档、工具结论全保留），
      // 不走 loopHistory/种子窗口兜底
      try {
        loop.restore(opts.restoreMessages)
      } catch { /* 损坏历史回落常规恢复 */ restoreHistory(loop) }
    } else {
      restoreHistory(loop)
    }
    onAbort = () => loop.cancel()
    if (signal && !signal.aborted) signal.addEventListener('abort', onAbort, { once: true })
    // 附加技能：包成 <skill name="…"> 块拼在本条驱动指令前（技能与通用指导冲突时技能
    // 赢，见 agent-core attached-skills.ts）。仅发起这条消息携带，续跑指令不重复注入。
    const runInstruction = attachedSkillCount > 0 && !opts.skipAttachedSkills
      ? withAttachedSkills(String(opts.runText ?? userText), attachedSkills)
      : String(opts.runText ?? userText)
    // 视觉输入只随首条 user 消息进模型（loop 会挂到消息 images 字段）；续跑 restore
    // 的历史里已含该消息，不再重传
    loop.run(runInstruction, Array.isArray(images) && images.length ? images : undefined)
  })

  let out = await runLoop()

  // 自动续跑：整篇写作等重任务撞轮次上限、但 todo 清单仍有未完成项时，自动再跑一段
  // （仅一次，成本护栏）——把「请用户手动说继续」变成系统行为。续跑 loop restore 本
  // 回合完整历史（工具结论保留、过期的轮次上限便签由 restore 剥离），以未完成清单为
  // 指令驱动；系统提示词按 pending 重建，激活「沿用清单」纪律。todo 为空说明模型没
  // 立清单，无从判断剩余项，也不续跑。
  let continued = false
  if (out.result?.turnLimit && !signal?.aborted) {
    const pending = todos.filter(t => t && t.status !== 'completed' && String(t.content || '').trim())
    if (pending.length && Array.isArray(loopRef?.messages) && loopRef.messages.length) {
      pushStep('轮次已达上限，仍有未完成任务，自动续跑', pending.map(t => t.content).join('；').slice(0, 160))
      const continueText = [
        '【系统续跑】上一段执行因轮次上限中断，以下任务尚未完成：',
        ...pending.map((t, i) => `${i + 1}. ${t.content}`),
        '请继续调用工具完成上述剩余任务；已完成的部分不要重做，全部完成后按惯例总结交付。'
      ].join('\n')
      out = await runLoop({
        systemPrompt: buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent, previousTodos: pending, host, docCtx, attachmentCtx, attachedSkillCount, personaSystemPrompt, roundBudget }),
        restoreMessages: loopRef.messages,
        runText: continueText,
        phaseLabel: '续跑',
        // 续跑指令不重复注入技能块（技能正文已在首段历史里，restore 完整保留）——
        // 此前这里没传、门恒开，续跑指令会重复携带 <skill> 块（2026-11-20 冒烟 S26 实证）
        skipAttachedSkills: true
      })
      continued = true
    }
  }

  if (typeof out.error === 'string' && out.error) {
    if (signal?.aborted) throw abortError()
    logEvent('mcp_turn_end', { outcome: 'model_error', ms: Date.now() - turnLogT0, steps: steps.length })
    // toolsUnsupported 标记（P0-4 双轨分流）：调用方据此 markModelFcUnsupported 并
    // 自动降级 direct 轨重跑，弱模型用户无感
    return {
      ok: false,
      fallback: true,
      reason: 'model_error',
      toolsUnsupported: isToolsUnsupportedError(out.error),
      content: localizeLoopError(out.error) + (Array.isArray(images) && images.length
        ? '\n（本回合携带了图片附件：若错误提示与图片/多模态相关，当前模型可能不支持视觉输入——请去掉图片后重试，或换支持视觉的模型。）'
        : ''),
      steps,
      usedServers,
      todos
    }
  }
  const r = out.result || {}
  if (r.cancelled || signal?.aborted) throw abortError()
  const fallbackText = r.turnLimit
    ? (continued ? '已自动续跑一段仍达到轮次上限，请根据上方步骤继续或重试。' : '已达到工具调用轮次上限，请根据上方步骤继续或重试。')
    : '已完成。'
  logEvent('mcp_turn_end', { outcome: r.turnLimit ? 'turn_limit' : 'ok', continued, ms: Date.now() - turnLogT0, steps: steps.length })
  // 供应商用量（P1 审计收割：transport onUsage 已接通，供应商回报时才存在——缺席
  // 语义，无网关 usage 不造假数）。随 mcp_turn_end 一起落日志，便于事后成本分析。
  if (r.usage && (r.usage.inputTokens || r.usage.outputTokens)) {
    logEvent('mcp_turn_usage', {
      input: r.usage.inputTokens ?? 0,
      output: r.usage.outputTokens ?? 0,
      cacheRead: r.usage.cacheReadTokens ?? 0,
      turns: continued ? 2 : 1
    })
  }
  return {
    ok: true,
    content: String(r.text || '').trim() || fallbackText,
    steps,
    executedTools: Array.from(executedToolNames),
    proofreadCard,
    usedServers,
    proofreadIntent,
    todos,
    usage: r.usage || null,
    toolDisplays,
    // 跨回合上下文：本回合结束后 loop 内的完整历史（含工具结论），调用方按 chat
    // 持久化，下回合经 loopHistory 参数 restore 回来
    loopMessages: trimLoopHistoryForStorage(loopRef?.messages || [])
  }
}

/**
 * 持久化裁剪：跨回合只带「轻上下文」。
 *
 * PR7 最初按 96KB 原样恢复全部 loop 历史（含工具输出），下一回合每轮模型请求
 * 都要全量 prefill 这些旧输出——回合耗时随对话长度单调上涨，连续对话越聊越慢。
 * 现按三层瘦身：
 *   1. 陈旧工具输出截断：最近 2 条 tool 消息保留较长原文（2000 字），更早的截到 500 字；
 *   2. assistant 消息剥离 reasoning（跨回合无上下文价值，纯占体积）；
 *   3. 尾部字节预算收紧到 ~24KB，且裁剪只落在安全头部（不允许孤立 tool 结果或
 *      带未回应 tool_calls 的 assistant 开头，保持 tool_use/tool_result 配对完整）。
 * 追问上一轮结论靠保留的助手结论文本即可，不需要整份工具输出。
 */
const STORE_TOOL_OUTPUT_RECENT = 2
const STORE_TOOL_OUTPUT_FULL_CHARS = 2000
const STORE_TOOL_OUTPUT_STALE_CHARS = 500

function slimLoopMessageForStorage(message, staleTool) {
  const m = message
  if (m?.role === 'tool') {
    const cap = staleTool ? STORE_TOOL_OUTPUT_STALE_CHARS : STORE_TOOL_OUTPUT_FULL_CHARS
    return {
      ...m,
      results: (m.results || []).map(r => {
        const output = String(r.output || '')
        return output.length > cap
          ? { ...r, output: `${output.slice(0, cap)}…(truncated for storage)` }
          : r
      })
    }
  }
  if (m?.role === 'assistant' && m.reasoning) {
    return { ...m, reasoning: undefined }
  }
  return m
}

function trimLoopHistoryForStorage(messages, maxBytes = 24 * 1024) {
  if (!Array.isArray(messages) || !messages.length) return []
  // 从尾部倒序数 tool 消息：最近 N 条完整保留，更早的截断输出
  let toolSeen = 0
  const slimmed = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'tool') {
      toolSeen++
      slimmed.unshift(slimLoopMessageForStorage(m, toolSeen > STORE_TOOL_OUTPUT_RECENT))
    } else {
      slimmed.unshift(slimLoopMessageForStorage(m, false))
    }
  }
  // 尾部字节预算：从尾部累计，超预算处定裁剪点
  let total = 0
  let cut = 0
  for (let i = slimmed.length - 1; i >= 0; i--) {
    let size = 0
    try { size = JSON.stringify(slimmed[i]).length } catch { size = 4096 }
    if (total + size > maxBytes) {
      cut = i + 1
      break
    }
    total += size
  }
  let kept = slimmed.slice(cut)
  // 安全头部：推进到 user 消息（或纯文本 assistant）开头，保证协议配对完整
  while (kept.length) {
    const head = kept[0]
    if (head?.role === 'user') break
    if (head?.role === 'assistant' && !Array.isArray(head.toolCalls)) break
    kept = kept.slice(1)
  }
  return JSON.parse(JSON.stringify(kept))
}

export async function applyProofreadComments(taskId, { maxComments = 30, signal } = {}) {
  return callLocalTool('proofread_apply_comments', {
    taskId,
    confirmed: true,
    maxComments
  }, { signal })
}

function collectReplacementsFromProofreadRaw(raw, scope = 'document') {
  const issues = []
  if (Array.isArray(raw?.issues)) {
    for (const item of raw.issues) {
      if (Array.isArray(item?.issues)) {
        for (const issue of item.issues) issues.push(issue)
      } else if (item && (item.text || item.original || item.suggestion)) {
        issues.push(item)
      }
    }
  }
  const replacements = []
  for (const issue of issues) {
    const find = String(issue?.text || issue?.original || '').trim()
    const replace = String(issue?.suggestion || '').trim()
    if (!find || !replace || find === replace) continue
    replacements.push({ find, replace, scope })
  }
  return replacements
}

export async function applyProofreadTextFixes(issuesPayload, { signal } = {}) {
  const ops = Array.isArray(issuesPayload?.ops) ? issuesPayload.ops : null
  if (ops?.length) {
    return callLocalTool('document_apply_ops', {
      ops,
      confirmed: true
    }, { signal })
  }
  let replacements = Array.isArray(issuesPayload?.replacements) ? issuesPayload.replacements : []
  if (!replacements.length && issuesPayload?.raw) {
    replacements = collectReplacementsFromProofreadRaw(issuesPayload.raw, issuesPayload.scope || 'document')
  }
  const results = []
  for (const r of replacements.slice(0, 40)) {
    const originalText = String(r.find || r.originalText || '').trim()
    const newText = String(r.replace ?? r.newText ?? '')
    if (!originalText || newText === originalText) continue
    // eslint-disable-next-line no-await-in-loop
    const out = await callLocalTool('document_replace', {
      originalText,
      newText,
      confirmed: true
    }, { signal })
    results.push(out)
  }
  return { ok: true, count: results.length, results }
}

export { inferProofreadIntent }
