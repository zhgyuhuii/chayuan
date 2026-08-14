#!/usr/bin/env bash
# install-wps-skill-chayuan.sh —— wps-skill-chayuan 直装脚本（macOS + Linux）
#
# 不跑 .pkg/.deb 安装器外壳，直接做四件事：
#   1) 加载项目录 + publish.xml 写入 WPS jsaddons（WPS 启动即加载察元）
#   2) 调用 mcp-sidecar/autostart/* 注册 MCP 自启并立即启动（启动副作用：写 mcp-server.json）
#   3) 四级 healthz 自检
#   4) 自动检测已装的 agent（Claude Code / Cursor / Codex）→ 注册 MCP + 按各自格式投放技能文件
#      OpenClaw / Hermes 为 GUI，打印指引；GitHub 被墙时 --fetch 多源回退（Gitee / aidooo 官方）
#
# 全程免 Node：自启脚本在有 mcp-sidecar/bin 二进制时不依赖 Node；本脚本只用 sed/curl/cp。
#
# 用法：
#   bash scripts/install-wps-skill-chayuan.sh                      # 全量直装 + 自动检测 agent
#   bash scripts/install-wps-skill-chayuan.sh --no-agent            # 跳过 agent 技能投放
#   bash scripts/install-wps-skill-chayuan.sh --skill-only          # 仅加载项到 jsaddons
#   bash scripts/install-wps-skill-chayuan.sh --runtime-only         # 仅 MCP 自启
#   bash scripts/install-wps-skill-chayuan.sh --payload /path/staging
#   bash scripts/install-wps-skill-chayuan.sh --with-cursor --with-claude --with-codex   # 强制投放
#   bash scripts/install-wps-skill-chayuan.sh --fetch                # 本地无载荷时多源下载
#   bash scripts/install-wps-skill-chayuan.sh --fetch --version 4.1.0
#
# 详见 plans/wps-skill-chayuan-design.md §16。

set -euo pipefail

# ─────────────────────── 基础变量 ───────────────────────
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_NAME="chayuan-wps-mcp"
MCP_PORT="62588"
MCP_URL="http://127.0.0.1:${MCP_PORT}/mcp"
HEALTHZ="http://127.0.0.1:${MCP_PORT}/healthz"
PKG_VERSION_DEFAULT="4.1.0"

# ─────────────────────── 参数解析 ───────────────────────
DO_ADDON=1
DO_RUNTIME=1
DO_AGENT=1
DO_FETCH=0
PAYLOAD_FLAG=""
FETCH_VERSION=""
WITH_CLAUDE=0
WITH_CURSOR=0
WITH_CODEX=0
LINUX_SYSTEM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skill-only)   DO_RUNTIME=0; shift ;;
    --runtime-only) DO_ADDON=0; shift ;;
    --no-agent)     DO_AGENT=0; shift ;;
    --fetch)        DO_FETCH=1; shift ;;
    --version)      FETCH_VERSION="$2"; shift 2 ;;
    --payload)      PAYLOAD_FLAG="$2"; shift 2 ;;
    --with-claude)  WITH_CLAUDE=1; shift ;;
    --with-cursor)  WITH_CURSOR=1; shift ;;
    --with-codex)   WITH_CODEX=1; shift ;;
    --with-all)     WITH_CLAUDE=1; WITH_CURSOR=1; WITH_CODEX=1; shift ;;
    --system)       LINUX_SYSTEM=1; shift ;;   # Linux 信创：尝试写 /opt（需 sudo）
    -h|--help)
      sed -n '2,24p' "${BASH_SOURCE[0]:-$0}"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done
[[ "${WPS_SKILL_FETCH:-0}" == "1" ]] && DO_FETCH=1
[[ -z "$FETCH_VERSION" ]] && FETCH_VERSION="${WPS_SKILL_VERSION:-$PKG_VERSION_DEFAULT}"

# ─────────────────────── 平台 / 架构 ───────────────────────
case "$(uname -s)" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *) echo "本脚本仅支持 macOS / Linux，Windows 请用 install-wps-skill-chayuan.ps1" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64)  ARCH="x64" ;;
  *) ARCH="$(uname -m)" ;;
