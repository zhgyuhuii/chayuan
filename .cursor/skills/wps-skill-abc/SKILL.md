---
name: wps-skill-abc
description: >-
  WPS skill for document proofreading, review, and audit via Chayuan MCP
  (chayuan-wps-mcp). Guides installing the Chayuan WPS add-in, auto-connects
  Cursor to http://127.0.0.1:62588/mcp, then runs dry-run proofread and
  confirmed comment write-back. Use when the user mentions WPS, 校对, 审核,
  公文审查, 错别字, 批注, chayuan-wps-mcp, wps-skill-abc, or WPS skill / 校对助手 / 审核助手.
---

# wps-skill-abc（WPS 校对审核助手）

通过察元本机 MCP 对 **当前 WPS 文档** 做校对与审核。推理在 Cursor；读写与批注在 WPS。

## 每次启动必做（顺序固定）

### 1. 告知用户安装察元 WPS 插件

先用中文明确告诉用户（未装则停在这一步，不要假装已连通）：

1. 本机需安装 **察元 AI 文档助手**（WPS 文字加载项），并打开 WPS。
2. 下载：
   - 官网：https://aidooo.com
   - 发布包：https://github.com/zhgyuhuii/chayuan-wps-releases
3. 装完后打开 WPS 文字，确认加载项出现；在察元设置中配置校对用对话模型（内网 Ollama / OpenAI 兼容端点或合规云端）。
4. v4+ 安装包会自启本机 MCP；若未起，到 **设置 → MCP 服务** 启动。

### 2. 自动连接到 MCP

在当前工作区执行技能自带脚本（优先），或等价手工写入：

```bash
bash .cursor/skills/wps-skill-abc/scripts/ensure-mcp.sh
```

若技能装在用户目录：

```bash
bash ~/.cursor/skills/wps-skill-abc/scripts/ensure-mcp.sh
```

脚本会：

- 合并/写入项目 `.cursor/mcp.json`，服务名 `chayuan-wps-mcp`，URL `http://127.0.0.1:62588/mcp`
- 请求 `http://127.0.0.1:62588/healthz` 并打印结果

然后：

1. 提醒用户如 Cursor 未刷新 MCP，到 **Settings → MCP** 刷新，或重载窗口。
2. 用 MCP 工具调用 `wps_status`（或读资源 `chayuan://wps/health`）。失败则按下方排错，**不要**继续写批注。

MCP 端点（固定）：

- MCP：`http://127.0.0.1:62588/mcp`
- Health：`http://127.0.0.1:62588/healthz`
- 服务名：`chayuan-wps-mcp`
- 无需 Token；仅本机 `127.0.0.1`

### 3. 校对 / 审核主流程（默认安全）

默认：**先预览，再等人确认，再写批注；未确认不改正文。**

1. `document_meta`（或 `wps_status`）确认活动文档；需要时 `document_open` / `document_ensure_open`。
2. 长文若 `recommendChunks` 或字数很大 → 用 `document_chunks`，禁止对超大文档默认 `document_get_text`。
3. 校对：`proofread_run`（dryRun / 仅 issues）。也可分块后由模型找问题，再 `document_locate`。
4. 向用户展示问题列表（原文、建议、位置）。等用户说「确认写批注」或等价确认。
5. 写批注：`proofread_apply_comments` 或 `document_add_comment` / `document_apply_ops`，且 **`confirmed: true`**。
6. 表格：批注必须钉在单元格具体错字上，不要挂整格。
7. 改正文仅当用户明确「确认替换」后，对 `document_replace` / `apply_ops` 传 `confirmed: true`。
8. 可选：`document_save` 另存「已校对」副本。

## 常用口令（可直接对用户复述）

固定开场白：

```text
你通过 chayuan-wps-mcp 对当前 WPS 文件做自动审查。先校对预览，列出错别字、标点和明显病句。等我回复确认写批注后，再写批注，钉在具体文字上（表格钉在错字上）。没有确认替换，不要改正文。
```

其它：

- 只查选区错别字，先预览
- 检查中英文标点与引号书名号配对，先预览
- 正确性总检：错别字、标点、前后矛盾，先预览
- 按第 N 条确认替换，其余只批注

## 排错（先看错误码）

| 现象 / code | 处理 |
| --- | --- |
| healthz 不通 | 打开 WPS；确认察元已加载；设置里启动 MCP；重跑 `ensure-mcp.sh` |
| `WPS_AGENT_OFFLINE` | 打开 WPS + 加载项；再 `wps_status` / `wps_launch` |
| `MODEL_NOT_CONFIGURED` | 在察元设置配置对话/校对模型 |
| `CONFIRMATION_REQUIRED` | 等待用户确认后再带 `confirmed: true` |
| `DOCUMENT_TOO_LARGE` | 改用 `document_chunks` |
| `LOCATE_*` | 重新 locate，勿盲写 |

## 硬约束

- 未确认禁止改正文、禁止批量替换。
- 不把本机 62588 映射到公网。
- 自动审查是初筛，不是定密/终审；涉密按单位制度。
- 工具名以 MCP 列表为准；服务名必须是 `chayuan-wps-mcp`。

## 更多

- 提示词与场景：[prompts.md](prompts.md)
- 项目连接说明：仓库内 `docs/mcp-connection.md`
