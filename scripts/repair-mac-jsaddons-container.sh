#!/usr/bin/env bash
# 容器 jsaddons 修复安装（真机排障用）。纯 bash（macOS 自带 3.2 可跑）。
#
# 用法：
#   bash scripts/repair-mac-jsaddons-container.sh            # 装/重装当前版本到容器
#   bash scripts/repair-mac-jsaddons-container.sh rollback   # 回滚到 6.1.0 备份（恢复可用）
#   bash scripts/repair-mac-jsaddons-container.sh status     # 只看容器实况，不改任何东西
#
# 背景（2026-10-28 真机事故）：macOS 收紧 TCC 后，pkg 安装器的 Installer.app 没有
# 完全磁盘访问权限，写 WPS 沙盒容器 jsaddons 全部 EPERM。安装「成功」只落在
# WPS（沙盒版）根本不读的非容器路径 → 表现为「装完还是旧版」。
# v1 教训：set -e 下清理旧目录若 rm 失败会中途暴毙，留下「旧目录已删、新目录未装、
# 注册表悬空」的不可加载状态（本次真机复现）→ v2 清理失败只告警不中断。
set -uo pipefail
shopt -s nullglob

MODE="${1:-install}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STG="$ROOT/release/install-staging"
WPS_DATA="$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data"
JSADDONS="${CHAYUAN_JSADDONS:-$WPS_DATA/.kingsoft/wps/jsaddons}"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OLD_VERSION="6.1.0"
BAK="$HOME/Library/Application Support/Kingsoft/wps/jsaddons/.bak-$OLD_VERSION"

die() { echo "✗ $*"; exit 1; }

echo "== 容器实况（${JSADDONS}）=="
ls -la "$JSADDONS" 2>/dev/null || echo "  (不可读或不存在)"
for f in jsplugins.xml authaddin.json; do
  if [[ -f "$JSADDONS/$f" ]]; then
    echo "-- $f --"
    head -c 2000 "$JSADDONS/$f"; echo
  else
    echo "-- $f 不存在于 jsaddons 根 --"
  fi
done

[[ "$MODE" == "status" ]] && exit 0

if pgrep -xq wpsoffice 2>/dev/null; then
  die "WPS 正在运行。先退出：osascript -e 'quit app \"wpsoffice\"'（退出时会覆写注册表，必须先退）"
fi

# 探针：无权限立刻失败并给出指引，不做半套
probe="$JSADDONS/.chayuan-repair-probe"
if mkdir -p "$JSADDONS" 2>/dev/null && touch "$probe" 2>/dev/null; then
  rm -f "$probe" 2>/dev/null
else
  die "容器 jsaddons 不可写（TCC）。系统设置 → 隐私与安全性 → 完全磁盘访问权限 → 添加你的终端/iTerm 后重试"
fi

sync_registries() {
  # $1 = 要写入的版本目录名映射目标（如 chayuan_6.1.1）；把注册表里所有旧版本段改成它
  local target_version="$1"
  # authaddin.json 可能不在 jsaddons 根（WPS 版本差异），全容器搜
  local aa hits=0
  while IFS= read -r aa; do
    sed -i '' -E \
      -e "s|/jsaddons/chayuan_[0-9][0-9.]*\"|/jsaddons/chayuan_$target_version\"|g" \
      -e "s|/jsaddons/chayuan-et_[0-9][0-9.]*\"|/jsaddons/chayuan-et_$target_version\"|g" \
      -e "s|/jsaddons/chayuan-wpp_[0-9][0-9.]*\"|/jsaddons/chayuan-wpp_$target_version\"|g" \
      "$aa" 2>/dev/null || echo "  △ authaddin.json 改写失败: $aa"
    echo "✓ 已同步注册表: $aa"
    hits=$((hits + 1))
  done < <(/usr/bin/find "$WPS_DATA" -name "authaddin.json" -maxdepth 9 2>/dev/null)
  [[ $hits -eq 0 ]] && echo "△ 未找到 authaddin.json（WPS 可能只按 jsplugins.xml 加载）"
  if [[ -f "$JSADDONS/jsplugins.xml" ]]; then
    local tmp="$JSADDONS/jsplugins.xml.repair"
    {
      echo '<?xml version="1.0" encoding="UTF-8"?>'
      echo '<jsplugins>'
      # v2 教训：<jsplugins> 开标签也必须滤掉，否则每跑一次累积一个开标签，
      # XML 畸形 → WPS 解析失败 → 整个插件不加载（2026-10-28 真机复现）
      grep -v 'name="chayuan' "$JSADDONS/jsplugins.xml" 2>/dev/null \
        | grep -v '<jsplugins' | grep -v '</jsplugins>' | grep -v '<?xml' || true
      grep 'name="chayuan' "$STG/publish.xml" 2>/dev/null || true
      echo '</jsplugins>'
    } > "$tmp" 2>/dev/null && mv -f "$tmp" "$JSADDONS/jsplugins.xml" 2>/dev/null \
      && echo "✓ jsplugins.xml 本产品条目已同步" \
      || echo "△ jsplugins.xml 同步失败（保留原文件）"
  fi
}

