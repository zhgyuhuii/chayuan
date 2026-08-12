# 察元 MCP 工具体系规划（科学选型 · 准确调用）

> 状态：Phase A 完成 · Phase B P0 已落地（catalog + sidecar + Agent dispatch）  
> 目标：在扩展格式/批注/修订/版式等能力时，保持 **工具面可控、意图可映射、调用可确认、失败可诊断**。  
> 约束：延续现有 `toolCatalog` 的 WHAT/WHEN/NOT/HOW/EXAMPLE 描述纪律，以及 `confirmed` / dry-run 写回纪律。  
> 实现入口：`mcp-sidecar/lib/toolCatalog.mjs`（v0.6.0）、`formatReviewDispatch.js`、`chayuan://guide/tool-routing`

---

## 1. 问题定义：什么叫「科学合理」与「准确调用」

### 1.1 科学合理（产品与系统）

| 维度 | 含义 |
|------|------|
| 边界清晰 | LLM 负责推理/翻译/决策；WPS Agent 只负责读、定位、写、导出版本事实 |
| 能力分层 | 宿主 / 文档 IO / 定位 / 内容写 / 格式写 / 批注协作 / 版式结构 / 合规业务 分层，不混成「万能工具」 |
| 安全默认 | 改文档默认预览；确认后写；UI 态与内容态分离 |
| 可演进 | 新能力优先并入「领域聚合工具 + action」，而不是无限新增同义工具 |

### 1.2 准确调用（面向 LLM 选工具）

准确调用 = 模型在自然语言意图下，高概率选对工具、填对参数、走对调用链。失败模式通常是：

1. **工具过多同质** → 在 `format_bold` / `format_font` / `style_apply` 间犹豫  
2. **描述不含触发语** → 中文口语对不上英文工具名  
3. **缺 NOT 边界** → 用 `replace` 做「插到段后」、用 `insert` 做「改颜色」  
4. **缺统一锚点** → 格式改打到错误选区或全文  
5. **批量路径错误** → N 次 locate+单改，撞轮次上限（已有校对踩坑）  
6. **确认语义不一致** → 有的要 `confirmed`，有的直接写，模型乱传  

规划必须以消除这六类失败为第一性原理。

---

## 2. 设计原则（硬约束）

### P1. 少工具、多 action（领域聚合）

- **禁止**为「加粗 / 字号+1 / 变红 / 删除线」各做一个 MCP 工具。  
- **推荐**：`format_run`（字符）、`format_para`（段落）、`comment_*`（批注域）、`revision_*`（修订域）、`layout_*`（版式域）。  
- 经验阈值：对外暴露的「一级工具」建议控制在 **35～50** 个以内（含现有约 26 个）；新增格式类优先合并。

### P2. 统一锚点模型（Anchor）

所有「作用于某处」的写工具，共用同一套锚点字段（与现有一致并强化）：

```text
anchor =
  originalText? + hintStart?
  | start + end
  | paragraphIndex?          // 1-based，与 list_paragraphs 对齐
  | bookmarkName?
  | scope: selection | paragraph | document   // 仅当用户明确「当前选区/整篇」
```

规则：

- 默认 **禁止** 无锚点改全文（除非 `scope=document` 且 `confirmed=true` 且描述里明确高危）。  
- 推荐链路：`locate` / `list_paragraphs` →（可选 preview）→ 写工具。  
- 批量：优先 `*_apply_ops` / `format_apply_ops`，**禁止**教模型「循环 locate」。

### P3. 读写分离 + 确认纪律（统一语义）

| 类型 | 命名习惯 | confirmed |
|------|----------|-----------|
| 只读 | `*_list` / `*_get` / `*_status` / `locate` | 无 |
| 预览 | 同一写工具 `confirmed=false` 或不传 | 返回 willChange / hitCount / preview |
| 提交 | `confirmed=true` | 才改文档 |
| 纯 UI | `view_*`（导航窗格等） | 可不要求 confirmed，但须 `readOnlyHint:false` 且标注「不改正文」 |

