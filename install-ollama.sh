#!/bin/bash
# Ollama 安装脚本 - 模型默认存储到 /Users/zyh/ollama/models

set -e

OLLAMA_MODELS_PATH="/Users/zyh/ollama/models"

echo "=== Ollama 安装与配置 ==="

# 1. 创建模型目录
echo "1. 创建模型目录: $OLLAMA_MODELS_PATH"
mkdir -p "$OLLAMA_MODELS_PATH"

# 2. 配置环境变量 - 使 GUI 应用生效（需在启动 Ollama 前执行）
echo "2. 设置 OLLAMA_MODELS 环境变量..."
launchctl setenv OLLAMA_MODELS "$OLLAMA_MODELS_PATH"

# 3. 添加到 .zshrc（终端使用）
if ! grep -q "OLLAMA_MODELS" ~/.zshrc 2>/dev/null; then
    if (echo "" >> ~/.zshrc && echo "# Ollama 模型存储路径" >> ~/.zshrc && echo "export OLLAMA_MODELS=\"$OLLAMA_MODELS_PATH\"" >> ~/.zshrc) 2>/dev/null; then
        echo "   已添加到 ~/.zshrc"
    else
        echo "   无法写入 ~/.zshrc，请手动添加: export OLLAMA_MODELS=\"$OLLAMA_MODELS_PATH\""
    fi
else
    echo "   ~/.zshrc 中已存在 OLLAMA_MODELS 配置"
fi

# 4. 创建 LaunchAgent（开机自动设置环境变量）
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.ollama.models.env.plist"
cat > "$LAUNCH_AGENT" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ollama.models.env</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>launchctl setenv OLLAMA_MODELS /Users/zyh/ollama/models</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
echo "3. 已创建 LaunchAgent: $LAUNCH_AGENT"

# 5. 加载 LaunchAgent（立即生效）
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || launchctl load "$LAUNCH_AGENT" 2>/dev/null || true
echo "   已加载 LaunchAgent（下次登录时自动设置）"

echo ""
echo "=== 配置完成 ==="
echo "模型将存储到: $OLLAMA_MODELS_PATH"
echo ""
echo "=== 安装 Ollama ==="
echo "请选择安装方式："
echo ""
echo "方式一：官网下载（推荐）"
echo "  1. 打开 https://ollama.com/download"
echo "  2. 点击下载 macOS 版本"
echo "  3. 打开下载的 .dmg 文件，将 Ollama 拖入「应用程序」"
echo ""
echo "方式二：使用 curl 下载"
echo "  curl -L -o ~/Downloads/Ollama.dmg https://ollama.com/download/Ollama.dmg"
echo "  然后打开 DMG 并安装"
echo ""
echo "安装完成后："
echo "  1. 先退出已运行的 Ollama（如有）"
echo "  2. 重新打开 Ollama 应用"
echo "  3. 运行 'ollama run llama3.2' 测试"
echo ""
