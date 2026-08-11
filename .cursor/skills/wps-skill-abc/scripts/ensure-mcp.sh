#!/usr/bin/env bash
# Ensure Cursor project MCP points at Chayuan WPS MCP and print healthz.
set -euo pipefail

MCP_NAME="chayuan-wps-mcp"
MCP_URL="http://127.0.0.1:62588/mcp"
HEALTH_URL="http://127.0.0.1:62588/healthz"

ROOT="${CURSOR_PROJECT_DIR:-}"
if [[ -z "$ROOT" ]]; then
  # Walk up from cwd for .git or .cursor
  ROOT="$(pwd)"
  while [[ "$ROOT" != "/" ]]; do
    if [[ -d "$ROOT/.git" || -d "$ROOT/.cursor" ]]; then
      break
    fi
    ROOT="$(dirname "$ROOT")"
  done
fi

CURSOR_DIR="$ROOT/.cursor"
MCP_JSON="$CURSOR_DIR/mcp.json"

mkdir -p "$CURSOR_DIR"

python3 - "$MCP_JSON" "$MCP_NAME" "$MCP_URL" <<'PY'
import json, sys, pathlib
path = pathlib.Path(sys.argv[1])
name = sys.argv[2]
url = sys.argv[3]
data = {}
if path.is_file():
    try:
        data = json.loads(path.read_text(encoding="utf-8") or "{}")
    except json.JSONDecodeError:
        data = {}
servers = data.get("mcpServers")
if not isinstance(servers, dict):
    servers = {}
servers[name] = {"url": url}
data["mcpServers"] = servers
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"wrote {path}")
print(json.dumps(servers[name], ensure_ascii=False))
PY

echo "--- healthz ---"
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 3 "$HEALTH_URL"; then
    echo
    echo "OK: MCP sidecar reachable. Open WPS + Chayuan add-in, then refresh Cursor MCP."
  else
    echo
    echo "FAIL: $HEALTH_URL unreachable."
    echo "Install Chayuan WPS add-in, open WPS, start MCP in Settings → MCP."
    echo "Downloads: https://aidooo.com | https://github.com/zhgyuhuii/chayuan-wps-releases"
    exit 2
  fi
else
  echo "curl not found; skip health check. Configure MCP URL: $MCP_URL"
fi
