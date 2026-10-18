#!/usr/bin/env python3
"""Collect inspiration: official screenshots + store text for the games we're
studying (see README.md in this folder).

Python 3 with Pillow, no other dependencies. Re-run any time:

    python3 inspiration/build.py

It downloads each game's App Store screenshots and icon (phone-shaped, the ones
that matter for mobile UI) and its Steam screenshots where it has them (for
HUD/layout at desktop sizes), compresses them (max 1600 px, JPEG q82), and
writes `store.md` beside them with the listing's text. Skips what it can't get.
"""

import io
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

# macOS's Python ships without root certificates; use the system bundle.
_CAS = "/etc/ssl/cert.pem"
try:
    CTX = ssl.create_default_context(cafile=_CAS)
except Exception:  # noqa: BLE001 - bundle missing: fall back to the defaults
    CTX = ssl.create_default_context()

HERE = Path(__file__).parent
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
PHONE_SHOTS = 6     # per game, evenly spaced out of whatever the store has
STEAM_SHOTS = 4
MAX_DIM = 1600      # longest side of a stored screenshot
JPEG_Q = 82

# slug, lookup (itunes id or search term), name we expect, how to get it, steam appid
GAMES = [
    dict(slug="dont-starve-pocket", id=1012298403, expect="Don't Starve: Pocket Edition",
         access="Paid (~$4.99), one-time", steam=219740, steam_note="Don't Starve (PC original)"),
    dict(slug="cozy-grove-camp-spirit", id=6445901199, expect="Cozy Grove: Camp Spirit",
         access="Free with a Netflix membership", steam=1458100, steam_note="Cozy Grove (PC original)"),
    dict(slug="wylde-flowers", id=1458605549, expect="Wylde Flowers",
         access="Apple Arcade (subscription)", steam=1896700, steam_note="Wylde Flowers (PC)"),
    dict(slug="stardew-valley", search="Stardew Valley", expect="Stardew Valley",
         access="Paid (~$4.99), one-time", steam=413150, steam_note="Stardew Valley (PC)"),
    dict(slug="animal-crossing-pocket-camp", search="Animal Crossing Pocket Camp", expect="Pocket Camp",
         access="Paid, one-time (Pocket Camp Complete)", steam=None, steam_note=None),
    dict(slug="hello-kitty-island-adventure", search="Hello Kitty Island Adventure", expect="Hello Kitty Island Adventure",
         access="Apple Arcade (subscription)", steam=2495100, steam_note="Hello Kitty Island Adventure (PC)"),
    dict(slug="alba-wildlife-adventure", id=1528014682, expect="Alba: A Wildlife Adventure",
         access="Apple Arcade (subscription)", steam=1337010, steam_note="Alba (PC)"),
    dict(slug="minecraft", search="Minecraft", expect="Minecraft",
         access="Paid, one-time", steam=None, steam_note=None),
    dict(slug="terraria", search="Terraria", expect="Terraria",
         access="Paid (~$4.99), one-time", steam=105600, steam_note="Terraria (PC)"),
    dict(slug="tsukis-odyssey", search="Tsuki's Odyssey", expect="Tsuki",
         access="Free, in-app purchases", steam=None, steam_note=None),
    dict(slug="forager", search="Forager", expect="Forager",
         access="Paid, one-time", steam=751780, steam_note="Forager (PC)"),
]


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - report and retry
            if i == tries - 1:
                print(f"    ! failed {e} :: {url[:90]}")
                return None
            time.sleep(1.5 * (i + 1))


def spaced(items, n):
    """At most n of them, spread evenly across the list."""
    if len(items) <= n:
        return list(items)
    step = (len(items) - 1) / (n - 1)
    return [items[round(i * step)] for i in range(n)]


def save_image(raw, path, max_dim):
    """Write as JPEG, longest side <= max_dim (keeps the folder light)."""
    try:
        im = Image.open(io.BytesIO(raw))
        im = im.convert("RGB")
        if max(im.size) > max_dim:
            im.thumbnail((max_dim, max_dim), Image.LANCZOS)
        im.save(path, "JPEG", quality=JPEG_Q, optimize=True)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"    ! image error {e}")
        return False


