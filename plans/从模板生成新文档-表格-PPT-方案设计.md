# 从已有模板生成新文档 / 表格 / PPT —— 实施方案 v2.2（共识版）

> 版本：v2.2（2026-10-14：v2.1 含第二轮自审修正；v2.2 增补分类型处理流程「剖析→访谈→计划→槽位填充→质检」，业界方案对照见 §六；v1 的现状深度分析仍然有效）
> 范围：文字（wps）/ 表格（et）/ 演示（wpp）三宿主**同步交付**，**同宿主约束**（模板 kind 必须与当前宿主匹配）
> 红线不变：不调用任何 `Documents.Add/Workbooks.Add/Presentations.Add`；一切新建走「复制 → Open 打开 → 新建标记」；Agent 侧一切新建必须过用户确认。

---

## 〇、十一项共识决策记录

| # | 决策点 | 共识结论 |
|---|--------|----------|
| 1 | 交付范围 | **三宿主齐步走**，doc/sheet/slide 一次覆盖统一发布 |
| 2 | 打开通路风险 | **viaOs 兜底照发**：`createFromTemplate` 第一天内置双通路（jsapi Open → 失败退 OS 级打开），不阻塞发版（仅同宿主场景） |
| 3 | 模板来源 | **用户附件上传 / 提供路径**，不做内置业务模板；附件链路已支持二进制 office 文件（已验证） |
| 4 | 复用模型 | **用后询问入库**：结果卡带「存为模板」；后续"用上次那个模板"可按名命中 |
| 5 | 模板定位 | **样式承载体**（字体/间距/图元/背景/风格），工作方式 = 打开模板→就地改内容→**多次识别扫描**内容与版式合理性 |
| 6 | 质检信号 | **三层分级**：语义审 + 几何校验必做；视觉审（导 PNG 给多模态模型）为可配置增强档（仅 PPT） |
| 7 | PPT 页扩展 | **就地改 → 复制扩展 → 新建兜底**三层降级；新建页在报告标注"原生版式页" |
| 8 | 落盘策略 | **临时工作态 → 质检通过 → 交付**；交付机制修正为 **`SaveAs2(savePath)`**（非文件移动——打开中的文件有写锁，move 不可行），交付后**清除 `NdNewFile` 标记**（防后续 Ctrl+S 反复弹另存为），文档留在最终路径继续可编辑 |
| 9 | 确认粒度 | **计划确认 + 报告两段式**（计划卡 JSON → 循环 → 报告卡带"继续修"） |
| 10 | 入口策略 | **聊天主入口 + 模板库对话框**（接线孤儿组件，但执行体重写，见 §3.5） |
| 11 | 跨宿主错配 | **同宿主约束**：kind 与宿主必须匹配，错配时入口即提示"这是 Word 模板，请到 WPS 文字中继续"（模板已入库，切换宿主后一次点击可引用）。零新风险，不碰多宿主路由 bug 区，验证矩阵不膨胀 |

**默认处理项**（可推翻）：
- `.aidocx` 老数据兼容保留，条目统一加 `kind`（无 kind 视为 doc）。
- 内置空白三件套改为 **base64 内嵌**（不从安装目录读文件——Mac WPS 沙盒只能可靠读自己容器，image tier 有前科；`mcp-sidecar/lib/blankDocx.mjs` 的 888 字节空白 docx base64 正好复活此模式，xlsx/pptx 同理内嵌）。
- **质检循环宿体 = 专用任务管线**（仿 `assistantTaskRunner`：进度窗/写锁/可中止/逐阶段结构化产物）；聊天 agent loop 只做入口与计划卡，不承载循环（其 `MAX_ROUNDS=24` 装不下逐页改+逐页审）。
- 循环默认上限 3 轮；**轮次耗尽仍有未通过项 → 照常交付 + 警示报告 + "继续修"入口**，不废弃。
- sheet 数据超出模板预留行 → 初版**限预留行内**填充；超出则插行并在报告提示（合计行公式扩展初版不碰）。
- 中止/用户关闭文档 → 复用任务进度窗中止语义，临时残件 72h 清理。
- MCP `document_new` 复活移出本期；新增文案进 i18n 六语言；验收挂接发版清单。

---

## 一、总体架构（v2.1）

### 1.1 主链路（聊天）

