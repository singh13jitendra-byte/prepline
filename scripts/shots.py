#!/usr/bin/env python3
"""Screenshot every beat of the scroll story.

    python3 scripts/shots.py http://localhost:3100 /tmp/shots          # desktop 1440x900
    python3 scripts/shots.py http://localhost:3100 /tmp/shots small    # phone 390x844 (forces ?world=gl)
"""
from playwright.sync_api import sync_playwright
url = sys.argv[1]; out = sys.argv[2]
small = len(sys.argv) > 3 and sys.argv[3] == "small"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
SHOTS = [("hero",0.0),("hero",0.3),("hero",0.7),("pass1",0.5),("pass2",0.6),("ranked",0.6),("reason",0.5),("daybreak",0.6),
         ("saved",0.6),("applied",0.6),("interview",0.6),("hinge",0.5),("nightfall",0.6),("unfold",0.7),("q1",0.6),("q3",0.6),
         ("votes",0.6),("dawn",0.7),("seat",0.7),("footer",0.1)]
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={"width":390,"height":844} if small else {"width":1440,"height":900}, has_touch=small, is_mobile=small, device_scale_factor=1)
    pg = ctx.new_page()
    errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.goto(url + ("?world=gl" if small else ""), wait_until="networkidle")
    pg.wait_for_function("() => window.__story !== undefined")
    pg.wait_for_timeout(3500)
    if not small:
        pg.mouse.move(900, 500); pg.wait_for_timeout(300); pg.mouse.move(980, 460); pg.wait_for_timeout(1500)
    for i,(beat,at) in enumerate(SHOTS):
        pg.evaluate("([b,a]) => window.__story.scrollToBeat(b, a, { immediate: true })", [beat, at])
        pg.wait_for_timeout(1400)
        pg.screenshot(path=f"{out}/{i:02d}-{beat}-{int(at*100)}.png")
    print("errors:", errs[:8])
    b.close()
