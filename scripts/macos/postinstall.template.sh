#!/bin/bash
# Installs Chayuan WPS add-in into the console user's jsaddons (no manual copy).
# NOTE: avoid bare `set -e` around large copies into WPS Containers — EINTR
# ("Interrupted system call") is common when WPS holds addon files open and must not
# abort the whole .pkg install (Installer error 112).
set -u
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

# Robust copy: ditto preferred; retry on EINTR / transient sandbox locks (WPS open).
copy_tree() {
	local src="$1"
	local dest="$2"
	local attempt=1
	local err=""
	while [[ "$attempt" -le 5 ]]; do
		err=""
		if [[ -x /usr/bin/ditto ]]; then
			if /usr/bin/ditto "$src" "$dest" 2>/tmp/chayuan-postinstall-cp.err; then
				return 0
			fi
			err="$(cat /tmp/chayuan-postinstall-cp.err 2>/dev/null || true)"
		else
			if /bin/cp -R "$src" "$dest" 2>/tmp/chayuan-postinstall-cp.err; then
				return 0
			fi
			err="$(cat /tmp/chayuan-postinstall-cp.err 2>/dev/null || true)"
		fi
		echo "Chayuan WPS: copy attempt $attempt failed ($src -> $dest): $err" >&2
		attempt=$((attempt + 1))
		/bin/sleep 1
	done
	return 1
}

install_one() {
	local dest="$1"
	[[ -z "$dest" ]] && return 0
	/bin/mkdir -p "$dest" || return 1
	# Replace previous version directory atomically-ish: copy to temp then mv
	local staging_dest="$dest/.${ADDON_FOLDER}.installing"
	/bin/rm -rf "$staging_dest" 2>/dev/null || true
	if ! copy_tree "$INSTALL_ROOT/$ADDON_FOLDER" "$staging_dest"; then
		/bin/rm -rf "$staging_dest" 2>/dev/null || true
		return 1
	fi
	/bin/rm -rf "$dest/$ADDON_FOLDER" 2>/dev/null || true
	if ! /bin/mv "$staging_dest" "$dest/$ADDON_FOLDER" 2>/tmp/chayuan-postinstall-mv.err; then
		# Fallback: copy over existing tree if rename blocked
		if ! copy_tree "$INSTALL_ROOT/$ADDON_FOLDER" "$dest/$ADDON_FOLDER"; then
			/bin/rm -rf "$staging_dest" 2>/dev/null || true
			return 1
		fi
		/bin/rm -rf "$staging_dest" 2>/dev/null || true
	fi
	/bin/cp -f "$INSTALL_ROOT/publish.xml" "$dest/publish.xml" 2>/dev/null || true
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$dest/$ADDON_FOLDER" "$dest/publish.xml" 2>/dev/null || true
	echo "Chayuan WPS: installed to $dest"
	return 0
}

INSTALLED=0
# Sandboxed WPS for Mac (common)
if install_one "$USER_HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"; then
	INSTALLED=1
fi
# Non-sandbox / older layouts (best-effort)
if install_one "$USER_HOME/Library/Application Support/Kingsoft/wps/jsaddons"; then
	INSTALLED=1
fi

if [[ "$INSTALLED" -eq 0 ]]; then
	echo "Chayuan WPS: failed to copy add-in into jsaddons (is WPS locking files?). Payload remains at $INSTALL_ROOT/$ADDON_FOLDER" >&2
	# Still stage MCP below; do not hard-fail the pkg if payload is on disk for manual copy.
fi

# Phase 2+: stage MCP sidecar + LaunchAgent (best-effort; never fail the .pkg)
MCP_SRC="$INSTALL_ROOT/$ADDON_FOLDER/mcp-sidecar"
if [[ -d "$MCP_SRC" ]]; then
	MCP_HOME="$USER_HOME/.config/chayuan-wps/mcp"
	/bin/mkdir -p "$MCP_HOME/runtime" || true
	if copy_tree "$MCP_SRC" "$MCP_HOME/runtime"; then
		if [[ -d "$MCP_HOME/runtime/bin" ]]; then
			/bin/chmod +x "$MCP_HOME/runtime/bin/"* 2>/dev/null || true
		fi
		/bin/chmod +x "$MCP_HOME/runtime/start-mcp.sh" 2>/dev/null || true
		/bin/chmod +x "$MCP_HOME/runtime/autostart/"*.sh 2>/dev/null || true
		/usr/sbin/chown -R "$CONSOLE_USER:staff" "$MCP_HOME" 2>/dev/null || true
		if [[ -f "$MCP_HOME/runtime/autostart/install-macos-launchagent.sh" ]]; then
			/usr/bin/su - "$CONSOLE_USER" -c "bash \"$MCP_HOME/runtime/autostart/install-macos-launchagent.sh\"" \
				|| echo "Chayuan WPS: MCP LaunchAgent skipped — run $MCP_HOME/runtime/autostart/install-macos-launchagent.sh" >&2
		fi
		# Immediate start in background; ignore failures (Gatekeeper / already running)
		if [[ -x "$MCP_HOME/runtime/start-mcp.sh" ]]; then
			/usr/bin/su - "$CONSOLE_USER" -c "nohup bash \"$MCP_HOME/runtime/start-mcp.sh\" >/dev/null 2>&1 &" \
				|| true
		fi
		echo "Chayuan WPS: MCP sidecar staged at $MCP_HOME/runtime (URL http://127.0.0.1:62588/mcp)"
	else
		echo "Chayuan WPS: MCP sidecar staging failed (non-fatal)" >&2
	fi
fi

# Only fail the installer if add-in never landed anywhere and payload missing
if [[ "$INSTALLED" -eq 0 && ! -d "$INSTALL_ROOT/$ADDON_FOLDER" ]]; then
	exit 1
fi
exit 0
