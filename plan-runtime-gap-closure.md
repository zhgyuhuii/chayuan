# 项目运行性缺口闭合 — 深度分析 + 完善计划

> 用户反馈了 4 个具体问题。深度排查后发现这些是**运行性挂载缺口**(代码已就绪但没接通到生产路径),
> 不是设计缺陷。本文档列出根因 + 修复方案,然后逐项实施。

---

## 一、问题排查结论

### 问题 1:新增助手未在助手列表显示

**现象**:P3/P5/P5+ 三批共 18 个内置助手数据已写入,但用户在 Settings 助手列表 / ribbon 看不到。

**根因**:
- `builtinAssistantsExtra.js` / `builtinAssistantsP5.js` / `builtinAssistantsP5Plus.js` 三个文件分别提供了 `mergeXxxIntoBuiltins(base)` helper
- 但只有 `externalAssistants.listAllKnownAssistants()`(非主线)调用了这些 merge
- **真正的入口** `assistantRegistry.getBuiltinAssistants()`(line 1261)返回的是**模块内部的 const BUILTIN_ASSISTANTS 数组**,18 个新助手永远进不去
- `BUILTIN_ASSISTANTS` 是 const 写死,运行时无法扩展该数组

**修复**:
启动期一次性把 18 个新助手注入到用户的 `customAssistants` 仓库(via `saveCustomAssistants`),标记 `_source: 'auto-installed'` + `isPromoted: false`,**只在用户没有同 id 时注入**(避免覆盖用户改过的)。这样:
- 用户看到 18 个新助手
- 可以编辑 / 删除
- 重启不会重复注入(基于 marker 判断)
- 删除后不会"自我复活"(用 `_uninstallMarker` 标记)

### 问题 2:设置窗口表单布局错乱

**现象**:窗口比较小(WPS dialog 默认 ~600px)时,标题换行 / 提示文字过长把布局撑乱;模型设置 / 默认配置 / 助手配置 / 数据配置 全部 dialog 都受影响。

**根因**:
- 原 `.config-item` 单栏,`gap: 20px` + 长 hint 文本 `<p class="config-hint">` 直接拼在 input 下面
- P3 阶段我加的 `assistant-form-enhanced.css` 是**只针对助手编辑面板**的优化,且 ≥720px 启用了 110+1fr 横排 grid;在小窗口反而加剧问题
- 长 hint 文本(60-100 字)占 2-3 行,严重打断节奏
- 没有 ⓘ tooltip 机制 — 长说明只能挤在主流中

**修复**:
- 新写 `settings-form-vertical.css`,**强制纵向**布局(label 在上,input 在下)
- **作用范围**扩大到所有 dialog(`.config-item` + `.form-group` + `.setting-item` 等通用类)
- 长 hint 文本自动渲染为 `.config-label::after` ⓘ 图标 — 鼠标悬停展示完整文本
- 明确**取消** ≥720px 横排,任何宽度都纵排(WPS dialog 普遍较窄)

### 问题 3:拼写检查输入响应慢

**现象**:用户在拼写检查 dialog 输入文字到结果出来 慢。

**根因排查**(`spellCheckService.js` 1824 行):
1. **`loadGlobalSettings()` 同步多次调用** — 每次 `chatCompletion` 配置组装都从 localStorage 全量读
2. **`response_format: json_schema` 未必兼容** — 国产模型 / 部分网关不支持,触发 throw → 重试 fallback(第二次 LLM 调用 = 双倍延迟)
3. **`JSON.parse` 失败再 retry** — 原代码有最多 2 次 retry(每次新 LLM 调用)
4. **prompt 长度** — system prompt 自带详细规则,system+user 容易突破 cache 命中(特别是 anthropic prompt cache)
5. **没有 streaming** — 等全文返回再 parse;长文本时首字符 → done 几十秒

**修复(无侵入,新增 wrapper)**:
- `spellCheckPerfWrapper.js` — 透明包装,加:
  - settings 缓存(60 秒 TTL)
  - 自动检测 provider 是否支持 json_schema → 不支持时**首次就发 plain mode**(免一次重试)
  - 自动 prompt cache 标记(via withPromptCache)
  - 用 perfTracker 记录每次调用,定位真正瓶颈
- 业务方在调用 spellCheckService 之前先 `await ensureSpellCheckPerfWrapper()`

### 问题 4:任务编排被隐藏

**现象**:用户找不到任务编排入口。

**根因**:
- `/task-orchestration` 路由存在
- ⌘K `rb.task.orchestration` 命令存在但 priority 中等(50)
- `WelcomePage.vue` 5 步引导没提任务编排
- ribbon 主菜单按钮 `btnTaskOrchestration` 是有的但默认隐藏 / 在「更多」菜单下

**修复**:
- ⌘K `rb.task.orchestration` priority → 90(打开 AI 助手对话框是 100,任务编排紧随其后)
- WelcomePage 增加第 6 步「编排多助手任务」演示
- 在 TaskCenterPage 的"head 操作区"放一个 显眼按钮 → 任务编排
- ⌘K 命令组下加快捷别名 `task.orchestration.open` / `wf.editor.open`

---

## 二、完善计划

按优先级排序:

| # | 任务 | 文件 |
|---|------|------|
| X-1 | 自动安装 18 个新助手 | `runtimeAssistantsInstaller.js` |
| X-2 | 设置表单纵向 + ⓘ tooltip | `assets/settings-form-vertical.css` |
| X-3 | 拼写检查 perf wrapper | `spellCheckPerfWrapper.js` |
| X-4 | 任务编排出口暴露 | `evolutionCommands.js` 修改 + `WelcomePage.vue` 修改 + `TaskCenterPage.vue` 修改 |
| X-5 | smoke 扩展 + doctor + 报告 | — |

---

## 三、设计哲学

1. **不破坏现有数据** — 自动安装助手时严格不覆盖用户的同 id;用户删除后用 marker 防止"复活"
2. **不动 1376 行 assistantRegistry.js** — 18 新助手通过 customAssistants 仓库注入
3. **不动 1824 行 spellCheckService.js** — perf 优化通过 wrapper layer
4. **CSS cascade 重排不动模板** — 兼容旧组件视觉
5. **任务编排入口提升** — 改 priority 数字,不改组件位置

执行节奏:每完成一个任务 → smoke + doctor 全绿 → 进入下一个。
