# agent-core（vendor 自 chayuan-office）

本目录是 chayuan-office 仓库 `packages/agent-core` 的**原样拷贝**（含 `electron-transport.ts`，虽在本项目暂不使用，但保持目录级字节一致，方便整目录 diff 同步）。

- 来源仓库：`/Users/zyh/work/chayuan-office`（git@same-owner）
- 来源 commit：`0416434`（fix(agent-core): 静态降级模式解析并执行 JSON 伪工具调用）
- 拷贝日期：2026-09-08
- 接入方式：`src/services/mcpBridge/agentCoreTransport.js`（AgentTransport 适配，走 chatApi.js）+ `agentCoreSkill.js`（AgentSkill 适配，走 MCP 工具目录）+ `mcpChatOrchestrator.js`（AgentLoop 驱动的编排器）

## 同步流程（上游有修复时）

```bash
cd /Users/zyh/work/chayuan-office
git log -1 --format=%H -- packages/agent-core   # 记录新 commit
cp packages/agent-core/src/*.ts /Users/zyh/work/chayuan-wps/src/agent-core/
cd /Users/zyh/work/chayuan-wps
diff -r <(cd /Users/zyh/work/chayuan-office/packages/agent-core/src && ls) src/agent-core  # 应只多 README.md
npm run build && node scripts/test-agent-loop-smoke.mjs
```

同步后更新本 README 的「来源 commit / 拷贝日期」。

## 环境适配注意（上游代码在本项目的约束）

- 本项目构建目标 `es2015`（vite `build.target: 'es2018'`），esbuild 只降**语法**（`?.`/`??`），不补**内置方法**：`loop.ts` 用了一处 `Array.prototype.at(-1)`（Chrome 92+）、`skill.ts` 用了 `flatMap`（Chrome 69+）。WPS 内嵌 WebView 过旧时需就地降级这两处（降级会破坏字节一致，同步时注意保留）。
- `electron-transport.ts` 的 `crypto.randomUUID()` 需要安全上下文；本项目未使用该文件，无影响。
- 上游 eslint/tsc 门禁在本项目不生效（eslint `--ext` 不含 `.ts`），语法问题靠 `npm run build`（esbuild）与冒烟脚本兜底。
