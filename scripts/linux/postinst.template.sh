#!/bin/sh
# Copies add-in into the invoking user's jsaddons (typical: sudo dpkg -i).
# 麒麟 / UOS 等环境下若用图形界面安装 .deb，可能没有 SUDO_USER，需额外推断登录用户。
set -e
INSTALL_ROOT="__INSTALL_ROOT__"
META="$INSTALL_ROOT/install.json"
if ! test -f "$META"; then
	echo "chayuan-wps-addon: missing $META" >&2
	exit 1
fi
# 用 sed 解析 addonFolder，避免依赖 python3
# install.json 含多个 addonFolder：第一个=主宿主目录，其余=表格/演示宿主目录
ADDON_FOLDER="$(sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | head -1)"
if test -z "$ADDON_FOLDER"; then
	echo "chayuan-wps-addon: cannot read addonFolder from $META" >&2
	exit 1
fi
HOST_FOLDERS="$(sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | tail -n +2)"

# 替换式安装：清除旧版本加载项目录（chayuan_<ver> / chayuan-et_<ver> / chayuan-wpp_<ver>），
# 只保留本次安装的目录。目录条目删不掉（父目录 root 属主）时退化为清空内容。
cleanup_old_addons() {
	DEST="$1"
	PREFIX="$(printf '%s' "$ADDON_FOLDER" | sed 's/_.*//')"
	KEEP="$(printf '%s %s' "$ADDON_FOLDER" "$HOST_FOLDERS")"
	for ENTRY in "$DEST"/${PREFIX}_* "$DEST"/${PREFIX}-et_* "$DEST"/${PREFIX}-wpp_* "$DEST"/.${PREFIX}*.installing; do
		test -d "$ENTRY" || continue
		BASE="$(basename "$ENTRY")"
		SKIP=0
		for K in $KEEP; do
			if test "$BASE" = "$K"; then SKIP=1; break; fi
		done
		test "$SKIP" -eq 0 || continue
		if rm -rf "$ENTRY" 2>/dev/null && ! test -d "$ENTRY"; then
			echo "chayuan-wps-addon: removed old addon dir: $BASE"
		else
			find "$ENTRY" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
			echo "chayuan-wps-addon: emptied old addon dir (parent not writable): $BASE"
		fi
	done
}

# 主宿主 + 表格/演示宿主目录一起安装
install_all() {
	DEST="$1"
	for FOLDER in "$ADDON_FOLDER" $HOST_FOLDERS; do
		test -d "$INSTALL_ROOT/$FOLDER" || continue
		rm -rf "$DEST/$FOLDER"
		cp -R "$INSTALL_ROOT/$FOLDER" "$DEST/"
	done
}

merge_publish_online() {
	PUBLISH_XML="$1"
	if test -f "$INSTALL_ROOT/publish-merge-fileurl.py"; then
		python3 "$INSTALL_ROOT/publish-merge-fileurl.py" "$INSTALL_ROOT" "$PUBLISH_XML"
	fi
}

# Prefer the user who invoked sudo; avoid installing only under /root when possible.
TARGET_USER="${SUDO_USER:-}"
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	TARGET_USER="${LOGNAME:-}"
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	TARGET_USER="$(logname 2>/dev/null || true)"
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	if test -n "${PKEXEC_UID:-}"; then
		TARGET_USER="$(getent passwd "$PKEXEC_UID" 2>/dev/null | cut -d: -f1)"
	fi
fi
# 图形界面双击安装（软件中心 / GDebi 等）常无 SUDO_USER；pkexec 外再推断桌面会话用户
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	if test -n "${SUDO_UID:-}"; then
		TARGET_USER="$(getent passwd "$SUDO_UID" 2>/dev/null | cut -d: -f1)"
	fi
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	if command -v loginctl >/dev/null 2>&1; then
		TARGET_USER="$(loginctl list-users --no-legend 2>/dev/null | awk 'NR>1 && $1+0 >= 1000 && $2 != "" && $2 != "root" { print $2; exit }')"
	fi
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	for RUNDIR in /run/user/[0-9]*; do
		test -d "$RUNDIR" || continue
		uid="${RUNDIR##*/}"
		case "$uid" in ''|*[!0-9]*) continue ;; esac
		test "$uid" -ge 1000 || continue
		u="$(getent passwd "$uid" | cut -d: -f1)"
		if test -n "$u" && test "$u" != "root"; then
			TARGET_USER="$u"
			break
		fi
	done
fi

