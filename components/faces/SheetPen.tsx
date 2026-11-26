"use client";

/**
 * THE LINE IS THE PEN (delight 6). In the night-desk prep beats (q1..q3) the Line's leading point
 * carries a small brass nib, and the nib writes each likely question onto the sheet.
 *
 * This file holds the pieces that are not the question markup itself (SheetFace's TypedQuestion):
 * - `writePlan` / `writeAt`: the hand. A question's glyph boxes become a timeline in "writing
 *   seconds" (22ms a character, 180ms after punctuation, a lift and carriage return between
 *   visual lines); `writeAt(plan, t)` says where the nib and the Line's leading point are at t.
 * - `penPhase`: the scroll. Beat progress -> travel (the Line brings the nib from the last rule),
 *   write (scrubbed), settle (the Line becomes the row's rule, the nib sinks back into it).
 * - `<PenNib />`: the nib, one fixed SVG at the Line's level, portalled to <body>, aria-hidden.
 *   It is placed from the store's own line (`state.line`, x1/y), the very point the Line draws,
 *   so the nib never leaves the Line's tip. Only its transform and the lamp glint's opacity are
 *   written, and only when they change. Never mounted under reduced motion.
 *
 * The Line itself (components/world/Line.tsx) is not touched: the question's anchor (sheet-qN)
 * is drawn from the plan, so the Line follows the pen as it always followed the caret.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { story, type StoryState } from "@/lib/story";

/* ───────────────────────────────────────────── the hand ── */

export type Glyph = { l: number; t: number; w: number; h: number };
export type PlanLine = {
  /** First glyph index, and one past the last. */
  a: number;
  b: number;
  left: number;
  right: number;
  /** The Line's y under this visual line (body px). */
  ul: number;
  /** Carriage return into this line (writing seconds); equal for the first line. */
  r0: number;
  r1: number;
};
export type Plan = { starts: number[]; ends: number[]; glyphs: Glyph[]; lines: PlanLine[]; total: number };

const CHAR = 0.022;
const PAUSE = 0.18;
const RETURN = 0.2;
/** A glyph inks in over this much writing time (a little over one character: a soft front). */
export const INK = 0.032;
/** The Line under the line being written: this far below the glyphs' content box. */
const UNDER = 1.5;
/** The short stub the Line keeps behind the nib when nothing is written on its line yet. */
const STUB = 8;

export function writePlan(text: string, glyphs: Glyph[]): Plan {
  const starts: number[] = [];
  const ends: number[] = [];
  const lines: PlanLine[] = [];
  let t = 0;
  let line: PlanLine | null = null;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (!line || Math.abs(g.t - glyphs[line.a].t) > 2) {
      const r0 = t;
      if (line) t += RETURN;
      line = { a: i, b: i + 1, left: g.l, right: g.l + g.w, ul: g.t + g.h + UNDER, r0, r1: t };
      lines.push(line);
    }
    // A space that ends a visual line adds no ink and no width to it.
    const space = text[i] === " ";
    if (!(space && i + 1 < glyphs.length && Math.abs(glyphs[i + 1].t - g.t) > 2)) {
      line.b = i + 1;
      if (!space) line.right = Math.max(line.right, g.l + g.w);
    }
    starts.push(t);
    ends.push(t + CHAR);
    t += /[,.?:;!]/.test(text[i]) ? PAUSE : CHAR;
  }
  return { starts, ends, glyphs, lines, total: t + 0.03 };
}

export type Pen = {
  /** The nib's point (body px). */
  x: number;
  y: number;
  /** Where the Line's underline starts (body px). */
  left: number;
  /** 0..1: the nib is off the paper (between lines). */
  lift: number;
};

const ease = (u: number) => u * u * (3 - 2 * u);