esac

# ─────────────────────── sha256（跨 macOS/Linux）──────────────
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

# ─────────────────────── 镜像源（GitHub 被墙时的备用地址）──────────────
# 优先级：$WPS_SKILL_MIRRORS（空白分隔 URL）→ 包内/仓库 mirrors.json → 内置默认（GitHub→Gitee→aidooo）
# URL 里 ${version} 会被替换；下载后用随包 .sha256 强校验，任一源被篡改都不会通过。
mirror_urls() {
  local ver="$FETCH_VERSION"
  if [[ -n "${WPS_SKILL_MIRRORS:-}" ]]; then
    # shellcheck disable=SC2086
    printf '%s\n' $WPS_SKILL_MIRRORS | sed "s/\${version}/$ver/g"
    return
  fi
  local mj=""
  for c in \
      "${PAYLOAD_FLAG:-}/mirrors.json" \
      "${WPS_SKILL_PAYLOAD:-}/mirrors.json" \
      "$REPO/release/mirrors.json"; do
    [[ -f "$c" ]] && { mj="$c"; break; }
  done
  if [[ -n "$mj" ]]; then
    sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$mj" | sed "s/\${version}/$ver/g"
    return
  fi
  cat <<EOF
https://gitee.com/cloudshd/chayuan-wps-releases/releases/download/${ver}/wps-skill-chayuan-${ver}-portable.zip
https://aidooo.com/downloads/skill/wps-skill-chayuan-${ver}-portable.zip
https://github.com/zhgyuhuii/chayuan/releases/download/${ver}/wps-skill-chayuan-${ver}-portable.zip
EOF
}

print_mirrors() {
  echo "  备用下载源（国内优先 Gitee / aidooo，任选其一）：" >&2
  mirror_urls | sed 's/^/    - /' >&2
  echo "  每个源都带 .sha256 强校验，被篡改的源不会通过。" >&2
}

# 多源顺序下载 + sha256 强校验 + 解压。成功 echo 解压后的 staging 目录。
fetch_payload() {
  command -v curl >/dev/null 2>&1 || { echo "[wps-skill-chayuan] fetch 需要 curl" >&2; return 1; }
  local tmp archive url sha_url expected actual d
  tmp="$(mktemp -d)"; archive="$tmp/portable.zip"
  while IFS= read -r url; do
    [[ -z "$url" ]] && continue
    echo "[wps-skill-chayuan] 尝试：$url" >&2
    if ! curl -fL --connect-timeout 8 --max-time 60 -o "$archive" "$url" 2>/dev/null; then
      echo "[wps-skill-chayuan] · 不可达，换下一个源" >&2; continue
    fi
    sha_url="${url}.sha256"
    if ! curl -fsS --connect-timeout 8 --max-time 15 -o "$archive.sha256" "$sha_url" 2>/dev/null; then
      echo "[wps-skill-chayuan] ⚠ 该源未提供 .sha256，跳过（安全策略：离线整包必须强校验）" >&2; continue
    fi
    expected="$(awk 'NR==1{print $1}' "$archive.sha256")"
    actual="$(sha256_of "$archive")"
    if [[ "$expected" != "$actual" ]]; then
      echo "[wps-skill-chayuan] ✗ sha256 不匹配（期 ${expected:0:12}… 得 ${actual:0:12}…），换源" >&2; continue
    fi
    echo "[wps-skill-chayuan] ✓ sha256 校验通过" >&2
    if ! command -v unzip >/dev/null 2>&1; then
      echo "[wps-skill-chayuan] ✗ 无 unzip；请解压后用 --payload 指定，或装 unzip 重跑" >&2; return 1
    fi
    unzip -q "$archive" -d "$tmp" >&2
    d="$(find "$tmp" -name install.json -path '*/install-staging/*' 2>/dev/null | head -1)"
    if [[ -z "$d" ]]; then
      echo "[wps-skill-chayuan] ✗ 解压后未找到 install-staging/install.json（包结构异常）" >&2; return 1
    fi
    dirname "$(dirname "$d")"
    return 0
  done < <(mirror_urls)
  echo "[wps-skill-chayuan] ✗ 所有源都不可用" >&2
  return 1
}

