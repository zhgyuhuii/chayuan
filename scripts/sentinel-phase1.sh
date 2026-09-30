#!/usr/bin/env bash
# 温和哨兵：不杀 WPS。每 20s 探测一次宿主注册（ribbon 仅在解锁后初始化）。
# 解锁瞬间 → 截图 + 报告 → 退出（退出码 0），由外部接力跑逐项测试。
set -u
BASE=http://127.0.0.1:62588
OUT_DIR=/tmp/chayuan-verify
mkdir -p "$OUT_DIR"
log() { echo "[sentinel $(date +%H:%M:%S)] $*"; }
hosts_online() {
  curl -s "$BASE/healthz" | python3 -c "import json,sys;print(','.join(k for k,v in json.load(sys.stdin).get('agent',{}).get('hosts',{}).items() if v))" 2>/dev/null
}
# 确保有个 Writer 文档开着（tab 出现在文档窗口）
open -a wpsoffice /tmp/writer-test.docx 2>/dev/null
for i in $(seq 1 150); do
  H=$(hosts_online)
  if [[ -n "$H" ]]; then
    log "宿主已注册: $H（已解锁，ribbon 已加载）"
    sleep 2
    screencapture -x "$OUT_DIR/phase1-tab-restored.png" && log "截图 → $OUT_DIR/phase1-tab-restored.png"
    exit 0
  fi
  # 每 5 轮温和地确保 WPS 开着（open 已运行时只是前置窗口，不重启）
  if (( i % 5 == 0 )); then open -a wpsoffice /tmp/writer-test.docx 2>/dev/null; fi
  sleep 20
done
log "150 轮（50 分钟）未检测到宿主注册，退出"
exit 1
