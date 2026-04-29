# 察元 AI 文档助手 · 重构与演进计划 v2

> 版本:v2.0 · 2026-04-28
> 较 v1 的核心变化:
> 1. **助手进化系统升格为独立产品线**(原 v1 仅 P5 一笔带过)。
> 2. 路线图重排:进化系统作为 P3 起的并行产品线,而非附属。
> 3. 新增"信号采集"作为基础设施层(进化的"地基"),前置到 P0。
> 4. 加入「克制比积极更重要」的进化产品哲学。
> 5. 18 个新内置助手与进化系统打通(每个助手出生即有评测样本)。
>
> 阅读优先级:**§0 摘要 → §12 助手进化系统(全新章节)→ §14 路线图 v2**。
> 与 v1 重合的现状盘点章节(§1–§5)保留事实清单,变化不大,可参考 plan.md。

---

## 0. 执行摘要

察元已具备完整可用基线:Vue 3 + Vite,11 万行代码,29 内置助手,28 对话框,28 项能力总线,模型供应商离线/云端两可。**问题不在功能数量,而在**:

1. **调度散弹枪**(Ribbon / 对话框 / 助手 runner / capabilityBus 四条平行通道)
2. **跨窗口脆弱**(Selection 丢失、`window.opener` 链脆)
3. **首字符延迟过高**(最坏 4 次串行 LLM 路由 + 180 处同步 saveHistory)
4. **进化系统空有骨架**(`assistantEvaluationService` 用 token 重叠当主指标,方向错;无真实信号回流;同源裁判)

**v2 的北极星**:

> **首字符 ≤ 500ms,长文助手 ≤ 30s,所有能力同入口同关卡,助手"用得越久越靠谱",体验上接近 AI 产品级,继续保持公文/政企场景的稳定与合规底色。**

> **进化系统的设计哲学** ── *克制比积极更难,可解释比自动更值钱,可回滚比可晋升更重要,锚点比版本号更关键。*

六阶段(P0–P5)分批落地,P0 一周内见效;详见 §14 路线图 v2。

---

## 目录

