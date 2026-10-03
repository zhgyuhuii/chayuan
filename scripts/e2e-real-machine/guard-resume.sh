#!/bin/zsh
# 守护 v2：等另一会话的 run-v2.mjs 全部退出 → 部署修复包 → 重启 WPS → 重启本会话三车道。
cd "$(dirname "$0")"
ART=../../artifacts/e2e-180

echo "[guard] 等待 run-v2 退出…"
while pgrep -f "run-v2.mjs" > /dev/null 2>&1; do sleep 60; done
echo "[guard] v2 已退出 $(date '+%H:%M:%S')"

echo "[guard] 部署修复包到 jsaddons"
J=~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons
# 修复：dist/ 直铺会用 writer 版 ribbon.xml 覆盖 et/wpp 的宿主专属 ribbon（菜单串染根因）
for d in chayuan_5.1.7 chayuan-et_5.1.7 chayuan-wpp_5.1.7; do
  rsync -a --exclude='ribbon*.xml' /Users/zyh/work/chayuan-wps/dist/ "$J/$d/" 2>/dev/null
done
cp /Users/zyh/work/chayuan-wps/dist/ribbon.xml  "$J/chayuan_5.1.7/ribbon.xml" 2>/dev/null
cp /Users/zyh/work/chayuan-wps/dist/ribbon-et.xml  "$J/chayuan-et_5.1.7/ribbon.xml" 2>/dev/null
cp /Users/zyh/work/chayuan-wps/dist/ribbon-wpp.xml "$J/chayuan-wpp_5.1.7/ribbon.xml" 2>/dev/null

echo "[guard] 重启 WPS 加载修复版"
pkill -9 -f wpsoffice || true
sleep 5
rm -rf ~/Library/Saved\ Application\ State/com.kingsoft.wpsoffice.mac.savedState 2>/dev/null
open -a wpsoffice
sleep 15
osascript -e 'tell application "wpsoffice" to reopen' 2>/dev/null || true
sleep 5
FILES=/Users/zyh/work/chayuan-wps/artifacts/e2e-180/files
open -g -a wpsoffice "$FILES/doc-A-内容.docx"
sleep 8
open -a wpsoffice "$FILES/e2e-et.xlsx"
sleep 15
open -a wpsoffice "$FILES/e2e-wpp.pptx"
sleep 15
# 等三宿主在线（reopen 兜底一次）
for i in 1 2 3 4 5 6; do
  R=$(node -e 'import("/tmp/mcp_probe.mjs").then(async m => { const st = await m.tool("wps_status", {}); console.log(JSON.stringify(st?.agent?.hosts)); })' 2>/dev/null)
  echo "[guard] hosts=$R"
  echo "$R" | grep -q '"wpp":true' && echo "$R" | grep -q '"et":true' && echo "$R" | grep -q '"wps":true' && break
  if [ $i -eq 3 ]; then osascript -e 'tell application "wpsoffice" to reopen' 2>/dev/null || true; fi
  sleep 12
done

echo "[guard] 重新计算 pending 并重启三车道"
node -e '
import("node:fs").then(async (fs) => {
  const f = "/Users/zyh/work/chayuan-wps/artifacts/e2e-180/";
  function pending(host, all) {
    const last = new Map();
    const p = f + "results-" + host + ".jsonl";
    if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); last.set(r.id, r.pass); } catch {}
    }
    return all.filter(id => last.get(id) !== true);
  }
  const e = await import("./scenarios-et.mjs");
  const pp = await import("./scenarios-wpp.mjs");
  const w = await import("./scenarios-writer.mjs");
  const wave = ["W42","W41","W43","W44","W45"];
  console.log(pending("et", e.SCENARIOS.map(s => s.id)).join(","));
  console.log(pending("wpp", pp.SCENARIOS.map(s => s.id)).join(","));
  console.log(pending("wps", w.SCENARIOS.map(s => s.id)).filter(id => !wave.includes(id)).join(","));
});' 2>/dev/null > /tmp/pending.txt
sed -n '1p' /tmp/pending.txt > /tmp/only-et.txt
sed -n '2p' /tmp/pending.txt > /tmp/only-wpp.txt
sed -n '3p' /tmp/pending.txt > /tmp/only-writer.txt

rm -f "$ART/.llm.lock"
LANE_RESUME=1 IMG_FIRST=1 node run.mjs --lane et  --only "$(cat /tmp/only-et.txt)"  > /tmp/e2e-et.log 2>&1 &
sleep 10
LANE_RESUME=1 IMG_FIRST=1 node run.mjs --lane wpp --only "$(cat /tmp/only-wpp.txt)" > /tmp/e2e-wpp.log 2>&1 &
sleep 10
LANE_RESUME=1 node run.mjs --lane writer --only "$(cat /tmp/only-writer.txt)"       > /tmp/e2e-writer.log 2>&1 &
echo "[guard] 三车道已重启 $(date '+%H:%M:%S')"
wait
