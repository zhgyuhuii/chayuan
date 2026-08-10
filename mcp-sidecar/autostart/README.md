# Sidecar 用户级自启（Phase 2 / 3 lite）

| 平台 | 脚本 |
|------|------|
| Linux | `install-linux-user.sh` → systemd --user `chayuan-mcp.service` |
| macOS | `install-macos-launchagent.sh` → LaunchAgent `com.chayuan.mcp` |
| Windows | `install-windows-user.ps1` → `HKCU\...\Run\ChayuanWpsMcp`（优先 `bin/chayuan-mcp-*.exe`；无二进制时回落 Node） |

前置：打包安装优先使用 `mcp-sidecar/bin` 下单文件二进制（无需 Node）；开发态无二进制时需 Node.js 18+。

## Windows

```powershell
powershell -ExecutionPolicy Bypass -File mcp-sidecar/autostart/install-windows-user.ps1
# 卸载：
powershell -ExecutionPolicy Bypass -File mcp-sidecar/autostart/install-windows-user.ps1 -Uninstall
```

脚本会把 sidecar 复制到 `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\`，并写入用户 Run 键；登录后无窗口后台启动（Windows 二进制以 `--windows-hide-console` 编译）。
