# Sidecar 用户级自启（Phase 2 / 3 lite）

| 平台 | 脚本 |
|------|------|
| Linux | `install-linux-user.sh` → systemd --user `chayuan-mcp.service` |
| macOS | `install-macos-launchagent.sh` → LaunchAgent `com.chayuan.mcp` |
| Windows | `install-windows-user.cmd` → `HKCU\...\Run\ChayuanWpsMcp`（优先 `bin/chayuan-mcp-*.exe`） |

> Windows 使用 `.cmd` 而非 `.ps1`：部分 Defender / ASR 策略会隔离 `autostart\*.ps1`（表现为 Copy-Item「访问被拒绝」或文件突然消失）。技能直装脚本 `install-wps-skill-chayuan.ps1` 的 STEP 2 已内联同等逻辑，不依赖本目录脚本。

前置：打包安装优先使用 `mcp-sidecar/bin` 下单文件二进制（无需 Node）；开发态无二进制时需 Node.js 18+。

## Windows

```bat
mcp-sidecar\autostart\install-windows-user.cmd
:: 卸载：
mcp-sidecar\autostart\install-windows-user.cmd /uninstall
```

脚本会把 sidecar 复制到 `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\`，并写入用户 Run 键；登录后无窗口后台启动（Windows 二进制以 `--windows-hide-console` 编译）。