# 官网 deb、UOS/麒麟应用商店等多套 office6 布局（与 wpsjs GetExePath 探测一致，并多列常见变体）
for OFFICE6 in \
	"/opt/kingsoft/wps-office/office6" \
	"/opt/apps/cn.wps.wps-office-pro/files/kingsoft/wps-office/office6" \
	"/opt/apps/cn.wps.wps-office/files/kingsoft/wps-office/office6"
do
	if test -d "$OFFICE6"; then
		ALT="$OFFICE6/jsaddons"
		mkdir -p "$ALT"
		# 安装前先清理历史版本目录，装完只剩最新版本（装后兜底再扫一遍）
		cleanup_old_addons "$ALT"
		install_all "$ALT" || true
		cp -f "$INSTALL_ROOT/publish.xml" "$ALT/" || true
		merge_publish_online "$ALT/publish.xml"
		chmod -R a+rX "$ALT" 2>/dev/null || true
		cleanup_old_addons "$ALT"
		echo "chayuan-wps-addon: also copied to $ALT"
	fi
done

if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	echo "chayuan-wps-addon: 未能确定当前登录用户，未写入家目录。请将 $INSTALL_ROOT 下的 $ADDON_FOLDER 与 publish.xml 复制到 ~/.local/share/Kingsoft/wps/jsaddons/ 后重启 WPS。" >&2
	echo "chayuan-wps-addon: Could not determine non-root user; home directory copy skipped" >&2
	if test -x "/opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice"; then
		echo "chayuan-wps-addon: 若已部署到 office6/jsaddons，可尝试: /opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice restart" >&2
	fi
	exit 0
fi

USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if test -z "$USER_HOME" || ! test -d "$USER_HOME"; then
	USER_HOME="/home/$TARGET_USER"
fi

# 标准路径为 Kingsoft；个别环境仅生成小写 kingsoft（大小写敏感），两处都写入以免漏读
for DEST in \
	"$USER_HOME/.local/share/Kingsoft/wps/jsaddons" \
	"$USER_HOME/.local/share/kingsoft/wps/jsaddons"
do
	mkdir -p "$DEST"
	# 安装前先清理历史版本目录，装完只剩最新版本
	cleanup_old_addons "$DEST"
	install_all "$DEST"
	cp -f "$INSTALL_ROOT/publish.xml" "$DEST/"
	merge_publish_online "$DEST/publish.xml"
	for FOLDER in "$ADDON_FOLDER" $HOST_FOLDERS; do
		test -d "$DEST/$FOLDER" && chown -R "$TARGET_USER:$TARGET_USER" "$DEST/$FOLDER" 2>/dev/null || true
	done
	chown "$TARGET_USER:$TARGET_USER" "$DEST/publish.xml" 2>/dev/null || true
	cleanup_old_addons "$DEST"
	echo "chayuan-wps-addon: installed to $DEST"
done

if test -x "/opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice"; then
	echo "chayuan-wps-addon: 若未看到加载项，请执行: /opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice restart" >&2
fi

# Phase 2+: install MCP sidecar user autostart (best-effort; needs node)
MCP_SRC="$INSTALL_ROOT/$ADDON_FOLDER/mcp-sidecar"
if test -d "$MCP_SRC" && test -n "$TARGET_USER" && test "$TARGET_USER" != "root"; then
	MCP_HOME="$USER_HOME/.config/chayuan-wps/mcp"
	mkdir -p "$MCP_HOME/runtime"
	cp -a "$MCP_SRC/." "$MCP_HOME/runtime/" 2>/dev/null || true
	# 确保 sidecar 单文件二进制可执行（cp 可能丢位）
	if test -d "$MCP_HOME/runtime/bin"; then
		chmod 0755 "$MCP_HOME/runtime/bin/"* 2>/dev/null || true
	fi
	chown -R "$TARGET_USER:$TARGET_USER" "$MCP_HOME" 2>/dev/null || true
	if test -x "$MCP_HOME/runtime/autostart/install-linux-user.sh"; then
		su - "$TARGET_USER" -c "CHAYUAN_MCP_HOME=$MCP_HOME/runtime bash $MCP_HOME/runtime/autostart/install-linux-user.sh" 2>/dev/null \
			|| echo "chayuan-wps-addon: MCP autostart skipped (run $MCP_HOME/runtime/autostart/install-linux-user.sh as user)" >&2
	fi
	echo "chayuan-wps-addon: MCP sidecar staged at $MCP_HOME/runtime (URL http://127.0.0.1:62588/mcp)"
fi

exit 0
