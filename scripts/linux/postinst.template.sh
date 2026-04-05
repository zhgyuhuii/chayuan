#!/bin/sh
# Copies add-in into the invoking user's jsaddons (typical: sudo dpkg -i).
set -e
INSTALL_ROOT="__INSTALL_ROOT__"
META="$INSTALL_ROOT/install.json"
if ! test -f "$META"; then
	echo "chayuan-wps-addon: missing $META" >&2
	exit 1
fi
ADDON_FOLDER="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['addonFolder'])" "$META")"

TARGET_USER="${SUDO_USER:-$USER}"
if test -z "$TARGET_USER"; then
	echo "chayuan-wps-addon: could not determine user; files are under $INSTALL_ROOT" >&2
	exit 0
fi
USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if test -z "$USER_HOME" || ! test -d "$USER_HOME"; then
	USER_HOME="/home/$TARGET_USER"
fi

DEST="$USER_HOME/.local/share/Kingsoft/wps/jsaddons"
mkdir -p "$DEST"
rm -rf "$DEST/$ADDON_FOLDER"
cp -R "$INSTALL_ROOT/$ADDON_FOLDER" "$DEST/"
cp -f "$INSTALL_ROOT/publish.xml" "$DEST/"
chown -R "$TARGET_USER:$TARGET_USER" "$DEST/$ADDON_FOLDER" "$DEST/publish.xml" 2>/dev/null || true
echo "chayuan-wps-addon: installed to $DEST"

# Deepin / UOS path (best-effort)
ALT="/opt/kingsoft/wps-office/office6/jsaddons"
if test -d "$(dirname "$ALT")"; then
	mkdir -p "$ALT"
	cp -R "$INSTALL_ROOT/$ADDON_FOLDER" "$ALT/" 2>/dev/null || true
	cp -f "$INSTALL_ROOT/publish.xml" "$ALT/" 2>/dev/null || true
fi

exit 0
