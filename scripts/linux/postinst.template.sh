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
ADDON_FOLDER="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['addonFolder'])" "$META")"

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
		rm -rf "$ALT/$ADDON_FOLDER"
		cp -R "$INSTALL_ROOT/$ADDON_FOLDER" "$ALT/" || true
		cp -f "$INSTALL_ROOT/publish.xml" "$ALT/" || true
		merge_publish_online "$ALT/publish.xml"
		chmod -R a+rX "$ALT/$ADDON_FOLDER" "$ALT/publish.xml" 2>/dev/null || true
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
	rm -rf "$DEST/$ADDON_FOLDER"
	cp -R "$INSTALL_ROOT/$ADDON_FOLDER" "$DEST/"
	cp -f "$INSTALL_ROOT/publish.xml" "$DEST/"
	merge_publish_online "$DEST/publish.xml"
	chown -R "$TARGET_USER:$TARGET_USER" "$DEST/$ADDON_FOLDER" "$DEST/publish.xml" 2>/dev/null || true
	echo "chayuan-wps-addon: installed to $DEST"
done

if test -x "/opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice"; then
	echo "chayuan-wps-addon: 若未看到加载项，请执行: /opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice restart" >&2
fi

exit 0