export function writeAt(plan: Plan, t: number, out: Pen): Pen {
  const { lines, glyphs, starts, ends } = plan;
  out.lift = 0;
  if (!lines.length) return out;
  let k = 0;
  while (k + 1 < lines.length && t >= lines[k + 1].r0) k++;
  const L = lines[k];
  if (k > 0 && t < L.r1) {
    // Lifted, back to the start of the next line: the Line slides down and in under the nib.
    const P = lines[k - 1];
    const r = (t - L.r0) / (L.r1 - L.r0);
    const u = ease(r);
    // Down first, then back along the new line: a return, not a diagonal slide through the text.
    const v = ease(Math.min(1, r * 1.7));
    out.x = P.right + (L.left - P.right) * u;
    out.y = P.ul + (L.ul - P.ul) * v;
    out.left = P.left + (L.left - STUB - P.left) * u;
    out.lift = Math.sin(Math.PI * Math.min(1, (t - L.r0) / (L.r1 - L.r0)));
    return out;
  }
  let x = L.left;
  for (let j = L.a; j < L.b; j++) {
    if (t <= starts[j]) break;
    const g = glyphs[j];
    x = g.l + g.w * Math.min(1, (t - starts[j]) / (ends[j] - starts[j]));
  }
  out.x = Math.min(x, Math.max(L.right, L.left));
  out.y = L.ul;
  out.left = Math.min(L.left, out.x - STUB);
  return out;
}

/* ───────────────────────────────────────────── the scroll ── */

/** Beat progress: the Line travels (story.ts LINE_TRACK, 0..0.2), the pen writes, then settles. */
export const WRITE_FROM = 0.2;
export const WRITE_TO = 0.82;
export const SETTLE_TO = 0.94;
/** The nib grows out of the Line's tip over the first part of the travel. */
const EMERGE_TO = 0.07;

export type Phase =
  | { kind: "blank" }
  | { kind: "travel"; u: number }
  | { kind: "write"; w: number }
  | { kind: "settle"; u: number }
  | { kind: "done" };

export function penPhase(mine: number, here: number, p: number): Phase {
  if (here < mine) return { kind: "blank" };
  if (here > mine || p >= SETTLE_TO) return { kind: "done" };
  if (p < WRITE_FROM) return { kind: "travel", u: p / WRITE_FROM };
  if (p < WRITE_TO) return { kind: "write", w: (p - WRITE_FROM) / (WRITE_TO - WRITE_FROM) };
  return { kind: "settle", u: (p - WRITE_TO) / (SETTLE_TO - WRITE_TO) };
}

/** The nib's size for a phase: grows out of the Line, writes at 1, sinks back into the Line. */
export function nibScale(ph: Phase, p: number): number {
  if (ph.kind === "travel") return ease(Math.min(1, p / EMERGE_TO));
  if (ph.kind === "write") return 1;
  if (ph.kind === "settle") return 1 - ease(ph.u);
  return 0;
}

/* ───────────────────────────────────────────── the nib ── */

/** Nib units are SVG px; the tip is at (0, 0) and the nib points down. */
const BOX = { x: -9, y: -37, w: 18, h: 39 };
/** The nib's size against the 18px question type: about 25px from section to tip. */
const NIB = 0.86;
/** Held in a right hand: the barrel leans right of vertical. */
const LEAN = 34;
let nibEl: SVGSVGElement | null = null;
let glintEl: SVGGElement | null = null;
const last = { tr: "", op: "", gl: "" };

/**
 * Place the nib at the Line's leading point. `scale` 0 hides it. `size` is the sheet's screen
 * scale times the nib's size on this screen; `lift` raises it off the paper between lines.
 * Writes only what changed.
 */
