"use client";

/**
 * Package 2 runtime: small helpers shared by Act I (Read) and Act II (Board).
 *
 *   definePerformanceAt(beat, at, build)   a performance that starts at a point INSIDE its beat
 *   usePerformanceAt(beat, at, build, deps)
 *   useActorExtra(fn)                      add tilt / lift / settle to the flying Actor
 *   useScrub(fn)                           story.subscribe as an effect (write-only)
 *   offsetIn(el, root)                     layout position of el inside root, ignoring transforms
 *   cardShow, tileShow                     the state the card and tile faces draw from
 *
 * Why `definePerformanceAt`: lib/perform.ts plays a beat's timeline on beat entry.
 * Some of our performances must start when something scrubbed inside the beat
 * completes (the reason card counts when its travel ends at 35%; the tile carries
 * to Applied when the Actor's timed travel starts at 20%). The rules are the same
 * runner rules, measured at that point instead of at the beat boundary:
 *   cross the point forward (from this beat or the one before) → play from 0
 *   cross it forward in a jump from further back → end state, no replay
 *   go back above the point → reset
 *   leave the beat forward while playing → end state
 *   arrive from below (backward) → already in the end state
 *   reduced motion → end state, never played
 *
 * Why `useActorExtra`: the Actor engine owns the Actor's `transform`. Pointer tilt,
 * the anticipation lift and the landing settle are added through the individual CSS
 * properties `rotate` and `translate` on `.actor-flip` (they compose with the
 * engine's `transform`, which only ever writes a rotateY there during the dawn flip)
 * and through `--lift` / `--spec-*` custom properties that the faces read.
 * Contributions are summed; everything returns to rest when nobody contributes.
 */

import { useEffect, type DependencyList } from "react";
import { gsap } from "@/lib/gsap";
import { BEATS, story, type BeatId, type StoryState } from "@/lib/story";

/* ────────────────────────────────────────────── threshold performances ── */

const order = (id: BeatId) => BEATS.findIndex((b) => b.id === id);

export type PerformanceAtBuild = (tl: gsap.core.Timeline, ctx: { reduced: boolean; skipped: () => boolean }) => void;

export function definePerformanceAt(beat: BeatId, at: number, build: PerformanceAtBuild): () => void {
  if (typeof window === "undefined") return () => {};
  const reduced = story.reduced();
  let jumping = false;
  const tl = gsap.timeline({ paused: true });
  build(tl, { reduced, skipped: () => jumping });
  const jump = (to: 0 | 1) => {
    jumping = true;
    tl.pause().progress(to);
    jumping = false;
  };
  if (reduced) {
    jump(1);
    return () => tl.kill();
  }

  const mine = order(beat);
  const isPast = (s: Readonly<StoryState>) => {
    const o = order(s.beat);
    return o > mine || (o === mine && s.beatProgress >= at);
  };
  const s0 = story.get();
  let was = isPast(s0);
  let lastOrder = order(s0.beat);
  jump(was ? 1 : 0);

  const off = story.subscribe((s) => {
    const now = isPast(s);
    const o = order(s.beat);
    if (now && !was) {
      if (o === mine && lastOrder >= mine - 1) tl.play(0);
      else jump(1);
    } else if (!now && was) {
      jump(0);
    } else if (now && o > mine && tl.progress() < 1) {
      jump(1);
    }
    was = now;
    lastOrder = o;
  });
  return () => {
    off();
    tl.kill();
  };
}

export function usePerformanceAt(beat: BeatId, at: number, build: PerformanceAtBuild, deps: DependencyList = []) {
  useEffect(
    () => definePerformanceAt(beat, at, build),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beat, at, ...deps],
  );
}