与现有 `document_replace` / `apply_ops` / `proofread_*` 对齐；**新增工具不得另发明 `dryRun`/`commit` 第三套语义**（内部实现可用 dryRun，对外参数统一 `confirmed`）。

### P4. 描述即路由（Description-as-Router）

每个工具 description 必须五段齐全（现有模板）：

1. **WHAT** — 领域结果  
2. **WHEN** — 中英口语触发（至少 4～8 条真实说法）  
3. **NOT** — 易混工具与错误场景（最重要）  
4. **HOW** — 关键参数 + confirmed + 批量规则  
5. **EXAMPLE** — 最小可跑 JSON  

`SERVER_INSTRUCTIONS` 只放跨工具铁律，不堆个案。

### P5. 命名空间稳定

```text
{domain}_{verb}
```

| domain | 例子 |
|--------|------|
| `wps_` | 宿主 |
| `document_` | 文本 IO / 生命周期（已有） |
| `format_` | 字符/段落格式 |
| `style_` | 样式表 |
| `comment_` | 批注 |
| `revision_` | 修订 |
| `layout_` | 纸张/分栏/分隔符/空白页 |
| `nav_` | 导航/大纲/页码行号（偏查询与 UI） |
| `proofread_` / `declassify_` / `kb_` / `assistants_` | 业务域（已有） |

动词优先：`list` / `get` / `apply` / `insert` / `update` / `accept` / `reject` / `set`。

### P6. 返回值契约（帮助下一跳选对工具）

写工具预览与提交的返回建议固定字段：

```json
{
  "ok": true,
  "preview": true,
  "hits": 3,
  "scope": "selection|range|document",
  "anchors": [{"start":10,"end":20,"text":"…"}],
  "willChange": ["bold=true", "color=#FF0000"],
  "nextHint": "Call again with confirmed=true to apply"
}
```

只读列表工具返回 `items[]` + `total` + `truncated`（如有），避免自由散文。

### P7. 工具三层纪律（不做判断 / 不过度取数 / 能 compose 不新建）

> 新增工具或 action 时逐条过这三关，任一不过则回炉。这条是 §1.1「LLM 推理 / Agent 只读定位写」在工具设计层的操作推论。

1. **不做判断 —— 只取/写「机械事实」，判断交 LLM。**
   - 禁止 `*_check` / 判定型 `*_audit` / `*_validate` 把启发式（题注连续性、alt 是否合格、编号是否跳号）写进 Agent。这些一律由「枚举事实 + LLM 推理」完成。
   - 金标准 = `declassify_preview`（只按传入 keywords 建遮罩，绝不自己 detect）；`proofread_*` 是有意的 hosted-model 例外，**不得当新工具模板**。
2. **不过度取数 —— 聚合是命名空间，不是 monolith。**
   - 稀疏集合（image / comment / bookmark / section / field / revision）→ `list` 一次返回，LLM 下标取。
   - 大容量容器（table、长域）→ 按需切片 read（`cell` / `row` / `column` / `header`），**不返回整对象全文**。
3. **能 compose 不新建 —— 写入优先复用通用原语。**
   - 改文字 / 改样式：拿到 range 后用 `document_replace` / `style(action=apply)` / `format_run` / `format_para`，**不为每个对象做 `*.style` 重复动作**。
   - 只有「对象几何属性」（列宽、重复标题行、合并单元格、SEQ/TOC 域构造）range 原语表达不了，才开专属写 action。
   - 软上限：单个聚合域 action 数建议 **≤10**；超过说明该拆域或下沉成 compose。

> 三层纪律同时服务「准确调用」：少判断工具 → 少同质工具撞选择（§1.2 第 1 类失败）；切片而非 monolith → 单次返回更轻、参数更聚焦、schema 不膨胀。

---

## 3. 能力分层架构

