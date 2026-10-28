#!/bin/bash
# Installs Chayuan WPS add-in into the console user's jsaddons (no manual copy).
# NOTE: avoid bare `set -e` around large copies into WPS Containers — EINTR
# ("Interrupted system call") is common when WPS holds addon files open and must not
# abort the whole .pkg install (Installer error 112).
set -u
# pkgbuild 构建期会以「非 root + 本机文件系统」预执行本脚本做环境快照；真实安装
# 才以 root 运行。非 root 直接成功退出：避免校验阶段误触开发机真实 jsaddons，
# 并消除打包日志里的多条 "write: Permission denied" 噪音。
if [[ "$(id -u)" != "0" ]]; then
	exit 0
fi
INSTALL_ROOT="__INSTALL_ROOT__"
META="$INSTALL_ROOT/install.json"
if [[ ! -f "$META" ]]; then
	echo "Chayuan WPS: missing $META" >&2
	exit 1
fi
# 用 sed 解析 addonFolder，避免依赖 python3（未装 Command Line Tools 的 Mac 没有 /usr/bin/python3）
# install.json 含多个 addonFolder：第一个=主宿主目录，其余=表格/演示宿主目录
ADDON_FOLDER="$(/usr/bin/sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | head -1)"
if [[ -z "$ADDON_FOLDER" ]]; then
	echo "Chayuan WPS: cannot read addonFolder from $META" >&2
	exit 1
fi
HOST_FOLDERS="$(/usr/bin/sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | tail -n +2)"

# 替换式安装：清除旧版本加载项目录（chayuan_<ver> / chayuan-et_<ver> / chayuan-wpp_<ver>），
# 只保留本次安装的目录。目录条目删不掉（父目录 root 属主）时退化为清空内容。
cleanup_old_addons() {
	local dest="$1"
	local prefix="${ADDON_FOLDER%%_*}"
	local entry base skip
	# 最后一组：历史安装中断遗留的 .<目录>.installing 暂存壳（点前缀，同名新壳由安装流程重建）
	for entry in "$dest"/${prefix}_* "$dest"/${prefix}-et_* "$dest"/${prefix}-wpp_* "$dest"/.${prefix}*.installing; do
		[[ -d "$entry" ]] || continue
		base="$(/usr/bin/basename "$entry")"
		skip=0
		local k
		for k in "$ADDON_FOLDER" $HOST_FOLDERS; do
			if [[ "$base" == "$k" ]]; then skip=1; break; fi
		done
		[[ "$skip" -eq 0 ]] || continue
		if /bin/rm -rf "$entry" 2>/dev/null && [[ ! -d "$entry" ]]; then
			echo "Chayuan WPS: removed old addon dir: $base"
		else
			/usr/bin/find "$entry" -mindepth 1 -maxdepth 1 -exec /bin/rm -rf {} + 2>/dev/null || true
			echo "Chayuan WPS: emptied old addon dir (parent not writable): $base"
		fi
	done
}

# 同步 jsplugins.xml：WPS(Mac) 实际按 jsplugins.xml 加载本地插件，publish.xml 只是
# wpsjs 在线安装清单。只更新本产品三条目（chayuan / chayuan-et / chayuan-wpp），
# 其它插件条目原样保留；旧条目指向已清理删除的版本目录会让 WPS 加载失败/回退旧缓存。
sync_jsplugins() {
	local dest="$1"
	local pb="$dest/publish.xml"
	local jp="$dest/jsplugins.xml"
	[[ -f "$pb" ]] || return 0
	local entries
	entries="$(/usr/bin/grep 'name="chayuan' "$pb" || true)"
	[[ -n "$entries" ]] || return 0
	if [[ ! -f "$jp" ]] || ! /usr/bin/grep -q '<jsplugins' "$jp" 2>/dev/null; then
		printf '<?xml version="1.0" encoding="UTF-8"?>\n<jsplugins>\n%s\n</jsplugins>\n' "$entries" > "$jp" 2>/dev/null || return 0
		/usr/sbin/chown -R "$CONSOLE_USER:staff" "$jp" 2>/dev/null || true
		echo "Chayuan WPS: wrote jsplugins.xml -> $dest"
		return 0
	fi
	local tmp="$jp.sync"
	{
		echo '<?xml version="1.0" encoding="UTF-8"?>'
		echo '<jsplugins>'
		/usr/bin/grep -v 'name="chayuan' "$jp" 2>/dev/null | /usr/bin/grep -v '</jsplugins>' | /usr/bin/grep -v '<?xml' || true
		echo "$entries"
		echo '</jsplugins>'
	} > "$tmp" 2>/dev/null || { /bin/rm -f "$tmp"; return 0; }
	/bin/mv -f "$tmp" "$jp" 2>/dev/null || { /bin/rm -f "$tmp"; return 0; }
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$jp" 2>/dev/null || true
	echo "Chayuan WPS: synced jsplugins.xml -> $dest"
}

