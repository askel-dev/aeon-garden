#!/bin/sh
# Paints every sheet in headless Chrome and writes each PNG and its atlas JSON next to its page.
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for page in make-sheet:summer-trees make-stones-plants:stones-plants make-dishes:dishes; do
  html=${page%%:*}.html out=${page##*:}
  "$CHROME" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=60000 \
    --dump-dom "file://$PWD/$html" 2>/dev/null | python3 -c '
import sys, re, base64, html
d = sys.stdin.read(); out = sys.argv[1]
m = re.search(r"id=\"png\"[^>]*>data:image/png;base64,([^<]+)<", d)
if not m: sys.exit(out + ": the page painted nothing (look at it in a browser for the error)")
open(out + ".png", "wb").write(base64.b64decode(m.group(1)))
open(out + ".json", "w").write(html.unescape(re.search(r"<pre id=\"atlas\">(.*?)</pre>", d, re.S).group(1)) + "\n")
print(out + ".png")' "$out"
done
