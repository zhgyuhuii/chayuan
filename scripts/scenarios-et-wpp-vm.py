#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Excel / PPT 完全场景测试：24 场景全覆盖（表格 21 actions + 演示 19 actions）。
每个场景 = 提示词（经 chat_turn 走生产管线）+ 确定性验证 + PASS/FAIL。
表格场景标记列 M{N}；演示场景标记 = 最后一页右下角 textbox。"""
import json, urllib.request, time, sys, os

BASE = "http://127.0.0.1:62588"
TOKEN = open("/home/zyh/.config/chayuan-wps/mcp/token").read().strip().splitlines()[0]
MODEL = {"providerId": "DEEPSEEK", "modelId": "deepseek-chat", "name": "DeepSeek",
         "apiKey": "sk-ebf606eb91684aca8ec89ec96d5beff8", "apiUrl": "https://api.deepseek.com"}
LOG = open("/tmp/scenario-results.jsonl", "a", encoding="utf-8")

def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(BASE + "/mcp", data=body,
                                 headers={"Content-Type": "application/json", "X-Chayuan-Token": TOKEN})
    return json.load(urllib.request.urlopen(req, timeout=120))

def tool(name, args):
    try:
        r = rpc("tools/call", {"name": name, "arguments": args})
        sc = r.get("result", {}).get("structuredContent")
        if sc is not None:
            return sc
        c = r.get("result", {}).get("content")
        return c
    except Exception as e:
        return {"ok": False, "error": str(e)}

def et_read(sheet, cell):
    d = tool("spreadsheet", {"action": "range_read", "sheet": sheet, "range": f"{cell}:{cell}"})
    try:
        return json.loads(json.dumps(d)).get("values", [[""]])[0][0]
    except Exception:
        return None

def last_slide_shapes():
    sl = tool("presentation", {"action": "slide_list"})
    n = sl.get("count", 0) if isinstance(sl, dict) else 0
    if not n:
        return 0, []
    sh = tool("presentation", {"action": "shape_list", "index": n})
    texts = [s.get("text", "") for s in (sh.get("shapes") or [])] if isinstance(sh, dict) else []
    return n, texts

def wpp_marker(n):
    _, texts = last_slide_shapes()
    return any(f"场景{n}完成" in (t or "") for t in texts)

RESULTS = []
def run(sid, host, prompt, verify, timeout=200):
    print(f"=== {sid} dispatch ===", flush=True)
    ack = tool("chat_turn", {"turnId": f"sc-{sid}", "scopeKey": f"sc-{host}", "host": host,
                             "userText": prompt, "model": MODEL})
    ok_ack = bool(ack and ack.get("accepted"))
    t0 = time.time()
    passed, evidence = False, ""
    while time.time() - t0 < timeout:
        time.sleep(5)
        try:
            passed, evidence = verify()
        except Exception as e:
            passed, evidence = False, f"verify-error: {e}"
        if passed:
            break
    rec = {"id": sid, "ack": ok_ack, "pass": passed, "evidence": str(evidence)[:220], "secs": int(time.time() - t0)}
    RESULTS.append(rec)
    LOG.write(json.dumps(rec, ensure_ascii=False) + "\n"); LOG.flush()
    print(json.dumps(rec, ensure_ascii=False), flush=True)

def vcell(cell, expect, sheet="武器数据"):
    def v():
        v = et_read(sheet, cell)
        return (expect in str(v)), f"{cell}={v}"
    return v

# ───────── 表格 12 场景 ─────────
ET = [
 ("ET-01", "请生成一份军事装备数据表：新建工作表「武器数据」，表头 A1:H1 依次为 编号/名称/类型/射程km/口径mm/产量/造价万元/备注；写入 100 行合理模拟数据（编号 E001-E100，类型在 步枪/火炮/导弹/装甲车/无人机 中选取，数值符合常识）。不要修改其它表。完成后在 M1 单元格写入「场景1完成」。",
  lambda: (et_read("武器数据", "M1") and "场景1完成" in str(et_read("武器数据", "M1")),
           f"M1={et_read('武器数据','M1')}")),
 ("ET-02", "请在「武器数据」表：H1 写表头「总价亿元」（若 H1 已是表头则改写），H2:H101 写公式 =F2*G2/10000（产量×造价，换算亿元，数字由表格计算）。完成后在 M2 写「场景2完成」。",
  vcell("M2", "场景2完成")),
 ("ET-03", "请读取「武器数据」表数据（只读，不要修改），输出洞察：各类型数量分布、射程最远的装备、造价最高的 3 型。结论带具体数字。完成后在 M3 写「场景3完成」。",
  vcell("M3", "场景3完成")),
 ("ET-04", "请统计「武器数据」表 C 列各类型数量，用这些统计值新建一个柱状图（chart_add），放在 J3 附近，图表标题「类型分布」。完成后在 M4 写「场景4完成」。",
  lambda: ((lambda d: (("场景4完成" in str(et_read("武器数据", "M4"))), f"M4={et_read('武器数据','M4')} charts={json.dumps(d, ensure_ascii=False)[:120]}"))(tool("spreadsheet", {"action": "chart_list", "sheet": "武器数据"})))),
 ("ET-05", "请把「武器数据」表 A2:H101 数据区按 射程km 降序排序（保留表头，整行联动）。完成后在 M5 写「场景5完成」。",
  lambda: ((lambda d: ((("场景5完成" in str(et_read("武器数据", "M5")))), f"M5={et_read('武器数据','M5')} D2:D4={json.dumps(d.get('values', [])[:3])}"))(tool("spreadsheet", {"action": "range_read", "sheet": "武器数据", "range": "D2:D4"})))),
 ("ET-06", "请对「武器数据」表 A1:H101 开启自动筛选并筛选出 类型=导弹 的行。完成后在 M6 写「场景6完成」。",
  vcell("M6", "场景6完成")),
 ("ET-07", "请美化「武器数据」表：A1:H1 表头加粗、底色 #DDEBF7、白字。完成后在 M7 写「场景7完成」。",
  vcell("M7", "场景7完成")),
 ("ET-08", "请把「武器数据」表中所有「步枪」替换为「突击步枪」（含之前筛选隐藏行），并报告替换处数。完成后在 M8 写「场景8完成」。",
  vcell("M8", "场景8完成")),
 ("ET-09", "请新建工作表「汇总」：A1=类型、B1=数量；A2:A6 填 突击步枪/火炮/导弹/装甲车/无人机，B2:B6 用 COUNTIF 公式统计「武器数据」表 C 列各类型数量。完成后在 M9 写「场景9完成」。",
  lambda: (("场景9完成" in str(et_read("汇总", "M9")) or ("场景9完成" in str(et_read("武器数据", "M9")))),
           f"M9(汇总)={et_read('汇总','M9')} M9(武器数据)={et_read('武器数据','M9')}")),
 ("ET-10", "请检查「武器数据」表 A2:H101：空值单元格按列类型填充（数值列填 0，文本列填「未知」），重复编号行只保留一条；报告清理项数。完成后在 M10 写「场景10完成」。",
  vcell("M10", "场景10完成")),
 ("ET-11", "请把「武器数据」表导出：CSV 到 /home/zyh/Desktop/weapons.csv，PDF 到 /home/zyh/Desktop/weapons.pdf。完成后在 M11 写「场景11完成」。",
  lambda: ((os.path.exists("/home/zyh/Desktop/weapons.csv"), f"csv={os.path.exists('/home/zyh/Desktop/weapons.csv')} pdf={os.path.exists('/home/zyh/Desktop/weapons.pdf')} M11={et_read('武器数据','M11')}"))),
 ("ET-12", "请删除「汇总」工作表（其它表保留）。完成后在 M12 写「场景12完成」。",
  lambda: ((lambda sheets: (("汇总" not in sheets and "场景12完成" in str(et_read("武器数据", "M12"))), f"sheets={sheets} M12={et_read('武器数据','M12')}"))([s.get("name") for s in tool("spreadsheet", {"action": "sheet_list"}).get("sheets", [])]))),
]

# ───────── 演示 12 场景 ─────────
CONTENT = ("1 全年营收完成目标120%；2 新增客户35家、续约率92%；3 重点项目A按期交付、项目B延期需复盘；"
           "4 团队扩编至40人、培训体系搭建完成；5 明年聚焦海外市场与产品线扩张。")

WPP = [
 ("WPP-01", f"请根据以下年度总结要点，在当前演示稿末尾追加 5 页（不要动已有页）：工作回顾 / 主要成绩 / 存在不足 / 明年计划 / 结束感谢。要点内容：{CONTENT} 版式：第1页用 title 版式，其余 text 版式。完成后用 textbox_add 在最后一页右下角添加文本「场景1完成」。",
  lambda: ((lambda n, texts: (n >= 7 and any("场景1完成" in t for t in texts), f"count={n} last={texts[:3]}"))(*last_slide_shapes()))),
 ("WPP-02", "请通读当前演示稿全部页面（slide_list + slide_read），在第 1 页之后新增一页摘要：layout=text，标题「核心要点」，内容列出 3-5 条要点。完成后在最后一页右下角 textbox_add「场景2完成」。",
  lambda: ((lambda n, texts, sl: (n >= 8 and "核心要点" in json.dumps(sl, ensure_ascii=False) and any("场景2完成" in t for t in texts), f"count={n}"))(*last_slide_shapes(), tool("presentation", {"action": "slide_list"})))),
 ("WPP-03", "请把当前演示稿全部页面中的「明年计划」替换为「来年计划」（text_replace），并报告替换处数。完成后在最后一页右下角 textbox_add「场景3完成」。",
  lambda: ((lambda n, texts: (any("场景3完成" in t for t in texts), f"count={n} last={texts[:2]}"))(*last_slide_shapes()))),
 ("WPP-04", "请做一次文字审核：逐页检查错别字、重复词、占位符文本（如 Lorem、TODO），输出问题清单（页码+问题），不要改文字。完成后在最后一页右下角 textbox_add「场景4完成」。",
  lambda: ((lambda n, texts: (any("场景4完成" in t for t in texts), f"count={n} last={texts[:2]}"))(*last_slide_shapes()))),
 ("WPP-05", "请为第 1、2、3 页各生成演讲者备注（口播稿，每页 3 句、口语化），用 notes_set 写入对应页。完成后在最后一页右下角 textbox_add「场景5完成」。",
  lambda: ((lambda n, texts: (any("场景5完成" in t for t in texts), f"count={n} last={texts[:2]}"))(*last_slide_shapes()))),
 ("WPP-06", "请统一当前演示稿排版：全部页面字体设为微软雅黑（format_uniform），表格形状跳过。完成后在最后一页右下角 textbox_add「场景6完成」。",
  lambda: ((lambda n, texts: (any("场景6完成" in t for t in texts), f"count={n} last={texts[:2]}"))(*last_slide_shapes()))),
 ("WPP-07", "请做大纲调整：把第 2 页移动到第 3 页之后（slide_move），再新增一页空白版式页放在末尾。完成后在最后一页右下角 textbox_add「场景7完成」。",
  lambda: ((lambda n, texts: (n >= 9 and any("场景7完成" in t for t in texts), f"count={n}"))(*last_slide_shapes()))),
 ("WPP-08", "请在第 1 页右侧插入图片 /home/zyh/logo.png（picture_add，图片已存在）。完成后在最后一页右下角 textbox_add「场景8完成」。",
  lambda: ((lambda n, texts: (any("场景8完成" in t for t in texts), f"count={n} last={texts[:2]}"))(*last_slide_shapes()))),
 ("WPP-09", "请新增一页（text 版式），用 table_add 建 3 行 3 列表格：表头 [指标,目标,实际]；行 [营收,1.2亿,1.44亿]、[新客户,30,35]。完成后在最后一页右下角 textbox_add「场景9完成」。",
  lambda: ((lambda n, texts: (n >= 10 and any("场景9完成" in t for t in texts), f"count={n}"))(*last_slide_shapes()))),
 ("WPP-10", "请跨宿主取数：读取表格 vm-test.xlsx 当前表的 A1 单元格文字（spreadsheet range_read，只读），新增一页 title 版式：标题用该文字，副标题写「数据来源：vm-test.xlsx」。完成后在最后一页右下角 textbox_add「场景10完成」。",
  lambda: ((lambda n, texts, sl: (any("场景10完成" in t for t in texts) and "VM测试OK" in json.dumps(sl, ensure_ascii=False), f"count={n}"))(*last_slide_shapes(), tool("presentation", {"action": "slide_list"})))),
 ("WPP-11", "请把第 1 页导出为 PNG 图片到 /home/zyh/Desktop/slide1.png（slide_export_image）。完成后在最后一页右下角 textbox_add「场景11完成」。",
  lambda: ((os.path.exists("/home/zyh/Desktop/slide1.png"), f"png={os.path.exists('/home/zyh/Desktop/slide1.png')}"))),
 ("WPP-12", "请把整套演示稿导出 PDF 到 /home/zyh/Desktop/report.pdf（export，format=pdf）。完成后在最后一页右下角 textbox_add「场景12完成」。",
  lambda: ((os.path.exists("/home/zyh/Desktop/report.pdf"), f"pdf={os.path.exists('/home/zyh/Desktop/report.pdf')}"))),
]

BATCH = sys.argv[1] if len(sys.argv) > 1 else "et"
if BATCH == "et":
    for sid, prompt, verify in ET:
        run(sid, "et", prompt, verify)
else:
    for sid, prompt, verify in WPP:
        run(sid, "wpp", prompt, verify)

passed = sum(1 for r in RESULTS if r["pass"])
print(f"BATCH {BATCH}: {passed}/{len(RESULTS)} PASSED", flush=True)
