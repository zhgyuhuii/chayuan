#!/usr/bin/env node
// 读 manifest.csv 生成 README.md 总索引
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const lines = fs.readFileSync(path.join(ROOT, 'manifest.csv'), 'utf8').trim().split(/\r?\n/);
const header = lines.shift().split(',');
const rows = lines.map(l => { const c = l.split(','); const o = {}; header.forEach((h, i) => o[h] = c[i]); return o; });

const SERIES = {};
for (const r of rows) (SERIES[r.series_code] ??= { name: r.series_name, items: [] }).items.push(r);

let needRec = rows.filter(r => r.need_record === '是').length;

let md = `# 察元 AI · 100 条爆款短视频脚本包

> 一套面向政企/专业办公用户的产品宣传短视频脚本库。**爆款场景驱动**，每条 15–40s、竖屏 9:16，
> 适配抖音 / 视频号 / 小红书。脚本、封面、截图三者用**统一编号**强绑定，拿到即可录屏 / 剪辑。

- 产品：察元 AI（Chayuan AI）· WPS 加载项 v3.0.12 + 桌面 / 服务 / 至臻版
- 官网：https://aidooo.com ｜ 开源：Apache 2.0 ｜ 出品：北京智灵鸟科技中心
- 设计文档：\`../docs/superpowers/specs/2026-06-20-chayuan-100-video-scripts-design.md\`

## 目录结构与对应关系

| 资产 | 路径 | 说明 |
|---|---|---|
| **配音稿** | \`voiceover/<编号>.md\` | **纯主持人口播文稿**，无任何标注，拿来直接配音 / 喂 TTS 生成音频 |
| 分镜脚本 | \`scripts/<编号>.md\` | 100 条分镜脚本（钩子 / 痛点 / 分镜表 / CTA / 素材 / 可拍清单），拍摄 / 剪辑用 |
| 封面 | \`covers/<编号>.svg\` | 9:16 竖版标题封面，可直接做视频首帧 / 缩略图 |
| 截图 | \`assets/screenshots/<代码>.png\` | 仓库现有真实界面截图的语义软链（见下方图例） |
| 清单 | \`manifest.csv\` | 编号→系列→场景→截图→需录屏 的机器可读映射 |

**编号即对应**：\`voiceover/072.md\`（配音）↔ \`scripts/072.md\`（分镜）↔ \`covers/072.svg\`（封面）↔ \`manifest.csv\` 第 072 行指定截图。

> 制作流程：① 念 \`voiceover/<编号>.md\` 配音生成音频 → ② 按 \`scripts/<编号>.md\` 分镜表录屏 / 套用 \`covers/<编号>.svg\` 首帧 → ③ 音画合成成片。

## 重要说明

- 本包**不含 MP4 成片**：当前环境无 ffmpeg / TTS / 渲染工具。交付的是「脚本 + 分镜 + 可拍清单 + 封面 + 截图」，供拍摄 / 录屏 / 剪辑直接使用。
- 截图为仓库现有 ~15 张真实界面图（去重后）。**${needRec} 条**脚本涉及现有截图覆盖不到的画面（弹窗内步骤、右键菜单、引用条、写回动作、SQL 诊断等），已在各脚本「需新录屏/截图」中逐条标清。

## 截图图例（assets/screenshots/）

| 代码 | 界面 |
|---|---|
| W-ABOUT | WPS 加载项「关于察元 AI 助手」页（欢迎+二维码） |
| W-TEXT | WPS「文本分析」下拉（重写/扩写/缩写/段落序号/AI痕迹/批注解释/超链接解释/纠错/提炼关键词） |
| W-MORE | WPS「更多」下拉（涉密词提取/表单提取/润色/正式化/通俗化/行动项/结论风险/术语统一/生成标题/段落结构/会议纪要/公文风格/自定义助手） |
| W-AUDIT | WPS「察元AI编审」（表单/文档审计/模板/规则/任务清单） |
| W-MODEL | 设置-模型供应商（OpenAI/Ollama/通义/DeepSeek/千帆…） |
| W-DEFAULT | 设置-默认模型（对话/图像/视频/语音） |
| W-ASSIST | 设置-助手设置（系统助手列表+助手配置） |
| W-KB | WPS 知识库连接（测试连通/编辑/可访问知识库） |
| C-HOME | 客户端工作主页（AI操控/翻译/写作/妙记/同传字幕/修图） |
| C-CHAT | 客户端新对话 |
| C-ARENA | 客户端多模型并排对比 |
| C-KBLIST | 客户端知识中心 |
| C-KBNEW | 客户端新建知识库（文档/图像/结构化/外部向量） |
| C-MARKET | 客户端模型广场 |
| C-FLOW | 客户端智能空间工作流编辑器 |

## 100 条索引

`;

const codeName = { A: 'A 政务公文合规', B: 'B 合同法务', C: 'C 标书投标', D: 'D 通用写作提效', E: 'E 摘要会议纪要', F: 'F 翻译多语言', G: 'G 知识库RAG', H: 'H 批量处理', I: 'I 多模态', J: 'J 部署·信任·开源' };

for (const code of Object.keys(SERIES)) {
  const s = SERIES[code];
  md += `\n### ${codeName[code] || code}（${s.items.length} 条）\n\n`;
  md += `| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of s.items) {
    md += `| ${r.id} | ${r.title} | ${r.audience} | ${r.duration_s}s | [配音](voiceover/${r.id}.md) | [分镜](scripts/${r.id}.md) | [封面](covers/${r.id}.svg) | ${r.screenshot} | ${r.need_record} |\n`;
  }
}

md += `\n## 重新生成\n\n\`\`\`bash\nnode generate_covers.cjs   # 重出 100 张封面\nnode build_readme.cjs      # 重出本 README\n\`\`\`\n`;

fs.writeFileSync(path.join(ROOT, 'README.md'), md, 'utf8');
console.log('README.md 已生成，索引', rows.length, '条，需录屏', needRec, '条');