# ─────────────────────── 载荷解析（本地三级 + 可选下载回落）──────────────
resolve_payload() {
  if [[ -n "$PAYLOAD_FLAG" ]]; then echo "$PAYLOAD_FLAG"; return; fi
  if [[ -n "${WPS_SKILL_PAYLOAD:-}" ]]; then echo "$WPS_SKILL_PAYLOAD"; return; fi
  if [[ -d "$REPO/release/install-staging" ]]; then echo "$REPO/release/install-staging"; return; fi  # 开发仓库
  if [[ -d "$REPO/install-staging" ]]; then echo "$REPO/install-staging"; return; fi                  # portable 包根（下载解压即用）
  echo ""
}
PAYLOAD="$(resolve_payload)"
if [[ -z "$PAYLOAD" || ! -d "$PAYLOAD" ]]; then
  if [[ "$DO_FETCH" -eq 1 ]]; then
    echo "[wps-skill-chayuan] 本地无载荷，启用多源下载（GitHub 被墙自动回退 Gitee / aidooo）"
    PAYLOAD="$(fetch_payload)" || PAYLOAD=""
    # fetch_payload 解压到 mktemp 目录,PAYLOAD 是其下包根;脚本退出时统一清理整包 ≈290MB。
    if [[ -n "$PAYLOAD" ]]; then
      FETCH_TMP="$(dirname "$PAYLOAD")"
      trap 'rm -rf "$FETCH_TMP"' EXIT
    fi
  fi
fi
if [[ -z "$PAYLOAD" || ! -d "$PAYLOAD" ]]; then
  cat >&2 <<EOF
[wps-skill-chayuan] 找不到载荷。请满足下列之一：
  1) 在本机构建：npm run build:wps-all   （产物在 release/install-staging）
  2) 指定已解压的 portable 目录：--payload /path/to/staging
  3) 设环境变量：export WPS_SKILL_PAYLOAD=/path/to/staging
  4) 自动下载（多源回退 + sha256 强校验）：bash $0 --fetch   或   export WPS_SKILL_FETCH=1
EOF
  print_mirrors
  exit 1
fi

# install.json 读取（sed 解析，免 python/node，与 postinstall 同款）
INSTALL_JSON="$PAYLOAD/install.json"
if [[ ! -f "$INSTALL_JSON" ]]; then
  echo "[wps-skill-chayuan] 缺少 $INSTALL_JSON" >&2; exit 1
fi
ADDON_FOLDER="$(sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$INSTALL_JSON" | tail -1)"
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$INSTALL_JSON" | tail -1)"
if [[ -z "$ADDON_FOLDER" ]]; then echo "[wps-skill-chayuan] install.json 读不到 addonFolder" >&2; exit 1; fi

# MCP sidecar 来源：portable 包内 mcp-sidecar 优先，否则仓库 mcp-sidecar
if [[ -d "$PAYLOAD/mcp-sidecar/bin" ]]; then SIDECAR="$PAYLOAD/mcp-sidecar"; else SIDECAR="$REPO/mcp-sidecar"; fi
MCP_BIN="$SIDECAR/bin/chayuan-mcp-${PLATFORM}-${ARCH}"
# ZIP 解压会丢 unix 执行位：兜底补回（本地构建产物本就 +x，无副作用）
find "$SIDECAR/bin" -type f -name 'chayuan-mcp-*' -exec chmod +x {} + 2>/dev/null || true
if [[ ! -x "$MCP_BIN" ]]; then
  echo "[wps-skill-chayuan] MCP 二进制缺失: $MCP_BIN" >&2
  echo "  （构建：bash scripts/build-mcp-binary.mjs；或 portable 包未含 mcp-sidecar/bin）" >&2
  exit 1
fi

# 技能模板来源：portable 包内 skill-chayuan 优先，否则仓库
skill_tmpl() {
  for c in "$PAYLOAD/skill-chayuan" "$REPO/skill-chayuan"; do
    [[ -d "$c" ]] && { echo "$c"; return; }
  done
  echo ""
}

