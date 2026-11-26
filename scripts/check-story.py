#!/usr/bin/env python3
"""
End-to-end check of the scroll story ("One role, read.").

Run against a production build:

    pkill -f next-server; NEXT_TELEMETRY_DISABLED=1 npx next build && (npx next start -p 3100 &)
    python3 scripts/check-story.py                      # http://localhost:3100
    python3 scripts/check-story.py http://localhost:3100 --shots /tmp/story-shots

What it asserts
  1. beats     scrolling the whole page visits every beat id in BEATS order, and in reverse on the way up
  2. wipes     mid-wipe, both stages are pinned and visible, split exactly at --day-top, day below the line
  3. actor     no Actor before `ranked`; from `ranked` to `seat` the Role is on screen exactly once
               (the flying Actor, or the real DOM face it docked on), and is cut into two skins mid-daybreak
  4. fast      a top-to-seat jump leaves every passed beat's performance in its end state, the Actor docked
               on the ticket and the form reachable; jumping back to the top resets every performance
  5. reduced   with prefers-reduced-motion the page is static and stacked: no sticky, no clip, no Actor,
               every panel visible in order, the waitlist form present
  6. mobile    at 390x844 with touch the beats still run in order and nothing scrolls sideways
  7. native    with Lenis off (?lenis=0) beats, wipes and docking behave the same

It uses only public hooks: window.__story (the store), [data-*] attributes and computed styles.
Later packages can extend it: add checks to the functions below or import `open_page`, `goto_beat`.
Exit code 0 = all passed.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

BEATS = [
    "hero", "pass1", "pass2", "ranked", "reason", "daybreak",
    "saved", "applied", "interview", "hinge", "nightfall",
    "unfold", "q1", "q2", "q3", "votes", "dawn", "seat", "footer",
]
WIPES = {  # wipe: (stage above the line, stage below the line)
    "daybreak": ("read", "board"),
    "nightfall": ("prep", "board"),
    "dawn": ("prep", "seat"),
}
ACTOR_BEATS = BEATS[BEATS.index("ranked"): BEATS.index("seat") + 1]

FRAMES = """(n) => new Promise((done) => { let i = 0; const f = () => (++i >= n ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); })"""

failures = []
passes = 0


def check(ok, message):
    global passes
    if ok:
        passes += 1
    else:
        failures.append(message)
        print(f"  FAIL  {message}")


def frames(page, n=4):
    page.evaluate(FRAMES, n)


def state(page):
    return page.evaluate(
        """() => { const s = window.__story.get(); return {
            beat: s.beat, p: s.beatProgress, act: s.act, pos: s.pos, chapter: s.chapter, dayTop: s.dayTop,
            line: { ...s.line }, actor: { ...s.actor }, vh: s.viewport.h, vw: s.viewport.w, flags: { ...s.flags } }; }"""
    )


def goto_beat(page, beat, at=0.5, settle_ms=0):
    """Jump (no smooth scroll) to a point inside a beat and wait for the store to catch up."""
    page.evaluate("([b, a]) => window.__story.scrollToBeat(b, a, { immediate: true })", [beat, at])
    frames(page, 4)
    if settle_ms:
        page.wait_for_timeout(settle_ms)
        frames(page, 2)
    return state(page)


def open_page(browser, url, **context_args):
    context = browser.new_context(**context_args)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 and "favicon" not in r.url and "/_vercel/" not in r.url else None)
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("() => window.__story !== undefined")
    frames(page, 6)
    return context, page, errors


def actor_dom(page):
    return page.evaluate(
        """() => {
          const vh = innerHeight, vw = innerWidth;
          const onScreen = (r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
          const a = document.querySelector('.actor');
          const cs = a ? getComputedStyle(a) : null;
          const flying = !!a && cs.visibility === 'visible' && parseFloat(cs.opacity) > 0.05 && onScreen(a.getBoundingClientRect());
          const docked = [...document.querySelectorAll('[data-docked]')].filter((el) => {
            const c = getComputedStyle(el);
            return c.visibility === 'visible' && parseFloat(c.opacity) > 0.99 && onScreen(el.getBoundingClientRect());
          }).map((el) => el.getAttribute('data-anchor'));
          const skins = a ? [...a.querySelectorAll('.actor-face')].filter((f) => getComputedStyle(f).display !== 'none')
            .flatMap((f) => [...f.querySelectorAll(':scope > .actor-skin')].filter((k) => getComputedStyle(k).display !== 'none')
              .map((k) => ({ skin: k.dataset.skin, clip: getComputedStyle(k).clipPath }))) : [];
          return { flying, docked, skins };
        }"""
    )


def check_beats(page, label):
    print(f"[beats] {label}")
    max_y = page.evaluate("() => document.documentElement.scrollHeight - innerHeight")
    step = max(60, page.evaluate("() => innerHeight") // 6)

    def sweep(ys):
        seen = []
        for y in ys:
            page.evaluate("(y) => window.scrollTo({ top: y, behavior: 'instant' })", y)
            frames(page, 3)
            b = state(page)["beat"]
            if not seen or seen[-1] != b:
                seen.append(b)
        return seen

    down = sweep(list(range(0, max_y, step)) + [max_y])
    check(down == BEATS, f"{label}: beats going down should be {BEATS}, got {down}")
    up = sweep(list(range(max_y, 0, -step)) + [0])
    check(up == BEATS[::-1], f"{label}: beats going up should be the reverse order, got {up}")
    s = state(page)
    check(s["beat"] == "hero" and s["p"] < 0.01, f"{label}: back at the top the beat is hero at 0, got {s['beat']} {s['p']:.3f}")
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(overflow <= 1, f"{label}: no horizontal scroll (overflow {overflow}px)")


def check_wipes(page, shots):
    print("[wipes]")
    for wipe, (above, below) in WIPES.items():
        s = goto_beat(page, wipe, 0.6)
        check(s["beat"] == wipe, f"{wipe}: store should be on the wipe beat, got {s['beat']}")
        check(0 < s["dayTop"] < s["vh"], f"{wipe}: the line should be mid-screen (dayTop {s['dayTop']:.0f} of {s['vh']})")
        check(s["line"]["daySide"] == "below", f"{wipe}: day is below the line, got {s['line']['daySide']}")
        check(abs(s["line"]["y"] - s["dayTop"]) < 0.6, f"{wipe}: the split is at the line (line {s['line']['y']:.1f}, split {s['dayTop']:.1f})")
        info = page.evaluate(
            """() => {
              const d = document.documentElement;
              const stages = [...document.querySelectorAll('.story-stage')].map((el) => {
                const c = getComputedStyle(el), r = el.getBoundingClientRect();
                return { act: el.dataset.stage, visible: c.visibility === 'visible', top: r.top, height: r.height, clip: c.clipPath, sticky: c.position };
              });
              const at = (y) => document.elementFromPoint(innerWidth / 2, y)?.closest('.story-stage')?.dataset.stage ?? null;
              // The live line variables are written on line scopes (.story-vars), not on <html>.
              // The world's wrapper takes all three; the nav pills and rail copies take --day-top only.
              const scopes = [...document.querySelectorAll('.story-root > .story-vars:first-child, .nav-pill, .rail-copy')].map((el) => getComputedStyle(el));
              const v = getComputedStyle(document.querySelector('.story-root > .story-vars:first-child'));
              const split = parseFloat(v.getPropertyValue('--day-top'));
              const agree = scopes.every((c) => c.getPropertyValue('--day-top') === v.getPropertyValue('--day-top'));
              return { stages, wipe: d.dataset.wipe, split, lineY: parseFloat(v.getPropertyValue('--line-y')), scopes: scopes.length, agree,
                       htmlInline: d.style.getPropertyValue('--day-top') + d.style.getPropertyValue('--line-y'),
                       side: v.getPropertyValue('--day-side').trim(), above: at(split - 4), below: at(split + 4) };
            }"""
        )
        vis = sorted(st["act"] for st in info["stages"] if st["visible"])
        check(vis == sorted([above, below]), f"{wipe}: exactly the two stages {above}+{below} are visible, got {vis}")
        for st in info["stages"]:
            if st["act"] in (above, below):
                check(abs(st["top"]) < 1 and st["sticky"] == "sticky", f"{wipe}: stage {st['act']} is pinned at the top (top {st['top']:.1f}, {st['sticky']})")
                check(st["clip"].startswith("inset("), f"{wipe}: stage {st['act']} is clipped at the line, clip-path is {st['clip']}")
        check(info["wipe"] == wipe, f"{wipe}: html[data-wipe] should be {wipe}, got {info['wipe']}")
        check(info["scopes"] >= 3 and info["agree"], f"{wipe}: every line scope carries the same line variables ({info['scopes']} scopes)")
        check(info["htmlInline"] == "", f"{wipe}: no per-frame line variable is written on <html> ({info['htmlInline']!r})")
        check(info["side"] == "below", f"{wipe}: --day-side should be below, got {info['side']!r}")
        check(abs(info["split"] - s["dayTop"]) < 0.6 and abs(info["lineY"] - s["line"]["y"]) < 0.6, f"{wipe}: CSS variables match the store")
        check(info["above"] == above, f"{wipe}: just above the line is the {above} stage, got {info['above']}")
        check(info["below"] == below, f"{wipe}: just below the line is the {below} stage, got {info['below']}")
        if shots:
            page.screenshot(path=str(shots / f"wipe-{wipe}.png"))
        # Before the sweep the screen is still entirely the outgoing chapter.
        s0 = goto_beat(page, wipe, 0.02)
        check(s0["line"]["daySide"] == "none", f"{wipe}: no split before the sweep starts, got {s0['line']['daySide']}")
    # Outside wipes exactly one stage is visible and nothing is clipped.
    for beat in ("pass1", "applied", "q2", "seat"):
        goto_beat(page, beat, 0.5)
        info = page.evaluate(
            """() => [...document.querySelectorAll('.story-stage')].filter((el) => getComputedStyle(el).visibility === 'visible')
                 .map((el) => ({ act: el.dataset.stage, clip: getComputedStyle(el).clipPath }))"""
        )
        check(len(info) == 1 and info[0]["clip"] == "none", f"{beat}: one unclipped stage outside wipes, got {info}")


def check_actor(page, shots):
    print("[actor]")
    for beat in ("hero", "pass1", "pass2"):
        s = goto_beat(page, beat, 0.5)
        dom = actor_dom(page)
        check(not s["actor"]["present"] and not dom["flying"] and not dom["docked"], f"{beat}: the Actor is not born yet, got {dom}")
    for beat in ACTOR_BEATS:
        for at in (0.5, 0.97) if beat == "ranked" else (0.03, 0.5, 0.97):
            s = goto_beat(page, beat, at, settle_ms=1700 if beat in ("applied", "interview", "unfold", "dawn") else 0)
            dom = actor_dom(page)
            count = (1 if dom["flying"] else 0) + len(dom["docked"])
            check(s["actor"]["present"], f"{beat}@{at}: store says the Actor is present")
            check(count == 1, f"{beat}@{at}: the Role is on screen exactly once (flying={dom['flying']}, docked={dom['docked']})")
            check(s["actor"]["docked"] == (len(dom["docked"]) == 1), f"{beat}@{at}: docked flag matches the DOM")
    # Docking: interactive rests hand over to the real DOM.
    s = goto_beat(page, "q2", 0.5)
    check(actor_dom(page)["docked"] == ["sheet"], f"q2: the real sheet has taken over, got {actor_dom(page)['docked']}")
    s = goto_beat(page, "seat", 0.6)
    check(actor_dom(page)["docked"] == ["ticket"], f"seat: the real ticket has taken over, got {actor_dom(page)['docked']}")
    # The split: mid-daybreak the Actor shows both skins, clipped at the same line.
    s = goto_beat(page, "daybreak", 0.2 + 0.8 * 0.5)
    for at in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8):
        s = goto_beat(page, "daybreak", at)
        if s["actor"]["y"] + 8 < s["dayTop"] < s["actor"]["y"] + s["actor"]["h"] - 8:
            break
    cut = s["actor"]["y"] < s["dayTop"] < s["actor"]["y"] + s["actor"]["h"]
    check(cut, f"daybreak: the line crosses the Actor at some point (actor y {s['actor']['y']:.0f}+{s['actor']['h']:.0f}, line {s['dayTop']:.0f})")
    dom = actor_dom(page)
    skins = sorted(k["skin"] for k in dom["skins"])
    check(skins == ["day", "night"], f"daybreak: both skins are rendered while split, got {dom['skins']}")
    check(all(k["clip"].startswith("inset(") for k in dom["skins"]), f"daybreak: both skins are clipped, got {dom['skins']}")
    if cut and len(dom["skins"]) == 2:
        edges = page.evaluate(
            """() => { const a = document.querySelector('.actor').getBoundingClientRect();
                 const px = (el) => getComputedStyle(el).clipPath.match(/-?[\\d.]+px/g).map(parseFloat);
                 const n = px(document.querySelector('.actor-face:not([style*="display: none"]) .actor-skin[data-skin=night]'));
                 const d = px(document.querySelector('.actor-face:not([style*="display: none"]) .actor-skin[data-skin=day]'));
                 return { nightBottom: a.bottom - n[2], dayTop: a.top + d[0] }; }"""
        )
        check(abs(edges["nightBottom"] - s["dayTop"]) < 1 and abs(edges["dayTop"] - s["dayTop"]) < 1,
              f"daybreak: skins meet at the line within 1px (night ends {edges['nightBottom']:.2f}, day starts {edges['dayTop']:.2f}, line {s['dayTop']:.2f})")
    if shots:
        page.screenshot(path=str(shots / "actor-split.png"))
    # Outside wipes one skin only.
    goto_beat(page, "reason", 0.8)
    check([k["skin"] for k in actor_dom(page)["skins"]] == ["night"], "reason: night skin only")
    goto_beat(page, "hinge", 0.8)
    check([k["skin"] for k in actor_dom(page)["skins"]] == ["day"], "hinge: day skin only")
    # Travel is exact: at rest the Actor sits on its anchor.
    s = goto_beat(page, "reason", 0.9)
    r = page.evaluate("() => { const r = document.querySelector('[data-anchor=card]').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
    a = s["actor"]
    check(max(abs(a["x"] - r[0]), abs(a["y"] - r[1]), abs(a["w"] - r[2]), abs(a["h"] - r[3])) < 1, f"reason: the Actor rests exactly on the card anchor ({a} vs {r})")


def lights(page):
    return page.evaluate("() => Object.fromEntries([...document.querySelectorAll('[data-perf-light]')].map((el) => [el.dataset.perfLight, parseFloat(getComputedStyle(el).opacity)]))")


def check_fast(page, shots):
    print("[fast scroll]")
    goto_beat(page, "hero", 0)
    page.wait_for_timeout(1000)
    if not lights(page):
        print("  (no stub performance lights on this page: skipping the performance assertions)")
    # One jump from the top to the seat, as a fling would end.
    s = goto_beat(page, "seat", 0.6, settle_ms=300)
    check(s["beat"] == "seat", f"fast: lands on seat, got {s['beat']}")
    lit = lights(page)
    passed = BEATS[: BEATS.index("seat")]
    not_done = [b for b in passed if b in lit and lit[b] < 0.99]
    check(not not_done, f"fast: every passed performance is in its end state, unfinished: {not_done}")
    check(lit.get("footer", 0.15) < 0.2, "fast: the beat that was not reached has not played")
    dom = actor_dom(page)
    check(dom["docked"] == ["ticket"] and not dom["flying"], f"fast: the Actor is docked on the ticket, got {dom}")
    check(s["actor"]["face"] == "ticket", f"fast: the Actor wears the ticket face, got {s['actor']['face']}")
    check(s["chapter"] == "day" and s["line"]["daySide"] == "none", "fast: seat is fully day")
    form = page.evaluate(
        """() => { const i = document.querySelector('#join input[type=email]'); if (!i) return null;
             const r = i.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
             return { visible: r.top >= 0 && r.bottom <= innerHeight, hit: hit === i }; }"""
    )
    check(bool(form) and form["visible"] and form["hit"], f"fast: the real waitlist input is on screen and under the pointer, got {form}")
    if shots:
        page.screenshot(path=str(shots / "seat.png"))
    # Lenis-driven fling (when Lenis is on): same end state.
    goto_beat(page, "hero", 0)
    page.evaluate("() => window.__story.scrollToBeat('seat', 0.6, { duration: 0.9 })")
    page.wait_for_timeout(1800)
    frames(page, 4)
    s = state(page)
    lit = lights(page)
    check(s["beat"] == "seat", f"fling: lands on seat, got {s['beat']}")
    check(not [b for b in passed if b in lit and lit[b] < 0.99], "fling: every passed performance is in its end state")
    check(actor_dom(page)["docked"] == ["ticket"], "fling: the Actor is docked on the ticket")
    # And back: everything after the first beat is reset, entering backward showed end states on the way.
    s = goto_beat(page, "q2", 0.5, settle_ms=100)
    lit = lights(page)
    check(lit.get("q2", 1) > 0.99, f"reverse: entering a beat backward shows its end state at once, q2 is {lit.get('q2')}")
    check(lit.get("q3", 0) < 0.2 and lit.get("seat", 0) < 0.2, "reverse: beats left backward are reset")
    s = goto_beat(page, "hero", 0, settle_ms=100)
    lit = lights(page)
    still = [b for b in BEATS[1:] if b in lit and lit[b] > 0.2]
    check(not still, f"reverse: at the top every later performance is reset, still lit: {still}")
    check(not actor_dom(page)["flying"] and not actor_dom(page)["docked"], "reverse: no Actor at the top")
    check(s["chapter"] == "night", "reverse: the top is night again")


def check_reduced(browser, url, shots):
    print("[reduced motion]")
    context, page, errors = open_page(browser, url, viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    info = page.evaluate(
        """() => {
          const d = document.documentElement;
          const stages = [...document.querySelectorAll('.story-stage')].map((el) => {
            const c = getComputedStyle(el); return { position: c.position, visibility: c.visibility, clip: c.clipPath, height: el.offsetHeight };
          });
          const panels = [...document.querySelectorAll('.story-panel')].map((el) => {
            const c = getComputedStyle(el), r = el.getBoundingClientRect();
            return { beats: el.dataset.beats, position: c.position, visibility: c.visibility, opacity: c.opacity, inert: el.inert, top: r.top + scrollY, height: r.height };
          });
          const sections = [...document.querySelectorAll('.story-act')].map((el) => ({ mt: getComputedStyle(el).marginTop, h: el.offsetHeight }));
          const layer = document.querySelector('.actor-layer');
          const slots = [...document.querySelectorAll('.face-slot')].filter((el) => getComputedStyle(el).display !== 'none')
            .map((el) => ({ anchor: el.dataset.anchor, opacity: getComputedStyle(el).opacity }));
          const input = document.querySelector('#join input[type=email]');
          return { cls: d.className, lenis: d.classList.contains('lenis'), stages, panels, sections,
                   actor: layer ? getComputedStyle(layer).display : 'missing', slots,
                   input: !!input && input.getBoundingClientRect().height > 0,
                   scrollHeight: d.scrollHeight, vh: innerHeight, running: window.__story.isRunning(), reduced: window.__story.get().flags.reduced,
                   h1: document.querySelectorAll('h1').length, wipe: d.dataset.wipe ?? null };
        }"""
    )
    check("reduced" in info["cls"].split() and "motion" not in info["cls"].split(), f"reduced: html has class reduced, not motion ({info['cls']})")
    check(not info["lenis"], "reduced: Lenis is off")
    check(not info["running"] and info["reduced"], "reduced: the frame loop is not running and flags.reduced is set")
    check(all(s["position"] != "sticky" and s["visibility"] == "visible" and s["clip"] == "none" for s in info["stages"]), f"reduced: stages are static, visible and unclipped: {info['stages']}")
    check(all(s["mt"] == "0px" for s in info["sections"]), f"reduced: no negative margins: {info['sections']}")
    check(all(p["position"] != "absolute" and p["visibility"] == "visible" and p["opacity"] == "1" and not p["inert"] and p["height"] > 40 for p in info["panels"]), f"reduced: every panel is a visible block: {info['panels']}")
    tops = [p["top"] for p in info["panels"]]
    check(tops == sorted(tops) and len(set(tops)) == len(tops), f"reduced: panels are stacked in order, tops {tops}")
    check(info["actor"] == "none", f"reduced: the Actor layer is not shown ({info['actor']})")
    check(all(s["opacity"] == "1" for s in info["slots"]) and any(s["anchor"] == "ticket" for s in info["slots"]), f"reduced: real faces are visible: {info['slots']}")
    check(info["input"], "reduced: the waitlist form is on the page")
    check(info["h1"] == 1, f"reduced: exactly one h1 ({info['h1']})")
    check(info["scrollHeight"] < info["vh"] * 12, f"reduced: the page is its natural height, not the 12-viewport story ({info['scrollHeight']}px)")
    # No autonomous motion and no scroll-jacking: native scroll moves the page 1:1, nothing changes by itself.
    page.evaluate("() => window.scrollTo(0, 600)")
    page.wait_for_timeout(300)
    y1 = page.evaluate("() => scrollY")
    page.wait_for_timeout(500)
    y2 = page.evaluate("() => scrollY")
    check(y1 == 600 and y2 == 600, f"reduced: native scroll, no inertia (scrollY {y1} then {y2})")
    # #join works natively.
    page.evaluate("() => document.querySelector('a[href=\"#join\"]').click()")
    page.wait_for_timeout(300)
    top = page.evaluate("() => document.getElementById('join').getBoundingClientRect().top")
    check(abs(top) < 120, f"reduced: the #join link jumps to the seat section (top {top:.0f})")
    if shots:
        page.screenshot(path=str(shots / "reduced.png"), full_page=True)
    check(not errors, f"reduced: no console errors: {errors[:3]}")
    context.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url", nargs="?", default="http://localhost:3100")
    ap.add_argument("--shots", type=Path, default=None, help="directory for screenshots")
    args = ap.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=CHROMIUM_ARGS)

        context, page, errors = open_page(browser, args.url, viewport={"width": 1440, "height": 900})
        s = state(page)
        check(page.evaluate("() => document.documentElement.classList.contains('motion')"), "desktop: html has class motion")
        check(s["beat"] == "hero" and s["chapter"] == "night", f"desktop: starts on hero at night, got {s['beat']} {s['chapter']}")
        total = page.evaluate("() => document.documentElement.scrollHeight / innerHeight")
        print(f"document height: {total:.2f} viewports")
        check(11.5 < total < 12.3, f"desktop: the document is about 11.9 viewports tall, got {total:.2f}")
        ends = page.evaluate("() => [...document.querySelectorAll('.story-act')].map((e) => Math.round(e.getBoundingClientRect().bottom + scrollY))")
        foot = page.evaluate("() => Math.round(document.querySelector('footer').getBoundingClientRect().top + scrollY)")
        check(max(ends) == ends[-1] and abs(foot - ends[-1]) <= 1, f"desktop: no act section ends below the last one, and the footer follows it directly (ends {ends}, footer {foot})")
        if args.shots:
            page.screenshot(path=str(args.shots / "hero.png"))
        check_beats(page, "desktop")
        check_wipes(page, args.shots)
        check_actor(page, args.shots)
        check_fast(page, args.shots)
        check(not errors, f"desktop: no console errors: {errors[:3]}")
        context.close()

        check_reduced(browser, args.url, args.shots)

        print("[mobile]")
        context, page, errors = open_page(browser, args.url, viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        check_beats(page, "mobile")
        s = goto_beat(page, "daybreak", 0.6)
        check(0 < s["dayTop"] < s["vh"], "mobile: the wipe splits the screen")
        s = goto_beat(page, "seat", 0.6, settle_ms=200)
        check(actor_dom(page)["docked"] == ["ticket"], f"mobile: docked on the ticket, got {actor_dom(page)}")
        if args.shots:
            page.screenshot(path=str(args.shots / "mobile-seat.png"))
        check(not errors, f"mobile: no console errors: {errors[:3]}")
        context.close()

        print("[native scroll, Lenis off]")
        sep = "&" if "?" in args.url else "?"
        context, page, errors = open_page(browser, f"{args.url}{sep}lenis=0", viewport={"width": 1280, "height": 720})
        check(not page.evaluate("() => document.documentElement.classList.contains('lenis')"), "native: Lenis is off")
        check_beats(page, "native")
        s = goto_beat(page, "nightfall", 0.6)
        check(s["beat"] == "nightfall" and 0 < s["dayTop"] < s["vh"], "native: the wipe splits the screen")
        s = goto_beat(page, "seat", 0.6, settle_ms=200)
        check(actor_dom(page)["docked"] == ["ticket"], f"native: docked on the ticket, got {actor_dom(page)}")
        check(not errors, f"native: no console errors: {errors[:3]}")
        context.close()

        browser.close()

    print(f"\n{passes} checks passed, {len(failures)} failed")
    if failures:
        for f in failures:
            print(f" - {f}")
        sys.exit(1)
    print("story check: OK")


if __name__ == "__main__":
    main()
