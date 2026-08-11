# wps-skill-chayuan 设计方案与科学合理性自查

> 目标：用户安装「wps-skill-chayuan」一次，即可在本机得到 ① WPS 加载项（察元 AI 助手）② 本机 MCP 服务（chayuan-wps-mcp）③ 开机/登录自启 ④ WPS 启动即加载察元 AI 助手。
>
> 本文先给出方案，再对方案本身做一次科学合理性审计。所有路径、端口、机制均对照仓库 v4.0 真实实现。

---

## 0. 结论先行（TL;DR）

1. **「技能」一词在本系统有三层含义，必须先拆开**：运行时技能（`src/skills/*.js`，加载项的房客）、加载项本身（WPS JsPlugin）、交付包（用户拿到的安装物）。用户口中的「wps-skill-chayuan」是**交付包**，不是运行时技能对象。
2. **存在分层倒置（chicken-and-egg）**：运行时技能无法安装加载项，因为它依赖加载项先存在。因此 wps-skill-chayuan 必须是**两层结构**：一个**原生引导安装层（Bootstrap）** + 一个可选的**同名运行时技能层**。
3. **现有 v4.0 安装器已具备全部能力**（jsaddons 写入、MCP 二进制释放、自启钩子、mcp-server.json）。wps-skill-chayuan 的科学定位是**统一封装层 + 跨平台引导器 + 同名技能**，**不重造安装器**。
4. **「WPS 启动即加载」是 jsaddons 机制的自然结果**，不是额外功能；**「MCP 常驻」由登录级自启保证**，与 WPS 是否启动解耦。两者要分开讲。
5. **离线优先**是硬约束（政务/信创/涉密场景），在线引导器只是可选项。

---

## 1. 背景与目标

### 1.1 用户诉求（原话转写）

> 用户安装 wps-skill-chayuan 后，能够把 WPS 加载项 + MCP 服务一起安装到本地，WPS 启动就能加载察元 AI 助手。

### 1.2 拆成可验证的验收标准

| 编号 | 验收项 | 验证方式 |
|---|---|---|
| A1 | 安装后，WPS 功能区出现「察元 AI 助手」入口 | 打开 WPS 文字，肉眼/截图 |
| A2 | 安装后，本机 MCP 在 `127.0.0.1:62588/mcp` 可达 | `curl http://127.0.0.1:62588/healthz` |
| A3 | 重启系统/重新登录后，MCP 自启且仍可达 | 注销重登后再 curl |
| A4 | WPS 每次启动都加载加载项（持久，非一次性） | 关闭 WPS 再开，入口仍在 |
| A5 | Claude Code 等客户端接通 MCP 可驱动技能 | 连接 + 跑一条预览指令 |
| A6 | 安装过程对未装 WPS / WPS 正在运行 / 无管理员权限等情形给出明确提示 | 异常路径手测 |

### 1.3 非目标（明确不做）

- 不替代大模型/不内置模型权重（模型由用户在加载项里配 Ollama/通义/DeepSeek 等）。
- 不做云账号体系（v4.0 是本机优先、默认无 Token）。
- 不追求「双击一个 exe 同时支持三平台」的物理单体（见 §10 反模式）。

---

## 2. 关键科学发现：分层倒置

### 2.1 现状事实链（来自仓库）

```
src/skills/*.js  ──(启动期 import.meta.glob 扫描)──▶  scanAndRegisterSkills()
                                                            │
                                                            ▼
                                                  察元加载项运行时（WPS 进程内）
                                                            │
                                                  （加载项必须已安装且 WPS 已启动）
```

- `src/utils/assistant/skillScanner.js`：技能对象由加载项在**编译期**收齐、**启动期**注册。
- 技能的 `systemPrompt` / `userPromptTemplate` 由加载项调用模型执行，写回动作由加载项通过 WPS JSAPI 落地。
- 结论：**运行时技能的生存依赖加载项的生存**。运行时技能不能作为加载项的安装来源。

### 2.2 推论

用户字面诉求「装一个技能 → 技能把加载项和 MCP 装上」在技术层不成立。必须把「wps-skill-chayuan」重新定义为一个**交付包**，包内含一个**先于加载项运行的原生引导器**。

### 2.3 「技能」三层含义对照表

| 层 | 是什么 | 何时存在 | 能否安装加载项 |
|---|---|---|---|
| 交付包（wps-skill-chayuan） | 用户下载/安装的整套物 | 安装前就存在 | **能（通过其中的引导器）** |
| 加载项（察元 JsPlugin） | manifest+ribbon+前端，跑在 WPS 里 | 装好且 WPS 启动后 | 否（它是被装对象） |
| 运行时技能（src/skills） | JS 对象，加载项的房客 | 加载项启动后 | **否（因果倒置）** |

