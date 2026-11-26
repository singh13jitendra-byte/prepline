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
 *               below the Line it is desk-dawn; a flat rectangle of light crosses the wall
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
import { DESK, DESK_CLOSE, FOCUS, HERO_SMALL, HOTSPOTS, ROOM_HANDOFF, WINDOW_SKY, coverBox, type HotspotId } from "./sceneGeometry";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const io = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

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

type Box = { x: number; y: number; w: number; h: number };
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
    const warmAll = () =>
      [".sc-room", ".sc-meadow", ".sc-grass", ".sc-blue", ".sc-dawn"].forEach((sel) => warm(q<HTMLImageElement>(`${sel} > picture > .sc-img`)));
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
    let camX = 0;
    let camY = 0;
    let camK = 1;
    const grassWrap = slot(q(".sc-grasswrap"));
    const grass = slot(q(".sc-grass"));
    const dawnWrap = q<HTMLElement>(".sc-dawnwrap");
    let dawnMode = "";
    let dawnDisplay = "";
    let grassNight = "?";
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

      const nightOn = i <= ORDER.daybreak || (i >= ORDER.nightfall && i <= ORDER.dawn);
      const gn = i <= ORDER.daybreak ? "1" : "";
      if (gn !== grassNight && grassWrap.el) {
        grassNight = gn;
        grassWrap.el.toggleAttribute("data-night", gn === "1");
      }
      shown(night, nightOn);

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
        const kk = k0 * Math.pow(Math.max(S, k0) / k0, pr);
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
        // The meadow is under the room from the start of the dissolve, then settles 1.16 → 1.
        const mk = mix(1.16, 1, ss(FADE_FROM, 0.92, bp));
        put(meadow, mReady && bp > FADE_FROM - 0.02, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk, nearMeadow);
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
        const u = s.scene.id === "meadow-night" ? s.scene.progress : 1;
        const mk = 1 + 0.06 * u;
        put(room, false, 0, 0, 0, 1, nearRoom);
        put(blue, false, 0, 0, 0, 1, nearBlue);
        put(meadow, true, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk);
        put(washN, true, i >= ORDER.ranked ? mix(0.5, 0.78, i === ORDER.ranked ? ss(0, 0.5, bp) : 1) : 0.5);
        scene.field = 1;
        scene.push = 1;
        const g = i === ORDER.pass1 ? mix(0.8, 1, ss(0, 0.3, bp)) : i === ORDER.daybreak ? 1 - ss(0, 0.2, bp) : 1;
        shown(grassWrap, g > 0, nearGrass);
        put(grass, g > 0, i === ORDER.daybreak ? g : 1, 0, (mix(GRASS_LOW + 0.05, GRASS_LOW, Math.min(1, (g - 0.8) * 5)) - u * 0.02) * stageH, 1);
      } else if (i < ORDER.nightfall) {
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
        const bo = i !== ORDER.dawn || !ready(blue) ? 0 : s.scene.id === "desk-lamp" ? (s.scene.kind === "fade" ? clamp01(s.scene.mix) : 0) : 1;
        put(room, bo < 1, 1, X, Y, kk, nearRoom);
        put(blue, bo > 0, bo, X, Y, kk, nearBlue);
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