/** story.subscribe as an effect. The callback is write-only (no layout reads). */
export function useScrub(fn: (s: Readonly<StoryState>) => void, deps: DependencyList = []) {
  useEffect(
    () => {
      if (story.reduced()) return;
      return story.subscribe(fn);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
}

/** Position of `el` inside `root` from the offset chain: transforms on either are ignored. */
export function offsetIn(el: HTMLElement, root: HTMLElement): { x: number; y: number; w: number; h: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Mask that keeps what is below viewport y, with a 24px soft edge (for copy the Line is wiping). */
export const softBelow = (y: number) => `linear-gradient(to bottom, transparent ${y.toFixed(1)}px, #000 ${(y + 24).toFixed(1)}px)`;
/** Mask that keeps what is above viewport y, with a 24px soft edge. */
export const softAbove = (y: number) => `linear-gradient(to bottom, #000 ${(y - 24).toFixed(1)}px, transparent ${y.toFixed(1)}px)`;
/**
 * Card → tile (the `saved` beat): the title block is handed over, not swapped. On the card it sits
 * right of the initials; on the tile, under them. While the Actor shrinks, the card's block slides
 * half-way toward the tile's place as it fades out, and the tile's block arrives from that same
 * point, so the eye follows one title down into the tile. Positions are the faces' own layout
 * constants (faces.css): card block at (86, 27) of 520x320, tile block at (11, 37) of 154x92.
 */
const CARD_ID = { x: 86, y: 27 };
const TILE_ID = { x: 11, y: 37 };
const smooth = (x: number) => x * x * (3 - 2 * x);
export function titleHandOver(s: Readonly<StoryState>, face: "card" | "tile"): string {
  const a = s.actor;
  if (s.beat !== "saved" || !a.present || a.docked || a.travel <= 0 || a.travel >= 1 || a.w <= 0 || a.h <= 0) return "";
  const sc = a.w / 520;
  const st = a.h / 92;
  const mx = (CARD_ID.x * sc + TILE_ID.x * st) / 2;
  // Vertically they meet just above the tile's own place (7 tile-units up), so the arriving title
  // never crosses the tile's top row (initials and score).
  const my = (TILE_ID.y - 7) * st;
  if (face === "card") {
    const k = smooth(span(a.travel, 0.28, 0.5));
    return k <= 0 ? "" : `translate3d(${(((mx - CARD_ID.x * sc) / sc) * k).toFixed(2)}px,${(((my - CARD_ID.y * sc) / sc) * k).toFixed(2)}px,0)`;
  }
  const k = 1 - smooth(span(a.travel, 0.5, 0.74));
  return k <= 0 ? "" : `translate3d(${(((mx - TILE_ID.x * st) / st) * k).toFixed(2)}px,${(((my - TILE_ID.y * st) / st) * k).toFixed(2)}px,0)`;
}

/** Write a mask-image (both spellings) only when it changes. */
export function setMask(el: HTMLElement, mask: string) {
  if (el.dataset.mask === mask) return;
  el.dataset.mask = mask;
  el.style.setProperty("-webkit-mask-image", mask);
  el.style.setProperty("mask-image", mask);
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Map v from [a, b] to [0, 1], clamped. */
export const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a || 1));

/* ──────────────────────────────────────────────────────── actor extras ── */

export type ActorExtra = {
  /** Tilt in degrees about the X and Y axes (pointer tilt). Sprung. */
  rx?: number;
  ry?: number;
  /** Vertical offset in px (anticipation lift, landing settle). Not sprung. */
  ty?: number;
  /** Shadow depth 0..1, combined with the engine's own travel lift. */
  lift?: number;
  /** Specular highlight: position in % of the face and strength 0..1. */
  specX?: number;
  specY?: number;
  spec?: number;
};
type Contributor = (s: Readonly<StoryState>) => ActorExtra | null;

const contributors = new Set<Contributor>();
let loopOff: (() => void) | null = null;
let flipEl: HTMLElement | null = null;
const spring = { rx: 0, ry: 0, vx: 0, vy: 0, spec: 0 };
const written = { rotate: "", translate: "", lift: "", sx: "", sy: "", sa: "" };

function actorFlip(): HTMLElement | null {
  if (flipEl && flipEl.isConnected) return flipEl;
  flipEl = document.querySelector<HTMLElement>(".actor .actor-flip");
  written.rotate = written.translate = written.lift = written.sx = written.sy = written.sa = "";
  return flipEl;
}

function write(el: HTMLElement, key: keyof typeof written, prop: string, value: string) {
  if (written[key] === value) return;
  written[key] = value;
  if (prop.startsWith("--")) {
    if (value) el.style.setProperty(prop, value);
    else el.style.removeProperty(prop);
  } else {
    (el.style as unknown as Record<string, string>)[prop] = value;
  }
}

function loop(_t: number, dt: number, s: Readonly<StoryState>) {
  const el = actorFlip();
  if (!el) return;
  let rx = 0;
  let ry = 0;
  let ty = 0;
  let lift = 0;
  let spec = 0;
  let specX = 50;
  let specY = 0;
  let any = false;
  contributors.forEach((fn) => {
    const e = fn(s);
    if (!e) return;
    any = true;
    rx += e.rx ?? 0;
    ry += e.ry ?? 0;
    ty += e.ty ?? 0;
    lift = Math.max(lift, e.lift ?? 0);
    if ((e.spec ?? 0) > spec) {
      spec = e.spec ?? 0;
      specX = e.specX ?? 50;
      specY = e.specY ?? 0;
    }
  });
  // While the line splits the Actor, both skins must stay flat and aligned.
  if (s.line.sweep) rx = ry = ty = spec = 0;

  // Spring 160 / 18 (storyboard 3), integrated in small steps.
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    spring.vx += (-160 * (spring.rx - rx) - 18 * spring.vx) * h;
    spring.vy += (-160 * (spring.ry - ry) - 18 * spring.vy) * h;
    spring.rx += spring.vx * h;
    spring.ry += spring.vy * h;
  }
  if (s.line.sweep) spring.rx = spring.ry = spring.vx = spring.vy = 0;
  spring.spec += (spec - spring.spec) * Math.min(1, dt * 10);

  const angle = Math.hypot(spring.rx, spring.ry);
  const engineLift = s.actor.travel > 0 && s.actor.travel < 1 ? Math.sin(Math.PI * s.actor.travel) : 0;
  const resting = !any && angle < 0.01 && spring.spec < 0.005;

  write(el, "rotate", "rotate", resting || angle < 0.01 ? "" : `${(spring.rx / angle).toFixed(4)} ${(spring.ry / angle).toFixed(4)} 0 ${angle.toFixed(3)}deg`);
  write(el, "translate", "translate", resting || Math.abs(ty) < 0.01 ? "" : `0 ${ty.toFixed(2)}px`);
  write(el, "lift", "--lift", resting || lift <= engineLift ? "" : lift.toFixed(3));
  write(el, "sx", "--spec-x", resting ? "" : `${specX.toFixed(1)}%`);
  write(el, "sy", "--spec-y", resting ? "" : `${specY.toFixed(1)}%`);
  write(el, "sa", "--spec-a", resting ? "" : spring.spec.toFixed(3));
}

/** Contribute tilt, lift or a highlight to the Actor while `fn` returns a value. */
export function useActorExtra(fn: Contributor, deps: DependencyList = []) {
  useEffect(
    () => {
      if (story.reduced()) return;
      contributors.add(fn);
      if (!loopOff) loopOff = story.frame("actor", loop);
      // The loop stays on once started: with no contributors it settles to rest and then writes nothing.
      return () => {
        contributors.delete(fn);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
}

/* ─────────────────────────────────────────────────────────── face state ── */

/**
 * What the card face shows. Written by the `reason` performance, read every
 * frame by every mounted CardFace (the Actor renders it twice, the dock once).
 * Server and reduced-motion markup show the end state; in motion mode these
 * start at zero and the performance fills them.
 */
export const cardShow = { score: 0, meter: 0, c0: 0, c1: 0, c2: 0, caret: 0, focus: -1 };
/** The end state, for markup that renders before any frame runs. */
export const CARD_FULL = { score: 9, meter: 0.9 };

/**
 * What the tile face shows. `applied` and `interview` go 0 → 1 in their beats'
 * performances (chip flips), `tick` draws the calendar tick, `settle` drives the
 * landing wobble. Each performance owns its own key, so jumps never fight.
 */
export const tileShow = { applied: 0, interview: 0, tick: 0 };
