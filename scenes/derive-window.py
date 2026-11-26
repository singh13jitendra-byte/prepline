#!/usr/bin/env python3
"""
Delight 4 (through the window): layers cut from the room's OWN painted window.

The `window-frame` asset (a second, differently painted window: orange daylight oak, panes
face-on, other proportions) does not line up with desk-night's window and read as a prop when it
was tried (Scenes.tsx). So the push-through is built from desk-night itself, which lines up by
construction:

  window-pane-l / -r     the two open casements (wood only, glass transparent), cut from the
                         painting, so they can swing a few degrees wider on their hinges.
                         Under the lamp (left) the occluded wood is inpainted, so a swing does not
                         carry a ghost of the arm with it.
  window-glass-l / -r    alpha masks of each casement's glass: where the lamp glint slides.
  window-front           the lamp (shade, arm, pole) with its own painted edges: it stays in front
                         of the casements and of the meadow seen through the window.
  window-view            alpha mask (desktop) of what is seen through the window: the opening and
                         both casements (the panes are drawn over it), fading out low down where
                         the laptop, steam and plant stand, with a hole for the plant.
  window-view-glass      the same for phones, where the casements do not swing: their wood is left
                         to the room, so only the glass shows the meadow.

All rects are desk-night source pixels (2048 x 1152); sceneGeometry.ts WINDOW_LAYERS mirrors them.
Run from the repo root:  python3 scenes/derive-window.py [--debug /tmp/dir]
"""
import json
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

SRC = "public/scenes/desk-night-2048.webp"
OUT = "public/scenes"
DEBUG = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None

img = Image.open(SRC).convert("RGB")
W, H = img.size
assert (W, H) == (2048, 1152), (W, H)
rgb = np.asarray(img).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def poly(points, ss_=4):
    """Antialiased polygon coverage (0..1), supersampled."""
    m = Image.new("L", (W * ss_, H * ss_), 0)
    ImageDraw.Draw(m).polygon([(x * ss_, y * ss_) for x, y in points], fill=255)
    return np.asarray(m.resize((W, H), Image.BOX)).astype(np.float32) / 255


def capsule(a, b, r, soft=1.0):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    d = np.hypot(xx - (ax + t * dx), yy - (ay + t * dy))
    return 1 - ss(r - soft, r + soft, d)


def disc(c, r, soft=1.0):
    return 1 - ss(r - soft, r + soft, np.hypot(xx - c[0], yy - c[1]))


R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
warm = R - B  # wood and brass are warm; sky, hills and grass are cool

# ── the window, measured on the painting (row/column scans of R-B) ──
OPEN = (946.5, 107.5, 1932.5, 826.5)  # inner edge of the frame: jambs, head, sill top
CL = [(944, 104), (1152, 166), (1154, 436), (1182, 436), (1182, 536), (1154, 536), (1154, 826), (944, 826)]
CR = [(1934, 104), (1714, 166), (1712, 452), (1688, 452), (1688, 532), (1712, 532), (1710, 826), (1934, 826)]
PLANT = ((1866, 792), (80, 58))  # the potted plant's leaves over the right casement's foot

# Low on the left casement the lamp's light lies on the glass: warm, but not brown. There, wood
# must also be redder than it is green.
GLOW = 1 - ss(0.8, 1.2, np.hypot((xx - 1100) / 90, (yy - 730) / 110))


def wood_alpha(c):
    r_, g_, b_ = c[..., 0], c[..., 1], c[..., 2]
    return ss(4, 24, r_ - b_) * (1 - GLOW + GLOW * ss(8, 18, r_ - g_))


def top_edge(wood, x_from, x_to, fit_from, fit_to):
    """The casement's top edge: the sky above a sloped top rail is not wood. Measured per column on
    the rail alone (fit_from..fit_to), fitted with a straight line (the rail is straight) and
    extended over the stiles, so the edge is clean and sub-pixel, never a staircase."""
    col = (wood > 0.5).astype(np.uint8)
    xs, ys = [], []
    for x in range(fit_from, fit_to):
        run = np.convolve(col[110:320, x], np.ones(6), "valid")
        hit = np.nonzero(run >= 6)[0]
        if len(hit):
            xs.append(x)
            ys.append(110 + hit[0])
    k, c = np.polyfit(xs, ys, 1)
    # Robust: refit on the columns within 3px of the first fit.
    xs, ys = np.array(xs), np.array(ys)
    ok = np.abs(ys - (k * xs + c)) < 3
    k, c = np.polyfit(xs[ok], ys[ok], 1)
    top = np.zeros(W, np.float32)
    top[x_from:x_to] = k * np.arange(x_from, x_to) + c
    return ss(top[None, :] - 0.6, top[None, :] + 0.9, yy), (k, c)


