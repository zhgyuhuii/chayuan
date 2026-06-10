# 助手输入与上下文统一模型设计（选区 / 全文 / 附件 / 图像 / 知识库）

- 日期：2026-06-11
- 状态：设计待评审
- 涉及项目：`/work/chayuan-wps`（WPS 加载项执行器与对话框）
- 关联现有能力：`src/utils/documentActions.js`（`resolveDocumentInput`）、`src/utils/assistantTaskRunner.js`（输入解析/分段/写回）、`src/utils/multimodalTaskRunner.js`（多模态**生成**）、`runtimeCapabilities.useKnowledgeBase`（已有 RAG 注入）、`mammoth`/`pdfjs-dist`/`xlsx`（已内置解析库）

---

## 1. 背景与目标

助手执行时「拿什么作为输入/上下文」目前只支持两种文本来源：**当前选区**与**全文**。真实办公诉求远不止于此：

- 选中一段就只处理该段（已修：`resolveDocumentInput` 的 `document` 分支改为选区优先，commit `f102f7f`）；
- **上传附件**作为分析对象 / 仿写样例 / 参考资料；
- **上传图片**作视觉输入（看图分析、图表解读、截图转表格）；
- 生成类助手**不需要任何文本**（已修：空输入/空分段放行，不弹「处理全文」确认）；
- 上述来源**自由组合**（如「按这份模板附件改写选中段落」）。

**目标**：建立一套**统一、显式、可配置**的输入/上下文模型，一处接入执行器即覆盖全部 3000+ 助手；附件与图像**本地解析、不出网**（契合察元离线/不出域定位）；用户在执行前**看得见、可调整**上下文来源。

**非目标（本期不做）**：联网抓取 URL/网页；跨工作簿实时同步；音视频输入。

## 2. 现状与缺口

| 能力 | 现状 |
|---|---|
| 选区 / 全文文本输入 | ✅ 已有（选区优先已修） |
| 生成类空输入 | ✅ 已修 |
| 多模态**生成**（文生图/音/视频） | ✅ 已有（`mediaKind` + `generateMultimodalAsset`） |
| 附件作输入/样例/参考 | ❌ 无 |
| 图像**视觉**输入（消费图片） | ❌ 无 |
| 上下文显式可见/可切换 | ❌ 无（仅隐式按 `inputSource`） |
| 知识库作参考 | ✅ 已有（`useKnowledgeBase` 注入 `{{kbContext}}`） |

核心缺口是**附件输入**与**图像视觉输入**两条新链路，以及一个把所有来源统一起来的**输入模型 + 上下文选择器 UI**。

## 3. 其他软件做法与最佳实践

| 软件 | 借鉴点 |
|---|---|
| ChatGPT / Claude | 拖拽/点击/粘贴多文件；文本抽取 + 图片走 vision；**剪贴板截图**直接分析 |
| MS Copilot(Word) | 选区 vs 全文显式切换；**引用其它文件**拉内容 |
| Cursor / Notion AI | **显式上下文 chip**（@文件/@选区），运行前可见可改 |
| Gemini / 文心 | 文件 + 多模态；**无 vision 时 OCR 兜底**；图表解读 |

**沉淀的最佳实践**：① 上下文**显式 chip、可见可改**；② 附件**多类型 + 角色化**（对象/样例/参考）；③ **token 预算**提示与择优截断，不静默丢弃；④ 图像**视觉 / OCR 双路**；⑤ **本地解析不出网**；⑥ 抽取文本**可预览**（用户知道模型看到了什么）。

## 4. 统一输入模型（核心）

执行器内部统一为一个 `inputPlan`，由「助手默认 + 当前选区状态 + 用户在弹窗的调整」三者合成：

```js
inputPlan = {
  // 主对象:被处理/分析/转换的主体
  primary: 'selection' | 'document' | 'attachment' | 'image' | 'none',
  // 附件(本地解析):文本类抽取为 text;图片类保留 dataUrl 走视觉
  attachments: [
    { id, name, kind: 'doc' | 'image',
      role: 'object' | 'sample' | 'reference',   // 对象 / 样例 / 参考
      text?: string, imageDataUrl?: string, truncated?: boolean }
  ],
  useKnowledgeBase: boolean,        // 复用现有 RAG -> {{kbContext}}
  referenceDocs?: [docName...],     // Phase 3:引用其它已打开文档
  meta: { primaryText, primaryTokens, attachmentTokens, totalTokens, budget }
}
```

**助手侧默认声明**（新增可选字段 `inputModes`，不声明则按动作派生，零迁移）：

```js
inputModes: {
  primary: 'auto',        // auto=按 defaultAction 派生(生成→none、其它→选区优先)
  acceptAttachments: true,
  acceptImages: false,    // 识图类助手设 true
  defaultAttachmentRole: 'object'  // 仿写类助手设 'sample'
}
```

**派生规则（auto，覆盖未声明的全部老助手）**：
- `defaultAction ∈ {insert,append,prepend}` 且无选区/无附件 → `primary='none'`（生成）；
- 否则 → `primary='selection'`（有选区）或 `'document'`（无选区）——即已修的选区优先；
- 有附件且 `role='object'` → `primary='attachment'`；附件 `role∈{sample,reference}` 作 grounding，不改 primary。

