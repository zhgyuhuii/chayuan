# 察元AI文档助手 v6.1.2 更新说明（2026-10-28）

本版本聚焦「附件解析全链路」真机排障与安装器/部署加固。升级后请重启 WPS 使新前端生效。

## 一、「附件1」解析全链路修复

- **MCP 文档智能体管线补齐附件上下文**：文档智能体（工具循环）此前完全收不到附件信息——模型只知道当前文档，遇到「附件1里有什么」会反问用户。现在系统提示注入【用户本轮上传的附件】（含面板已提取的正文），并明确「视为直接可用输入、禁止索要」；本地循环、远程回合（跨窗口派发）、chatTurnRunner 三条路径全部贯通 `attachmentCtx`。
- **任务超时对齐**：`file.parse`/`file.convert` 的 agentClient 超时对齐 sidecar 预算（300s/180s），大 PDF 解析、旧版 doc/ppt 转换不再被 55s 默认值误杀。
- **看门狗与写锁**：`declassify.apply/restore` 补 330s 看门狗配置（合法慢任务不再被 210s 抢跑）；写任务超时后按 lockId 精确放锁，不误杀同方法的健康持锁者。
- **fileParseDispatch**：未保存文件警示路径按 `/` 归一（macOS/Windows 通用）；空正文的 ok 文件参与多文件预算分配（不再产出「开头/结尾」壳摘要）；`rangeStart` 只作用于首个解析成功的文件。
- **附件注册**：`/attachments/register` 校验响应码；sidecar 端口改用统一配置（不再写死 62588）。
- **fileTextExtractor**：本地文件不可读时按 `{ok:false}` 降级，批量解析不再被单个坏文件拖死。
- 真机验证：`file_parse("附件1")` 端到端返回真实 docx 内容（1710 个成语表）。

## 二、安装器与部署加固（治「装完还是旧版」）

- **装前自动停 agent 服务**：pkg postinstall 先 `launchctl bootout/unload`（KeepAlive 防复活）→ `pkill` 匹配四种进程模式 → lsof 兜底强杀占用 62588 端口的进程并等端口释放；装完启动后轮询 healthz（≤10s）把结果写进安装日志。
- **容器假成功不再无声**：沙盒版 WPS 只读容器 jsaddons；当容器写入失败（如 Installer.app 无完全磁盘访问权限被 TCC 拒绝）而非容器路径成功时，安装日志输出响亮警告与修复指引（2026-10-28 真机事故：连续三次安装前端版本纹丝不动）。
- **新增 `scripts/repair-mac-jsaddons-container.sh`**：容器修复三模式——`status`（只读容器实况）/ 默认（装当前版本 + 同步 authaddin.json/jsplugins.xml + 清 jsapi 缓存）/ `rollback`（一键回滚上一版本）。纯 bash 3.2 兼容。
- **Windows SFX 安装器**：`tasklist` 的 IMAGENAME 过滤串超长会被截断导致重试循环变死代码，已修正为 ≤25 字符。

## 三、其它

- agentHub 队列熔断按 `job.target` 精确计数：et/wpp 宿主不再恒为 0（永不熔断），`any` 目标不被其它宿主积压误杀。
- 文档写锁多会话并行细化（lockId 精确放锁）与配套测试更新。
- 用户手册、宿主助手手册、e2e file-parse 真机场景与运行器刷新。

## 升级说明

- 双击 pkg 安装（建议先完全退出 WPS）；若安装日志提示容器权限不足，按警告指引给「安装器」授完全磁盘访问权限后重装，或在有完全磁盘访问权限的终端执行 `bash scripts/repair-mac-jsaddons-container.sh`。
- 已在 6.1.1 容器手动修复过的环境可直接覆盖安装。
