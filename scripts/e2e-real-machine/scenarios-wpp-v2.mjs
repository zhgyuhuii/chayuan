/**
 * 演示车道场景（2026-10 助手增量批次）：27 个（NP01–NP27），逐一对应 hostAssistants.js 新增演示配方。
 * 底稿 e2e-wpp2.pptx（5 页，无目录/无结尾页）；NP07 跨宿主需 wps 宿主在线。
 * 生成类场景 verify = 页数增量（pre 基线）+ 末页 marker 文本框；attempts=1（避免重试造成重复页组）。
 */
import { FILES_DIR, activateDoc, osOpenDoc } from './harness.mjs'
import path from 'node:path'

const PPTX = path.join(FILES_DIR, 'e2e-wpp2.pptx')

async function slideList(tool) {
  const r = await tool('presentation', { action: 'slide_list' })
  return (r?.slides || []).map(s => ({ index: Number(s?.index) || 0, title: String(s?.title || '') }))
}
async function lastShapes(tool) {
  const list = await slideList(tool)
  if (!list.length) return []
  const r = await tool('presentation', { action: 'shape_list', index: list.length })
  return (r?.shapes || []).map(s => String(s?.text || ''))
}
const hasMarker = (texts, id) => texts.some(t => t.includes(`${id}完成`))

/** 生成类场景：页数增量 + 末页 marker */
function genVerify(id, minAdd) {
  let base = 0
  return {
    pre: async ({ tool }) => { base = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const list = await slideList(tool)
      const texts = await lastShapes(tool)
      const added = list.length - base
      return [added >= minAdd && hasMarker(texts, id),
        `slides ${base}→${list.length}（需+${minAdd}） marker=${hasMarker(texts, id)}`]
    }
  }
}
/** 纯报告/装饰类：末页 marker 即可 */
const markerVerify = (id) => async ({ tool }) => {
  const texts = await lastShapes(tool)
  return [hasMarker(texts, id), `末页 marker=${hasMarker(texts, id)} shapes=${texts.length}`]
}

const MARK = (id) => `全部页面生成完毕后，硬性收尾要求（必须执行，这是完成标志）：在最后一页右下角 textbox_add 文本「${id}完成」。`

/** 末页形状增量验证（配图类：图片/矢量都算命中，图片失败允许降级 svg） */
function imageVerify(minAdd) {
  let base = { slides: 0, lastShapes: 0 }
  return {
    pre: async ({ tool }) => {
      const list = await slideList(tool)
      base.slides = list.length
      base.lastShapes = (await lastShapes(tool)).length
    },
    verify: async ({ tool }) => {
      const list = await slideList(tool)
      const texts = await lastShapes(tool)
      const addedPages = list.length - base.slides
      const ok = addedPages > 0
        ? texts.length >= minAdd
        : texts.length >= base.lastShapes + minAdd
      return [ok, `slides ${base.slides}→${list.length} 末页形状 ${base.lastShapes}→${texts.length}（需+${minAdd}）`]
    }
  }
}

