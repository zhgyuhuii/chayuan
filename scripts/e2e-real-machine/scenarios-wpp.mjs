/**
 * 演示（wpp 宿主）车道场景：60 个（P01–P60）+ 1 个跨宿主（X04）。
 * 覆盖 presentation 全部 20 个 action + 生图/搜图/SVG/备注/导出/放映。
 * Marker：场景完成时在最后一页加 textbox「Pxx完成」；验证 = slide_list(title+textPreview) 命中，
 * 未命中再 shape_list 扫描末尾若干页。
 */
import { FILES_DIR } from './harness.mjs'
import fs from 'node:fs'
import path from 'node:path'

const ART = path.resolve(FILES_DIR, '..')
const STATE = {}

async function slideList(tool) {
  const r = await tool('presentation', { action: 'slide_list' })
  return r?.slides || []
}
const listJson = (slides) => JSON.stringify(slides)

/** 快路径：slide_list 命中 marker；慢路径：扫描末尾 N 页 shape 文本 */
function vSlide(id, { tail = 8, extraCheck = null, timeoutNote = '' } = {}) {
  return async ({ tool }) => {
    const slides = await slideList(tool)
    const j = listJson(slides)
    let hit = j.includes(`${id}完成`)
    if (!hit) {
      const n = slides.length
      const from = Math.max(1, n - tail + 1)
      for (let i = n; i >= from && !hit; i--) {
        const sh = await tool('presentation', { action: 'shape_list', index: i })
        hit = JSON.stringify(sh).includes(`${id}完成`)
      }
    }
    let extra = ''
    let extraOk = true
    if (extraCheck) {
      const [ok, note] = await extraCheck({ tool, slides })
      extraOk = ok
      extra = note
    }
    return [hit && extraOk, `marker=${hit} slides=${slides.length} ${extra} ${timeoutNote}`]
  }
}

const fileExists = (p) => fs.existsSync(p) && fs.statSync(p).size > 100

