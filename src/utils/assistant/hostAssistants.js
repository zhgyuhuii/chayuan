/**
 * 表格（ET）/ 演示稿（WPP）宿主助手配方集。
 *
 * 设计定稿：《plans/表格与演示助手全景分析.md》——助手 =「预设意图 + 工具链 +
 * 输出形态 + 验收标准」的配方；通用高频 ★（跨行业，竞品共识）+ 行业包（全部内置，
 * 单层分发，见追问 1 定案）。面板侧边栏按宿主分流显示（et 只见表格助手、wpp 只见
 * 演示助手，wps 维持文档助手现状）；点击行为 = 把配方提示词填入输入框
 * （mode=send 立即发送 / mode=prefill 仅预填，用户补充后发送）。
 *
 * 配方提示词里的工具指引发给 chat.turn 基座的模型，由它编排 spreadsheet 与
 * presentation 域工具完成；写操作走现有预览→确认闸门。
 */

export const HOST_ASSISTANT_PACKS = {
  et: [
    // ── 通用高频 ★8 ──
    {
      id: 'et-insight',
      label: '数据洞察',
      shortLabel: '数据洞察',
      icon: '📈',
      group: '通用高频',
      mode: 'send',
      description: '分析当前表格数据：概况、趋势、异常值、TOP 要点（只读不改表）',
      prompt: '请分析当前工作表的已用数据区域（不要修改表格），输出：1) 数据概况（行列数与字段含义）；2) 关键趋势与结构占比；3) 异常值或缺失提醒；4) 最值得注意的 5 个要点。结论要带具体数字依据。'
    },
    {
      id: 'et-chart',
      label: '一键图表',
      shortLabel: '一键图表',
      icon: '📊',
      group: '通用高频',
      mode: 'prefill',
      description: '根据数据生成图表，自动推荐图型',
      prompt: '请根据当前工作表数据生成图表：先读取数据判断字段类型，推荐最合适的图型并说明理由，再用工具创建图表。我的补充要求：'
    },
    {
      id: 'et-formula',
      label: '公式助手',
      shortLabel: '公式助手',
      icon: 'ƒ(x)',
      group: '通用高频',
      mode: 'prefill',
      description: '大白话生成 Excel 公式并写入单元格',
      prompt: '请为当前表格生成公式并写入指定单元格（优先用 SUM/SUMIF/VLOOKUP 等标准函数，数字由表格自己计算）。我的需求：'
    },
    {
      id: 'et-clean',
      label: '数据清洗',
      shortLabel: '数据清洗',
      icon: '🧹',
      group: '通用高频',
      mode: 'send',
      description: '查重复行/空值/格式混写，报告后等确认再清理',
      prompt: '请检查当前工作表已用区域的数据质量：重复行、空值单元格、日期/数字/文本格式混写、首尾多余空格。先输出问题清单（位置+类型+建议处理方式），不要直接修改，等我回复"确认清理"后再执行。'
    },
    {
      id: 'et-sort',
      label: '排序汇总',
      shortLabel: '排序汇总',
      icon: '↕️',
      group: '通用高频',
      mode: 'prefill',
      description: '按维度排序、筛选、分类汇总',
      prompt: '请对当前数据表排序/汇总。我的要求：'
    },
    {
      id: 'et-report',
      label: '报表结论',
      shortLabel: '报表结论',
      icon: '📝',
      group: '通用高频',
      mode: 'send',
      description: '数据→简明结论报告（不改表）',
      prompt: '请读取当前表格全部数据，输出一份简明结论报告：核心数字、结构/环比变化、值得注意的风险点。不超过 300 字，不要修改表格。'
    },
    {
      id: 'et-create',
      label: '表格创建',
      shortLabel: '表格创建',
      icon: '🗂️',
      group: '通用高频',
      mode: 'prefill',
      description: '描述用途→自动建表头结构与示例行',
      prompt: '请新建一个工作表并搭好结构（表头 + 3 行示例数据）。表格用途：'
    },
    {
      id: 'et-export',
      label: '导出转换',
      shortLabel: '导出转换',
      icon: '📤',
      group: '通用高频',
      mode: 'prefill',
      description: '当前表导出 CSV/PDF 到桌面',
      prompt: '请把当前工作表导出（PDF 或 CSV，默认保存到桌面）。我的要求：'
    },
    // ── 行业包：财务 ──
    {
      id: 'et-fin-expense',
      label: '费用归类汇总',
      shortLabel: '费用归类',
      icon: '💰',
      group: '财务',
      mode: 'send',
      description: '按费用类型自动归类汇总明细（配方纪律：汇总行用公式）',
      prompt: '请把当前费用明细表按费用类型自动归类（交通/餐饮/办公/差旅/其他，按摘要文本语义判别），新建一个汇总表：类型、笔数、金额合计（合计用 SUMIF 公式而非写死数值），并在原表标记每行的归类结果。完成后提醒我：财务数字请人工复核。'
    },
    {
      id: 'et-fin-recon',
      label: '流水对账',
      shortLabel: '流水对账',
      icon: '🔍',
      group: '财务',
      mode: 'prefill',
      description: '两列流水按规则核对并标出差异',
      prompt: '请帮我核对流水：说明数据范围与匹配规则（例如 A 列银行流水 与 D 列账面记录，按金额+日期匹配），逐行核对后在差异行标记"未匹配"，最后汇总差异数量与金额。数据范围与规则：'
    },
    // ── 行业包：电商运营 ──
    {
      id: 'et-ec-sales',
      label: '销售汇总',
      shortLabel: '销售汇总',
      icon: '🛒',
      group: '电商运营',
      mode: 'send',
      description: '按 SKU/店铺/日期维度汇总，Top10 与环比',
      prompt: '请汇总当前销售明细表：按 SKU 和日期维度统计销量与销售额，输出 Top10 商品排行和环比变化，新建汇总表存放结果。字段名如不同请以表内实际字段为准。'
    },
    {
      id: 'et-ec-live',
      label: '直播复盘',
      shortLabel: '直播复盘',
      icon: '📺',
      group: '电商运营',
      mode: 'send',
      description: '直播数据漏斗转化分析与提升建议',
      prompt: '请分析当前直播数据表：计算从观看到下单的漏斗转化率（曝光→进入→互动→下单→成交），找出转化率明显偏低的环节，给出 3 条可执行的提升建议。只读分析，不要修改表。'
    },
    // ── 行业包：HR ──
    {
      id: 'et-hr-roster',
      label: '花名册统计',
      shortLabel: '花名册统计',
      icon: '👥',
      group: 'HR',
      mode: 'send',
      description: '部门/职级/性别/司龄分布汇总表',
      prompt: '请统计当前员工花名册：按部门、职级、性别、司龄区间输出分布汇总表（新建工作表存放），并给出 3 条数据观察。'
    },
    // ── 行业包：销售 ──
    {
      id: 'et-sale-commission',
      label: '提成计算',
      shortLabel: '提成计算',
      icon: '🏆',
      group: '销售',
      mode: 'prefill',
      description: '按规则计算提成（公式写入，可复核）',
      prompt: '请按提成规则计算当前销售表的提成列（用公式写入便于复核）。规则：'
    },
    // ── 行业包：教育 ──
    {
      id: 'et-edu-grade',
      label: '成绩统计',
      shortLabel: '成绩统计',
      icon: '🎓',
      group: '教育',
      mode: 'send',
      description: '平均分/及格率/优秀率/分数段分布',
      prompt: '请统计当前成绩表：各科平均分、及格率、优秀率、分数段分布（新建统计表存放，统计值用公式），并列出需要关注的学生名单。'
    }
  ],

  wpp: [
    // ── 通用高频 ★7 ──
    {
      id: 'wpp-gen',
      label: 'AI 生成 PPT',
      shortLabel: '生成 PPT',
      icon: '✨',
      group: '通用高频',
      mode: 'prefill',
      description: '一句话主题→大纲→逐页生成整套演示稿',
      prompt: '请为我生成一套演示稿：先给出大纲（页码+每页标题+要点），等我确认后逐页生成。主题与要求：'
    },
    {
      id: 'wpp-doctoppt',
      label: '文档转 PPT',
      shortLabel: '文档转 PPT',
      icon: '📄',
      group: '通用高频',
      mode: 'prefill',
      description: '读取 Word 文档内容，提炼大纲逐页生成',
      prompt: '请把 Word 文档转成演示稿：先读取文档内容（document_get_text），提炼成大纲，再逐页生成幻灯片。文档路径：'
    },
    {
      id: 'wpp-summary',
      label: '整套摘要',
      shortLabel: '整套摘要',
      icon: '🗒️',
      group: '通用高频',
      mode: 'send',
      description: '通读全部页面，生成核心要点摘要页',
      prompt: '请通读当前演示稿全部页面（slide_list + slide_read），在第 1 页之后新增一页摘要页（layout 用 text），标题"核心要点"，列出整套内容的 3-5 条要点。'
    },
    {
      id: 'wpp-beautify',
      label: '美化统一',
      shortLabel: '美化统一',
      icon: '🎨',
      group: '通用高频',
      mode: 'send',
      description: '全套字体字号统一（表格形状跳过）',
      prompt: '请统一当前演示稿排版：全部页面中文字体设为微软雅黑，标题字号 28、正文 18（format_uniform），表格形状跳过。完成后报告触及页数与形状数，并提醒我预览确认效果。'
    },
    {
      id: 'wpp-outline',
      label: '大纲调整',
      shortLabel: '大纲调整',
      icon: '🔀',
      group: '通用高频',
      mode: 'prefill',
      description: '增删移页、改标题、换版式',
      prompt: '请调整当前演示稿结构。我的要求：'
    },
    {
      id: 'wpp-datapage',
      label: '数据页',
      shortLabel: '数据页',
      icon: '📊',
      group: '通用高频',
      mode: 'prefill',
      description: '新增表格数据页（战报/对比/汇总）',
      prompt: '请新增一页数据页（table_add 生成表格）。数据内容与来源：'
    },
    {
      id: 'wpp-notes',
      label: '口播稿',
      shortLabel: '口播稿',
      icon: '🎤',
      group: '通用高频',
      mode: 'send',
      description: '每页生成演讲者备注，口语化 3-5 句',
      prompt: '请为当前演示稿的每一页生成演讲者备注（口播稿）：先逐页读取内容，再为每页写口语化的演讲词（每页 3-5 句，衔接自然），用 notes_set 写入对应页的备注。'
    },
    // ── 行业包：政企汇报 ──
    {
      id: 'wpp-gov-annual',
      label: '年终总结',
      shortLabel: '年终总结',
      icon: '🏛️',
      group: '政企汇报',
      mode: 'prefill',
      description: '政企风格：回顾/成绩/不足/计划 四段式',
      prompt: '请生成一份年终工作总结演示稿：政企风格（庄重版式、稳重配色），结构为 工作回顾 / 主要成绩 / 存在不足 / 下一步计划 四段，共 10 页左右（含封面与结尾页）。本年度主要工作：'
    },
    {
      id: 'wpp-gov-shuzhi',
      label: '述职报告',
      shortLabel: '述职报告',
      icon: '📜',
      group: '政企汇报',
      mode: 'prefill',
      description: '履职/业绩/不足改进/来年计划',
      prompt: '请生成一份述职报告演示稿：岗位职责履行情况 / 主要业绩（用数据说话）/ 不足与改进 / 来年工作计划，共 8 页左右。我的岗位与职责：'
    },
    // ── 行业包：销售提案 ──
    {
      id: 'wpp-sale-pitch',
      label: '产品提案',
      shortLabel: '产品提案',
      icon: '💼',
      group: '销售提案',
      mode: 'prefill',
      description: '痛点/方案/优势/案例/报价结构',
      prompt: '请生成一份产品提案演示稿：客户痛点 / 解决方案 / 核心优势 / 成功案例 / 报价与合作方式，共 10 页左右。产品信息：'
    },
    // ── 行业包：咨询方案 ──
    {
      id: 'wpp-con-framework',
      label: '方案框架',
      shortLabel: '方案框架',
      icon: '🧭',
      group: '咨询方案',
      mode: 'prefill',
      description: '背景-目标-举措-里程碑 四段式框架页',
      prompt: '请生成一份咨询方案框架演示稿：背景与问题 / 目标与口径 / 关键举措 / 里程碑与分工 四段式，每段 2-3 页。项目背景：'
    },
    // ── 行业包：教育培训 ──
    {
      id: 'wpp-edu-course',
      label: '课件生成',
      shortLabel: '课件生成',
      icon: '🏫',
      group: '教育培训',
      mode: 'prefill',
      description: '知识点分页课件+小结页',
      prompt: '请生成一份教学课件：按知识点分页（每页一个知识点，含要点与示例），结尾加小结页与思考题。课程主题与受众：'
    }
  ]
}

/** 宿主 → 配方条目（面板 assistantItems 形状） */
export function getHostAssistantItems(host) {
  const pack = HOST_ASSISTANT_PACKS[host]
  if (!pack) return []
  return pack.map(item => ({
    key: item.id,
    label: item.label,
    shortLabel: item.shortLabel || item.label,
    icon: item.icon,
    group: item.group,
    type: 'host-assistant',
    host,
    mode: item.mode || 'prefill',
    description: item.description,
    prompt: item.prompt,
    domain: '',
    tags: []
  }))
}

export function getHostAssistantRecipe(id) {
  for (const host of Object.keys(HOST_ASSISTANT_PACKS)) {
    const found = HOST_ASSISTANT_PACKS[host].find(item => item.id === id)
    if (found) return { ...found, host }
  }
  return null
}