# 同步 authaddin.json：WPS(Mac)「开发工具 → 加载项」与实际加载都按这份登记表的
# path 走。升级后若残旧条目指向已清理删除的版本目录，会把 WPS 打回旧版/加载失败。
# 只改本产品条目的版本目录段（chayuan(-et|-wpp)_<ver> → 本次安装目录名），其它不动；
# 必须在 WPS 未运行时执行（WPS 退出时会用内存状态覆写本文件）。
sync_authaddin() {
	local dest="$1"
	local aa="$dest/authaddin.json"
	[[ -f "$aa" ]] || return 0
	local et="" wpp="" k
	for k in $HOST_FOLDERS; do
		case "$k" in
			*-et_*) et="$k" ;;
			*-wpp_*) wpp="$k" ;;
		esac
	done
	local before after
	before="$(/bin/cat "$aa" 2>/dev/null)" || return 0
	local sed_args=( -E -e "s|/jsaddons/chayuan_[0-9][0-9.]*\"|/jsaddons/${ADDON_FOLDER}\"|g" )
	[[ -n "$et" ]] && sed_args+=( -e "s|/jsaddons/chayuan-et_[0-9][0-9.]*\"|/jsaddons/${et}\"|g" )
	[[ -n "$wpp" ]] && sed_args+=( -e "s|/jsaddons/chayuan-wpp_[0-9][0-9.]*\"|/jsaddons/${wpp}\"|g" )
	after="$(/usr/bin/sed "${sed_args[@]}" <<< "$before" 2>/dev/null)" || return 0
	if [[ "$after" != "$before" ]]; then
		printf '%s\n' "$after" > "$aa" 2>/dev/null || return 0
		/usr/sbin/chown -R "$CONSOLE_USER:staff" "$aa" 2>/dev/null || true
		echo "Chayuan WPS: synced authaddin.json paths -> $dest"
	fi
	# 去重：多轮升级会在宿主下累积同名多条目（过渡态曾触发 ksojscore 启动崩溃），
	# 每个宿主每个 name 只留一条（优先指向当前版本的）；有 python3 才做，没有则跳过
	if /usr/bin/command -v python3 >/dev/null 2>&1; then
		/usr/bin/python3 - "$aa" <<'PYI' 2>/dev/null || true
import json, sys
p = sys.argv[1]
d = json.load(open(p))
changed = False
for host, v in list(d.items()):
    if not isinstance(v, dict):
        continue
    entries = {k: e for k, e in v.items() if isinstance(e, dict) and 'path' in e}
    names = {}
    for k, e in entries.items():
        n = e.get('name', '')
        if n not in names or '__PKG_VERSION__' in e.get('path', ''):
            names[n] = (k, e)
    if len(entries) > len(names):
        nv = {}
        for n, (k, e) in names.items():
            nv[k] = e
        nv['namelist'] = sorted(nv.keys())[0]
        d[host] = nv
        changed = True
if changed:
    json.dump(d, open(p, 'w'), indent=4, ensure_ascii=False)
    print('Chayuan WPS: deduped authaddin.json entries')
PYI
	fi
}

