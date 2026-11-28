#!/usr/bin/env python3
"""
The explore stop (the garden): the beat between `pass2` and `ranked`, behind `?explore=1`.

The hold opens with the scroll tour (components/garden/tour: about the first 58%, to explore beat
progress FREE = 0.554), during which the scene does not take the pointer; free explore is the rest.
Pointer and tap checks run in free explore; the tour has its own section.

Run against a production build:

    python3 scripts/check-explore.py http://localhost:3112
    python3 scripts/check-explore.py http://localhost:3112 --shots DIR      # also writes contact sheets and stills
    python3 scripts/check-explore.py http://localhost:3112 --only traps,frames
    python3 scripts/check-explore.py http://localhost:3112 --only frames --scene-dpr 1 --shots DIR

The 3D scene is slow under software GL (about 3 frames a second at full size), so by default it
is asked to render at 0.3 of the screen's pixels (--scene-dpr, through window.__gardenDebug). That
changes nothing this script asserts. Use --scene-dpr 1 for contact sheets to look at.

What it asserts (section names are the --only keys)
  off      without the flag there is no stop: no stage, no rail tick, and the page is exactly
           EXPLORE_VH story units shorter than with it
  beats    with the flag every beat is visited in order, `explore` between `pass2` and `ranked`, and
           in reverse on the way up; the rail has a tick for it
  parity   outside `explore` the story is the story without the flag: at the same beat and progress
           the Line, the painted scene, the day line and the Actor are identical (re-timing check)
  handoff  at both ends of `explore` the page is in the end state of `pass2` (counter up, stage off,
           dot field whole); in the hold the scene is fully up and `active` and the counter is gone;
           it is live (takes the pointer) in free explore only, not during the tour; `active` is
           false outside the beat; Lumi's lantern (worldBus.lantern, the cursor lantern is retired)
           is lit in the meadow and stays lit through the garden
  tour     the scroll tour: the slip comes up at the top match, grows into its card with Lumi
           perched on it (worldBus.garden perch 1), folds; Lumi names the bellflower and the bud;
           no flower named in the hint (Lumi's note); scrubbing back gives the same states; nothing
           of the tour is left in free explore or outside the beat
  traps    wheeling with the pointer at 25/50/70/85% of the width goes through the stop, down and
           up, by exactly the wheeled distance; the same over an open card; nothing on screen
           carries data-lenis-prevent; a touch drag over the scene scrolls the page (390)
  frames   10fps frames through both hand-offs, down then up, at 1440x900 and 390x844: the fades are
           monotonic, and no frame is an outlier between its neighbours (a blank or a flicker)
  flight   after scrolling through the stop the twelve still fly onto the ranked rows: the rows
           light as without the flag, and the frame mid-flight matches the flag-off frame
  list     the keyboard's way in: "All roles" opens, a row opens that role's card, Esc closes it
  phone    390x844 with touch: the same beat; a tap opens the card as a bottom sheet
  reduced  prefers-reduced-motion: the stop is a still block between the figures and the list, the
           scene is active only while it is on screen (and, with the stub, is told to hold still)
  cost     elements restyled per frame through the hand-off and in the hold (MutationObserver),
           printed against the flag-off story at the same place

It works with the stub scene, card and list and with the real ones: a flower is reached through
the stub's dots when they are there, through the garden's flowers (window.__garden_scene), else
through the "All roles" list.
Exit code 0 = all passed.
"""
import argparse
import io
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat
from playwright.sync_api import sync_playwright

CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
EXPLORE_VH = 300
BASE = [
    "hero", "pass1", "pass2", "ranked", "reason", "daybreak",
    "saved", "applied", "interview", "hinge", "nightfall",
    "unfold", "q1", "q2", "q3", "votes", "dawn", "seat", "footer",
]
WITH = BASE[:3] + ["explore"] + BASE[3:]
# Beat and progress points with nothing timed on screen (scrubbed states only).
POINTS = [
    ("hero", 0.5), ("pass1", 0.5), ("pass2", 0.5), ("pass2", 0.99), ("ranked", 0.01), ("ranked", 0.3), ("ranked", 0.9),
    ("reason", 0.2), ("daybreak", 0.6), ("saved", 0.5), ("hinge", 0.5), ("nightfall", 0.5), ("q2", 0.5), ("dawn", 0.7), ("seat", 0.6),
]
DESKTOP = {"viewport": {"width": 1440, "height": 900}, "device_scale_factor": 1}
PHONE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 1, "is_mobile": True, "has_touch": True}

FRAMES = """(n) => new Promise((done) => { let i = 0; const f = () => (++i >= n ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); })"""
STATE = """() => { const s = window.__story.get(); return {
    beat: s.beat, p: s.beatProgress, pos: s.pos, chapter: s.chapter, dayTop: s.dayTop,
    line: { ...s.line }, scene: { ...s.scene }, actor: { ...s.actor }, y: window.scrollY }; }"""
# What the stage shows right now, read from the DOM only.
STAGE = """() => {
  const ex = document.querySelector('[data-explore-stage]');
  const num = (el, p) => (el ? parseFloat(getComputedStyle(el)[p]) : null);
  const pass = document.querySelector('.rd-pass');
  const ui = ex && ex.querySelector('.ex-ui');
  const clip = ui ? getComputedStyle(ui).clipPath : null;
  const m = clip && clip.match(/inset\\(0(?:px|%)? ([\\d.]+)%/);
  const fill = ex && ex.querySelector('.ex-meter > i');
  const s = window.__story.get();
  return {
    beat: s.beat, p: +s.beatProgress.toFixed(4), y: Math.round(window.scrollY),
    stage: !!ex, on: !!ex && ex.hasAttribute('data-on'), live: !!ex && ex.hasAttribute('data-live'),
    active: !!ex && ex.hasAttribute('data-active'), ready: !!ex && ex.hasAttribute('data-ready'),
    visible: !!ex && getComputedStyle(ex).visibility === 'visible',
    scene: num(ex && ex.querySelector('.ex-scene'), 'opacity'), pass: num(pass, 'opacity'),
    ui: clip === null ? null : clip === 'none' ? 1 : m ? 1 - parseFloat(m[1]) / 100 : 0,
    fill: fill ? new DOMMatrixReadOnly(getComputedStyle(fill).transform).a : null,
    sceneActive: !!ex && !!ex.querySelector('.ex-ff[data-active]'),
    lantern: !!window.__lumi && window.__lumi.get().lantern > 0.05,
    lit: document.querySelectorAll('li.rd-row[data-lit]').length,
    more: !!document.querySelector('li.rd-more[data-lit]'),
    lift: !!document.querySelector('[data-world-canvas][data-lift]'),
    tour: !!ex && ex.hasAttribute('data-tour'),
    // Lenis leaves the wheel alone over these: one that can be hit on screen is a scroll trap.
    prevent: [...document.querySelectorAll('[data-lenis-prevent]')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
        const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        if (hit && el.contains(hit)) return true;
      }
      return false;
    }).map((el) => el.className || el.tagName),
  };
}"""

