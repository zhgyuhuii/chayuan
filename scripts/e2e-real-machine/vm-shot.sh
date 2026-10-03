#!/bin/zsh
# VM 截屏包装：VM 内 import 全屏 → scp 回 Mac 目标路径（供 CHAYUAN_SHOT_CMD={file} 使用）
FILE="$1"
ssh -o BatchMode=yes zyh@192.168.6.157 'DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority import -window root /tmp/e2e-shot.png' >/dev/null 2>&1
scp -q -o BatchMode=yes zyh@192.168.6.157:/tmp/e2e-shot.png "$FILE" 2>/dev/null