## 5. 上下文选择器 UI（显式 chip 栏）

助手执行入口（对话框运行/参数收集弹窗）顶部加一条**「上下文」chip 栏**：

```
上下文：[● 选区 12 字] [ 全文 ] [+ 附件] [+ 图片] [+ 知识库]      约 1.2k tokens / 上限 8k
        └ 附件:合同模板.docx ▸角色[对象|样例|参考]  ✕
```

- 默认根据助手 `inputModes` + 当前选区状态点亮；
- `+附件`：点击/拖拽/多选；`+图片`：上传或**Ctrl+V 粘贴截图**；
- 每个附件可切角色（对象/样例/参考）；图片显缩略图；
- 右侧实时 **token 预算**；超限标红并给「择优截断/先摘要」选项；
- 点附件可**预览抽取文本**（确认模型看到什么）。

## 6. Phase 1 — 附件文本输入

1. **解析服务** `attachmentParser.js`：按扩展名分发——docx→`mammoth`、pdf→`pdfjs-dist`、xlsx/csv→`xlsx`（表格转 Markdown 表或结构化文本）、txt/md→直读。**全部本地解析、不出网**；解析失败给可诊断错误，不静默。
2. **角色语义**：
   - `object`（对象）→ 作为 `primary`，等同「分析/审查这份附件」；
   - `sample`（样例）→ 注入 `{{sample}}`，提示「仿照此样例的结构/风格」；
   - `reference`（参考）→ 注入 `{{reference}}`，提示「结合以下参考资料」。
3. **Prompt 组装**（执行器统一）：`{{input}}`=primary 文本；新增 `{{attachments}}/{{sample}}/{{reference}}` 变量；保持 `{{kbContext}}` 不变。模板未含新变量时，参考内容以「【参考资料】…」段落追加到用户消息尾部。
4. **token 预算**：估算 primary+附件+KB 总量，超 `chunkLength`/模型上下文时：优先保 primary，参考类**择优截断并明确提示**截了多少。

## 7. Phase 2 — 图像视觉输入

5. **图片来源**：上传 + 剪贴板粘贴；多图；缩略图预览。
6. **模型能力检测**：所选模型声明/推断是否支持 vision。
   - 支持 → 构造视觉消息（`image_url`/base64），复用 `multimodalTaskRunner` 的错误分类思路；
   - **不支持 → OCR 兜底**（图片转文字后走文本链路）或明确提示「当前模型不支持看图，请切换 vision 模型或启用 OCR」。
7. **看图类助手**（新增少量）：图表解读、截图转表格、看图写文案；`inputModes.acceptImages=true`、`primary='image'`。

## 8. Phase 3 — 增强（可选后续）

- 引用**其它已打开文档**（Copilot 式「引用文件」）；
- **结构化表格专路**（Excel→保留行列结构而非糊成一段）；
- **批量多附件**（逐个处理 / 合并分析切换）。

## 9. 关键设计决策（建议拍板项）

| # | 决策 | 建议 |
|---|---|---|
| D1 | 附件角色三态 | **对象 / 样例 / 参考** 三态够用，先落地这三种 |
| D2 | 解析位置 | **本地解析、不出网**（隐私卖点，硬约束） |
| D3 | token 超限 | **提示 + 择优截断**（保 primary，截参考并告知），不静默 |
| D4 | 图像无 vision | **OCR 兜底优先**；同时给「换 vision 模型」提示 |
| D5 | 老助手迁移 | `inputModes` 缺省按动作派生，**零迁移**覆盖 3000+ |
| D6 | 上下文可见性 | **显式 chip 栏**，默认点亮、可改，不藏 |

## 10. 分期实施

- **Phase 0**（已上线）：选区优先、生成类空输入/空分段、不弹「处理全文」。
- **Phase 1**：`inputPlan` 模型 + 派生规则（执行器一处）→ 解析服务 → chip 栏 + 附件上传/角色 → Prompt 组装 + token 预算 + 抽取预览。
- **Phase 2**：图片上传/粘贴 + vision 检测 + OCR 兜底 + 视觉消息 + 看图类助手。
- **Phase 3**：引用其它文档、结构化表格专路、批量附件。

## 11. 验收要点

- 选中执行只处理选中、未选中处理全文（已可验）；
- 上传 docx/pdf/xlsx 作「对象」→ 助手分析的是附件内容；作「样例」→ 输出仿照样例；作「参考」→ 结合参考作答；
- 附件 + 选区组合：选区为对象、附件为参考时，两者都进上下文；
- 超长附件触发 token 提示并按规则截断、给出截断说明；
- 图片作输入：vision 模型直接看图；非 vision 模型走 OCR 或明确降级提示；
- 全程附件/图片本地解析，无外发请求（可抓包验证）。

## 12. 风险与未决

- WPS COM 读取剪贴板图片、多文档引用的 API 可用性需真机验证；
- vision 模型可用性依赖用户配置；OCR 兜底质量有限（扫描件/复杂版式）；
- token 估算为近似，跨模型上下文上限不同，需保守取值；
- 待拍板：D1~D6（尤其 D4 OCR 优先级、D3 截断策略）。
