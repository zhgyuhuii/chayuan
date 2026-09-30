#!/usr/bin/env bash
# 察元 WPS 三宿主 MCP 真机验证（macOS）——逐项测试 + 每项截图
# 用途：解锁后运行（或由自动哨兵调用），一键完成 表格(ET)/演示(WPP) 宿主的端到端验证。
# 前置（本仓库 5.1.4 多宿主版已就绪）：
#   1) sidecar 已运行且为本次构建的新二进制（launchd 自启，端口 62588）
#   2) jsaddons 已安装（publish-shared-dir.xml 三 type 条目 → chayuan_5.1.4 共用目录）
set -uo pipefail

BASE=http://127.0.0.1:62588
TOKEN_FILE=~/.config/chayuan-wps/mcp/token
OUT_DIR=/tmp/chayuan-verify
mkdir -p "$OUT_DIR"
TOKEN=$(cat "$TOKEN_FILE" 2>/dev/null || true)
AUTH=()
[ -n "$TOKEN" ] && AUTH=(-H "X-Chayuan-Token: $TOKEN")

log() { echo "[verify $(date +%H:%M:%S)] $*"; }

mcp() { # mcp <tool> <json-args>
  curl -s -X POST "$BASE/mcp" -H 'Content-Type: application/json' "${AUTH[@]+"${AUTH[@]}"}" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"
}

hosts_online() {
  curl -s "$BASE/healthz" | python3 -c "import json,sys;print(','.join(k for k,v in json.load(sys.stdin).get('agent',{}).get('hosts',{}).items() if v))" 2>/dev/null
}

wait_hosts() { # wait_hosts <期望包含的宿主> <最长秒数>
  local want="$1" limit="${2:-60}" got=""
  for ((i=0; i<limit/2; i++)); do
    got=$(hosts_online)
    [[ "$got" == *"$want"* ]] && { log "宿主已注册: $got"; return 0; }
    sleep 2
  done
  log "超时：期望 $want 在线，实际: ${got:-无}"
  return 1
}

shot() { screencapture -x "$OUT_DIR/$1" 2>/dev/null && log "截图 → $OUT_DIR/$1"; }

# ---------- 0) sidecar 健康 + 测试文件 ----------
log "sidecar: $(curl -s "$BASE/healthz" | head -c 160)"
python3 - <<'PY'
import openpyxl
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "销售数据"
for r in [["产品","季度","销量","单价","营收"],["察元AI文档助手","Q1",1200,299,None],["察元AI表格助手","Q1",800,399,None],["察元AI演示助手","Q1",600,499,None]]:
    ws.append(r)
wb.save("/tmp/chayuan-et-test.xlsx")
from pptx import Presentation
prs = Presentation(); s = prs.slides.add_slide(prs.slide_layouts[0])
s.shapes.title.text = "察元AI季度汇报"; s.placeholders[1].text = "2026 Q3"
prs.save("/tmp/chayuan-wpp-test.pptx")
print("[verify] 测试文件已重建")
PY

# ---------- 0.5) 等待解锁：锁屏时 WPS 功能区 webview 不启动，宿主不会注册 ----------
log "等待解锁并拉起 WPS（每 25s 尝试一次，最多 40 分钟）…"
ET_READY=0
for attempt in $(seq 1 96); do
  osascript -e 'tell application "wpsoffice" to quit' >/dev/null 2>&1 || true
  sleep 2
  open -a wpsoffice /tmp/chayuan-et-test.xlsx 2>/dev/null
  for ((i=0; i<3; i++)); do
    if [[ "$(hosts_online)" == *"et"* ]]; then ET_READY=1; break; fi
    sleep 8
  done
  [[ "$ET_READY" -eq 1 ]] && { log "第 $attempt 次尝试：表格宿主已注册（已解锁）"; break; }
  log "第 $attempt 次尝试：宿主未注册（可能仍锁屏），继续等待…"
done
if [[ "$ET_READY" -ne 1 ]]; then
  log "❌ 40 分钟内表格宿主未注册（大概率一直锁屏）。解锁后重跑本脚本即可。"
  shot "0-still-locked.png"
  exit 1
fi
sleep 3
shot "01-et-opened.png"

# ---------- 1) 表格宿主：逐项测试 ----------
log "【项1】写表格数据（range_write 追加 Q3 两行 + 营收公式）"
mcp spreadsheet '{"action":"range_write","startCell":"A7","values":[["察元AI文档助手","Q3",2000,299,"=C7*D7"],["察元AI表格助手","Q3",1600,399,"=C8*D8"]],"confirmed":true}' > "$OUT_DIR/r1.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r1.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 1; shot "02-et-range-write.png"