echo "[wps-skill-chayuan] 平台=${PLATFORM}/${ARCH} 载荷=$PAYLOAD 加载项=$ADDON_FOLDER 版本=${VERSION:-?} MCP=$MCP_BIN"

# ─────────────────────── 健壮拷贝（WPS 占用重试；权限错误快速放弃）──────────────
copy_tree() {
  local src="$1" dest="$2" attempt=1
  while [[ "$attempt" -le 5 ]]; do
    if cp -a "$src" "$dest" 2>/tmp/wps-skill-cp.err; then return 0; fi
    local err; err="$(cat /tmp/wps-skill-cp.err 2>/dev/null || true)"
    # 永久性权限错误：重试无益，直接放弃（该路径多为 root 所属，留给 pkg/sudo）
    if echo "$err" | grep -qiE 'permission denied|operation not permitted|read-only'; then
      echo "  · 跳过（不可写，可能 root 所属）：$dest" >&2
      return 1
    fi
    echo "[wps-skill-chayuan] 拷贝第 $attempt 次失败（WPS 可能占用）：$err" >&2
    attempt=$((attempt + 1)); sleep 1
  done
  return 1
}

# ─────────────────────── STEP 1: 加载项 → jsaddons ───────────────────────
install_addon_one() {
  local dest="$1"; [[ -z "$dest" ]] && return 0
  mkdir -p "$dest"
  local staging_dest="$dest/.${ADDON_FOLDER}.installing"
  rm -rf "$staging_dest" 2>/dev/null || true
  copy_tree "$PAYLOAD/$ADDON_FOLDER" "$staging_dest" || { rm -rf "$staging_dest" 2>/dev/null || true; return 1; }
  rm -rf "$dest/$ADDON_FOLDER" 2>/dev/null || true
  mv "$staging_dest" "$dest/$ADDON_FOLDER" 2>/dev/null || copy_tree "$PAYLOAD/$ADDON_FOLDER" "$dest/$ADDON_FOLDER" || { rm -rf "$staging_dest" 2>/dev/null || true; return 1; }
  cp -f "$PAYLOAD/publish.xml" "$dest/publish.xml" 2>/dev/null || true
  echo "  ✓ 加载项 → $dest"
}

install_addon() {
  echo "[wps-skill-chayuan] STEP 1 加载项 → jsaddons"
  if [[ ! -f "$PAYLOAD/publish.xml" ]]; then echo "  缺 publish.xml，WPS 将不加载！" >&2; return 1; fi
  if [[ ! -d "$PAYLOAD/$ADDON_FOLDER" ]]; then echo "  缺加载项目录 $ADDON_FOLDER" >&2; return 1; fi
  # 多路径 best-effort：与 postinstall 语义一致，任一成功即可；个别路径不可写（如 root 所属）不致命
  local installed=0
  case "$PLATFORM" in
    macos)
      # 沙盒路径（用户可写，主力）+ 非沙盒路径（部分机器 root 所属，仅 root/pkg 可写）
      install_addon_one "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons" && installed=1
      install_addon_one "$HOME/Library/Application Support/Kingsoft/wps/jsaddons" && installed=1
      ;;
    linux)
      install_addon_one "$HOME/.local/share/Kingsoft/wps/jsaddons" && installed=1
      install_addon_one "$HOME/.local/share/kingsoft/wps/jsaddons" && installed=1   # 小写变体
      if [[ "$LINUX_SYSTEM" -eq 1 ]]; then
        # 信创专业版 /opt 路径，需 sudo；非 root 时提示
        local OPT_JS="/opt/apps/cn.wps.wps-office-pro/files/office6/jsaddons"
        if [[ -w /opt ]] || [[ "$(id -u)" -eq 0 ]]; then
          install_addon_one "$OPT_JS" && installed=1
        else
          echo "  ⚠ 信创 /opt 路径需 sudo，已跳过；需要时加 sudo 重跑或用 .deb 姿态"
        fi
      fi
      ;;
  esac
  if [[ "$installed" -eq 0 ]]; then
    echo "  ✗ 所有 jsaddons 路径都不可写（WPS 可能正占用，或需关闭 WPS / 用安装器以 root 写非沙盒路径）" >&2
    return 1
  fi
}