```
用户消息 + 附件模板/路径/库名引用 + 需求
   │
   ▼ 意图路由（新 capability：generate-from-template）
   │
   ├─ 同宿主闸门：kind ≠ 宿主 → 提示切换宿主，流程终止（模板已入库）
   ▼
确认卡：模板解析结果 + 需求摘要 + savePath（默认桌面）
   │ 用户确认
   ▼
打开临时副本：createFromTemplate（复制临时目录 → jsapi Open → 失败退 viaOs → 新建标记 → 会话绑定）
   │
改写计划卡：大纲 + 每页/每段改什么 + 页计划 + 预计轮次   ←── 结构化 JSON
   │ 用户确认
   ▼
╔═ 专用任务管线（独立于聊天 agent loop；进度窗/写锁/可中止）═══════╗
║ 改-扫-修循环（≤3 轮）                                            ║
║  改写：doc 段落级替换保格式 / sheet 预留行内写值 / PPT 三层降级     ║
║  质检：语义审 + 几何校验 [+ 视觉审增强档]                          ║
║  未通过项 → 定向修正 → 再扫                                       ║
╚═════════════════════════════════════════════════════════════════╝
   │ 全部通过 或 达轮次上限（交付+警示）
   ▼
交付：SaveAs2(savePath) → 清 NdNewFile 标记 → 清理临时残件
   │
结果卡：质检报告（"原生版式页"标注、警示项、"继续修"入口）+「存为模板」按钮
```

### 1.2 模块清单

| 模块 | 状态 | 说明 |
|------|------|------|
| 模板接入层 | 部分新建 | 附件 File→落盘 / 路径校验（确认卡展示完整绝对路径）/ 库名解析；**同宿主闸门**在此层执行 |
| 模板库泛化 | 改造 | `documentTemplates.js` 条目加 `kind`；`.aidocx` 兼容；按扩展名识别 kind |
| 空白资产 | 新建 | base64 内嵌三件套（复活 blankDocx.mjs 模式），首启落盘登记 |
| 新建管线 | **新核心** | `src/utils/documentCreateFromTemplate.js`：复制临时 → 同宿主 Open（jsapi→viaOs）→ 三宿主新建标记载体（Writer=Variables / WPP=Tags / ET=Names `'="1"'` 字面量）→ `ensureDocumentChatLinkId` |
| 改写计划协议 | 新建 | 结构化 JSON（outline / pagePlan / contentOps / expectedRounds） |
| **任务管线** | **新建** | 仿 `assistantTaskRunner` 的专用执行体：阶段化（计划→改→扫→修→交付）、进度窗、写锁、中止、逐阶段结构化产物；聊天 loop 不承载循环 |
| 改写引擎 | 组合 | doc：段落级替换（`applyDocumentAction` targetRange）；sheet：`range_write` 只写值不动格式（预留行内）；PPT：`TextRange` 改字 + `Duplicate` 复制 + `slides.Add` 兜底 |
| 质检层 | 新建 | 语义审（读回 LLM 对照需求）+ 几何校验器（纯读 API）+ 视觉审增强档（`slide_export_image` → 多模态） |
| 交付层 | 新建 | **SaveAs2(savePath) → 清 NdNewFile → 残件清理**（复用三级临时目录回退） |
| 意图与入口 | 组合 | capability + 确认卡 + 同宿主提示；三宿主 ribbon「模板库」按钮（`DocumentTemplateSelect` 执行体重写，见 §3.5） |
| 入库 | 小改 | 结果卡「存为模板」→ `addDocumentTemplate`；ribbon「导出模板」自动登记 |
| **模板剖析器** | **新建（v2.2）** | 分类型模板画像，纯读 API：doc→样式档案+结构骨架+语体画像；slide→逐页元素普查+页型分类+主题画像；sheet→表头/公式区/预留行。产物为「模板剖析摘要」随计划卡展示 |
| **类型访谈卡** | **新建（v2.2）** | 合并进确认卡的分类型问题集（见 §5.2），取代一刀切确认 |

### 1.3 三宿主策略对照

| 宿主 | 样式保留 | 内容改写 | 结构扩展 | 质检侧重 |
|------|----------|----------|----------|----------|
| doc | 段落级替换不动段落格式 | 逐段/节替换 | 章节增减样式取同类段落 | 语义审 + 空段/图越界 |
| sheet | 只写值不动格式 | 预留行内二维写入 | 限预留行内（超出插行+提示） | 语义审 + 公式引用完整 |
| slide | `TextRange` 改字保图元背景 | 逐页就地改 | 就地改→复制→新建（标注） | 三层全开（几何主战场） |

---

## 二、实施阶段

### Phase 1 · 地基与通路

1. **真机首验**：`Workbooks.Open` / `Presentations.Open` 经加载项调用崩溃面（Win/Mac/Linux × 各自宿主）；失败启用 viaOs 兜底。
2. `documentCreateFromTemplate.js` 双通路管线 + 三宿主新建标记载体 + 同宿主闸门。
3. 模板库 `kind` 泛化 + `.aidocx` 迁移 + **base64 内嵌空白三件套**（Mac 空白新建顺带修复）。
4. 模板接入层（附件落盘/路径校验/库名解析）。
5. 「模板库」对话框：**重写 `DocumentTemplateSelect` 执行体后接线**（见 §3.5）。