export const SCENARIOS = [
  { id: 'P01', desc: '状态与全册清单报告',
    prompt: '读取演示稿状态（presentation status）与全部页面清单（slide_list），报告：总页数、各页标题（只读）。完成后在最后一页右下角添加文本框（textbox_add）「P01完成」。',
    verify: vSlide('P01') },
  { id: 'P02', desc: '新增标题页',
    prompt: '在演示稿末尾新增一页（slide_add layout=title），标题「P02 市场洞察」，副标题「2026 下半年市场策略」。完成后在最后一页右下角 textbox_add「P02完成」。',
    verify: vSlide('P02', { extraCheck: async ({ slides }) => [listJson(slides).includes('P02 市场洞察'), '标题页存在'] }) },
  { id: 'P03', desc: '新增要点内容页',
    prompt: '在末尾新增一页（layout=text），标题「P03 三大举措」，正文列出 3 条要点：渠道下沉 / 客户分层运营 / 产品线扩展。完成后在最后一页右下角 textbox_add「P03完成」。',
    verify: vSlide('P03') },
  { id: 'P04', desc: '新增两栏文本页',
    prompt: '在末尾新增一页（layout=twoText），标题「P04 双栏对比」，左栏写「线上渠道：占比 60%，增速 20%」，右栏写「线下渠道：占比 40%，增速 8%」。完成后在最后一页右下角 textbox_add「P04完成」。',
    verify: vSlide('P04') },
  { id: 'P05', desc: '复制页面',
    prompt: '用 slide_duplicate 复制第 1 页（察元AI年度汇报/报告那一页）并把副本放到末尾。完成后在最后一页右下角 textbox_add「P05完成」。',
    pre: async ({ tool }) => { STATE.p05count = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P05完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P05完成')
      }
      return [hit && slides.length >= (STATE.p05count || 6) + 1, `marker=${hit} count=${slides.length}（前=${STATE.p05count}）`]
    } },
  { id: 'P06', desc: '移动页面',
    prompt: '用 slide_move 把当前最后一页移动到第 2 页的位置（from=最后一页 to=2）。完成后在新的最后一页右下角 textbox_add「P06完成」。',
    pre: async ({ tool }) => {
      const slides = await slideList(tool)
      STATE.p06last = slides[slides.length - 1]?.title || ''
      STATE.p06count = slides.length
    },
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P06完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P06完成')
      }
      const movedOk = STATE.p06last ? slides[slides.length - 1]?.title !== STATE.p06last : true
      return [hit && movedOk, `marker=${hit} 原末页「${STATE.p06last.slice(0, 20)}」已非末页=${movedOk} count=${slides.length}`]
    } },
  { id: 'P07', desc: '删除页面',
    prompt: '找到标题含「P02 市场洞察」的页，用 slide_delete 删除它（只删这一页）。完成后在最后一页右下角 textbox_add「P07完成」。',
    pre: async ({ tool }) => { STATE.p07count = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P07完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P07完成')
      }
      return [hit && slides.length === (STATE.p07count || 0) - 1, `marker=${hit} count=${slides.length}（前=${STATE.p07count}，应-1）`]
    } },
  { id: 'P08', desc: '版式变更',
    prompt: '把最后一页（含「P06完成」文本框的那页）用 slide_layout 改为 titleOnly 版式。完成后在该页右下角 textbox_add「P08完成」。',
    verify: vSlide('P08') },
  { id: 'P09', desc: '读取页面详情',
    prompt: '用 slide_read 读取第 1 页详情并报告：版式、形状数、标题。只读。完成后在最后一页右下角 textbox_add「P09完成」。',
    verify: vSlide('P09') },
  { id: 'P10', desc: '形状清单报告',
    prompt: '用 shape_list 列出第 2 页的全部形状，报告形状数与各形状文本摘要。完成后在最后一页右下角 textbox_add「P10完成」。',
    verify: vSlide('P10') },
  { id: 'P11', desc: '新增空白页',
    prompt: '在末尾新增一页空白版式页（layout=blank），不加任何内容。完成后在该空白页右下角 textbox_add「P11完成」（这是该页唯一的形状）。',
    pre: async ({ tool }) => { STATE.p11count = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P11完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P11完成')
      }
      return [hit && slides.length >= (STATE.p11count || 0) + 1, `marker=${hit} count=${slides.length}（前=${STATE.p11count}）`]
    } },
  { id: 'P12', desc: '全册文本替换',
    prompt: '用 text_replace 把全册「汇报」替换为「报告」（种子页「察元AI年度汇报」应变为「察元AI年度报告」），报告替换处数。完成后在最后一页右下角 textbox_add「P12完成」。',
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P12完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P12完成')
      }
      return [hit && j.includes('察元AI年度报告') && !j.includes('察元AI年度汇报'), `marker=${hit} 报告=${j.includes('察元AI年度报告')} 残留汇报=${j.includes('察元AI年度汇报')}`]
    } },

  // ── 内容生成（12）──
  { id: 'P13', desc: '年度总结 5 页生成',
    prompt: '在演示稿末尾连续新增 5 页（text 版式），构成「P13 年度总结」系列：工作回顾 / 主要成绩 / 存在不足 / 明年计划 / 结束感谢，每页标题以「P13·」开头（如 P13·工作回顾），正文 2-3 条要点。完成后在最后一页右下角 textbox_add「P13完成」。',
    timeout: 420,
    verify: vSlide('P13', { extraCheck: async ({ slides }) => [listJson(slides).includes('P13·工作回顾'), '系列首页存在'] }) },
  { id: 'P14', desc: '产品介绍 4 页生成',
    prompt: '在末尾新增 4 页「P14 产品介绍」系列（P14·产品定位 / P14·核心功能 / P14·典型场景 / P14·下一步），每页正文 2 条要点。完成后在最后一页右下角 textbox_add「P14完成」。',
    timeout: 420,
    verify: vSlide('P14') },
  { id: 'P15', desc: '新人培训 6 页生成',
    prompt: '在末尾新增 6 页「P15 新人培训」系列（P15·入职欢迎 / P15·产品速览 / P15·工具与流程 / P15·协作规范 / P15·学习路径 / P15·答疑），每页正文 2 条要点。完成后在最后一页右下角 textbox_add「P15完成」。',
    timeout: 480,
    verify: vSlide('P15') },
  { id: 'P16', desc: '项目汇报 4 页生成',
    prompt: '在末尾新增 4 页「P16 项目汇报」系列（P16·项目背景 / P16·关键进展 / P16·风险与对策 / P16·资源需求），每页正文含 1 个具体数字。完成后在最后一页右下角 textbox_add「P16完成」。',
    timeout: 420,
    verify: vSlide('P16') },
  { id: 'P17', desc: '种子页扩写',
    prompt: '先读取标题为「数据亮点」的种子页内容，据此在末尾扩写 3 页「P17·亮点解读」系列（P17·营收解读 / P17·客户增长 / P17·效率提升），每页 2 条要点且带数字。完成后在最后一页右下角 textbox_add「P17完成」。',
    timeout: 420,
    verify: vSlide('P17') },
  { id: 'P18', desc: '通读全册生成摘要页',
    prompt: '通读当前演示稿全部页面（slide_list + 逐页 slide_read 前 10 页），在末尾新增一页「P18 全册摘要」，正文提炼 4 条要点。完成后在最后一页右下角 textbox_add「P18完成」。',
    timeout: 480,
    verify: vSlide('P18') },
  { id: 'P19', desc: '致谢页',
    prompt: '在末尾新增一页（layout=title）「P19 谢谢观看」，副标题「察元AI团队」。完成后在最后一页右下角 textbox_add「P19完成」。',
    verify: vSlide('P19') },
  { id: 'P20', desc: '目录页',
    prompt: '在末尾新增一页「P20 目录」，正文按顺序列出本册已出现的 8 个章节关键词（每行一个，取自你看到的页面标题）。完成后在最后一页右下角 textbox_add「P20完成」。',
    timeout: 360,
    verify: vSlide('P20') },
  { id: 'P21', desc: '答疑页',
    prompt: '在末尾新增一页「P21 常见问答」，正文列 3 个 Q&A（Q: … A: …格式）。完成后在最后一页右下角 textbox_add「P21完成」。',
    verify: vSlide('P21') },
  { id: 'P22', desc: '里程碑时间线页',
    prompt: '在末尾新增一页「P22 里程碑」，正文用文字时间线列出 4 个里程碑（2026-Q1 产品发布 → 2026-Q2 客户破百 → 2026-Q3 版本5.0 → 2026-Q4 海外首发）。完成后在最后一页右下角 textbox_add「P22完成」。',
    verify: vSlide('P22') },
  { id: 'P23', desc: '团队介绍页',
    prompt: '在末尾新增一页「P23 团队介绍」，正文列出 4 个角色及职责（产品负责人 / 研发负责人 / 测试负责人 / 交付负责人）。完成后在最后一页右下角 textbox_add「P23完成」。',
    verify: vSlide('P23') },
  { id: 'P24', desc: '联系方式页',
    prompt: '在末尾新增一页「P24 联系我们」，正文写：官网 aidooo.com / 邮箱 support@aidooo.com / 微信 智灵鸟科技。完成后在最后一页右下角 textbox_add「P24完成」。',
    verify: vSlide('P24') },

  // ── 文本操作（8）──
  { id: 'P25', desc: '修改页标题',
    prompt: '找到标题为「产品规划」的种子页，用 text_set 把它的标题改为「产品规划（升级版）」。完成后在最后一页右下角 textbox_add「P25完成」。',
    verify: vSlide('P25', { extraCheck: async ({ slides }) => [listJson(slides).includes('产品规划（升级版）'), '标题已改'] }) },
  { id: 'P26', desc: '正文追加要点',
    prompt: '找到标题为「团队与协作」的种子页，用 text_set（append=true）在其正文后追加一行「新增强调：跨部门协作平台已上线」。完成后在最后一页右下角 textbox_add「P26完成」。',
    verify: vSlide('P26') },
  { id: 'P27', desc: '错别字全册替换',
    prompt: '种子页中存在错别字「稳步提声」，用 text_replace 把全册「提声」替换为「提升」。完成后在最后一页右下角 textbox_add「P27完成」。',
    timeout: 300,
    verify: vSlide('P27', { extraCheck: async ({ tool, slides }) => {
      const j = listJson(slides)
      return [!j.includes('提声'), `全册残留提声=${j.includes('提声')}`]
    } }) },
  { id: 'P28', desc: '页脚文本框',
    prompt: '给最后一页底部居中添加文本框「P28 页脚：察元AI内部资料」（textbox_add）。再在右下角 textbox_add「P28完成」。',
    verify: vSlide('P28') },
  { id: 'P29', desc: '多文本框布局页',
    prompt: '在末尾新增空白页（layout=blank），然后在该页上用 textbox_add 建 3 个文本框：顶部「P29 布局测试」（大标题位）、中部「这是正文区域」（正文位）、底部「来源：e2e 测试」（小字位）。完成后在右下角 textbox_add「P29完成」。',
    timeout: 300,
    verify: vSlide('P29') },
  { id: 'P30', desc: '全册文字审核（只读）',
    prompt: '只读审核：逐页检查前 15 页的文本，找出错别字、重复词、占位符（TODO/Lorem），输出问题清单（页码+问题），不要修改任何文字。完成后在最后一页右下角 textbox_add「P30完成」。',
    timeout: 420,
    verify: vSlide('P30') },
  { id: 'P31', desc: '术语统一替换',
    prompt: '用 text_replace 把全册「察元AI」替换为「察元AI文档助手」（若某页标题已含该词会自动跳过），报告替换处数。完成后在最后一页右下角 textbox_add「P31完成」。',
    timeout: 300,
    verify: vSlide('P31') },
  { id: 'P32', desc: '引用页码修正',
    prompt: '在末尾新增一页「P32 附录说明」，正文写「本附录共 2 页，对应正文最后两章」。完成后在最后一页右下角 textbox_add「P32完成」。',
    verify: vSlide('P32') },

  // ── 图像（8）──
  { id: 'P33', desc: 'AI 生图插入封面页',
    prompt: '用 generate_image 生成「深蓝渐变科技感封面背景，抽象几何线条」，然后用返回路径 picture_add 插入到末尾新增的空白页（layout=blank）上，并在该页加标题文本框「P33 生图封面」。完成后在右下角 textbox_add「P33完成」。',
    timeout: 480,
    verify: vSlide('P33') },
  { id: 'P34', desc: '网络搜图插入',
    prompt: '用 image_search 搜索「城市夜景 航拍」（count=2），取第一个返回路径 picture_add 插入到末尾新增的空白页上，并加标题文本框「P34 搜图页」。若搜图失败，报告原因并改用 svg_add 画一个简单色块示意。完成后在右下角 textbox_add「P34完成」。',
    timeout: 420,
    verify: vSlide('P34') },
  { id: 'P35', desc: 'SVG 柱状图',
    prompt: '在末尾新增空白页，加标题文本框「P35 SVG 图表」，然后用 svg_add 画一个简单的柱状图 SVG（4 根柱子：Q1=40、Q2=55、Q3=70、Q4=90，蓝色系，宽度约 400 高度约 300）。完成后在右下角 textbox_add「P35完成」。',
    timeout: 420,
    verify: vSlide('P35') },
  { id: 'P36', desc: 'SVG 流程图',
    prompt: '在末尾新增空白页，加标题「P36 流程图」，用 svg_add 画一个横向流程图 SVG（需求→评审→开发→测试→发布，5 个圆角矩形+箭头）。完成后在右下角 textbox_add「P36完成」。',
    timeout: 420,
    verify: vSlide('P36') },
  { id: 'P37', desc: 'SVG 图标组页',
    prompt: '在末尾新增空白页，加标题「P37 图标页」，用 svg_add 分 3 次画 3 个简单图标（圆圈对勾、三角形警示、五角星，各约 80x80）。完成后在右下角 textbox_add「P37完成」。',
    timeout: 480,
    verify: vSlide('P37') },
  { id: 'P38', desc: '本地图片插入',
    prompt: '用 picture_add 把本地图片 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/files/seed-image.png 插入到末尾新增的空白页，并加标题文本框「P38 本地图页」。完成后在右下角 textbox_add「P38完成」。',
    timeout: 300,
    verify: vSlide('P38') },
  { id: 'P39', desc: '图文排版页',
    prompt: '在末尾新增空白页：左半插入 seed-image.png（picture_add），右侧加正文文本框「图示：察元AI部署架构示意」，顶部加标题「P39 图文页」。完成后在右下角 textbox_add「P39完成」。',
    timeout: 300,
    verify: vSlide('P39') },
  { id: 'P40', desc: '生图+说明页',
    prompt: '用 generate_image 生成「扁平风格的云服务器插画，蓝白配色」，插入到末尾新增空白页，并加说明文本框「配图：混合云部署示意」与标题「P40 生图说明页」。完成后在右下角 textbox_add「P40完成」。',
    timeout: 480,
    verify: vSlide('P40') },

  // ── 表格与备注（8）──
  { id: 'P41', desc: '数据表格页',
    prompt: '在末尾新增空白页，加标题「P41 数据表」，用 table_add 建 4 行 3 列表格：表头 指标/目标/实际；行1 营收/1.0亿/1.2亿；行2 新客户/30/35；行3 续约率/90%/92%。完成后在右下角 textbox_add「P41完成」。',
    timeout: 300,
    verify: vSlide('P41', { extraCheck: async ({ tool, slides }) => {
      const n = slides.length
      const sh = await tool('presentation', { action: 'shape_list', index: n })
      const has = JSON.stringify(sh).includes('续约率')
      return [has, `末页含表头=${has}`]
    } }) },
  { id: 'P42', desc: '财务对比表',
    prompt: '在末尾新增空白页，加标题「P42 财务对比」，用 table_add 建 3 行 4 列表格：表头 科目/2025/2026/增幅；行1 营收/8000万/9600万/20%；行2 毛利/3200万/4030万/26%。完成后在右下角 textbox_add「P42完成」。',
    timeout: 300,
    verify: vSlide('P42') },
  { id: 'P43', desc: '单页演讲备注',
    prompt: '给「数据亮点」那页（slide_list 找 index）用 notes_set 写演讲备注：「本页强调三个数字：120% 完成率、35 家新客户、92% 续约率。语气自信。」。完成后在最后一页右下角 textbox_add「P43完成」。',
    timeout: 300,
    verify: vSlide('P43') },
  { id: 'P44', desc: '多页备注批量',
    prompt: '用 notes_set 一次性给第 1 页和第 2 页写演讲备注（第 1 页开场白「各位领导好，下面汇报年度情况」；第 2 页「本页介绍业务概览，强调稳步增长」）。完成后在最后一页右下角 textbox_add「P44完成」。',
    timeout: 300,
    verify: vSlide('P44') },
  { id: 'P45', desc: '通读页面写口播稿',
    prompt: '读取「产品规划（升级版）」那页的正文，为它写 3 句口语化演讲备注并用 notes_set 写入该页。完成后在最后一页右下角 textbox_add「P45完成」。',
    timeout: 360,
    verify: vSlide('P45') },
  { id: 'P46', desc: '表格+备注页',
    prompt: '在末尾新增空白页：加标题「P46 人员统计」，table_add 建 3 行 2 列表格（表头 部门/人数；行 研发/24；行 交付/16），并用 notes_set 给该页写备注「本页介绍人员结构」。完成后在右下角 textbox_add「P46完成」。',
    timeout: 360,
    verify: vSlide('P46') },
  { id: 'P47', desc: '表+SVG 同页',
    prompt: '在末尾新增空白页，加标题「P47 数据与图示」：用 table_add 建 2 行 2 列表格（表头 季度/营收；行 Q4/9600万），再用 svg_add 在旁边画一个简单饼图 SVG（两块扇形，蓝色 70% 灰色 30%）。完成后在右下角 textbox_add「P47完成」。',
    timeout: 480,
    verify: vSlide('P47') },
  { id: 'P48', desc: '要点+表页',
    prompt: '在末尾新增空白页，加标题「P48 风险清单」：正文加 2 条要点（交付周期波动 / 海外合规），再用 table_add 建 2 行 2 列表格（表头 风险/等级；行 合规/高）。完成后在右下角 textbox_add「P48完成」。',
    timeout: 360,
    verify: vSlide('P48') },

  // ── 全局与导出（12）──
  { id: 'P49', desc: '统一字体',
    prompt: '用 format_uniform 把全册字体统一为「苹方-简」（fontName="PingFang SC"，若失败用微软雅黑），表格形状跳过。完成后在最后一页右下角 textbox_add「P49完成」。',
    timeout: 420,
    verify: vSlide('P49') },
  { id: 'P50', desc: '统一字号',
    prompt: '用 format_uniform 把全册标题字号 28、正文字号 18（titleSize=28 bodySize=18）。完成后在最后一页右下角 textbox_add「P50完成」。',
    timeout: 420,
    verify: vSlide('P50') },
  { id: 'P51', desc: '大纲顺序重排',
    prompt: '把「P19 谢谢观看」那页移动到整个演示稿的最后（slide_move，先 slide_list 找到它的 index）。完成后在最后一页右下角 textbox_add「P51完成」。',
    timeout: 360,
    verify: vSlide('P51') },
  { id: 'P52', desc: '导出 PDF',
    prompt: '把整套演示稿导出 PDF（export format=pdf）到 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-deck.pdf。完成后在最后一页右下角 textbox_add「P52完成」。',
    timeout: 480,
    verify: async ({ tool }) => {
      const ok = fileExists('/Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-deck.pdf')
      return [ok, `pdf=${ok}`]
    } },
  { id: 'P53', desc: '导出图片集',
    prompt: '把演示稿导出为图片（export format=images）到目录 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-images/。完成后在最后一页右下角 textbox_add「P53完成」。',
    timeout: 480,
    verify: async ({ tool }) => {
      const dir = '/Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-images'
      let n = 0
      if (fs.existsSync(dir)) n = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg)$/i.test(f)).length
      return [n >= 1, `图片数=${n}`]
    } },
  { id: 'P54', desc: '第 1 页导出 PNG',
    prompt: '用 slide_export_image 把第 1 页导出为 PNG 到 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-slide1.png。完成后在最后一页右下角 textbox_add「P54完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const ok = fileExists('/Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-slide1.png')
      return [ok, `png=${ok}`]
    } },
  { id: 'P55', desc: '指定页导出 PNG',
    prompt: '用 slide_export_image 把第 3 页导出为 PNG 到 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-slide3.png。完成后在最后一页右下角 textbox_add「P55完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const ok = fileExists('/Users/zyh/work/chayuan-wps/artifacts/e2e-180/wpp-slide3.png')
      return [ok, `png=${ok}`]
    } },
  { id: 'P56', desc: '复制页并去重',
    prompt: '先用 slide_duplicate 复制最后一页，再把刚产生的副本用 slide_delete 删除（页数应还原）。完成后在最后一页右下角 textbox_add「P56完成」。',
    pre: async ({ tool }) => { STATE.p56count = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P56完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P56完成')
      }
      return [hit && slides.length === (STATE.p56count || 0), `marker=${hit} count=${slides.length}（前=${STATE.p56count}，应不变）`]
    } },
  { id: 'P57', desc: '全册审核报告页',
    prompt: '对全册做一次结构审核（slide_list 只读）：报告总页数、title 版式页数、含表格的页数，并把结论写到末尾新增页「P57 审核报告」的正文中。完成后在右下角 textbox_add「P57完成」。',
    timeout: 420,
    verify: vSlide('P57') },
  { id: 'P58', desc: '大纲文本页',
    prompt: '在末尾新增一页「P58 全册大纲」，正文列出全册前 12 页的标题（每行一个，用 slide_list 读取）。完成后在右下角 textbox_add「P58完成」。',
    timeout: 420,
    verify: vSlide('P58') },
  { id: 'P59', desc: '清理空白页',
    prompt: '找到之前创建的含「P11完成」文本框的那页，用 slide_delete 删除它。完成后在最后一页右下角 textbox_add「P59完成」。',
    pre: async ({ tool }) => { STATE.p59count = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P59完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P59完成')
      }
      return [hit && slides.length === (STATE.p59count || 0) - 1, `marker=${hit} count=${slides.length}（前=${STATE.p59count}，应-1）`]
    } },
  { id: 'P60', desc: '开始放映（收尾）',
    prompt: '最后两步：1) 在最后一页右下角 textbox_add「P60完成」；2) 用 slideshow_run 开始放映并立即报告已触发（不必停止放映）。',
    timeout: 300,
    verify: async ({ tool }) => {
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('P60完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('P60完成')
      }
      return [hit, `marker=${hit}（放映触发与否由 agent 报告）`]
    } },

  // ── 跨宿主 ──
  { id: 'X04', desc: '跨宿主取数：表格→演示',
    prompt: '跨宿主只读取数：用 spreadsheet 的 range_read 读取工作表 S03 的 F2:F2（不要修改表格），然后在演示稿末尾新增一页（layout=title），标题「X04 跨宿主取数」，副标题写「S03!F2 = <读取到的数值>」。完成后在最后一页右下角 textbox_add「X04完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const v = await tool('spreadsheet', { action: 'range_read', sheet: 'S03', range: 'F2:F2' })
      const cellVal = String(v?.values?.[0]?.[0] ?? '')
      const slides = await slideList(tool)
      const j = listJson(slides)
      let hit = j.includes('X04完成')
      if (!hit) {
        const sh = await tool('presentation', { action: 'shape_list', index: slides.length })
        hit = JSON.stringify(sh).includes('X04完成')
      }
      const hasVal = cellVal && j.includes(cellVal)
      return [hit, `marker=${hit} S03!F2=${cellVal} 清单含值=${!!hasVal}`]
    } }
]
