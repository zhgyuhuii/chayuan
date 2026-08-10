# chayuan-mcp sidecar

本机常驻 MCP Server（Streamable HTTP）+ WPS Agent 长轮询桥。

```bash
# 仓库根目录
npm run mcp:sidecar

# 或
node mcp-sidecar/server.mjs
```

- Listen: `127.0.0.1:62588`
- MCP: `http://127.0.0.1:62588/mcp`（**无需 Token**，仅本机）
- 客户端连接（Claude Code / Codex / Cursor / Hermes / OpenClaw 等）：填入上述 MCP URL 即可；各客户端配置见 [`docs/mcp-connection.md`](../docs/mcp-connection.md) §3。
- Upstream proxy（助手页多 MCP）: `POST /upstream/allowlist|probe|listTools|callTool`（仅 allowlist 内 HTTP URL）
- Agent: `/agent/register` · `/agent/poll` · `/agent/result`

详见 [`docs/mcp-connection.md`](../docs/mcp-connection.md)。