验收：三宿主各自完成 三来源 → 同宿主闸门 → 确认 → 临时副本打开 → 另存 闭环；3 平台真机无崩溃。

### Phase 2 · 主链路（基础改写 + 交付）

1. capability `generate-from-template` + 确认卡（含同宿主提示）。
2. 专用任务管线骨架 + 基础改写（doc 段落级 / sheet 预留行 / PPT 就地改）。
3. SaveAs2 交付 + NdNewFile 清除 + 残件清理。
4. 结果卡「存为模板」+ ribbon「导出模板」自动登记。

验收：一句话（带附件）→ 确认 → 新文件交付在 savePath，样式与模板一致，Ctrl+S 不再弹另存为。

### Phase 3 · 智能化（计划卡 + 页扩展 + 质检循环）

1. 改写计划卡协议 + 两段式确认。
2. PPT 复制扩展（页型相似度选母本）+ Add 兜底标注；doc 章节样式基准。
3. 质检循环：语义审 + 几何校验器 + 轮次控制（默认 3）+ 报告卡（"继续修"）。
4. 系统提示词更新（新建禁令 → "必须经 generate-from-template 确认流程"）。

验收：三类真实第三方模板端到端；质检报告拦截人为注入的越界/溢出用例；15 页 PPT 全程不触碰 agent 轮次上限。

### Phase 4 · 增强（按需）

视觉审增强档；聊天库管理指令；sheet 公式扩展；MCP `document_new` 白名单复活（安全评审后）。

---

## 三、关键设计细节

### 3.1 改写计划卡协议（要点）

```json
{
  "schemaVersion": "2026-10-template-rewrite-v1",
  "templateSummary": {"kind": "slide", "pages": 6, "styleNote": "深蓝商务风"},
  "outline": [{"section": "封面", "source": "改写第1页"}],
  "pagePlan": [{"action": "edit|duplicate|add|delete", "srcPage": 2, "reason": "内容页不足"}],
  "contentOps": [{"target": "锚点", "summary": "改什么", "keepStyle": true}],
  "expectedRounds": 2
}
```

### 3.2 交付机制（v2.1 修正）

- 交付 = `SaveAs2(savePath)`（现役已验证保存通路）→ `setNewFileMarker(doc, false)` 清标记 → 残件清理。**不做文件移动**（打开中的文件 Windows 有写锁）。
- 交付后文档在 WPS 中打开于最终路径，用户可直接继续编辑。
- viaOs 兜底场景：文档在正确宿主组件中打开后（用户点击激活），同宿主 SaveAs2 交付，语义一致。

### 3.3 几何校验器初版检测项（纯读 API）

- PPT：形状越界（超页面）；文本框两两重叠率；文字溢出近似（字符数×字号 vs 框面积，标注置信度）。
- doc：图片越页边距；连续异常空段。
- sheet：初版不做几何，靠语义审。
- 结果结构化进报告，附"点击定位"锚点（`documentAnchorResolve` 已有）。

### 3.4 安全边界

- 新建仅两条路：UI 直执（模板库对话框）；聊天/Agent 必过确认卡。路径模板在确认卡展示完整绝对路径。
- 临时残件：交付成功即删；失败保留供诊断，72h 清理。
- 入库路径白名单 `model/`；附件落盘受控命名。

### 3.5 孤儿组件重写清单（接线前提，防止把崩溃 API 带上可点击路径）

`DocumentTemplateSelect.vue` 现状三处必须重写：
1. `:84` 的 `app.Documents.Add()`（空白选项）→ 改走内嵌空白资产复制；
2. `copyTemplateToDesktop` 桌面直落 → 改走临时目录（对齐决策 #8）；
3. Mac 空白禁用分支 → 删除（内嵌资产方案天然跨平台）。
保留复用：模板列表 UI、`Documents.Open/OpenFromUrl` 多级回退打开逻辑、`setNewFileMarker`。

### 3.6 viaOs 兜底交互（同宿主场景内）

jsapi Open 失败 → sidecar 复制 → OS 级打开（同宿主，因同宿主闸门保证 kind 匹配）→ 提示"文件已在 WPS 打开，请点击该文档继续" → 激活后绑定，流程续跑。管线返回句柄抽象统一，调用方无感。

---

## 四、v2 → v2.1 修正记录（第二轮自审）

1. **交付机制推翻重定**：文件移动不可行（写锁）→ SaveAs2 + 清 NdNewFile（§3.2）。
2. **循环宿体补位**：专用任务管线（对齐 assistantTaskRunner 模式），聊天 loop 不承载（§1.2）。
3. **同宿主约束**（共识 #11）：kind≠宿主入口即拦截；viaOs×跨宿主×交付的危险组合随之消失。
4. **孤儿组件重写清单**（§3.5）：防止接线时把活的 `Documents.Add()` 与桌面直落带上线。
5. **空白资产改 base64 内嵌**：规避 Mac 沙盒读安装目录不可靠（image tier 前科）。
6. **默认值补齐**：轮次耗尽交付+警示；sheet 预留行限制；中止残件 72h 清理。

