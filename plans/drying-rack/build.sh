#!/bin/sh
# Paints make-rack.html in headless Chrome and writes drying-rack.png next to it.
cd "$(dirname "$0")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=20000 \
  --dump-dom "file://$PWD/make-rack.html" 2>/dev/null | python3 -c '
import sys, re, base64
m = re.search(r"id=\"png\"[^>]*>data:image/png;base64,([^<]+)<", sys.stdin.read())
if not m: sys.exit("the page painted nothing (open it in a browser for the error)")
open("drying-rack.png", "wb").write(base64.b64decode(m.group(1))); print("drying-rack.png")'
