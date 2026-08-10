#!/usr/bin/env bash
# Start chayuan-mcp: prefer packaged native binary, fall back to node server.mjs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

case "$(uname -s)" in
  Darwin) PLATFORM=macos ;;
  Linux) PLATFORM=linux ;;
  *) PLATFORM=unknown ;;
esac

case "$(uname -m)" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64|amd64) ARCH=x64 ;;
  *) ARCH="$(uname -m)" ;;
esac

BIN="$ROOT/bin/chayuan-mcp-${PLATFORM}-${ARCH}"
if [[ -x "$BIN" ]]; then
  echo "[chayuan-mcp] starting native binary: $BIN" >&2
  exec "$BIN"
fi

# Try the other macOS arch when Rosetta / wrong staging occurs.
if [[ "$PLATFORM" == "macos" ]]; then
  ALT_ARCH=$([[ "$ARCH" == "arm64" ]] && echo x64 || echo arm64)
  ALT="$ROOT/bin/chayuan-mcp-macos-$ALT_ARCH"
  if [[ -x "$ALT" ]]; then
    echo "[chayuan-mcp] starting alternate binary: $ALT" >&2
    exec "$ALT"
  fi
fi

if command -v node >/dev/null 2>&1 && [[ -f "$ROOT/server.mjs" ]]; then
  echo "[chayuan-mcp] binary missing; falling back to node server.mjs" >&2
  exec node "$ROOT/server.mjs"
fi

echo "[chayuan-mcp] Neither native binary nor node+server.mjs available under $ROOT" >&2
exit 1
