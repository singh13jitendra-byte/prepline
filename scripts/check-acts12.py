#!/usr/bin/env python3
"""
Package 2 (Acts I and II) regression checks. Run against a started server:

    python3 scripts/check-acts12.py http://localhost:3102 [--shots DIR]

What it asserts
- Jumping (immediate scroll) straight into reason, daybreak, applied, interview
  and hinge at 0.9 leaves every visible copy of the Role's face (each Actor skin)
  showing its full end state: title visible, card counted to 9 with all three
  chips typed, the tile chip on the right label.
- The same after a fast scripted fling through the act (no immediate jumps).
- Split headings never lose their spaces, at any point of their animation.
- No class collisions: every face root renders with non-zero opacity.
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3102"
SHOTS = Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None
FR = "(n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })"

FACES = """() => {
  const vis = (el) => { if (!el) return 0; let o = 1, n = el;
    while (n && n !== document.body) { const c = getComputedStyle(n);
      if (c.visibility === 'hidden' || c.display === 'none') return 0; o *= parseFloat(c.opacity); n = n.parentElement; }
    return o; };
  const out = [];
  document.querySelectorAll('.actor .actor-face').forEach((f) => {
    if (getComputedStyle(f).display === 'none') return;
    f.querySelectorAll(':scope > .actor-skin').forEach((k) => {
      if (getComputedStyle(k).display === 'none') return;
      const root = k.querySelector('.pl-card, .pl-tile, .pl-row');
      const title = k.querySelector('.pl-card-title, .pl-tile-title, .pl-row-title');
      out.push({ face: f.dataset.face, skin: k.dataset.skin, root: vis(root), title: vis(title),
        num: (k.querySelector('.pl-card-num') || {}).textContent || null,
        chips: [...k.querySelectorAll('.pl-card-chip')].map((c) => [c.querySelector('[aria-hidden]').textContent, vis(c)]),
        chip: (k.querySelector('.pl-tile-chip-b:not([style*="none"])') || {}).textContent || null });
    });
  });
  const s = window.__story.get();
  return { beat: s.beat, p: s.beatProgress, faces: out };
}"""

EXPECT = {
    "reason": ("card", None),
    "daybreak": ("card", None),
    "applied": ("tile", "Applied Tue"),
    "interview": ("tile", "Thu 11:40"),
    "hinge": ("tile", "Thu 11:40"),
}
CHIPS = ["Design-system team", "HealthTech", "Matches your case studies"]

passed = failed = 0


def check(ok, msg):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
        print("  FAIL", msg)


def assert_faces(info, beat, how):
    face, chip = EXPECT[beat]
    faces = [f for f in info["faces"] if f["face"] == face]
    check(info["beat"] == beat, f"{how} {beat}: landed on {info['beat']}")
    check(len(faces) >= 1, f"{how} {beat}: a {face} face is on screen ({info['faces']})")
    for f in faces:
        tag = f"{how} {beat} {f['face']}:{f['skin']}"
        check(f["root"] > 0.99 and f["title"] > 0.99, f"{tag}: content visible (root {f['root']:.2f}, title {f['title']:.2f})")
        if face == "card":
            check(f["num"] == "9", f"{tag}: counted to 9, got {f['num']}")
            check([c[0] for c in f["chips"]] == CHIPS and all(c[1] > 0.99 for c in f["chips"]), f"{tag}: all chips typed and visible {f['chips']}")
        else:
            check(f["chip"] == chip, f"{tag}: chip reads {chip!r}, got {f['chip']!r}")


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])

    print("[jump straight in]")
    for beat in EXPECT:
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_function("() => window.__story !== undefined")
        pg.evaluate(FR, 5)
        pg.evaluate("([b]) => window.__story.scrollToBeat(b, 0.9, { immediate: true })", [beat])
        pg.evaluate(FR, 6)
        pg.wait_for_timeout(250)
        assert_faces(pg.evaluate(FACES), beat, "jump")
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            pg.screenshot(path=str(SHOTS / f"jump-{beat}.png"))
        pg.close()

    print("[fast fling through the acts]")
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_function("() => window.__story !== undefined")
    pg.evaluate(FR, 5)
    for beat in EXPECT:
        # A few big wheel steps, no immediate jump: beats are crossed within frames.
        for _ in range(40):
            info = pg.evaluate("() => window.__story.get()")
            order = ["hero", "pass1", "pass2", "ranked", "reason", "daybreak", "saved", "applied", "interview", "hinge", "nightfall", "unfold", "q1", "q2", "q3", "votes", "dawn", "seat", "footer"]
            if order.index(info["beat"]) > order.index(beat) or (info["beat"] == beat and info["beatProgress"] > 0.85):
                break
            pg.mouse.wheel(0, 900)
            pg.evaluate(FR, 2)
        pg.evaluate("([b]) => window.__story.scrollToBeat(b, 0.9, { immediate: true })", [beat])
        pg.evaluate(FR, 6)
        pg.wait_for_timeout(1300)
        assert_faces(pg.evaluate(FACES), beat, "fling")
    pg.close()

    print("[split headings keep their spaces]")
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_function("() => window.__story !== undefined")
    for beat, at in [("ranked", 0.1), ("ranked", 0.5), ("reason", 0.12), ("reason", 0.6), ("hinge", 0.5)]:
        pg.evaluate("([b, a]) => window.__story.scrollToBeat(b, a, { immediate: true })", [beat, at])
        pg.evaluate(FR, 4)
        texts = pg.evaluate("""() => [...document.querySelectorAll('.rd-h2-vis, .bd-sentence-vis')].map((el) => {
            const r = document.createRange(); r.selectNodeContents(el); return r.toString().replace(/\\s+/g, ' ').trim(); })""")
        widths = pg.evaluate("""() => [...document.querySelectorAll('.rd-h2-vis')].map((el) => {
            const w = [...el.querySelectorAll('.rd-wmask')].map((m) => m.getBoundingClientRect());
            let gaps = 0; for (let i = 1; i < w.length; i++) if (Math.abs(w[i].top - w[i-1].top) < 4 && w[i].left - w[i-1].right < 4) gaps++;
            return gaps; })""")
        expected = {"Twelve worth your time.", "Every score comes with a reason.", "The moment an interview is booked, your prep sheet is written."}
        for t in texts:
            check(t in expected, f"{beat}@{at}: spaced text {t!r}")
        check(all(g == 0 for g in widths), f"{beat}@{at}: visible gaps between heading words {widths}")
    pg.close()
    b.close()

print(f"\n{passed} checks passed, {failed} failed")
sys.exit(1 if failed else 0)