# ─────────────────────── STEP 2: MCP 自启 ───────────────────────
install_runtime() {
  echo "[wps-skill-chayuan] STEP 2 MCP 自启（调用 autostart，启动即写 mcp-server.json）"
  # 注意：各平台自启脚本命名不一致（mac=launchagent，linux=user）
  local script
  case "$PLATFORM" in
    macos) script="$SIDECAR/autostart/install-macos-launchagent.sh" ;;
    linux) script="$SIDECAR/autostart/install-linux-user.sh" ;;
  esac
  if [[ ! -f "$script" ]]; then echo "  缺自启脚本 $script" >&2; return 1; fi
  bash "$script"
}

# ─────────────────────── 执行阶段 ───────────────────────
if [[ "$DO_ADDON" -eq 1 ]]; then install_addon; fi
if [[ "$DO_RUNTIME" -eq 1 ]]; then install_runtime; fi

# ─────────────────────── STEP 3: 四级 healthz ───────────────────────
echo "[wps-skill-chayuan] STEP 3 四级自检"
L1=0; L2=0; L3=0; L4=0
# L1: jsaddons + publish.xml 就位
check_l1() {
  local p="$1"; [[ -d "$p/$ADDON_FOLDER" && -f "$p/publish.xml" ]] && return 0; return 1
}
case "$PLATFORM" in
  macos)
    check_l1 "$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons" || \
    check_l1 "$HOME/Library/Application Support/Kingsoft/wps/jsaddons" && L1=1
    ;;
  linux)
    check_l1 "$HOME/.local/share/Kingsoft/wps/jsaddons" || \
    check_l1 "$HOME/.local/share/kingsoft/wps/jsaddons" && L1=1
    ;;
esac
[[ "$L1" -eq 1 ]] && echo "  ✓ L1 jsaddons+publish.xml 就位" || echo "  ✗ L1 jsaddons/publish.xml 缺失（WPS 不会加载）"

# L2: MCP 进程 + 端口（轮询 15s）
for i in $(seq 1 15); do
  if curl -fsS "$HEALTHZ" >/dev/null 2>&1; then L2=1; break; fi
  sleep 1
done
[[ "$L2" -eq 1 ]] && echo "  ✓ L2 MCP 在线（healthz）" || echo "  ✗ L2 MCP 未在线（查自启日志：~/.config/chayuan-wps/mcp/）"

# F11：校验监听进程是否归 OS 自启托管，识别「野进程」导致 L2 误绿
if [[ "$L2" -eq 1 ]]; then
  LISTENER_PID="$( (command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:${MCP_PORT} -sTCP:LISTEN -t 2>/dev/null | head -1) || true )"
  MANAGED_PID=""
  case "$PLATFORM" in
    macos) MANAGED_PID="$(launchctl list 2>/dev/null | awk '$3=="com.chayuan.mcp"{print $1}' | head -1)" ;;
    linux) MANAGED_PID="$(systemctl --user show -p MainPID --value chayuan-mcp.service 2>/dev/null | head -1)" ;;
  esac
  if [[ -n "$LISTENER_PID" && -n "$MANAGED_PID" && "$LISTENER_PID" != "$MANAGED_PID" ]]; then
    echo "  ⚠ L2 附加：监听 PID=${LISTENER_PID} 不归自启托管（托管 PID=${MANAGED_PID}），疑为野进程；重启或 kill ${LISTENER_PID} 后由自启接管（F11）"
  elif [[ -n "$LISTENER_PID" && -z "$MANAGED_PID" ]]; then
    echo "  ⚠ L2 附加：监听 PID=${LISTENER_PID} 在自启表中无对应条目，疑为野进程（F11）"
  fi
fi

# L3: MCP 协议 initialize（best-effort，streamable HTTP）
if [[ "$L2" -eq 1 ]]; then
  L3_RESP="$(curl -s -m 5 -X POST "http://127.0.0.1:${MCP_PORT}/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"skill-chayuan-install","version":"1"}}}' 2>/dev/null || true)"
  if echo "$L3_RESP" | grep -qi 'result\|capabilities\|serverInfo'; then L3=1; fi
