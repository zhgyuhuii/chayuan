# agent-core（vendor 自上游 genoffice）

本目录是 genoffice 仓库 `packages/agent-core` 的**原样拷贝**（字节级一致，含上游
自带 vitest 测试）。2026-11-19 起无任何本地补丁；本次同步为**直接从 genoffice 上游**
取快照（不再绕 chayuan-office fork 中转），fork 特有的降级模式与多模态媒体技能随
上游演进一同退役（见下「挂账」）。

- 来源仓库：`/Users/zyh/work/genoffice`（genspark-ai/genoffice）
- 来源 commit：`6b43f81b`（fix(pdf): lay a right-to-left insert out in visual order #2832）
- 同步日期：2026-11-19
- 上游基线内容：agent-core 15 源文件 4227 行 + 17 测试文件 5465 行。三大新机制：
  token usage 计量（AgentTokenUsage/onUsage）、冗余读守卫（重复读熔断）、
  stale-context 折叠（prompt cache 友好，CACHE_WARM_MS 门控）；7 个新模块：
  attached-skills / attachments-skill / cli-skill / create-document-skill /
  imported-skill / knowledge-base-skill / mind-map（全部零外部依赖，仅包内互引）
- 接入方式：`src/services/mcpBridge/agentCoreTransport.js`（AgentTransport 适配，走 chatApi.js）+
  `agentCoreSkill.js`（AgentSkill 适配，走 MCP 工具目录）+ `mcpChatOrchestrator.js`（AgentLoop 驱动的编排器）

## 挂账（fork 特性移交）

fork（chayuan-office）曾有的两类特性在上游 genoffice 中不存在，本次同步**跟随上游删除**，
源码由 chayuan-office 仓库继续保存（基线 f9162fc9）：

- 降级模式（无 function-calling 模型的 JSON 文本协议）：`parseDegradedToolCalls`/
  `DegradedFallback`/`degrade()`。本项目消费方已适配：`mcpChatOrchestrator.js` 不再
  降级重跑，`isToolsUnsupportedError` 命中即在 `localizeLoopError` 转为「更换模型」
  引导文案；冒烟测试 S4 改为断言终态报错。
- 多模态：`AgentAudio`/`AgentVideo` 类型、`run(instruction, images, media)` 的 media
  参数、`media-skill.ts`（本项目从未使用；生图走 agentCoreSkill 三级 Tier）。
  `run()` 签名随之缩为 `run(instruction, images?)`。

## 同步流程（上游有修复时）

```bash
UP=/Users/zyh/work/genoffice/packages/agent-core
git -C /Users/zyh/work/genoffice log -1 --format=%H   # 记录新 commit
cp "$UP"/src/*.ts src/agent-core/ && cp -R "$UP"/tests src/agent-core/tests
diff -r "$UP"/src src/agent-core --exclude=README.md --exclude=tests   # 应无输出
diff -r "$UP"/tests src/agent-core/tests                              # 应无输出
npm run test:agent-core && npm run test:agent-loop && npm run build
```

同步后更新本 README 的「来源 commit / 同步日期」。当前**无本地补丁**——若未来需要
本地改动，优先推上游 PR，保持字节级一致的可同步性。

## 环境适配注意（上游代码在本项目的约束）

- 本项目构建目标 es2018（esbuild 只降语法 `?.`/`??`，不补内置方法）：`loop.ts` 用了
  `Array.prototype.at(-1)`（Chrome 92+ / Safari 15.4+）、`skill.ts` 用了 `flatMap`
  （Chrome 69+ / Safari 12+）、`redact-core.ts`/`sanitizeAgentPayload` 用了 lookbehind
  正则（Chrome 62+ / Safari 16.4+，正则字面量在解析期编译，老 WebView 会在加载时报
  SyntaxError）。Mac WPS 为 CEF/Chromium 内核，均满足；其他内核部署前需实测。
  （2026-11-19 复核：上游新版未引入新语法类别，仅行号变化。）
- `electron-transport.ts` 的 `crypto.randomUUID()` 需要安全上下文；本项目未使用该文件，无影响。
- agent-core 无外部运行时依赖（自包含 TS，仅构建工具链），本目录不携带 package.json。
- 上游 eslint/tsc 门禁在本项目不生效；上游自带 vitest 已随 tests/ 带入，经根目录
  `npm run test:agent-core` 运行（vitest 以 devDependency 安装）。
