#!/usr/bin/env python3
"""Local gate checks for the token-radar-02 entry (run from the repo root).

Usage: python3 check-local.py [out_dir]  (default: out)
Checks board.json, dossier.json, dashboard/ and screenshots/ in the given out dir,
plus the repo's dashboard source total. Exits 1 on any failure.
"""
import json
import os
import re
import sys

from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
SNAP = os.path.expanduser("~/workspace/makefun/token-radar-01-kit/input/snapshot.json")
REPO = os.path.dirname(os.path.abspath(__file__))

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, detail)


snap = json.load(open(SNAP))
board = json.load(open(os.path.join(OUT, "board.json")))
rows = board["rows"] if isinstance(board, dict) else board
watchlist = snap["watchlist"]

check("rows 100-4000", 100 <= len(rows) <= 4000, f"n={len(rows)}")
ranks = [r["rank"] for r in rows]
check("ranks exactly 1..N unique", sorted(ranks) == list(range(1, len(rows) + 1)))
vals = [r["implied_value_usd"] for r in rows]
check("implied non-increasing by rank", all(vals[i] >= vals[i + 1] for i in range(len(vals) - 1)),
      f"first={vals[0]} last={vals[-1]}")
check("implied not all equal", len(set(vals)) > 1, f"distinct={len(set(vals))}")
slugs = {r["slug"] for r in rows}
missing = [s for s in watchlist if s not in slugs]
check("all 40 watchlist slugs present", not missing, f"missing={missing}")
bad_steps = []
for r in rows:
    steps = r["farm_steps"]
    if not (3 <= len(steps) <= 12):
        bad_steps.append((r["slug"], f"{len(steps)} steps"))
    for s in steps:
        if not (20 <= len(s.strip()) <= 600):
            bad_steps.append((r["slug"], f"step len {len(s.strip())}"))
check("farm_steps 3-12, each 20-600 chars", not bad_steps, str(bad_steps[:3]))
check("every row slug is a snapshot protocol",
      all(r["slug"] in {p["slug"] for p in snap["protocols"]} for r in rows))
check("7 farm steps per row", all(len(r["farm_steps"]) == 7 for r in rows))

dash = os.path.join(OUT, "dashboard")
files = []
for root, _dirs, names in os.walk(dash):
    for n in names:
        files.append(os.path.join(root, n))
total = sum(os.path.getsize(f) for f in files)
check("dashboard <=400 files / 4MiB", len(files) <= 400 and total <= 4 * 1024 * 1024,
      f"files={len(files)} bytes={total}")
src_total = 0
for n in ("index.html", "app.css", "app.js"):
    src_total += os.path.getsize(os.path.join(dash, n))
check("dashboard source total <60000 bytes", src_total < 60000, f"bytes={src_total}")

# No network URLs in HTML attributes, CSS, or JS imports.
url_pat = re.compile(r"https?://")
bad_urls = []
for f in files:
    text = open(f, encoding="utf-8", errors="ignore").read()
    if url_pat.search(text):
        # Allow URLs only in visible text/comments, never in attributes/imports:
        # flag any occurrence in href/src/import/url(/@import, then report.
        for m in re.finditer(r"(?:href|src|import|url\(|@import)[^>\"']*https?://", text):
            bad_urls.append((os.path.basename(f), m.group(0)[:80]))
        # A bare URL anywhere in a .css/.js file is treated as a failure here too,
        # since this dashboard carries none at all.
        if f.endswith((".css", ".js")) and not bad_urls:
            bad_urls.append((os.path.basename(f), "bare http(s) URL in source"))
check("no http(s) URLs in dashboard source", not bad_urls, str(bad_urls[:3]))

shots_dir = os.path.join(OUT, "screenshots")
shots = sorted(os.listdir(shots_dir))
check("3 screenshots", len(shots) == 3, str(shots))
for name in shots:
    path = os.path.join(shots_dir, name)
    size = os.path.getsize(path)
    ok_size = size <= 512 * 1024
    with Image.open(path) as im:
        w, h = im.size
        fmt = im.format
    ok_dim = max(w, h) <= 1440 and min(w, h) >= 800
    check(f"screenshot {name} <=512KiB, {w}x{h} {fmt}",
          ok_size and ok_dim, f"bytes={size}")

dossier = os.path.join(OUT, "dossier.json")
dsize = os.path.getsize(dossier)
check("dossier <=1.5MiB", dsize <= 1536 * 1024, f"bytes={dsize}")
doc = json.load(open(dossier))
check("dossier schema + 3 images", doc.get("schema") == "makefun/dossier/v1" and len(doc.get("images", [])) == 3,
      f"images={len(doc.get('images', []))}")

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
