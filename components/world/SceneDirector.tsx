"use client";

/**
 * SCENE DIRECTOR — moves the painted layers from the story store. Transforms and opacity
 * only; no layout is read in the frame loop (the cover boxes are computed from the viewport
 * size, which is read on resize).
 *
 *   hero        desk-night at rest (nothing is written to it). Then the store's `push` drives the
 *               camera at the window: the room scales about the window's centre, its painted frame
 *               flying past, to at most ROOM_MAX x cover, dissolving into the meadow from hero 0.35
 *               and gone (display:none) by ROOM_HANDOFF (0.45). The meadow then settles 1.16 → 1.
 *   pass1..     meadow-night, a slow push, the foreground grass risen
 *   daybreak    the cream day rises over it from below (ChapterBackdrop)
 *   board       paper only: every painted layer is switched off
 *   nightfall   desk-night again, framed close on the desk (DESK_CLOSE)
 *   prep        the same close frame, drifting in a few percent
 *   dawn        above the Line the room pulls back and turns to desk-bluehour;
 *               below the Line it is desk-dawn; a flat rectangle of light crosses the wall.
 *               Delight 7: the hour graduates with the story clock (clock.ts) instead of
 *               swapping: blue hour comes in slowly (BLUE), the window's horizon pales (TL_WIN),
 *               first light (TL_FIRST) fills the blue room and warm light gathers just above the
 *               Line and rises with it (TL_WARM), and the morning uncovered below the Line
 *               starts dim and clears (TL_DIM).
 *   seat        desk-dawn, the grass at the very bottom
 *
 * It also publishes what the fireflies need (worldBus.scene): the window's glass on screen
 * (they are only drawn inside it during the hero), how far outside we are, and the parallax.
 * Reduced motion: none of this runs; the paintings are still panel backgrounds (Scenes.tsx).
 */

import { useEffect } from "react";
import { registerAnchor, type AnchorId } from "@/lib/anchors";
import { BEATS, SCENE_TRACK, clamp01, story, DAWN_WIPE, type BeatId, type StoryState } from "@/lib/story";
import { worldBus } from "./bus";
import { DESK, DESK_CLOSE, FOCUS, HERO_SMALL, HOTSPOTS, ROOM_HANDOFF, WINDOW_FILES, WINDOW_LAYERS, WINDOW_OPENING, WINDOW_SKY, coverBox, type HotspotId } from "./sceneGeometry";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const io = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The time-lapse light at dawn (delight 7), in dawn progress. The story clock runs Thu 1:10 PM →
 * Fri 6:10 AM over dawn 0–0.2, blue hour to 6:40 at DAWN_WIPE, sunrise (6:58) at about 0.92.
 *   BLUE      the lamp-lit room turns to desk-bluehour (was a linear 0–0.15 fade)
 *   TL_WIN    the window's horizon pales from blue to gold
 *   TL_FIRST  first light, low in the blue room
 *   TL_WARM   warm light gathers on the floor, then rides just above the Line as it rises
 *   TL_DIM    below the Line, the uncovered morning clears from dim to full
 */
const BLUE: [number, number] = [0.1, 0.36];
const TL_WIN: [number, number] = [0.16, 0.6];
const TL_FIRST: [number, number] = [0.2, 0.44];
const TL_WARM: [number, number] = [0.28, 0.5];
const TL_DIM: [number, number] = [DAWN_WIPE + 0.02, 0.97];

/** How far down the foreground grass sits, as a fraction of the stage: off screen, in the meadow, under the seat act. */
const GRASS_OFF = 0.62;
const GRASS_LOW = 0.3;
const GRASS_SEAT = 0.43;

/**
 * The push through the window, in hero progress. The store's push (SCENE_TRACK.hero) starts at
 * PUSH_START; the room hands the screen to the meadow by HANDOFF, dissolving from FADE_FROM.
 * ROOM_MAX caps the room's scale over cover: desk-night is 2048px wide, so at 1440 on a 2x screen
 * it is already 1.4x at rest and about 3.5x at the cap; past that the window and lamp go to mush.
 */
const PUSH_START = SCENE_TRACK.hero.moves?.[0]?.range[0] ?? 0.16;
const HANDOFF = ROOM_HANDOFF;
const FADE_FROM = 0.35;
const ROOM_MAX = 2.4;
const ROOM_MAX_SMALL = 1.5;
/** How far past its cap the room goes while it dissolves (delight 4), as a fraction of the cap. */
const ROOM_PAST = 0.22;
const ROOM_PAST_SMALL = 0.3;

