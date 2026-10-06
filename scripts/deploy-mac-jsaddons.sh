#!/bin/zsh
# Mac 三宿主 jsaddons 快速部署（真机调试用）。
# 关键：宿主目录的 ribbon.xml 必须用宿主专用源覆盖（build-wps-addon.mjs staging 同款逻辑）——
# 裸 rsync dist/ 会把合并版 ribbon.xml（writer+ET+WPP 四 tab）铺进三个目录，
# 造成表格宿主显示演示菜单、演示宿主显示表格菜单（2026-10-06 真机事故，勿再犯）。
# 正式发布走 npm run build:wps-all + pack，不经本脚本。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
JSADDONS="${CHAYUAN_JSADDONS:-$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons}"
VERSION="$(node -p "require('$ROOT/package.json').version")"

[[ -f "$DIST/ribbon-et.xml" && -f "$DIST/ribbon-wpp.xml" ]] || { echo "✗ dist 缺宿主 ribbon 源（先 npm run build）"; exit 1 }

dirs=(chayuan chayuan-et chayuan-wpp)
for d in $dirs; do
  target="$JSADDONS/${d}_${VERSION}"
  mkdir -p "$target"
  rsync -a --delete "$DIST/" "$target/"
  # 宿主专用 ribbon 覆盖 + 源文件不进产物（staging 145-147 同款清理）
  if [[ "$d" == chayuan-et ]]; then
    cp "$DIST/ribbon-et.xml" "$target/ribbon.xml"; rm -f "$target/ribbon-et.xml" "$target/ribbon-wpp.xml"
  elif [[ "$d" == chayuan-wpp ]]; then
    cp "$DIST/ribbon-wpp.xml" "$target/ribbon.xml"; rm -f "$target/ribbon-et.xml" "$target/ribbon-wpp.xml"
  fi
  echo "✓ $d: tabs=$(grep -o 'id="tab[A-Za-z0-9_]*"' "$target/ribbon.xml" | sort -u | tr '\n' ' ')"
done
echo "完成。重启 WPS 加载（首启若弹「已被修改」点确定）。"