# 安装前先停 agent 服务（sidecar）。LaunchAgent 是 KeepAlive=true：不先 unload 直接
# kill 会立刻复活；不杀的后果是旧进程占着 62588 用旧代码继续服务，Phase 2 的新启动
# 静默失败——用户拿到「装完还是旧版」的网关（2026-10-28 真机：旧 sidecar 从 09:23
# 一路活过 10:26 整个安装过程）。
stop_agent_service() {
	local plist="$USER_HOME/Library/LaunchAgents/com.chayuan.mcp.plist"
	local uid
	uid="$(/usr/bin/id -u "$CONSOLE_USER" 2>/dev/null || true)"
	if [[ -f "$plist" ]]; then
		if [[ -n "$uid" ]]; then
			/bin/launchctl bootout "gui/$uid/com.chayuan.mcp" 2>/dev/null || true
		fi
		/bin/launchctl unload "$plist" 2>/dev/null || true
		echo "Chayuan WPS: LaunchAgent com.chayuan.mcp unloaded"
	fi
	local pat
	for pat in "chayuan-mcp-macos" "chayuan-mcp-linux" "mcp-sidecar/server.mjs" "chayuan-mcp-watch"; do
		if /usr/bin/pgrep -f "$pat" >/dev/null 2>&1; then
			/usr/bin/pkill -f "$pat" 2>/dev/null || true
			echo "Chayuan WPS: killed running agent process (match: $pat)"
		fi
	done
	# 端口兜底：启动命令五花八门（dev 态 node / 二进制绝对路径），进程名未必落在上面模式里
	local lsof_bin="/usr/sbin/lsof"
	[[ -x "$lsof_bin" ]] || lsof_bin="$(/usr/bin/command -v lsof || true)"
	if [[ -n "$lsof_bin" ]] && "$lsof_bin" -ti tcp:62588 >/dev/null 2>&1; then
		"$lsof_bin" -ti tcp:62588 | /usr/bin/xargs kill 2>/dev/null || true
		echo "Chayuan WPS: killed process holding port 62588"
		local i=0
		while "$lsof_bin" -ti tcp:62588 >/dev/null 2>&1 && [[ $i -lt 10 ]]; do
			/bin/sleep 1
			i=$((i + 1))
		done
	fi
	return 0
}

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

# 先停 agent 服务再动文件（LaunchAgent unload → 杀进程 → 端口兜底，见函数注释）
stop_agent_service

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
	local folder="$2"
	[[ -z "$dest" || -z "$folder" ]] && return 0
	/bin/mkdir -p "$dest" || return 1
	# Replace previous version directory atomically-ish: copy to temp then mv
	local staging_dest="$dest/.${folder}.installing"
	/bin/rm -rf "$staging_dest" 2>/dev/null || true
	if ! copy_tree "$INSTALL_ROOT/$folder" "$staging_dest"; then
		/bin/rm -rf "$staging_dest" 2>/dev/null || true
		return 1
	fi
	/bin/rm -rf "$dest/$folder" 2>/dev/null || true
	if ! /bin/mv "$staging_dest" "$dest/$folder" 2>/tmp/chayuan-postinstall-mv.err; then
		# Fallback: copy over existing tree if rename blocked
		if ! copy_tree "$INSTALL_ROOT/$folder" "$dest/$folder"; then
			/bin/rm -rf "$staging_dest" 2>/dev/null || true
			return 1
		fi
		/bin/rm -rf "$staging_dest" 2>/dev/null || true
	fi
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$dest/$folder" 2>/dev/null || true
	echo "Chayuan WPS: installed $folder -> $dest"
	return 0
}