failures = []
passes = 0
notes = []


def check(ok, message):
    global passes
    if ok:
        passes += 1
    else:
        failures.append(message)
        print(f"  FAIL  {message}")


def note(text):
    notes.append(text)
    print(f"  {text}")


def frames(page, n=4):
    page.evaluate(FRAMES, n)


def with_flag(url, extra=""):
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}explore=1{extra}"


SCENE_DPR = 0.3


def open_page(browser, url, **ctx):
    context = browser.new_context(**ctx)
    page = context.new_page()
    page.add_init_script(f"window.__ffDebug = Object.assign(window.__ffDebug || {{}}, {{ dpr: {SCENE_DPR} }}); window.__gardenDebug = Object.assign(window.__gardenDebug || {{}}, {{ dpr: {SCENE_DPR} }});")
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 and "favicon" not in r.url and "/_vercel/" not in r.url else None)
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("() => window.__story !== undefined")
    frames(page, 6)
    return context, page, errors


def goto_beat(page, beat, at=0.5, settle_ms=0):
    page.evaluate("([b, a]) => window.__story.scrollToBeat(b, a, { immediate: true })", [beat, at])
    frames(page, 4)
    if settle_ms:
        page.wait_for_timeout(settle_ms)
        frames(page, 2)
    return page.evaluate(STATE)


def wait_ready(page):
    """The stage is mounted, and the scene has said it is ready (it loads once the hero is behind)."""
    page.wait_for_selector("[data-explore-stage]", state="attached", timeout=15000)
    goto_beat(page, "pass1", 0.5)
    page.wait_for_selector("[data-explore-stage][data-ready]", state="attached", timeout=30000)
    page.wait_for_timeout(700)


def gray(png, width=360):
    im = Image.open(io.BytesIO(png)).convert("L")
    return im.resize((width, round(im.height * width / im.width)))


