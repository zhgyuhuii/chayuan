#!/bin/bash
# Installs Chayuan WPS add-in into the console user's jsaddons (no manual copy).
set -e
INSTALL_ROOT="__INSTALL_ROOT__"
META="$INSTALL_ROOT/install.json"
if [[ ! -f "$META" ]]; then
	echo "Chayuan WPS: missing $META" >&2
	exit 1
fi
export CHAYUAN_META="$META"
ADDON_FOLDER="$(/usr/bin/python3 -c 'import json,os; print(json.load(open(os.environ["CHAYUAN_META"]))["addonFolder"])')"

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

install_one() {
	local dest="$1"
	[[ -z "$dest" ]] && return 0
	/bin/mkdir -p "$dest"
	/bin/cp -R "$INSTALL_ROOT/$ADDON_FOLDER" "$dest/"
	/bin/cp -f "$INSTALL_ROOT/publish.xml" "$dest/"
	/usr/sbin/chown -R "$CONSOLE_USER:staff" "$dest/$ADDON_FOLDER" "$dest/publish.xml" 2>/dev/null || true
	echo "Chayuan WPS: installed to $dest"
}

# Sandboxed WPS for Mac (common)
install_one "$USER_HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
# Non-sandbox / older layouts (best-effort)
install_one "$USER_HOME/Library/Application Support/Kingsoft/wps/jsaddons"

exit 0
