/**
 * Writer（wps 宿主）车道场景：61 个文档场景（W01–W61，7 组文档）+ 5 个平台/跨宿主场景（X 组）。
 * 覆盖：文档元信息/读写/校对/批注/修订/格式/样式/结构/导航/表格/图像/域/页眉页脚/水印/导出/脱敏。
 * Marker 约定：场景完成时在文档末尾追加一行「Wxx完成」；验证 = document_get_text 含 marker（+对象级断言）。
 */
import { FILES_DIR } from './harness.mjs'
import path from 'node:path'

const DOC = (name) => path.join(FILES_DIR, name)

/** 场景间共享状态（pre 阶段记录，verify 阶段读取） */
const STATE = {}

/** Writer marker 验证：全文含「Wxx完成」 */
const vText = (id, extra = '') => async ({ tool }) => {
  const t = await tool('document_get_text', { scope: 'document' })
  const txt = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
  const ok = txt.includes(`${id}完成`) && (!extra || txt.includes(extra))
  return [ok, `marker=${txt.includes(`${id}完成`)} ${extra ? `extra(${extra.slice(0, 12)})=${txt.includes(extra)}` : ''} len=${txt.length}`]
}

export const GROUPS = [
  { group: 'A', doc: DOC('doc-A-内容.docx'), ids: ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10'] },
  { group: 'B', doc: DOC('doc-B-审校.docx'), ids: ['W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20'] },
  { group: 'C', doc: DOC('doc-C-格式.docx'), ids: ['W21', 'W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30'] },
  { group: 'D', doc: DOC('doc-D-结构.docx'), ids: ['W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38', 'W39', 'W40'] },
  { group: 'E', doc: DOC('doc-E-图文.docx'), ids: ['W41', 'W42', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50'] },
  { group: 'F', doc: DOC('doc-F-页面.docx'), ids: ['W51', 'W52', 'W53', 'W54', 'W55', 'W56', 'W57', 'W58', 'W59'] },
  { group: 'G', doc: DOC('doc-G-脱敏.docx'), ids: ['W60', 'W61'] },
  { group: 'X', doc: DOC('doc-F-页面.docx'), ids: ['X01', 'X02', 'X05', 'X03', 'X06'] }
]

const M = (id, 任务提示尾部) => `完成后在文档末尾追加一行文本：${id}完成。${任务提示尾部 || ''}`

export const SCENARIOS = [
  // ── A 组：内容读写（10）──
  { id: 'W01', group: 'A', desc: '文档元信息与段落清单',
    prompt: '请读取当前文档的元信息（document_meta）与段落清单（document_list_paragraphs），用一句话报告：标题是什么、共几个段落、约多少字。' + M('W01'),
    verify: vText('W01') },
  { id: 'W02', group: 'A', desc: '文末追加生成段落',
    prompt: '在文档末尾追加一段标题为「结论与展望」的内容：写 3 句话，围绕察元AI的离线能力、写回安全与内网部署优势，要求语句通顺、不使用列表符号。' + M('W02'),
    verify: vText('W02', '结论与展望') },
  { id: 'W03', group: 'A', desc: '锚点段后插入注释',
    prompt: '找到包含「目标用户是经常与公文」的那一段，在该段后面插入一段注释文字：「【注释】本段目标用户描述需与市场部口径对齐。」（用 document_insert position=after）。' + M('W03'),
    verify: vText('W03', '本段目标用户描述需与市场部口径对齐') },
  { id: 'W04', group: 'A', desc: '定点替换年份',
    prompt: '把文档中出现的「2025年」替换为「2026年」（先 document_locate 定位再 document_replace，注意 confirmed=true）。' + M('W04'),
    verify: vText('W04', '2026年') },
  { id: 'W05', group: 'A', desc: '通读全文生成摘要并置于文首',
    prompt: '通读全文，提炼 80 字以内的执行摘要，并以「摘要：」开头插入到文档最前面（position=prepend）。' + M('W05'),
    verify: vText('W05', '摘要：') },
  { id: 'W06', group: 'A', desc: '新章节生成三段内容',
    prompt: '在文档末尾新增一章「第四章 风险与对策」，标题单独一行，正文生成 3 个自然段，分别讨论：模型幻觉风险、内网部署复杂度、用户信任建立，每段 2 句话。' + M('W06'),
    verify: vText('W06', '第四章') },
  { id: 'W07', group: 'A', desc: '要点化改写首段',
    prompt: '把包含「察元AI文档助手是一款面向政企与个人」的第一段正文改写成 3 条带序号的要点（1. 2. 3.），保留原意，替换原段落。' + M('W07'),
    verify: vText('W07') },
  { id: 'W08', group: 'A', desc: '段落翻译并对照插入',
    prompt: '找到以「这段中文用于翻译测试」开头的段落，将其翻译成英文，并用 document_insert position=after 插到该段后面，英文前加「[EN] 」前缀。' + M('W08'),
    verify: vText('W08', '[EN]') },
  { id: 'W09', group: 'A', desc: '文末新建表格',
    prompt: '在文档末尾插入一个 3 行 3 列表格（table insert），表头行：指标/目标/实际；数据行：续约率/90%/92%、NPS/50/61。' + M('W09'),
    verify: async ({ tool }) => {
      const t = await tool('table', { action: 'list' })
      const n = (t?.tables || t?.items || []).length ?? t?.count ?? 0
      const txt = await tool('document_get_text', { scope: 'document' })
      const body = typeof txt?.text === 'string' ? txt.text : JSON.stringify(txt)
      return [(Number(n) >= 1) && body.includes('W09完成'), `tables=${JSON.stringify(t).slice(0, 120)} marker=${body.includes('W09完成')}`]
    } },
  { id: 'W10', group: 'A', desc: '全文统计报告（只读）',
    prompt: '只读操作：统计当前文档的总字数、段落数、标题数量，并把统计结论（含具体数字）作为一行写入文档末尾，格式不限但需含「统计」二字。不要修改其它内容。' + M('W10'),
    verify: vText('W10', '统计') },

  // ── B 组：校对批注修订（10）──
  { id: 'W11', group: 'B', desc: '全文校对并落批注',
    prompt: '对当前文档做全文校对：先 proofread_run(dryRun=true) 获取问题清单，再 proofread_apply_comments 把问题落成文档批注。完成后报告发现的问题数。' + M('W11'),
    timeout: 300,
    verify: async ({ tool }) => {
      const c = await tool('comment', { action: 'list' })
      const n = c?.total ?? (c?.comments || c?.items || []).length ?? 0
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [Number(n) >= 1 && body.includes('W11完成'), `comments=${n} marker=${body.includes('W11完成')}`]
    } },
  { id: 'W12', group: 'B', desc: '定点添加批注',
    prompt: '找到「稳订」这个词（若有则用它，否则用「销售额」），在该词所在位置添加批注：内容为「疑似错别字，请复核」。' + M('W12'),
    verify: vText('W12') },
  { id: 'W13', group: 'B', desc: '批注清单报告',
    prompt: '列出当前文档的全部批注（comment list），报告批注总数与各批注的引用文字。' + M('W13'),
    verify: vText('W13') },
  { id: 'W14', group: 'B', desc: '删除一条批注',
    prompt: '把内容为「疑似错别字，请复核」的那条批注删除（comment delete），保留其它批注。' + M('W14'),
    verify: async ({ tool }) => {
      const c = await tool('comment', { action: 'list' })
      const list = c?.comments || c?.items || []
      const j = JSON.stringify(c)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      const gone = !j.includes('疑似错别字，请复核')
      return [gone && body.includes('W14完成'), `批注已删=${gone} marker=${body.includes('W14完成')} 剩余=${list.length}`]
    } },
  { id: 'W15', group: 'B', desc: '开启修订并修改一处',
    prompt: '开启修订模式（revision mode enabled=true），然后把文中「按排」改为「安排」（保留修订痕迹），报告修订记录。' + M('W15'),
    timeout: 300,
    verify: async ({ tool }) => {
      const r = await tool('revision', { action: 'list' })
      const n = r?.total ?? (r?.revisions || r?.items || []).length ?? 0
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [Number(n) >= 1 && body.includes('W15完成'), `revisions=${n} marker=${body.includes('W15完成')}`]
    } },
  { id: 'W16', group: 'B', desc: '接受全部修订',
    prompt: '接受当前文档的全部修订（revision apply op=accept scope=all），并关闭修订模式（enabled=false）。' + M('W16'),
    timeout: 300,
    verify: async ({ tool }) => {
      const r = await tool('revision', { action: 'list' })
      const n = r?.total ?? (r?.revisions || r?.items || []).length ?? 0
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [Number(n) === 0 && body.includes('W16完成') && body.includes('安排'), `revisions=${n} marker=${body.includes('W16完成')}`]
    } },
  { id: 'W17', group: 'B', desc: '占位符检查（只读）',
    prompt: '只读检查：找出文档中的占位符文本（TODO、Lorem 等），输出清单（段落位置+内容），不要修改文档。' + M('W17'),
    verify: vText('W17', 'TODO') },
  { id: 'W18', group: 'B', desc: '错别字定点替换',
    prompt: '把文中「帐户类问题」的「帐户」替换为「账户」（注意区分另一处「账户安全」保持不变）。' + M('W18'),
    verify: vText('W18') },
  { id: 'W19', group: 'B', desc: '术语统一（登陆→登录）',
    prompt: '把文档中所有「登陆」统一替换为「登录」，报告替换处数。' + M('W19'),
    verify: async ({ tool }) => {
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [!body.includes('登陆') && body.includes('W19完成'), `无残留登陆=${!body.includes('登陆')} marker=${body.includes('W19完成')}`]
    } },
  { id: 'W20', group: 'B', desc: '半角标点规范化',
    prompt: '把文档中的半角逗号「,」替换为全角逗号「，」（数字千分位 1,024 除外，保持不变），报告处理处数。' + M('W20'),
    verify: vText('W20') },

  // ── C 组：格式样式（10）──
  { id: 'W21', group: 'C', desc: '标题加粗',
    prompt: '把文档标题「项目背景」设置为加粗（format_run）。' + M('W21'),
    verify: vText('W21') },
  { id: 'W22', group: 'C', desc: '关键词颜色字号',
    prompt: '把第一段中的「重要」两个字设置为红色（#FF0000）、字号 16（format_run）。' + M('W22'),
    verify: vText('W22') },
  { id: 'W23', group: 'C', desc: '段落居中',
    prompt: '把文档主标题「项目背景」所在段落设置为居中对齐（format_para align=center）。' + M('W23'),
    verify: vText('W23') },
  { id: 'W24', group: 'C', desc: '全文行距',
    prompt: '把全文行距设置为 1.5 倍（format_para lineSpacing）。' + M('W24'),
    verify: vText('W24') },
  { id: 'W25', group: 'C', desc: '标题样式应用',
    prompt: '把「第二个段落用于对齐与行距测试」这一段应用「标题 2」样式（style_apply），应用后它应出现在文档大纲中。' + M('W25'),
    timeout: 300,
    verify: vText('W25') },
  { id: 'W26', group: 'C', desc: '样式清单与审计',
    prompt: '读取文档样式清单（style list）并做样式审计统计（style audit action=stats），输出使用了哪些样式、各多少段。' + M('W26'),
    verify: vText('W26') },
  { id: 'W27', group: 'C', desc: '系统字体查询',
    prompt: '查询系统字体清单（system_fonts_list），判断是否存在「微软雅黑」和「苹方」，输出结论。' + M('W27'),
    verify: vText('W27') },
  { id: 'W28', group: 'C', desc: '首行缩进',
    prompt: '把正文各段（不含标题）设置为首行缩进 2 字符（format_para firstLineIndent）。' + M('W28'),
    verify: vText('W28') },
  { id: 'W29', group: 'C', desc: '格式读取报告',
    prompt: '用 format_read 读取第三段（「第三段用于缩进测试」）的格式，输出其字体、字号、对齐、缩进报告。' + M('W29'),
    verify: vText('W29') },
  { id: 'W30', group: 'C', desc: '关键词高亮',
    prompt: '给第三段中的「首行缩进」四个字加黄色高亮（若 format_run 支持 highlight 则用之，否则用底色近似实现）。' + M('W30'),
    verify: vText('W30') },

  // ── D 组：结构导航（10）──
  { id: 'W31', group: 'D', desc: '插入目录',
    prompt: '在文档最前面（标题之前）插入目录（toc insert）。' + M('W31'),
    timeout: 300,
    verify: vText('W31') },
  { id: 'W32', group: 'D', desc: '更新目录',
    prompt: '更新当前文档的目录（toc update），报告目录条目数。' + M('W32'),
    verify: vText('W32') },
  { id: 'W33', group: 'D', desc: '书签清单',
    prompt: '列出文档中的全部书签（bookmark list），报告书签名称。' + M('W33'),
    verify: async ({ tool }) => {
      const b = await tool('bookmark', { action: 'list' })
      const j = JSON.stringify(b)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [j.includes('察元书签') && body.includes('W33完成'), `书签含察元书签=${j.includes('察元书签')} marker=${body.includes('W33完成')}`]
    } },
  { id: 'W34', group: 'D', desc: '书签跳转',
    prompt: '跳转到书签「察元书签乙」（bookmark goto），然后报告跳转后光标所在位置附近的文字。' + M('W34'),
    verify: vText('W34') },
  { id: 'W35', group: 'D', desc: '插入分页符',
    prompt: '在「第三章 业务流程」标题之前插入分页符（layout break）。' + M('W35'),
    verify: vText('W35') },
  { id: 'W36', group: 'D', desc: '文末空白页',
    prompt: '在文档末尾插入一个空白页（layout blank_page）。' + M('W36'),
    verify: vText('W36') },
  { id: 'W37', group: 'D', desc: '页面设置横向',
    prompt: '把页面方向设置为横向（layout page orientation=landscape），其余保持默认。' + M('W37'),
    verify: vText('W37') },
  { id: 'W38', group: 'D', desc: '分栏',
    prompt: '把「第一章 总则」下的正文段落设置为两栏排版（layout columns count=2）。' + M('W38'),
    verify: vText('W38') },
  { id: 'W39', group: 'D', desc: '大纲结构报告',
    prompt: '输出文档大纲（nav outline），列出全部标题层级结构。' + M('W39'),
    verify: vText('W39') },
  { id: 'W40', group: 'D', desc: '定位到章节',
    prompt: '定位到「第四章 附则」（nav location），报告定位结果与附近文字。' + M('W40'),
    verify: vText('W40') },

  // ── E 组：图像域题注（10）──
  { id: 'W41', group: 'E', desc: '网络搜图并插入',
    prompt: '用 image_search 搜索「蓝色科技感背景」图片，取返回的第一个本地路径，用 image insert 插入到文档末尾。若搜索失败则报告原因并在文末追加一行「搜图失败」。' + M('W41'),
    timeout: 300,
    verify: vText('W41') },
  { id: 'W42', group: 'E', desc: 'AI 生图并插入',
    prompt: '用 generate_image 生成一张「极简风格的蓝色地球图标，白色背景」，用返回路径 image insert 插入到文档末尾。' + M('W42'),
    timeout: 360,
    verify: async ({ tool }) => {
      const im = await tool('image', { action: 'list' })
      const n = im?.total ?? (im?.images || im?.items || im?.returned && im?.items && im.items.length) ?? 0
      const cnt = Number(im?.returned ?? n)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [cnt >= 2 && body.includes('W42完成'), `images=${cnt}(需≥2) marker=${body.includes('W42完成')}`]
    } },
  { id: 'W43', group: 'E', desc: '图片清单',
    prompt: '列出当前文档中的全部图片（image list），报告图片数量。' + M('W43'),
    verify: async ({ tool }) => {
      const im = await tool('image', { action: 'list' })
      const n = im?.total ?? (im?.images || im?.items || []).length ?? 0
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [Number(n) >= 2 && body.includes('W43完成'), `images=${n} marker=${body.includes('W43完成')}`]
    } },
  { id: 'W44', group: 'E', desc: '导出图片',
    prompt: '把文档中的第一张图片导出（image export）到 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/writer-img.png。' + M('W44'),
    timeout: 300,
    verify: async ({ tool }) => {
      const fs = await import('node:fs')
      const exists = fs.existsSync('/Users/zyh/work/chayuan-wps/artifacts/e2e-180/writer-img.png')
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [(exists || body.includes('W44完成')), `file=${exists} marker=${body.includes('W44完成')}`]
    } },
  { id: 'W45', group: 'E', desc: '删除图片',
    prompt: '删除文档中最后插入的那张图片（image delete，按图片清单中最大 index），保留其余图片。' + M('W45'),
    pre: async ({ tool }) => {
      const im = await tool('image', { action: 'list' })
      STATE.preImages = Number(im?.returned ?? im?.total ?? 0)
    },
    verify: async ({ tool }) => {
      const im = await tool('image', { action: 'list' })
      const cnt = Number(im?.returned ?? im?.total ?? 0)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      const before = STATE.preImages || 0
      return [cnt === before - 1 && body.includes('W45完成'), `images=${cnt}(前=${before}，应-1) marker=${body.includes('W45完成')}`]
    } },
  { id: 'W46', group: 'E', desc: '添加超链接',
    prompt: '给文中「察元官网」添加超链接 https://aidooo.com （hyperlink add）。' + M('W46'),
    verify: async ({ tool }) => {
      const h = await tool('hyperlink', { action: 'list' })
      const j = JSON.stringify(h)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [j.includes('aidooo.com') && body.includes('W46完成'), `超链接=${j.includes('aidooo.com')} marker=${body.includes('W46完成')}`]
    } },
  { id: 'W47', group: 'E', desc: '超链接清单',
    prompt: '列出文档全部超链接（hyperlink list）并报告总数与地址。' + M('W47'),
    verify: vText('W47') },
  { id: 'W48', group: 'E', desc: '删除超链接',
    prompt: '删除指向 aidooo.com 的超链接（hyperlink delete），保留链接显示文字。' + M('W48'),
    verify: vText('W48') },
  { id: 'W49', group: 'E', desc: '表格题注',
    prompt: '在文档中的表格上方插入一行题注文字「表1 察元测试数据表」（用 document_insert），然后列出文档题注（caption list）报告识别结果。' + M('W49'),
    verify: vText('W49', '表1') },
  { id: 'W50', group: 'E', desc: '插入 SEQ 域',
    prompt: '用 field add（kind=seq，label=图）在文末插入一个图片序号域，然后用 field list 报告文档中的域清单。' + M('W50'),
    timeout: 300,
    verify: vText('W50') },

  // ── F 组：页面元素与导出（9）──
  { id: 'W51', group: 'F', desc: '设置页眉',
    prompt: '设置文档页眉为「察元AI真机测试文档」（headerfooter set which=header）。' + M('W51'),
    verify: async ({ tool }) => {
      const hf = await tool('headerfooter', { action: 'get' })
      const j = JSON.stringify(hf)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [j.includes('察元AI真机测试文档') && body.includes('W51完成'), `页眉命中=${j.includes('察元AI真机测试文档')} marker=${body.includes('W51完成')}`]
    } },
  { id: 'W52', group: 'F', desc: '设置页脚',
    prompt: '设置文档页脚文字为「第 1 页 共 {NUMPAGES} 页」改为简单文本「察元AI测试页脚」（headerfooter set which=footer）。' + M('W52'),
    verify: async ({ tool }) => {
      const hf = await tool('headerfooter', { action: 'get' })
      const j = JSON.stringify(hf)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [j.includes('察元AI测试页脚') && body.includes('W52完成'), `页脚命中=${j.includes('察元AI测试页脚')} marker=${body.includes('W52完成')}`]
    } },
  { id: 'W53', group: 'F', desc: '读取页眉页脚',
    prompt: '读取当前文档的页眉页脚内容（headerfooter get）并原样报告。' + M('W53'),
    verify: vText('W53') },
  { id: 'W54', group: 'F', desc: '设置水印',
    prompt: '给文档设置文字水印「内部资料」（watermark set）。' + M('W54'),
    verify: vText('W54') },
  { id: 'W55', group: 'F', desc: '清除水印',
    prompt: '清除当前文档的水印（watermark clear）。' + M('W55'),
    verify: vText('W55') },
  { id: 'W56', group: 'F', desc: '保存文档',
    prompt: '保存当前文档（document_save），报告保存结果。' + M('W56'),
    verify: vText('W56') },
  { id: 'W57', group: 'F', desc: '导出 PDF',
    prompt: '把当前文档导出为 PDF（export file format=pdf）到 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/writer-doc.pdf。' + M('W57'),
    timeout: 300,
    verify: async ({ tool }) => {
      const fs = await import('node:fs')
      const p = '/Users/zyh/work/chayuan-wps/artifacts/e2e-180/writer-doc.pdf'
      const exists = fs.existsSync(p) && fs.statSync(p).size > 500
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [exists, `pdf=${exists} size=${exists ? fs.statSync(p).size : 0} marker=${body.includes('W57完成')}`]
    } },
  { id: 'W58', group: 'F', desc: '表格导出',
    prompt: '在文末插入一个 2 行 2 列表格（表头：项目/数值，数据行：测试/180），然后把该表格导出为 CSV（table export）到 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/writer-table.csv。' + M('W58'),
    timeout: 300,
    verify: async ({ tool }) => {
      const fs = await import('node:fs')
      const p = '/Users/zyh/work/chayuan-wps/artifacts/e2e-180/writer-table.csv'
      const exists = fs.existsSync(p)
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [(exists || body.includes('W58完成')), `csv=${exists} marker=${body.includes('W58完成')}`]
    } },
  { id: 'W59', group: 'F', desc: '段落级批量替换',
    prompt: '用 document_apply_ops 做批量替换：把文中所有「段落内容填充」替换为「正文内容填充」（应命中多处，一次调用完成）。' + M('W59'),
    verify: async ({ tool }) => {
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [!body.includes('段落内容填充') && body.includes('正文内容填充') && body.includes('W59完成'),
        `旧词清除=${!body.includes('段落内容填充')} 新词=${body.includes('正文内容填充')} marker=${body.includes('W59完成')}`]
    } },

  // ── G 组：脱敏（2）──
  { id: 'W60', group: 'G', desc: '脱敏预览与应用',
    prompt: '对当前文档做脱敏：先识别敏感信息（手机号、身份证号、姓名、银行卡号），然后 declassify_preview 预览，再用 declassify_apply 应用脱敏，密码固定用「Chayuan2026」，关键词至少包含 13812345678（手机号）与 张辉（人名）。' + M('W60'),
    timeout: 300,
    verify: async ({ tool }) => {
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [!body.includes('13812345678') && body.includes('W60完成'), `手机号已脱=${!body.includes('13812345678')} marker=${body.includes('W60完成')}`]
    } },
  { id: 'W61', group: 'G', desc: '脱敏还原',
    prompt: '用密码「Chayuan2026」执行脱敏还原（declassify_restore），把文档恢复为脱敏前原文，然后报告还原结果。' + M('W61'),
    timeout: 300,
    verify: async ({ tool }) => {
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      return [body.includes('13812345678') && body.includes('W61完成'), `手机号已还原=${body.includes('13812345678')} marker=${body.includes('W61完成')}`]
    } },

  // ── X 组：平台与跨宿主（5）──
  { id: 'X01', group: 'X', desc: '助手配方域检索',
    prompt: '调用 assistants_list_domains 列出助手配方域，再用 assistants_search 搜索关键词「表格」返回的配方（最多 3 条），报告域名列表与命中配方名。' + M('X01'),
    timeout: 240,
    verify: vText('X01') },
  { id: 'X02', group: 'X', desc: '知识库检索（无库时优雅降级）',
    prompt: '调用 kb_retrieve 用查询词「察元AI」检索知识库；若未配置知识库或检索失败，请如实报告失败原因，不要编造内容。' + M('X02'),
    timeout: 240,
    verify: vText('X02') },
  { id: 'X05', group: 'X', desc: '字体服务',
    prompt: '调用 system_fonts_list 查询系统字体（limit 20），报告字体总数与其中 5 个字体名。' + M('X05'),
    timeout: 240,
    verify: vText('X05') },
  { id: 'X03', group: 'X', desc: '跨宿主取数：表格→Writer 报告',
    prompt: '跨宿主取数：用 spreadsheet 的 range_read 读取工作表 S03 的 F2:F2（只读，不要修改表格），记住该数值；然后在当前文档末尾插入一段「跨宿主报告：S03!F2 的值为 <该数值>」。' + M('X03'),
    timeout: 300,
    verify: async ({ tool }) => {
      const v = await tool('spreadsheet', { action: 'range_read', sheet: 'S03', range: 'F2:F2' })
      const cellVal = String(v?.values?.[0]?.[0] ?? '')
      const t = await tool('document_get_text', { scope: 'document' })
      const body = typeof t?.text === 'string' ? t.text : JSON.stringify(t)
      const hit = cellVal && body.includes(cellVal)
      return [hit && body.includes('X03完成'), `S03!F2=${cellVal} 文档含值=${hit} marker=${body.includes('X03完成')}`]
    } },
  { id: 'X06', group: 'X', desc: '独立搜图服务',
    prompt: '调用 image_search 搜索「城市天际线 航拍」（count=2），报告返回的图片本地路径与文件大小；不要插入文档。' + M('X06'),
    timeout: 240,
    verify: vText('X06') }
]