install_all_one() {
	local dest="$1"
	[[ -z "$dest" ]] && return 0
	/bin/mkdir -p "$dest" || return 1
	# 目录本身可能是上一次 root 安装留下的（root 属主会让用户级后续写入失败），一并归还
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$dest" 2>/dev/null || true
	# 安装前先清理历史版本目录（chayuan_<ver> / chayuan-et_<ver> / chayuan-wpp_<ver>），
	# 只保留本次要装的版本；本次同名目录由 install_one 替换逻辑原子覆盖。
	cleanup_old_addons "$dest"
	local folder ok=1
	# 主宿主 + 表格/演示宿主目录
	for folder in "$ADDON_FOLDER" $HOST_FOLDERS; do
		install_one "$dest" "$folder" || ok=0
	done
	/bin/cp -f "$INSTALL_ROOT/publish.xml" "$dest/publish.xml" 2>/dev/null || true
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$dest/publish.xml" 2>/dev/null || true
	sync_jsplugins "$dest"
	sync_authaddin "$dest"
	# 装完兜底再扫一遍（正常情况下安装前清理已清光）
	cleanup_old_addons "$dest"
	return $ok
}

INSTALLED=0
CONTAINER_OK=0
# Sandboxed WPS for Mac (common)
if install_all_one "$USER_HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"; then
	INSTALLED=1
	CONTAINER_OK=1
fi
# Non-sandbox / older layouts (best-effort)
if install_all_one "$USER_HOME/Library/Application Support/Kingsoft/wps/jsaddons"; then
	INSTALLED=1
fi

# 沙盒版 WPS 只读容器 jsaddons：容器失败而非容器成功 = 假成功（WPS 仍加载旧版），
# 不能被 INSTALLED=1 掩盖。2026-10-28 真机：macOS 收紧 TCC 后 Installer 无完全磁盘
# 访问权限，容器内 ditto/读注册表全部 EPERM，仅非容器落盘，用户毫无感知。
if [[ "$CONTAINER_OK" -eq 0 ]]; then
	echo "*******************************************************************" >&2
	echo "Chayuan WPS: 容器 jsaddons 安装失败（Operation not permitted）！" >&2
	echo "  沙盒版 WPS 只从容器路径加载插件，本次安装对 WPS 无效（仍会加载旧版）。" >&2
	echo "  修复任选其一：" >&2
	echo "  ① 系统设置 → 隐私与安全性 → 完全磁盘访问权限 → 勾选「安装器」，重跑本安装包" >&2
	echo "  ② 在有完全磁盘访问权限的终端执行：bash 仓库/scripts/repair-mac-jsaddons-container.sh" >&2
	echo "*******************************************************************" >&2
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
		# 启动确认：等 healthz 就绪（≤10s）——把「新网关到底起没起来」写进安装日志，
		# 不再静默（此前旧的占端口时这里毫无痕迹）
		HI=0
		while [[ $HI -lt 10 ]]; do
			if /usr/bin/curl -sm 2 http://127.0.0.1:62588/healthz 2>/dev/null | /usr/bin/grep -q '"ok":true'; then
				echo "Chayuan WPS: MCP sidecar is up (healthz ok)"
				break
			fi
			/bin/sleep 1
			HI=$((HI + 1))
		done
		if [[ $HI -ge 10 ]]; then
			echo "Chayuan WPS: MCP sidecar not ready within 10s (LaunchAgent KeepAlive 会再拉起；若仍异常查 $MCP_HOME/launchd.err.log)" >&2
		fi
	else
		echo "Chayuan WPS: MCP sidecar staging failed (non-fatal)" >&2
	fi
fi

# WPS 运行中安装 = 注册表白同步（WPS 退出时用内存状态覆写 authaddin.json，
# 打回旧版路径）。响亮警告 + 指引，宁可重装也不让用户默默留在旧版。
if /usr/bin/pgrep -xq wpsoffice 2>/dev/null; then
	echo "*******************************************************************" >&2
	echo "Chayuan WPS: 检测到 WPS 正在运行！" >&2
	echo "  本次写入的插件注册会在 WPS 退出时被旧状态覆写（加载项仍显示旧版本）。" >&2
	echo "  请：① 完全退出 WPS（保存文档后 ⌘Q，或 pkill -x wpsoffice）" >&2
	echo "      ② 重新运行本安装包  ③ 再打开 WPS" >&2
	echo "*******************************************************************" >&2
fi

# Only fail the installer if add-in never landed anywhere and payload missing
if [[ "$INSTALLED" -eq 0 && ! -d "$INSTALL_ROOT/$ADDON_FOLDER" ]]; then
	exit 1
fi
exit 0
