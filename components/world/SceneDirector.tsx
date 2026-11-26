"use client";

/**
 * SCENE DIRECTOR — moves the painted layers from the story store. Transforms and opacity
 * only; no layout is read in the frame loop (the cover boxes are computed from the viewport
 * size, which is read on resize).
 *
 *   hero        desk-night at rest. From 16% of the beat the camera pushes at the window:
 *               the room scales about the window's centre until the glass fills the screen,
 *               fades, and the meadow is there. The window-frame layer flies past on the way.
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
import { DESK, DESK_CLOSE, FOCUS, HOTSPOTS, coverBox, type HotspotId } from "./sceneGeometry";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const io = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Hero progress at which the push through the window starts. */
export const PUSH_FROM = 0.16;

type Box = { x: number; y: number; w: number; h: number };
type Put = { el: HTMLElement | null; t: string; o: string; v: string };
const slot = (el: HTMLElement | null): Put => ({ el, t: "", o: "", v: "" });

function put(p: Put, visible: boolean, opacity = 1, tx = 0, ty = 0, k = 1) {
  const el = p.el;
  if (!el) return;
  const v = visible && opacity > 0.004 ? "visible" : "hidden";
  if (v !== p.v) el.style.visibility = p.v = v;
  if (v === "hidden") return;
  const o = opacity >= 0.996 ? "1" : opacity.toFixed(3);
  if (o !== p.o) el.style.opacity = p.o = o;
  const t = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${k.toFixed(5)})`;
  if (t !== p.t) el.style.transform = p.t = t;
}

/** The translation that puts box-point q at screen point `to` when the box is scaled by k (origin 0 0). */
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
    const frame = slot(q(".sc-frame"));
    const washN = slot(q(".sc-wash-night"));
    const washD = slot(q(".sc-wash-day"));
    const sun = slot(q(".sc-sun"));
    const grassWrap = slot(q(".sc-grasswrap"));
    const grass = slot(q(".sc-grass"));
    const dawnWrap = q<HTMLElement>(".sc-dawnwrap");
    let dawnMode = "";
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

    const win = HOTSPOTS["window-view"];
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

      const key = `${s.pos.toFixed(3)}|${s.line.daySide}|${s.chapter}|${par.x.toFixed(4)}|${par.y.toFixed(4)}`;
      if (key === lastKey) return;
      lastKey = key;

      const cx = vw / 2;
      const cy = stageH / 2;
      const scene = worldBus.scene;
      scene.x0 = scene.y0 = -1e5;
      scene.x1 = scene.y1 = 1e5;
      scene.field = 0;
      scene.px = scene.py = 0;

      /* the window's glass in the room's own box */
      const wx = ((win.x0 + win.x1) / 2 / DESK.w) * roomBox.w;
      const wy = ((win.y0 + win.y1) / 2 / DESK.h) * roomBox.h;
      const ww = ((win.x1 - win.x0) / DESK.w) * roomBox.w;
      const wh = ((win.y1 - win.y0) / DESK.h) * roomBox.h;

      const nightOn = i <= ORDER.daybreak || (i >= ORDER.nightfall && i <= ORDER.dawn);
      put(night, nightOn);

      /* ── Act I ── */
      if (i === ORDER.hero) {
        const p = io(ss(PUSH_FROM, 1, bp));
        const S = Math.max(vw / ww, stageH / wh) * 1.14;
        const kk = Math.pow(S, p);
        const toX = mix(roomBox.x + wx, cx, p) - par.x * 12 * (1 - p);
        const toY = mix(roomBox.y + wy, cy, p) - par.y * 8 * (1 - p);
        const ro = 1 - ss(0.58, 0.9, p);
        put(room, true, ro, tx(roomBox, wx, toX, kk), ty(roomBox, wy, toY, kk), kk);
        const mk = mix(1.2, 1, p);
        put(meadow, p > 0.3, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk);
        const fk = mix(1, 3.6, Math.pow(ss(0.4, 1, p), 2));
        put(frame, p > 0.4, ss(0.4, 0.6, p) * (1 - ss(0.86, 1, p)), tx(roomBox, cx - roomBox.x, cx, fk), ty(roomBox, cy - roomBox.y, cy, fk), fk);
        put(blue, false);
        put(washN, true, mix(1, 0.5, ss(0.2, 0.9, p)));
        // Fireflies: inside the glass while the room is there, everywhere once it has gone.
        const gx = toX - (ww / 2) * kk;
        const gy = toY - (wh / 2) * kk;
        const open = 1 - ro;
        scene.x0 = mix(gx, -200, open);
        scene.y0 = mix(gy, -200, open);
        scene.x1 = mix(gx + ww * kk, vw + 200, open);
        scene.y1 = mix(gy + wh * kk, vh + 200, open);
        scene.field = 1;
        scene.px = -par.x * 26 * (1 - p);
        scene.py = -par.y * 16 * (1 - p);
        scene.push = p;
        put(grassWrap, p > 0.7);
        put(grass, true, 1, 0, (1 - ss(0.7, 1, p) * 0.8) * stageH * 0.34, 1);
      } else if (i <= ORDER.daybreak) {
        const u = clamp01((s.pos - beatAt.pass1) / (beatAt.daybreak - beatAt.pass1 || 1));
        const mk = 1 + 0.06 * u;
        put(room, false);
        put(frame, false);
        put(blue, false);
        put(meadow, true, 1, tx(meadowBox, cx - meadowBox.x, cx, mk), ty(meadowBox, cy - meadowBox.y, cy, mk), mk);
        put(washN, true, i >= ORDER.ranked ? mix(0.5, 0.78, i === ORDER.ranked ? ss(0, 0.5, bp) : 1) : 0.5);
        scene.field = 1;
        scene.push = 1;
        const g = i === ORDER.pass1 ? mix(0.8, 1, ss(0, 0.3, bp)) : i === ORDER.daybreak ? 1 - ss(0, 0.2, bp) : 1;
        put(grassWrap, g > 0);
        put(grass, true, i === ORDER.daybreak ? g : 1, 0, (1 - Math.min(1, g)) * stageH * 0.34 - u * stageH * 0.03, 1);
      } else if (i < ORDER.nightfall) {
        put(grassWrap, false);
      } else if (i <= ORDER.dawn) {
        /* ── Act III: close on the desk; at dawn the camera pulls back and the hour turns blue ── */
        const c = small ? DESK_CLOSE.small : DESK_CLOSE.wide;
        const u = clamp01((s.pos - beatAt.unfold) / (beatAt.dawn - beatAt.unfold || 1));
        const back = i === ORDER.dawn ? ss(0, 0.6, bp) : 0;
        const kk = Math.pow(c.scale * (1 + 0.04 * u), 1 - back);
        const qx = c.at[0] * roomBox.w;
        const qy = c.at[1] * roomBox.h;
        const toX = mix(c.to[0] * vw, roomBox.x + qx, back);
        const toY = mix(c.to[1] * stageH, roomBox.y + qy, back);
        const X = tx(roomBox, qx, toX, kk);
        const Y = ty(roomBox, qy, toY, kk);
        const bo = i === ORDER.dawn ? ss(0.02, 0.32, bp) : 0;
        put(room, bo < 1, 1, X, Y, kk);
        put(blue, bo > 0, bo, X, Y, kk);
        put(meadow, false);
        put(frame, false);
        put(washN, true, mix(0.82, 0.5, back));
        put(grassWrap, false);
      }

      /* ── Act IV: dawn below the Line, then the whole room ── */
      const mode = i >= ORDER.dawn ? (s.line.daySide === "below" ? "split" : s.chapter === "day" ? "day" : "off") : "off";
      if (dawnWrap && mode !== dawnMode) dawnWrap.dataset.mode = dawnMode = mode;
      if (mode !== "off") {
        const sp = i === ORDER.dawn ? ss(0.15, 1, bp) * 0.6 : i === ORDER.seat ? 0.6 + 0.4 * ss(0, 0.5, bp) : 1;
        put(sun, sp < 1, Math.sin(Math.PI * sp) * 0.34, mix(vw * 0.02, vw * 0.4, sp), -stageH * 0.1, 1);
        put(washD, true, 1);
        if (i > ORDER.dawn) {
          const g = i === ORDER.seat ? ss(0.15, 0.7, bp) : 1;
          put(grassWrap, g > 0);
          put(grass, true, 1, 0, (1 - g * 0.7) * stageH * 0.34, 1);
        }
      }
    };

    const beatAt = Object.fromEntries(BEATS.map((b) => [b.id, 0])) as Record<BeatId, number>;
    {
      let at = 0;
      for (const b of BEATS) {
        beatAt[b.id] = at;
        at += b.vh;
      }
    }
    offs.push(story.frame("actor", frameFn));

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      offs.forEach((off) => off());
    };
  }, []);
  return null;
}
