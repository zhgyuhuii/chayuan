# WPS TaskPane 停靠能力探针包

验证 WPS 加载项 `Application.CreateTaskPane` 的停靠/浮动/宽高能力，以及 ShowDialog / TaskPane / ribbon 三个 webview 之间的 localStorage 共享情况。用于 AI 助手停靠功能的平台可行性验证。

## 组成

- `index.html` — ribbon 宿主页：文档窗口加载加载项 4 秒后自动运行全部探针（也提供"跑探针"按钮），结果经 HTTP 上报到本机收集服务
- `pane.html` — 装入 TaskPane 的探针页（上报面板实际 innerWidth/innerHeight、localStorage 读取）
- `dialog.html` — 装入 ShowDialog 的探针页（上报 screenX/Y、moveTo/resizeTo 是否生效，4 秒后自动关闭）
- `macos-12.1.28492-results.jsonl` — macOS WPS 12.1.28492 实测原始数据

## 在目标机器上运行（Windows / Linux）

1. 启动结果收集服务（任一能 `node -e` 的终端）：

   ```bash
   node -e 'const http=require("http"),fs=require("fs");const out="probe_reports.jsonl";http.createServer((q,s)=>{if(q.method==="POST"){let b="";q.on("data",c=>b+=c);q.on("end",()=>{fs.appendFileSync(out,b+"\n");s.writeHead(204);s.end()})}else{s.writeHead(404);s.end()}}).listen(3999,"127.0.0.1",()=>console.log("reporter on 3999"))'
   ```

2. 把本目录整体拷贝为 WPS jsaddons 目录下的 `probedock_0.0.1/`（**目录名必须是 `{name}_{version}` 约定**，否则 WPS 找不到、注册形同虚设）：
   - Windows: `%APPDATA%\kingsoft\wps\jsaddons\probedock_0.0.1\`
   - Linux: `~/.local/share/Kingsoft/wps/jsaddons/probedock_0.0.1/`
3. 在同目录 `publish.xml` 的 `<jsplugins>` 里加一行：
   `<jsplugin name="probedock" install="null" enable="enable_dev" type="wps" url="probedock_0.0.1" customDomain="" version="0.0.1"/>`
4. 启动 WPS 并打开任意文档 → 4 秒后自动运行 → 读取 `probe_reports.jsonl`。

## macOS（12.1.28492）实测结论（两轮，最终版）

| 项目 | 结果 |
|---|---|
| Enum 定义 | `msoCTPDockPositionLeft=0 / Top=1 / Right=2 / Bottom=3 / Floating=4` 全部存在 |
| 左/右/上/下停靠 | ✅ **四向全部真实可用**。上/下面板横跨全宽（1920px），左右面板纵向铺满 |
| **尺寸设置的时序坑** | ⚠️ 切换 `DockPosition` 后**必须延迟 ≥~400ms 再设 `Width/Height`**：立即设置会与布局沉降竞态，得到 14px 高的坏死面板，且此时 `Height/Width` **同步读回值是假的**（读到旧值）。延迟 400/1200/2400ms 设置均实测生效（见 `macos-12.1.28492-round2-size-lab.jsonl` 的 resize 时间线）。源码 `ribbon.js:954`"TaskPane 只支持左右停靠"的注释即此竞态的误判，已过时 |
| 浮动（Floating） | ✅ 可用。平时无可见 chrome（无标题栏/把手）；**拖分隔条越过阈值可把停靠面板拖出成浮动窗口**（判定信号：`outerWidth` 出现独立窗框）；用户实测浮动面板拖到屏幕/窗口边缘 **WPS 原生自动吸附停靠**——原生拖拽吸附是 WPS 自带能力，但样式不可定制、跨端一致性未知，产品内只作加分项不写承诺 |
| ShowDialog 窗口 | `screenX/Y` 可读；`window.moveTo` **生效**；`resizeTo` 无效；带原生标题栏（页面内自定义拖拽条会与原生标题栏并存，故拖拽吸附方案仍走点按钮 + 原生手势） |
| localStorage 共享 | ✅ ribbon 页 / TaskPane / ShowDialog 三方双向共享（聊天记录可跨形态延续） |
| webview | Chromium 104 内核，`file://` 协议加载本 jsaddons 目录 |

## 产品代码里的尺寸设置兜底配方

切换 `DockPosition` 后，不要信 `Width/Height` 的同步读回：让面板页监听自身 `resize` 事件并把真实 `innerWidth/innerHeight` 写入 PluginStorage，ribbon 侧轮询比对目标尺寸，不匹配则有界重试（如 5 次 × 200ms）再设。这同时天然构成"某端是否支持某方向停靠"的运行时探测（超时仍 < 50px 即判不支持，隐藏对应菜单项并回退）。
