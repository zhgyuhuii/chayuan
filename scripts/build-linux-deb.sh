#!/usr/bin/env bash
# Produces release/<package.json name>-<version>-linux-<arch>.deb（Debian/Ubuntu; requires dpkg-deb）。
# arch 与构建机 uname -m 一致（x64/arm64）；包内仍为 Architecture: all（纯 JS 资源）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v dpkg-deb >/dev/null 2>&1; then
	echo "dpkg-deb not found. Install with: sudo apt install dpkg-dev" >&2
	exit 1
fi

ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
	arm64|aarch64) ARCH_ID="arm64" ;;
	x86_64|amd64) ARCH_ID="x64" ;;
	*) ARCH_ID="$ARCH_RAW" ;;
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
mkdir -p "$PKG_DIR" "$DEB_ROOT/DEBIAN"
cp -R "$STAGING/"* "$PKG_DIR/"
cp "$ROOT/scripts/linux/publish-merge-fileurl.py" "$PKG_DIR/"
chmod 0755 "$PKG_DIR/publish-merge-fileurl.py"

cat >"$DEB_ROOT/DEBIAN/control" <<EOF
Package: chayuan-wps-addon
Version: $VERSION
Section: utils
Priority: optional
Architecture: all
Maintainer: Chayuan <support@aidooo.com>
Description: Chayuan AI WPS Writer JS add-in (offline)
 Installs offline WPS js add-on files into the user's Kingsoft jsaddons path.
Depends: python3
EOF

sed "s|__INSTALL_ROOT__|/opt/chayuan-wps-addon|g" \
	"$ROOT/scripts/linux/postinst.template.sh" >"$DEB_ROOT/DEBIAN/postinst"
chmod 0755 "$DEB_ROOT/DEBIAN/postinst"

OUT_DEB="$ROOT/release/${NAME}-${VERSION}-linux-${ARCH_ID}.deb"
dpkg-deb --build "$DEB_ROOT" "$OUT_DEB"
rm -rf "$DEB_ROOT"
node "$ROOT/scripts/write-release-manifest.mjs" "release/${NAME}-${VERSION}-linux-${ARCH_ID}.deb"
echo "Built: $OUT_DEB (linux ${ARCH_ID}; sudo dpkg -i ... ; then restart WPS)"
