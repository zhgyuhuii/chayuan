# agent-core（vendor 自 chayuan-office，上游为 genoffice）

本目录是 chayuan-office 仓库 `packages/agent-core` 的**原样拷贝**（含 fork 特有文件
`media-skill.ts`，虽本项目暂不使用，但保持目录级字节一致，方便整目录 diff 同步），
外加**一个**察元本地补丁（见下）。

- 来源仓库：`/Users/zyh/work/chayuan-office`（其 upstream 指向 `/Users/zyh/work/genoffice`）
- 来源 commit：`764fa206`（fix(第二十轮收口)：run() 断链修复 + 上游差异全量对账补漏，2026-10-06）
- 拷贝日期：2026-10-07
- 上游基线：genoffice `144b1340`（fix(agent-core): ignore unknown IPC chunk types (#1831)，2026-10-04）
- 接入方式：`src/services/mcpBridge/agentCoreTransport.js`（AgentTransport 适配，走 chatApi.js）+
  `agentCoreSkill.js`（AgentSkill 适配，走 MCP 工具目录）+ `mcpChatOrchestrator.js`（AgentLoop 驱动的编排器）

## 唯一本地补丁（与 fork 的差异，同步时注意保留）

`loop.ts` finishTurn 的 assistant 消息落库处：降级模式（`degraded || degradedProbe`）
必须把 `toolCalls` 挡在 assistant 消息之外（FC 路径保持原样，含 signature 透传）。
原因：no-FC 模型 API 既拒绝 assistant.tool_calls，也拒绝「有 tool_calls 却无后续
role:'tool' 消息」的转录——fork 把结果折叠成 user 消息后配不上对，降级多轮第二轮必 400。
fork 764fa206 修好了 run() 断链但漏了这处（其 16372 测试未覆盖降级多轮）。

## 同步流程（上游有修复时）

```bash
cd /Users/zyh/work/chayuan-office
git log -1 --format=%H -- packages/agent-core   # 记录新 commit；确认 run() 内有 beginRun 调用
cp packages/agent-core/src/*.ts /Users/zyh/work/chayuan-wps/src/agent-core/
cd /Users/zyh/work/chayuan-wps
# 重放「唯一本地补丁」（对照本节说明）
diff -r packages/agent-core/src src/agent-core  # 应只多 README.md 与上述补丁
npm run build && npm run test:agent-loop
```

同步后更新本 README 的「来源 commit / 拷贝日期」。

## 与上游 genoffice 的差异（fork 特性，随拷贝带入）

- 降级模式：`parseDegradedToolCalls`/`DegradedFallback`/`degrade()`/`isDegraded`、
  静默两回合探针、降级回合扣留 wire tools、工具结果折叠为 user 消息、run 结果带 degraded 标记
- 多模态：`AgentAudio`/`AgentVideo` 类型、run(instruction, images, media)、`media-skill.ts`
- 其余与 genoffice 144b1340 字节一致

## 环境适配注意（上游代码在本项目的约束）

- 本项目构建目标 es2018（esbuild 只降语法 `?.`/`??`，不补内置方法）：`loop.ts` 用了
  `Array.prototype.at(-1)`（Chrome 92+ / Safari 15.4+）、`skill.ts` 用了 `flatMap`
  （Chrome 69+ / Safari 12+）。旧版 WPS 内嵌 WebView 若报错，需就地降级这两处
  （降级会破坏与上游的字节一致，同步时注意保留）。2026-09 起的现网拷贝本就未降级。
- `electron-transport.ts` 的 `crypto.randomUUID()` 需要安全上下文；本项目未使用该文件，无影响。
- agent-core 无外部运行时依赖（自包含 TS，仅构建工具链），本目录不携带 package.json。
- 上游 eslint/tsc 门禁在本项目不生效（eslint `--ext` 不含 `.ts`），语法问题靠 `npm run build`
  （esbuild）与 `npm run test:agent-loop` 冒烟兜底。
