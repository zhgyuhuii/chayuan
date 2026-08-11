#!/usr/bin/env bash
# ensure-mcp.sh —— wps-skill-chayuan 的 MCP 健康自检与修复指路
# 用法：bash scripts/ensure-mcp.sh
# 被 SKILL.md 在 healthz 失败时调用。
set -euo pipefail

MCP_URL="http://127.0.0.1:62588/mcp"
HEALTHZ="http://127.0.0.1:62588/healthz"

# 定位仓库根（向上找 scripts/install-wps-skill-chayuan.sh）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO=""
d="$SCRIPT_DIR"
for _ in 1 2 3 4 5 6; do
  if [[ -f "$d/scripts/install-wps-skill-chayuan.sh" ]]; then REPO="$d"; break; fi
  d="$(dirname "$d")"
done

echo "[ensure-mcp] 探活 $HEALTHZ ..."
if RESP="$(curl -fsS --max-time 3 "$HEALTHZ" 2>/dev/null)"; then
  echo "[ensure-mcp] ✓ MCP 在线："
  echo "$RESP"
  # agent 在线性
  if echo "$RESP" | grep -q '"agentOnline":true'; then
    echo "[ensure-mcp] ✓ Agent 在线，可直接校对。"
  else
    echo "[ensure-mcp] ⚠ Agent 未上线（agentOnline:false）。请打开 WPS 文字并确认察元加载项可见，再重试。"
  fi
  exit 0
fi

echo "[ensure-mcp] ✗ MCP 未响应。诊断："
echo "  1) 自启是否注册："
case "$(uname -s)" in
  Darwin)
    launchctl list 2>/dev/null | grep -q com.chayuan.mcp && echo "     ✓ LaunchAgent 已注册" || echo "     ✗ LaunchAgent 未注册"
    echo "     日志：~/.config/chayuan-wps/mcp/launchd.{out,err}.log"
    ;;
  Linux)
    systemctl --user is-active chayuan-mcp.service 2>/dev/null || echo "     ✗ systemd --user 服务未运行"
    ;;
esac
echo "  2) 端口：lsof -nP -iTCP:62588 -sTCP:LISTEN"
echo "  3) 二进制：mcp-sidecar/bin/chayuan-mcp-<os>-<arch>"

if [[ -n "$REPO" ]]; then
  echo ""
  echo "[ensure-mcp] 修复：重装 MCP 自启（不影响文档）"
  echo "  bash \"$REPO/scripts/install-wps-skill-chayuan.sh\" --runtime-only"
else
  echo "[ensure-mcp] 未定位到仓库根；请到 chayuan-wps 仓库跑：bash scripts/install-wps-skill-chayuan.sh --runtime-only"
fi
exit 1
