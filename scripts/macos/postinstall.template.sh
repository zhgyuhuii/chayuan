#!/bin/bash
# Installs Chayuan WPS add-in into the console user's jsaddons (no manual copy).
set -e
INSTALL_ROOT="__INSTALL_ROOT__"
META="$INSTALL_ROOT/install.json"
if [[ ! -f "$META" ]]; then
	echo "Chayuan WPS: missing $META" >&2
	exit 1
fi
# 用 sed 解析 addonFolder，避免依赖 python3（未装 Command Line Tools 的 Mac 没有 /usr/bin/python3）
ADDON_FOLDER="$(/usr/bin/sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | tail -1)"
if [[ -z "$ADDON_FOLDER" ]]; then
	echo "Chayuan WPS: cannot read addonFolder from $META" >&2
	exit 1
fi

CONSOLE_USER="$(/usr/bin/stat -f '%Su' /dev/console 2>/dev/null || true)"
if [[ -z "$CONSOLE_USER" || "$CONSOLE_USER" == "root" ]]; then
	CONSOLE_USER="${SUDO_USER:-}"
fi
if [[ -z "$CONSOLE_USER" || "$CONSOLE_USER" == "root" ]]; then
	echo "Chayuan WPS: could not detect the desktop user. Files remain under $INSTALL_ROOT — open WPS once, then run the installer again, or copy that folder into WPS jsaddons." >&2
	exit 0
fi

USER_HOME="$(/usr/bin/dscl . -read "/Users/$CONSOLE_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')"
if [[ -z "$USER_HOME" || ! -d "$USER_HOME" ]]; then
	USER_HOME="/Users/$CONSOLE_USER"
fi

install_one() {
	local dest="$1"
	[[ -z "$dest" ]] && return 0
	/bin/mkdir -p "$dest"
	/bin/cp -R "$INSTALL_ROOT/$ADDON_FOLDER" "$dest/"
	/bin/cp -f "$INSTALL_ROOT/publish.xml" "$dest/"
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$dest/$ADDON_FOLDER" "$dest/publish.xml" 2>/dev/null || true
	echo "Chayuan WPS: installed to $dest"
}

# Sandboxed WPS for Mac (common)
install_one "$USER_HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
# Non-sandbox / older layouts (best-effort)
install_one "$USER_HOME/Library/Application Support/Kingsoft/wps/jsaddons"

# Phase 2+: stage MCP sidecar + LaunchAgent (best-effort)
MCP_SRC="$INSTALL_ROOT/$ADDON_FOLDER/mcp-sidecar"
if [[ -d "$MCP_SRC" ]]; then
	MCP_HOME="$USER_HOME/.config/chayuan-wps/mcp"
	/bin/mkdir -p "$MCP_HOME/runtime"
	/bin/cp -R "$MCP_SRC/." "$MCP_HOME/runtime/"
	# 确保 sidecar 单文件二进制可执行（cp 可能丢位）
	if [[ -d "$MCP_HOME/runtime/bin" ]]; then
		/bin/chmod +x "$MCP_HOME/runtime/bin/"* 2>/dev/null || true
	fi
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$MCP_HOME" 2>/dev/null || true
	if [[ -x "$MCP_HOME/runtime/autostart/install-macos-launchagent.sh" ]]; then
		/usr/bin/su - "$CONSOLE_USER" -c "bash $MCP_HOME/runtime/autostart/install-macos-launchagent.sh" 2>/dev/null \
			|| echo "Chayuan WPS: MCP LaunchAgent skipped — run $MCP_HOME/runtime/autostart/install-macos-launchagent.sh" >&2
	fi
	echo "Chayuan WPS: MCP sidecar staged at $MCP_HOME/runtime (URL http://127.0.0.1:62588/mcp)"
fi

exit 0
