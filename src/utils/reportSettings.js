const REPORT_TYPE_GROUPS = [
  {
    key: 'audit',
    label: '审计与监督',
    options: [
      { value: 'engineering-audit-report', label: '工程审计报告' },
      { value: 'financial-audit-report', label: '财务审计报告' },
      { value: 'internal-control-audit-report', label: '内控审计报告' },
      { value: 'compliance-audit-report', label: '合规审计报告' },
      { value: 'information-system-audit-report', label: '信息系统审计报告' },
      { value: 'procurement-audit-report', label: '采购审计报告' },
      { value: 'project-audit-report', label: '项目审计报告' },
      { value: 'performance-audit-report', label: '绩效审计报告' },
      { value: 'special-audit-report', label: '专项审计报告' },
      { value: 'departure-audit-report', label: '离任审计报告' }
    ]
  },
  {
    key: 'finance',
    label: '财务与审计',
    options: [
      { value: 'financial-analysis-report', label: '财务分析报告' },
      { value: 'operating-analysis-report', label: '经营分析报告' },
      { value: 'budget-execution-report', label: '预算执行报告' },
      { value: 'cost-analysis-report', label: '成本分析报告' },
      { value: 'cashflow-analysis-report', label: '现金流分析报告' },
      { value: 'investment-feasibility-report', label: '投融资可行性报告' },
      { value: 'asset-inventory-report', label: '资产盘点报告' },
      { value: 'tax-compliance-report', label: '税务合规报告' },
      { value: 'financial-statement-analysis-report', label: '财务报表分析报告' },
      { value: 'profitability-analysis-report', label: '盈利能力分析报告' },
      { value: 'accounts-receivable-analysis-report', label: '应收账款分析报告' },
      { value: 'working-capital-report', label: '营运资金分析报告' }
    ]
  },
  {
    key: 'project',
    label: '项目与工程',
    options: [
      { value: 'project-progress-report', label: '项目进展报告' },
      { value: 'project-review-report', label: '项目复盘报告' },
      { value: 'engineering-quality-report', label: '工程质量报告' },
      { value: 'engineering-supervision-report', label: '工程监理报告' },
      { value: 'completion-acceptance-report', label: '竣工验收报告' },
      { value: 'implementation-evaluation-report', label: '实施评估报告' },
      { value: 'milestone-review-report', label: '里程碑评审报告' },
      { value: 'change-impact-report', label: '变更影响报告' },
      { value: 'feasibility-study-report', label: '可行性研究报告' },
      { value: 'post-project-evaluation-report', label: '项目后评价报告' },
      { value: 'bidding-evaluation-report', label: '招投标评审报告' }
    ]
  },
  {
    key: 'risk',
    label: '风险与合规',
    options: [
      { value: 'risk-assessment-report', label: '风险评估报告' },
      { value: 'compliance-inspection-report', label: '合规检查报告' },
      { value: 'security-review-report', label: '安全审查报告' },
      { value: 'cybersecurity-report', label: '网络安全报告' },
      { value: 'data-security-report', label: '数据安全报告' },
      { value: 'confidentiality-review-report', label: '保密审查报告' },
      { value: 'legal-due-diligence-report', label: '法务尽调报告' },
      { value: 'incident-investigation-report', label: '事件调查报告' },
      { value: 'business-continuity-risk-report', label: '业务连续性风险报告' },
      { value: 'third-party-risk-report', label: '第三方风险评估报告' },
      { value: 'privacy-impact-assessment-report', label: '个人信息保护影响评估报告' }
    ]
  },
  {
    key: 'operation',
    label: '运营与管理',
    options: [
      { value: 'weekly-report', label: '周报' },
      { value: 'monthly-report', label: '月报' },
      { value: 'quarterly-report', label: '季度报告' },
      { value: 'annual-report', label: '年度报告' },
      { value: 'special-research-report', label: '专题调研报告' },
      { value: 'decision-support-report', label: '决策支持报告' },
      { value: 'management-review-report', label: '管理评审报告' },
      { value: 'process-optimization-report', label: '流程优化报告' },
      { value: 'strategic-planning-report', label: '战略规划报告' },
      { value: 'okr-review-report', label: 'OKR 复盘报告' },
      { value: 'organizational-diagnosis-report', label: '组织诊断报告' }
    ]
  },
  {
    key: 'market',
    label: '市场与客户',
    options: [
      { value: 'market-research-report', label: '市场调研报告' },
      { value: 'competitive-analysis-report', label: '竞品分析报告' },
      { value: 'customer-insight-report', label: '客户洞察报告' },
      { value: 'sales-analysis-report', label: '销售分析报告' },
      { value: 'brand-evaluation-report', label: '品牌评估报告' },
      { value: 'public-opinion-analysis-report', label: '舆情分析报告' },
      { value: 'consumer-behavior-report', label: '消费者行为分析报告' },
      { value: 'channel-analysis-report', label: '渠道分析报告' },
      { value: 'campaign-effectiveness-report', label: '营销活动复盘报告' }
    ]
  },
  {
    key: 'people',
    label: '人力与行政',
    options: [
      { value: 'talent-assessment-report', label: '人才评估报告' },
      { value: 'training-effectiveness-report', label: '培训效果报告' },
      { value: 'attendance-analysis-report', label: '考勤分析报告' },
      { value: 'performance-evaluation-report', label: '绩效评估报告' },
      { value: 'administrative-inspection-report', label: '行政检查报告' },
      { value: 'employee-engagement-report', label: '员工敬业度报告' },
      { value: 'compensation-analysis-report', label: '薪酬分析报告' },
      { value: 'workforce-planning-report', label: '人力编制规划报告' }
    ]
  },
  {
    key: 'education',
    label: '教育与培训',
    options: [
      { value: 'teaching-quality-report', label: '教学质量分析报告' },
      { value: 'curriculum-evaluation-report', label: '课程评估报告' },
      { value: 'student-development-report', label: '学情分析报告' },
      { value: 'enrollment-analysis-report', label: '招生分析报告' },
      { value: 'education-training-summary-report', label: '培训总结报告' },
      { value: 'school-development-report', label: '学校发展质量报告' },
      { value: 'learning-outcome-assessment-report', label: '学习成果评估报告' },
      { value: 'education-research-report', label: '教研分析报告' }
    ]
  },
  {
    key: 'technology',
    label: '研发与信息化',
    options: [
      { value: 'software-metrics-report', label: '软件度量报告' },
      { value: 'technical-evaluation-report', label: '技术评估报告' },
      { value: 'architecture-review-report', label: '架构评审报告' },
      { value: 'test-analysis-report', label: '测试分析报告' },
      { value: 'defect-analysis-report', label: '缺陷分析报告' },
      { value: 'system-operation-report', label: '系统运行报告' },
      { value: 'deployment-review-report', label: '上线评估报告' },
      { value: 'technology-due-diligence-report', label: '技术尽调报告' },
      { value: 'ai-governance-assessment-report', label: 'AI 治理评估报告' },
      { value: 'data-quality-report', label: '数据质量报告' }
    ]
  },
  {
    key: 'medical',
    label: '医疗与健康',
    options: [
      { value: 'medical-quality-report', label: '医疗质量报告' },
      { value: 'clinical-audit-report', label: '临床审计报告' },
      { value: 'drug-safety-report', label: '药品安全报告' },
      { value: 'medical-equipment-report', label: '医疗设备评估报告' },
      { value: 'patient-safety-report', label: '患者安全报告' },
      { value: 'health-management-report', label: '健康管理报告' },
      { value: 'hospital-operation-analysis-report', label: '医院运营分析报告' },
      { value: 'public-health-assessment-report', label: '公共卫生评估报告' },
      { value: 'medical-compliance-report', label: '医疗合规报告' }
    ]
  },
  {
    key: 'government',
    label: '政府与公文',
    options: [
      { value: 'government-briefing-report', label: '政务简报' },
      { value: 'policy-analysis-report', label: '政策分析报告' },
      { value: 'administrative-decision-report', label: '行政决策报告' },
      { value: 'government-inspection-report', label: '政务督查报告' },
      { value: 'public-service-report', label: '公共服务报告' },
      { value: 'government-annual-report', label: '政府工作报告' },
      { value: 'policy-implementation-evaluation-report', label: '政策实施评估报告' },
      { value: 'public-budget-performance-report', label: '财政绩效评价报告' },
      { value: 'petition-analysis-report', label: '信访事项分析报告' }
    ]
  },
  {
    key: 'manufacturing',
    label: '制造与质量',
    options: [
      { value: 'manufacturing-quality-report', label: '制造质量报告' },
      { value: 'production-safety-report', label: '生产安全报告' },
      { value: 'supply-chain-audit-report', label: '供应链审计报告' },
      { value: 'equipment-maintenance-report', label: '设备维护报告' },
      { value: 'process-capability-report', label: '过程能力分析报告' },
      { value: 'quality-inspection-report', label: '质量检验报告' },
      { value: 'lean-manufacturing-report', label: '精益生产分析报告' },
      { value: 'supplier-quality-report', label: '供应商质量报告' },
      { value: 'factory-audit-report', label: '工厂审核报告' }
    ]
  },
  {
    key: 'research',
    label: '科研与学术',
    options: [
      { value: 'research-progress-report', label: '科研进展报告' },
      { value: 'literature-review-report', label: '文献综述报告' },
      { value: 'experiment-analysis-report', label: '实验分析报告' },
      { value: 'project-application-report', label: '项目申报报告' },
      { value: 'academic-evaluation-report', label: '学术评估报告' },
      { value: 'research-summary-report', label: '科研总结报告' },
      { value: 'technology-novelty-search-report', label: '科技查新报告' },
      { value: 'grant-progress-report', label: '课题中期检查报告' },
      { value: 'research-impact-report', label: '科研影响力报告' }
    ]
  },
  {
    key: 'legal',
    label: '法务与合同',
    options: [
      { value: 'contract-review-report', label: '合同审查报告' },
      { value: 'legal-risk-report', label: '法律风险评估报告' },
      { value: 'litigation-analysis-report', label: '诉讼分析报告' },
      { value: 'compliance-legal-report', label: '合规法务报告' },
      { value: 'intellectual-property-report', label: '知识产权报告' },
      { value: 'legal-opinion-report', label: '法律意见报告' },
      { value: 'contract-performance-risk-report', label: '合同履约风险报告' },
      { value: 'regulatory-change-impact-report', label: '监管变化影响报告' },
      { value: 'dispute-resolution-strategy-report', label: '争议解决策略报告' }
    ]
  },
  {
    key: 'esg',
    label: 'ESG 与可持续',
    options: [
      { value: 'esg-report', label: 'ESG 报告' },
      { value: 'sustainability-report', label: '可持续发展报告' },
      { value: 'social-responsibility-report', label: '社会责任报告' },
      { value: 'esg-due-diligence-report', label: 'ESG 尽职调查报告' },
      { value: 'carbon-emission-inventory-report', label: '碳排放盘查报告' },
      { value: 'carbon-neutrality-roadmap-report', label: '碳中和路径报告' },
      { value: 'green-finance-assessment-report', label: '绿色金融评估报告' },
      { value: 'supply-chain-esg-report', label: '供应链 ESG 评估报告' }
    ]
  },
  {
    key: 'data-governance',
    label: '数据与智能化',
    options: [
      { value: 'data-governance-assessment-report', label: '数据治理评估报告' },
      { value: 'data-asset-inventory-report', label: '数据资产盘点报告' },
      { value: 'data-compliance-report', label: '数据合规报告' },
      { value: 'algorithm-risk-assessment-report', label: '算法风险评估报告' },
      { value: 'ai-application-evaluation-report', label: 'AI 应用成效评估报告' },
      { value: 'digital-transformation-report', label: '数字化转型评估报告' },
      { value: 'business-intelligence-report', label: '经营数据洞察报告' }
    ]
  },
  {
    key: 'finance-industry',
    label: '金融与投资',
    options: [
      { value: 'investment-research-report', label: '投资研究报告' },
      { value: 'credit-risk-report', label: '信用风险报告' },
      { value: 'fund-performance-report', label: '基金绩效报告' },
      { value: 'portfolio-analysis-report', label: '投资组合分析报告' },
      { value: 'valuation-report', label: '估值分析报告' },
      { value: 'merger-acquisition-due-diligence-report', label: '并购尽职调查报告' },
      { value: 'anti-money-laundering-report', label: '反洗钱监测报告' }
    ]
  },
  {
    key: 'real-estate',
    label: '房地产与资产',
    options: [
      { value: 'real-estate-market-report', label: '房地产市场分析报告' },
      { value: 'asset-valuation-report', label: '资产评估报告' },
      { value: 'property-operation-report', label: '物业运营报告' },
      { value: 'land-investment-analysis-report', label: '土地投资分析报告' },
      { value: 'urban-renewal-assessment-report', label: '城市更新评估报告' },
      { value: 'lease-operation-report', label: '租赁运营分析报告' }
    ]
  },
  {
    key: 'energy-environment',
    label: '能源与环境',
    options: [
      { value: 'environmental-impact-assessment-report', label: '环境影响分析报告' },
      { value: 'energy-audit-report', label: '能源审计报告' },
      { value: 'energy-saving-assessment-report', label: '节能评估报告' },
      { value: 'renewable-energy-feasibility-report', label: '新能源可行性报告' },
      { value: 'pollution-control-report', label: '污染治理评估报告' },
      { value: 'ecological-restoration-report', label: '生态修复评估报告' }
    ]
  },
  {
    key: 'safety-emergency',
    label: '安全与应急',
    options: [
      { value: 'safety-production-assessment-report', label: '安全生产评估报告' },
      { value: 'emergency-response-review-report', label: '应急处置复盘报告' },
      { value: 'accident-investigation-report', label: '事故调查报告' },
      { value: 'hazard-identification-report', label: '隐患排查报告' },
      { value: 'fire-safety-inspection-report', label: '消防安全检查报告' },
      { value: 'occupational-health-report', label: '职业健康评估报告' }
    ]
  },
  {
    key: 'supply-chain',
    label: '供应链与采购',
    options: [
      { value: 'supplier-assessment-report', label: '供应商评估报告' },
      { value: 'procurement-analysis-report', label: '采购分析报告' },
      { value: 'inventory-analysis-report', label: '库存分析报告' },
      { value: 'logistics-performance-report', label: '物流绩效报告' },
      { value: 'supply-chain-resilience-report', label: '供应链韧性评估报告' },
      { value: 'contractor-performance-report', label: '承包商履约评价报告' }
    ]
  },
  {
    key: 'public-welfare',
    label: '社会与公益',
    options: [
      { value: 'social-impact-assessment-report', label: '社会影响评估报告' },
      { value: 'charity-project-evaluation-report', label: '公益项目评估报告' },
      { value: 'community-governance-report', label: '社区治理报告' },
      { value: 'stakeholder-analysis-report', label: '利益相关方分析报告' },
      { value: 'public-satisfaction-report', label: '公众满意度调查报告' }
    ]
  },
  {
    key: 'general',
    label: '通用与其他',
    options: [
      { value: 'general-analysis-report', label: '综合分析报告' },
      { value: 'evaluation-report', label: '评估报告' },
      { value: 'review-report', label: '审查报告' },
      { value: 'briefing-report', label: '简报' },
      { value: 'custom', label: '自定义报告类型' }
    ]
  }
]