def itunes(game):
    if game.get("id"):
        url = f"https://itunes.apple.com/lookup?id={game['id']}"
    else:
        q = urllib.parse.quote(game["search"])
        url = f"https://itunes.apple.com/search?term={q}&entity=software&country=us&limit=15"
    data = get(url)
    if not data:
        return None
    results = json.loads(data).get("results", [])
    if not results:
        print(f"    ! no App Store result for {game.get('search', game.get('id'))}")
        return None
    if game.get("id"):
        return results[0]
    want = game["expect"].lower()
    for r in results:
        if r.get("trackName", "").lower() == want:
            return r
    for r in results:
        if want in r.get("trackName", "").lower():
            return r
    print(f"    ! closest match is '{results[0].get('trackName')}' (expected '{game['expect']}')")
    return results[0]


def steam(appid):
    data = get(f"https://store.steampowered.com/api/appdetails?appids={appid}&cc=us&l=english")
    if not data:
        return None
    try:
        entry = json.loads(data).get(str(appid), {})
        return entry.get("data") if entry.get("success") else None
    except Exception:  # noqa: BLE001
        return None


def excerpt(text, n=1400):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:n] + ("…" if len(text) > n else "")


def spaced_names(files):
    return "\n".join(f"- `{f.name}`" for f in files)


def main():
    for game in GAMES:
        slug = game["slug"]
        out = HERE / slug
        out.mkdir(exist_ok=True)
        print(f"{slug}…")

        app = itunes(game)
        if not app:
            continue
        print(f"    App Store: {app.get('trackName')} ({app.get('sellerName')})")

        shots = app.get("screenshotUrls") or []
        if not shots:
            shots = app.get("ipadScreenshotUrls") or []
        phone_files = []
        for i, url in enumerate(spaced(shots, PHONE_SHOTS), 1):
            p = out / f"phone-{i:02d}.jpg"
            if p.exists() and p.stat().st_size > 0:      # already collected: leave it
                phone_files.append(p)
                continue
            raw = get(url)
            if raw and save_image(raw, p, MAX_DIM):
                phone_files.append(p)
        if app.get("artworkUrl512"):
            raw = get(app["artworkUrl512"])
            if raw:
                save_image(raw, out / "icon.jpg", 512)

        steam_files, steam_url, steam_name = [], None, None
        if game.get("steam"):
            d = steam(game["steam"])
            if d:
                want = (game.get("expect") or "").lower()
                got = d.get("name", "").lower()
                if want and want not in got and got not in want:
                    print(f"    ! steam app {game['steam']} is '{d.get('name')}', not '{game['expect']}' - skipped")
                else:
                    steam_name = d.get("name")
                    steam_url = f"https://store.steampowered.com/app/{game['steam']}/"
                    print(f"    Steam: {steam_name}")
                    for i, s in enumerate(spaced(d.get("screenshots", []), STEAM_SHOTS), 1):
                        p = out / f"steam-{i:02d}.jpg"
                        if p.exists() and p.stat().st_size > 0:
                            steam_files.append(p)
                            continue
                        raw = get(s.get("path_full") or s.get("path_thumbnail"))
                        if raw and save_image(raw, p, MAX_DIM):
                            steam_files.append(p)
            else:
                print("    ! steam lookup failed, phone shots only")

        lines = [
            f"# {app.get('trackName', slug)}",
            "",
            f"- **By:** {app.get('sellerName', '?')}",
            f"- **How to play it:** {game['access']}",
            f"- **Rating:** {app.get('averageUserRating', 0):.1f} / 5 from {app.get('userRatingCount', 0):,} players",
            f"- **Genres:** {', '.join(app.get('genres', [])[1:]) or 'Games'}",
            f"- **Released:** {(app.get('releaseDate') or '')[:10]} · **Last updated:** {(app.get('currentVersionReleaseDate') or '')[:10]}",
            f"- **App Store:** {app.get('trackViewUrl', '')}",
        ]
        if steam_url:
            lines.append(f"- **Steam:** {steam_url}" + (f" ({game['steam_note']})" if game.get("steam_note") else ""))
        lines += [
            "",
            "## What it is (from the store page)",
            "",
            excerpt(app.get("description", "")),
            "",
            "## Screenshots",
            "",
        ]
        if phone_files:
            lines += ["Phone (in order):", "", spaced_names(phone_files), ""]
        if steam_files:
            lines += ["Desktop / console:", "", spaced_names(steam_files), ""]
        if (out / "icon.jpg").exists():
            lines += ["- `icon.jpg` (app icon)", ""]
        (out / "store.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
    print("done")