/**
 * Through the window (delight 4), in hero progress. The meadow is revealed through the painted
 * opening (VIEW_IN), the casements swing PANE_SWING degrees wider on their hinges (SWING), a lamp
 * glint crosses their glass once (GLINT), and the fireflies by the window are blown gently out
 * toward the viewer (BREEZE). The meadow seen through the window grows a little as we near it
 * (MEADOW_NEAR → MEADOW_PEAK by FADE_FROM: the far hills move less than the room), then settles.
 * Everything is done by HANDOFF; the breeze has died by 0.53, before the counter at 0.55.
 */
const VIEW_IN: [number, number] = [0.17, 0.27];
const SWING: [number, number] = [0.21, 0.43];
const PANE_SWING = 12;
const GLINT: [number, number] = [0.25, 0.39];
const BREEZE: [number, number] = [0.27, 0.53];
const MEADOW_NEAR = 1.06;
const MEADOW_PEAK = 1.16;

type Box = { x: number; y: number; w: number; h: number };
/** A style property written only when its value changes. */
type Prop = { el: HTMLElement | null; v: string };
const prop = (el: HTMLElement | null): Prop => ({ el, v: "" });
function set(p: Prop, name: "transform" | "opacity" | "visibility", v: string) {
  if (!p.el || v === p.v) return;
  p.v = v;
  p.el.style[name] = v;
}
type Put = { el: HTMLElement | null; img: HTMLImageElement | null; t: string; o: string; v: string; d: string; offAt: number };
const slot = (el: HTMLElement | null): Put => ({ el, img: el?.querySelector<HTMLImageElement>(":scope > picture > .sc-img") ?? null, t: "", o: "", v: "?", d: "?", offAt: 0 });

/**
 * The render-tree policy (round 5; the founder's recording of 195596b showed the room dropping
 * to flat night in blocks, on and off, as the push began):
 *   - A layer that is showing is visibility:visible.
 *   - A layer that is NEAR (its scene is on screen, or one beat away) but not showing stays in
 *     the render tree: visibility:hidden, opacity 0. Nothing is decoded or laid out again when it
 *     comes back, and the flip can be undone in the same frame.
 *   - Only a layer two or more beats away leaves the tree (display:none), so the GPU can let go of
 *     its tiles (the original hero flicker came from many far layers kept composited).
 *   - Hysteresis: a layer that stops being wanted keeps its place (at opacity 0) for HOLD_MS before
 *     it is hidden, so a scroll that dithers around a threshold cannot toggle it frame to frame.
 *   - A layer whose picture has not loaded and decoded is never revealed in a hand-off: the scene
 *     before it holds (see `ready`).
 */
const HOLD_MS = 300;
const clock = { now: 0, pending: false, flips: 0 };