install_version() {
  local ver="$1" src_root="$2"
  local d
  for d in chayuan chayuan-et chayuan-wpp; do
    [[ -d "$src_root/${d}_$ver" ]] || die "缺 $src_root/${d}_$ver"
  done
  # 1) 清旧（失败只告警——v1 在这里被 set -e 打断过）
  local entry base
  for entry in "$JSADDONS"/chayuan_* "$JSADDONS"/chayuan-et_* "$JSADDONS"/chayuan-wpp_* "$JSADDONS"/.chayuan*.installing; do
    [[ -e "$entry" ]] || continue
    base="$(/usr/bin/basename "$entry")"
    case "$base" in
      chayuan_"$ver"|chayuan-et_"$ver"|chayuan-wpp_"$ver") continue ;;
    esac
    if rm -rf "$entry" 2>/dev/null && [[ ! -e "$entry" ]]; then
      echo "✓ 已清理旧目录: $base"
    else
      echo "△ 清理失败（忽略继续）: $base"
    fi
  done
  # 2) 装新
  for d in chayuan chayuan-et chayuan-wpp; do
    rm -rf "$JSADDONS/.${d}_$ver.installing" 2>/dev/null
    if ! ditto "$src_root/${d}_$ver" "$JSADDONS/.${d}_$ver.installing" 2>/dev/null; then
      die "ditto ${d}_$ver 失败（TCC？）——上面的容器实况发回来"
    fi
    rm -rf "$JSADDONS/${d}_$ver" 2>/dev/null
    mv "$JSADDONS/.${d}_$ver.installing" "$JSADDONS/${d}_$ver"
    echo "✓ 已安装: ${d}_$ver -> 容器 jsaddons"
  done
  sync_registries "$ver"
}

if [[ "$MODE" == "rollback" ]]; then
  [[ -d "$BAK" ]] || die "回滚源不存在：$BAK"
  echo "== 回滚到 $OLD_VERSION（恢复上次可用的旧版）=="
  install_version "$OLD_VERSION" "$BAK"
  echo "回滚完成。启动 WPS 应恢复旧版加载。"
else
  echo "== 安装 $VERSION 到容器 =="
  install_version "$VERSION" "$STG"
  # 清 jsapi HTTP 缓存：排除 webview 加载层命中旧包（缓存可再生，无风险）
  CACHE="$WPS_DATA/.kingsoft/wps/addons/data/mac-universal/jsapi/cache"
  if [[ -d "$CACHE" ]]; then
    rm -rf "$CACHE" 2>/dev/null && echo "✓ 已清 jsapi HTTP 缓存" || echo "△ jsapi 缓存清理失败（一般不影响）"
  fi
fi

echo "== 结果自检 =="
if [[ -d "$JSADDONS/chayuan_$VERSION" ]]; then
  echo "  ✓ chayuan_$VERSION 在容器"
else
  echo "  ✗ chayuan_$VERSION 不在容器（异常）"
fi
/usr/bin/grep -o '<jsplugin name="chayuan[^>]*' "$JSADDONS/jsplugins.xml" 2>/dev/null | sed 's/^/  /' || true
echo "-- jsplugins.xml 最终全文（人工核验 XML 完整性）--"
cat "$JSADDONS/jsplugins.xml" 2>/dev/null
echo "完成。启动 WPS；若首启弹「插件已被修改」点确定。验证：curl -s http://127.0.0.1:62588/healthz | grep -o addonVersion[^,]*"
