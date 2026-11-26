"use client";

/**
 * SCENE DIRECTOR — moves the painted layers from the story store. Transforms and opacity
 * only; no layout is read in the frame loop (the cover boxes are computed from the viewport
 * size, which is read on resize).
 *
 *   hero        desk-night at rest. Then the store's `push` (state.scene) drives the camera at the window:
 *               the room scales about the window's centre until the glass fills the screen,
 *               (its own painted frame flying past) and only then gives way to the meadow.
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
import { BEATS, clamp01, story, type BeatId, type StoryState } from "@/lib/story";
import { worldBus } from "./bus";
import { DESK, DESK_CLOSE, FOCUS, HERO_SMALL, HOTSPOTS, WINDOW_SKY, coverBox, type HotspotId } from "./sceneGeometry";

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

type Box = { x: number; y: number; w: number; h: number };
type Put = { el: HTMLElement | null; t: string; o: string; v: string };
const slot = (el: HTMLElement | null): Put => ({ el, t: "", o: "", v: "?" });

function put(p: Put, visible: boolean, opacity = 1, tx = 0, ty = 0, k = 1) {
  const el = p.el;
  if (!el) return;
  const v = visible && opacity > 0.004 ? "visible" : "hidden";
  // Hidden layers leave the render tree entirely (display, not visibility), so the GPU lets go of
  // their tiles: several full-screen paintings kept as invisible composited layers starved the
  // visible one of tile memory and it dropped out in blocks (seen as flicker on the hero).
  if (v !== p.v) {
    el.style.visibility = v;
    el.style.display = v === "hidden" ? "none" : "";
    p.v = v;
  }
  if (v === "hidden") return;
  const o = opacity >= 0.996 ? "1" : opacity.toFixed(3);
  if (o !== p.o) el.style.opacity = p.o = o;
  const t = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${k.toFixed(5)})`;
  if (t !== p.t) el.style.transform = p.t = t;
}

/** The translation that puts box-point q at screen point `to` when the box is scaled by k (origin 0 0). */
/** Wrappers are switched with display, so a visible child can never outvote a hidden parent. */
function shown(p: Put, on: boolean) {
  const v = on ? "block" : "none";
  if (p.el && v !== p.v) p.el.style.display = p.v = v;
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
    let lastKey = "";

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
      if (key === lastKey) return;
      lastKey = key;

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
        // The store says how far through the window we are (SCENE_TRACK.hero, a "push").
        const sc = s.scene;
        const p = io(sc.id !== "desk-night" ? 1 : sc.kind === "push" ? clamp01(sc.mix) : 0);
        // The camera goes for the clear opening between the casements until it fills the screen;
        // only then, with nothing of the room left in frame, does the room give way to the meadow.
        const sx0 = roomBox.w / DESK.w;
        const skyW = (WINDOW_SKY.x1 - WINDOW_SKY.x0) * sx0;
        const skyH = (WINDOW_SKY.y1 - WINDOW_SKY.y0) * sx0;
        const qx = ((WINDOW_SKY.x0 + WINDOW_SKY.x1) / 2) * sx0;
        const qy = ((WINDOW_SKY.y0 + WINDOW_SKY.y1) / 2) * sx0;
        const S = Math.max(vw / skyW, stageH / skyH) * 1.12;
        // At rest the room is at cover; on small screens it stands smaller on the bottom edge.
        const k0 = small ? HERO_SMALL.scale : 1;
        const restX = small ? Math.min(0, Math.max(vw - k0 * roomBox.w, HERO_SMALL.laptopAt * vw - k0 * 0.704 * roomBox.w)) + k0 * qx : roomBox.x + qx;
        const restY = small ? stageH - k0 * roomBox.h + k0 * qy : roomBox.y + qy;
        const kk = k0 * Math.pow(S / k0, p);
        // The room itself never follows the pointer: sub-pixel moves of a detailed painting (and the
        // live list on the laptop) shimmer and read as flicker. Only the fireflies lean (scene.px/py).
        const toX = mix(restX, cx, p);
        const toY = mix(restY, cy, p);
        const ro = 1 - ss(0.8, 0.98, p);
        const RX = tx(roomBox, qx, toX, kk);
        const RY = ty(roomBox, qy, toY, kk);
        put(room, true, ro, RX, RY, kk);
        const mk = mix(1.16, 1, p);
        put(meadow, p > 0.5, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk);
        put(blue, false);
        // Small screens: the wall above the smaller room is the wash, so it stays until the room covers.
        put(washN, true, mix(1, 0.5, small ? ss(0.62, 0.95, p) : ss(0.15, 0.7, p)));
        // Fireflies: inside the glass while the room is there, everywhere once it has gone.
        const sx = sx0;
        const open = ss(0.7, 0.96, p);
        scene.x0 = mix(roomBox.x + RX + kk * WINDOW_SKY.x0 * sx, -200, open);
        scene.y0 = mix(roomBox.y + RY + kk * WINDOW_SKY.y0 * sx, -200, open);
        scene.x1 = mix(roomBox.x + RX + kk * WINDOW_SKY.x1 * sx, vw + 200, open);
        scene.y1 = mix(roomBox.y + RY + kk * WINDOW_SKY.y1 * sx, vh + 200, open);
        scene.field = 1;
        scene.px = -par.x * 26 * (1 - p);
        scene.py = -par.y * 16 * (1 - p);
        scene.push = p;
        shown(grassWrap, p > 0.8);
        put(grass, true, 1, 0, mix(GRASS_OFF, GRASS_LOW + 0.05, ss(0.8, 1, p)) * stageH, 1);
      } else if (i <= ORDER.daybreak) {
        const u = s.scene.id === "meadow-night" ? s.scene.progress : 1;
        const mk = 1 + 0.06 * u;
        put(room, false);
        put(blue, false);
        put(meadow, true, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk);
        put(washN, true, i >= ORDER.ranked ? mix(0.5, 0.78, i === ORDER.ranked ? ss(0, 0.5, bp) : 1) : 0.5);
        scene.field = 1;
        scene.push = 1;
        const g = i === ORDER.pass1 ? mix(0.8, 1, ss(0, 0.3, bp)) : i === ORDER.daybreak ? 1 - ss(0, 0.2, bp) : 1;
        shown(grassWrap, g > 0);
        put(grass, true, i === ORDER.daybreak ? g : 1, 0, (mix(GRASS_LOW + 0.05, GRASS_LOW, Math.min(1, (g - 0.8) * 5)) - u * 0.02) * stageH, 1);
      } else if (i < ORDER.nightfall) {
        shown(grassWrap, false);
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
        const bo = i !== ORDER.dawn ? 0 : s.scene.id === "desk-lamp" ? (s.scene.kind === "fade" ? clamp01(s.scene.mix) : 0) : 1;
        put(room, bo < 1, 1, X, Y, kk);
        put(blue, bo > 0, bo, X, Y, kk);
        put(meadow, false);
        put(washN, true, mix(0.82, 0.5, back));
        shown(grassWrap, false);
      }

      /* ── Act IV: dawn below the Line, then the whole room ── */
      const mode = i >= ORDER.dawn ? (s.line.daySide === "below" ? "split" : s.chapter === "day" ? "day" : "off") : "off";
      if (dawnWrap && mode !== dawnMode) {
        dawnWrap.dataset.mode = dawnMode = mode;
        dawnWrap.style.display = mode === "off" ? "none" : "block";
      }
      if (mode !== "off") {
        const sp = i === ORDER.dawn ? ss(0.15, 1, bp) * 0.6 : i === ORDER.seat ? 0.6 + 0.4 * ss(0, 0.5, bp) : 1;
        put(sun, sp < 1, Math.sin(Math.PI * sp) * 0.34, mix(vw * 0.02, vw * 0.4, sp), -stageH * 0.1, 1);
        put(washD, true, 1);
        // Above and below the Line it is one camera: the dawn room pulls back with the blue one.
        if (i === ORDER.dawn) put(dawn, true, 1, camX, camY, camK);
        else put(dawn, true, 1, 0, 0, 1);
        if (i > ORDER.dawn) {
          const g = i === ORDER.seat ? ss(0.15, 0.7, bp) : 1;
          shown(grassWrap, g > 0);
          put(grass, true, 1, 0, mix(GRASS_OFF, GRASS_SEAT, g) * stageH, 1);
        }
      }
    };

    offs.push(story.frame("actor", frameFn));

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      offs.forEach((off) => off());
    };
  }, []);
  return null;
}