```text
┌─────────────────────────────────────────────────────────┐
│ L0  Server Instructions（全局铁律）                        │
├─────────────────────────────────────────────────────────┤
│ L1  Host          wps_status / wps_launch                 │
│ L2  Doc IO        open/save/meta/get_text/chunks/…       │
│ L3  Locate        locate / list_paragraphs / outline      │
│ L4  Content Write replace / insert / apply_ops            │
│ L5  Format Write  format_run / format_para / style_*      │
│ L6  Review        comment_* / revision_*                  │
│ L7  Layout        layout_page / columns / break / toc     │
│ L8  Business      proofread / declassify / kb / assistants│
└─────────────────────────────────────────────────────────┘
```

**选工具决策序（写进 SERVER_INSTRUCTIONS 精简版）：**

1. 不知文档状态 → L1  
2. 要读内容/结构 → L2/L3  
3. 改正文词语 → L4  
4. 改样子不改字 → L5  
5. 批注/修订协作 → L6  
6. 纸张目录分栏 → L7  
7. 校对脱密知识 → L8  

这条「先判层再选工具」是准确调用的核心。

---

## 4. 推荐工具面（目标态，非一次全做）

### 4.1 保留（现有）

全部现有 `document_*` / `proofread_*` / `declassify_*` / `kb_*` / `assistants_*` / `wps_*` 保留；仅做描述补强与 NOT 交叉引用。

### 4.2 新增 — P0（格式与审稿最小完备）

| 工具 | 职责 | action / 要点 | 易混 NOT |
|------|------|---------------|----------|
| `comment_list` | 读全文批注 | 可选 author/未解决过滤 | 不是 `get_text` |
| `comment_add` | 加批注 | 与现有 `document_add_comment` **合并或薄封装**，避免双入口 | 不改正文 |
| `comment_delete` | 删批注 | 按 id | |
| `format_run` | 字符格式 | `bold/italic/underline/strike/size/sizeDelta/name/color/highlight/phonetic` | 不是 replace；不是 style_apply |
| `format_para` | 段落格式 | `align/lineSpacing/spaceBefore/spaceAfter/indent` | 不是 format_run |
| `format_apply_ops` | 批量格式 | ops[] + 统一锚点；自底向上 | 禁止循环单条 |
| `system_fonts_list` | 可用字体 | 只读 | 设字体前可先调 |
| `style_list` | 样式列表 | 可过滤 heading | |
| `style_apply` | 应用样式 | styleName + 锚点 | 「标题1」走这里，不是只加粗 |
| `nav_location` | 页码/行号 | 对锚点查询 Information | 不是插入页码域 |
| `break_insert` | 分隔符 | page/section/column… | |
| `page_blank_insert` | 空白页 | | |
| `revision_mode` | 开/关修订 | | |
| `revision_list` | 列修订 | | |
| `revision_apply` | 接受/拒绝 | `action=accept\|reject` + scope all\|id | 一个工具两端，减少同义 |

### 4.3 新增 — P1（版式与结构）

| 工具 | 职责 |
|------|------|
| `layout_page` | 纸向、页边距、纸型 |
| `layout_columns` | 分栏 |
| `toc_insert` / `toc_update` | 目录 |
| `nav_outline` | 标题大纲树 |
| `nav_pane_set` | 导航窗格显示（UI） |
| `bookmark_list` / `bookmark_goto` | 书签 |

### 4.4 新增 — P2（对象与审计）

表格/图/超链接/页眉页脚/水印/`style_audit`/`export` 等；与 Ribbon 已有批处理对齐后再 MCP 化。

---

## 5. 关键工具：参数草图（保证可调准）

### 5.1 `format_run`（示范）

