# agent-core（vendor 自 genoffice 上游 + 察元降级模式补丁）

本目录 vendored 自 genoffice 上游仓库 `packages/agent-core`，并在其上重放
chayuan-office fork 的「降级模式（no-FC 模型 JSON 文本协议）」增量——
chayuan-wps 桥接层（`mcpChatOrchestrator.js` 的 `loop.degrade()` 强制降级重跑、
`agentCoreSkill.js` 的 `degradedFallback` 协议）依赖该特性，上游原版没有。

- 上游仓库：`/Users/zyh/work/genoffice`（genspark-ai/genoffice）
- 基底 commit：`144b1340`（fix(agent-core): ignore unknown IPC chunk types instead of failing the run (#1831)，2026-10-04）
- 同步日期：2026-10-06
- 中间 fork：`/Users/zyh/work/chayuan-office`（其 packages/agent-core 由上游同步而来；
  **2026-10-06 时点 fork HEAD 的 loop.ts 有合并事故：run() 丢失 `beginRun` 调用导致
  整个循环空转，且降级模式下 assistant 消息未剥离 tool_calls——不要直接从 fork 拷贝**，
  以 genoffice 为基底手工重放降级补丁，见下方差异清单）
- 接入方式：`src/services/mcpBridge/agentCoreTransport.js`（AgentTransport 适配，走 chatApi.js）+
  `agentCoreSkill.js`（AgentSkill 适配，走 MCP 工具目录）+ `mcpChatOrchestrator.js`（AgentLoop 驱动的编排器）

## 与 genoffice 144b1340 的差异（仅 3 个文件，全部为降级模式）

- `loop.ts`：`AgentRunResult.degraded`、`DEGRADE_SILENT_TURNS` + `parseDegradedToolCalls` +
  `extractDegradedJson`、degraded/degradedProbe/probeUsed/silentTurns 字段、`isDegraded`/`degrade()`、
  run() 重置块复位探测、startTurn 降级回合接线（扣留 tools + system 附加协议后缀）、
  finishTurn 降级解析分支 + 静默两回合探针、onDone 带 degraded 标记、
  降级模式下 assistant 消息剥离 tool_calls、工具结果折叠为 user 消息。
- `skill.ts`：`DegradedFallback` 接口、`AgentSkill.degradedFallback?()`、composeSkills 扇出。
- `index.ts`：导出 `DegradedFallback` 类型与 `parseDegradedToolCalls`。
- `electron-transport.ts` / `stream-text.ts` / `types.ts` 与上游字节一致。
- 上游的 media-skill / AgentAudio / AgentVideo（音视频多模态）本项目未使用，未引入。

## 同步流程（上游有修复时）

```bash
cd /Users/zyh/work/genoffice && git pull
git log -1 --format=%H -- packages/agent-core        # 记录新基底 commit
cp packages/agent-core/src/{electron-transport,index,loop,skill,stream-text,types}.ts \
   /Users/zyh/work/chayuan-wps/src/agent-core/       # 只拷这 6 个（无 media-skill）
# 然后按上一节差异清单重放降级补丁（可对照 chayuan-office 历史版本 0416434 的
# src/agent-core/loop.ts，其降级实现最完整：git -C chayuan-wps show 40e4229:src/agent-core/loop.ts）
cd /Users/zyh/work/chayuan-wps
npm run build && npm run test:agent-loop
```

同步后更新本 README 的「基底 commit / 同步日期」。

## 环境适配注意（上游代码在本项目的约束）

- 本项目构建目标 es2018（esbuild 只降语法 `?.`/`??`，不补内置方法）：`loop.ts` 用了
  `Array.prototype.at(-1)`（Chrome 92+ / Safari 15.4+）、`skill.ts` 用了 `flatMap`
  （Chrome 69+ / Safari 12+）。旧版 WPS 内嵌 WebView 若报错，需就地降级这两处
  （降级会破坏与上游的字节一致，同步时注意保留）。2026-09 起的现网拷贝本就未降级。
- `electron-transport.ts` 的 `crypto.randomUUID()` 需要安全上下文；本项目未使用该文件，无影响。
- 上游 eslint/tsc 门禁在本项目不生效（eslint `--ext` 不含 `.ts`），语法问题靠 `npm run build`
  （esbuild）与 `npm run test:agent-loop` 冒烟兜底。
