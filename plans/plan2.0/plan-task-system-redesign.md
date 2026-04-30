# 任务系统(进度 / 列表 / 详情 / 提示 / 性能 / 体验 / 趣味性)综合分析与重设计

> 多角度审视项目里的"任务"这个核心对象,给出可落地的重设计方案。不重写既有 taskListStore,
> 全部以 wrapper / layer / 新组件形式交付,渐进迁移。

---

## 0. 核心观察

任务(Task)是本项目最高频的用户对象 — 用户每发起一次助手调用、每跑一次工作流、每做一次拼写检查,都生成 1 个 task 记录。但当前任务系统是**功能堆叠出来的**,缺统一抽象。

| 现有资源 | 状态 |
|----------|------|
| `taskListStore.js`(11 个函数) | 基础 CRUD + subscribe |
| `assistantTaskRunner.js`(2580 行) | 助手任务运行 |
| `multimodalTaskRunner.js` | 图像/音频/视频 |
| `spellCheckTaskBridge.js` | 拼写检查桥 |
| `workflowRunner.js` | 工作流运行 |
| `taskListWindowManager.js` / `taskProgressWindowManager.js` / `taskOrchestrationWindowManager.js` | 3 个独立窗口管理器 |
| `Popup.vue`(5912 行) | 任务列表 UI |

5 类 task runner + 3 个 window manager + 5912 行 UI = **碎片化严重**。

---

## 1. 架构师视角

### 问题
1. **没有统一的 Task 抽象** — `assistantTask.kind` / `workflowTask.kind` / `spellCheckTask.kind` 各自定义 status 集合,合并展示需要每处特例
2. **状态机不一致** — 有 `pending / running / completed`,有 `pending / running / done`,有 `idle / running / finished / failed`
3. **进度更新机制散乱** — assistantRunner 用 `updateTask({ progress })`、workflowRunner 写 BroadcastChannel、spellCheck 用全局事件
4. **无统一 ID 命名规则** — `task_xxx` / `assistantTask_yyy` / `wf_zzz`,无法 by-prefix 聚类
5. **取消 / 暂停 / 重试 API 不对齐** — `stopAssistantTask` / `stopWorkflowRun` / 拼写无暂停

### 建议
- 写 `taskKernel.js` — 通用 Task 抽象,定义统一状态机、进度模型、cancel/pause/retry 接口
- 现有 runner 通过 `taskKernel.adapt(runner)` 接入,改动最小
- 新 task 类型(以后加)直接基于 kernel,自动符合规范

---

## 2. WPS 加载项特性

### 问题
1. **多窗口任务可见性** — 用户在 dialog 启动任务,关 dialog 后回任务窗格,看不到正在跑
2. **文档全局并发写冲突** — 2 个任务同时往同一段写,后者覆盖前者
3. **WPS COM API 单线程** — 多任务挤压时 UI 卡顿
4. **任务很长** — 长文档分段写回 N 段,中途切换 doc 状态错乱
5. **重启可恢复** — 任务跑到一半 WPS 崩溃,无线索

### 建议
- 复用 W1 已有的 `workflowProgressChannel` 模式 — 写 `taskEventBus.js`,跨窗口任务事件
- 接入 W3+P6 的 `opQueue`(leader 序列化)+ `undoChainBundle`(写回失败一键撤回)
- 接入 W1 已有的 `workflowInstanceStore` 机制 — 长任务持久化每节点 done 后

---

## 3. UE 角度

### 问题
1. **任务进度可见性差** — 启动后没有 toast / floating 提示,用户找不到入口
2. **关键节点无反馈** — 任务完成是否成功,默默地修改了文档,用户得自己翻
3. **取消任务难** — 找不到"全部停止"按钮
4. **失败提示技术化** — "ENOTFOUND chatgpt.com" 用户看不懂
5. **多任务时混乱** — 助手 A + 助手 B + 工作流 C 并发,列表里乱
6. **任务详情打开慢** — 大量 metadata 一次性渲染

### 建议
- 任务启动 → 自动 toast(已开始)→ 任务完成 → toast(已完成,1 秒微动效)
- 失败提示分两层:**用户层文案**("网络异常,请检查 API 配置") + 详情技术错误折叠
- "全部任务"⌘K 命令面板,快速暂停 / 取消 / 重试
- TaskListVirtual 虚拟滚动:100+ 任务也丝滑

---

## 4. 高级设计师角度

### 问题
1. **任务列表 UI 信息密度不平衡** — 某些字段占太多空间,关键信息埋在底部
2. **状态色板单调** — running/done/failed 用相近紫色调,辨识度低
3. **缺少趣味性微动效** — 任务完成"啪"一下消失,无完成感
4. **历史任务没归档分组** — 1000 条任务平铺,无法按"今天/本周/本月"
5. **任务图标体系不统一** — emoji + svg + 文字符号混搭
6. **任务详情卡片排版乱** — 文字宽度过长(>80 字符 难读)

### 建议
- 6 状态独立色板:**pending=灰 / queued=琥珀 / running=紫(微光晕)/ paused=橙 / done=青釉(完成扫光)/ failed=朱砂**
- 完成动效:`chy-finish-sweep`(P2 已有 motion.css)
- 历史任务按"今天/本周/本月/更早"分组(类似 macOS Finder 时间分组)
- 任务详情:max-width 720px,行长 ≤ 65 中文字符

