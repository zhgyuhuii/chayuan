#!/usr/bin/env bash
# Install chayuan-mcp as a LaunchAgent (com.chayuan.mcp).
# 优先用 mcp-sidecar/bin 下的单文件二进制（无需本机 Node）；二进制缺失时回落 node server.mjs。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/com.chayuan.mcp.plist"
DATA_DIR="$HOME/.config/chayuan-wps/mcp"
NODE="$(command -v node || true)"
mkdir -p "$PLIST_DIR" "$DATA_DIR"

# 选当前架构二进制
case "$(uname -m)" in
  arm64|aarch64) BIN_ARCH="arm64" ;;
  x86_64) BIN_ARCH="x64" ;;
  *) BIN_ARCH="$(uname -m)" ;;
esac
BIN_PATH="$ROOT/bin/chayuan-mcp-macos-$BIN_ARCH"

# 优先二进制；缺失则回落 node server.mjs
if [[ -x "$BIN_PATH" ]]; then
  PROG_ARGS="<string>$BIN_PATH</string>"
  echo "[chayuan-mcp] LaunchAgent → native binary: $BIN_PATH" >&2
elif [[ -n "$NODE" && -f "$ROOT/server.mjs" ]]; then
  PROG_ARGS="<string>$NODE</string>
    <string>$ROOT/server.mjs</string>"
  echo "[chayuan-mcp] LaunchAgent → node server.mjs (binary not found at $BIN_PATH)" >&2
else
  echo "[chayuan-mcp] Neither binary nor node available; LaunchAgent not installed." >&2
  exit 0
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.chayuan.mcp</string>
  <key>ProgramArguments</key>
  <array>
    $PROG_ARGS
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CHAYUAN_MCP_DATA_DIR</key>
    <string>$DATA_DIR</string>
  </dict>
  <key>StandardOutPath</key><string>$DATA_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$DATA_DIR/launchd.err.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed: $PLIST"
