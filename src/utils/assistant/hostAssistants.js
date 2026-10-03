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
    {
      id: 'et-fin-invoice',
      label: '发票整理',
      shortLabel: '发票整理',
      icon: '🧾',
      group: '财务',
      mode: 'prefill',
      description: '发票明细规范化：日期/税额/金额列标准化',
      prompt: '请规范当前发票明细表：日期列统一为 YYYY-MM-DD，金额/税额列转为数字并保留两位小数，校验金额=不含税金额+税额（公式校验列），标出异常行。数据范围与特殊说明：'
    },
    {
      id: 'et-fin-statements',
      label: '三大报表指标',
      shortLabel: '报表指标',
      icon: '📊',
      group: '财务',
      mode: 'prefill',
      description: '资产负债表/利润表常用指标计算（公式写入）',
      prompt: '请为当前财务报表计算常用指标（公式写入新区域）：流动比率、速动比率、资产负债率、毛利率、净利率。请先读取表结构确认科目位置再写公式。指标口径补充：'
    },
    {
      id: 'et-fin-budget',
      label: '预算差异表',
      shortLabel: '预算差异',
      icon: '📉',
      group: '财务',
      mode: 'prefill',
      description: '预算 vs 实际差异表（差异额+差异率公式）',
      prompt: '请生成预算 vs 实际差异分析表：读取预算列与实际列，新增差异额（实际-预算）与差异率（差异额/预算，百分比格式）公式列，超支 10% 以上的行标红提示。数据范围：'
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
    {
      id: 'et-ec-competitor',
      label: '竞品价格对比',
      shortLabel: '竞品对比',
      icon: '⚖️',
      group: '电商运营',
      mode: 'prefill',
      description: '多店铺/平台同款价格对比表',
      prompt: '请生成竞品价格对比表：读取当前价格数据，按 商品×平台 汇总最低价/最高价/均价（公式），标出我方价格高于竞品均价的项。数据范围：'
    },
    {
      id: 'et-ec-comments',
      label: '留言情绪归类',
      shortLabel: '留言归类',
      icon: '💬',
      group: '电商运营',
      mode: 'send',
      description: '客户留言按好评/吐槽/咨询归类并计数',
      prompt: '请读取当前客户留言列，按 好评/吐槽/售后咨询/其它 语义归类：新建汇总表统计各类数量与占比，并在原表标记每条留言的类别。'
    },
    {
      id: 'et-ec-stock',
      label: '进销存统计',
      shortLabel: '进销存',
      icon: '📦',
      group: '电商运营',
      mode: 'prefill',
      description: '期初+入库-出库=库存 公式核算',
      prompt: '请核算当前进销存表：库存列用公式 =期初+入库-出账（按实际列名适配），标出库存为负或低于安全库存（如 <50）的商品行。数据范围与安全库存：'
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
    {
      id: 'et-hr-attendance',
      label: '考勤汇总',
      shortLabel: '考勤汇总',
      icon: '⏰',
      group: 'HR',
      mode: 'prefill',
      description: '出勤天数/迟到/缺卡按人汇总',
      prompt: '请按人汇总当前考勤明细：出勤天数、迟到次数、缺卡次数（COUNTIF 公式），输出汇总表并标出异常员工。数据范围与考勤规则：'
    },
    {
      id: 'et-hr-payroll',
      label: '薪酬核算',
      shortLabel: '薪酬核算',
      icon: '💵',
      group: 'HR',
      mode: 'prefill',
      description: '应发=基本+绩效-社保公积金 公式核算',
      prompt: '请核算当前薪酬表：应发工资 = 基本 + 绩效 - 社保 - 公积金（公式写入，数字由表格计算），按应发排序并输出汇总（总额/人均）。数据范围与口径：'
    },
    {
      id: 'et-hr-recruit',
      label: '招聘漏斗',
      shortLabel: '招聘漏斗',
      icon: '🫂',
      group: 'HR',
      mode: 'send',
      description: '投递→初筛→面试→offer 录用转化统计',
      prompt: '请统计当前招聘记录表：各阶段人数（投递/初筛/面试/Offer/录用）与阶段转化率，输出漏斗汇总表和转化率最低的环节。'
    },
    // ── 行业包：销售 ──
    {
      id: 'et-sale-rank',
      label: '业绩排名',
      shortLabel: '业绩排名',
      icon: '🥇',
      group: '销售',
      mode: 'send',
      description: '按销售额排名 + RANK 公式列',
      prompt: '请对当前销售表做业绩排名：新增排名列（RANK 公式），按销售额降序，输出 Top10 与全团队合计（SUM 公式）。'
    },
    {
      id: 'et-sale-forecast',
      label: '销售预测',
      shortLabel: '销售预测',
      icon: '🔮',
      group: '销售',
      mode: 'send',
      description: '按历史月度趋势给出下月预测与依据',
      prompt: '请按当前月度销售数据做下月预测：计算近三月移动平均与环比增长率，给出下月预测值（写公式或注明算法）与判断依据。只读分析。'
    },
    {
      id: 'et-sale-follow',
      label: '客户跟进整理',
      shortLabel: '客户跟进',
      icon: '📇',
      group: '销售',
      mode: 'send',
      description: '跟进记录按客户汇总Latest状态',
      prompt: '请把当前客户跟进记录按客户汇总：最近一次跟进日期、最新状态、未跟进天数（TODAY-最近日期公式），标出超 7 天未跟进的客户。'
    },
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
    },
    {
      id: 'et-edu-attendance',
      label: '考勤统计',
      shortLabel: '考勤统计',
      icon: '📋',
      group: '教育',
      mode: 'send',
      description: '学生出勤/请假次数统计表',
      prompt: '请统计当前考勤表：每个学生的出勤/请假/迟到次数（COUNTIF 公式），输出汇总表并标出请假超 3 次的学生。'
    },
    {
      id: 'et-edu-budget',
      label: '家庭记账',
      shortLabel: '家庭记账',
      icon: '🏠',
      group: '教育',
      mode: 'prefill',
      description: '家庭收支表+月度结余公式',
      prompt: '请创建家庭记账表：表头 日期/类别/项目/收入/支出/结余（结余=上行结余+收入-支出 公式链），预填 5 行示例。类别侧重：'
    },
    // ── 通用高频（2026-10 增补 9）──
    {
      id: 'et-merge-sheets',
      label: '多表合并汇总',
      shortLabel: '多表合并',
      icon: '🧮',
      group: '通用高频',
      mode: 'prefill',
      description: '多个同构工作表合并成一张汇总表（标注来源表）',
      prompt: '请把多个工作表的数据合并成一张汇总表：先 sheet_list 列出全部工作表，识别结构相同的明细表，逐表 range_read 后按统一表头合并，新建工作表「合并汇总」写入（加一列「来源表」标注每行出处），完成后报告各表并入行数。合并范围与补充规则：'
    },
    {
      id: 'et-diff-two',
      label: '两表对比差异',
      shortLabel: '两表对比',
      icon: '🆚',
      group: '通用高频',
      mode: 'prefill',
      description: '两份同构表按关键列核对：单侧行/同键不同值逐项标出',
      prompt: '请对比两张表找差异：分别 range_read 两表数据，按关键列（如 编号/姓名）匹配，标出 ① 只在A表有的行 ② 只在B表有的行 ③ 两表都有但字段值不同的行（列出差异字段与两个值），结果写入新工作表「差异报告」分三个区块，并在两表各自右侧加「核对结果」列标记每行状态。两张表名与关键列：'
    },
    {
      id: 'et-translate',
      label: '表格翻译',
      shortLabel: '表格翻译',
      icon: '🌐',
      group: '通用高频',
      mode: 'prefill',
      description: '整表文本互译：数字/公式/日期不动，译文写入新表',
      prompt: '请翻译当前表格：读取已用区域，仅翻译文本单元格（数字、公式、日期保持原样），新建工作表「翻译版」按相同行列结构写入译文，完成后抽样报告 3 处翻译对照。翻译方向与术语要求：'
    },
    {
      id: 'et-mask',
      label: '敏感信息脱敏',
      shortLabel: '脱敏',
      icon: '🛡️',
      group: '通用高频',
      mode: 'prefill',
      description: '手机号/身份证/银行卡打码（公式生成脱敏列，不覆盖原列）',
      prompt: '请对当前工作表做敏感信息脱敏：识别手机号（中间 4 位打码，如 138****1234）、身份证号（保留前 6 后 4）、银行卡号（保留后 4），用 REPLACE/LEFT/RIGHT 公式在原列右侧生成「脱敏」列（不覆盖原数据），完成后报告每类处理条数。数据范围与例外说明：'
    },
    {
      id: 'et-split-cols',
      label: '智能分列',
      shortLabel: '智能分列',
      icon: '✂️',
      group: '通用高频',
      mode: 'prefill',
      description: '一列拆多列（分隔符/固定规则），结果写新列、原列保留',
      prompt: '请把指定列拆分成多列：按分隔符或固定规则（如「张三 13800000000」拆成 姓名/电话 两列），拆分结果从原列右侧第一个空列开始写入（原列保留），并命名新列表头，完成后报告拆分行数。目标列与拆分规则：'
    },
    {
      id: 'et-split-sheets',
      label: '工作表拆分',
      shortLabel: '按列拆表',
      icon: '🗄️',
      group: '通用高频',
      mode: 'prefill',
      description: '按某列取值把当前表拆成多个工作表（如按部门拆名册）',
      prompt: '请按指定列的取值把当前表拆成多个工作表：每个取值一个新表（表名=取值，超 31 字符截断），表头与原表一致，数据行按取值归类写入，完成后报告各表行数。拆分依据列：'
    },
    {
      id: 'et-formula-explain',
      label: '公式解释',
      shortLabel: '公式解释',
      icon: '💡',
      group: '通用高频',
      mode: 'prefill',
      description: '选中公式→大白话解释计算逻辑，附改进建议',
      prompt: '请解释指定单元格的公式：range_read 读取公式文本，用大白话说明它在算什么（引用了哪些区域、分几步算、结果是什么含义），如有更简洁或更稳健的写法一并给出改进公式。公式所在单元格：'
    },
    {
      id: 'et-beautify',
      label: '一键美化',
      shortLabel: '一键美化',
      icon: '✨',
      group: '通用高频',
      mode: 'send',
      description: '表头样式/边框/对齐/列宽 一键排版（不改数值）',
      prompt: '请美化当前工作表排版（不要改动任何数值）：表头行加粗+深底白字+居中，数据区加细边框，数字列右对齐、文本列左对齐，日期列统一 YYYY-MM-DD 数字格式，列宽适当加宽（全部用 format 完成）。完成后报告触及区域。'
    },
    {
      id: 'et-mark',
      label: '异常标色',
      shortLabel: '异常标色',
      icon: '🚨',
      group: '通用高频',
      mode: 'prefill',
      description: '按规则给异常行整行标色并注明原因',
      prompt: '请按规则给当前表异常数据标色：满足条件的行整行浅红底色（format bgColor），并在右侧第一个空列写入异常原因文字，完成后报告异常行数与分布。标色规则（如 库存<50 / 超7天未跟进）：'
    },
    // ── 跨宿主（读其它宿主 + 写当前宿主，或反向；写前 pin 表自动校验目标身份）──
    {
      id: 'et-x-extract',
      label: '文档抽取成表',
      shortLabel: '抽取成表',
      icon: '📥',
      group: '跨宿主',
      mode: 'prefill',
      description: 'Word 合同/简历/文件 → 结构化台账表（读 wps 写 et）',
      prompt: '请从 Word 文档抽取信息生成台账表：先 document_get_text 读取文档内容，按字段清单抽取（如合同=甲方/乙方/金额/期限/签署日期），在当前工作簿新建工作表「台账」写入（一行一文档，文档未提及的字段标「未提及」），完成后报告抽取条数。文档名称与字段清单：'
    },
    {
      id: 'et-x-ppt',
      label: '数据战报页',
      shortLabel: '战报页',
      icon: '📣',
      group: '跨宿主',
      mode: 'prefill',
      description: '当前表核心数字 → 演示稿战报页（读 et 写 wpp）',
      prompt: '请把当前表格关键数据做成演示稿战报页：读取数据提炼 3-5 个核心数字，在打开的演示稿末尾新增一页（presentation slide_add，text 版式：标题+要点，每条要点一行带数字），完成后报告新增页码。数据侧重与战报要求：'
    },
    {
      id: 'et-x-report',
      label: '数据日报生成',
      shortLabel: '数据日报',
      icon: '📰',
      group: '跨宿主',
      mode: 'prefill',
      description: '表格结论 → Word 数据日报（读 et 写 wps）',
      prompt: '请把当前表格生成一份数据日报写入打开的 Word 文档：提炼核心数字与结论，用 document_insert 写入（标题+日期+三段式：总体情况/主要变化/风险提示，每段 2-3 句带数字依据），完成后报告写入内容概要。日报口径与目标文档：'
    },
    // ── 行业包：财务（增补 3）──
    {
      id: 'et-fin-aging',
      label: '应收账龄分析',
      shortLabel: '账龄分析',
      icon: '⏳',
      group: '财务',
      mode: 'prefill',
      description: '账龄分段（0-30/31-90/91-180/180+）金额汇总+超龄 TOP',
      prompt: '请对应收账款明细做账龄分析：按账龄分段（0-30 天/31-90 天/91-180 天/180 天以上，基于 TODAY-应收日期 公式列），新建「账龄分析」表输出各分段金额（SUMIFS 公式）与超龄客户 TOP5，180 天以上的行整行标红。数据范围与账龄基准日：'
    },
    {
      id: 'et-fin-bankrec',
      label: '银行余额调节表',
      shortLabel: '余额调节',
      icon: '⚖️',
      group: '财务',
      mode: 'prefill',
      description: '对账单 vs 账面余额勾对，未达账项四类分列（公式校验平衡）',
      prompt: '请生成银行余额调节表：读取银行对账单与账面记录两表，逐笔按金额+日期勾对，未匹配项按四类分列（企业已收银行未收/企业已付银行未付/银行已收企业未收/银行已付企业未付），新建「余额调节表」写入，调节后余额用公式计算并校验两边相等，不等则标红提示。两表范围与余额单元格：'
    },
    {
      id: 'et-fin-closecheck',
      label: '月末结账自查',
      shortLabel: '结账自查',
      icon: '✅',
      group: '财务',
      mode: 'send',
      description: '借贷平衡/科目异常/凭证断号/期间外日期 只读体检',
      prompt: '请对当前账表做月末结账前自查（只读不改）：① 借贷是否平衡（SUM 校验）② 科目余额方向异常（如资产类出现负数）③ 凭证号是否断号 ④ 是否有记账期间之外的日期。输出问题清单（位置+问题+建议），不要修改表格。'
    },
    // ── 行业包：电商运营（增补 3）──
    {
      id: 'et-ec-refund',
      label: '退货退款分析',
      shortLabel: '退货分析',
      icon: '↩️',
      group: '电商运营',
      mode: 'send',
      description: '退货率/原因语义归类/金额损失 TOP+3 条改善建议',
      prompt: '请分析当前退货/退款明细：计算整体退货率（退货单量/订单量）、按退货原因语义归类统计占比、金额损失 TOP5 商品，新建「退货分析」表存放结果，并给出 3 条可执行的降低退货率建议。'
    },
    {
      id: 'et-ec-roi',
      label: '大促ROI复盘',
      shortLabel: '大促ROI',
      icon: '🎯',
      group: '电商运营',
      mode: 'prefill',
      description: '分渠道投产比/客单价/净GMV 复盘表（ROI<1 标红）',
      prompt: '请复盘本次大促活动 ROI：读取活动费用与 GMV 数据，按渠道计算投产比（GMV/费用 公式列）、客单价、扣除退款后的净 GMV，新建「ROI复盘」表存放，ROI 低于 1 的渠道整行标红，最后给出投放调整建议。数据范围与口径：'
    },
    {
      id: 'et-ec-keywords',
      label: '评价关键词提取',
      shortLabel: '评价关键词',
      icon: '🔑',
      group: '电商运营',
      mode: 'send',
      description: '好评/差评分列提取高频词 TOP20+正负反馈总结',
      prompt: '请读取当前评价列：提取出现频次最高的 20 个关键词（好评/差评分开统计），新建「关键词」表输出 词/频次/占比/正负面，并总结用户主要的正面反馈点与负面抱怨点各 3 条。'
    },
    // ── 行业包：HR（增补 3）──
    {
      id: 'et-hr-turnover',
      label: '离职率分析',
      shortLabel: '离职率',
      icon: '🚪',
      group: 'HR',
      mode: 'send',
      description: '按部门×司龄分段离职率（COUNTIFS），异常偏高标出',
      prompt: '请分析当前员工流动数据：按部门、司龄区间（<1年/1-3年/3-5年/5年以上）计算离职率（离职人数/期均在册，COUNTIFS 公式），新建「离职分析」表输出分布矩阵，标出离职率明显偏高的部门并给 2 条数据观察。'
    },
    {
      id: 'et-hr-social',
      label: '社保公积金核算',
      shortLabel: '社保核算',
      icon: '🏥',
      group: 'HR',
      mode: 'prefill',
      description: '基数上下限截断（MIN/MAX）×费率，单位/个人分别核算',
      prompt: '请核算当前工资表的社保公积金：缴费基数按上下限截断（MIN/MAX 公式），单位与个人缴纳额分别按费率计算（公式写入），输出各类合计列与全表汇总。基数上下限与各险种费率：'
    },
    {
      id: 'et-hr-perfbox',
      label: '绩效分布对照',
      shortLabel: '绩效分布',
      icon: '🗂️',
      group: 'HR',
      mode: 'send',
      description: '等级×部门矩阵（COUNTIFS）与强制分布比例对照',
      prompt: '请统计当前绩效结果：按绩效等级×部门输出人数矩阵（COUNTIFS 公式，新建表存放），各等级与强制分布比例对照（如 A:B:C=2:7:1），标出超编/缺编的部门×等级格，并给 2 条校准建议。'
    },
    // ── 行业包：销售（增补 2）──
    {
      id: 'et-sale-funnel-amt',
      label: '商机金额漏斗',
      shortLabel: '金额漏斗',
      icon: '🌊',
      group: '销售',
      mode: 'send',
      description: '各阶段商机数与金额（SUMIF）+阶段转化率，金额流失定位',
      prompt: '请按商机阶段统计金额漏斗：各阶段商机数量与金额合计（SUMIF/COUNTIF 公式，新建表存放），计算阶段间金额转化率，标出金额流失最大的环节并给 1 条改进建议。'
    },
    {
      id: 'et-sale-region',
      label: '客户分布图',
      shortLabel: '客户分布',
      icon: '🗺️',
      group: '销售',
      mode: 'prefill',
      description: '按区域/行业统计客户数与销售额+柱状图对比',
      prompt: '请按区域（或行业）维度统计客户分布：各维度客户数（COUNTIF）与销售额合计（SUMIF），新建汇总表存放，并用 chart_add 生成柱状图对比各维度表现。维度字段与数据范围：'
    },
    // ── 行业包：教育（增补 3）──
    {
      id: 'et-edu-exam',
      label: '试卷质量分析',
      shortLabel: '试卷分析',
      icon: '📐',
      group: '教育',
      mode: 'send',
      description: '逐题难度系数/区分度（高低分组 27%），过难过易标出',
      prompt: '请对当前成绩表做试卷质量分析：逐题计算难度系数（平均得分/满分分值）与区分度（前 27% 高分组正确率 − 后 27% 低分组正确率），新建「试卷分析」表输出逐题指标，标出过难（难度<0.3）、过易（>0.9）与区分度差（<0.2）的题目。'
    },
    {
      id: 'et-edu-group',
      label: '随机分组排座',
      shortLabel: '分组排座',
      icon: '🎲',
      group: '教育',
      mode: 'prefill',
      description: '名单随机均分（可按性别/成绩均衡）+座位表输出',
      prompt: '请把当前名单随机分组并生成座位表：按组数（或每组人数）随机均分，如有性别/成绩均衡要求请说明，新建「分组表」与「座位表」两个工作表输出，完成后报告各组人数。分组要求：'
    },
    {
      id: 'et-edu-timetable',
      label: '课程表生成',
      shortLabel: '课程表',
      icon: '🗓️',
      group: '教育',
      mode: 'prefill',
      description: '班级课表网格排课（教师/教室冲突约束）',
      prompt: '请生成班级课程表：新建工作表按 周一~周五 × 节次 网格排课（每格=科目+教师），满足约束：同一教师同一时段不重复、指定科目优先上午，完成后报告排课总数与约束校验结果。科目节次与约束：'
    },
    // ── 行业包：医疗健康 ──
    {
      id: 'et-med-schedule',
      label: '排班表生成',
      shortLabel: '排班表',
      icon: '📅',
      group: '医疗健康',
      mode: 'prefill',
      description: '人员×日期网格排班（早/中/晚/休，人数与休息约束）',
      prompt: '请生成排班表：新建工作表按 人员×日期 网格排班（班次：早/中/晚/休），满足约束：每时段在岗人数不低于要求、每人每周休息不少于 X 天，完成后统计每人各班次次数。人员名单与约束条件：'
    },
    {
      id: 'et-med-followup',
      label: '随访到期名单',
      shortLabel: '随访名单',
      icon: '🔔',
      group: '医疗健康',
      mode: 'prefill',
      description: '距上次随访天数（TODAY-日期）筛选已到期/即将到期',
      prompt: '请从当前患者记录筛选随访名单：计算距上次随访天数（TODAY-随访日期 公式列），筛选已到期与 3 日内到期的患者，按紧迫度排序写入新表「随访名单」，已到期标红。随访周期与数据范围：'
    },
    // ── 行业包：制造仓储 ──
    {
      id: 'et-mfg-bom',
      label: 'BOM成本汇总',
      shortLabel: 'BOM成本',
      icon: '🏭',
      group: '制造仓储',
      mode: 'prefill',
      description: '物料用量×单价逐级汇总（roll-up），成本 TOP10 标出',
      prompt: '请核算 BOM 成本：读取物料清单（层级/用量/单价），逐级 roll-up 汇总（子件成本=用量×单价，父件成本=子件合计，全部公式写入），新建「成本汇总」表输出整机与半成品成本，标出成本占比 TOP10 物料。数据范围与层级规则：'
    },
    {
      id: 'et-mfg-stocktake',
      label: '盘点差异表',
      shortLabel: '盘点差异',
      icon: '📋',
      group: '制造仓储',
      mode: 'prefill',
      description: '账面 vs 实盘：差异量/差异率公式，按差异金额降序标色',
      prompt: '请生成盘点差异表：对比账面数量与实盘数量，差异量=实盘-账面（公式列）、差异率=差异量/账面（百分比格式），差异不为 0 的行标色，按差异金额（差异量×单价）降序写入新表「盘点差异」。数据范围：'
    },
    // ── 行业包：政务事业 ──
    {
      id: 'et-gov-statcheck',
      label: '统计填报校验',
      shortLabel: '填报校验',
      icon: '🏛️',
      group: '政务事业',
      mode: 'send',
      description: '合计=分项/本期=上期+增减/占比加总 逻辑关系只读校验',
      prompt: '请对当前统计报表做逻辑校验（只读不改）：① 合计=分项之和 ② 本期=上期+增减 ③ 各分项占比加总=100% ④ 必填单元格非空。输出问题清单（单元格位置+违反的规则+实际值），写入新表「校验报告」，不要修改原表。'
    },
    {
      id: 'et-gov-rostercheck',
      label: '名册核对',
      shortLabel: '名册核对',
      icon: '📇',
      group: '政务事业',
      mode: 'prefill',
      description: '两份名册按 姓名+证件号 核对：单侧/不一致逐项列出',
      prompt: '请核对两份名册：按姓名+证件号（或编号）匹配，标出 ① 只在A表的行 ② 只在B表的行 ③ 两表都有但信息不一致的行（列出差异字段），结果写入新表「核对报告」并在计数区输出三类行数。两表范围与匹配键：'
    },
    // ── 行业包：门店零售 ──
    {
      id: 'et-shop-diff',
      label: '日销盘点差异',
      shortLabel: '日销盘点',
      icon: '🏪',
      group: '门店零售',
      mode: 'prefill',
      description: '门店日销/日盘对照：损耗量与损耗率公式标色',
      prompt: '请生成门店日销盘点差异表：对比当日销量账面库存与实际盘存，损耗量=账面-实盘（公式列）、损耗率=损耗量/账面（百分比），损耗率超阈值的行标色，新建「日盘差异」表输出。数据范围与损耗阈值：'
    },
    {
      id: 'et-shop-supply',
      label: '供应商对价',
      shortLabel: '供应商对价',
      icon: '🤝',
      group: '门店零售',
      mode: 'send',
      description: '同品多供应商比价：最低价/价差率，推荐供货组合',
      prompt: '请对当前比价数据做供应商对价分析：按商品汇总各供应商报价，标出每品最低价供应商与价差率（（最高-最低）/最低 公式），新建「对价结果」表输出，并给出各品类的推荐供货组合。'
    },
    // ── 行业包：个人生活 ──
    {
      id: 'et-life-travel',
      label: '旅行预算表',
      shortLabel: '旅行预算',
      icon: '🧳',
      group: '个人生活',
      mode: 'prefill',
      description: '按行程天数搭预算框架：预算/实际/差额+分类汇总',
      prompt: '请创建旅行预算表：表头 日期/城市/项目/类别（交通/住宿/餐饮/门票/其他）/预算/实际/差额（差额=预算-实际 公式），按行程天数预填框架行，末尾附分类汇总块（SUMIF 按类别）。目的地与天数：'
    },
    {
      id: 'et-life-loan',
      label: '还贷计划表',
      shortLabel: '还贷计划',
      icon: '🏦',
      group: '个人生活',
      mode: 'prefill',
      description: '等额本息 PMT/IPMT/PPMT 逐期还款计划+利息总额',
      prompt: '请创建等额本息还贷计划表：顶部放参数区（贷款额/年利率/期数），用 PMT/IPMT/PPMT 公式生成逐期还款计划（期数/月供/利息/本金/剩余本金），末尾汇总利息总额与还款总额。贷款参数：'
    },
    {
      id: 'et-life-fitness',
      label: '体重健身追踪',
      shortLabel: '健身追踪',
      icon: '🏃',
      group: '个人生活',
      mode: 'prefill',
      description: '体重/运动/热量记录表：BMI 与周环比公式+趋势图表',
      prompt: '请创建体重健身追踪表：表头 日期/体重kg/运动类型/时长min/摄入kcal，参数区放身高（算 BMI=体重/身高² 公式列），预填 7 天示例数据，附体重周环比公式与一张体重趋势折线图（chart_add）。身高与目标：'
    }
  ],

  wpp: [
    // ── 通用高频 ★7 ──
    {
      id: 'wpp-gen',
      label: 'AI 生成 PPT',
      shortLabel: '生成PPT',
      icon: '✨',
      group: '通用高频',
      mode: 'prefill',
      description: '一句话主题→大纲→逐页生成（支持三级配图：模型生图/搜图/矢量）',
      prompt: '请为我生成一套演示稿：先给出大纲（页码+每页标题+要点），等我确认后逐页生成。主题与要求：'
    },
    {
      id: 'wpp-doctoppt',
      label: '文档转 PPT',
      shortLabel: '文档转PPT',
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
    // ── 配图（收割自 chayuan-office slides image-source 体系：web/model/svg 三级）──
    {
      id: 'wpp-img-web',
      label: '搜图配图页',
      shortLabel: '搜图配图',
      icon: '🌐',
      group: '配图',
      mode: 'prefill',
      description: 'image_search 搜真实图片插入（照片/实景类）',
      prompt: '请为当前演示稿配图：用 image_search 搜索合适图片（关键词自拟），presentation picture_add 插入到指定页。图片失败改 svg_add 矢量兜底。页码与主题：'
    },
    {
      id: 'wpp-img-model',
      label: 'AI 生图配图',
      shortLabel: 'AI 生图',
      icon: '🎨',
      group: '配图',
      mode: 'prefill',
      description: 'generate_image 生成插画/背景（风格可控）',
      prompt: '请用 generate_image 生成配图（提示词注明插画风格与配色），presentation picture_add 插入。生图失败改 svg_add 矢量兜底。页面与插画主题：'
    },
    {
      id: 'wpp-img-svg',
      label: '矢量图标装饰',
      shortLabel: '矢量装饰',
      icon: '🔷',
      group: '配图',
      mode: 'send',
      description: 'svg_add 语义单元矢量图形（免费可编辑）',
      prompt: '请为当前演示稿的第 1 页添加矢量装饰：用 presentation svg_add 生成 2-3 个语义图标（如增长箭头/齿轮/对话气泡，扁平风格、蓝色系），错落排布在页面右下区域，不要遮挡标题。'
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
    {
      id: 'wpp-gov-party',
      label: '党建课件',
      shortLabel: '党建课件',
      icon: 'flag',
      group: '政企汇报',
      mode: 'prefill',
      description: '党建学习课件：红色主题、严肃版式',
      prompt: '请生成一份党建学习课件：红色主色调、庄重版式，结构为 学习主题 / 精神解读 / 要点摘录 / 实践要求 / 学习小结，共 8 页左右。学习主题与要求：'
    },
    {
      id: 'wpp-gov-meeting',
      label: '会议纪要页',
      shortLabel: '会议纪要',
      icon: '🗂️',
      group: '政企汇报',
      mode: 'prefill',
      description: '会议纪要转决议/行动项页',
      prompt: '请把以下会议内容生成会议纪要页（1-2 页）：会议基本信息 / 讨论要点 / 决议事项 / 行动项与责任人。会议内容：'
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
    {
      id: 'wpp-sale-competitor',
      label: '竞品对比页',
      shortLabel: '竞品对比',
      icon: '⚔️',
      group: '销售提案',
      mode: 'prefill',
      description: '我方 vs 竞品 对比矩阵页',
      prompt: '请生成竞品对比页：用 table_add 做对比矩阵（维度：功能/价格/服务/交付），我方 vs 主要竞品 2 家。我方产品与竞品信息：'
    },
    {
      id: 'wpp-sale-case',
      label: '案例展示页',
      shortLabel: '案例展示',
      icon: '🏅',
      group: '销售提案',
      mode: 'prefill',
      description: '客户案例：背景/方案/成效数据页',
      prompt: '请生成客户案例展示页（每案例 1 页：客户背景 / 部署方案 / 成效数据）。案例信息：'
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
    {
      id: 'wpp-con-review',
      label: '项目复盘',
      shortLabel: '项目复盘',
      icon: '🔄',
      group: '咨询方案',
      mode: 'prefill',
      description: '目标达成/亮点/问题/改进 复盘页组',
      prompt: '请生成项目复盘演示稿：目标达成情况 / 亮点与经验 / 问题与根因 / 改进措施 四部分，共 6-8 页。项目信息：'
    },
    {
      id: 'wpp-con-bp',
      label: '商业计划骨架',
      shortLabel: '商业计划',
      icon: '🧱',
      group: '咨询方案',
      mode: 'prefill',
      description: 'BP 骨架：市场/产品/模式/团队/财务',
      prompt: '请生成商业计划书骨架演示稿：市场分析 / 产品与服务 / 商业模式 / 团队 / 财务预测 / 融资计划，共 10 页左右（框架+要点占位）。项目：'
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
    },
    {
      id: 'wpp-edu-defense',
      label: '答辩模板',
      shortLabel: '答辩模板',
      icon: '🎓',
      group: '教育培训',
      mode: 'prefill',
      description: '毕业答辩：选题/方法/结论/致谢',
      prompt: '请生成毕业答辩演示稿：选题背景 / 研究方法 / 核心结论 / 创新点 / 致谢，共 8 页左右。论文题目与核心内容：'
    },
    {
      id: 'wpp-edu-quiz',
      label: '习题互动页',
      shortLabel: '习题互动',
      icon: '❓',
      group: '教育培训',
      mode: 'prefill',
      description: '课堂习题页（题目+答案翻页）',
      prompt: '请生成课堂习题页：题目页 2-3 页（每页 1-2 道题），每题后跟一页答案解析。科目与知识点：'
    },
    // ── 行业包：通用职场 ──
    {
      id: 'wpp-work-weekly',
      label: '周报转汇报页',
      shortLabel: '周报汇报页',
      icon: '📅',
      group: '通用职场',
      mode: 'prefill',
      description: '本周工作/下周计划 两页式',
      prompt: '请把以下周报内容生成汇报页（2 页：本周工作 / 下周计划）。周报内容：'
    },
    {
      id: 'wpp-work-actions',
      label: '行动项页',
      shortLabel: '行动项',
      icon: '✅',
      group: '通用职场',
      mode: 'prefill',
      description: '会议/复盘转行动项与责任人页',
      prompt: '请生成行动项跟踪页（table_add 表格：事项/责任人/截止日/状态）。待办内容：'
    },
    // ── 通用高频（2026-10 增补 7）──
    {
      id: 'wpp-proof',
      label: '整套校对',
      shortLabel: '整套校对',
      icon: '🔍',
      group: '通用高频',
      mode: 'send',
      description: '全页只读校对：错别字/重复词/占位符，问题清单不改文字',
      prompt: '请通读当前演示稿全部页面（slide_list + slide_read）做只读校对：错别字、重复词、占位符文本（Lorem/TODO/XX/示例）、明显标点问题。输出问题清单（页码+原文+修改建议），不要修改任何文字。'
    },
    {
      id: 'wpp-structure',
      label: '结构诊断',
      shortLabel: '结构诊断',
      icon: '🩺',
      group: '通用高频',
      mode: 'send',
      description: '金字塔检查：标题故事线/单页要点数/结构件缺失+改进建议',
      prompt: '请对当前演示稿做结构诊断（只读不改）：① 按顺序连读每页标题，判断故事线是否连贯（是否结论先行、层次递进）② 单页要点是否超过 5 条、有无文字过密页 ③ 是否缺封面/目录/章节过渡页/结尾页 ④ 给出 3-5 条结构调整建议（注明页码与操作）。'
    },
    {
      id: 'wpp-scaffold',
      label: '结构件补齐',
      shortLabel: '结构件补齐',
      icon: '🧱',
      group: '通用高频',
      mode: 'send',
      description: '封面/目录/章节页/结尾页 缺啥补啥（风格跟随现稿）',
      prompt: '请检查并补齐当前演示稿的结构件：缺封面则加封面页（主标题+副标题+日期），缺目录则加目录页（列出各章节），长稿的章节之间缺过渡页则补齐，缺结尾感谢页则加。新页风格与现有页面保持一致，完成后列出新增的页码与页名。'
    },
    {
      id: 'wpp-to-doc',
      label: '转讲义文档',
      shortLabel: '转讲义',
      icon: '📃',
      group: '通用高频',
      mode: 'prefill',
      description: '整套 PPT → Word 讲义（页码+标题+要点+备注，跨宿主写入）',
      prompt: '请把当前演示稿转成 Word 讲义：逐页读取内容（slide_list + slide_read），按「页码+标题+要点+备注」结构整理，用 document_insert 写入打开的 Word 文档（每页一个小节，标题加粗），完成后报告写入页数。目标文档与要求：'
    },
    {
      id: 'wpp-notes-timed',
      label: '口播稿（时长版）',
      shortLabel: '口播时长版',
      icon: '⏱️',
      group: '通用高频',
      mode: 'prefill',
      description: '按目标总时长分配每页秒数生成口播稿（notes_set 写入）',
      prompt: '请为当前演示稿生成口播稿并写入每页备注（notes_set）：先逐页读取内容，按目标总时长分配每页秒数，为每页写口语化演讲词（3-5 句、衔接自然），开场页注明开场白、结尾页注明收尾。目标总时长（默认 5 分钟）：'
    },
    {
      id: 'wpp-translate',
      label: '整套翻译',
      shortLabel: '整套翻译',
      icon: '🈯',
      group: '通用高频',
      mode: 'prefill',
      description: '全页文本译为目标语言（数字/专有名词不动，版式不变）',
      prompt: '请把当前演示稿整套翻译：逐页 slide_read 后用 text_replace 将文本译为目标语言（数字、专有名词、代码保持原样），版式不变，完成后报告翻译页数与替换处数。目标语言与术语表：'
    },
    {
      id: 'wpp-footer',
      label: '页码页脚统一',
      shortLabel: '页码页脚',
      icon: '🔢',
      group: '通用高频',
      mode: 'prefill',
      description: '每页加页码/单位名（textbox_add 批量，封面跳过）',
      prompt: '请给当前演示稿统一加页脚：除封面外每页右下角加页码 textbox_add（字号 12、灰色），左下角加单位名文字，位置各页一致，完成后报告触及页数。页脚文字要求：'
    },
    // ── 行业包：政企汇报（增补 3）──
    {
      id: 'wpp-gov-rectify',
      label: '整改汇报',
      shortLabel: '整改汇报',
      icon: '🧾',
      group: '政企汇报',
      mode: 'prefill',
      description: '巡察/审计整改：问题/原因/措施/成效/长效机制 五段式',
      prompt: '请生成一份巡察（审计）整改汇报演示稿：问题清单 / 原因剖析 / 整改措施 / 整改成效（用数据）/ 长效机制 五段式，政企庄重风格，共 10 页左右。问题与整改情况：'
    },
    {
      id: 'wpp-gov-livelihood',
      label: '民生实事汇报',
      shortLabel: '民生实事',
      icon: '🏘️',
      group: '政企汇报',
      mode: 'prefill',
      description: '项目清单/进度数据/资金使用/群众反馈/下步安排',
      prompt: '请生成一份民生实事项目汇报演示稿：项目清单与责任分工 / 进度完成情况（用数据）/ 资金使用情况 / 群众反馈与满意度 / 下一步安排，庄重风格，共 8-10 页。项目信息：'
    },
    {
      id: 'wpp-gov-safetyedu',
      label: '安全警示教育课件',
      shortLabel: '安全警示',
      icon: '⚠️',
      group: '政企汇报',
      mode: 'prefill',
      description: '事故案例/原因剖析/法规摘录/防范措施，严肃警示风',
      prompt: '请生成一份安全警示教育课件：事故案例回顾 / 原因剖析 / 法规条款摘录 / 防范措施 / 警示总结，严肃风格（深色警示配色），共 8 页左右。行业与案例主题：'
    },
    // ── 行业包：医疗健康 ──
    {
      id: 'wpp-med-mdt',
      label: '病例讨论课件',
      shortLabel: '病例讨论',
      icon: '🩻',
      group: '医疗健康',
      mode: 'prefill',
      description: '病例摘要/检查/诊断依据/鉴别诊断/治疗方案/讨论问题',
      prompt: '请生成一份病例讨论课件：病例摘要 / 检查结果 / 诊断依据 / 鉴别诊断 / 治疗方案 / 讨论问题，医学严谨风格（简洁白底蓝字），共 8 页左右。病例信息：'
    },
    {
      id: 'wpp-med-edu',
      label: '患者宣教课件',
      shortLabel: '患者宣教',
      icon: '💖',
      group: '医疗健康',
      mode: 'prefill',
      description: '通俗语言宣教：疾病认知/日常注意/用药/复诊/误区',
      prompt: '请生成一份患者宣教课件：这个病是什么 / 日常注意事项 / 用药提醒 / 何时需要复诊 / 常见误区，用通俗语言+要点化表达（避免专业术语堆砌），共 6-8 页。病种与目标人群：'
    },
    {
      id: 'wpp-med-dept',
      label: '科室年度汇报',
      shortLabel: '科室汇报',
      icon: '🏥',
      group: '医疗健康',
      mode: 'prefill',
      description: '业务数据/重点工作/学科建设/明年计划',
      prompt: '请生成一份科室年度汇报演示稿：年度业务数据（门诊量/手术量/平均住院日/满意度）/ 重点工作完成情况 / 学科建设与人才培养 / 明年工作计划，共 8-10 页。科室数据与工作：'
    },
    // ── 行业包：制造安环 ──
    {
      id: 'wpp-mfg-safety',
      label: '安全生产培训课件',
      shortLabel: '安全培训',
      icon: '⛑️',
      group: '制造安环',
      mode: 'prefill',
      description: '规程要点/事故案例/违章后果/操作规范/应急处置',
      prompt: '请生成一份安全生产培训课件：安全规程要点 / 典型事故案例 / 违章后果 / 规范操作要求 / 应急处置流程，共 8 页左右，适合班组安全学习。行业与培训主题：'
    },
    {
      id: 'wpp-mfg-sop',
      label: '设备操作SOP页',
      shortLabel: '操作SOP',
      icon: '⚙️',
      group: '制造安环',
      mode: 'prefill',
      description: '开机检查/分步操作/参数范围/异常处理/停机流程',
      prompt: '请生成一份设备操作规程页组：开机前检查 / 操作步骤（分步编号）/ 关键参数范围 / 异常处理 / 停机流程，步骤清晰编号、便于张贴，共 4-6 页。设备与规程要点：'
    },
    // ── 行业包：金融 ──
    {
      id: 'wpp-fin-roadshow',
      label: '投资者路演',
      shortLabel: '路演BP',
      icon: '🎪',
      group: '金融',
      mode: 'prefill',
      description: '市场/壁垒/增长数据/单位经济模型/团队/融资计划',
      prompt: '请生成一份投资者路演演示稿：市场机会 / 产品与技术壁垒 / 增长数据（营收/留存/单位经济模型）/ 团队 / 融资计划与资金用途，共 12 页左右，数据页用大数字版式。项目信息：'
    },
    {
      id: 'wpp-fin-compliance',
      label: '合规内训课件',
      shortLabel: '合规内训',
      icon: '📢',
      group: '金融',
      mode: 'prefill',
      description: '监管解读/违规情形/案例警示/操作红线/自查清单',
      prompt: '请生成一份合规内训课件：监管要求解读 / 常见违规情形 / 案例警示 / 操作红线清单 / 合规自查方法，严肃风格，共 8 页左右。合规主题与监管条线：'
    },
    {
      id: 'wpp-fin-product',
      label: '产品说明会',
      shortLabel: '说明会',
      icon: '🏦',
      group: '金融',
      mode: 'prefill',
      description: '需求/方案/收益费用/风险提示/服务联系（含合规话术）',
      prompt: '请生成一份产品说明会演示稿：客户需求分析 / 产品方案 / 收益与费用说明 / 风险提示（醒目单独一页）/ 服务与联系方式，共 8 页左右。产品信息：'
    },
    // ── 行业包：电商运营 ──
    {
      id: 'wpp-ec-battle',
      label: '大促战报页',
      shortLabel: '大促战报',
      icon: '🎆',
      group: '电商运营',
      mode: 'prefill',
      description: '核心数字战报页+渠道爆品排行表+同比战报（喜庆风）',
      prompt: '请生成大促战报页组：① 核心战报页（GMV/订单量/新增用户 用大数字版式）② 渠道与爆品排行页（table_add 表格）③ 同比战报页，喜庆热烈氛围（红金配色），共 3-4 页。战报数据：'
    },
    {
      id: 'wpp-ec-live-script',
      label: '直播脚本分镜',
      shortLabel: '直播脚本',
      icon: '🎬',
      group: '电商运营',
      mode: 'prefill',
      description: '场次流程时间轴/分时段商品话术/利益点与逼单节奏',
      prompt: '请生成直播带货脚本页组：场次流程时间轴 / 各时段商品与话术要点 / 利益点与逼单节奏 / 互动与留人设计，共 4-5 页，话术要口语化。直播商品与排期：'
    },
    // ── 行业包：教育培训（增补 3）──
    {
      id: 'wpp-edu-parents',
      label: '家长会课件',
      shortLabel: '家长会',
      icon: '👨‍👩‍👧',
      group: '教育培训',
      mode: 'prefill',
      description: '班级情况/学期分析（不点名）/问题/家庭配合建议',
      prompt: '请生成一份家长会课件：班级整体情况 / 学期学习分析（用整体数据，不点名到个人）/ 存在的共性问题 / 给家庭的配合建议 / 沟通渠道，温和亲切风格，共 6-8 页。班级信息：'
    },
    {
      id: 'wpp-edu-recruit',
      label: '招生宣讲',
      shortLabel: '招生宣讲',
      icon: '🎓',
      group: '教育培训',
      mode: 'prefill',
      description: '机构介绍/师资/课程体系/成果数据/报名方式',
      prompt: '请生成一份招生宣讲演示稿：学校（机构）介绍 / 师资力量 / 课程体系 / 办学成果数据 / 报名方式与优惠政策，共 8-10 页。机构信息：'
    },
    {
      id: 'wpp-edu-class',
      label: '主题班会课件',
      shortLabel: '主题班会',
      icon: '🍎',
      group: '教育培训',
      mode: 'prefill',
      description: '主题导入/案例故事/讨论问题/行动倡议/总结',
      prompt: '请生成一份主题班会课件：主题导入 / 案例或故事 / 讨论问题 / 行动倡议 / 总结，共 5-7 页，风格贴合中学生审美。班会主题与要求：'
    },
    // ── 行业包：房产置业 ──
    {
      id: 'wpp-realestate',
      label: '楼盘推介',
      shortLabel: '楼盘推介',
      icon: '🏙️',
      group: '房产置业',
      mode: 'prefill',
      description: '区位交通/配套/户型价格表/园林/开发商品牌',
      prompt: '请生成一份楼盘推介演示稿：区位与交通 / 周边配套 / 户型与价格（table_add 参数表）/ 社区园林与物业 / 开发商品牌，共 8-10 页，高端大气风格。楼盘信息：'
    },
    // ── 行业包：活动婚庆 ──
    {
      id: 'wpp-wed-flow',
      label: '婚礼流程页',
      shortLabel: '婚礼流程',
      icon: '💍',
      group: '活动婚庆',
      mode: 'prefill',
      description: '仪式时间轴/环节说明/人员分工/物料清单（浪漫风）',
      prompt: '请生成一份婚礼流程演示稿：仪式流程时间轴 / 各环节说明 / 人员分工 / 物料清单，浪漫温馨风格（粉金色系），共 5-6 页。婚礼信息：'
    },
    {
      id: 'wpp-event-plan',
      label: '活动执行方案',
      shortLabel: '活动方案',
      icon: '🎪',
      group: '活动婚庆',
      mode: 'prefill',
      description: '目标/议程/分工责任矩阵（table_add）/预算/应急预案',
      prompt: '请生成一份活动执行方案演示稿：活动目标 / 时间地点与议程 / 分工与责任矩阵（table_add 表格）/ 物料与预算 / 应急预案，共 6-8 页。活动信息：'
    },
    {
      id: 'wpp-food-new',
      label: '新品推介页',
      shortLabel: '新品推介',
      icon: '🍜',
      group: '活动婚庆',
      mode: 'prefill',
      description: '新品卖点/目标人群/价格渠道/上市节奏/促销方案',
      prompt: '请生成一份新品推介演示稿：新品卖点 / 目标人群 / 价格与渠道 / 上市节奏 / 促销方案，共 4-5 页，食欲感与画面感优先（配图用 generate_image 或 svg_add）。新品信息：'
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