---

## 五、分类型处理流程（v2.2 增补：剖析 → 访谈 → 计划 → 槽位填充 → 质检）

三宿主统一为五段式，但剖析与访谈的内容按类型分化。

### 5.1 统一五段式

```
① 剖析（纯读，无副作用）：生成「模板画像」
② 访谈（分类型问题集，合并进确认卡）
③ 计划卡（大纲映射 + 页/章节计划，用户确认）
④ 槽位填充执行（就地改写/复制/新建三层降级）
⑤ 质检循环（语义+几何+类型专属检查）
```

### 5.2 Word（doc）类型流程

**① 剖析 → 样式档案**（回应"字体/字号/行距与模板匹配"）：
- 逐层级探测代表段落的直接格式：各级标题、正文、表格内文字的 `Font.Name/Size`、行距（`ParagraphFormat.LineSpacing`）、段前段后、缩进、对齐；
- 探测**命名样式清单**（`doc.Styles`）：专业模板通常带 Heading 1/正文 等命名样式——业界结论（unmarkdown/PSU Organizer 实践）：AI 直接写死格式（direct formatting）是破坏模板样式的首因，**优先套命名样式，无命名样式才做直接格式移植**；
- 结构骨架：标题树、占位性段落、表格清单；
- 语体画像：LLM 归纳模板原文案的语体（公文/营销/学术/口语）。

**② 访谈卡（doc 专属问题集）**：
- 主题与要点（必问）；
- **文风跟随**：按模板原文案的语体生成 / 直接生成（用户口头需求，落地为访谈选项）；
- 篇幅目标（页数/字数）；
- 固定文案保留：页眉页脚、法律条款、落款等"保留型文案"默认不动（列出清单供确认）。

**③④⑤ 执行与质检**：
- 就地改写（段落级替换，格式天然保留）；**新增章节的样式移植**：优先 `Range.Style = 模板命名样式`；模板无命名样式 → 从同类代表段落复制直接格式（真机验证 Styles API 可用性，不可用即全走格式移植）；
- 质检新增两项：**样式漂移检测**（生成段落字体/字号/行距 vs 样式档案 diff，超阈值告警）、**语体一致性**（LLM 判定生成内容与所选文风是否相符）。

### 5.3 PPT（slide）类型流程

**① 剖析 → 元素普查 + 页型库**（用户提出的"先分析文档有什么元素、每页文案"完全正确）：
- 逐页 `slide_list`/`slide_read`/`shape_list`：元素清单（图元/文本框/图片/表格/背景）、位置尺寸、每页文案全文；
- **页型分类**：每页归类为 封面/目录/章节页/内容页/数据页/致谢页（LLM 按元素构成+文案判断）；
- **槽位化**：页内形状分类为槽位——标题槽/正文槽/图片槽/表格槽/装饰槽（装饰槽永不改写），这是 BERST 式模板填充的工程化落地；
- 主题画像：母版配色、字体方案（喂给后续新建页与质检用）。

**② 访谈卡（slide 专属问题集）**：
- **目标页数**（必问，驱动页计划 edit/duplicate/add 配比）；
- **文案策略**（区分三种"文案一致"）：
  - 保留型文案（页脚/口号/免责声明）→ 默认原样不动，列清单确认；
  - 语体跟随（新文案模仿模板原文案风格）→ 是/否；
  - 占位文案（标题/正文）→ 一律替换为新内容；
- **元素策略**：沿用模板图元背景 / 允许 AI 补图（联动现有三级配图：生图→搜图→SVG）；
- 是否需要数据图表页（联动现有 chart 能力）。

**③ 大纲映射**：需求大纲逐项映射到页型库（"这页内容用模板第 3 页的内容页型承载"）→ 产出 pagePlan 进计划卡。

**④ 逐页槽位填充**：按槽位类型执行——标题/正文槽 `text_set`（样式 100% 保留）、图片槽 `picture_add`(cover)+`shape_zorder`、表格槽 `table_add`；新页（Add 兜底）按主题画像约束配色字体，报告标注"原生版式页"。

**⑤ 质检新增**：**槽位遗漏检测**（模板页有元素、生成页对应槽位为空）、**保留型文案误改检测**、装饰槽被动检测。

### 5.4 表格（sheet）类型流程

- ① 剖析：表头结构与格式区、公式区（合计行/计算列）、预留数据行数、命名区域。
- ② 访谈：数据来源与规模（是否超预留行）、列结构是否按模板。
- ③④ 预留行内写值；超出插行+提示（v2.1 默认不变）。
- ⑤ 质检：公式引用完整性 + 表头语义审。