def diff(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


def sheet(shots, labels, out, cols=8, width=240):
    ims = [Image.open(io.BytesIO(s)) for s in shots]
    w = width
    h = round(ims[0].height * w / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGB", (cols * w, rows * (h + 16)), (18, 22, 20))
    d = ImageDraw.Draw(S)
    for i, (im, lb) in enumerate(zip(ims, labels)):
        x, y = (i % cols) * w, (i // cols) * (h + 16)
        S.paste(im.convert("RGB").resize((w, h)), (x, y + 16))
        d.text((x + 3, y + 2), lb, fill=(240, 230, 200))
    S.save(out)


def sweep_beats(page):
    max_y = page.evaluate("() => document.documentElement.scrollHeight - innerHeight")
    step = max(60, page.evaluate("() => innerHeight") // 6)

    def run(ys):
        seen = []
        for y in ys:
            page.evaluate("(y) => window.scrollTo({ top: y, behavior: 'instant' })", y)
            frames(page, 3)
            b = page.evaluate("() => window.__story.get().beat")
            if not seen or seen[-1] != b:
                seen.append(b)
        return seen

    ys = list(range(0, max_y, step)) + [max_y]
    return run(ys), run(list(reversed(ys)))


CARD_OPEN = """() => { const d = document.querySelector('[role=dialog]'); if (!d) return false;
  const root = d.closest('.ffc'); if (root) return root.hasAttribute('data-open');
  const c = getComputedStyle(d); return c.visibility === 'visible' && c.display !== 'none'; }"""
# A flower of the real garden that is on screen, clear of the stage's copy (window.__garden_scene is its
# debug hook: flowers() gives each heart in viewport px). The nearest one in the middle of the screen.
FIREFLY = """(touch) => { const g = window.__garden_scene; if (!g || !g.flowers) return null; let best = null;
  const y0 = innerHeight * (touch ? 0.28 : 0.3), y1 = innerHeight * (touch ? 0.72 : 0.75);
  for (const p of g.flowers()) { if (p.x < innerWidth * 0.2 || p.x > innerWidth * 0.8 || p.y < y0 || p.y > y1) continue;
    if (!best || p.depth < best.depth) best = { x: p.x, y: p.y, depth: p.depth, j: p.index }; }
  return best; }"""
# Free explore (the tour is over): pointer and tap checks run here.
FREE = 0.7


# Is the stage's line rolled away (its clip closed from the right)? It is on phones while a sheet is open.
LINE_ROLLED = """() => /inset\\(0(px)? 100%/.test(getComputedStyle(document.querySelector('.ex-line')).clipPath)"""


def open_card(page, touch=False):
    """Focus one flower: a stub dot, a flower of the real garden, or (failing both) a row of the list."""
    dot = page.query_selector("[data-explore-stage] [data-ff-stub] .ffs-dot[data-kept]")
    real = not dot and page.evaluate("() => !!(window.__garden_scene && window.__garden_scene.flowers)")
    how = None
    if dot:
        b = dot.bounding_box()
        x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        if touch:
            page.touchscreen.tap(x, y)
        else:
            page.mouse.move(x - 60, y - 40)
            page.mouse.move(x, y, steps=4)
        how = "dot"
    elif real:
        # Rest the pointer on one (or tap it twice: the first tap marks it) until the scene has chosen it.
        for n in range(60):
            if page.evaluate(CARD_OPEN):
                how = "flower"
                break
            pt = page.evaluate(FIREFLY, touch)
            if pt and touch and n % 12 == 0:
                page.touchscreen.tap(pt["x"], pt["y"])
            elif pt and not touch:
                page.mouse.move(pt["x"], pt["y"])
            page.wait_for_timeout(110)
    if how is None:
        toggle = page.query_selector("[data-explore-stage] button[aria-expanded]")
        if not toggle:
            return None, "no way in"
        (toggle.tap if touch else toggle.click)()
        page.wait_for_timeout(450)
        row = page.query_selector("[data-explore-stage] button[data-id]")
        if not row:
            return None, "no rows"
        (row.tap if touch else row.click)()
        how = "list"
    try:
        page.wait_for_function(CARD_OPEN, timeout=6000)
    except Exception:
        return None, how
    page.wait_for_timeout(900)
    return page.evaluate("() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; }"), how


# ───────────────────────────────────────────────────────────── sections ──


def check_off(browser, url, shared):
    print("[off] no flag, no stop")
    ctx, page, errors = open_page(browser, url, **DESKTOP)
    info = page.evaluate("""() => ({ stage: !!document.querySelector('[data-explore-stage]'), ticks: document.querySelectorAll('.rail-base .rail-link').length,
        explore: !!document.querySelector('.rail [data-rail=explore]'), railAttr: document.querySelector('.rail').hasAttribute('data-explore'),
        h: document.documentElement.scrollHeight, vh: innerHeight, chunks: performance.getEntriesByType('resource').filter((r) => /fireflies|Explore/i.test(r.name)).length })""")
    check(not info["stage"], "off: there is no explore stage in the DOM")
    check(info["ticks"] == 5 and not info["explore"] and not info["railAttr"], f"off: the rail has its five ticks ({info['ticks']})")
    down, up = sweep_beats(page)
    check(down == BASE, f"off: beats in order, no explore: {down}")
    check(up == list(reversed(BASE)), f"off: and in reverse: {up}")
    shared["h_off"] = info["h"]
    shared["off"] = {f"{b}@{a}": goto_beat(page, b, a, 250) for b, a in POINTS}
    # The flight without the flag, for [flight].
    lit = {}
    for at in (0.3, 0.45, 0.9):
        goto_beat(page, "ranked", at, 500)
        lit[at] = page.evaluate(STAGE)["lit"]
    shared["off_lit"] = lit
    page.mouse.move(8, 8)
    goto_beat(page, "ranked", 0.33, 700)
    shared["off_flight"] = [gray(page.screenshot(), 720), None]
    page.wait_for_timeout(400)
    shared["off_flight"][1] = gray(page.screenshot(), 720)
    check(not errors, f"off: no console errors: {errors[:3]}")
    ctx.close()


def check_beats(page, shared):
    print("[beats] in order, with the stop")
    info = page.evaluate("""() => ({ h: document.documentElement.scrollHeight, vh: innerHeight,
        ticks: [...document.querySelectorAll('.rail-base .rail-link')].map((a) => a.dataset.rail) })""")
    if "h_off" in shared:
        want = EXPLORE_VH * info["vh"] / 100
        check(abs(info["h"] - shared["h_off"] - want) <= 2, f"beats: the page is {EXPLORE_VH} units longer with the flag ({info['h'] - shared['h_off']}px, want {want:.0f})")
    check(info["ticks"] == ["hero", "explore", "ranked", "saved", "unfold", "seat"], f"beats: the rail has a tick for the stop: {info['ticks']}")
    down, up = sweep_beats(page)
    check(down == WITH, f"beats: in order, explore between pass2 and ranked: {down}")
    check(up == list(reversed(WITH)), f"beats: and in reverse: {up}")
    goto_beat(page, "explore", 0.5)
    cur = page.evaluate("() => (document.querySelector('.rail-base .rail-link[aria-current]') || { dataset: {} }).dataset.rail")
    check(cur == "explore", f"beats: the rail's explore tick is current in the stop ({cur})")
    # The tick scrolls to the stop.
    goto_beat(page, "hero", 0)
    page.click(".rail-base .rail-link[data-rail=explore]")
    page.wait_for_function("() => window.__story.get().beat === 'explore'", timeout=8000)
    page.wait_for_timeout(1600)
    s = page.evaluate(STAGE)
    check(s["beat"] == "explore" and s["on"] and (s["live"] or s["tour"]), f"beats: the rail tick lands in the hold, in the tour or free explore ({s['beat']} {s['p']})")


def check_parity(page, shared):
    print("[parity] outside the stop, the story without the flag")
    if "off" not in shared:
        return note("skipped (needs [off])")
    bad = 0
    for b, a in POINTS:
        on = goto_beat(page, b, a, 250)
        off = shared["off"][f"{b}@{a}"]
        shift = EXPLORE_VH if BASE.index(b) >= BASE.index("ranked") else 0
        pairs = [("pos", on["pos"] - shift, off["pos"], 0.05), ("dayTop", on["dayTop"], off["dayTop"], 0.6)]
        pairs += [(f"line.{k}", on["line"][k], off["line"][k], 0.6) for k in ("x0", "x1", "y", "weight")]
        pairs += [(f"scene.{k}", on["scene"][k], off["scene"][k], 0.002) for k in ("mix", "progress")]
        pairs += [(f"actor.{k}", on["actor"][k], off["actor"][k], 0.6) for k in ("x", "y", "w", "h", "travel", "fold", "flip")]
        same = [(f"line.{k}", on["line"][k], off["line"][k]) for k in ("label", "sweep", "daySide", "rest")]
        same += [(f"scene.{k}", on["scene"][k], off["scene"][k]) for k in ("id", "to", "kind")]
        same += [(f"actor.{k}", on["actor"][k], off["actor"][k]) for k in ("present", "docked", "face")] + [("chapter", on["chapter"], off["chapter"])]
        wrong = [f"{n} {x:.3f} vs {y:.3f}" for n, x, y, tol in pairs if abs(x - y) > tol] + [f"{n} {x!r} vs {y!r}" for n, x, y in same if x != y]
        bad += len(wrong)
        check(not wrong, f"parity {b}@{a}: {wrong}")
    if not bad:
        note(f"{len(POINTS)} points identical: line, scene, day line, Actor")


def check_handoff(page):
    print("[handoff] both ends are the end of pass2; the hold is the scene's")
    goto_beat(page, "pass2", 0.99, 300)
    ref = page.evaluate(STAGE)
    check(not ref["on"] and not ref["visible"] and not ref["active"] and ref["pass"] == 1, f"pass2@0.99: stage off, counter up ({ref})")
    for at in (0.0, 0.08, 0.92, 0.999):
        goto_beat(page, "explore", at, 300)
        s = page.evaluate(STAGE)
        check(s["beat"] == "explore" and not s["on"] and not s["visible"] and s["pass"] == 1 and s["scene"] == 0, f"explore@{at}: the end state of pass2 holds (on={s['on']} pass={s['pass']} scene={s['scene']})")
        check(s["active"] and s["sceneActive"], f"explore@{at}: the scene is active for the whole beat")
        check(not s["live"], f"explore@{at}: the scene does not take the pointer yet")
    for at in (0.2, 0.5, 0.7, 0.8):
        goto_beat(page, "explore", at, 300)
        s = page.evaluate(STAGE)
        check(s["on"] and s["visible"] and s["scene"] == 1 and s["ui"] == 1 and s["pass"] == 0, f"explore@{at}: the hold: scene up, copy up, counter gone ({s})")
        free = at >= 0.56
        check(s["live"] == free and s["tour"] == (not free), f"explore@{at}: {'free explore: the scene takes the pointer' if free else 'the tour: the scene does not take the pointer yet'} (live={s['live']} tour={s['tour']})")
        check(abs(s["fill"] - at) < 0.01, f"explore@{at}: the cue's rule follows the wheel ({s['fill']:.3f})")
    for beat, at in (("pass2", 0.9), ("ranked", 0.1), ("reason", 0.5), ("hero", 0.5)):
        goto_beat(page, beat, at, 300)
        s = page.evaluate(STAGE)
        check(not s["active"] and not s["sceneActive"] and not s["on"] and not s["live"], f"{beat}@{at}: the stage is off and the scene is not active outside the beat ({s['active']}, {s['sceneActive']}, {s['on']})")
    # The lantern is Lumi's light now (the cursor lantern is retired): lit in the meadow, and Lumi carries it
    # through the garden (its light on the petals), so it stays lit for the whole stop.
    goto_beat(page, "pass2", 0.5, 200)
    page.wait_for_timeout(1200)
    check(page.evaluate(STAGE)["lantern"], "pass2: Lumi's lantern is lit in the meadow (control)")
    for n, at in enumerate((0.01, 0.5, 0.99)):
        goto_beat(page, "explore", at, 100)
        page.wait_for_timeout(1200 if n == 0 else 500)
        check(page.evaluate(STAGE)["lantern"], f"explore@{at}: Lumi's lantern stays lit in the garden")
    page.mouse.move(8, 8)


def check_traps(page, shots):
    print("[traps] the wheel always moves the page")
    vw, vh = 1440, 900
    notch, n = 120, 38
    lo, hi = goto_beat(page, "pass2", 0.9)["y"], None
    for frac in (0.25, 0.5, 0.7, 0.85):
        for sign in (1, -1):
            if sign == 1:
                y0 = goto_beat(page, "pass2", 0.9, 200)["y"]
            else:
                y0 = page.evaluate("() => window.scrollY")
            page.mouse.move(vw * frac, vh * 0.5)
            stalls, prev, mid = 0, y0, None
            for k in range(n):
                page.mouse.wheel(0, sign * notch)
                page.wait_for_timeout(70)
                y = page.evaluate("() => window.scrollY")
                stalls += 1 if (y - prev) * sign <= 0 else 0
                prev = y
                if k == n // 2:
                    mid = page.evaluate(STAGE)
            page.wait_for_timeout(1100)
            s = page.evaluate(STAGE)
            moved = (s["y"] - y0) * sign
            check(abs(moved - n * notch) <= 3, f"traps x={frac:.0%} {'down' if sign == 1 else 'up'}: {n} notches moved the page {moved}px (want {n * notch})")
            check(stalls == 0, f"traps x={frac:.0%} {'down' if sign == 1 else 'up'}: the page moved on every notch ({stalls} stalls)")
            check(mid["beat"] == "explore", f"traps x={frac:.0%}: the pass went through the stop ({mid['beat']})")
            if sign == 1:
                check(WITH.index(s["beat"]) > WITH.index("ranked"), f"traps x={frac:.0%}: down and out past the list ({s['beat']})")
            else:
                check(WITH.index(s["beat"]) < WITH.index("explore"), f"traps x={frac:.0%}: up and out above the stop ({s['beat']})")
    # Over an open card, over the cue and over the list's button.
    goto_beat(page, "explore", FREE, 500)
    card, how = open_card(page)
    check(card is not None, f"traps: a flower opens its card (through the {how})")
    if card:
        if shots:
            page.screenshot(path=str(shots / "still-1440-card.png"))
        s0 = page.evaluate(STAGE)
        check(not s0["prevent"], f"traps: nothing on screen carries data-lenis-prevent with a card open: {s0['prevent']}")
        page.mouse.move(card["x"] + card["w"] / 2, card["y"] + card["h"] / 2, steps=3)
        for _ in range(6):
            page.mouse.wheel(0, notch)
            page.wait_for_timeout(70)
        page.wait_for_timeout(1000)
        s1 = page.evaluate(STAGE)
        check(abs(s1["y"] - s0["y"] - 6 * notch) <= 3, f"traps: the wheel over the open card moves the page ({s1['y'] - s0['y']}px of {6 * notch})")
    for name, sel in (("cue", ".ex-cue"), ("list button", "[data-explore-stage] button[aria-expanded]")):
        goto_beat(page, "explore", 0.4, 300)
        b = page.query_selector(sel).bounding_box()
        page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, steps=3)
        y0 = page.evaluate("() => window.scrollY")
        for _ in range(6):
            page.mouse.wheel(0, notch)
            page.wait_for_timeout(70)
        page.wait_for_timeout(1000)
        y1 = page.evaluate("() => window.scrollY")
        check(abs(y1 - y0 - 6 * notch) <= 3, f"traps: the wheel over the {name} moves the page ({y1 - y0}px of {6 * notch})")
    # Leaving the hold lets go of the card.
    goto_beat(page, "explore", FREE, 400)
    card, how = open_card(page)
    goto_beat(page, "explore", 0.87, 900)
    shown = lambda: page.evaluate(CARD_OPEN)
    check(card is not None and not shown(), "traps: scrolling into the hand-off closes the card")
    goto_beat(page, "ranked", 0.5, 300)
    check(not shown(), "traps: no card outside the beat")
    page.mouse.move(8, 8)


# The tour's slip and Lumi's wish, read from the DOM and Lumi's debug hook.
TOUR = """() => { const r = document.querySelector('.gts.ex-slip'); const p = r && r.querySelector('.gts-paper');
  const vis = !!r && getComputedStyle(r).visibility === 'visible'; const b = p ? p.getBoundingClientRect() : null;
  const l = window.__lumi && window.__lumi.get(); const g = l ? l.garden : null;
  return { slip: vis, paper: vis && b ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null,
    gx: g ? Math.round(g.x) : null, gy: g ? Math.round(g.y) : null, perch: g ? g.perch : null }; }"""


def check_tour(page, shots):
    print("[tour] the scroll tour: slip, card, Lumi's flowers, the hint; scrubbed both ways")
    page.mouse.move(8, 8)
    at = {}
    for name, bp in (("approach", 0.19), ("slip", 0.234), ("card", 0.31), ("bell", 0.41), ("bud", 0.475), ("hint", 0.535), ("free", FREE)):
        goto_beat(page, "explore", bp, 400)
        at[name] = {**page.evaluate(TOUR), **{k: v for k, v in page.evaluate(STAGE).items() if k in ("tour", "live")}}
        if shots:
            page.screenshot(path=str(shots / f"still-1440-tour-{name}.png"))
    a, sl, c, be, bu, hi, fr = (at[k] for k in ("approach", "slip", "card", "bell", "bud", "hint", "free"))
    near = lambda p, q: abs(p["gx"] - q["gx"]) <= 3 and abs(p["gy"] - q["gy"]) <= 3
    check(a["tour"] and not a["live"] and not a["slip"] and a["gx"] > -900 and a["perch"] == 0, f"tour approach: Lumi is sent to the top match, no slip yet ({a})")
    check(sl["slip"] and sl["paper"] and sl["paper"][3] < 200 and near(sl, a), f"tour slip: the top match's slip is up, Lumi beside the same flower ({sl})")
    check(c["slip"] and c["paper"] and c["paper"][3] > 300 and c["paper"][2] >= 399, f"tour card: the slip has grown into the card ({c['paper']})")
    check(c["perch"] == 1 and c["paper"] and abs(c["gy"] - c["paper"][1]) <= 2 and c["paper"][0] <= c["gx"] <= c["paper"][0] + c["paper"][2], f"tour card: Lumi perches on the card's top edge ({c['gx']},{c['gy']} on {c['paper']})")
    check(be["slip"] and be["perch"] == 0 and not near(be, a), f"tour bellflower: another flower, its slip up, Lumi beside it ({be})")
    check(bu["slip"] and bu["perch"] == 0 and not near(bu, a) and not near(bu, be), f"tour bud: a third flower, its slip up ({bu})")
    check(hi["tour"] and not hi["slip"] and hi["gx"] == -999, f"tour hint: no slip and no flower named, so Lumi says its note ({hi})")
    check(fr["live"] and not fr["tour"] and not fr["slip"] and fr["gx"] == -999, f"tour free explore: the scene is live, nothing of the tour is left ({fr})")
    # Scrubbed: going back gives the same frame, and a jump straight in gives it too.
    goto_beat(page, "explore", 0.31, 400)
    back = page.evaluate(TOUR)
    check(back["paper"] == c["paper"] and near(back, c) and back["perch"] == c["perch"], f"tour: scrolling back to the card gives the same card and perch ({back})")
    for beat, bp in (("pass2", 0.9), ("ranked", 0.1)):
        goto_beat(page, beat, bp, 400)
        t = page.evaluate(TOUR)
        check(not t["slip"] and t["gx"] == -999, f"tour: nothing of it outside the beat ({beat}@{bp}: {t})")


def check_list(page):
    print("[list] the list drives the scene and the card")
    goto_beat(page, "explore", 0.5, 500)
    page.mouse.move(8, 8)
    toggle = page.query_selector("[data-explore-stage] button[aria-expanded]")
    check(toggle is not None, "list: the stage has the list's button")
    if not toggle:
        return
    b = toggle.bounding_box()
    boxes = page.evaluate("""() => { const r = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
        return { cap: r('[data-stage=read] .story-caption'), nav: r('.nav-pill'), cue: r('.ex-cue'), line: r('.ex-line') }; }""")
    t = [b["x"], b["y"], b["x"] + b["width"], b["y"] + b["height"]]
    hit = lambda a, c: a[0] < c[2] and c[0] < a[2] and a[1] < c[3] and c[1] < a[3]
    over = [k for k, v in boxes.items() if hit(t, v)]
    check(not over, f"list: its button stands clear of the nav, the line, the cue and the caption: {over}")
    toggle.focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    check(toggle.get_attribute("aria-expanded") == "true", "list: Enter opens it")
    row = page.query_selector("[data-explore-stage] button[data-id]")
    check(row is not None and row.is_visible(), "list: its rows are on screen")
    if row:
        rid = row.get_attribute("data-id")
        row.focus()
        page.keyboard.press("Enter")
        try:
            page.wait_for_function(CARD_OPEN, timeout=6000)
            opened = True
        except Exception:
            opened = False
        check(opened, "list: picking a row opens that role's card")
        page.wait_for_timeout(600)
        cur = page.evaluate("() => (document.querySelector('[data-explore-stage] button[data-id][aria-current]') || { dataset: {} }).dataset.id")
        check(cur == rid, f"list: the picked row is the current one ({cur} vs {rid})")
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)
        gone = not page.evaluate(CARD_OPEN)
        if not gone:  # the list may take the first Esc for itself
            page.keyboard.press("Escape")
            page.wait_for_timeout(700)
            gone = not page.evaluate(CARD_OPEN)
        check(gone, "list: Esc closes the card")
    if toggle.get_attribute("aria-expanded") == "true":
        toggle.click()
        page.wait_for_timeout(400)
    # Outside the stop the button is not in the tab order.
    goto_beat(page, "ranked", 0.6, 300)
    check(not toggle.is_visible(), "list: outside the stop its button is hidden (and out of the tab order)")


def run_frames(page, name, mobile, shots):
    """10fps through both hand-offs, down then up. The page is stepped to whole pixels: a screenshot
    taken at a fractional scroll position (Lenis mid-glide) comes out a pixel off, which reads as a
    change of the whole frame. The real wheel, through Lenis, is what [traps] drives."""
    vh = page.evaluate("() => innerHeight")
    legs = [("in", ("explore", 0.0), ("explore", 0.2)), ("out", ("explore", 0.8), ("ranked", 0.06))]
    for leg, a, b in legs:
        y_a = goto_beat(page, *a, 200)["y"]
        y_b = goto_beat(page, *b, 200)["y"]
        N = 26
        step = (y_b - y_a) / N
        for direction in ("down", "up"):
            start, sgn = (a, 1) if direction == "down" else (b, -1)
            goto_beat(page, *start, 700)
            if not mobile:
                page.mouse.move(40, vh * 0.6)
            shots_, labels, vals = [], [], []
            y_from = y_a if direction == "down" else y_b
            for k in range(N + 5):
                if k < N:
                    page.evaluate("(y) => window.scrollTo({ top: y, behavior: 'instant' })", round(y_from + sgn * step * (k + 1)))
                page.wait_for_timeout(100)
                st = page.evaluate(STAGE)
                shots_.append(page.screenshot())
                vals.append(st)
                labels.append(f"{st['beat'][:4]} {st['p']:.3f} s{st['scene']:.2f} c{st['pass']:.2f} u{st['ui']:.2f}")
            tag = f"{name} {leg} {direction}"
            # The fades run one way only.
            rising = (leg == "in") == (direction == "down")
            for key in ("scene", "ui"):
                seq = [v[key] for v in vals]
                mono = all((y - x) * (1 if rising else -1) >= -0.002 for x, y in zip(seq, seq[1:]))
                check(mono, f"frames {tag}: {key} runs one way ({[round(v, 2) for v in seq]})")
                check(min(seq) < 0.02 and max(seq) > 0.98, f"frames {tag}: {key} runs the whole way ({min(seq):.2f}..{max(seq):.2f})")
            seq = [v["pass"] for v in vals]
            check(all((y - x) * (-1 if rising else 1) >= -0.002 for x, y in zip(seq, seq[1:])), f"frames {tag}: the counter runs one way ({[round(v, 2) for v in seq]})")
            # The two sets of copy are never up together.
            both = [(v["pass"], v["ui"]) for v in vals if v["pass"] > 0.02 and v["ui"] > 0.02]
            check(not both, f"frames {tag}: the counter and the stage's copy are never on screen together {both[:3]}")
            # No frame is an outlier between its neighbours, and no two frames are a jump apart.
            # (Inside `ranked` the list's paper is laid down within 0.04 of the beat, flag or no flag:
            # those frames are on the sheet, and [parity] and [flight] answer for them.)
            g = [gray(s) for s in shots_]
            mine = [v["beat"] != "ranked" for v in vals]
            d1 = [diff(g[i], g[i - 1]) if mine[i] and mine[i - 1] else 0.0 for i in range(1, len(g))]
            odd = []
            for i in range(1, len(g) - 1):
                if not (mine[i - 1] and mine[i] and mine[i + 1]):
                    continue
                there, across = d1[i - 1], diff(g[i - 1], g[i + 1])
                if there > 1.0 and across < 0.5 * there:
                    odd.append(f"frame {i} (there {there:.2f}, across {across:.2f})")
            check(not odd, f"frames {tag}: no frame is an outlier between its neighbours: {odd}")
            check(max(d1) < 6, f"frames {tag}: no jump between two frames (largest step {max(d1):.2f} at frame {d1.index(max(d1)) + 1})")
            note(f"{tag}: {len(g)} frames, largest step {max(d1):.2f}, mean {sum(d1) / len(d1):.2f}")
            if shots:
                sheet(shots_, labels, shots / f"contact-{name}-{leg}-{direction}.png", cols=8 if not mobile else 11, width=240 if not mobile else 150)


def check_flight(page, shared, shots):
    print("[flight] the twelve still land after the stop")
    # Carried there by the wheel, through the stop's way out.
    goto_beat(page, "explore", 0.8, 400)
    page.mouse.move(700, 300)
    for _ in range(60):
        s = page.evaluate("() => { const s = window.__story.get(); return [s.beat, s.beatProgress]; }")
        if s[0] == "ranked" and s[1] > 0.97 or s[0] not in ("explore", "ranked"):
            break
        page.mouse.wheel(0, 90)
        page.wait_for_timeout(70)
    lit = {}
    for at in (0.3, 0.45, 0.9):
        goto_beat(page, "ranked", at, 500)
        st = page.evaluate(STAGE)
        lit[at] = st["lit"]
        check(st["lift"], f"flight ranked@{at}: the canvas is lifted over the list")
    off = shared.get("off_lit")
    check(lit[0.9] == 12, f"flight: all twelve rows are lit by ranked@0.9 ({lit[0.9]})")
    if off:
        check(lit == off, f"flight: rows light as without the flag ({lit} vs {off})")
    s = goto_beat(page, "ranked", 0.9, 300)
    check(s["actor"]["present"], "flight: the Actor is born as row 1 after the landings")
    page.mouse.move(8, 8)
    goto_beat(page, "ranked", 0.33, 700)
    shot = page.screenshot()
    if shots:
        Path(shots / "still-1440-flight-ranked-033.png").write_bytes(shot)
    if shared.get("off_flight"):
        a, b = shared["off_flight"]
        floor = diff(a, b)
        d = diff(gray(shot, 720), a)
        check(d <= max(0.6, 3 * floor), f"flight: mid-flight the frame matches the flag-off frame (diff {d:.3f}, two flag-off frames differ by {floor:.3f})")
        note(f"mid-flight frame vs flag-off: {d:.3f} (noise floor {floor:.3f})")
    # And back up: the rows go dark again and the stop returns.
    goto_beat(page, "explore", FREE, 400)
    st = page.evaluate(STAGE)
    check(st["lit"] == 0 and st["live"] and not st["lift"], f"flight: back in the stop no row is lit and the canvas is down ({st['lit']}, lift {st['lift']})")


def check_phone(browser, url, shots):
    print("[phone] 390x844, touch")
    ctx, page, errors = open_page(browser, with_flag(url), **PHONE)
    wait_ready(page)
    down, up = sweep_beats(page)
    check(down == WITH and up == list(reversed(WITH)), f"phone: beats in order both ways: {down}")
    check(page.evaluate("() => document.documentElement.scrollWidth <= innerWidth"), "phone: nothing scrolls sideways")
    goto_beat(page, "explore", FREE, 600)
    s = page.evaluate(STAGE)
    check(s["live"] and s["scene"] == 1 and s["ui"] == 1, f"phone: the hold is up, in free explore ({s})")
    boxes = page.evaluate("""() => { const r = (q) => { const el = document.querySelector(q); if (!el) return null; const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
        return { line: r('.ex-line'), cue: r('.ex-cue'), cap: r('[data-stage=read] .story-caption'), list: r('[data-explore-stage] button[aria-expanded]'), nav: r('.nav-pill'), vw: innerWidth, vh: innerHeight }; }""")
    hit = lambda a, b: a and b and a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]
    names = ["line", "cue", "cap", "list", "nav"]
    over = [(m, n) for i, m in enumerate(names) for n in names[i + 1:] if hit(boxes[m], boxes[n])]
    check(not over, f"phone: the line, cue, caption, list button and nav do not overlap: {over}")
    check(all(boxes[k] and boxes[k][0] >= 0 and boxes[k][2] <= boxes["vw"] + 0.5 for k in ("line", "cue", "list")), f"phone: the stage's copy is inside the screen: {boxes}")
    if shots:
        page.screenshot(path=str(shots / "still-390-hold.png"))
    # A touch drag over the scene scrolls the page.
    cdp = ctx.new_cdp_session(page)

    def drag(x, y, dist, steps=12):
        """A finger drag upwards by `dist` px (real touch events); returns how far the page scrolled."""
        y0 = page.evaluate("() => window.scrollY")
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        for i in range(1, steps + 1):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y - dist * i / steps}]})
            page.wait_for_timeout(16)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(900)
        return page.evaluate("() => window.scrollY") - y0

    moved = drag(195, 520, 300)
    check(moved > 240, f"phone: a touch drag over the scene scrolls the page ({moved}px for a 300px drag)")
    # A tap opens the card as a bottom sheet.
    goto_beat(page, "explore", FREE, 600)
    card, how = open_card(page, touch=True)
    check(card is not None, f"phone: a tap opens the card (through the {how})")
    if card:
        check(abs(card["y"] + card["h"] - card["vh"]) <= 1.5 and card["w"] >= card["vw"] - 1 and card["x"] <= 0.5, f"phone: the card is a bottom sheet ({card})")
        check(card["h"] < card["vh"] * 0.8, f"phone: the sheet leaves the scene in view ({card['h']:.0f} of {card['vh']})")
        # The chosen flower is framed above the sheet, where the line was: the line has stepped aside.
        rolled = page.evaluate(LINE_ROLLED)
        check(rolled, "phone: with the sheet open the stage's line is out of the flower's way")
        if shots:
            page.screenshot(path=str(shots / "still-390-sheet.png"))
        st = page.evaluate(STAGE)
        check(not st["prevent"], f"phone: nothing on screen carries data-lenis-prevent with the sheet open: {st['prevent']}")
        moved = drag(195, 300, 200)
        check(moved > 160, f"phone: with the sheet open a drag over the scene still scrolls the page ({moved}px for a 200px drag)")
        goto_beat(page, "explore", FREE, 600)
        card, how = open_card(page, touch=True)
        if card:
            moved = drag(card["x"] + card["w"] / 2, card["y"] + card["h"] * 0.6, 150)
            check(moved > 120, f"phone: a drag that starts on the sheet scrolls the page too ({moved}px for a 150px drag)")
    # Closing the sheet brings the line back.
    if card:
        goto_beat(page, "explore", FREE, 400)
        if not page.evaluate(CARD_OPEN):
            open_card(page, touch=True)
        close = page.query_selector("[role=dialog] .ffc-x")
        if close:
            close.tap()
        else:
            page.keyboard.press("Escape")
        page.wait_for_timeout(900)
        check(not page.evaluate(CARD_OPEN) and not page.evaluate(LINE_ROLLED), "phone: with the sheet closed the line is back")
    # The flight on phones: six rows and the "6 more" pill.
    goto_beat(page, "ranked", 0.9, 500)
    st = page.evaluate(STAGE)
    check(st["lit"] == 12 and st["more"], f"phone: the rows and the pill are lit after the stop ({st['lit']}, more {st['more']})")
    run_frames(page, "390", True, shots)
    check(not errors, f"phone: no console errors: {errors[:3]}")
    ctx.close()