---

## 5. 用户角度

### 问题
1. **想"再次执行"** — 不知道哪些任务可重跑
2. **想看 token 成本** — 一次任务花了多少钱?当前 perfTracker 记延迟不记 token
3. **想看启动时间 / 谁启动** — 元数据缺失
4. **想批量删除老任务** — 无批量操作
5. **想从历史任务复制结果到当前文档** — 没"重新写回"按钮
6. **想标星重要任务** — 没收藏机制
7. **想分类查看(我的 / 自动 / 失败)** — 无 filter

### 建议
- 任务卡片右上角加 ☆ 收藏 + 🔁 重跑(条件可重跑时启用)
- TaskFilters:All / Starred / Failed / Auto / 助手 / 工作流 — 顶部 chip
- TaskBatchActions:多选 → 删除 / 归档 / 导出 JSON
- 任务详情底部加"复制为 Markdown" / "重新写回" 按钮

---

## 6. 性能

### 问题
1. **任务列表全量渲染** — 100+ 卡顿
2. **每次进度更新触发列表整体重渲染** — Vue reactive 大对象开销
3. **localStorage 任务数据爆炸** — 5MB 上限
4. **任务详情每次重新计算 metadata** — 无缓存

### 建议
- TaskListVirtual:虚拟滚动,只渲染 viewport ~30 项
- 进度更新走"切片更新"(只改 progress 字段,不替换整个 task)
- 老任务走 IndexedDB / OPFS(P6 已有 opfsStorage),localStorage 只放最近 50 条
- 详情 metadata 用 `markRaw` 避免 reactive 转换

---

## 7. 趣味性

### 问题
1. **任务完成无庆祝** — Linear 风格的 sweep 扫光被 P2 motion 已写好但未用上
2. **空状态无彩蛋**
3. **里程碑无成就** — 第 100 / 1000 次任务无标记
4. **进度条单一** — 直线条,无创意形态(脉冲 / 旋转 / 流动)
5. **任务历史无"时间胶囊"** — 一年回顾用户做了什么

### 建议
- `TaskCelebration.vue` — 完成时浮起小动效(+1 任务徽章)
- `taskAchievement.js` — 累计 10/100/1000 次解锁不同徽章(青铜/银/金)
- 成就解锁 toast 一次性大动效(`chy-promote-glow`)
- 第一次执行某类型助手时弹小提示("你刚完成第一次 X")

---

## 综合建议:实施计划 P-T1 ~ P-T10

### Tier 1 · 必须做(架构基础)
| # | 任务 | 文件 |
|---|------|------|
| T-1.1 | 统一任务内核 | `task/taskKernel.js` |
| T-1.2 | 任务事件总线 | `task/taskEventBus.js` |
| T-1.3 | 任务进度持久化 layer | `task/taskPersistLayer.js` |

### Tier 2 · UE / 体验
| # | 任务 | 文件 |
|---|------|------|
| T-2.1 | 任务完成庆祝 | `common/TaskCelebration.vue` |
| T-2.2 | 任务过滤栏 | `common/TaskFilters.vue` |
| T-2.3 | 任务详情卡 | `common/TaskDetailCard.vue` |
| T-2.4 | 任务批量操作 | `common/TaskBatchActions.vue` |

### Tier 3 · 性能
| # | 任务 | 文件 |
|---|------|------|
| T-3.1 | 虚拟滚动任务列表 | `common/TaskListVirtual.vue` |
| T-3.2 | 任务存储分层(LRU + IDB) | `task/taskTieredStorage.js` |

### Tier 4 · 趣味性 / 成就
| # | 任务 | 文件 |
|---|------|------|
| T-4.1 | 成就系统 | `task/taskAchievement.js` |
| T-4.2 | 任务"时间胶囊"年度回顾 | `task/taskTimeCapsule.js` |

### Tier 5 · 集成入口
| # | 任务 | 文件 |
|---|------|------|
| T-5.1 | 任务中心新页 | `TaskCenterPage.vue` + 路由 `/task-center` |
| T-5.2 | ⌘K 任务命令 | `router/taskCommands.js` |

### Tier 6 · 验证
| # | 任务 | 文件 |
|---|------|------|
| T-6.1 | smoke 扩展 + doctor + 报告 | — |

---

## 设计哲学(贯穿)

1. **统一抽象,渐进迁移** — kernel 是兼容层,旧 store 不动
2. **事件驱动,UI 订阅** — 不再每个组件直接 read store
3. **观测即一等公民** — 每个任务事件自动写 perfTracker / signalStore
4. **趣味性克制** — 庆祝动效 < 800ms,不打断主流程
5. **可达性** — 所有任务操作均有 ⌘K 入口,焦点 trap 完备
6. **零回归** — 所有新文件 opt-in,不动现有 runner / Popup
7. **性能优先于功能** — 100+ 任务流畅 > 加 5 个新功能

---

## 执行节奏

每完成一个 Tier 后 `npm run test:evolution` + `npm run doctor:quick` 全绿。
全部交付后,提供完整执行报告 `plan-task-system-redesign-execution.md`。