### 5.5 对既有设计的影响

- 计划卡协议 `templateSummary` 扩展为完整「模板画像」引用；`contentOps` 细化为槽位级操作。
- 访谈卡 = 确认卡的分类型增强，**不新增交互组件**（复用 `pendingWpsCapabilityForm` 动态参数表单）。
- 剖析器全部为纯读 API（shape_list/slide_read/段落格式读取/UsedRange），零崩溃面，可独立先行开发。

---

## 六、业界方案对照（全网调研结论）

四种主流架构（perceptis.ai 分类）与本方案的位置：

| 架构 | 代表 | 工作方式 | 与本方案关系 |
|------|------|----------|--------------|
| Template-fill 槽位填充 | Canva/SlidesAI/Beautiful.ai | LLM 写文案→选模板→填固定槽位 | **本方案的 PPT/doc 主范式**（§5 槽位化即其工程化）；其弱点"模板库是天花板"在我们场景不存在——用户自带模板 |
| Generative-layout | Gamma | 大纲→逐卡片生成网页内容，导出 pptx 常字体替换/文本框重叠 | **借鉴其"大纲先行确认"**（已有计划卡）；规避其致命伤：我们直接在原生文档内写，无导出转换损耗 |
| In-app copilot | M365 Copilot/Plus AI | 嵌入宿主直写原生格式 | **本方案天然属于此类**（WPS 加载项直写活动文档），这是"产出干净可编辑文件"的关键 |
| Agentic builder | Perceptis 等 | 先论证结构再组装原生 pptx | 借鉴"计划先行"；其企业模板写入=我们的同宿主模板机制 |

**结论**：本方案 = in-app copilot（无转换损耗）+ template-fill（用户自带模板保真）的混合体，恰好避开了Gamma 类的导出清理问题与模板库类的风格天花板；业界验证的两个关键点——①"架构决定你得到干净可编辑的文件还是 40 分钟的手工清理"；②交付格式倒推架构（必须可编辑原生文件→不能走生成式布局路线）——都支持现有选型。Word 侧补充采纳：AI 优先套用命名样式而非写死格式（unmarkdown.com 结论）。