function put(p: Put, visible: boolean, opacity = 1, tx = 0, ty = 0, k = 1, near = true) {
  const el = p.el;
  if (!el) return;
  let show = visible && opacity > 0.004;
  if (show) p.offAt = 0;
  else if (p.v === "visible") {
    if (!p.offAt) p.offAt = clock.now;
    if (clock.now - p.offAt < HOLD_MS) {
      show = true;
      opacity = 0;
      clock.pending = true;
    }
  }
  const v = show ? "visible" : "hidden";
  const d = show || near ? "" : "none";
  if (v !== p.v) el.style.visibility = p.v = v;
  if (d !== p.d) {
    el.style.display = p.d = d;
    clock.flips++;
  }
  const o = !show || opacity <= 0.004 ? "0" : opacity >= 0.996 ? "1" : opacity.toFixed(3);
  if (o !== p.o) el.style.opacity = p.o = o;
  if (!show) return;
  const t = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${k.toFixed(5)})`;
  if (t !== p.t) el.style.transform = p.t = t;
}

/**
 * Wrappers. Off and far: display:none (a visible child can never outvote a hidden parent).
 * Off but near: left in the tree; their layer children are hidden by `put` instead.
 */
function shown(p: Put, on: boolean, near = false) {
  const v = on || near ? "block" : "none";
  if (p.el && v !== p.v) {
    p.el.style.display = p.v = v;
    clock.flips++;
  }
}

const fix = (v: number, d: number) => (v <= 0.0005 ? "0" : v >= 0.9995 ? "1" : v.toFixed(d));
/** One pass of the glint across a casement's glass: u 0..1 slides it over; it is lit only mid-way. */
function glint(g: { t: Prop; o: Prop }, u: number) {
  const k = clamp01(u);
  const lit = Math.pow(Math.sin(Math.PI * k), 1.6);
  set(g.o, "opacity", fix(lit, 3));
  if (lit > 0) set(g.t, "transform", `translate3d(${mix(-26, 26, k).toFixed(2)}%,0,0)`);
}

const tx = (box: Box, q: number, to: number, k: number) => to - box.x - k * q;
const ty = (box: Box, q: number, to: number, k: number) => to - box.y - k * q;

export function SceneDirector() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-scenes]");
    if (!root) return;
    const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
    if (new URLSearchParams(window.location.search).get("scenes") === "debug") document.documentElement.setAttribute("data-scenes-debug", "");

    /* ── hotspots are anchors ── */
    const offs: (() => void)[] = [];
    (Object.keys(HOTSPOTS) as HotspotId[]).forEach((id) => {
      const el = q<HTMLElement>(`[data-hot="${id}"]`);
      if (el) offs.push(registerAnchor(id as AnchorId, el));
    });

    /* ── pictures: the hero now, the rest once it has painted ── */
    const show = (img: HTMLImageElement) => {
      const on = () => img.setAttribute("data-on", "");
      if (img.complete && img.naturalWidth > 0) on();
      else img.addEventListener("load", on, { once: true });
    };
    const hero = q<HTMLImageElement>(".sc-room .sc-img");
    const lit = () => root.setAttribute("data-lit", "");
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      document.querySelectorAll<HTMLElement>(".sc [data-srcset]").forEach((el) => {
        el.setAttribute("srcset", el.dataset.srcset ?? "");
        el.removeAttribute("data-srcset");
      });
      document.querySelectorAll<HTMLImageElement>(".sc img[data-src]").forEach((img) => {
        img.loading = "eager";
        img.src = img.dataset.src ?? "";
        img.removeAttribute("data-src");
        show(img);
      });
    };
    if (hero) {
      show(hero);
      if (hero.complete) {
        lit();
        release();
      } else {
        hero.addEventListener("load", () => (lit(), release()), { once: true });
        hero.addEventListener("error", () => (lit(), release()), { once: true });
      }
    } else lit();
    /* Every scene picture is decoded ahead of its hand-off (meadow first: the push needs it), and
       once decoded it is switched to decoding="sync", so a later re-raster at a new scale waits for
       the pixels instead of drawing the tile empty (checker-imaging) for a few frames. */
    let lastKey = "";
    const decoded = new WeakSet<HTMLImageElement>();
    const warm = (img: HTMLImageElement | null) => {
      if (!img || decoded.has(img)) return;
      const done = () => {
        decoded.add(img);
        img.decoding = "sync";
        lastKey = "";
      };
      const go = () => (img.decode ? img.decode().then(done, () => img.naturalWidth > 0 && done()) : done());
      if (img.complete && img.naturalWidth > 0) go();
      else img.addEventListener("load", go, { once: true });
    };
    /* The window rig's masks are CSS mask-images: fetched and decoded here (after the hero), so the
       rig is never shown with a mask still loading. */
    const masks = new Map<string, boolean>();
    const warmMask = (src: string) => {
      if (masks.has(src)) return;
      masks.set(src, false);
      const im = new Image();
      im.decoding = "async";
      im.src = src;
      const done = () => {
        masks.set(src, true);
        lastKey = "";
      };
      (im.decode ? im.decode() : Promise.resolve()).then(done, () => im.naturalWidth > 0 && done());
    };
    const rigImgs = {
      meadow: q<HTMLImageElement>(".sc-view-meadow > picture > .sc-img"),
      paneL: q<HTMLImageElement>(".sc-pane-l > .sc-wimg"),
      paneR: q<HTMLImageElement>(".sc-pane-r > .sc-wimg"),
      front: q<HTMLImageElement>(".sc-front"),
    };
    const warmAll = () => {
      [".sc-room", ".sc-meadow", ".sc-grass", ".sc-blue", ".sc-dawn"].forEach((sel) => warm(q<HTMLImageElement>(`${sel} > picture > .sc-img`)));
      if (!q(".sc-win")) return;
      Object.values(rigImgs).forEach(warm);
      [WINDOW_FILES.view, WINDOW_FILES.viewGlass, WINDOW_FILES.glassL, WINDOW_FILES.glassR].forEach(warmMask);
    };
    if (hero?.complete) warmAll();
    else hero?.addEventListener("load", warmAll, { once: true });
    window.setTimeout(warmAll, 1600);
    const timer = window.setTimeout(release, 1500);
    if (story.reduced()) return () => (window.clearTimeout(timer), offs.forEach((off) => off()));

    /* ── layers ── */
    const night = slot(root);
    const room = slot(q(".sc-room"));
    const meadow = slot(q(".sc-meadow"));
    const blue = slot(q(".sc-blue"));
    const washN = slot(q(".sc-wash-night"));
    const washD = slot(q(".sc-wash-day"));
    const sun = slot(q(".sc-sun"));
    const dawn = slot(q(".sc-dawn"));
    const tlFirst = slot(q(".sc-tl-first"));
    const tlWarm = slot(q(".sc-tl-warm"));
    const tlDim = slot(q(".sc-tl-dim"));
    const tlWin = prop(q(".sc-tl-win"));
    const tlWinV = prop(tlWin.el);
    let camX = 0;
    let camY = 0;
    let camK = 1;
    const grassWrap = slot(q(".sc-grasswrap"));
    const grass = slot(q(".sc-grass"));
    const dawnWrap = q<HTMLElement>(".sc-dawnwrap");
    let dawnMode = "";
    let dawnDisplay = "";
    let grassNight = "?";
    /* ── through the window (delight 4) ── */
    const rigEl = q<HTMLElement>(".sc-win");
    const rig = prop(rigEl);
    const view = prop(q(".sc-view"));
    const viewIn = prop(q(".sc-view-meadow"));
    const paneL = prop(q(".sc-pane-l"));
    const paneR = prop(q(".sc-pane-r"));
    const glints = [...document.querySelectorAll<HTMLElement>(".sc-glint")];
    const glintL = { t: prop(glints[0] ?? null), o: prop(glints[0] ?? null) };
    const glintR = { t: prop(glints[1] ?? null), o: prop(glints[1] ?? null) };
    const decodedImg = (img: HTMLImageElement | null) => !!img && decoded.has(img);
    const rigReady = () =>
      !!rigEl &&
      decodedImg(rigImgs.meadow) &&
      decodedImg(rigImgs.front) &&
      (small ? !!masks.get(WINDOW_FILES.viewGlass) : decodedImg(rigImgs.paneL) && decodedImg(rigImgs.paneR) && !!masks.get(WINDOW_FILES.view) && !!masks.get(WINDOW_FILES.glassL) && !!masks.get(WINDOW_FILES.glassR));
    const ar = (el: HTMLElement | null, fallback: number) => (el && parseFloat(el.style.getPropertyValue("--ar"))) || fallback;
    const roomAr = ar(room.el, DESK.w / DESK.h);
    const meadowAr = ar(meadow.el, 16 / 9);

    /* ── viewport (read on resize only) ── */
    let vw = 0;
    let vh = 0;
    let stageH = 0;
    let small = false;
    let roomBox: Box = { x: 0, y: 0, w: 1, h: 1 };
    let meadowBox: Box = roomBox;
    let stale = true;
    const measure = () => {
      vw = root.clientWidth;
      vh = root.clientHeight;
      stageH = story.get().viewport.h || window.innerHeight;
      small = window.matchMedia("(max-width: 767px)").matches;
      const f = small ? "small" : "wide";
      roomBox = coverBox(vw, vh, roomAr, FOCUS.room[f][0], FOCUS.room[f][1]);
      meadowBox = coverBox(vw, vh, meadowAr, FOCUS.meadow[f][0], FOCUS.meadow[f][1]);
      stale = false;
      lastKey = "";
    };
    const onResize = () => (stale = true);
    window.addEventListener("resize", onResize, { passive: true });

    const par = { x: 0, y: 0 };
    /** A picture that has loaded and decoded (or a layer with no files: its flat ground is ready). */
    const ready = (p: Put) => !p.img || decoded.has(p.img);

    const frameFn = (_t: number, dt: number, s: Readonly<StoryState>) => {
      if (stale || !vw) measure();
      const i = ORDER[s.beat];
      const bp = s.beatProgress;

      // Pointer parallax, hero only: the room leans a little, the meadow beyond it leans more.
      const wantX = i === ORDER.hero && s.pointer.fine && s.pointer.inside ? s.pointer.x / vw - 0.5 : 0;
      const wantY = i === ORDER.hero && s.pointer.fine && s.pointer.inside ? s.pointer.y / stageH - 0.5 : 0;
      const k = 1 - Math.exp(-5 * dt);
      par.x += (wantX - par.x) * k;
      par.y += (wantY - par.y) * k;
      if (Math.abs(par.x - wantX) < 0.0005) par.x = wantX;
      if (Math.abs(par.y - wantY) < 0.0005) par.y = wantY;

      const key = `${s.pos.toFixed(3)}|${s.line.daySide}|${s.chapter}|${(par.x * 26).toFixed(1)}|${(par.y * 16).toFixed(1)}`;
      clock.now = performance.now();
      if (key === lastKey && !clock.pending) return;
      lastKey = key;
      clock.pending = false;

      // Which layers stay in the render tree (their scene is on screen or one beat away).
      const nearRoom = i <= ORDER.pass1 || (i >= ORDER.hinge && i <= ORDER.seat);
      const nearMeadow = i <= ORDER.saved;
      const nearBlue = i >= ORDER.votes && i <= ORDER.seat;
      const nearGrass = i <= ORDER.saved || i >= ORDER.votes;

      const cx = vw / 2;
      const cy = stageH / 2;
      const scene = worldBus.scene;
      scene.x0 = scene.y0 = -1e5;
      scene.x1 = scene.y1 = 1e5;
      scene.field = 0;
      scene.px = scene.py = 0;
      scene.breeze = 0;

      const nightOn = i <= ORDER.daybreak || (i >= ORDER.nightfall && i <= ORDER.dawn);
      const gn = i <= ORDER.daybreak ? "1" : "";
      if (gn !== grassNight && grassWrap.el) {
        grassNight = gn;
        grassWrap.el.toggleAttribute("data-night", gn === "1");
      }
      shown(night, nightOn);
      // The dawn light (delight 7) lives only in the prep/dawn branch below; anywhere else it is off.
      if (i < ORDER.nightfall || i > ORDER.dawn) {
        put(tlFirst, false, 0, 0, 0, 1, nearBlue);
        put(tlWarm, false, 0, 0, 0, 1, nearBlue);
        set(tlWinV, "visibility", "hidden");
      }

      /* ── Act I ── */
      if (i === ORDER.hero) {
        // The store says how far through the window we are (SCENE_TRACK.hero, a "push"): `p` runs
        // over the whole push and drives what keeps moving (the fireflies' dolly, the wash, the grass).
        const sc = s.scene;
        const p = io(sc.id !== "desk-night" ? 1 : sc.kind === "push" ? clamp01(sc.mix) : 0);
        // The room itself only owns the first part of it (PUSH_START → HANDOFF in hero progress):
        // it is a 2048px painting, so it is never scaled past ROOM_MAX × cover (soft beyond that).
        // It dissolves into the meadow from FADE_FROM and has left the render tree by HANDOFF, so
        // the counter that follows is revealed onto clean meadow.
        const pr = io(clamp01((bp - PUSH_START) / (HANDOFF - PUSH_START)));
        const sx0 = roomBox.w / DESK.w;
        const skyW = (WINDOW_SKY.x1 - WINDOW_SKY.x0) * sx0;
        const skyH = (WINDOW_SKY.y1 - WINDOW_SKY.y0) * sx0;
        const qx = ((WINDOW_SKY.x0 + WINDOW_SKY.x1) / 2) * sx0;
        const qy = ((WINDOW_SKY.y0 + WINDOW_SKY.y1) / 2) * sx0;
        const S = Math.min(Math.max(vw / skyW, stageH / skyH) * 1.12, small ? ROOM_MAX_SMALL : ROOM_MAX);
        // At rest the room is at cover; on small screens it stands smaller on the bottom edge.
        const k0 = small ? HERO_SMALL.scale : 1;
        const restX = small ? Math.min(0, Math.max(vw - k0 * roomBox.w, HERO_SMALL.laptopAt * vw - k0 * 0.704 * roomBox.w)) + k0 * qx : roomBox.x + qx;
        const restY = small ? stageH - k0 * roomBox.h + k0 * qy : roomBox.y + qy;
        // As it dissolves (delight 4) the room goes on past its cap a little, so the window's frame and
        // casements sweep out past the screen's edges: we pass through. The upscale is hidden by the fade.
        const kk = k0 * Math.pow(Math.max(S, k0) / k0, pr) * (1 + (small ? ROOM_PAST_SMALL : ROOM_PAST) * ss(FADE_FROM - 0.01, HANDOFF, bp));
        // The room itself never follows the pointer: sub-pixel moves of a detailed painting (and the
        // live list on the laptop) shimmer and read as flicker. Only the fireflies lean (scene.px/py).
        // At rest (bp < PUSH_START) nothing below changes, so the big painted layer is not touched.
        const toX = mix(restX, cx, pr);
        const toY = mix(restY, cy, pr);
        // The meadow must be decoded before the room dissolves into it; until then the room holds.
        const mReady = ready(meadow);
        const ro = mReady ? 1 - ss(FADE_FROM, HANDOFF, bp) : 1;
        const RX = tx(roomBox, qx, toX, kk);
        const RY = ty(roomBox, qy, toY, kk);
        put(room, ro > 0, ro, RX, RY, kk, nearRoom);
        // The meadow: seen through the window as we near it (growing a little, far away), then under
        // the room from the start of the dissolve, settling 1.16 → 1. One picture, one transform.
        const mk = bp < FADE_FROM ? mix(MEADOW_NEAR, MEADOW_PEAK, ss(PUSH_START, FADE_FROM, bp)) : mix(MEADOW_PEAK, 1, ss(FADE_FROM, 0.92, bp));
        const MX = tx(meadowBox, cx - meadowBox.x, cx, mk);
        const MY = ty(meadowBox, cy - meadowBox.y, cy, mk);
        put(meadow, mReady && bp > FADE_FROM - 0.02, 1, MX, MY, mk, nearMeadow);

        // Through the window (delight 4). The rig lives inside the room layer, so it is carried by
        // the room's transform and fades with it; here only what moves within it is written.
        const rigOn = mReady && ro > 0 && bp > PUSH_START + 0.004 && rigReady();
        set(rig, "visibility", rigOn ? "visible" : "hidden");
        if (rigOn) {
          set(view, "opacity", fix(ss(VIEW_IN[0], VIEW_IN[1], bp), 3));
          // The meadow inside the window sits exactly where the meadow layer is on screen.
          const vx = WINDOW_LAYERS.view.x0 * sx0;
          const vy = WINDOW_LAYERS.view.y0 * sx0;
          const is = mk / kk;
          const ix = (meadowBox.x + MX - roomBox.x - RX) / kk - vx;
          const iy = (meadowBox.y + MY - roomBox.y - RY) / kk - vy;
          set(viewIn, "transform", `translate3d(${ix.toFixed(2)}px,${iy.toFixed(2)}px,0) scale(${is.toFixed(5)})`);
          if (!small) {
            // The casements swing wider on their outer hinges (they open outward: the free edge goes away).
            const a = PANE_SWING * ss(SWING[0], SWING[1], bp);
            const persp = 3.4 * (WINDOW_LAYERS.paneL.x1 - WINDOW_LAYERS.paneL.x0) * sx0;
            set(paneL, "transform", a > 0.005 ? `perspective(${persp.toFixed(0)}px) rotateY(${a.toFixed(2)}deg)` : "none");
            set(paneR, "transform", a > 0.005 ? `perspective(${persp.toFixed(0)}px) rotateY(${(-a).toFixed(2)}deg)` : "none");
            glint(glintL, (bp - GLINT[0]) / (GLINT[1] - GLINT[0]));
            glint(glintR, (bp - GLINT[0] - 0.015) / (GLINT[1] - GLINT[0]));
          }
        }
        // The breeze: from the middle of the opening, the fireflies there drift out toward the viewer.
        const ox = ((WINDOW_OPENING.x0 + WINDOW_OPENING.x1) / 2) * sx0;
        const oy = ((WINDOW_OPENING.y0 + WINDOW_OPENING.y1) / 2) * sx0;
        scene.bx = roomBox.x + RX + kk * ox;
        scene.by = roomBox.y + RY + kk * oy;
        scene.breeze = Math.sin(Math.PI * clamp01((bp - BREEZE[0]) / (BREEZE[1] - BREEZE[0])));
        put(blue, false, 0, 0, 0, 1, nearBlue);
        // Small screens: the wall above the smaller room is the wash, so it stays until the room covers.
        put(washN, true, mix(1, 0.5, small ? ss(0.55, 1, pr) : ss(0.15, 0.7, pr)));
        // Fireflies: inside the glass while the room is there, everywhere once it has gone.
        const sx = sx0;
        const open = mReady ? ss(FADE_FROM, HANDOFF, bp) : 0;
        scene.x0 = mix(roomBox.x + RX + kk * WINDOW_SKY.x0 * sx, -200, open);
        scene.y0 = mix(roomBox.y + RY + kk * WINDOW_SKY.y0 * sx, -200, open);
        scene.x1 = mix(roomBox.x + RX + kk * WINDOW_SKY.x1 * sx, vw + 200, open);
        scene.y1 = mix(roomBox.y + RY + kk * WINDOW_SKY.y1 * sx, vh + 200, open);
        scene.field = 1;
        scene.px = -par.x * 26 * (1 - p);
        scene.py = -par.y * 16 * (1 - p);
        scene.push = p;
        shown(grassWrap, p > 0.8, nearGrass);
        put(grass, p > 0.8, 1, 0, mix(GRASS_OFF, GRASS_LOW + 0.05, ss(0.8, 1, p)) * stageH, 1, nearGrass);
      } else if (i <= ORDER.daybreak) {
        set(rig, "visibility", "hidden");
        const u = s.scene.id === "meadow-night" ? s.scene.progress : 1;
        const mk = 1 + 0.06 * u;
        put(room, false, 0, 0, 0, 1, nearRoom);
        put(blue, false, 0, 0, 0, 1, nearBlue);
        put(meadow, true, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk);
        put(washN, true, i >= ORDER.ranked ? mix(0.5, 0.78, i === ORDER.ranked ? ss(0, 0.5, bp) : 1) : 0.5);
        // Delight 5: as the night is folded away at daybreak (PaperFold), its fireflies settle out.
        scene.field = i === ORDER.daybreak ? 1 - ss(0.2, 0.6, bp) : 1;
        scene.push = 1;
        const g = i === ORDER.pass1 ? mix(0.8, 1, ss(0, 0.3, bp)) : i === ORDER.daybreak ? 1 - ss(0, 0.2, bp) : 1;
        shown(grassWrap, g > 0, nearGrass);
        put(grass, g > 0, i === ORDER.daybreak ? g : 1, 0, (mix(GRASS_LOW + 0.05, GRASS_LOW, Math.min(1, (g - 0.8) * 5)) - u * 0.02) * stageH, 1);
      } else if (i < ORDER.nightfall) {
        set(rig, "visibility", "hidden");
        shown(grassWrap, false, nearGrass);
        put(grass, false, 0, 0, 0, 1, nearGrass);
        put(meadow, false, 0, 0, 0, 1, nearMeadow);
        put(room, false, 0, 0, 0, 1, nearRoom);
      } else if (i <= ORDER.dawn) {
        /* ── Act III: close on the desk; at dawn the camera pulls back and the hour turns blue ── */
        const c = small ? DESK_CLOSE.small : DESK_CLOSE.wide;
        const u = s.scene.id === "desk-lamp" ? s.scene.progress : 1;
        const back = i === ORDER.dawn ? ss(0, 0.5, bp) : 0;
        const kk = Math.pow(c.scale * (1 + 0.04 * u), 1 - back);
        const qx = c.at[0] * roomBox.w;
        const qy = c.at[1] * roomBox.h;
        const toX = mix(c.to[0] * vw, roomBox.x + qx, back);
        const toY = mix(c.to[1] * stageH, roomBox.y + qy, back);
        // Never show past the painting's edge.
        const X = Math.min(-roomBox.x, Math.max(vw - roomBox.x - kk * roomBox.w, tx(roomBox, qx, toX, kk)));
        const Y = Math.min(-roomBox.y, Math.max(stageH - roomBox.y - kk * roomBox.h, ty(roomBox, qy, toY, kk)));
        // Lamp-lit night turns to blue hour (the store's "fade"), before the Line brings the dawn.
        camX = X;
        camY = Y;
        camK = kk;
        // Blue hour only once its picture is decoded; until then the lamp-lit room holds.
        set(rig, "visibility", "hidden");
        // Delight 7: slower and eased (BLUE), so the hour graduates with the clock instead of swapping.
        const bo = i !== ORDER.dawn || !ready(blue) ? 0 : ss(BLUE[0], BLUE[1], bp);
        put(room, bo < 1, 1, X, Y, kk, nearRoom);
        put(blue, bo > 0, bo, X, Y, kk, nearBlue);
        // The light of the hour (delight 7), above the Line: the window first, then the room.
        const lw = i === ORDER.dawn ? ss(TL_WIN[0], TL_WIN[1], bp) : 0;
        set(tlWinV, "visibility", lw > 0 ? "visible" : "hidden");
        if (lw > 0) set(tlWin, "opacity", fix(lw, 3));
        const lf = i === ORDER.dawn && bo > 0 ? ss(TL_FIRST[0], TL_FIRST[1], bp) : 0;
        put(tlFirst, lf > 0, lf, 0, 0, 1, nearBlue);
        const lr = i === ORDER.dawn && bo > 0 ? ss(TL_WARM[0], TL_WARM[1], bp) : 0;
        // Its bottom edge sits on the Line: on the floor while the Line waits there, then rising with it.
        put(tlWarm, lr > 0, lr, 0, Math.round(Math.min(0, s.dayTop - stageH)), 1, nearBlue);
        put(meadow, false, 0, 0, 0, 1, nearMeadow);
        put(washN, true, mix(0.82, 0.5, back));
        shown(grassWrap, false, nearGrass);
        put(grass, false, 0, 0, 0, 1, nearGrass);
      }

      /* ── Act IV: dawn below the Line, then the whole room ── */
      const mode = i >= ORDER.dawn ? (s.line.daySide === "below" ? "split" : s.chapter === "day" ? "day" : "off") : "off";
      if (dawnWrap && mode !== dawnMode) dawnWrap.dataset.mode = dawnMode = mode;
      // Off but near (from the votes on): left in the tree, hidden by its own CSS (visibility).
      const dd = mode === "off" && i < ORDER.votes ? "none" : "block";
      if (dawnWrap && dd !== dawnDisplay) {
        dawnWrap.style.display = dawnDisplay = dd;
        clock.flips++;
      }
      if (mode !== "off") {
        const sp = i === ORDER.dawn ? ss(DAWN_WIPE, 1, bp) * 0.6 : i === ORDER.seat ? 0.6 + 0.4 * ss(0, 0.5, bp) : 1;
        // The light crosses in whole pixels and 1% steps: about a third of the writes, no visible step.
        put(sun, sp < 1, Math.round(Math.sin(Math.PI * sp) * 34) / 100, Math.round(mix(vw * 0.02, vw * 0.4, sp)), Math.round(-stageH * 0.1), 1);
        put(washD, true, 1);
        // Below the Line the morning starts dim and cool, and clears as the Line climbs (delight 7).
        const dim = i === ORDER.dawn ? 1 - ss(TL_DIM[0], TL_DIM[1], bp) : 0;
        put(tlDim, dim > 0, dim, 0, 0, 1);
        // Above and below the Line it is one camera: the dawn room pulls back with the blue one.
        if (i === ORDER.dawn) put(dawn, true, 1, camX, camY, camK);
        else put(dawn, true, 1, 0, 0, 1);
        if (i > ORDER.dawn) {
          const g = i === ORDER.seat ? ss(0.15, 0.7, bp) : 1;
          shown(grassWrap, g > 0, nearGrass);
          put(grass, g > 0, 1, 0, Math.round(mix(GRASS_OFF, GRASS_SEAT, g) * stageH), 1, nearGrass);
        }
      }
    };

    offs.push(story.frame("actor", frameFn));
    // Verification: how often a scene layer or wrapper has entered or left the render tree.
    (window as unknown as { __scenes?: unknown }).__scenes = clock;

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      offs.forEach((off) => off());
    };
  }, []);
  return null;
}
