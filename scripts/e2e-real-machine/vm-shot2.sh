#!/bin/zsh
FILE="$1"
ssh -o BatchMode=yes zyh@192.168.6.157 'export DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority
W=$(xdotool search --class "wpsoffice" | tail -1)
[ -n "$W" ] && xdotool windowactivate $W 2>/dev/null
sleep 2
import -window root /tmp/e2e-shot-final.png' 2>/dev/null
scp -q -o BatchMode=yes zyh@192.168.6.157:/tmp/e2e-shot-final.png "$FILE" 2>/dev/null