> 和用户沟通时，统一用「wps-skill-chayuan 交付包」指代安装物，用「运行时技能」指代 `src/skills` 对象，避免歧义。

---

## 3. 总体架构：两层模型

```
┌─────────────────────────────────────────────────────────────┐
│  wps-skill-chayuan 交付包（一个名字、一个版本、一份 manifest）      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Layer 1  引导安装层（Bootstrap）—— 原生，先于加载项运行   │  │
│  │  • 跨平台引导器（Node 或 sh/ps1）                         │  │
│  │  • 探测 OS/架构 → 选 add-in 产物 + MCP 二进制             │  │
│  │  • 写 jsaddons + publish.xml（装加载项）                  │  │
│  │  • 释放 MCP 二进制 + 装自启钩子（装 MCP 常驻）            │  │
│  │  • 写 mcp-server.json（发现）+ 跑 healthz 自检            │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │（加载项就位后）                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Layer 2  运行时技能层（Runtime Skill）—— JS，加载项房客   │  │
│  │  • src/skills/wps-skill-chayuan.js（同名技能）                │  │
│  │  • 提供装好之后的「在岗」功能：一键自检/重装/状态面板       │  │
│  │  • 由 scanAndRegisterSkills() 自动注册                    │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**两层各自的职责边界**：
- Layer 1 负责「**把东西装对位置**」，是安装时一次性动作。
- Layer 2 负责「**装好之后的日常自助**」，是运行时常驻能力（自检、修复、查看端口/健康）。

二者共用「wps-skill-chayuan」这个品牌名和版本号，但**生命周期不同、运行环境不同、不能互相调用对方的安装能力**。这是本方案最重要的架构决策。

---

## 4. 交付包格式与内容清单

### 4.1 包根（建议结构）

```
wps-skill-chayuan/
├── skill-chayuan.manifest.json        # 交付包清单（版本/平台/校验和/受信发布者）
├── bootstrap/
│   ├── bootstrap.mjs              # 跨平台引导器（Node ≥18，或编译为单文件）
│   ├── windows/install.ps1        # Windows 用户级安装
│   ├── macos/install.sh           # macOS 用户级安装
│   └── linux/install.sh           # Linux 用户级安装
├── payload/
│   ├── addon/<version>/           # 加载项产物（manifest.xml/ribbon.xml/index.html/assets/）
│   ├── publish.xml                # jsplugins（enable_dev），写入 jsaddons 根
│   └── mcp/
│       ├── chayuan-mcp-windows-x64.exe
│       ├── chayuan-mcp-macos-arm64
│       ├── chayuan-mcp-macos-x64
│       ├── chayuan-mcp-linux-x64
│       └── chayuan-mcp-linux-arm64
├── runtime-skill/
│   └── wps-skill-chayuan.js           # 同名运行时技能（拷入 src/skills/ 或随加载项构建）
├── verify/
│   └── healthz-four-level.{mjs,sh,ps1}   # 四级自检
└── README-INSTALL.{md,txt}
```

### 4.2 skill-chayuan.manifest.json（关键字段）

```json
{
  "name": "wps-skill-chayuan",
  "version": "1.0.0",
  "publisher": "<受信发布者>",
  "signature": "<对 manifest+payload 的签名>",
  "addon": { "version": "4.0.0", "addonFolder": "chayuan-4.0.0" },
  "mcp": { "port": 62588, "minVersion": "0.5.0" },
  "platforms": {
    "windows-x64": { "mcpBin": "chayuan-mcp-windows-x64.exe" },
    "macos-arm64": { "mcpBin": "chayuan-mcp-macos-arm64" },
    "macos-x64":   { "mcpBin": "chayuan-mcp-macos-x64" },
    "linux-x64":   { "mcpBin": "chayuan-mcp-linux-x64" },
    "linux-arm64": { "mcpBin": "chayuan-mcp-linux-arm64" }
  },
  "checksums": { "...": "sha256" }
}
```

> 这份 manifest 同时服务于：① 引导器按平台选产物；② 安装后写 mcp-server.json 的发现；③ 市场分发的签名校验（Layer 2 技能若走市场，沿用现有 externalAssistants 的受信发布者白名单）。

---

## 5. 安装流程（三平台，复用现有机制）

> 原则：**不新写 jsaddons 路径探测、不自创自启机制**，直接调用 v4.0 已验证的实现，wps-skill-chayuan 只做编排。

### 5.1 公共步骤（所有平台）

1. 校验 manifest 签名 + checksums（防篡改）。
2. 探测本机是否装有 WPS（找不到则提示「请先安装 WPS」并中止，见 §12 失败模式 F1）。
3. 探测 OS/架构，选对应 MCP 二进制。
4. 探测端口 62588 是否被占（被占且非自家进程 → 提示，见 F5）。

### 5.2 Windows（用户级，免管理员）

- 加载项：把 `payload/addon/<version>/` 拷入 `%AppData%\Kingsoft\wps\jsaddons\`，并写 `publish.xml`（`<jsplugins>` + `enable_dev`，与官方 wpsjs 离线包一致——否则本地 jsaddons 常不加载）。
  - 复用 `scripts/run-wpsjs-exe.mjs` 生成的 `copy.bat` 逻辑。
- MCP：二进制释放到 `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\`，写 `HKCU\...\Run\ChayuanWpsMcp`（用户级，免管理员）。
  - 复用 `mcp-sidecar/autostart/install-windows-user.ps1`。
  - Windows 二进制以 `--windows-hide-console` 启动，无黑窗。
- 发现：写 `mcp-server.json`（含 port + wpsExecutable）。
  - 复用 `scripts/register-mcp-server.mjs` / `platformBridge.writeMcpServerJson`。

### 5.3 macOS（用户级 + pkg 两种姿态）

- 用户级脚本姿态（免管理员）：拷入 `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/`，装 LaunchAgent `com.chayuan.mcp`。
  - 复用 `mcp-sidecar/autostart/install-macos-launchagent.sh`。
- pkg 姿态：复用现有 `scripts/build-macos-pkg.sh` + `postinstall`（含 EINTR 重试，处理 WPS 占用文件句柄；含 BOM 剥离、shebang 校验）。
  - wps-skill-chayuan 可直接**把现有 pkg 当作 payload 之一**调用，而不是重写 postinstall。

### 5.4 Linux / 信创（deb + 用户脚本）

- 加载项路径覆盖两种：`~/.local/share/Kingsoft/wps/jsaddons` 与麒麟/UOS 专业版 `/opt/apps/cn.wps.wps-office-pro/.../office6/jsaddons`。
  - 复用 `scripts/build-linux-deb.sh`。
- 自启：systemd --user 单元 `chayuan-mcp.service`。
  - 复用 `mcp-sidecar/autostart/install-linux-user.sh`。
- 装后提示：必要时执行 `quickstartoffice restart`（见 build-wps-addon 注释）。

### 5.5 安装尾声：四级自检（复用）

跑 `verify/healthz-four-level.*`，输出一张表给用户：

| 级别 | 检查 | 命令 |
|---|---|---|
| L1 | jsaddons 产物与 publish.xml 就位 | 文件存在性 + publish.xml 解析 |
| L2 | MCP 进程在跑、端口在听 | `curl 127.0.0.1:62588/healthz` |
| L3 | MCP 能响应 MCP 协议 | initialize 握手 |
| L4 | 加载项↔MCP 桥通（可驱动 WPS） | 调一条只读工具 |

任一级失败 → 给出对应修复指引（见 §12）。

---

## 6. 「WPS 启动即加载」与「MCP 常驻」的保证

这是用户最关心、也最容易混淆的两件事，必须分开讲清。

### 6.1 「WPS 启动即加载」= jsaddons 机制的自然结果

- WPS 在**每次启动**时扫描 jsaddons 目录，按 `publish.xml` 加载已注册的 JsPlugin。
- 因此 A4（持久加载）**不是额外功能**，只要满足两个条件：
  1. 加载项文件在正确 jsaddons 路径下；
  2. jsaddons 根有合法 `publish.xml`（`enable_dev`）。
- wps-skill-chayuan 的责任是**保证这两个条件在安装后一直成立**（升级时原子替换，见 §11）。

### 6.2 「MCP 常驻」= 登录级自启，与 WPS 解耦

- 现有设计：MCP 由 **Run/LaunchAgent/systemd --user** 在**用户登录**时拉起，**不依赖 WPS 是否启动**。
- 这是合理的：用户可能不开 WPS，只用 Claude Code 直连 MCP 处理文档（此时由 MCP 反向拉起 WPS，`mcp-server.json.wpsExecutable` 即为此设计）。
- 推论：**不要**把 MCP 改成「由加载项在 WPS 启动时拉起」——那样 WPS 不开就没有 MCP，反而限制 Claude Code 的使用。保持现状。

### 6.3 二者的协同时序

```
用户登录 ──▶ 自启拉起 MCP（62588 就绪）
用户开 WPS ──▶ jsaddons 加载察元加载项 ──▶ 加载项读 mcp-server.json 发现 MCP ──▶ 联通
用户开 Claude Code ──▶ 连 127.0.0.1:62588 ──▶ MCP（必要时拉起 WPS）──▶ 驱动加载项技能
```

---

## 7. 分发模式：离线优先 + 在线引导器（可选）

### 7.1 离线整包（默认，强约束）

- 一个平台一个压缩包/安装器，**内含全部 payload**，不联网。
- 适配政务/信创/涉密：内网、隔离网、代理不可走。
- 签名 + checksum 在**打包时**固化，离线可验。

### 7.2 在线引导器（可选，公网用户）

- 一个很小的引导器，按 manifest 从发布源（GitHub Release / 官网 / 单位内部源）拉对应平台 payload，再走与离线完全相同的安装步骤。
- 适合：公网用户、想always拿最新版、不想挑平台包。
- **不作为主推**，因为核心客群在内网。

### 7.3 不走「技能市场」装引导器

- 现有 externalAssistants 市场是 **JS 技能注册表**，不具备分发原生二进制/写 jsaddons 的能力。
- 因此：**Layer 1（引导器）不能通过技能市场分发**，只能走安装包/压缩包渠道。
- Layer 2（同名运行时技能）**可以**走市场，但那是装好加载项之后的事。

---

## 8. 同名运行时技能（Layer 2）：装好之后做什么

`src/skills/wps-skill-chayuan.js` 提供加载项内的「在岗自助」能力，让 wps-skill-chayuan 这个名字在装完后仍有意义（否则用户会问「装完怎么没看到 abc 技能」）。

建议技能动作（`defaultAction: 'none'` / 仅生成，不改文档）：

| 子能力 | 说明 |
|---|---|
| 一键自检 | 跑四级 healthz，把结果渲染成可读报告（替代用户手敲 curl） |
| 状态面板 | 显示 MCP 端口/版本/进程、加载项版本、模型配置摘要 |
| 修复引导 | 自检失败时，给出对应平台的修复命令（不自动改系统，只给步骤） |
| 版本/卸载信息 | 显示 wps-skill-chayuan 版本、如何卸载（Run/LaunchAgent/systemd 反向命令） |

> 注意：Layer 2 技能**不能也不应**重新执行 Layer 1 的安装写操作（无权限上下文、因果错位）。它的「修复」是**指路**，不是**动手**。

---

## 9. 安全与信任

| 议题 | 措施 |
|---|---|
| 包完整性 | manifest 签名 + payload sha256，安装前校验 |
| 发布者信任 | 复用 externalAssistants 受信发布者白名单思路，引导器校验 publisher |
| MCP 暴露面 | 仅绑 `127.0.0.1:62588`，不对外，默认无 Token（保持 v4.0） |
| 涉密合规 | 离线包不触发任何公网请求；Layer 2 技能提示涉密稿走离线模型 |
| 信创栈 | Linux/arm64、麒麟/UOS 路径已覆盖；不引入非国产依赖 |
| 权限最小化 | 全程用户级（HKCU/~/Library/~/.local），不要求管理员/sudo |
| 卸载干净 | 引导器提供 `-Uninstall`，反向移除 jsaddons 产物、自启键、MCP runtime |

---

## 10. 构建与打包流水线

> 复用现有 scripts，wps-skill-chayuan 只新增「聚合 + 签名 + 清单」三步。

```
npm run build:wps-all           # 现有：产出 add-on + MCP 二进制 + install.json
        │
        ▼
