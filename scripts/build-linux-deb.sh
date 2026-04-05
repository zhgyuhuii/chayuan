#!/usr/bin/env bash
# Produces release/chayuan-wps-addon_<version>_all.deb (run on Debian/Ubuntu; requires dpkg-deb).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v dpkg-deb >/dev/null 2>&1; then
	echo "dpkg-deb not found. Install with: sudo apt install dpkg-dev" >&2
	exit 1
fi

npm run build:wps-all

VERSION="$(node -p "require('./package.json').version")"
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

OUT_DEB="$ROOT/release/chayuan-wps-addon_${VERSION}_all.deb"
dpkg-deb --build "$DEB_ROOT" "$OUT_DEB"
rm -rf "$DEB_ROOT"
echo "Built: $OUT_DEB (sudo dpkg -i ... ; then restart WPS)"