def check_reduced(browser, url, shots):
    print("[reduced] a still block; no story, no camera")
    ctx, page, errors = open_page(browser, with_flag(url), reduced_motion="reduce", **DESKTOP)
    page.wait_for_selector("[data-explore-stage]", state="attached", timeout=15000)
    page.wait_for_selector("[data-explore-stage][data-ready]", state="attached", timeout=30000)
    info = page.evaluate("""() => { const ex = document.querySelector('[data-explore-stage]'); const top = (q) => document.querySelector(q).getBoundingClientRect().top + scrollY;
        const c = getComputedStyle(ex); const r = ex.getBoundingClientRect();
        return { running: window.__story.isRunning(), pos: c.position, vis: c.visibility, h: r.height, w: r.width, vw: innerWidth,
          order: [top('.rd-figures'), r.top + scrollY, top('.rd-ranked')], sticky: getComputedStyle(ex.closest('.story-stage')).position,
          cue: getComputedStyle(ex.querySelector('.ex-cue')).display, scene: getComputedStyle(ex.querySelector('.ex-scene')).opacity,
          line: getComputedStyle(ex.querySelector('.ex-line')).visibility, active: ex.hasAttribute('data-active'),
          stub: !!ex.querySelector('[data-ff-stub]'), still: !!ex.querySelector('[data-ff-stub][data-still]') }; }""")
    check(not info["running"], "reduced: the story is not running")
    check(info["pos"] == "relative" and info["vis"] == "visible" and info["sticky"] != "sticky" and 300 < info["h"] < 760, f"reduced: the stop is a plain block ({info['pos']}, {info['h']:.0f}px)")
    check(info["order"] == sorted(info["order"]) and len(set(info["order"])) == 3, f"reduced: it sits between the figures and the list ({info['order']})")
    check(info["cue"] == "none" and info["scene"] == "1" and info["line"] == "visible", f"reduced: line shown, scene shown, no scroll cue ({info['cue']}, {info['scene']})")
    check(not info["active"], "reduced: the scene is not active while the block is off screen")
    if info["stub"]:
        check(info["still"], "reduced: the scene is given reducedMotion (the stub holds still)")
    page.evaluate("() => document.querySelector('[data-explore-stage]').scrollIntoView({ block: 'center' })")
    page.wait_for_timeout(500)
    check(page.evaluate("() => document.querySelector('[data-explore-stage]').hasAttribute('data-active')"), "reduced: the scene is active once the block is on screen")
    if shots:
        page.screenshot(path=str(shots / "still-1440-reduced.png"))
    card, how = open_card(page)
    check(card is not None, f"reduced: a firefly opens its card (through the {how})")
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    check(not page.evaluate("() => document.querySelector('[data-explore-stage]').hasAttribute('data-active')"), "reduced: and not active again once it has left")
    check(not page.evaluate(CARD_OPEN), "reduced: its card closes when the block leaves")
    check(not errors, f"reduced: no console errors: {errors[:3]}")
    ctx.close()