export const REPORT_TYPE_OPTIONS = REPORT_TYPE_GROUPS.flatMap(group => (
  group.options.map(option => ({
    ...option,
    group: group.key,
    groupLabel: group.label
  }))
))

const REPORT_TYPE_LABEL_MAP = new Map(
  REPORT_TYPE_OPTIONS.map(item => [item.value, item.label])
)

export const DEFAULT_REPORT_TEMPLATE = `# {{reportType}}

## 一、执行摘要
- 概述报告背景、审查范围、核心结论和优先级最高的问题。

## 二、报告对象与范围
- 说明材料来源、时间范围、对象边界、适用标准和假设条件。

## 三、关键发现
- 分条列出主要发现。
- 对每项发现补充事实依据、影响范围、风险等级或重要性判断。

## 四、问题分析
- 说明问题成因、触发条件、上下文限制和潜在连锁影响。

## 五、结论
- 给出整体判断，并明确哪些内容需要人工复核。

## 六、建议与行动项
- 按“建议措施 / 责任角色 / 优先级 / 时间要求”输出。

## 七、附录
- 如有必要，补充引用原文片段、术语说明、数据口径或待确认事项。`

export function getReportTypeGroups() {
  return REPORT_TYPE_GROUPS.map(group => ({
    ...group,
    options: group.options.map(option => ({ ...option }))
  }))
}

export function getReportTypeLabel(type, customType = '') {
  const normalizedType = String(type || '').trim() || 'general-analysis-report'
  if (normalizedType === 'custom') {
    const customLabel = String(customType || '').trim()
    return customLabel || '自定义报告'
  }
  return REPORT_TYPE_LABEL_MAP.get(normalizedType) || normalizedType
}

export function normalizeReportSettings(value, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const base = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {}
  const type = String(source.type || base.type || 'general-analysis-report').trim() || 'general-analysis-report'
  return {
    enabled: source.enabled === true || (source.enabled === undefined && base.enabled === true),
    type: REPORT_TYPE_LABEL_MAP.has(type) || type === 'custom' ? type : String(base.type || 'general-analysis-report'),
    customType: String(source.customType || base.customType || '').trim(),
    template: String(source.template || base.template || DEFAULT_REPORT_TEMPLATE),
    prompt: String(source.prompt || base.prompt || '').trim()
  }
}

export function createDefaultReportSettings(overrides = {}) {
  return normalizeReportSettings({
    enabled: false,
    type: 'general-analysis-report',
    customType: '',
    template: DEFAULT_REPORT_TEMPLATE,
    prompt: ''
  }, overrides)
}

export function renderReportTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}