**来源**：
- [LLMs vs Layout Engines: How AI Presentation Tools Work](https://perceptis.ai/blog/llms-vs-layout-engines-how-ai-presentation-tools-work)（四架构分类、Gamma/Copilot 实现细节、清理成本数据）
- [Word Document Formatting: Styles, Headings, and Why AI Breaks It](https://unmarkdown.com/blog/word-document-formatting-ai)（AI 破坏 Word 样式的机理：direct formatting vs named styles）
- [Multiple Ways to Transfer Styles From Templates](https://accessibility.psu.edu/2023/07/multiple-ways-to-transfer-styles-from-templates-to-documents)（样式从模板向文档转移的机制）
- [AI presentation slide designer with Copilot in PowerPoint](https://powerpoint.cloud.microsoft/create/en/ai-presentation-designer)、[Best AI for PowerPoint Presentations: Template Preservation](https://llemental.com/posts/best-ai-for-powerpoint-presentations-template-preservation)、[Create a template - Microsoft Support](https://support.microsoft.com/en-us/word/create-a-template)

---

## 七、开源收割分析（v2.2 增补）

**结论：零新增运行时依赖。** 仓库已有 jszip + mammoth + xlsx(SheetJS)；收割方式为「OOXML schema 知识收割」而非引入重型库：

| 目标 | 候选开源项目 | 收割决策 |
|------|--------------|----------|
| docx 样式 | docx-preview（MIT，styles.xml→字体/字号/行距完整映射）、mammoth（已在仓库，语义结构） | 收割映射知识（w:sz 半点→pt、w:spacing line/240→倍数、w:rFonts），自写 ~150 行解析器（templateStyleReader.js） |
| pptx 主题/元素 | PPTXjs（MIT，slide XML shape 树） | 收割 shape 遍历思路；theme1.xml 的 clrScheme/fontScheme 直接解析（XML 极简） |
| xlsx 样式 | ExcelJS（MIT，样式读写全） | 不引入（~1MB bundle 重量）；表头/列宽/合并/维度轻解析足够剖析用途 |
| 占位符替换 | docxtemplater（MIT 核心） | 本期不用（第三方模板几乎无 {{}}，AI 就地改写为主范式） |
| 空白资产 | python-pptx/openpyxl/python-docx（本机一次性生成工具，构建期用，非运行时依赖） | 生成 blank.pptx/xlsx base64 提交（src/utils/blankAssets.js）；docx 复用 blankDocx.mjs 死代码资产 |

---

## 八、实施记录（v2.2 → 代码）

### 已落地（2026-10-14）

| 项 | 文件 | 说明 |
|----|------|------|
| 空白资产 | `src/utils/blankAssets.js`（新） | docx/xlsx/pptx 三件套 base64；python 生成器一次性产出 |
| kind 泛化 | `src/utils/documentTemplates.js` | kind 字段+读时迁移+按扩展名推断；copyTemplateToTempForNew 按 kind 定扩展名；ensureBlankTemplateFile/resolveTemplateSource/findTemplateByRef；导入对话框/文件选择器多格式 |
| 新建管线 | `src/utils/documentCreateFromTemplate.js`（新） | 同宿主闸门；复制→Open（jsapi→Windows OS 兜底）→三宿主新建标记（Variables/Tags/Names 字面量公式）→会话绑定；deliverActiveDocument=SaveAs2+清标记；打开前活动对象快照防误标 |
| 模板剖析器 | `src/utils/templateStyleReader.js`（新） | docx 样式档案/结构骨架；pptx 主题色/字体/逐页元素普查；xlsx 表头/列宽/合并；纯 jszip+DOMParser |
| 几何校验器 | `src/utils/pptGeometryChecker.js`（新） | 越界+重叠（整页背景豁免），纯数学 |
| 生成管线 | `src/utils/templateGenerationTask.js`（新） | 剖析→LLM 计划→开副本→doc 段落级/sheet 数据区/ppt edit·duplicate·add 执行→质检循环（语义审+slide 几何，默认 2 轮上限 3）→SaveAs2 交付；模型解析走 flat 模型表（与 assistantTaskRunner 同源判定）；写锁包裹执行段 |
| 模板库对话框 | `src/components/DocumentTemplateSelect.vue`（重写） | 移除 Documents.Add 崩溃路径与桌面直落；按宿主过滤 kind；空白项走内嵌资产；删除管理；路由 `/document-template-select` |
| 入口 | ribbon×6 XML + ribbon.js + ⌘K | 三宿主按钮（图标 newFromTemp.svg）；导出模板自动登记（断链修复） |
| capability | catalog/router/executor/classifier | new-document-from-template + generate-from-template；意图分类器加模板规则；executor await 化+取消钩子 |

### 与方案的已知偏差（诚实记录）

~~以下 4 项偏差已在第二轮实施中全部消除（2026-10-14 晚）~~，当前真实偏差仅剩：
1. **计划确认卡形态**：已实现两段式（`planOnly` 参数「先出计划确认」→ 计划文本回聊天 → 用户回复「确认执行」→ `execute-template-plan` 续跑，30 分钟会话级缓存），但计划展示为文本消息而非结构化卡片。
2. **ET/WPP 宿主打开通路交互验证**：仍需在对应宿主 UI 中点「模板新建」做最终人工验证。

### 第二轮实施补全（2026-10-14 晚，原 4 项偏差消除记录）

| 原偏差 | 实现 |
|--------|------|
| 聊天附件直连模板 | 附件 intake 保留 `rawFile`；`resolveTemplateAttachmentParams` 在模板名留空/为指代词时取第一个模板格式附件 → `materializeAttachmentToTemp` 落临时目录（只落盘不登记，入库仍走「用后询问」）；executor 尊重显式 templatePath |
| 结果卡「存为模板」 | 新 capability `save-current-as-template`（「把当前文档存为模板」）：三宿主活动文档 SaveAs2 直落模板库目录 + 自动登记；覆盖生成结果与任意文档 |
| 两段式计划确认 | `generate-from-template` 增「先出计划确认」选项 → 计划文本回聊天；「确认执行」经意图分类器/路由 → `execute-template-plan` 取缓存续跑（执行→质检→交付），30min TTL 防重复执行 |
| Mac viaOs 兜底 | sidecar 新端点 `POST /open-local-file`（isTrusted 门禁 + 办公扩展名白名单 + `open/start/xdg-open`）；webview `openWithOs` 在 WScript.Shell 不可达后 fetch sidecar（4s 超时）。**真机三态验证通过**：docx 打开成功 / FILE_NOT_FOUND / txt 白名单拦截 |
| doc 命名样式 | 计划协议 appends 支持 `style` 字段（模板样式档案中的样式名），执行时 best-effort 套用 |

**部署注意**：`/open-local-file` 在 sidecar 进程内——已运行的旧 sidecar 需重启（或随下版安装包更新）后才生效；webview 侧 fetch 失败会静默回落到「提示手动打开」路径，无破坏性。

### 核对与修复记录（5 轮）

| 轮次 | 发现并修复 |
|------|-----------|
| 1 导入/签名审计 | docDefaults 解析表达式错误；executor templateRef/Path 互斥；同宿主闸门前置；OpenFromUrl 误标守卫（打开前快照比对） |
| 2 纯函数单测 | 几何校验（越界/重叠/背景豁免）+ kind 推断 + 扩展名映射 全部通过（node 实测） |
| 3 集成审计 | 意图分类器缺模板规则（聊天到不了 capability）；progress() 浅合并覆盖任务 data |
| 4 风险点审计 | getChatApiConfig() 无参恒 null（换 flat 模型表解析）；导入对话框 .aidocx-only（ET/WPP 无法入库）；slide_duplicate action 名验证 |
| 5 lint+构建 | const slideCount 运行时 TypeError；控制字符正则；未用变量清理。最终 vite build 零错误 |

### 真机测试结果（2026-10-14，本机 wpsoffice.app）

| 项 | 结果 |
|----|------|
| MCP sidecar + 工具目录 | ✅ 51/51 工具 callable、0 failed（selftest exit 0） |
| 新构建加载进真机 WPS | ✅ webview 智能体上线（agentOnline=true, L2=true），新模块未破坏加载项 |
| Open 通路（createFromTemplate 的地基） | ✅ 空白资产 docx 经 MCP document_open 在真机打开（opened=true），document_get_text 读回真实文档名/正文——sidecar→webview→jsapi→读回全链路通 |
| ET/WPP 宿主 Workbooks.Open/Presentations.Open | ⏳ 需交互验证（无 MCP workbook/presentation 级 open 工具，需在 ET/WPP 宿主 UI 中点「模板新建」） |
| 聊天意图→确认卡→生成管线 | ⏳ 需配置对话模型后在 WPS 聊天框输入「用XX模板生成YY」交互验证 |
| 遗留环境 | 测试后 WPS 保持运行（selftest 设计如此）；/tmp/chayuan_e2e_blank.docx 为测试产物可删 |

### 真机测试 · 第二轮（2026-10-14 晚，新端点部署后）

| 项 | 结果 |
|----|------|
| 二进制重建+部署 | ✅ bun 编译 macos-arm64 → 替换 `~/.config/chayuan-wps/mcp/runtime/bin/`（旧件备份 .bak-1014）→ launchd kickstart 重启，uptime 4s、2 agent 自动重连 |
| `/open-local-file` 认证 | ✅ 无 token 401 / 正确 token 通过（`x-chayuan-token` 与 webview 存储键 `chayuan_mcp_token` 对齐验证） |
| `/open-local-file` 三态 | ✅ FILE_NOT_FOUND / EXTENSION_NOT_ALLOWED(.txt 拦截) / ok:true（docx、xlsx、pptx 三种真实文件均 OS 级打开成功） |
| OS 打开→活动文档绑定 | ✅ 打开后 `document_get_text` 返回该文档（viaOs 兜底的绑定前提成立） |
| 写回守卫（既有机制） | ✅ 活动文档切换后 `document_insert/ensure_open/activate` 全部被 DOCUMENT_MODIFIED_SINCE_BASELINE 正确拦截——保护行为符合设计（注意：多标签churn下需干净窗口才能写回，非本次功能缺陷；模板管线不走该 MCP 基线机制） |
| ET/WPP 宿主 agent | ⛔ 未注册（`spreadsheet`/`presentation` 均 agent offline）——Mac 统一窗口下组件级 webview 需插件对 et/wpp 宿主启用后重开窗口，**仍为人工验证项** |
| 聊天意图→确认卡→管线 | ⏳ 需配置对话模型 + UI 交互（确认卡点击），人工验证 |

### 真机测试 · 第三轮（2026-10-14 晚，ET/WPP 注册排障）

**排障结论链**（每一环都已实证）：
1. 本机存在两处 jsaddons：`~/Library/Application Support/Kingsoft/wps/jsaddons`（可读写，内含 chayuan-et/wpp_6.0.0 三宿主包）与 **TCC 沙盒容器** `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons`（真正生效的注册表，dev-debug.mjs:62 与 wpsjs 源码 debug_publish.js:408 均指向它；本会话 shell 无 Full Disk Access，读写均 EPERM）。
2. **发现存量 bug**：Application Support 的 `jsplugins.xml` 开头有 8 个游离 `<jsplugins>` 标签（重复追加写导致）——已修复为合法结构。⚠️ 需排查安装器/调试脚本谁在追加写。
3. `wpsjs debug` 与容器写入：本会话运行报 EPERM（Morning 时段的 agent 来自用户环境既有的 vite dev server + 容器内 dev 注册）。
4. 已恢复：vite dev server 已在 3889 拉起（伺服含新代码的构建，/et/ /wpp/ ribbon 中间件 200）；WPS 已重启。
5. 剩余阻塞：WPS 重启后仍 0 agent——容器注册表内容需用户在**自己的终端**（有 TCC 授权）执行 `npm run dev:debug` 重建三宿主调试注册后重启 WPS；完成后本会话可继续驱动 MCP E2E。

**环境变更披露**：sidecar 二进制已替换（备份 `.bak-1014`）；测试期间多次重启 WPS（重启前经 lsof 确认仅本会话测试文件在开）；vite 3889 后台运行（日志 /tmp/vite-3889.log）；/tmp 下若干 chayuan_* 测试文件。

### 功能测试矩阵（2026-10-14 晚 · 第四轮）

| 测试项 | 代码路径 | 真机状态 |
|--------|----------|----------|
| doc 全文感知 | `getDocumentText`（宿主感知：Writer=Content.Text / WPP=collectPresentationText / ET=collectWorkbookText） | ✅ 真机（document_get_text 返回真实文档） |
| 选区感知 | `getSelectedText`（Writer=Selection.Text / WPP=TextRange.Text / ET=Range.Value→readRangeValuesAsText） | 🔒 代码核验✓，真机需 agent（TCC 阻塞） |
| 当前页/当前段 | documentContext 快照 currentPage / 段落级 ops（pipeline 的 paragraphIndex 粒度）+ document_list_paragraphs | 🔒 同上 |
| sheet 写入（ET 宿主） | range_write 只写值不动格式 | 🔒 同上（agent offline 实证） |
| slide 写入（WPP 宿主） | slide_add/text_replace/status | 🔒 同上 |
| 生成管线 E2E | 剖析→计划→执行→质检→交付 | ⏳ 需对话模型+确认卡 UI |
| Win7 兼容 | 构建产物 **es2018 零高版本残留**（本次扫描实证）；sidecar 纯 Node 内置+fetchPolyfill（Node 14.18+ 回退路径 start-mcp.cmd）；openFileWithOs Win 分支 cmd start 兼容 | ✅ 静态验证通过；真机 Win7 缺环境 |
| UOS 兼容 | linux-x64/arm64 二进制**本机编译成功**；openFileWithOs Linux 分支 xdg-open；发版流水线含 .deb | ⚠️ 本机**无统信虚拟机**（仅 Ubuntu ARM×2 无凭据、无 Docker），待 UOS 环境 |

**解锁条件（一条命令）**：用户终端执行 `npm run dev:debug` → 三宿主 agent 上线 → 🔒 项全部可自动化跑完。

### 真机测试 · 第五轮（2026-10-14 晚 · 统信 UOS 虚拟机）

环境：VMware Fusion「统信系统ARM」虚拟机（UnionTech OS Desktop aarch64，glibc 2.28）+ WPS Linux 12.1.2.28080 三件套（wps/et/wpp）+ 三宿主插件目录（10月12 安装，10月12-13 有真实使用审计记录）。

| 项 | 结果 |
|----|------|
| 新 sidecar 二进制（linux-arm64，含全部新功能） | ✅ 真统信运行成功（glibc 2.28 兼容；单例锁正常） |
| `/open-local-file` 四态 E2E | ✅ 无token 401 / FILE_NOT_FOUND / EXTENSION_NOT_ALLOWED / 真实 docx ok:true 全过 |
| 新构建同步进虚拟机 jsaddons | ✅ et/wpp/wps 三包新代码+新 ribbon 就位（HOST_KIND_MISMATCH/TemplateNew 特征验证） |
| 插件 webview 注册 | ⛔ ssh 拉起的 WPS（et/wps 均试）webview 不初始化、零 HTTP 接触——**10月12 交互式桌面使用时是好的**，差异指向会话上下文或首次加载信任交互 |
| 排障中发现的存量环境 bug | ① 两台机器（Mac+UOS）的 `jsplugins.xml` 均存在游离 `<jsplugins>` 标签损坏（安装器/调试脚本重复追加写，双平台实锤）② UOS `jsaddinblockhost.ini` 有 2 条崩溃拉黑记录（已清空） |
| 已做修复 | 注册表重建（双文件）、拉黑名单清空、authaddin 信任缓存恢复；Mac 侧旧构建回滚对照实验证明 0 agent 与新构建无关 |
| 备份 | 虚拟机内 `/tmp/uos-jsaddons-final-backup.tar.gz`（新构建+修复注册表，已恢复为当前态）、`/tmp/authaddin.json.bak`、`/tmp/jsaddinblockhost.ini.bak`；宿主机 `/tmp/jsaddons-backup-1014.tar.gz`（Mac 旧构建） |

**UOS 解锁路径（二选一）**：① 在 VMware 窗口里看统信桌面的 ET 窗口——若察元AI ribbon 可见直接点「模板新建」测；若有信任弹窗点信任。② 在虚拟机桌面终端里自行启动 `wps`/`et`（复现 10月12 的交互式启动方式）→ agent 注册后本会话可远程驱动全部 E2E。