MUT = """(ignore) => { const frames = []; let cur = new Set();
  const mo = new MutationObserver((list) => { for (const m of list) if (m.type === 'attributes' && !(ignore && m.target.closest && m.target.closest(ignore))) cur.add(m.target); });
  mo.observe(document.documentElement, { attributes: true, subtree: true });
  let on = true; const tick = () => { frames.push(cur.size); cur = new Set(); if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__mut = () => { on = false; mo.disconnect(); const f = frames.filter((n, i) => i > 0); const busy = f.filter((n) => n > 0);
    return { frames: f.length, max: Math.max(0, ...f), mean: busy.length ? busy.reduce((a, b) => a + b, 0) / busy.length : 0, busy: busy.length }; }; }"""


def measure(page, a, b, notches=14, ignore=None):
    y_a = goto_beat(page, *a, 600)["y"]
    y_b = goto_beat(page, *b, 100)["y"]
    goto_beat(page, *a, 900)
    page.mouse.move(60, 500)
    page.evaluate(MUT, ignore)
    step = (y_b - y_a) / notches
    for _ in range(notches):
        page.mouse.wheel(0, step)
        page.wait_for_timeout(90)
    page.wait_for_timeout(700)
    return page.evaluate("() => window.__mut()")


def check_cost(browser, url, page):
    print("[cost] elements restyled per frame (attribute writes, MutationObserver)")
    ctx, off, _ = open_page(browser, url, **DESKTOP)
    base = measure(off, ("pass2", 0.7), ("pass2", 0.98))
    base2 = measure(off, ("ranked", 0.0), ("ranked", 0.3))
    ctx.close()
    hin = measure(page, ("explore", 0.005), ("explore", 0.19))
    hold = measure(page, ("explore", 0.3), ("explore", 0.6))
    hout = measure(page, ("explore", 0.81), ("explore", 0.99))
    # Lumi lives in the garden now (hovering, bobbing, its note): its own elements move at rest by design
    # (components/lumi). Nothing of the stop's own is written at rest: in the tour (0.5) and in free explore.
    lumi = ".lumi, .lumi-pool, .lumi-note"
    still = measure(page, ("explore", 0.5), ("explore", 0.5), ignore=lumi)
    still_free = measure(page, ("explore", FREE), ("explore", FREE), ignore=lumi)
    fmt = lambda m: f"max {m['max']}, mean {m['mean']:.1f} over {m['busy']} of {m['frames']} frames"
    note(f"flag off, pass2 0.70-0.98:   {fmt(base)}")
    note(f"flag off, ranked 0.00-0.30:  {fmt(base2)}")
    note(f"explore hand-off in:         {fmt(hin)}")
    note(f"explore hold 0.30-0.60:      {fmt(hold)}")
    note(f"explore hand-off out:        {fmt(hout)}")
    note(f"explore hold, wheel still:   {fmt(still)} (tour), {fmt(still_free)} (free), Lumi's own elements not counted")
    check(hold["max"] <= max(base["max"], 6), f"cost: the hold restyles no more per frame than a pass does ({hold['max']} vs {base['max']})")
    check(hin["max"] <= base["max"] + 8 and hout["max"] <= base["max"] + 8, f"cost: the hand-offs stay near a pass's count ({hin['max']}, {hout['max']} vs {base['max']})")
    check(still["max"] <= 1 and still_free["max"] <= 1, f"cost: nothing of the stop is written at rest in the hold, tour or free explore ({still['max']}, {still_free['max']} per frame at most)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url", nargs="?", default="http://localhost:3112")
    ap.add_argument("--shots", type=Path, default=None, help="directory for contact sheets and stills")
    ap.add_argument("--only", default="", help="comma-separated sections")
    ap.add_argument("--scene-dpr", type=float, default=0.3, help="pixel ratio asked of the 3D scene (1 = as shipped)")
    args = ap.parse_args()
    global SCENE_DPR
    SCENE_DPR = args.scene_dpr
    url = args.url.rstrip("/")
    only = [s for s in args.only.split(",") if s]
    want = lambda name: not only or name in only
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    shared = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=CHROMIUM_ARGS)
        if want("off") or want("parity") or want("flight") or want("beats"):
            check_off(browser, url, shared)
        desktop = [n for n in ("beats", "parity", "handoff", "tour", "list", "traps", "frames", "flight", "cost") if want(n)]
        if desktop:
            ctx, page, errors = open_page(browser, with_flag(url), **DESKTOP)
            wait_ready(page)
            if want("beats"):
                check_beats(page, shared)
            if want("parity"):
                check_parity(page, shared)
            if want("handoff"):
                check_handoff(page)
                if args.shots:
                    for at in (0.0, 0.05, 0.115, 0.145, 0.5, 0.87, 1.0):
                        goto_beat(page, "explore", at, 500)
                        page.screenshot(path=str(args.shots / f"still-1440-explore-{round(at * 1000):04d}.png"))
            if want("tour"):
                check_tour(page, args.shots)
            if want("list"):
                check_list(page)
            if want("traps"):
                check_traps(page, args.shots)
            if want("frames"):
                print("[frames] 10fps through both hand-offs, 1440x900")
                run_frames(page, "1440", False, args.shots)
            if want("flight"):
                check_flight(page, shared, args.shots)
            if want("cost"):
                check_cost(browser, url, page)
            check(not errors, f"desktop: no console errors: {errors[:3]}")
            ctx.close()
        if want("phone"):
            check_phone(browser, url, args.shots)
        if want("reduced"):
            check_reduced(browser, url, args.shots)
        browser.close()

    print(f"\n{passes} checks passed, {len(failures)} failed")
    if failures:
        for f in failures:
            print(f"  FAIL  {f}")
        print("explore check: FAIL")
        sys.exit(1)
    print("explore check: OK")


if __name__ == "__main__":
    main()
