#!/bin/sh
# A screenshot of dish-lab.html for one dish (its name, or its number in dishes.js PAINTED; the newest with none), so a
# painting can be looked at without a server or a browser window:  tools/dish-shot.sh "Nettle soup" /tmp/nettle.png
# The lab shows the dish at 48, 96, 128 and 256, its 48 px pixels enlarged four times, its recipe card, and every painted
# dish at 48 on parchment and on dark (the current one ringed). Headless Chrome paints the canvas in software, which is
# fine for a still like this.
cd "$(dirname "$0")/.." || exit 1
dish=$(printf '%s' "${1:-}" | sed 's/ /%20/g; s/'"'"'/%27/g')
out=${2:-dish.png}
case "$out" in /*) ;; *) out="$PWD/$out" ;; esac
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1000,900 --screenshot="$out" \
  "file://$PWD/dish-lab.html${dish:+?dish=$dish}" 2>/dev/null
echo "$out"
