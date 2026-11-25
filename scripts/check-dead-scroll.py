import io
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
URL = "http://localhost:3110/?world=css"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(2500)
    H = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
    prev=None; y=0; dead=[]
    while y <= H:
        pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(450)
        # wait more to let timed performances settle so we measure scroll-driven change only
        pg.wait_for_timeout(900)
        im = Image.open(io.BytesIO(pg.screenshot())).convert("L").resize((360,225))
        st = pg.evaluate("(()=>{const s=window.__story.get();return s.beat+' '+s.beatProgress.toFixed(2)})()")
        if prev is not None:
            d = ImageStat.Stat(ImageChops.difference(im, prev)).mean[0]
            flag = "  <-- DEAD" if d < 0.15 else ""
            print(f"{y:6d} {st:16s} diff={d:.2f}{flag}", flush=True)
        prev = im; y += 120
    b.close()