```json
{
  "type": "object",
  "required": ["changes"],
  "properties": {
    "changes": {
      "type": "object",
      "description": "Only set fields to change. Example: {\"bold\":true,\"sizeDelta\":2,\"color\":\"#FF0000\"}",
      "properties": {
        "bold": { "type": "boolean" },
        "italic": { "type": "boolean" },
        "underline": { "type": "boolean" },
        "strike": { "type": "boolean" },
        "name": { "type": "string", "description": "Font family; prefer a name from system_fonts_list" },
        "size": { "type": "number" },
        "sizeDelta": { "type": "number", "description": "Relative pt change, e.g. +2 / -1" },
        "color": { "type": "string" },
        "highlight": { "type": "string" },
        "phonetic": { "type": "string", "description": "PhoneticGuide text; omit to skip" }
      }
    },
    "originalText": { "type": "string" },
    "start": { "type": "number" },
    "end": { "type": "number" },
    "hintStart": { "type": "number" },
    "scope": { "type": "string", "enum": ["selection", "paragraph", "document"] },
    "confirmed": { "type": "boolean" }
  }
}
```

WHEN 示例（写入 description）：  
「加粗这段」「字号加大」「改成宋体」「标红」「加删除线」「给这两个字加拼音」

NOT：  
「改错别字」→ `document_replace`；「设为标题1」→ `style_apply`；「段居中」→ `format_para`。

### 5.2 `format_apply_ops`（批量准绳）

与 `document_apply_ops` 对称：

- `operations[{ anchor…, changes }]`  
- 单次上限（建议 ≤100）  
- 实现侧按 start **降序**应用，避免偏移错乱  
- Orchestrator 提示词明确：**多处格式 = 一次 format_apply_ops**

### 5.3 `revision_apply`

```json
{
  "action": "accept|reject",
  "scope": "all|ids",
  "ids": ["…"],
  "confirmed": true
}
```

避免 `revision_accept` + `revision_reject` 两个几乎相同的工具抢注意力。

---

## 6. 意图 → 工具路由表（准确调用的「真源」）

| 用户说法（类） | 先调 | 再调 | 禁止 |
|----------------|------|------|------|
| 打开/连上了吗 | `wps_status` | `document_open` | |
| 全文/某段内容 | `get_text` / `list_paragraphs` / `chunks` | | |
| 找到这句话 | `document_locate` | | |
| 把 A 改成 B | （可选 locate） | `replace` 或 `apply_ops(replace)` | format_* |
| 译完插到段后 | `list_paragraphs` | `apply_ops(insert-after)` 自下而上 | 全部 append 文末 |
| 加粗/变色/字号/拼音 | locate 或 selection | `format_run` | replace |
| 居中/行距 | | `format_para` | format_run |
| 设为标题/正文样式 | `style_list`? | `style_apply` | 仅 bold |
| 有哪些批注 | `comment_list` | | get_text |
| 批注说明 | | `comment_add` / 现有 add_comment | replace |
| 开修订/接受/拒绝 | `revision_mode` / `list` | `revision_apply` | |
| 横竖纸/分栏 | | `layout_*` | format_* |
| 插空白页/分页符 | | `page_blank_insert` / `break_insert` | insert 一堆空行冒充 |
| 目录 | | `toc_insert`/`update` | 手打「目录」文字 |
| 这段在第几页 | | `nav_location` | |
| 错别字校对 | `proofread_run` | apply_comments | 直接瞎 replace |
| 脱密 | `declassify_preview` | apply | |

此表应同步到：

1. `SERVER_INSTRUCTIONS`（压缩成 8～12 条铁律）  
2. MCP Resource `chayuan://guide/tool-routing`（完整表，供客户端/技能包引用）  
3. `wps-skill-chayuan` SKILL.md（教外部 Agent）

---

## 7. 描述与技能包双通道（提高「外部 Agent」命中率）

| 通道 | 作用 |
|------|------|
| tools/list descriptions | 运行时选型主通道 |
| Skill / Cursor rule | 教「批量 ops、确认纪律、层路由」 |
| Resource prompts | 复杂流程（译段插入、校对写回） |

新增格式类后，技能包必须补一节：**改样子用 format_***，**改字用 document_***，禁止混用。

---

## 8. 防冲突与去重策略

