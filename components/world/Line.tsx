"use client";

/**
 * THE LINE — the page's single gold instrument, and its only transition.
 *
 * A fixed inline SVG that draws story.get().line every frame: one path (with a
 * soft twin under it for glow where the canvas cannot reach, over cards and
 * paper), and the mono label naming what the line is doing.
 *
 * - Hero and seat: at rest under "ready." it is a hand-drawn stroke. It
 *   straightens as it stretches and curls back when it docks: the bookend.
 * - It is a string: within 80px a fine pointer bends it up to 6px toward the
 *   cursor, crossing it plucks it, and it rings out on a spring (about 0.5s).
 *   Off while it sweeps fast, on touch, and on small screens.
 * - Gold on the night side, accent amber on day and on paper.
 * - The label rides the right end while the line is wide or moving, and steps
 *   back once the line has docked on something small.
 *
 * Reduced motion: never mounts. The static rule under "ready." is CSS (index.tsx).
 */

import { useEffect, useRef } from "react";
import { clamp01, story, type StoryState } from "@/lib/story";

const GOLD = "#ffd77a";
const AMBER = "#b45309";
const f = (n: number) => n.toFixed(1);

export function Line() {
  const svg = useRef<SVGSVGElement>(null);
  const core = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (story.reduced()) return;
    const born = performance.now();
    const spring = { v: 0, x: 0, cx: 0, lastDy: 0, had: false };
    const last = { d: "", w: "", color: "", label: "", lt: "", lo: "", vis: "", go: "" };
    let labelO = 0;
    let labelW = 0;
    let rest = 0; // seconds the line has been still
    let px0 = 0;
    let px1 = 0;
    let py = 0;
    let draw = 0; // the load: the underline draws left to right

    const frame = (_t: number, dt: number, s: Readonly<StoryState>) => {
      const path = core.current;
      const soft = glow.current;
      const tag = label.current;
      const root = svg.current;
      if (!path || !soft || !tag || !root) return;
      const line = s.line;
      const vw = s.viewport.w;
      const vh = s.viewport.h;
      if (!vw) return;

      // Load: wait for the headline, then draw (0.7s, power3.inOut). Any scroll finishes it.
      if (draw < 1) {
        const t = s.pos > 0.5 ? 1 : clamp01((performance.now() - born - 650) / 700);
        draw = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }
      const x0 = line.x0;
      const x1 = x0 + (line.x1 - x0) * draw;
      const y = line.y;
      const len = x1 - x0;
      const wide = x0 <= 1 && x1 >= vw - 1; // full-bleed: at large, not docked on anything

      // Hand-drawn at rest under "ready.": hero start and seat end.
      let hand = 0;
      if (s.beat === "hero") hand = 1 - clamp01(s.beatProgress / 0.2);
      else if (s.beat === "seat") hand = clamp01((s.beatProgress - 0.22) / 0.08);
      else if (s.beat === "footer") hand = 1;

      /* the string */
      const moved = Math.abs(y - py) + Math.abs(x0 - px0) + Math.abs(x1 - px1);
      const speed = dt > 0 ? moved / dt : 0;
      rest = moved < 0.05 ? rest + dt : 0;
      px0 = x0;
      px1 = x1;
      py = y;
      const p = s.pointer;
      let target = 0;
      const playable = p.fine && p.inside && !s.flags.small && speed < 900 && len > 60 && draw >= 1;
      if (playable && p.x > x0 - 20 && p.x < x1 + 20) {
        const dy = p.y - y;
        const ad = Math.abs(dy);
        if (ad < 80) {
          // Zero on the line itself, 6px at about 20px away, easing out to nothing at 80px.
          const shape = ad < 20 ? ad / 20 : 1 - (ad - 20) / 60;
          target = Math.sign(dy) * 6 * shape * shape * (3 - 2 * shape);
          spring.cx = Math.min(x1, Math.max(x0, p.x));
          // Crossing the line plucks it.
          if (spring.had && Math.sign(dy) !== Math.sign(spring.lastDy) && spring.lastDy !== 0) {
            spring.v += Math.max(-260, Math.min(260, ((dy - spring.lastDy) / Math.max(dt, 0.008)) * 0.35));
          }
        }
        spring.lastDy = dy;
        spring.had = true;
      } else spring.had = false;
      // Underdamped: it rings a little, then settles (about half a second).
      const steps = Math.max(1, Math.ceil(dt / 0.008));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        spring.v += (-380 * (spring.x - target) - 15 * spring.v) * h;
        spring.x += spring.v * h;
      }
      if (Math.abs(spring.x) < 0.02 && Math.abs(spring.v) < 0.5 && target === 0) spring.x = spring.v = 0;
      const bend = Math.max(-9, Math.min(9, spring.x));

      /* path */
      let d: string;
      if (len < 0.5) d = "";
      else if (Math.abs(bend) > 0.02) {
        const cx = Math.min(x1 - 1, Math.max(x0 + 1, spring.cx));
        const hl = Math.min(140, (cx - x0) * 0.5);
        const hr = Math.min(140, (x1 - cx) * 0.5);
        const yb = y + bend;
        d = `M${f(x0)} ${f(y)}C${f(x0 + (cx - x0) * 0.55)} ${f(y)} ${f(cx - hl)} ${f(yb)} ${f(cx)} ${f(yb)}C${f(cx + hr)} ${f(yb)} ${f(x1 - (x1 - cx) * 0.55)} ${f(y)} ${f(x1)} ${f(y)}`;
      } else if (hand > 0.01) {
        const a = Math.min(4, len * 0.016) * hand;
        d = `M${f(x0)} ${f(y + a * 0.5)}C${f(x0 + len * 0.28)} ${f(y - a * 1.1)} ${f(x0 + len * 0.62)} ${f(y + a * 1.2)} ${f(x1)} ${f(y - a * 0.7)}`;
      } else d = `M${f(x0)} ${f(y)}L${f(x1)} ${f(y)}`;
      if (d !== last.d) {
        last.d = d;
        path.setAttribute("d", d);
        soft.setAttribute("d", d);
      }
      const w = Math.max(1, line.weight).toFixed(2);
      if (w !== last.w) {
        last.w = w;
        path.style.strokeWidth = `${w}px`;
        soft.style.strokeWidth = `${(Number(w) + 7).toFixed(1)}px`;
      }

      /* colour: gold at night, amber on day and on paper */
      const a = s.actor;
      const mid = (x0 + x1) / 2;
      const onPaper =
        (a.present || a.docked) && (a.face === "sheet" || a.face === "ticket") && mid > a.x && mid < a.x + a.w && y > a.y && y < a.y + a.h + 2;
      const night = s.chapter === "night" || line.sweep;
      const color = night && !onPaper ? GOLD : AMBER;
      if (color !== last.color) {
        last.color = color;
        root.style.color = color;
      }
      const go = color === GOLD ? "0.16" : "0";
      if (go !== last.go) soft.style.opacity = last.go = go;

      /* label */
      if (line.label !== last.label) {
        last.label = line.label;
        if (line.label) {
          tag.textContent = line.label;
          labelW = line.label.length * 7.5;
        }
      }
      const show = line.label !== "" && draw >= 1 && (wide || rest < 0.9);
      labelO += ((show ? 1 : 0) - labelO) * (1 - Math.exp(-(show ? 10 : 5) * dt));
      const lo = (labelO < 0.01 ? 0 : labelO).toFixed(2);
      if (lo !== last.lo) tag.style.opacity = last.lo = lo;
      if (labelO >= 0.01) {
        const above = y > 30;
        const ly = above ? y - 9 - 11 : y + 10;
        const lx = Math.max(12, Math.min(vw - 16, x1 - 14) - labelW);
        const lt = `translate3d(${f(lx)}px,${f(ly)}px,0)`;
        if (lt !== last.lt) tag.style.transform = last.lt = lt;
        // The label takes the colour of the ground it stands on.
        const labelDay = ly > s.dayTop || (!night && ly <= vh) || onPaper;
        tag.style.color = labelDay ? AMBER : GOLD;
      }
      const vis = len < 0.5 ? "hidden" : "visible";
      if (vis !== last.vis) root.style.visibility = last.vis = vis;
    };
    return story.frame("line", frame);
  }, []);

  return (
    <>
      <svg ref={svg} aria-hidden="true" data-line className="world-line only-motion" style={{ color: GOLD, visibility: "hidden" }}>
        <path ref={glow} fill="none" stroke="currentColor" strokeLinecap="round" style={{ opacity: 0.16 }} />
        <path ref={core} data-line-core fill="none" stroke="currentColor" strokeLinecap="round" />
      </svg>
      <div ref={label} aria-hidden="true" data-line-label className="world-line-label type-mono only-motion" style={{ opacity: 0 }} />
    </>
  );
}