fi
[[ "$L3" -eq 1 ]] && echo "  ✓ L3 MCP 协议握手通过" || echo "  · L3 协议握手未确认（不影响 L1/L2；JSON-RPC 可在客户端侧再验）"

# L4: 加载项↔MCP 桥通（需 WPS 已开；best-effort）
if [[ "$L2" -eq 1 && "$L3" -eq 1 ]]; then
  if echo "$L3_RESP" | grep -qi 'wps\|agent'; then L4=1; fi   # 占位：真正 L4 需调一条只读工具，在 WPS 开启后手验
fi
[[ "$L4" -eq 1 ]] && echo "  ✓ L4 桥通迹象" || echo "  · L4 加载项↔MCP 桥通：打开 WPS 后由客户端跑只读冒烟确认"

# ─────────────────────── STEP 4: agent 自动检测 + 技能投放 ───────────────────────
# 默认 auto：扫描已装的 agent，按各自「正确格式」投放技能文件 + 注册 MCP（不止 Cursor）。
#   --with-<agent>：强制投放（即便未检测到，供首次预装）  --no-agent：跳过本步
# 格式矩阵：Claude=SKILL.md（~/.claude/skills/） Cursor=.mdc（~/.cursor/rules/） Codex=prompt.md（~/.codex/prompts/）
# OpenClaw / Hermes 为 GUI（无公开 skill 文件），仅打印 MCP 配置指引。
merge_mcp_json() {
  local f="$1"; mkdir -p "$(dirname "$f")"
  if [[ ! -f "$f" || ! -s "$f" ]]; then
    printf '{"mcpServers":{"%s":{"url":"%s"}}}\n' "$MCP_NAME" "$MCP_URL" > "$f"
    return 0
  fi
  if grep -q "\"$MCP_NAME\"" "$f"; then return 0; fi   # 已存在则跳过
  if command -v jq >/dev/null 2>&1; then
    local tmp; tmp="$(mktemp)"
    jq --arg n "$MCP_NAME" --arg u "$MCP_URL" \
      '.mcpServers[$n] = {url:$u}' "$f" > "$tmp" 2>/dev/null && mv "$tmp" "$f" && return 0
    rm -f "$tmp"
  fi
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"),p=process.argv[1],n=process.argv[2],u=process.argv[3];let j={};try{j=JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){j={}}j.mcpServers=j.mcpServers||{};j.mcpServers[n]={url:u};fs.writeFileSync(p,JSON.stringify(j,null,2))' "$f" "$MCP_NAME" "$MCP_URL" && return 0
  fi
  echo "  · 无 jq/node，未能自动合并 ${f}；请手工加入：\"${MCP_NAME}\":{\"url\":\"${MCP_URL}\"}" >&2
}

detect_claude() { command -v claude >/dev/null 2>&1 || [[ -d "$HOME/.claude" ]]; }
detect_cursor() { [[ -d "$HOME/.cursor" ]] || [[ -d "$HOME/Library/Application Support/Cursor" ]]; }
detect_codex()  { command -v codex >/dev/null 2>&1 || [[ -d "$HOME/.codex" ]]; }

deploy_claude() {
  if command -v claude >/dev/null 2>&1; then
    claude mcp add --transport http "$MCP_NAME" "$MCP_URL" 2>/dev/null \
      && echo "  ✓ Claude Code MCP（claude mcp add）" \
      || { merge_mcp_json "$HOME/.mcp.json"; echo "  · Claude Code MCP → $HOME/.mcp.json（claude mcp add 失败，回落）"; }
  else
    merge_mcp_json "$HOME/.mcp.json"; echo "  · Claude Code MCP → $HOME/.mcp.json（无 claude CLI）"
  fi
  local tmpl; tmpl="$(skill_tmpl)"
  if [[ -f "$tmpl/SKILL.md" ]]; then
    local dest="$HOME/.claude/skills/wps-skill-chayuan"
    mkdir -p "$dest"; cp -a "$tmpl/." "$dest/" 2>/dev/null || true
    echo "  ✓ Claude Code 技能 → $dest/SKILL.md"
  else
    echo "  · Claude Code：SKILL.md 模板缺失，跳过技能文件" >&2
  fi
}