| 冲突 | 决策 |
|------|------|
| `document_add_comment` vs `comment_add` | **保留一个对外名**；另一名作为 deprecated alias 或内部转发，description 写「同 X」 |
| 加粗既可 format_run 也可「标题样式」 | NOT 写清：结构化标题 → style_apply |
| 拼音 vs replace 同音字 | 拼音 = PhoneticGuide；改字 = replace |
| 导航窗格 vs outline | `nav_pane_set` 只控 UI；`nav_outline` 返回数据结构 |
| 加载项内 documentFormatActions | MCP 实现应 **复用** 该模块，避免两套逻辑 |

---

## 9. 实现分期（仍属规划）

### Phase A — 契约与路由（不增业务也能提升准确率）

1. 审计现有工具 description 的 NOT 交叉引用  
2. 发布 Resource：tool-routing  
3. 统一预览返回字段  
4. Orchestrator / Skill 补「格式 vs 正文」铁律  

### Phase B — P0 工具落地

1. `comment_list` + 批注 API 对齐  
2. `format_run` / `format_para` / `format_apply_ops`（复用 documentFormatActions）  
3. `system_fonts_list` / `style_list` / `style_apply`  
4. `nav_location` / `break_insert` / `page_blank_insert`  
5. `revision_mode` / `revision_list` / `revision_apply`  
6. `comment_delete` ✅  

### Phase C — P1 版式

`layout_*` / `toc_*` / `nav_outline` / `nav_pane_set` / bookmarks ✅（`layout_columns` / `bookmark_list` / `bookmark_goto` 已落地）

### Phase C2 — P2 对象与审计

`table_insert` / `image_*` / `hyperlink_*` / `headerfooter_*` / `watermark_*` / `document_export` / `style_audit` ✅（catalog v0.7.0）

### Phase D — 评测门禁（科学验证「准确调用」）

建立 **意图→期望工具** 评测集（≥80 条中文说法）：

- 离线：规则/embedding 路由自检（可选）  
- 在线：用固定模型跑 tool-choice，统计 Top-1 命中率  
- 门禁建议：P0 意图 Top-1 ≥ 85%，致命混用（replace↔format）≤ 2%  

无评测不扩 P2。

---

## 10. 风险与取舍

| 风险 | 缓解 |
|------|------|
| 工具一多，list 上下文膨胀 | 聚合 action；长说明放 Resource；工具数设上限 |
| 拼音/修订/分栏宿主差异 | 能力探测：`wps_status.capabilities` 声明支持项；不支持返回明确 error code |
| 全文 format 误伤 | 默认拒绝无锚点 document scope；需显式 scope+confirmed |
| 外部 Agent 忽略 confirmed | Skill + 服务端强制；预览默认 |

---

## 11. 决议摘要（供拍板）

1. **采用领域聚合工具 + action**，不采用「一格式一工具」。✅ **v0.8.0 已纠偏落地**（`comment`/`revision`/`layout`/`nav`/`toc`/`bookmark`/`table`/`image`/`hyperlink`/`headerfooter`/`watermark`/`style`/`export`；细粒度名仅作 tools/call 兼容别名，不再出现在 tools/list）。  
2. **统一 Anchor + confirmed**，与现有 document/proofread 一致。  
3. **层路由**写进 Server Instructions + Resource + Skill 三处。  
4. **P0 先做格式/批注/修订/位置/分隔**；版式与对象放 P1/P2。  
5. **用评测集验收准确调用**，再继续加工具。  
6. **实现复用** `documentFormatActions` / 已有 insertBreak / Comments API，MCP 只做目录与协议层。

> 说明：`format_run` / `format_para` / `format_apply_ops` 保留为格式域动词工具（非「一格式一工具」）；对象与审稿/版式域以 `action` 聚合。

---

## 12. 下一步（等你确认后执行）

- [ ] 确认决议摘要 1～6  
- [ ] 冻结 P0 工具名与 inputSchema（本文件 §4.2 / §5）  
- [ ] Phase A：路由 Resource + 描述补强  
- [ ] Phase B：逐个实现 P0 并补自测用例  

—— 规划结束；确认后进入实现。