# ── wood: soft alpha from warmth; the painted fireflies (small warm dots) are not wood ──
hard = ((warm > 14) & (wood_alpha(rgb) > 0.5)).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, connectivity=8)
keep = np.zeros(n, np.uint8)
keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= 500
big = cv2.dilate(keep[lab] * 255, np.ones((5, 5), np.uint8)).astype(np.float32) / 255
big = cv2.GaussianBlur(big, (0, 0), 1.0)


woodA = wood_alpha(rgb) * big

# ── the lamp (front layer): shade polygon + capsules round the arm and pole ──
SHADE = [(1126, 546), (1162, 546), (1164, 576), (1202, 586), (1238, 604), (1254, 626), (1264, 656), (1136, 714), (1123, 692), (1120, 640), (1122, 606), (1112, 598)]
shape = np.maximum.reduce([
    poly(SHADE),
    capsule((1030, 676), (1128, 597), 7.5),
    disc((1021, 681), 16),
    capsule((1022, 690), (1068, 870), 7.5),
    disc((1071, 879), 16),
])
core = cv2.erode((shape > 0.99).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(np.float32)
core = cv2.GaussianBlur(core, (0, 0), 1.2)
lampA = np.clip(np.maximum(core, shape * ss(-6, 16, warm)), 0, 1)

# ── left casement wood, with the wood hidden by the lamp inpainted ──
cl = poly(CL)
cr = poly(CR)
rgb8 = np.asarray(img).copy()
hole = (cv2.dilate((lampA > 0.04).astype(np.uint8), np.ones((7, 7), np.uint8)) * (cl > 0)).astype(np.uint8) * 255
inpainted = cv2.inpaint(rgb8, hole, 7, cv2.INPAINT_TELEA)
ip = inpainted.astype(np.float32)
hardIp = ((ip[..., 0] - ip[..., 2] > 14) & (wood_alpha(ip) > 0.5)).astype(np.uint8)
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(hardIp, connectivity=8)
k2 = np.zeros(n2, np.uint8)
k2[1:] = st2[1:, cv2.CC_STAT_AREA] >= 500
bigIp = cv2.GaussianBlur(cv2.dilate(k2[lab2] * 255, np.ones((5, 5), np.uint8)).astype(np.float32) / 255, (0, 0), 1.0)
TOP_L = top_edge(wood_alpha(ip) * bigIp, 940, 1190, 996, 1104)
cl = cl * TOP_L[0]
TOP_R = top_edge(woodA, 1684, 1940, 1758, 1884)
cr = cr * TOP_R[0]
print('rail tops (slope, intercept):', TOP_L[1], TOP_R[1])
STRAY = disc((1875, 720), 15, 4)  # a painted firefly against the right casement's stile
# The hinge stiles (with their metal plates, which are not warm) are solid: they are what swings on.
HINGE_L = (1 - ss(962, 966, xx)) * cl
HINGE_R = ss(1916, 1920, xx) * cr
paneLA = np.clip(np.maximum(wood_alpha(ip) * bigIp * cl, HINGE_L), 0, 1)

plant = 1 - ss(0.75, 1.15, np.hypot((xx - PLANT[0][0]) / PLANT[1][0], (yy - PLANT[0][1]) / PLANT[1][1]))
paneRA = np.clip(np.maximum(woodA * cr, HINGE_R) * (1 - plant) * (1 - STRAY), 0, 1)

# A painted soft edge (the lamp catching a stile) is half wood, half sky: over the meadow it would
# read as a ghost strip. The casements get crisp (still antialiased) edges instead.
paneLA = np.maximum(ss(0.3, 0.75, paneLA), HINGE_L * (1 - lampA))
paneRA = ss(0.3, 0.75, paneRA)

# ── what is seen through the window ──
x0, y0, x1, y1 = OPEN
rect = ss(x0 - 0.75, x0 + 0.75, xx) * (1 - ss(x1 - 0.75, x1 + 0.75, xx)) * ss(y0 - 0.75, y0 + 0.75, yy) * (1 - ss(y1 - 0.75, y1 + 0.75, yy))
cas = np.maximum(cl, cr)
casSoft = cv2.GaussianBlur(cas, (0, 0), 3.0)
low = 1 - ss(606, 716, yy)  # the clear opening fades out above the laptop, the steam and the plant
viewD = rect * (casSoft + (1 - casSoft) * low) * (1 - plant)
glassL = np.clip(cl * (1 - paneLA) * (1 - lampA), 0, 1)
glassR = np.clip(cr * (1 - paneRA) * (1 - plant), 0, 1)
# Phones: the casements stay painted (they do not swing), so only their glass shows the meadow.
viewP = rect * (cas * (1 - woodA) + (1 - cas) * low) * (1 - plant)


def box(pts, pad=2):
    a = np.array(pts)
    return (int(a[:, 0].min()) - pad, int(a[:, 1].min()) - pad, int(np.ceil(a[:, 0].max())) + pad, int(np.ceil(a[:, 1].max())) + pad)


RECTS = {
    "view": (940, 100, 1940, 834),
    "pane-l": box(CL),
    "pane-r": box(CR),
    "front": (996, 538, 1272, 846),
}


def crop(a, r):
    return a[r[1]:r[3], r[0]:r[2]]


def save_rgba(name, colour, alpha, r, lossless=False):
    a8 = (np.clip(crop(alpha, r), 0, 1) * 255 + 0.5).astype(np.uint8)
    c8 = crop(colour, r).astype(np.uint8)
    # Fully transparent pixels carry a neutral colour, so nothing bleeds in filtering.
    out = Image.fromarray(np.dstack([c8, a8]), "RGBA")
    out.save(f"{OUT}/{name}.webp", "WEBP", lossless=lossless, quality=90 if not lossless else 100, alpha_quality=100, method=6, exact=True)
    return out


def save_mask(name, alpha, r):
    return save_rgba(name, np.full((H, W, 3), 255, np.uint8), alpha, r, lossless=True)


save_rgba("window-pane-l", inpainted, paneLA, RECTS["pane-l"])
save_rgba("window-pane-r", rgb8, paneRA, RECTS["pane-r"])
save_rgba("window-front", rgb8, lampA, RECTS["front"])
save_mask("window-glass-l", glassL, RECTS["pane-l"])
save_mask("window-glass-r", glassR, RECTS["pane-r"])
save_mask("window-view", viewD, RECTS["view"])
save_mask("window-view-glass", viewP, RECTS["view"])
print(json.dumps(RECTS))

if DEBUG:
    import os

    os.makedirs(DEBUG, exist_ok=True)
    mag = np.zeros_like(rgb8)
    mag[...] = (255, 0, 255)
    def over(base, a, col):
        a = a[..., None]
        return base * (1 - a) + col.astype(np.float32) * a
    m = mag.astype(np.float32)
    m = over(m, paneLA, inpainted)
    m = over(m, paneRA, rgb8)
    m = over(m, lampA, rgb8)
    Image.fromarray(m[60:900, 900:2000].astype(np.uint8)).save(f"{DEBUG}/layers-on-magenta.png")
    v = rgb8.astype(np.float32)
    tint = np.zeros_like(v)
    tint[...] = (255, 0, 255)
    Image.fromarray(over(v, viewD * 0.6, tint)[60:900, 900:2000].astype(np.uint8)).save(f"{DEBUG}/view-desktop.png")
    Image.fromarray(over(v, viewP * 0.6, tint)[60:900, 900:2000].astype(np.uint8)).save(f"{DEBUG}/view-phone.png")
    Image.fromarray(over(v, np.maximum(glassL, glassR) * 0.7, tint)[60:900, 900:2000].astype(np.uint8)).save(f"{DEBUG}/glass.png")