- [1–5. 现状盘点](#1-5-现状盘点保留-v1)
- [6. 架构师视角:模块化与代码复用](#6-架构师视角模块化与代码复用)
- [7. 高性能设计:链路 A / 链路 B 全程提速](#7-高性能设计)
- [8. 设计师视角:视觉系统与界面重构](#8-设计师视角)
- [9. UE 视角:交互、动效、反馈](#9-ue-视角)
- [10. 用户使用视角:真实场景 16 例](#10-用户使用视角)
- [11. 助手新增建议 · 18 项内置](#11-助手新增建议)
- [**12. 助手进化系统(全新独立章节)**](#12-助手进化系统-)
- [13. 信号采集层(进化的基础设施)](#13-信号采集层)
- [14. 实施路线图 v2](#14-实施路线图-v2)
- [15. 验收指标与监控埋点 v2](#15-验收指标与监控埋点-v2)
- [16. 风险登记 v2](#16-风险登记-v2)
- [附录 A-E](#附录-a)

---

## 1–5. 现状盘点(保留 v1)

> 详见 `plan.md` v1 §1–§5。本节仅提示与进化系统直接相关的关键事实:

### 5.X 进化系统现状盘点(新增)

| 文件 | 行数 | 职责 | 评分 |
|---|---|---|---|
| `assistantEvaluationService.js` | 355 | 候选评估 + 健康分 + 发布门禁 + 真实对比 | ⭐⭐ |
| `assistantRegressionService.js` | 202 | 候选 vs 基线版本双跑回归 | ⭐⭐⭐ |
| `assistantRegressionSampleStore.js` | 172 | 黄金样本库(120 上限) | ⭐⭐⭐ |
| `assistantPromptRecommendationService.js` | 528 | LLM 生成新版助手配置 | ⭐⭐⭐ |
| `assistantVersionStore.js` | 167 | 版本快照、晋升、回滚 | ⭐⭐⭐⭐ |
| `assistantRepairService.js` | 87 | 失败证据 → 修复草案 | ⭐⭐ |
| `evaluationStore.js` | 341 | 评估记录持久化 | ⭐⭐⭐ |
| AIAssistantDialog `assistantEvolutionSuggestion` banner | — | UI(常驻 banner) | ⭐⭐ |

**6 个关键不靠谱点**(详见 §12.2):
1. 用 `computeTokenOverlap(input, output)` 当主指标,方向反了
2. 无 schema/事实/格式硬校验
3. 同源裁判(候选模型自评)
4. 无真实用户信号回流
5. 进化触发不闭环(banner 常驻 ≠ 智能触发)
6. 阈值与基线策略过于粗放

---

## 6. 架构师视角:模块化与代码复用

> 与 v1 完全一致,不再展开。新增**进化模块**目录:

```
src/utils/
├─ assistant/
│  ├─ registry.js
│  ├─ runner.js
│  ├─ structuredPipeline.js
│  └─ evolution/                       ✦ 新增独立子目录
│     ├─ signalStore.js                ✦ 5 类信号入库
│     ├─ failureCluster.js             ✦ 失败聚类
│     ├─ candidateGenerator.js         ✦ 候选生成
│     ├─ evaluator.js                  ✦ RACE 四维评分
│     ├─ judge.js                      ✦ LLM 双裁判 + rubric
│     ├─ shadowRunner.js               ✦ 影子双跑
│     ├─ gateProfiles.js               ✦ 助手分类阈值
│     ├─ promotionFlow.js              ✦ 晋升流程编排
│     ├─ rollbackMonitor.js            ✦ 自动回滚监控
│     └─ anchorPrompt.js               ✦ 原始意图锚
```

每个文件单一职责,**不再像现有 `assistantEvaluationService.js` 把"指标 + 裁判 + 门禁"混在 355 行里**。

---

## 7. 高性能设计

> 与 v1 一致(链路 A 8 项 + 链路 B 10 项提速方案)。这里仅补充**进化系统的性能设计**:

### 7.X 进化系统性能预算

| 操作 | 不能超过 |
|---|---|
| 信号入库(单条) | 同步 < 5 ms,异步 < 50 ms |
| 失败聚类(每天一次) | 后台 < 10 s |
| 候选生成(LLM) | < 30 s |
| 影子双跑单次开销 | 不阻塞 UI(异步队列 + 限频) |
| 离线评测(20 黄金样本) | < 3 min |
| 健康分计算 | < 100 ms(SignalStore 内 30 天滚动窗口) |

**核心策略**:**所有进化相关计算都是后台异步,绝不进入用户的关键交互链路**。

---

## 8. 设计师视角

> 与 v1 一致(token 系统 + 三 tab + 三栏对话框 + 命令面板)。新增**进化系统视觉**:

### 8.X 进化系统视觉

#### 1. 助手卡片心电图

设置页助手列表里,每个助手卡右侧 60×24 px 的 spark line,显示过去 14 天的 RACE 健康分变化:

```
扩写  ▁▂▃▅▆▇▆▅▆▇▇▆▆▅  87  ↑
保密  ▆▇▆▆▇▆▇▆▇▇▇▇▆▇  94  ─
拼写  ▇▆▅▄▃▂▂▃▄▃▂▁▂▁  62  ↓ ⚠ 建议进化
```

颜色:绿(85+)→ 黄(70-84)→ 红(<70)。点击展开"按维度拆分"。

#### 2. 进化对决面板(Versus Panel)

详见 v1 §9.5。视觉关键:

- 左右卡片入场:对撞 1 次(用 `transform: translateX` + bounce easing)
- 柱状图:从 0 stagger 增长(每维度 80ms 错开)
- 关键提升「✦」:流光描边(同 AI 流光边框,§8.5 v1)
- 不达标的维度:朱砂红下划线
- 「立即晋升」按钮:数据明确时高亮,否则灰

#### 3. 失败证据时间轴

进化建议背后必须可见证据,**不能黑盒推荐**:

```
4-22 14:31  用户撤销了批注    "丢失称谓"
4-23 09:12  JSON 解析失败    schema 缺 sentence
4-25 16:08  用户 👎          "改写后不通顺"
─────── 7 天累计 23 次同类失败 ───────
```

- 每条失败可点开看脱敏后的原始 input/output
- 用户可标记「这不是问题」(误报),将该样本剔出聚类

#### 4. 晋升仪式(克制版庆祝)

晋升成功瞬间:
- 助手卡片**从灰过渡到主色** + 上方一道流光横扫(800 ms)
- 版本号**翻页动画**(`1.4.2 → 1.5.0`,每位数字独立翻转,Linear 同款)
- 右上角 mini-toast:`v1.5.0 已上线 · 撤销`(3 秒收回)

#### 5. 回滚一键化

晋升后 7 天内,助手卡右上角始终有小 ↶ 图标(置灰),hover 显示`回滚到 v1.4.2`,点击即恢复。

#### 6. 进化建议入口的克制

- ❌ 不在主对话流弹 banner
- ✅ 设置页助手卡右上角小红点(`badge`)
- ✅ 仅在用户**连续 👎 3 次同一助手**时,在对话框右上角弹小气泡
- ✅ 弹气泡时附带「暂停 30 天 / 永远不建议 / 现在去看」三选一

---

## 9. UE 视角

> 与 v1 一致。新增**进化系统的交互三原则**:

### 9.X 进化系统三原则

1. **永不打扰**:进化建议**永远不出现在主对话流里打断用户**。
2. **永不偷改**:进化必须经过用户(或管理员)显式确认才晋升。
3. **永不无解释**:每个建议都附 3-5 条真实失败证据,可点开溯源。

### 9.Y 进化相关键盘快捷键

| 快捷键 | 动作 |
|---|---|
| `⌘ Shift E` / `Ctrl Shift E` | 打开当前助手的进化面板 |
| `⌘ Shift R` / `Ctrl Shift R` | 回滚当前助手到上一版 |
| `⌘ Shift H` / `Ctrl Shift H` | 查看当前助手健康分历史 |
| `⌘ Shift T` / `Ctrl Shift T` | 当前对话给助手一个👎信号 |

---

## 10. 用户使用视角

> v1 的 14 个场景全部保留,补 2 个进化相关场景:

### 10.15 高频用户老贺 — 进化体验

- **现状**:`assistantEvolutionSuggestion` banner 时不时弹出,挤占消息区,看不懂建议依据是什么,直接关掉。
- **目标**:工作流中**完全静默**;周末打开设置页时看到「拼写检查健康分 62 ↓,建议进化」红点;点开看到 23 条具体失败证据;一键启动影子双跑;7 天后收到「影子表现优于基线 12 分,建议晋升」提示;晋升后保留 7 天观察期,随时一键回滚。

### 10.16 团队管理员老吴 — 组织级进化

- **现状**:无团队级管理。每个用户的助手互相隔离。
- **目标**:管理员可以把单位级的"政策风格改写"助手设为**组织模板**(只读),普通用户只能基于此创建衍生版本。组织模板的进化由管理员审批,普通用户拿到的永远是审批过的稳定版。

---

## 11. 助手新增建议 · 18 项内置

> 与 v1 一致,共 18 个分 6 类:公文政务 5 + 法律合规 3 + 学术 3 + 商业 3 + 数据 2 + 跨场景 2。

### 11.X 与进化系统的协同(新增)

每个新助手**出生即配套**:

1. `anchorPrompt`(v1 提到,正式落地)
2. `outputSchema`(JSON 输出助手必填)
3. `examples`:3 条 input/output 示例,自动作为初始黄金样本(进化系统从第 0 天就有评测能力)
4. `gateProfile`:从 `gateProfiles.js` 选一个(rewriter / summarizer / json / security / translator / legal / academic),自动映射 RACE 阈值
5. `industry` 标签:用于按行业推荐和团队级共享

```js
// 例:legal.clause-extract
{
  id: 'legal.clause-extract',
  name: '合同条款抽取',
  category: 'legal',
  industry: ['legal', 'corporate'],
  inputCharRange: [200, 50000],
  estimatedTokens: 1500,
  gateProfile: 'legal',           // ✦ 触发严格 RACE 阈值
  raceWeights: { R:.40, A:.25, C:.30, E:.05 },  // ✦ 法律类 R/C 权重高
  modelHint: ['gpt-4o', 'claude-sonnet'],
  outputSchema: {
    type: 'object',
    required: ['parties', 'amount', 'duration', 'penalties'],
    properties: { /* ... */ }
  },
  anchorPrompt: '你是合同条款抽取专家。仅从原文事实中抽取,不补全、不推测...',
  examples: [
    { input: '本合同甲方为 A 公司,乙方为 B 公司,合同金额 100 万元...',
      output: '{"parties":["A 公司","B 公司"],"amount":"100 万元",...}' },
    /* 2 more */
  ]
}
```

---

## 12. 助手进化系统 ✦

> 这一章是 v2 的**核心扩充**。承接独立分析"我考虑助手进化的思路"一文,完整工程化为可实施方案。

### 12.1 设计哲学

> **克制比积极更难,可解释比自动更值钱,可回滚比可晋升更重要,锚点比版本号更关键。**

- 进化的目的是「修掉客观失败」,不是「让助手越来越懂某个用户」(后者是个性化记忆,留到 P5+)。
- 决策权默认在用户手里,系统只负责"看到证据、出主意、跑评测、提供回滚"。
- 不做自动 fine-tune、不做用户对话训练、不做 RLHF、不做助手互相打分排名,**全部用 prompt 进化 + 用户信号 + LLM 裁判轻量组合**。
- 90% 工程量花在「失败修复的可见建议」,10% 花在「自动晋升」。

### 12.2 当前实现的 6 个不靠谱点(必须修)

1. **指标方向反了**:`computeTokenOverlap(input, output)` 度量"输出与输入词重叠率",对改写/翻译/缩写助手反向(高重叠 = 失败),对摘要正向(低重叠 = 正常),对 JSON 助手不相关。**用一个不分类的指标当总分,等于拿温度计量血压**。
2. **无 schema/事实/格式硬校验**:JSON 输出助手必须验证 schema 合法性 + 必填字段 + 不编造原文,这些检查 0 LLM 即可完成,但当前完全没做。
3. **同源裁判**:`pickRegressionModel = getFlatModelsFromSettings('chat')[0]` 用第一个 chat 模型既跑候选又评候选。LLM-as-judge 的 self-preference bias 已被 MT-Bench 论文证实(同家族评分高 8-15 分)。
4. **无真实用户信号回流**:用户的 👍/👎/接受写回/丢弃/30 秒内撤销/编辑后再用,这些**金标信号**目前都没进入评估管线。评分和真实使用质量脱钩。
5. **触发时机不闭环**:`assistantEvolutionSuggestion` 是常驻 banner,既不基于失败聚类、也不主动产出证据包,更像手动入口的可视化包装。
6. **阈值与基线策略过于粗放**:`totalScore >= 72` 一刀切;`findAssistantRegressionBaseline = family[index-1]` 只看上一版,无法对比"当前生产版/历史最佳版/用户选定版"。

### 12.3 RACE 四维健康分(替代单一 totalScore)

#### 12.3.1 维度定义

```
RACE = (Reliability, Accuracy, Compliance, Efficiency)
```

| 维度 | 测量什么 | 数据源 | 计算 |
|---|---|---|---|
| **R 可靠性** | 不崩、不空、不超时、JSON 不坏 | taskListStore + structuredPipeline | (1 - 失败率) × 100 |
| **A 准确性** | 真实任务上"是否解决了用户的问题" | SignalStore(用户接受率)+ LLM judge | 0.5×accept_rate + 0.5×judge_score |
| **C 合规性** | 不越界、不编造、不输出禁用内容 | structuredCommentPolicy + security-check | min(锚定命中率, 安全词非命中率) × 100 |
| **E 效率** | 用得快、用得少 | task duration + token usage + downgrade rate | 1 - normalize(duration) - normalize(tokens) - downgrade_rate |

#### 12.3.2 类别权重(profile-based)

不同助手类别 RACE 权重不同:

```js
// src/utils/assistant/evolution/gateProfiles.js
export const RACE_WEIGHTS = {
  rewriter:    { R:.25, A:.35, C:.15, E:.25 },  // 改写类
  summarizer:  { R:.25, A:.45, C:.10, E:.20 },  // 摘要类
  json:        { R:.50, A:.25, C:.15, E:.10 },  // 结构化
  security:    { R:.20, A:.25, C:.50, E:.05 },  // 保密类(C 权重 50%)
  translator:  { R:.25, A:.40, C:.20, E:.15 },
  legal:       { R:.40, A:.25, C:.30, E:.05 },  // 法律类(C/R 权重高)
  academic:    { R:.20, A:.45, C:.30, E:.05 },
  multimodal:  { R:.45, A:.30, C:.10, E:.15 }
}

export const RACE_THRESHOLDS = {
  rewriter:    { R:80, A:75, C:75, E:70, total:75 },
  summarizer:  { R:80, A:78, C:75, E:70, total:76 },
  json:        { R:90, A:75, C:80, E:65, total:80 },
  security:    { R:88, A:82, C:92, E:55, total:85 },  // 极严
  legal:       { R:88, A:80, C:88, E:55, total:82 },
  /* ... */
}
```

#### 12.3.3 健康分总公式

```js
// 可解释计算,每一项都能溯源
function computeHealthScore(assistantId, version) {
  const profile = getAssistantProfile(assistantId)
  const weights = RACE_WEIGHTS[profile]
  const signals = getSignalsForVersion(assistantId, version, /*windowDays*/30)
  
  const R = computeReliability(signals)      // 0-100
  const A = computeAccuracy(signals)
  const C = computeCompliance(signals)
  const E = computeEfficiency(signals)
  
  const total = R * weights.R + A * weights.A + C * weights.C + E * weights.E
  return { R, A, C, E, total, profile, weights, signals: signals.length }
}
```

### 12.4 信号金字塔

```
        🏆 用户接受/撤销  (顶,最稀缺最真实)
           ↓
        👍 明示反馈        (次稀缺)
           ↓
        💼 任务结果         (审计/降级/超时,有量但混杂)
           ↓
        🥇 黄金样本         (人工策划,不会过期)
           ↓
        🤖 启发式 dry-run   (底,免费但失真)
```

**原则**:优先消费上层信号,只在缺数据时用下层补。详见 §13 信号采集层。

### 12.5 候选生成

#### 12.5.1 触发条件(决策矩阵)

| 触发条件 | 行动 | UI 优先级 |
|---|---|---|
| 失败率 < 5% 且 7 天稳定 | **不要进化** | 静默 |
| 失败率 5-15%,聚类清晰 | 后台预生成候选 + 影子双跑 | 设置页"建议中"角标 |
| 失败率 > 15% 或 critical 命中 | 主动建议 + 影子结果对比 | 主对话框小气泡 |
| 用户连续 👎 3 次同一助手 | 立即建议,带证据 | 弹出 banner |
| 模型升级了(gpt-4o → gpt-5) | 建议重测 | 设置页通知 |
| 用户拒绝过的进化建议 | 30 天内同类不再尝试 | — |

#### 12.5.2 候选生成约束(关键)

`candidateGenerator.js` 升级 `assistantPromptRecommendationService`,生成候选时**强约束**:

1. **anchor 不变**:候选必须保留原始 `anchorPrompt` 描述的能力边界,不允许扩张职责。
2. **最小修改**:`diffSummary` 必须列出每一项改动的原因(失败聚类编号 + 修复假设)。
3. **多候选**:N=3,温度梯度(0.2 / 0.5 / 0.8),保证多样性。
4. **同步消费证据包**:把失败聚类样本作为 prompt 一部分,要求模型针对性修复。
5. **schema 约束**:LLM 输出按 strict JSON schema(用 `response_format: { type: 'json_schema' }`)。

#### 12.5.3 失败证据包结构

```json
{
  "assistantId": "analysis.rewrite",
  "currentVersion": "1.4.2",
  "failureCluster": "user-rejected-rewrite",
  "windowDays": 7,
  "samples": [
    {
      "id": "sig_xxx",
      "input": "...(脱敏后)...",
      "output": "...",
      "rejectedAt": "2026-04-20T14:31:00Z",
      "userNote": "丢失了'各位'的称谓",
      "signalType": "rejected"
    }
    /* ... 最多 20 条 ... */
  ],
  "metrics": {
    "rejectionRate7d": 0.34,
    "downgradeRate7d": 0.12,
    "raceBefore": { "R":92, "A":61, "C":88, "E":85 },
    "totalCalls": 1402
  },
  "anchorPrompt": "你是中文改写专家,保留原意调整表述..."
}
```

### 12.6 LLM 双裁判 + Rubric 评分

#### 12.6.1 裁判模型选择规则

```js
function pickJudges(candidateModel, taskCount) {
  const allModels = getFlatModelsFromSettings('chat')
  const candidateFamily = inferModelFamily(candidateModel)  // openai/anthropic/local/...
  
  const judgeA = allModels.find(m => 
    inferModelFamily(m) !== candidateFamily &&
    isReliableForJudging(m)
  )
  const judgeB = allModels.find(m => 
    inferModelFamily(m) !== candidateFamily &&
    inferModelFamily(m) !== inferModelFamily(judgeA) &&
    isReliableForJudging(m)
  )
  
  // 关键样本(critical=true)用双裁判,普通样本用单裁判
  return taskCount <= 5 ? [judgeA, judgeB] : [judgeA]
}
```

#### 12.6.2 Rubric 评分提示词(全文)

```
你将看到任务输入 INPUT、参考输出 BASELINE、候选输出 CANDIDATE。

请按下表对 CANDIDATE 与 BASELINE 各自打分(每项 0-5,允许半分):

1. 核心需求满足度 — 是否解决了 INPUT 的核心需求?
2. 事实可信度 — 是否新增了原文不存在的事实?(0=严重幻觉,5=完全无幻觉)
3. 关键信息保留 — 是否保留了原文的术语/数据/编号/称谓?
4. 输出格式 — 是否符合 expectedOutputFormat / outputSchema?
5. 中文表达 — 中文是否专业、连贯、无翻译腔?

最后判定 winner ∈ {candidate, baseline, tie}。

只输出合法 JSON,无任何解释:
{
  "candidate": [c1, c2, c3, c4, c5],
  "baseline":  [b1, b2, b3, b4, b5],
  "winner": "candidate|baseline|tie",
  "reason": "<= 80 字"
}
```

#### 12.6.3 双裁判仲裁

- 两裁判各自打分
- 总分(各 5 项之和)差距 > 8 时,标记`judge_disagreement`,进入人工复核队列
- 否则取平均;winner 看两裁判一致结果,不一致 = tie

### 12.7 影子双跑(Shadow Run)

#### 12.7.1 设计目标

候选版本不直接接管,而是**每次用户真实调用助手时,在后台并行调用候选版本**,记录两边输出但**只把基线结果展示给用户**。

#### 12.7.2 工程实现

```js
// src/utils/assistant/evolution/shadowRunner.js
async function runAssistantWithShadow(assistantId, input, options) {
  const baselineVersion = getPromotedVersion(assistantId)
  const baselineResult = await runVersion(baselineVersion, input, options)
  showToUser(baselineResult)
  
  // 异步影子,不阻塞 UI
  if (hasShadowCandidate(assistantId) && !options.disableShadow) {
    queueMicrotask(async () => {
      try {
        await throttle(SHADOW_RATE_LIMIT, async () => {
          const candidateVersion = getShadowVersion(assistantId)
          const candidateResult = await runVersion(candidateVersion, input, {
            ...options,
            silent: true,           // 不更新进度 UI
            isShadow: true,
            timeout: SHADOW_TIMEOUT
          })
          recordShadowComparison({
            assistantId,
            baseline: baselineResult,
            candidate: candidateResult,
            timestamp: Date.now()
          })
        })
      } catch (e) {
        // 影子失败不影响主流程
        recordShadowFailure(assistantId, e)
      }
    })
  }
  return baselineResult
}
```

#### 12.7.3 限流与配额

- **每用户每月配额**:默认 100 次(可在设置中调整 0–500)
- **限频**:每分钟 1 次
- **关键任务禁用**:全文扫描类任务自动 `disableShadow=true`(避免烧 token)
- **本地模型放行**:用本地 Ollama 时不计入云端配额
- **用户开关**:设置页「助手影子评测」,默认**关闭**(政企谨慎)

### 12.8 决策流(完整流程图)

```
┌── 用户与助手交互完毕 ──┐
│                         │
│  采集 5 类信号 ───► SignalStore  (无门禁、无打扰)
│                         │
└───────────┬─────────────┘
            │
            ▼ (每天定时,后台聚类)
       失败率 < 5% ?
       /          \
      YES         NO
       │           │
       ▼           ▼
    完全静默     生成 N=3 候选
                   │
                   ▼
        离线评测(黄金 + 失败回放 + 正向)
        × LLM 双裁判 + 规则裁判
                   │
                   ▼
        RACE 四维 ≥ profile 阈值?
        /                              \
       NO                              YES
       │                                │
       ▼                                ▼
   作为"建议"放设置页角标       影子双跑(后台不打扰)
   失败模式入知识库,30 天内              │
   不再针对同类 cluster                  ▼
                              影子 N 天 RACE 稳定 ≥ baseline?
                              /                              \
                             NO                              YES
                             │                                │
                             ▼                                ▼
                         返回候选生成                  设置页推送对决面板
                         (温度梯度调整)                       │
                                          ┌───────────────┴──────────────┐
                                          │                              │
                                    低风险助手                     高风险助手
                                  (rewriter etc)        (security/legal/audit)
                                          │                              │
                                          ▼                              ▼
                                  用户 1 步确认               双人确认 + 影子延长
                                          │                              │
                                          └──────────────┬───────────────┘
                                                         ▼
                                              晋升,记入版本库
                                                         │
                                                         ▼
                                            7 天观察期(随时可回滚)
                                                         │
                                                         ▼
                                  任一指标连续 3 采样跌破 → 自动回滚
                                                         │
                                                         ▼
                                            7 天稳定 → 正式版本
```

### 12.9 锚点保护(anchorPrompt)

#### 12.9.1 机制

- 每个助手定义里**强制**新字段 `anchorPrompt`(原始 system prompt + 设计意图描述)
- 该字段**只读,不允许随版本更改**
- 候选生成时把 anchorPrompt 作为强约束:"候选必须在 anchor 边界内,不允许扩张职责"
- 用户可一键「重置到 anchor」(走特殊回滚路径,不是回滚到上一版,而是回到 v1.0.0)

#### 12.9.2 检测 prompt drift

每次晋升前,用 LLM 对比新候选 vs anchorPrompt 的语义距离:

```
请判断 CANDIDATE_PROMPT 与 ANCHOR_PROMPT 是否仍然描述同一个助手:
- 能力边界是否一致?
- 输出格式是否一致?
- 风险约束是否一致?

输出 JSON: {"isCompatible": bool, "driftScore": 0-100, "reason": "..."}
```

`driftScore > 30` 视为 drift,**禁止晋升**,降级为"建议人工审阅"。

### 12.10 用户主权设计(必须落地)

| 用户操作 | 系统响应 |
|---|---|
| 「现在不要建议」 | 当前助手暂停 30 天 |
| 「永不建议」 | 当前助手永久关闭进化(可在设置页重新开启) |
| 「重置到 anchor」 | 助手回到 v1.0.0,清除版本历史(保留快照备份 1 年) |
| 「拒绝候选」 | 该候选标记为 rejected,30 天内同类 cluster 不再生成相似候选 |
| 「立即回滚」 | 7 天观察期内一键恢复上一版 |
| 「禁用影子」 | 当前助手不再跑影子双跑 |
| 「冻结当前版本」 | 当前版本永远不进化(适合"刚刚调好别动"的用户) |

### 12.11 进化系统的边界(不做)

- ❌ **自动 fine-tune**(政企本地存储有合规风险 + 不可解释)
- ❌ **用户对话训练**(原文不进训练管线,只做信号统计)
- ❌ **全链路 RLHF / DPO**(单加载项规模做不动 + 标注成本高)
- ❌ **AI 自动新建并自动启用助手**(必须用户确认创建)
- ❌ **助手互相打分排名**(不同任务无可比性)
- ❌ **进化建议出现在主对话流里**(永不打扰)

---

## 13. 信号采集层 ✦

> 这是进化的"地基",必须**先于**任何评估算法落地。

### 13.1 5 类信号的具体采集点

| # | 信号 | 来源 | 现有? | 接入位置 | 数据示例 |
|---|---|---|---|---|---|
| 1 | **明示 👍 / 👎** | 消息气泡操作 | ❌ 缺 | `ChatBubble.vue` 新增按钮 → `signalStore.append('thumbs', ...)` | `{ thumbs:'down', note:'丢失称谓', assistantId:'analysis.rewrite', version:'1.4.2', taskId:'tsk_xxx' }` |
| 2 | **接受 / 撤销** | `applyDocumentAction` + WPS Undo 监听 | ❌ 缺 Undo 监听 | 写回成功后 30s 内监听 `Application.OnDocumentChange`,如检测到撤销则记 `rejected=true` | `{ accepted:true, undoneWithinMs:18000, taskId:'tsk_xxx' }` |
| 3 | **任务结果** | `taskListStore` | ✅ 已有 | 监听 `updateTask({status:'completed'\|'failed'\|'cancelled'})`,提取 `applyResult`、`error`、`duration` | 走完整 task record |
| 4 | **能力审计** | `capabilityAuditStore` | ✅ 已有 | 直接复用 `capabilityAuditRecord` | 走完整 audit record |
| 5 | **黄金样本** | 手工 / 导入 | ✅ 已有(120 上限,扩) | `assistantRegressionSampleStore.upsertRegressionSample` | 已有 schema |

### 13.2 SignalStore 数据模型

```js
// src/utils/assistant/evolution/signalStore.js
const STORAGE_KEY = 'chayuan/v2/assistantSignalStore'
const MAX_SIGNALS_PER_ASSISTANT = 1000   // 滚动窗口
const MAX_DAYS = 30

export function appendSignal(signal) {
  const record = {
    id: `sig_${Date.now()}_${randomToken(8)}`,
    type: signal.type,                    // 'thumbs'|'accept'|'reject'|'task'|'audit'|'golden'
    assistantId: signal.assistantId,
    version: signal.version,              // 触发时的助手版本
    timestamp: Date.now(),
    taskId: signal.taskId,
    inputHash: hashContent(signal.input),  // 不存原文,存 hash
    inputLength: signal.input?.length || 0,
    outputHash: hashContent(signal.output),
    outputLength: signal.output?.length || 0,
    duration: signal.duration,
    tokens: signal.tokens,
    success: signal.success,
    failureCode: signal.failureCode,
    userNote: signal.userNote,            // 用户填写的"哪里不好"
    metadata: signal.metadata             // 扩展字段
  }
  
  // 异步写入,不阻塞主线程
  queueMicrotask(() => {
    const existing = loadStore()
    const next = [record, ...existing]
      .filter(s => Date.now() - s.timestamp < MAX_DAYS * 86400000)
      .slice(0, MAX_SIGNALS_PER_ASSISTANT)
    saveStore(next)
  })
  return record.id
}

// 关键:不存原文 input/output,只存 hash + length
// 真实需要原文时,从 task.data.inputPreview 取(已有截断)
```

### 13.3 隐私与脱敏

- **原文不入信号库**,只存 hash + length + 失败 code + 用户标注
- 失败证据包外发(给 LLM 候选生成)前,**先经过 declassify 服务脱敏**
- 用户可在设置中导出/清除自己的信号数据
- 默认信号本地落盘,**永不外发**
- 仅在用户明示授权 + 影子双跑模型为云端时,信号 hash 可用于云端裁判

### 13.4 失败聚类算法

```js
// src/utils/assistant/evolution/failureCluster.js
export async function clusterFailures(assistantId, model) {
  const recentSignals = listSignalsByAssistant(assistantId, 7)
    .filter(s => isFailure(s))
  
  if (recentSignals.length < 5) return []  // 样本太少不聚类
  
  // 阶段 1:规则聚类
  const rulesBased = groupBy(recentSignals, s => s.failureCode || 'unknown')
  
  // 阶段 2:用小模型给样本打 cluster label(只在规则聚类不够细时)
  const needsLlm = Object.values(rulesBased).filter(g => g.length >= 5)
  const clusters = []
  for (const group of needsLlm) {
    const labels = await classifyFailureModeWithModel(group, model)
    // 例:'lost-honorific'/'json-parse-fail'/'over-rewrite'
    for (const [label, samples] of Object.entries(groupBy(labels))) {
      if (samples.length >= 3) {
        clusters.push({
          assistantId,
          cluster: label,
          count: samples.length,
          samples: samples.slice(0, 20),
          firstSeen: Math.min(...samples.map(s => s.timestamp)),
          lastSeen: Math.max(...samples.map(s => s.timestamp))
        })
      }
    }
  }
  return clusters
}
```

### 13.5 信号采集 P0 落地点

P0 阶段只需要 5 处代码改动即可让"信号采集"基础设施跑起来:

| 改动位置 | 工作量 |
|---|---|
| `ChatBubble.vue` 加 👍/👎 按钮 + 一行"哪里不好" | 0.5 天 |
| `applyDocumentAction` 包一层 `recordWriteBack`,30 s 后检测 Undo | 0.5 天 |
| `assistantTaskRunner` 任务完成时调 `appendSignal({type:'task'})` | 0.5 天 |
| `signalStore.js` 新建 + Pinia store | 0.5 天 |
| 设置页加「我的信号」面板(导出/清除/统计) | 1 天 |

**总计:3 天**。这 3 天投入是后续整个进化系统的"地基",不能省。

---

## 14. 实施路线图 v2

### 14.1 路线图总览

```
P0 ████                                       1 周  (基础修复 + 信号地基)
P1    ██████████                              2 周  (链路提速)
P2          ██████████                        2 周  (UI 升级 + 命令面板)
P3                ████████████████            3 周  (模块化 + 进化 v1)
P4                          ████████████      3 周  (能力总线 + 进化 v2)
P5                                ──────────→ 持续 (进化 v3 + 应用市场)
```

### 14.2 P0 · 立刻见效(1 周)

| 任务 | 类别 | 收益 | 工作量 |
|---|---|---|---|
| 创建 `hostBridge.js` 单例 | 架构 | 解决"无法触发文档 API" | 1 天 |
| Selection token 快照机制 | 架构 | 解决"选区丢失"概率失败 | 1 天 |
| 全部 `alert(e?.message)` → `showSafeErrorDetail` | UE | 错误反馈不再沉默 | 0.5 天 |
| 路由模型解耦(独立设置项) | 性能 | 首字符 -1.5s | 0.5 天 |
| `saveHistory` 节流 + idle callback | 性能 | 主线程不卡顿 | 1 天 |
| 删 5 个空函数 / 死 case | UE | UI 不再"点了无反应" | 0.5 天 |
| Ribbon `OnGetVisible` 隐藏未占用 PrimarySlot | UE | Label 不重复 | 0.5 天 |
| **✦ SignalStore 基础设施(5 处接入)** | 进化地基 | 进化系统数据底料 | 3 天 |

### 14.3 P1 · 链路提速(2 周)

| 任务 | 类别 | 收益 | 工作量 |
|---|---|---|---|
| 乐观流式 + abort 中断(A1) | 性能 | 首字符 -2-4s | 3 天 |
| 路由判定全部并行(A3) | 性能 | 首字符 -1-2s | 2 天 |
| chunk 并发池(B1) | 性能 | 长文助手 -60-80% | 2 天 |
| prompt caching 接入(B4) | 性能 | 成本 + 延迟双降 | 1 天 |
| ScreenUpdating off + Repagination off(B7) | 性能 | 写回 -80-90% | 0.5 天 |
| 撤销栈合并(B8) | UE | 用户一键撤销整体 | 1 天 |
| structured outputs(B9) | 质量 | JSON 失败率 ↓ | 1 天 |
| 任务进度节流 + BroadcastChannel(B10) | 性能 | 跨窗口同步丝滑 | 1 天 |
| **✦ 失败聚类算法 v1(规则 + 小模型)** | 进化 | 进化建议有据可依 | 1.5 天 |

### 14.4 P2 · UI 升级 + 命令面板(2 周)

| 任务 | 类别 | 工作量 |
|---|---|---|
| 设计 token + 字体 + 暗色模式 | 设计 | 2 天 |
| 主对话框三栏 + Selection Chip + Intent Pill + Diff 预演 | 设计 + UE | 5 天 |
| 命令面板 ⌘K | UE | 3 天 |
| 欢迎页重构 | 设计 | 2 天 |
| AI 流光边框 + 进度 shimmer + 完成扫光 | 设计 | 1 天 |
| **✦ 助手卡片心电图(健康分 spark line)** | 进化 UI | 1 天 |

### 14.5 P3 · 模块化重构 + 进化系统 v1(3 周)

#### 模块化重构

| 任务 | 工作量 |
|---|---|
| `AIAssistantDialog.vue` 拆为 6 个子组件 | 5 天 |
| `ribbon.js` 拆为 customUiXml/onAction/icons/labels/menus | 3 天 |
| 28 对话框接入 `<DialogShell>` + `showAdaptiveDialog` | 5 天 |
| 5 套 `*WindowManager` 收敛为 `createDialogSession` | 2 天 |
| 14+ store 迁移到 Pinia + 版本化 + IndexedDB | 5 天 |

#### **✦ 进化系统 v1**

| 任务 | 工作量 |
|---|---|
| RACE 四维替换 totalScore | 2 天 |
| `gateProfiles.js` 写助手类别阈值表 | 1 天 |
| 双裁判 + rubric 评分 | 3 天 |
| anchorPrompt 字段 + drift 检测 | 1 天 |
| 进化对决面板 UI | 2 天 |
| 失败证据时间轴 UI | 1 天 |
| 用户主权(暂停 30 天 / 永不建议 / 重置 anchor / 冻结) | 1.5 天 |
| 替换常驻 `assistantEvolutionSuggestion` banner 为设置页角标 | 0.5 天 |

### 14.6 P4 · 能力总线全覆盖 + 进化系统 v2(3 周)

#### 能力总线全覆盖

| 任务 | 工作量 |
|---|---|
| 注册 declassify / form-audit / batch / template / media / document-comment / document-revision 等 namespace | 7 天 |
| Ribbon OnAction 80+ case 改写为 `bus.execute(...)` | 3 天 |
| 主进程 op 队列(BroadcastChannel + ribbon 监听) | 5 天 |
| 能力 catalog 自动生成(JSDoc tag) | 2 天 |
| 策略/配额/审计 UI 统一面板 | 3 天 |

#### **✦ 进化系统 v2**

| 任务 | 工作量 |
|---|---|
| 影子双跑机制(限频 + 配额 + 用户开关) | 5 天 |
| 自动回滚监控(任一维度连续 3 采样跌破) | 2 天 |
| 候选生成 v2(温度梯度 N=3 + 失败证据嵌入) | 2 天 |
| 团队级共享与组织模板(管理员审批) | 3 天 |

### 14.7 P5 · 进化系统 v3 + 应用市场(持续)

| 任务 | 工作量 |
|---|---|
| 灰度分桶上线(5%→25%→50%→100%) | 5 天 |
| 18 个新内置助手开发 + 评测 + 影子 7 天观察 | 15 天 |
| Skill 插件机制(目录扫描自动注册) | 7 天 |
| 应用市场骨架(签名验证 + 安装/卸载) | 持续 |
| 进化大盘(组织级数据分析) | 持续 |
| 个性化记忆系统(P5+,设计哲学之"目的 ①") | 持续 |

### 14.8 路线图变化对比 v1 → v2

| 阶段 | v1 | v2 |
|---|---|---|
| P0 | 7 项基础修复 | + SignalStore 地基(3 天)= 8 项 |
| P1 | 8 项性能 | + 失败聚类算法(1.5 天) |
| P2 | 5 项 UI | + 助手卡片心电图(1 天) |
| P3 | 5 项模块化 | + 进化系统 v1 完整 8 项(11 天) |
| P4 | 5 项能力总线 | + 进化系统 v2 完整 4 项(12 天) |
| P5 | 持续杂项 | + 灰度上线 + 应用市场 + 个性化(单独产品线) |

**核心变化**:进化系统从"P5 末尾持续做"变成**贯穿 P0–P5 的独立产品线**,每阶段都有明确交付物。

---

## 15. 验收指标与监控埋点 v2

### 15.1 性能 SLO(同 v1)

详见 v1 §13.1。

### 15.2 质量 SLO(同 v1)

详见 v1 §13.2。

### 15.3 ✦ 进化系统专属 SLO

| 指标 | 当前 | P3 目标 | P5 目标 |
|---|---|---|---|
| **信号采集覆盖率**(任务有信号 / 总任务) | 0% | 60% | 90% |
| **失败聚类准确率**(人工抽检) | — | 80% | 92% |
| **候选首次通过门禁率** | 未追踪 | 30% | 55% |
| **影子双跑稳定性**(候选 vs 基线 RACE 差距 stddev) | — | < 5 分 | < 3 分 |
| **晋升后 7 天回滚率** | 未追踪 | < 10% | < 5% |
| **裁判一致性**(双裁判分差 ≤ 8 的比例) | — | 75% | 88% |
| **anchor drift 拦截率**(候选 driftScore > 30 拦截 / 总候选) | — | 提示即可 | < 8% |
| **用户拒绝建议率** | 未追踪 | < 50% | < 30% |
| **进化建议年化产出**(per assistant) | — | 1-2 次 | 2-4 次 |

### 15.4 ✦ 监控埋点(进化部分)

新增事件:

- `signal.appended`(type, assistantId, version)
- `cluster.detected`(assistantId, cluster, sampleCount)
- `evidence.exported`(assistantId, sampleCount,**脱敏后**)
- `candidate.generated`(assistantId, n=3, modelUsed)
- `evaluation.completed`(candidateId, raceScores, releaseGate)
- `judge.disagreement`(candidateId, sampleId, diff)
- `shadow.started / shadow.failed / shadow.completed`
- `promotion.proposed / promotion.accepted / promotion.rejected`
- `rollback.triggered`(reason, fromVersion, toVersion)
- `anchor.drift_detected`(driftScore, candidate)
- `user.paused_evolution / user.disabled_evolution / user.frozen_version`

### 15.5 ✦ 用户体验 SLO(进化部分)

| 指标 | 目标 |
|---|---|
| 用户对进化建议的"打开率" | > 40% |
| 用户对建议的"采纳率"(打开后) | > 50% |
| 用户对建议的"骚扰反感"(暂停 30 天点击率) | < 15% |
| 「重置到 anchor」使用率 | < 5%(说明 drift 可控) |
| 7 天观察期内一键回滚使用率 | < 10% |

---

## 16. 风险登记 v2

### 16.1 通用风险(同 v1)

详见 v1 §14。

### 16.2 ✦ 进化系统专属风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| LLM 双裁判仍有偏差(同家族不同模型也可能共谋) | 中 | 关键样本人工抽查 + 引入规则裁判作交叉 + 不一致标记 |
| 候选生成 prompt 注入(失败样本中含恶意内容) | 高 | 失败样本入 prompt 前先做安全过滤 + 强约束 anchor |
| 影子双跑用户感知(担心数据外发) | 中 | 设置页极清晰说明 + 默认关闭 + 仅在本地模型时开启 |
| 黄金样本失效(模型升级后规则不适用) | 低 | 黄金样本带 `expectedModelEra`,模型升级后批量重测 |
| 用户撤销信号噪声(可能因为想再修而非反对) | 中 | 撤销 30 秒后的"再写回 / 编辑"也作为信号 |
| 失败聚类把不同问题归到一起 | 中 | 双层聚类(规则 + LLM 标签)+ 人工审核入口 |
| anchor drift 阈值过紧导致永远不能进化 | 中 | drift 30 是初始值,根据实际数据调 |
| 晋升后 7 天观察期跌破阈值,误回滚 | 中 | 回滚需要连续 3 采样点跌破,降低噪声触发 |
| 影子烧 token 超预算 | 中 | 月度配额 + 关键任务禁用 + 用户可关 |
| 政企用户拒绝任何"自动改 prompt" | 高 | 默认全部进化建议为"建议中"角标,完全不主动改 |
| 团队管理员审批延迟阻塞普通用户进化 | 低 | 管理员模板与个人衍生版本解耦,普通用户进化的是衍生版 |
| 信号库膨胀超过 localStorage 上限 | 低 | MAX_SIGNALS_PER_ASSISTANT=1000 + 30 天滚动 + 大数据迁 IndexedDB |

---

## 附录 A:与同类产品对比定位 v2

| 维度 | 察元 v2 | WPS 灵犀 | Office Copilot | 飞书智能伙伴 | Notion AI | Cursor |
|---|---|---|---|---|---|---|
| 部署形态 | WPS 加载项 | WPS 内嵌 | 在线 | 飞书内嵌 | 在线 | 桌面 IDE |
| 离线/内网 | ✅ | ❌ | ❌ | ❌ | ❌ | 部分 |
| 助手数量 | 47(29 + 18 ✦)| ~8 | ~12 | ~10 | ~8 | 自由 |
| 编审/表单/规则 | ✅ | 部分 | 部分 | ❌ | ❌ | ❌ |
| 安全保密 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 任务编排 | ✅ Vue Flow | ❌ | 弱 | 部分 | ❌ | ❌ |
| **助手版本/进化** | **✅ 完整 RACE + 影子 + 锚点 + 灰度** | ❌ | ❌ | ❌ | ❌ | 部分(prompt iteration) |
| 写回方式 | 9 种 + insert-before(P3) | 2-3 | 3-4 | 2-3 | 2-3 | 2-3 |
| 多供应商 | ✅ | 内置一家 | 微软 | 内置 | OpenAI | Anthropic |
| **可解释进化** | ✅ 失败证据时间轴 + 对决面板 | — | — | — | — | — |

**v2 后察元最大的差异化**:**国内唯一具备完整助手进化闭环的 WPS 加载项**。这是相对 LLM API 直接调用的护城河,因为 LLM 不变只换包装的同类产品在助手"用得越久越好用"上没有任何优势。

---

## 附录 B:进化系统数据流全景

```
        ┌─────────────────────┐
        │  用户与助手交互      │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────────────────────────────┐
        │ 5 类信号采集(立即写入 SignalStore,异步)    │
        │  · thumbs(👍/👎)                            │
        │  · accept/reject(写回/30s 内 Undo)           │
        │  · task(成功/失败/降级/超时)                 │
        │  · audit(策略命中)                           │
        │  · golden(黄金样本,手工/导入)               │
        └──────────┬──────────────────────────────────┘
                   │
                   ▼ (每天后台聚类)
        ┌─────────────────────────┐
        │  failureCluster.js      │
        │  ├─ 规则聚类(failureCode)│
        │  └─ LLM 二级标签         │
        └──────────┬──────────────┘
                   │ 失败率 > 阈值
                   ▼
        ┌─────────────────────────┐
        │  candidateGenerator.js  │
        │  生成 N=3 候选           │
        │  约束:anchor + 失败证据  │
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │  evaluator.js + judge.js│
        │  RACE 四维 + 双裁判      │
        │  + 黄金/失败/正向样本    │
        └──────────┬──────────────┘
                   │ 通过门禁?
              YES  ┌──┴──┐  NO
                   ▼     ▼
        ┌──────────┐ ┌─────────────┐
        │ 影子双跑  │ │ 进入"建议中"│
        │ N 天      │ │ 角标,30 天 │
        └──────┬───┘ │ 不再尝试    │
               │     └─────────────┘
               ▼
        ┌─────────────────────────┐
        │  promotionFlow.js       │
        │  对决面板 → 用户确认     │
        │  低风险 1 步 / 高风险双签│
        └──────────┬──────────────┘
                   │ 晋升
                   ▼
        ┌─────────────────────────┐
        │ assistantVersionStore   │
        │ 版本快照 + isPromoted   │
        └──────────┬──────────────┘
                   │ 7 天观察期
                   ▼
        ┌─────────────────────────┐
        │  rollbackMonitor.js     │
        │  连续 3 采样跌破 → 回滚 │
        └─────────────────────────┘
```

---

## 附录 C:核心代码骨架(P3 阶段交付)

### C.1 SignalStore 接口

```js
// src/utils/assistant/evolution/signalStore.js
export function appendSignal(signal): string
export function listSignalsByAssistant(assistantId, days = 30): Signal[]
export function listSignalsByVersion(assistantId, version, days = 30): Signal[]
export function computeFailureRate(assistantId, days = 7): number
export function exportSignals(assistantId): string  // for evidence package
export function clearSignals(assistantId, before?: timestamp): number
```

### C.2 评估器接口

```js
// src/utils/assistant/evolution/evaluator.js
export async function evaluateCandidate(candidate, options): {
  R: number, A: number, C: number, E: number,
  total: number, profile: string,
  releaseGate: { allowed: boolean, reason: string, threshold: ... },
  judgeResults: JudgeResult[],
  sampleResults: SampleResult[],
  driftScore: number,
  recommendedAction: 'publish' | 'shadow' | 'review' | 'revise'
}
```

### C.3 影子运行接口

```js
// src/utils/assistant/evolution/shadowRunner.js
export async function runWithShadow(assistantId, input, options): Result
export function getShadowComparisons(assistantId, since?): ShadowComparison[]
export function setShadowCandidate(assistantId, versionId): void
export function clearShadow(assistantId): void
```

### C.4 进化决策入口

```js
// src/utils/assistant/evolution/promotionFlow.js
export async function maybeProposeEvolution(assistantId): {
  proposed: boolean,
  reason: string,
  candidate?: AssistantVersion,
  evidence?: EvidencePackage,
  evaluation?: EvaluationResult
}
export async function promoteCandidate(versionId, options): AssistantVersion
export async function rollbackToVersion(versionId): AssistantVersion
```

---

## 附录 D:关键术语 v2

(v1 全部保留,新增)

- **RACE 四维**:Reliability / Accuracy / Compliance / Efficiency,助手健康分四维度
- **gateProfile**:助手类别(rewriter/summarizer/json/security/legal/translator/academic/multimodal),用于查 RACE 权重和阈值
- **anchorPrompt**:原始 system prompt + 设计意图,只读,作为 drift 检测基线
- **driftScore**:候选 prompt 与 anchor 的语义距离,> 30 视为 drift
- **影子双跑**(Shadow Run):后台并行运行候选,只对比不展示
- **失败聚类**(Failure Cluster):同类失败样本归组,作为候选生成的证据
- **裁判模型**(Judge Model):评估候选/基线优劣的独立 LLM,与候选模型不同家族
- **rubric**:5 项细则评分(满足度/事实/保留/格式/表达),0-5 分
- **观察期**(Observation Window):晋升后 7 天,任一指标跌破触发自动回滚
- **信号金字塔**:5 类信号优先级(用户接受 > 明示反馈 > 任务结果 > 黄金样本 > dry-run)

---

## 附录 E:决策与变更记录(Changelog)

- **v2.0(2026-04-28)**:
  - 助手进化系统升格为独立产品线(§12 全新)
  - 信号采集层前置到 P0(§13 全新)
  - 路线图重排:进化系统贯穿 P0-P5(§14)
  - 新增进化系统专属 SLO 与监控埋点(§15.3-15.5)
  - 新增进化系统专属风险(§16.2)
  - 18 个新助手与进化系统打通(§11.X)
  - 用户场景 14 → 16 例(§10 新增 10.15/10.16)
  - 设计师视角增加进化 UI(§8.X)
  - UE 视角增加进化交互三原则(§9.X)
  - 与同类产品对比新增"可解释进化"维度(附录 A)

- **v1.0(2026-04-28)**:首次发布,基线计划(见 plan.md)

---

> **致研发**:进化系统的代码不复杂,**复杂的是"什么时候不进化"的产品判断**。落地时如果遇到"这个建议系统是不是给得太频繁"的疑问,优先选保守一档。
>
> **致产品**:进化系统的真实价值,要 3-6 个月后才看得出来。前期不要用"功能数"衡量,要用"用户撤销率""用户拒绝建议率""7 天回滚率"三个数字看健康度。
>
> **致设计**:进化建议的所有界面元素都要遵循「永不打扰」原则。如果某个动效打扰到了用户工作流,无论多炫酷,都要先去掉。

---
