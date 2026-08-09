#!/usr/bin/env bash
# Install chayuan-mcp as a LaunchAgent (Phase 2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/com.chayuan.mcp.plist"
DATA_DIR="$HOME/.config/chayuan-wps/mcp"
NODE="$(command -v node)"
mkdir -p "$PLIST_DIR" "$DATA_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.chayuan.mcp</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$ROOT/server.mjs</string>
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