scripts/build-wps-addon.mjs     # 现有：publish.xml + 版本目录
scripts/build-mcp-binary.mjs    # 现有：mcp-sidecar/bin/* 单文件二进制
        │
        ▼  （新增）
scripts/build-skill-chayuan-pack.mjs
  ① 按 manifest 聚合 payload（add-on + publish.xml + mcp 二进制 + runtime-skill）
  ② 计算每文件 sha256 写回 manifest
  ③ 签名 manifest
  ④ 输出 wps-skill-chayuan-<ver>-<platform>-<arch>.{zip,7z,exe,pkg,deb}
        │
        ▼
gh-release-upload.mjs           # 现有：发布
```

关键约束：**单一出处**——add-on 与 MCP 二进制必须来自同一次 `build:wps-all`，避免版本错配（这是 v4.0 已有的 install.json 协调机制）。

---

## 11. 失败模式与对策矩阵

| 编号 | 失败场景 | 现有/新增对策 |
|---|---|---|
| F1 | 本机未装 WPS | 引导器中止 + 提示去装 WPS；不假装成功 |
| F2 | 安装时 WPS 正在运行（文件锁） | macOS postinstall 已有 ditto + EINTR 5 次重试；Win/Linux 引导器同样重试 + 提示关闭 WPS |
| F3 | 用户级目录被沙盒重定向（Mac 容器） | 已覆盖 `com.kingsoft.wpsoffice.mac` 容器路径 |
| F4 | 麒麟/UOS 专业版路径不同 | 已覆盖 `/opt/apps/cn.wps.wps-office-pro/...`；提示 `quickstartoffice restart` |
| F5 | 端口 62588 被占 | 探测：若为自家旧进程 → 升级替换；若为第三方 → 提示冲突，不静默换端口（换端口会让客户端连不上） |
| F6 | AV/EDR 杀掉 MCP 二进制 | 引导器校验二进制存在 + healthz 失败时提示加白；签名降低误杀 |
| F7 | publish.xml 缺失/被清 → WPS 不加载 | 四级自检 L1 捕获；Layer 2 技能给重写命令 |
| F8 | 自启被系统优化/省电杀（尤其 Mac LaunchAgent、Win 任务管理器禁启） | 四级自检 L2 捕获；提示「允许自启」路径 |
| F9 | 升级时版本错配（add-on 与 MCP 不匹配） | 单一出处 + manifest 双版本字段校验 |
| F10 | 卸载残留 | 引导器 `-Uninstall` 反向清理 + Layer 2 技能显示残留检查 |
| F11 | 62588 上有**非 launchd 托管的野 MCP 进程**（曾手动/被加载项直接拉起） | `launchctl unload` 杀不掉它 → 脚本 L2 误绿。**冒烟实测命中**。对策：L2 通过后再校验监听 PID 是否归 launchd/com.chayuan.mcp 托管，否则提示 `kill <pid>` 或重启自愈。正常干净机器无此问题 |
| F12 | **publish.xml 平台差异**：macOS `enable="enable"` 可加载；Windows 必须 `enable_dev` | 同一 staging 的 publish.xml 不能跨平台共用。对策：Windows 直装（M2-b）必须用 `publishXmlForPkg(..., {enable_dev})` 版本，或运行时改写属性 |

---

## 12. 与现有 v4.0 安装器的关系（避免重复造轮子）

| 现有物 | wps-skill-chayuan 中的角色 |
|---|---|
| `build-macos-pkg.sh` / postinstall | Mac 姿态直接调用现有 pkg 作 payload，不重写 |
| `build-linux-deb.sh` | Linux 姿态调用现有 deb |
| `run-wpsjs-exe.mjs`（copy.bat 生成） | Windows jsaddons 写入逻辑来源 |
| `mcp-sidecar/autostart/*` | 三平台自启，直接调用 |
| `register-mcp-server.mjs` / `platformBridge` | mcp-server.json 发现，直接调用 |
| `build-mcp-binary.mjs` | MCP 单文件二进制来源 |
| `src/skills/*.js` 机制 | Layer 2 同名技能注册通道 |

**结论**：wps-skill-chayuan ≈ 现有能力的**跨平台编排层 + 统一品牌 + 同名运行时技能 + 离线整包签名**。代码新增量集中在 `bootstrap/` 与 `build-skill-chayuan-pack.mjs`，其余是调用既有实现。这是本方案科学性的最大支撑点——**不发明新机制，只整合已验证机制**。

---

## 13. 科学合理性自查（深度审计）

> 这一节是对上面方案的自我反驳与检验，逐条质疑、逐条作答。

### Q1 把「技能」当安装入口，是否偷换了概念？
**是。用户原话有概念混淆，方案显式纠正了。** 运行时技能（`src/skills`）无法安装加载项（§2）。方案把 wps-skill-chayuan 重定义为「交付包」，拆成 Bootstrap + Runtime Skill 两层，概念自洽。**合理。**

### Q2 现有 v4.0 安装器已经能装三件套，wps-skill-chayuan 是否多余？
**不多余，定位已定。** 它的价值在：① 跨平台统一入口（用户不用挑 exe/pkg/deb）；② 一个品牌名贯穿安装期与运行期；③ 离线整包签名 + checksum；④ 同名运行时技能提供装后自助。这四点正是 O1 决议「察元伞下跨平台封装层」的增量所在——**重复造轮子的风险已通过定位决议消除**（见 §14 O1 ✅已定）。

### Q3 「WPS 启动即加载」靠什么保证？会不会一次性？
**靠 jsaddons + publish.xml，持久。** WPS 每次启动扫描 jsaddons，非一次性（§6.1）。风险点是 publish.xml 被清或升级原子性——已由 L1 自检 + 原子替换覆盖。**合理。**

### Q4 MCP 常驻会不会有安全/资源问题？
**可接受。** 仅绑 127.0.0.1、无 Token、单进程、空闲常驻资源极低。比「每次开 WPS 才拉起」更稳，且支持不开 WPS 直连。**合理。**

### Q5 离线整包会不会过大、难分发？
**会偏大（MCP 五个平台二进制 + add-on）。缓解**：① 按平台拆包，只放本平台一个二进制；② 在线引导器作为公网补充。不追求单文件跨平台（§10 反模式）。**合理。**

### Q6 用户级安装（免管理员）是否真能覆盖所有目标环境？
**Win/mac 用户级覆盖良好；Linux 信创个别专业版路径需 root 写 `/opt/apps/...`。** 对策：用户级路径为主，root 路径作为 deb 姿态（deb 安装本就需提权）。**部分合理，需在 Linux 信创上做现场验证（见 O2）。**

### Q7 引导器自己要不要 Node？会不会引入新依赖？
**存在风险。** 现有自启脚本在「有二进制时」已免 Node；但引导器若用 Node 写，又要求用户先装 Node，违背「装一次全齐」的初衷。**对策**：引导器用平台原生 sh/ps1 写（不依赖 Node），或用 `build-mcp-binary.mjs` 同款能力把引导器也编译成单文件二进制。**已识别，需在实现时落实（见 O3）。**

### Q8 签名/受信发布者在内网离线环境怎么验？
**离线需预置公钥/白名单。** 内网不能在线查发布者，故校验链根必须在包内或装机时预置。对策：引导器内置 publisher 公钥指纹，离线即可验签。**合理，但需密钥分发流程配套。**

### Q9 升级路径是否安全（不丢用户配置）？
**需保证：只换 add-on 文件与 MCP 二进制，不动用户数据目录（模型配置/知识库凭据/自定义助手）。** 用户配置在独立 data dir（`getDataDir`），与程序文件分离，升级不触碰。**合理，但升级脚本必须明确「不改 data dir」并测试。**

### Q10 方案有没有低估 WPS 版本差异？
**有此风险。** WPS 不同版本（个人版/专业版/信创版/Mac 沙盒版）jsaddons 行为有差异（如 enable_dev 在部分 Windows 版本必需）。**对策**：维持现有路径矩阵 + publish.xml 策略，并在多版本 WPS 上回归测试。**已识别。**

### 自查总评
方案在**概念层（分层纠正）、机制层（复用 jsaddons/自启/healthz）、安全层（签名/localhost/最小权限）**成立且自洽。**Q2（增量价值）已随 O1 决议（察元伞下跨平台封装层）化解**。剩余不确定性集中在 **Q6（Linux 信创 root）、Q7（引导器依赖）、Q10（WPS 版本差异）** 三点，均属「实现期需验证」而非「方案根本缺陷」。

---

## 14. 风险与开放问题（需用户/立项拍板）

| 编号 | 开放问题 | 倾向建议 |
|---|---|---|
| ~~O1~~ ✅已定 | 命名 **wps-skill-chayuan**，定位为**察元品牌伞下的跨平台封装层（方案 b：v4.1 增量封装）**，非平行新品牌，避免双线维护 | 已确认 |
| ~~O3~~ ✅已定 | **原生 sh / ps1 直装脚本**作默认路径（不依赖 Node）；.exe/.pkg/.deb 降为可选渠道 | 已确认（直装方案） |
| ~~O4~~ ✅已定 | **离线优先**；唯一在线元素是「从 Releases 拉 portable zip」作载荷回落，且下载后 sha256 强校验；不做独立在线引导器 | 已确认 |
| ~~L2a 形态~~ ✅已定 | **三层模型（L1 直装 / L2a agent-driver / L2b 加载项内技能）+ agent-agnostic**：不止 Cursor，覆盖 Claude Code / Cursor / Codex（脚本写）+ OpenClaw / Hermes（GUI 指 引） | 已确认 |
| O2 | Linux 信创（麒麟/UOS pro）是否需 root 写 `/opt`？ | 现场验证；用户级为主、deb 补位（M5） |
| O5 | L2b 加载项内技能默认动作 | 默认采纳「仅生成 + 状态面板」，不动文档 |

---

## 15. 建议落地阶段（里程碑）

| 阶段 | 产出 | 验收 |
|---|---|---|
| M1 概念确认 | 与用户对齐 §2 分层纠正 + §14 开放问题 | 书面确认 O1–O5 |
| M2 引导器原型 | `bootstrap/` 三平台脚本，调用现有机制，跑通 Win/mac 各一台 | A1–A4 通过 |
| M3 打包流水线 | `build-skill-chayuan-pack.mjs` + 签名 + checksum | 离线整包可生成可校验 |
| M4 同名运行时技能 | `src/skills/wps-skill-chayuan.js`（自检/面板/修复指引） | 装后在 WPS 内可见可用 |
| M5 信创回归 | 麒麟/UOS + 多版本 WPS 回归 | A1–A6 在信创栈通过 |
| M6 分发与文档 | 离线整包上线 + 安装说明 + 卸载说明 | 用户按文档可独立完成 |

---

## 16. 直装融合方案（已采纳，本节为单一事实源，覆盖前文相关条目）

> 经「直装方案 vs 封装方案」对比后合并定稿。本节生效后，§7 分发模式、§10 构建流水线中与之冲突处以本节为准。

### 16.1 决策摘要（已锁）

- 命名 **wps-skill-chayuan**，全程统一（含 Cursor 技能目录、运行时技能 id、manifest）。
- **默认走直装脚本**（`scripts/install-wps-skill-chayuan.{sh,ps1}`），不跑 .exe/.pkg/.deb；后者降为「需图形向导渠道」的可选项。
- **三层模型**：L1 直装（必装）/ L2a agent-driver（可选，`--with-*`）/ L2b 加载项内运行时技能（可选）。
- **L2a agent-agnostic**：同一 MCP 端点，多客户端按需注册，**不止 Cursor**。

### 16.2 三层最终形态

```
wps-skill-chayuan（一个品牌、三层、按需启用）
├─ L1 直装脚本 scripts/install-wps-skill-chayuan.{sh,ps1}          【必装】
│   jsaddons + publish.xml(enable_dev) → MCP 二进制 runtime → autostart(复用)
│   → 立即启动 → 写 mcp-server.json(发现) → 四级 healthz
│   flags: --skill-only --runtime-only --payload <dir>
│           --with-claude --with-cursor --with-codex --with-all
│   载荷回落: staging → --payload → Releases portable zip(带 sha256,下载后强校验)
├─ L2a agent-driver 【可选,--with-*】见 §16.4 矩阵
│   └ 连接配置 + (Cursor/Claude Code)SKILL.md 编排指令
└─ L2b 加载项内运行时技能 src/skills/wps-skill-chayuan.js 【可选】
    在 WPS UI 里点：自检/状态面板/修复指路（仅生成，不改文档）
```

### 16.3 L1 直装脚本具体做什么（对齐现有逻辑，不新造）

公共：读 `install-staging/install.json` 的 `addonFolder`/`version` → 校验插件目录 + `publish.xml` + `mcp-sidecar/bin/chayuan-mcp-<os>-<arch>[.exe]` 存在 → 按平台写入 jsaddons + runtime + 自启（复用 `mcp-sidecar/autostart/*`）→ 调用 `register-mcp-server.mjs` 写 `mcp-server.json` → 立即启动 → 四级 healthz。

| 平台 | jsaddons 目标 | 关键约束 | 自启（复用） |
|---|---|---|---|
| Windows | `%AppData%\kingsoft\wps\jsaddons\<addonFolder>\` + 同级 `publish.xml` | **`enable_dev` 不能省**（否则拷了不加载）；对齐 `run-wpsjs-exe.mjs` 的 copy.bat | `install-windows-user.ps1`（HKCU Run + 启动） |
| macOS | 沙盒 `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/` **与** 非沙盒 `~/Library/Application Support/Kingsoft/wps/jsaddons/` **两处都写** | 先拷临时目录再替换（防 WPS 占用半截拷贝） | `install-macos-launchagent.sh`（com.chayuan.mcp） |
| Linux | `~/.local/share/Kingsoft/wps/jsaddons/`（含 kingsoft 小写变体）；**不默认写 `/opt`** | `--system` 显式要求才尝试提权 | `install-linux-user.sh`（systemd --user） |

载荷优先级：① 本机 `release/install-staging/`（`npm run build:wps-all` 产物）→ ② `--payload <dir>`（解压后的 portable）→ ③ Releases portable zip（仅文件树，非安装器，下载后 **sha256 强校验**）；三级皆无则报错并提示先构建。

### 16.4 L2a agent-agnostic 矩阵（不止 Cursor）

> 关键事实：仓库**已有**客户端配置片段生成逻辑（`src/components/AIAssistantDialog.vue`、`SettingsDialog.vue` 均产出 `mcpServers` JSON）。L2a **对齐该片段格式，不另造**。端点统一 `http://127.0.0.1:62588/mcp`，服务名 `chayuan-wps-mcp`，无 Token、无 command、无 stdio。

客户端分两类：

**A 类 · 脚本可写配置（直装脚本 `--with-*` 自动写入）：**

| 客户端 | 配置位置 | 写入内容 | 触发 |
|---|---|---|---|
| Claude Code | `claude mcp add --transport http chayuan-wps-mcp <url>`；或项目/用户级 `.mcp.json` | `{"mcpServers":{"chayuan-wps-mcp":{"url":"…"}}}` | `--with-claude` |
| Cursor | `~/.cursor/mcp.json`（全局）或 `.cursor/mcp.json`（项目） | 同上 `mcpServers` 结构 | `--with-cursor` |
| Codex | `~/.codex/config.toml` | `[mcp_servers.chayuan-wps-mcp]` + `url = "…"` | `--with-codex` |

**B 类 · 仅 GUI 配置（脚本不代写，只打印指引，由用户在界面填）：**

| 客户端 | 配置方式 | 脚本动作 |
|---|---|---|
| OpenClaw | 桌面「新建 MCP 服务」，类型 HTTP，URL/名称填好，Token/command/stdio 留空 | 打印图文步骤 + 冒烟话术 |
| Hermes | 同 OpenClaw 表单逻辑 | 同上 |

> `--with-all` = 写全部 A 类 + 打印 B 类指引。三类 A 类客户端可同机并存，共用同一 62588，**不为每个客户端再拉一份 MCP 进程**。

**agent-skill（SKILL.md）只对支持技能机制的客户端生效**（Cursor、Claude Code 有 skills/ 目录机制）：写入 `~/.cursor/skills/wps-skill-chayuan/SKILL.md`（及 Claude Code 对应位置），内容是「如何用 wps-skill-chayuan 做校对」的编排指令 + `scripts/ensure-mcp.sh`（healthz 失败时指向直装脚本）。Codex/OpenClaw/Hermes 无此机制，只配 MCP 连接即可。

### 16.5 必须补回的 4 个缺口（封装方案贡献，直装方案原缺）

1. **载荷完整性**：portable zip 携带 `checksums`，脚本下载后 sha256 强校验，不过则中止——防供应链篡改（政务/信创硬约束）。
2. **四级 healthz**（不止 `curl`）：L1 jsaddons+publish.xml 就位且合法 / L2 MCP 进程+端口 / L3 MCP 协议握手 / L4 加载项↔MCP 桥通。「文件拷了但 publish.xml 坏 → WPS 不加载」是高发区，curl 探不到，必须 L1。
3. **写 `mcp-server.json`**：`register-mcp-server.mjs` 落 port + wpsExecutable，是 MCP 反向拉起 WPS 的依据；漏写则客户端不开 WPS 时连不上。
4. **升级安全**：原子替换（临时目录→mv）；只换 add-on 文件与 MCP 二进制，**用户 data dir（模型配置/知识库凭据/自定义助手）一个字节不动**。

### 16.6 落地文件清单

| 动作 | 文件 |
|---|---|
| 新增（L1） | `scripts/install-wps-skill-chayuan.sh`、`scripts/install-wps-skill-chayuan.ps1` |
| 新增（打包） | `scripts/pack-portable-staging.mjs`（install-staging → portable zip + checksums，**非安装器**） |
| 新增（L2a） | `~/.cursor/skills/wps-skill-chayuan/SKILL.md` + `scripts/ensure-mcp.sh`（模板，随直装投放） |
| 新增（L2b） | `src/skills/wps-skill-chayuan.js`（加载项内自检/面板/修复指路） |
| 对齐（复用） | `run-wpsjs-exe.mjs` / `mcp-sidecar/autostart/*` / `register-mcp-server.mjs` / `AIAssistantDialog.vue`&`SettingsDialog.vue` 的 mcpServers 片段 |
| 文档 | `docs/mcp-connection.md` 增「直装」节；README 短节 |

**不改** 现有 .exe/.pkg/.deb 构建链路（保留给图形安装器渠道）；直装是并行交付路径。

---

## 附：与已有 CSDN 系列的呼应

本方案的「四级自检」「localhost 边界」「离线 Ollama」「MCP 端口 62588」等内容，与 `marketing/articles/csdn/` 系列文章（09-healthz-four-level-verify、14-confirm-security-localhost、11-offline-ollama-intranet-review）完全一致，用户侧文档可直接复用，无需另造一套术语。