export function placeNib(s: Readonly<StoryState>, scale: number, size: number, lift: number, wiggle: number) {
  const el = nibEl;
  if (!el) return;
  const show = scale > 0.004;
  const op = show ? "1" : "0";
  if (op !== last.op) el.style.opacity = last.op = op;
  if (!show) return;
  const k = scale * size * NIB;
  const x = s.line.x1;
  const y = s.line.y - Math.max(0.75, s.line.weight / 2);
  // A pen leaves the paper up and back toward the hand, tilting a little more upright.
  const dx = lift * 2.2 * size;
  const dy = -lift * 5.5 * size;
  const rot = LEAN - lift * 7 + wiggle;
  const tr = `translate3d(${(x + dx + BOX.x).toFixed(1)}px,${(y + dy + BOX.y).toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg) scale(${k.toFixed(3)})`;
  if (tr !== last.tr) el.style.transform = last.tr = tr;
  // The lamp stands up and to the left of the sheet: the shoulder catches it most near the left
  // margin and when the pen is lifted toward it.
  const a = s.actor;
  const across = a.w > 0 ? Math.min(1, Math.max(0, (x - a.x) / a.w)) : 0.5;
  const gl = (Math.round(Math.min(1, 0.45 + 0.45 * (1 - across) + 0.35 * lift) * 20) / 20).toFixed(2);
  if (glintEl && gl !== last.gl) glintEl.style.opacity = last.gl = gl;
}

export function hideNib() {
  if (nibEl && last.op !== "0") nibEl.style.opacity = last.op = "0";
}

/**
 * The nib, drawn in tokens: a brass fountain-pen nib (lamp on its lit half, ochre in shade), its
 * slit and breather hole in deep pine, the dark section of the pen just showing above it, and a
 * thin paper-light glint along the lit shoulder. No outline cartoon, no barrel.
 */
export function PenNib() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const glint = useRef<SVGGElement>(null);
  useEffect(() => {
    if (story.reduced()) return;
    setHost(document.body);
  }, []);
  useEffect(() => {
    if (!host) return;
    nibEl = svg.current;
    glintEl = glint.current;
    last.tr = last.op = last.gl = "";
    return () => {
      nibEl = null;
      glintEl = null;
    };
  }, [host]);
  if (!host) return null;
  return createPortal(
    <svg
      ref={svg}
      className="shx-nib only-motion"
      aria-hidden="true"
      focusable="false"
      width={BOX.w}
      height={BOX.h}
      viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`}
      style={{ opacity: 0, transformOrigin: `${-BOX.x}px ${-BOX.y}px` }}
    >
      {/* the pen's section, just showing */}
      <path className="shx-nib-section" d="M-6.6 -36.4 H6.6 V-30.2 Q6.6 -29.2 5.8 -29.2 H-5.8 Q-6.6 -29.2 -6.6 -30.2 Z" />
      {/* the nib: lit half, shaded half */}
      <path className="shx-nib-lit" d="M0 0 C-1.1 -4 -3.5 -11.6 -6 -18.6 C-7.1 -21.8 -7 -25.8 -5.7 -29.4 H0 Z" />
      <path className="shx-nib-shade" d="M0 0 C1.1 -4 3.5 -11.6 6 -18.6 C7.1 -21.8 7 -25.8 5.7 -29.4 H0 Z" />
      <path className="shx-nib-edge" d="M0 0 C-1.1 -4 -3.5 -11.6 -6 -18.6 C-7.1 -21.8 -7 -25.8 -5.7 -29.4 H5.7 C7 -25.8 7.1 -21.8 6 -18.6 C3.5 -11.6 1.1 -4 0 0 Z" />
      {/* the engraved shoulder line, the slit and the breather hole */}
      <path className="shx-nib-cut" d="M-4.2 -24.6 Q0 -26.4 4.2 -24.6" />
      <path className="shx-nib-slit" d="M0 -0.4 V-15.2" />
      <circle className="shx-nib-hole" cx="0" cy="-16.7" r="1.25" />
      {/* the lamp, caught on the lit shoulder */}
      <g ref={glint} className="shx-nib-glint">
        <path d="M-5.2 -27.6 C-5.9 -24.6 -5.7 -21.6 -4.7 -18.6" />
        <circle cx="-3.4" cy="-21.2" r="0.55" />
      </g>
    </svg>,
    host,
  );
}
