# agent-core（vendor 自 chayuan-office，上游为 genoffice）

本目录是 chayuan-office 仓库 `packages/agent-core` 的**原样拷贝**（含 fork 特有文件
`media-skill.ts`，虽本项目暂不使用，但保持目录级字节一致，方便整目录 diff 同步）。
2026-10-12 起无任何本地补丁：上一轮的「降级模式剥离 tool_calls」补丁已被 fork 以
73ba42bc 原生吸收（含 54 行 vitest）。

- 来源仓库：`/Users/zyh/work/chayuan-office`（其 upstream 指向 `/Users/zyh/work/genoffice`）
- 来源 commit：`f9162fc9`（上游同步 第二十三轮：2490e20d..a08c842f 全吸收，2026-10-10）
- 拷贝日期：2026-10-12（五次审核：覆盖对账/增量审查/API 契约/兼容门禁/测试门禁 全过）
- 上游基线：genoffice `a08c842f`（agent-core 侧最新实质提交 8feee6ae #1882 redact 共享件）
- 挂账：genoffice `ab429d0e`/`b7d1c4d2`（#1915）新增可选模块 `knowledge-base-skill.ts`，
  fork 第二十四轮尚未吸收；chayuan-wps 知识库走 MCP 工具（kb_retrieve）用不到该进程内
  skill，待 fork 吸收后随下一轮同步带入。
- 接入方式：`src/services/mcpBridge/agentCoreTransport.js`（AgentTransport 适配，走 chatApi.js）+
  `agentCoreSkill.js`（AgentSkill 适配，走 MCP 工具目录）+ `mcpChatOrchestrator.js`（AgentLoop 驱动的编排器）

## 同步流程（上游有修复时）

```bash
cd /Users/zyh/work/chayuan-office
git log -1 --format=%H -- packages/agent-core   # 记录新 commit
# 自检：run() 内必须有 beginRun 调用；降级剥离（degraded || degradedProbe ? {} : {toolCalls…}）在位
grep -n "beginRun\|degraded || this.degradedProbe" packages/agent-core/src/loop.ts | head
cp packages/agent-core/src/*.ts /Users/zyh/work/chayuan-wps/src/agent-core/
cd /Users/zyh/work/chayuan-wps
diff -r packages/agent-core/src src/agent-core  # 应只多 README.md
npm run build && npm run test:agent-loop && npm run test:write-lock && npm run verify:task-scope
```

同步后更新本 README 的「来源 commit / 拷贝日期」。当前**无本地补丁**——若未来重放，
必须像 73ba42bc 一样先推进 fork，保持这里的字节一致。

## 与上游 genoffice 的差异（fork 特性，随拷贝带入）

- 降级模式：`parseDegradedToolCalls`/`DegradedFallback`/`degrade()`/`isDegraded`、
  静默两回合探针、降级回合扣留 wire tools、工具结果折叠为 user 消息、
  降级剥离 assistant.tool_calls（73ba42bc）、run 结果带 degraded 标记
- 多模态：`AgentAudio`/`AgentVideo` 类型、run(instruction, images, media)、`media-skill.ts`
- 其余与 genoffice a08c842f 时代字节一致（含 #1882 的 redact-core/redact-range 共享件、
  上游的 coerceArgumentFields 参数整形、每轮流式 2MiB 预算、重试退避期 cancel 收尾）

## 环境适配注意（上游代码在本项目的约束）

- 本项目构建目标 es2018（esbuild 只降语法 `?.`/`??`，不补内置方法）：`loop.ts` 用了
  `Array.prototype.at(-1)`（Chrome 92+ / Safari 15.4+）、`skill.ts` 用了 `flatMap`
  （Chrome 69+ / Safari 12+）、`redact-core.ts`/`sanitizeAgentPayload` 用了 lookbehind
  正则（Chrome 62+ / Safari 16.4+，正则字面量在解析期编译，老 WebView 会在加载时报
  SyntaxError）。Mac WPS 为 CEF/Chromium 内核，均满足；其他内核部署前需实测。
- `electron-transport.ts` 的 `crypto.randomUUID()` 需要安全上下文；本项目未使用该文件，无影响。
- agent-core 无外部运行时依赖（自包含 TS，仅构建工具链），本目录不携带 package.json。
- 上游 eslint/tsc 门禁在本项目不生效（eslint `--ext` 不含 `.ts`），语法问题靠 `npm run build`
  （esbuild）与 `npm run test:agent-loop` 冒烟兜底；上游自身的 vitest（176 用例）可在
  fork 仓库 `packages/agent-core` 内运行。
