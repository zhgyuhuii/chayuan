# wps-skill-chayuan 待办与续接清单

> 最近一次状态（2026-08-11）：L1 直装 + agent 自动部署 + 多源分发本机跑通；**官网（aidooo.com）已接入技能**：新增 `/skill` 介绍+安装页（按智能体分 Tab）、首页「察元AI文档助手」下载区并排「下载技能」按钮、`npm run publish:skill` 一键发布脚本；aidooo 镜像源已对齐真实路径 `/downloads/skill/...`。两个仓库改动均**未提交**（等确认）。
> 设计源：`plans/wps-skill-chayuan-design.md`。本文件只列「还没做 / 还没验」的事，按优先级排。

## P0 · 发布前必做

### 1. 镜像源填实（国内 GitHub 被墙的核心解法）
三源在 `release/mirrors.json`（也在安装器内置默认 + packager 内联）。当前状态：
- **github** ✅ 已设为真实仓库 `zhgyuhuii/chayuan`（remote 就是它）。
- **gitee** ✅ 已设为真实仓库 `gitee.com/cloudshd/chayuan-wps-releases`（releases 仓库；需上传 `wps-skill-chayuan-<ver>-portable.zip` + `.zip.sha256` 到对应 tag）。
- **aidooo** ✅ 已对齐真实路径 `https://aidooo.com/downloads/skill/wps-skill-chayuan-<ver>-portable.zip`；官网 `public/downloads/skill/` 已放 4.0.0 包（zip+7z+各自 sha256）+ `skill-releases.json` 清单。`npm run publish:skill` 一键从 chayuan-wps 发布到官网目录。

每个源**必须同时提供 `<archive>.sha256`**（安装器 `--fetch` 下载后强校验依赖它；缺 .sha256 的源会被跳过）。

改完三处一致：
- `release/mirrors.json`（canonical）
- `scripts/pack-portable-staging.mjs` 内联 `mirrors.sources`
- `scripts/install-wps-skill-chayuan.{sh,ps1}` 内置默认 URL（仅当包内无 mirrors.json 时回落用）

### 2. Windows 真机验证（ps1 仅静态检查过，本机无 pwsh）
在 Windows 上跑：
```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -WithAll
```
验证点：
- HKCU `Run` 注册了 `ChayuanWpsMcp`（F11）
- `publish.xml` 用 `enable="enable_dev"`（F12，否则 jsaddons 不加载）
- `%APPDATA%\kingsoft\wps\jsaddons\` 有 `chayuan_4.0.0` + `publish.xml`
- 四级 healthz L1–L4
- agent 自动部署：Cursor `.mdc` 路径、Codex `prompts\` 路径在 Windows 下是否与实测一致
- `-Fetch` 多源回退 + `Get-FileHash` 强校验

### 3. 整包首次发布
1. 选定版本号（现 `4.0.0`，install.json / packager 都引用它）。
2. `node scripts/pack-portable-staging.mjs` → 产出 `release/wps-skill-chayuan-4.0.0-portable.{zip,7z}` + 各自 `.sha256`（本机已验证可跑）。
3. 三源各上传 **`.zip` + `.zip.sha256`**（主分发；`.7z` 可选上）。
4. 上传后用 `bash scripts/install-wps-skill-chayuan.sh --fetch` 在干净机器验一次「下载 → 校验 → 解压 → 装载 → 自检」全链路。

## P1 · 该补的文档/收尾

### 4. 设计文档增补 §17
`plans/wps-skill-chayuan-design.md` 还没写进本次新增的两块能力：
- agent 自动检测 + 按格式投放矩阵（Claude=SKILL.md / Cursor=.mdc / Codex=prompt.md / GUI=指引）
- 多源分发（mirrors.json + `--fetch` 回退 + sha256 强校验 + ZIP 主/7z 备）

### 5. 本机野进程（F11）
`launchctl` 里 `com.chayuan.mcp` 的托管 PID=-，而 62588 被 PID 92168（历史手起的 MCP）占着。`kill 92168` 后 launchd（KeepAlive）会拉起托管进程，四级自检的 F11 ⚠ 即消失。仅本机环境问题，不影响发布物。

## P2 · 可选增强

### 6. 跨平台二进制复现
发布前确认 `mcp-sidecar/bin/` 五个二进制（windows-x64.exe / macos-{arm64,x64} / linux-{x64,arm64}）覆盖目标用户群；要在新机器重建跑 `scripts/build-mcp-binary.mjs`。

### 7. 新 agent 扩展
OpenClaw / Hermes 目前是 GUI-only（无公开 skill 文件）。若日后开放格式：在 `skill-chayuan/formats/` 加一份对应文件 + 安装器 `deploy_*` / `Deploy-*` 加一个函数 + `agent_run` / `Test-Deploy` 注册表加一行。

### 8. 更强完整性校验（按需）
当前整包校验是 sha256（防篡改已足够）。若客户场景要求更高，可叠 GPG / cosign 签名；安装器 `fetch_payload` 增加一步验签即可。

---

## 续接最快路径（下次开工）
1. `git pull`（或 `git checkout <分支>` —— 见提交说明）。
2. 看本文件 P0：先填 Gitee / aidooo 真实 URL，或先在 Windows 验 ps1。
3. 跑 `bash scripts/install-wps-skill-chayuan.sh` 确认本机基线仍绿。
4. 设计细节查 `plans/wps-skill-chayuan-design.md`。

## 本次提交包含的文件
- `plans/wps-skill-chayuan-design.md`（设计源）
- `plans/wps-skill-chayuan-todo.md`（本文件）
- `scripts/install-wps-skill-chayuan.sh`（unix 直装：自动检测+部署、`--fetch` 多源、`--no-agent`）
- `scripts/install-wps-skill-chayuan.ps1`（Windows 直装：同上，待真机验）
- `scripts/pack-portable-staging.mjs`（ZIP 主 + 7z 备 + mirrors.json）
- `skill-chayuan/`（L2a 模板：SKILL.md + formats/{cursor.mdc,codex.prompt.md,generic.prompt.md} + scripts/ensure-mcp.sh）
- `src/skills/wps-skill-chayuan.js`（L2b 运行时技能）
- `release/mirrors.json`（分发源清单）
