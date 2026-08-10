#!/usr/bin/env bash
# Double-clickable installer: release/<package.json name>-<version>-macos-<arch>.pkg（仅能在 macOS 上构建）。
# arch: arm64 (Apple Silicon) or x64 (Intel)，与当前构建机 uname -m 一致。

# 容错:绕 shebang 用 sh 跑时回到 bash(pipefail / [[ ]] 都是 bash-only)
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    else
        echo "本脚本需要 bash。" >&2
        exit 1
    fi
fi
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
	echo "Run this script on macOS." >&2
	exit 1
fi

ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
	arm64) ARCH_ID="arm64" ;;
	x86_64) ARCH_ID="x64" ;;
	*) ARCH_ID="$ARCH_RAW" ;;
esac

npm run build:wps-all

VERSION="$(node -p "require('./package.json').version")"
NAME="$(node -p "require('./package.json').name")"
STAGING="$ROOT/release/install-staging"
if [[ ! -f "$STAGING/install.json" ]]; then
	echo "Missing release/install-staging (run build:wps-all)." >&2
	exit 1
fi

PKG_ROOT="$ROOT/release/.mac-pkg-root"
SCRIPTS_DIR="$ROOT/release/.mac-scripts"
rm -rf "$PKG_ROOT" "$SCRIPTS_DIR"
PAYLOAD="$PKG_ROOT/Library/Application Support/ChayuanWPS"
mkdir -p "$PAYLOAD"
cp -R "$STAGING/"* "$PAYLOAD/"

mkdir -p "$SCRIPTS_DIR"
sed "s|__INSTALL_ROOT__|/Library/Application Support/ChayuanWPS|g" \
	"$ROOT/scripts/macos/postinstall.template.sh" >"$SCRIPTS_DIR/postinstall"
# 剥离可能的 UTF-8 BOM：BOM 会让首字节变成 ef bb bf，内核识别不了 #! shebang，
# macOS 安装器执行 postinstall 失败 → 双击安装报「安装器遇到一个错误」。
if [[ "$(head -c 3 "$SCRIPTS_DIR/postinstall" | od -An -tx1 | tr -d ' ')" == "efbbbf" ]]; then
	tail -c +4 "$SCRIPTS_DIR/postinstall" > "$SCRIPTS_DIR/postinstall.tmp" && mv "$SCRIPTS_DIR/postinstall.tmp" "$SCRIPTS_DIR/postinstall"
fi
chmod +x "$SCRIPTS_DIR/postinstall"
# 保险：渲染后确认首两字节为 '#!'，否则立即中止构建（绝不打包坏 shebang）
if [[ "$(head -c 2 "$SCRIPTS_DIR/postinstall")" != "#!" ]]; then
	echo "ERROR: postinstall shebang broken (expected '#!', got: $(head -c 6 "$SCRIPTS_DIR/postinstall" | od -An -c | tr -d '\n'))" >&2
	exit 1
fi

OUT_PKG="$ROOT/release/${NAME}-${VERSION}-macos-${ARCH_ID}.pkg"
pkgbuild \
	--root "$PKG_ROOT" \
	--scripts "$SCRIPTS_DIR" \
	--identifier "com.aidooo.chayuan.wpsaddon" \
	--version "$VERSION" \
	--install-location / \
	"$OUT_PKG"

rm -rf "$PKG_ROOT" "$SCRIPTS_DIR"
node "$ROOT/scripts/write-release-manifest.mjs" "release/${NAME}-${VERSION}-macos-${ARCH_ID}.pkg"
echo "Built: $OUT_PKG (macOS ${ARCH_ID}; double-click to install; may need Right-click → Open if unsigned)"