log "【项2】补全营收列公式（E2:E6）"
mcp spreadsheet '{"action":"range_write","startCell":"E2","values":[["=C2*D2"],["=C3*D3"],["=C4*D4"],["=C5*D5"],["=C6*D6"]],"confirmed":true}' > "$OUT_DIR/r2.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r2.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 2; shot "03-et-formulas.png"

log "【项3】表头样式（加粗 + 浅蓝底色）"
mcp spreadsheet '{"action":"format","range":"A1:E1","style":{"bold":true,"bgColor":"#DDEBF7"},"confirmed":true}' > "$OUT_DIR/r3.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r3.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 1; shot "04-et-format.png"

log "【项4】按销量降序排序（A2:E8）"
mcp spreadsheet '{"action":"sort","range":"A2:E8","keyColumn":3,"order":"desc","header":false,"confirmed":true}' > "$OUT_DIR/r4.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r4.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 1; shot "05-et-sort.png"

log "【项5】读回校验（range_read A1:E8）"
mcp spreadsheet '{"action":"range_read","range":"A1:E8"}' > "$OUT_DIR/et-range-read.json"
python3 - <<PY
import json
d = json.load(open('$OUT_DIR/et-range-read.json'))
sc = d.get('structuredContent', d)
vals = sc.get('values', [])
print(' → rows =', len(vals), '| 首行 =', vals[0] if vals else None)
print(' → 营收列（公式计算值）:', [row[4] if len(row) > 4 else None for row in vals[1:]], '(写的是公式，读取到的是计算结果即证明公式生效)')
PY
sleep 1; shot "06-et-readback.png"

log "【项6】柱状图（chart_add，数据 A1:B7）"
mcp spreadsheet '{"action":"chart_add","dataRange":"A1:B7","type":"column","title":"各产品季度销量","confirmed":true}' > "$OUT_DIR/r6.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r6.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 2; shot "07-et-chart.png"

log "【项7】导出 CSV + PDF"
mcp spreadsheet '{"action":"export","format":"csv","path":"/tmp/chayuan-et-export.csv","confirmed":true}' | head -c 200; echo
mcp spreadsheet '{"action":"export","format":"pdf","path":"/tmp/chayuan-et-export.pdf","confirmed":true}' | head -c 200; echo
ls -l /tmp/chayuan-et-export.csv /tmp/chayuan-et-export.pdf 2>/dev/null || log "⚠ 导出文件缺失"
shot "08-et-exports.png"

# ---------- 2) 演示宿主：逐项测试 ----------
log "【项8】打开演示测试文件（WPP 宿主注册）"
open -a wpsoffice /tmp/chayuan-wpp-test.pptx
wait_hosts wpp 60 || { log "❌ 演示宿主未注册"; shot "09-wpp-fail.png"; exit 1; }
sleep 3
shot "10-wpp-opened.png"

log "【项9】新增幻灯片（slide_add 标题页 + 标题/正文）"
mcp presentation '{"action":"slide_add","index":2,"layout":"titleOnly","title":"表格助手战报","content":"Q3 表格助手新增 1600 单","confirmed":true}' > "$OUT_DIR/r9.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r9.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 1; shot "11-wpp-slide-add.png"

log "【项10】加文本框（textbox_add 20 号字）"
mcp presentation '{"action":"textbox_add","index":2,"text":"由察元AI通过 MCP 自动生成","left":80,"top":320,"width":640,"height":60,"fontSize":20,"confirmed":true}' > "$OUT_DIR/r10.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/r10.json'));print(' →',json.dumps(d.get('structuredContent',d))[:200])"
sleep 1; shot "12-wpp-textbox.png"

log "【项11】页清单读回（slide_list）"
mcp presentation '{"action":"slide_list"}' > "$OUT_DIR/wpp-slide-list.json"
python3 -c "import json;d=json.load(open('$OUT_DIR/wpp-slide-list.json'));sc=d.get('structuredContent',d);print(' →',[(s['index'],s['title']) for s in sc.get('slides',[])])"
shot "13-wpp-readback.png"

log "【项12】演示导出 PDF"
mcp presentation '{"action":"export","format":"pdf","path":"/tmp/chayuan-wpp-export.pdf","confirmed":true}' | head -c 200; echo
ls -l /tmp/chayuan-wpp-export.pdf 2>/dev/null || log "⚠ PDF 缺失"
shot "14-wpp-export.png"

# ---------- 3) 汇总 ----------
echo
log "========== 验证汇总 =========="
echo "宿主在线: $(hosts_online)"
ls -l "$OUT_DIR"/*.png 2>/dev/null | awk '{print $NF}'
echo "导出文件: $(ls /tmp/chayuan-et-export.csv /tmp/chayuan-et-export.pdf /tmp/chayuan-wpp-export.pdf 2>/dev/null | tr '\n' ' ')"
