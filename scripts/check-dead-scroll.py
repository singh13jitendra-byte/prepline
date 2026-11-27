#!/usr/bin/env python3
"""
Dead-scroll scan (craft checklist #4: "in any 120px of scroll inside any pin, something visibly changes").

Steps the page 120px at a time, waits for timed performances to settle, and
compares screenshots. A step whose mean pixel difference is under the threshold
is DEAD: the wheel did nothing. Only pinned beats count (the footer scrolls
naturally). The CSS field is forced (?world=css) so the result is deterministic
and field drift cannot hide a hold.

    python3 scripts/check-dead-scroll.py [base_url] [--max-dead N] [--step 120] [--threshold 0.15]

Exit code 1 when more than --max-dead steps are dead (default 0: the goal).
Every timed beat needs a scrubbed breath (story.breath in lib/story.ts) for this to pass.
"""
import argparse
import io
import sys
from collections import Counter

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("url", nargs="?", default="http://localhost:3100")
ap.add_argument("--max-dead", type=int, default=0)
ap.add_argument("--step", type=int, default=120)
ap.add_argument("--threshold", type=float, default=0.15)
ap.add_argument("--settle", type=int, default=1350, help="ms to wait after each step")
ap.add_argument("--quiet", action="store_true", help="print dead steps and the summary only")
args = ap.parse_args()
# A query on the base URL is kept (?explore=1, the fireflies stop).
_base, _, _query = args.url.partition("?")
URL = _base.rstrip("/") + "/?world=css" + ("&" + _query if _query else "")
# The hold of the explore stop is a pause to explore in, by design: the scene moves on its own
# clock and the wheel only fills the cue's rule. Its steps are counted apart, not as dead scroll.
EXPLORE = "explore=1" in _query
HOLD = (0.1, 0.9)
held = 0

with sync_playwright() as p:
    # With the stop, the 3D meadow is on the page: software GL as in the other checks, and the scene
    # asked for fewer pixels (its window.__ffDebug), or a screenshot can time out. No flag: as before.
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]) if EXPLORE else p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    if EXPLORE:
        pg.add_init_script("window.__ffDebug = { dpr: 0.3 };")
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_timeout(2500)
    H = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    prev = None
    y = 0
    dead = []
    steps = 0
    while y <= H:
        pg.evaluate(f"window.scrollTo({{ top: {y}, behavior: 'instant' }})")
        pg.wait_for_timeout(args.settle)
        im = Image.open(io.BytesIO(pg.screenshot())).convert("L").resize((360, 225))
        beat, prog = pg.evaluate("(() => { const s = window.__story.get(); return [s.beat, s.beatProgress]; })()")
        if EXPLORE and beat == "explore" and HOLD[0] < prog < HOLD[1]:
            held += 1
        elif prev is not None and beat != "footer":
            steps += 1
            d = ImageStat.Stat(ImageChops.difference(im, prev)).mean[0]
            is_dead = d < args.threshold
            if is_dead:
                dead.append((y, beat, prog, d))
            if is_dead or not args.quiet:
                print(f"{y:6d} {beat:10s} {prog:.2f} diff={d:.2f}{'  <-- DEAD' if is_dead else ''}", flush=True)
        prev = im
        y += args.step
    b.close()

per_beat = Counter(beat for _, beat, _, _ in dead)
print(f"\n{len(dead)} dead {args.step}px steps of {steps} inside pins ({len(dead) * args.step}px)")
if EXPLORE:
    print(f"  ({held} steps in the explore stop's hold are not counted: a pause by design)")
for beat, n in per_beat.items():
    span = [f"{pr:.2f}" for _, bt, pr, _ in dead if bt == beat]
    print(f"  {beat:10s} {n}  at progress {', '.join(span)}")
if len(dead) > args.max_dead:
    print(f"dead-scroll check: FAIL (allowed {args.max_dead})")
    sys.exit(1)
print("dead-scroll check: OK")
