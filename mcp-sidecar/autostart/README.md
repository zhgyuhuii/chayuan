# Sidecar 用户级自启（Phase 2 / 3 lite）

| 平台 | 脚本 |
|------|------|
| Linux | `install-linux-user.sh` → systemd --user `chayuan-mcp.service` |
| macOS | `install-macos-launchagent.sh` → LaunchAgent `com.chayuan.mcp` |
| Windows | `install-windows-user.ps1` → `HKCU\...\Run\ChayuanWpsMcp`（需本机 Node；完整静默安装器仍待 Inno/NSIS） |

前置：本机已安装 Node.js 18+。

## Windows

```powershell
powershell -ExecutionPolicy Bypass -File mcp-sidecar/autostart/install-windows-user.ps1
# 卸载：
powershell -ExecutionPolicy Bypass -File mcp-sidecar/autostart/install-windows-user.ps1 -Uninstall
```

脚本会把 sidecar 复制到 `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\`，并写入用户 Run 键；登录后最小化启动 `start-mcp.cmd`。
