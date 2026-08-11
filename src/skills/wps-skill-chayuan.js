// src/skills/wps-skill-chayuan.js
// 察元 AI 文档助手 · L2b 运行时技能（由 scanAndRegisterSkills 自动注册，id 前缀 ext.skill.）
//
// 用途：装好 wps-skill-chayuan 之后，在 WPS「更多」里点这个技能，它会给出
//   ① 校对前置自检清单（MCP 在线？模型配好？当前文档对不对？）
//   ② 这份文档建议先跑哪些审查技能（错别字/序号/术语/结论风险/保密）
//   ③ 预览 → 确认 → 写回 的纪律提醒
// 不改正文（defaultAction: none），只输出指引到对话面板。

const SKILL_META = {
  version: '1.0.0',
  author: 'chayuan',
  description: 'wps-skill-chayuan 安装后的在岗自检与校对指引（不改正文）',
  tags: ['校对', '自检', '指引', 'wps-skill-chayuan'],
}

export default {
  // —— 身份 ——
  id: 'wps-skill-chayuan',
  label: '察元校对自检与指引',
  shortLabel: '校对自检',
  icon: '🩺',
  group: 'analysis',
  description:
    '不改正文。给出校对前置自检清单、当前文档建议的审查路径，以及预览→确认→写回的纪律提醒。wps-skill-chayuan 安装后的在岗自助入口。',

  // —— 输入输出 ——
  defaultInputSource: 'document',
  defaultOutputFormat: 'markdown',
  temperature: 0.3,

  // —— 写回：仅生成，不改正文（状态面板/指引用途）——
  allowedActions: ['none', 'insert'],
  defaultAction: 'none',
  defaultDisplayLocations: ['ribbon-more'],
  supportsRibbon: false,

  // —— 行为约束 ——
  systemPrompt: [
    '你是「察元校对自检与指引」助手，只做一件事：帮用户把审查校对开工前的准备做对，并给出纪律提醒。',
    '绝不改正文，也不直接产出问题清单（那是其它审查技能的职责）。',
    '按下列结构输出 Markdown：',
    '1. 自检清单：MCP 是否在线（端点 http://127.0.0.1:62588/mcp）、对话模型是否已配、当前活动文档是否就是要审的稿子、稿子是否带密级（涉密提示用离线模型）。',
    '2. 建议路径：根据文档类型（公文/合同/报告/标书等），建议先跑哪些察元审查技能，顺序建议为「先批注型（错别字/段落序号/术语统一/结论与风险/保密检查）→ 确认后再决定是否替换」。',
    '3. 纪律提醒：只读冒烟 → 预览问题清单 → 人工确认 → 写回（默认批注，原文不动）；表格错字批注靠 quote 带上下文；长文走分块；保密检查/AI 痕迹检查仅为辅助参考，不替代人工定密。',
    '4. 如用户用 Claude Code/Cursor 等客户端驱动，提示端点为 chayuan-wps-mcp，无 Token，仅 127.0.0.1。',
    '语气简短可执行，不堆套话。',
  ].join('\n'),

  userPromptTemplate: [
    '下面是我当前打开的文档（可能为空或选区）。请按系统提示给我一份「校对前置自检清单 + 建议审查路径 + 纪律提醒」。',
    '不要改正文，不要给我问题清单，只给指引。',
    '',
    '---',
    '{{input}}',
    '---',
  ].join('\n'),

  skill: SKILL_META,
}