export const SCENARIOS = [
  // ── NP01 整套校对（wpp-proof）──
  { id: 'NP01', desc: '配方 wpp-proof 整套校对',
    prompt: '请通读当前演示稿全部页面（slide_list + slide_read）做只读校对：错别字、重复词、占位符文本（Lorem/TODO/示例）、明显标点问题，输出问题清单（页码+原文+修改建议），不要修改任何文字。' + MARK('NP01'),
    timeout: 360, verify: markerVerify('NP01') },
  // ── NP02 结构诊断（wpp-structure）──
  { id: 'NP02', desc: '配方 wpp-structure 结构诊断',
    prompt: '请对当前演示稿做结构诊断（只读不改）：① 按顺序连读每页标题判断故事线是否连贯 ② 单页要点是否超 5 条 ③ 是否缺封面/目录/章节过渡页/结尾页 ④ 给出 3-5 条结构调整建议（注明页码）。' + MARK('NP02'),
    timeout: 360, verify: markerVerify('NP02') },
  // ── NP03 整套翻译（wpp-translate）──
  { id: 'NP03', desc: '配方 wpp-translate 整套翻译（英）',
    prompt: '请把当前演示稿整套翻译成英文：逐页 slide_read 后用 text_replace 将文本译为英文（数字与品牌名「察元AI」保持原样），版式不变，完成后报告翻译页数与替换处数。' + MARK('NP03'),
    timeout: 600,
    verify: async ({ tool }) => {
      const titles = (await slideList(tool)).map(s => s.title)
      const noCn = !titles.some(t => t.includes('产品介绍'))
      const hasEn = titles.some(t => /[A-Za-z]{4,}/.test(t))
      return [noCn && hasEn, `标题英文命中=${hasEn} 旧中文标题残留=${!noCn} | ${titles.join(' / ').slice(0, 120)}`]
    } },
  // ── NP04 口播稿时长版（wpp-notes-timed）──
  { id: 'NP04', desc: '配方 wpp-notes-timed 口播稿（8 分钟版）',
    prompt: '分两步：① 先在第 1 页右下角 textbox_add 文本「NP04完成」（锚定第 1 页，不要用最后一页）。② 为第 1~6 页生成口播稿并写入每页备注（notes_set）：按总时长 8 分钟分配每页秒数，每页口语化 3-5 句，第 1 页注明开场白。',
    timeout: 600,
    verify: async ({ tool }) => {
      const r = await tool('presentation', { action: 'shape_list', index: 1 })
      const texts = (r?.shapes || []).map(s => String(s?.text || ''))
      return [texts.some(t => t.includes('NP04完成')), `第1页 marker=${texts.some(t => t.includes('NP04完成'))} shapes=${texts.length}`]
    } },
  // ── NP05 页码页脚统一（wpp-footer）──
  { id: 'NP05', desc: '配方 wpp-footer 页码页脚统一',
    prompt: '分两步：① 先在第 1 页右下角 textbox_add 文本「NP05完成」（锚定第 1 页，不要用最后一页）。② 给第 2、3、4 页加页脚：每页左下角 textbox_add「察元AI」、右下角 textbox_add 页码数字（字号 12、灰色），三页位置一致。',
    timeout: 600,
    verify: async ({ tool }) => {
      const p1 = await tool('presentation', { action: 'shape_list', index: 1 })
      const p2 = await tool('presentation', { action: 'shape_list', index: 2 })
      const t1 = (p1?.shapes || []).map(s => String(s?.text || ''))
      const t2 = (p2?.shapes || []).map(s => String(s?.text || ''))
      const m1 = t1.some(t => t.includes('NP05完成'))
      const f2 = t2.some(t => t.includes('察元AI'))
      return [m1 && f2, `P1 marker=${m1} P2 页脚=${f2}`]
    } },
  // ── NP06 结构件补齐（wpp-scaffold）──
  { id: 'NP06', desc: '配方 wpp-scaffold 结构件补齐',
    prompt: '请先在当前演示稿末尾追加 2 页内容页（标题「市场展望」「风险与对策」，各 3 条要点），然后补齐缺失结构件：在内容页之前加目录页（标题含「目录」，列出各章节名），最后加结尾感谢页（标题含「感谢」）。风格与现有页面一致，完成后报告新增页码。',
    timeout: 600,
    verify: async ({ tool }) => {
      const titles = (await slideList(tool)).map(s => s.title)
      const mulu = titles.some(t => /目录|CONTENTS/i.test(t))
      const thanks = titles.some(t => /感谢|谢谢/i.test(t))
      return [mulu && thanks && titles.length >= 9, `目录=${mulu} 感谢/谢谢=${thanks} slides=${titles.length}`]
    } },
  // ── NP07 转讲义文档（wpp-to-doc，跨宿主写 Word）──
  { id: 'NP07', desc: '配方 wpp-to-doc 转讲义文档（跨宿主写 Word）',
    pre: async () => {
      const r = await osOpenDoc('e2e-讲义3', path.join(FILES_DIR, 'e2e-讲义3.docx'))
      if (!r) throw new Error('无法把 e2e-讲义3 置为活动文档（跨宿主写目标）')
      return { ok: true }
    },
    prompt: '请把当前演示稿转成 Word 讲义，写入打开的文档「e2e-讲义3」（它是 wps 宿主当前活动文档）：先逐页读取内容（slide_list + slide_read），然后把讲义全文组织成一段文字（每页一行：「第N页 标题：要点」），用 document_insert 一次性 append 写入（position 用 append，confirmed 由系统处理）。注意：文本的最后必须以「NP07完成」结尾（作为讲义最后一行）。',
    timeout: 600,
    verify: async ({ tool }) => {
      const r = await tool('document_get_text', {})
      const text = typeof r === 'string' ? r : JSON.stringify(r)
      return [text.includes('NP07完成'), `doc 含标记=${text.includes('NP07完成')} len=${text.length}`]
    } },
  // ── 生成类（NP08–NP27，逐一对应行业配方）──
  { id: 'NP08', desc: '配方 wpp-gov-rectify 整改汇报',
    prompt: '请生成一份巡察整改汇报演示稿：问题清单 / 原因剖析 / 整改措施 / 整改成效（用数据）/ 长效机制 五段式，政企庄重风格，共 8 页左右。整改情况：两项问题——①部分窗口办事指南更新不及时（已重新编制上墙）②整改台账记录不完整（已补录并建立周检制度），群众满意度从 89% 升至 96%。' + MARK('NP08'),
    timeout: 600, attempts: 1, ...genVerify('NP08', 4) },
  { id: 'NP09', desc: '配方 wpp-gov-livelihood 民生实事汇报',
    prompt: '请生成一份民生实事项目汇报演示稿：项目清单与分工 / 进度完成情况（用数据）/ 资金使用 / 群众反馈 / 下一步安排，庄重风格，共 6 页左右。项目：老旧小区改造（进度 90%）、社区养老食堂（已运营，日均 300 人次）、口袋公园（已建成 2 处），群众满意度 95%。' + MARK('NP09'),
    timeout: 600, attempts: 1, ...genVerify('NP09', 3) },
  { id: 'NP10', desc: '配方 wpp-gov-safetyedu 安全警示教育课件',
    prompt: '请生成一份安全警示教育课件：事故案例回顾 / 原因剖析 / 法规条款摘录 / 防范措施 / 警示总结，严肃风格（深色警示配色），共 6 页左右。主题：建筑施工行业高处坠落事故警示教育。' + MARK('NP10'),
    timeout: 600, attempts: 1, ...genVerify('NP10', 3) },
  { id: 'NP11', desc: '配方 wpp-med-mdt 病例讨论课件',
    prompt: '请生成一份病例讨论课件：病例摘要 / 检查结果 / 诊断依据 / 鉴别诊断 / 治疗方案 / 讨论问题，医学严谨风格，共 6 页左右。病例：58 岁男性，高血压合并 2 型糖尿病，血压控制不佳（150/95mmHg），调整用药方案讨论。' + MARK('NP11'),
    timeout: 600, attempts: 1, ...genVerify('NP11', 3) },
  { id: 'NP12', desc: '配方 wpp-med-edu 患者宣教课件',
    prompt: '请生成一份患者宣教课件：这个病是什么 / 日常注意事项 / 用药提醒 / 何时复诊 / 常见误区，通俗语言+要点化表达，共 5 页左右。病种：2 型糖尿病，受众为社区老年患者。' + MARK('NP12'),
    timeout: 600, attempts: 1, ...genVerify('NP12', 2) },
  { id: 'NP13', desc: '配方 wpp-med-dept 科室年度汇报',
    prompt: '请生成一份心内科年度汇报演示稿：年度业务数据 / 重点工作 / 学科建设 / 明年计划，共 6 页左右。数据：门诊 4.2 万人次、介入手术 1200 台、平均住院日 7.2 天、满意度 97%。' + MARK('NP13'),
    timeout: 600, attempts: 1, ...genVerify('NP13', 3) },
  { id: 'NP14', desc: '配方 wpp-mfg-safety 安全生产培训课件',
    prompt: '请生成一份安全生产培训课件：安全规程要点 / 典型事故案例 / 违章后果 / 规范操作要求 / 应急处置流程，共 6 页左右，适合班组学习。主题：机械加工车间新员工安全培训。' + MARK('NP14'),
    timeout: 600, attempts: 1, ...genVerify('NP14', 3) },
  { id: 'NP15', desc: '配方 wpp-mfg-sop 设备操作SOP页',
    prompt: '请生成一份空压机操作规程页组：开机前检查 / 操作步骤（分步编号）/ 关键参数范围 / 异常处理 / 停机流程，步骤清晰编号，共 4 页左右。' + MARK('NP15'),
    timeout: 600, attempts: 1, ...genVerify('NP15', 2) },
  { id: 'NP16', desc: '配方 wpp-fin-roadshow 投资者路演',
    prompt: '请生成一份投资者路演演示稿：市场机会 / 产品与技术壁垒 / 增长数据 / 团队 / 融资计划与资金用途，共 8 页左右，数据页用大数字版式。项目：察元AI——离线办公 AI 文档智能体（WPS 加载项形态，私有化部署），营收年增 300%，Pre-A 轮融资 2000 万。' + MARK('NP16'),
    timeout: 600, attempts: 1, ...genVerify('NP16', 4) },
  { id: 'NP17', desc: '配方 wpp-fin-compliance 合规内训课件',
    prompt: '请生成一份合规内训课件：监管要求解读 / 常见违规情形 / 案例警示 / 操作红线清单 / 合规自查方法，严肃风格，共 6 页左右。主题：银行网点员工销售话术红线与反洗钱要点。' + MARK('NP17'),
    timeout: 600, attempts: 1, ...genVerify('NP17', 3) },
  { id: 'NP18', desc: '配方 wpp-fin-product 产品说明会',
    prompt: '请生成一份产品说明会演示稿：客户需求 / 产品方案 / 收益与费用 / 风险提示（单独一页、醒目）/ 服务与联系方式，共 6 页左右。产品：某增额终身寿险（面向高净值客户，注意合规表述）。' + MARK('NP18'),
    timeout: 600, attempts: 1, ...genVerify('NP18', 3) },
  { id: 'NP19', desc: '配方 wpp-ec-battle 大促战报页',
    prompt: '请生成大促战报页组：① 核心战报页（GMV 1.2 亿 / 订单 42 万单 / 新增会员 8.6 万，大数字版式）② 渠道与爆品排行页（table_add 表格）③ 同比战报页（GMV 同比 +65%），喜庆热烈氛围（红金配色），共 3 页。' + MARK('NP19'),
    timeout: 600, attempts: 1, ...genVerify('NP19', 2) },
  { id: 'NP20', desc: '配方 wpp-ec-live-script 直播脚本分镜',
    prompt: '请生成直播带货脚本页组：场次流程时间轴 / 各时段商品与话术要点 / 利益点与逼单节奏 / 互动与留人设计，共 4 页左右，话术口语化。场次：周五晚美妆专场，商品 精华液/面膜/口红 三款。' + MARK('NP20'),
    timeout: 600, attempts: 1, ...genVerify('NP20', 2) },
  { id: 'NP21', desc: '配方 wpp-edu-parents 家长会课件',
    prompt: '请生成一份家长会课件：班级整体情况 / 学期学习分析（整体数据，不点名）/ 共性问题 / 家庭配合建议 / 沟通渠道，温和亲切风格，共 5 页左右。班级：初二（3）班，45 人，期中平均分年级第 2。' + MARK('NP21'),
    timeout: 600, attempts: 1, ...genVerify('NP21', 2) },
  { id: 'NP22', desc: '配方 wpp-edu-recruit 招生宣讲',
    prompt: '请生成一份招生宣讲演示稿：机构介绍 / 师资力量 / 课程体系 / 办学成果 / 报名方式，共 6 页左右。机构：察元编程少儿编程（面向 8-12 岁，Scratch→Python 体系，学员获奖 120 人次）。' + MARK('NP22'),
    timeout: 600, attempts: 1, ...genVerify('NP22', 3) },
  { id: 'NP23', desc: '配方 wpp-edu-class 主题班会课件',
    prompt: '请生成一份主题班会课件：主题导入 / 案例或故事 / 讨论问题 / 行动倡议 / 总结，共 4 页左右，风格贴合中学生。主题：网络安全与文明上网。' + MARK('NP23'),
    timeout: 600, attempts: 1, ...genVerify('NP23', 2) },
  { id: 'NP24', desc: '配方 wpp-realestate 楼盘推介',
    prompt: '请生成一份楼盘推介演示稿：区位与交通 / 周边配套 / 户型与价格（table_add 参数表）/ 社区园林与物业 / 开发商品牌，共 6 页左右，高端大气风格。楼盘：察元府——地铁上盖，户型 98-140㎡，均价 6.8 万/㎡。' + MARK('NP24'),
    timeout: 600, attempts: 1, ...genVerify('NP24', 3) },
  { id: 'NP25', desc: '配方 wpp-wed-flow 婚礼流程页',
    prompt: '请生成一份婚礼流程演示稿：仪式流程时间轴 / 各环节说明 / 人员分工 / 物料清单，浪漫温馨风格（粉金色系），共 4 页左右。婚礼：10 月 18 日，下午茶歇+晚间仪式，宾客 120 人。' + MARK('NP25'),
    timeout: 600, attempts: 1, ...genVerify('NP25', 2) },
  { id: 'NP26', desc: '配方 wpp-event-plan 活动执行方案',
    prompt: '请生成一份公司年会执行方案演示稿：活动目标 / 时间地点与议程 / 分工与责任矩阵（table_add 表格）/ 物料与预算 / 应急预案，共 5 页左右。活动：12 月 28 日年会，300 人，节目+抽奖+颁奖。' + MARK('NP26'),
    timeout: 600, attempts: 1, ...genVerify('NP26', 2) },
  { id: 'NP27', desc: '配方 wpp-food-new 新品推介页',
    prompt: '请生成一份新品推介演示稿：新品卖点 / 目标人群 / 价格与渠道 / 上市节奏 / 促销方案，共 4 页左右，画面感优先（配图优先用 presentation svg_add 矢量装饰，不要调用付费生图）。新品：察元茶饮秋季新品「桂花乌龙」，定价 15 元。' + MARK('NP27'),
    timeout: 600, attempts: 1, ...genVerify('NP27', 2) },
  // ── 生图/配图三件套（搜图 / AI生图 / 矢量；验证=末页形状增量，图片失败允许降级 svg）──
  { id: 'NP28', desc: '配方 wpp-img-web 搜图配图',
    prompt: '请为当前演示稿配图：用 image_search 搜索 1 张与「智慧办公」相关的真实图片，用 presentation picture_add 插入到最后一页（不要新建页）。若搜图失败，按降级铁律改用 presentation svg_add 在最后一页插入 1 个矢量图形兜底（扁平风、蓝色系）。两种结果都算完成，注明用了哪种。',
    timeout: 600, attempts: 1, ...imageVerify(1) },
  { id: 'NP29', desc: '配方 wpp-img-model AI生图配图',
    prompt: '请用 generate_image 生成一张「智慧办公」主题的扁平风格插画（蓝色系），用 presentation picture_add 插入到最后一页（不要新建页）。若当前没有可用的图像生成模型，按降级铁律改用 presentation svg_add 在最后一页插入 1 个矢量插画兜底。两种结果都算完成，注明用了哪种。',
    timeout: 600, attempts: 1, ...imageVerify(1) },
  { id: 'NP30', desc: '配方 wpp-img-svg 矢量图标装饰',
    prompt: '请为当前演示稿的最后一页添加矢量装饰：用 presentation svg_add 生成 2-3 个语义图标（如增长箭头/齿轮/对话气泡，扁平风格、蓝色系），错落排布在页面右下区域，不要遮挡已有内容。',
    timeout: 600, attempts: 1, ...imageVerify(2) },
]

export const WPP2_FILE = PPTX
