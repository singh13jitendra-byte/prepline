#!/usr/bin/env python3
"""
Type-on-painting check (WCAG AA): the worst-case contrast of every visible text block against the
pixels actually behind it, at 1440x900 and 390x844.

    python3 scripts/check-contrast.py [base_url] [--strict] [--all]

For each beat it takes one screenshot with all text made transparent (so the painting, slips and
washes are what is sampled), then for every visible leaf text element samples a grid of pixels
under its box and reports the LOWEST contrast with the element's computed colour.

  needs 4.5:1   text under 24px (under 18.66px when bold)
  needs 3:1     larger text

Prints the failures (and with --all every block). --strict exits 1 if anything fails.
The rule this enforces is in app/globals.css: text under 18px never sits directly on a painting;
put it on .slip, .slip-night, .wash-night or .wash-day.
Limits: text over a moving WebGL firefly is sampled as it is in that frame; product UI inside
aria-hidden flying copies is skipped (the docked copy is measured instead).
"""
import argparse
import io
import re
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
BEATS = [("hero", 0.0), ("pass1", 0.5), ("ranked", 0.9), ("reason", 0.9), ("saved", 0.95), ("interview", 0.9), ("hinge", 0.6),
         ("unfold", 0.9), ("q2", 0.9), ("votes", 0.9), ("seat", 0.5), ("seat", 0.95), ("footer", 1.0)]

COLLECT = """() => {
  const out = [];
  document.querySelectorAll('body *').forEach((e) => {
    if (e.children.length || !e.textContent.trim()) return;
    if (e.closest('[aria-hidden=true], [inert], .sr-only, .story-debug')) return;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return;
    let op = 1, x = e;
    while (x) { const c = getComputedStyle(x); op *= +c.opacity; if (c.visibility === 'hidden' || c.display === 'none') { op = 0; break; } x = x.parentElement; }
    if (op < 0.85) return;                       // mid-fade copy is judged where it rests
    const cs = getComputedStyle(e);
    const scale = e.offsetWidth ? r.width / e.offsetWidth : 1;
    // Only the points where this element is really the thing on top: text scrolled under a header,
    // clipped by a scroll area or covered by another layer is not on screen there.
    // (elementFromPoint skips pointer-events:none, which most story copy is: lift it on this one)
    const pe = e.style.pointerEvents;
    e.style.pointerEvents = 'auto';
    const pts = [];
    for (let i = 1; i < 8; i++) for (let j = 1; j < 4; j++) {
      const x = r.left + (r.width * i) / 8, y = r.top + (r.height * j) / 4;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit === e || (hit && e.contains(hit))) pts.push([x, y]);
    }
    e.style.pointerEvents = pe;
    if (pts.length < 3) return;
    out.push({ pts, x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize) * scale,
               bold: (parseInt(cs.fontWeight) || 400) >= 700, text: e.textContent.trim().slice(0, 44),
               where: (e.closest('header, footer, .slip, .slip-night, .wash-night, .wash-day, .face-slot, section')?.className || e.closest('section, header, footer')?.id || '').toString().split(' ')[0] });
  });
  return out;
}"""


def lum(c):
    def ch(v):
        v = v / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def ratio(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def rgb(s):
    return tuple(float(v) for v in re.findall(r"[\d.]+", s)[:3])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?", default="http://localhost:3100")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    if "explore=1" in args.url:  # the fireflies stop (?explore=1): measure its copy too
        BEATS.insert(2, ("explore", 0.5))
    fails = 0
    total = 0
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        for vw, vh, mobile in [(1440, 900, False), (390, 844, True)]:
            ctx = b.new_context(viewport={"width": vw, "height": vh}, is_mobile=mobile, has_touch=mobile)
            pg = ctx.new_page()
            pg.goto(args.url, wait_until="networkidle")
            pg.wait_for_function("() => window.__story !== undefined")
            pg.wait_for_timeout(3000)
            pg.add_style_tag(content=".cc-hide *{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}.cc-hide ::placeholder{color:transparent!important}")
            for beat, at in BEATS:
                pg.evaluate("([b, a]) => window.__story.scrollToBeat(b, a, { immediate: true })", [beat, at])
                pg.wait_for_timeout(2200)
                boxes = pg.evaluate(COLLECT)
                pg.evaluate("document.body.classList.add('cc-hide')")
                pg.wait_for_timeout(120)
                img = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
                pg.evaluate("document.body.classList.remove('cc-hide')")
                k = img.width / vw
                for bx in boxes:
                    px = [img.getpixel((int(x * k), int(y * k))) for x, y in bx["pts"]]
                    if not px:
                        continue
                    worst = min(ratio(rgb(bx["color"]), q) for q in px)
                    large = bx["size"] >= 24 or (bx["bold"] and bx["size"] >= 18.66)
                    need = 3.0 if large else 4.5
                    total += 1
                    bad = worst < need
                    fails += bad
                    if bad or args.all:
                        print(f"{'FAIL' if bad else 'ok  '} {vw:4d} {beat:9s}@{at:<4} {worst:5.2f}:1 (needs {need}) {bx['size']:5.1f}px  [{bx['where'][:18]:18s}] {bx['text']!r}", flush=True)
            ctx.close()
        b.close()
    print(f"\n{total} text blocks measured, {fails} below AA")
    if fails and args.strict:
        sys.exit(1)


if __name__ == "__main__":
    main()