deploy_cursor() {
  merge_mcp_json "$HOME/.cursor/mcp.json"; echo "  ✓ Cursor MCP → $HOME/.cursor/mcp.json"
  local tmpl; tmpl="$(skill_tmpl)"
  if [[ -f "$tmpl/formats/cursor.mdc" ]]; then
    local dest="$HOME/.cursor/rules"; mkdir -p "$dest"
    cp -f "$tmpl/formats/cursor.mdc" "$dest/wps-skill-chayuan.mdc"
    echo "  ✓ Cursor 规则 → $dest/wps-skill-chayuan.mdc（.mdc 格式）"
  else
    echo "  · Cursor：formats/cursor.mdc 缺失，跳过规则文件" >&2
  fi
}

deploy_codex() {
  local f="$HOME/.codex/config.toml"; mkdir -p "$(dirname "$f")"
  if [[ -f "$f" ]] && grep -q "$MCP_NAME" "$f"; then
    echo "  · Codex MCP 已存在 ${MCP_NAME}，跳过"
  else
    printf '\n[mcp_servers.%s]\nurl = "%s"\n' "$MCP_NAME" "$MCP_URL" >> "$f"
    echo "  ✓ Codex MCP → $f"
  fi
  local tmpl; tmpl="$(skill_tmpl)"
  if [[ -f "$tmpl/formats/codex.prompt.md" ]]; then
    local dest="$HOME/.codex/prompts"; mkdir -p "$dest"
    cp -f "$tmpl/formats/codex.prompt.md" "$dest/wps-skill-chayuan.md"
    echo "  ✓ Codex prompt → $dest/wps-skill-chayuan.md（会话内 /wps-skill-chayuan）"
  else
    echo "  · Codex：formats/codex.prompt.md 缺失，跳过" >&2
  fi
}

print_gui_hint() {
  cat <<EOF
  · OpenClaw / Hermes（GUI）：新建 MCP 服务，类型 HTTP/Streamable HTTP
      URL=$MCP_URL  名称=$MCP_NAME  Token/command/stdio 留空
      （GUI agent 无公开 skill 文件格式，技能纪律见包内 skill-chayuan/formats/generic.prompt.md）
EOF
}

# 是否对该 agent 投放：--no-agent 否决；--with-* 强制；否则按检测结果
agent_run() {
  [[ "$DO_AGENT" -eq 0 ]] && return 1
  case "$1" in
    claude) [[ "$WITH_CLAUDE" -eq 1 ]] && return 0; detect_claude && return 0; return 1 ;;
    cursor) [[ "$WITH_CURSOR" -eq 1 ]] && return 0; detect_cursor && return 0; return 1 ;;
    codex)  [[ "$WITH_CODEX"  -eq 1 ]] && return 0; detect_codex  && return 0; return 1 ;;
  esac
  return 1
}

if [[ "$DO_AGENT" -eq 1 ]]; then
  echo "[wps-skill-chayuan] STEP 4 agent 自动检测 + 技能投放（按各自格式；--no-agent 跳过）"
  if agent_run claude; then deploy_claude; fi
  if agent_run cursor; then deploy_cursor; fi
  if agent_run codex;  then deploy_codex;  fi
  print_gui_hint
fi

# ─────────────────────── 收尾 ───────────────────────
echo ""
echo "[wps-skill-chayuan] 完成。自检：L1=$L1 L2=$L2 L3=$L3 L4=$L4"
if [[ "$L1" -eq 1 && "$L2" -eq 1 ]]; then
  echo "  下一步：关闭并重新打开 WPS 文字 → 出现察元 → 客户端刷新 MCP → 说「用 wps-skill-chayuan 校对」"
else
  echo "  ⚠ 有级未通过：L1 失败查 jsaddons 路径/publish.xml；L2 失败查自启日志 ~/.config/chayuan-wps/mcp/"
  exit 1
fi
