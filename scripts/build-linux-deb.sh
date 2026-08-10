#!/usr/bin/env bash
# Produces release/<package.json name>-<version>-linux-<arch>.deb（Debian/Ubuntu; requires dpkg-deb）。
#
# 跨平台构建：默认内嵌 linux-x64 sidecar 二进制（与 build:wps-exe 一致，不依赖构建机架构）。
#   覆盖架构：  CHAYUAN_LINUX_ARCH=arm64 npm run build:wps-deb
#           或  npm run build:wps-deb -- arm64
# 二进制缺失时仅告警（安装后 install-linux-user.sh 回落 node server.mjs）。

# 容错:有人会 `sh scripts/build-linux-deb.sh` 跑,绕过 shebang
# 进入 dash/busybox-sh,而它们不支持 `set -o pipefail`。这里自动 re-exec 到 bash。
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    else
        echo "本脚本需要 bash;请安装 bash 后重试(apt install bash / apk add bash)。" >&2
        exit 1
    fi
fi
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v dpkg-deb >/dev/null 2>&1; then
	echo "dpkg-deb not found. Install with: sudo apt install dpkg-dev" >&2
	exit 1
fi

# 目标架构：环境变量 > 第一个位置参数 > 默认 x64（最常见县级部署目标）。
ARCH_ID="${CHAYUAN_LINUX_ARCH:-${1:-x64}}"
case "$ARCH_ID" in
	x64|amd64) ARCH_ID="x64"; DEB_ARCH="amd64" ;;
	arm64|aarch64) ARCH_ID="arm64"; DEB_ARCH="arm64" ;;
	*) echo "不支持的架构: $ARCH_ID（仅支持 x64 / arm64）" >&2; exit 1 ;;
esac

npm run build:wps-all

VERSION="$(node -p "require('./package.json').version")"
NAME="$(node -p "require('./package.json').name")"
STAGING="$ROOT/release/install-staging"
if [[ ! -f "$STAGING/install.json" ]]; then
	echo "Missing release/install-staging." >&2
	exit 1
fi

DEB_ROOT="$ROOT/release/.deb-build"
rm -rf "$DEB_ROOT"
INSTALL_ROOT="__INSTALL_ROOT__"
# shellcheck disable=SC2034
PKG_DIR="$DEB_ROOT/opt/chayuan-wps-addon"
ADDON_DIR="$PKG_DIR/${NAME}_${VERSION}"
mkdir -p "$PKG_DIR" "$DEB_ROOT/DEBIAN"
cp -R "$STAGING/"* "$PKG_DIR/"
cp "$ROOT/scripts/linux/publish-merge-fileurl.py" "$PKG_DIR/"
chmod 0755 "$PKG_DIR/publish-merge-fileurl.py"

# --- 跨平台：用目标架构的 sidecar 二进制替换 staging 里(构建机平台)的二进制 ---
SIDECAR_BIN_SRC="$ROOT/mcp-sidecar/bin/chayuan-mcp-linux-${ARCH_ID}"
rm -rf "$ADDON_DIR/mcp-sidecar/bin"
if [[ -f "$SIDECAR_BIN_SRC" ]]; then
	mkdir -p "$ADDON_DIR/mcp-sidecar/bin"
	cp "$SIDECAR_BIN_SRC" "$ADDON_DIR/mcp-sidecar/bin/"
	chmod 0755 "$ADDON_DIR/mcp-sidecar/bin/chayuan-mcp-linux-${ARCH_ID}"
	echo "Embedded sidecar binary: chayuan-mcp-linux-${ARCH_ID}"
else
	echo "⚠ 缺 mcp-sidecar/bin/chayuan-mcp-linux-${ARCH_ID}（先跑 npm run mcp:build-binary）。deb 仍会产出，但安装后将回落 node server.mjs（需 Node）。" >&2
fi

cat >"$DEB_ROOT/DEBIAN/control" <<EOF
Package: chayuan-wps-addon
Version: $VERSION
Section: utils
Priority: optional
Architecture: $DEB_ARCH
Maintainer: Chayuan <support@aidooo.com>
Description: Chayuan AI WPS Writer JS add-in (offline)
 Installs offline WPS js add-on files into the user's Kingsoft jsaddons path.
 Embedded chayuan-mcp sidecar binary for linux-${ARCH_ID}.
Depends: python3
EOF

sed "s|__INSTALL_ROOT__|/opt/chayuan-wps-addon|g" \
	"$ROOT/scripts/linux/postinst.template.sh" >"$DEB_ROOT/DEBIAN/postinst"
# 剥离可能的 UTF-8 BOM：BOM 会破坏 #! shebang，dpkg 执行 postinst 失败 → 安装中断。
if [[ "$(head -c 3 "$DEB_ROOT/DEBIAN/postinst" | od -An -tx1 | tr -d ' ')" == "efbbbf" ]]; then
	tail -c +4 "$DEB_ROOT/DEBIAN/postinst" > "$DEB_ROOT/DEBIAN/postinst.tmp" && mv "$DEB_ROOT/DEBIAN/postinst.tmp" "$DEB_ROOT/DEBIAN/postinst"
fi
chmod 0755 "$DEB_ROOT/DEBIAN/postinst"
# 保险：渲染后确认首两字节为 '#!'，否则立即中止构建（绝不打包坏 shebang）
if [[ "$(head -c 2 "$DEB_ROOT/DEBIAN/postinst")" != "#!" ]]; then
	echo "ERROR: postinst shebang broken (expected '#!', got: $(head -c 6 "$DEB_ROOT/DEBIAN/postinst" | od -An -c | tr -d '\n'))" >&2
	exit 1
fi

OUT_DEB="$ROOT/release/${NAME}-${VERSION}-linux-${ARCH_ID}.deb"
# --root-owner-group：把包内文件属主统一为 root:root（非 Linux 构建机上是 501:20 之类，不规范）。
dpkg-deb --build --root-owner-group "$DEB_ROOT" "$OUT_DEB"
rm -rf "$DEB_ROOT"
node "$ROOT/scripts/write-release-manifest.mjs" "release/${NAME}-${VERSION}-linux-${ARCH_ID}.deb"
echo "Built: $OUT_DEB (linux ${ARCH_ID}; sudo dpkg -i ... ; then restart WPS)"
