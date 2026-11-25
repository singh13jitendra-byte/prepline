"use client";

/**
 * THE LINE — the page's single gold instrument, and its only transition.
 *
 * A fixed inline SVG that draws the line every frame: a gold stroke with a
 * white-hot core, and the mono label naming what the line is doing. Its light
 * (bloom, wake) is the canvas' job; without WebGL a soft additive twin stands in.
 *
 * What is drawn is the store's line (story.get().line) plus two things only the
 * World knows, published as worldBus.line for the canvas:
 * - Hero demonstration. 1.6s after load, and every 8s while the page sits idle
 *   at scroll 0, the underline reaches out to the right edge, and that reach
 *   steps down through a strip of the field (which it reads) and returns. Fine pointers with WebGL only; never
 *   under reduced motion; any scroll cancels it at once.
 * - Ranked hold. The line docks as the list rule only after the last of the
 *   twelve has landed, however fast the wheel gets there.
 *
 * Also
 * - Hero and seat: at rest under "ready." it is a hand-drawn stroke. It
 *   straightens as it stretches and curls back when it docks: the bookend.
 * - It is a string: within 80px a fine pointer bends it up to 6px toward the
 *   cursor, crossing it plucks it, and it rings out on a spring (about 0.5s).
 * - Gold on the night side, accent amber on day and on paper.
 * - The label is hidden once the line docks as a rule under copy (the store
 *   blanks it) and whenever the line is on paper. Otherwise it is placed where
 *   nothing else is: it tries four places around the line's end, rejects any
 *   that touches the Actor, the nav band, or text and controls (a throttled
 *   hit-test), and hides if none is free.
 *
 * Reduced motion: never mounts. The static rule under "ready." is CSS (index.tsx).
 */

import { useEffect, useRef } from "react";
import { anchorRect } from "@/lib/anchors";
import { clamp01, story, type StoryState } from "@/lib/story";
import { worldBus } from "./bus";

const GOLD = "#ffd77a";
const AMBER = "#b45309";
const f = (n: number) => n.toFixed(1);
const io = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The hero demonstration, seconds: first run after load, pause between runs, and its five phases. */
export const DEMO = { first: 1.6, every: 8, out: 0.5, down: 1.1, hold: 0.9, up: 0.9, back: 0.5 };
/** Beat progress at which LINE_TRACK.ranked starts its last move, onto the rule (lib/story.ts). */
const DOCK_FROM = 0.4;
/** Width of the S the stroke makes when it steps down during the demonstration. */
const STEP_W = 130;
const DEMO_TOTAL = DEMO.out + DEMO.down + DEMO.hold + DEMO.up + DEMO.back;

const CONTENT = "a,button,input,textarea,select,label,svg,img,h1,h2,h3,h4,p,span,strong,em,small,time,dt,dd,th,td";
/** The beat rail keeps a wide, empty hover area beside its ticks: the label may stand there, clear of the ticks. */
const RAIL = "nav[aria-label='Story']";
const RAIL_INSET = 44;
type Checkable = Element & { checkVisibility?: (o: { opacityProperty: boolean; visibilityProperty: boolean }) => boolean };
const VISIBLE = { opacityProperty: true, visibilityProperty: true };
/**
 * Is there visible text or a control at this point? Looks through the whole stack, because
 * faded-out panels still take hits. Fixed world layers and the Actor take none.
 */
function occupied(x: number, y: number): boolean {
  const stack = document.elementsFromPoint(x, y);
  for (let i = 0; i < stack.length && i < 14; i++) {
    const el = stack[i] as Checkable;
    let content = el.matches(CONTENT);
    for (let n = el.firstChild; n && !content; n = n.nextSibling) content = n.nodeType === 3 && Boolean(n.nodeValue && n.nodeValue.trim());
    if (content && !el.closest(RAIL) && (!el.checkVisibility || el.checkVisibility(VISIBLE))) return true;
  }
  return false;
}

function slotX(c: number, wide: boolean, x0: number, x1: number, vw: number, w: number) {
  if (wide) return c < 2 ? vw - RAIL_INSET - w : 16;
  return c < 2 ? x1 - w : c === 2 ? x0 - 12 - w : x1 + 12;
}
function slotY(c: number, wide: boolean, y: number) {
  if (wide || c < 2) return c % 2 === 0 ? y - 20 : y + 10;
  return y - 5.5;
}

export function Line() {
  const svg = useRef<SVGSVGElement>(null);
  const body = useRef<SVGPathElement>(null);
  const core = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (story.reduced()) return;
    const born = performance.now();
    const canDemo = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(max-width: 767px)").matches;
    const spring = { v: 0, x: 0, cx: 0, lastDy: 0, had: false };
    const last = { d: "", w: "", color: "", label: "", lt: "", lo: "", vis: "", go: "", co: "", lc: "" };
    const demo = { t: -1, nextAt: born + DEMO.first * 1000, pointerAt: 0, px: 0, py: 0 };
    const place = { slot: -1, want: -1, checkedAt: 0, free: [true, true, true, true] };
    let labelO = 0;
    let labelW = 0;
    let px0 = 0;
    let px1 = 0;
    let py = 0;
    let draw = 0; // the load: the underline draws left to right

    const frame = (_t: number, dt: number, s: Readonly<StoryState>) => {
      const path = body.current;
      const hot = core.current;
      const soft = glow.current;
      const tag = label.current;
      const root = svg.current;
      if (!path || !hot || !soft || !tag || !root) return;
      const vw = s.viewport.w;
      const vh = s.viewport.h;
      if (!vw) return;
      const now = performance.now();

      // Load: wait for the headline, then draw (0.7s, power3.inOut). Any scroll finishes it.
      if (draw < 1) draw = io(s.pos > 0.5 ? 1 : clamp01((now - born - 650) / 700));

      /* the hero demonstration */
      const p = s.pointer;
      if (p.x !== demo.px || p.y !== demo.py) {
        demo.px = p.x;
        demo.py = p.y;
        demo.pointerAt = now;
      }
      const atRest = s.beat === "hero" && s.pos < 0.01;
      if (!atRest) {
        // Any scroll cancels it at once, and the next one waits for a fresh idle spell.
        demo.t = -1;
        demo.nextAt = now + DEMO.every * 1000;
      } else if (demo.t < 0) {
        const typing = document.activeElement instanceof HTMLInputElement;
        if (canDemo && worldBus.fieldReady && draw >= 1 && now >= demo.nextAt && now - demo.pointerAt > 2500 && !typing) demo.t = 0;
      } else {
        demo.t += dt;
        if (demo.t >= DEMO_TOTAL) {
          demo.t = -1;
          demo.nextAt = now + DEMO.every * 1000;
        }
      }
      let out = 0;
      let dip = 0;
      if (demo.t >= 0) {
        const t = demo.t;
        out = t < DEMO_TOTAL - DEMO.back ? io(t / DEMO.out) : 1 - io((t - (DEMO_TOTAL - DEMO.back)) / DEMO.back);
        const t1 = t - DEMO.out;
        dip = t1 < DEMO.down + DEMO.hold ? io(t1 / DEMO.down) : 1 - io((t1 - DEMO.down - DEMO.hold) / DEMO.up);
        if (dip > 0.3) worldBus.demo.shown = true;
      }
      worldBus.demo.on = demo.t >= 0;
      worldBus.demo.y0 = s.line.y;
      worldBus.demo.x0 = Math.max(s.line.x1 + 36, vw * 0.42) + STEP_W * 0.6;

      /* the line as drawn */
      const line = s.line;
      let x0 = line.x0;
      let x1 = line.x1;
      let y = line.y;
      let weight = line.weight;
      // The demonstration: the underline stays where it is, reaches out to the right edge, and
      // that reach steps down through the empty half of the hero and back. One stroke throughout.
      let stepX = 0; // where the stroke starts to step down (0 = no step)
      let restY = y;
      if (out > 0) {
        const depth = Math.min(vh * 0.3, Math.max(vh * 0.1, worldBus.firstY + 70 - line.y));
        stepX = Math.max(x1 + 36, vw * 0.42);
        x1 = mix(x1, vw, out);
        y += depth * dip;
      }
      // Ranked: the store scrubs the dock. If the wheel gets there while the twelve are still in the
      // air, the line waits as its stub just under the rule and docks after the last landing.
      const hold = s.beat === "ranked" && s.beatProgress > DOCK_FROM ? worldBus.dockHold : 0;
      const rule = hold > 0 ? anchorRect("ranked-rule") : null;
      if (rule) {
        x0 = mix(x0, rule.x + rule.w * 0.86, hold);
        x1 = mix(x1, rule.x + rule.w, hold);
        y = mix(y, rule.y + rule.h + 16, hold);
        weight = mix(weight, 1.5, hold);
      }
      x1 = x0 + (x1 - x0) * draw;
      const stepped = stepX > 0 && y - restY > 0.5 && x1 > stepX + STEP_W;
      const shown = worldBus.line;
      // The canvas lights and reads along the stepped-down reach only.
      shown.x0 = stepped ? stepX + STEP_W : x0;
      shown.x1 = x1;
      shown.y = y;
      shown.weight = weight;
      shown.set = true;
      const len = x1 - x0;
      const wide = x0 <= 2 && x1 >= vw - 2; // edge to edge: at large, not docked on anything

      // Hand-drawn at rest under "ready.": hero start and seat end.
      let hand = 0;
      if (s.beat === "hero") hand = (1 - clamp01(s.beatProgress / 0.2)) * (1 - out);
      else if (s.beat === "seat") hand = clamp01((s.beatProgress - 0.22) / 0.08);
      else if (s.beat === "footer") hand = 1;

      /* the string */
      const moved = Math.abs(y - py) + Math.abs(x0 - px0) + Math.abs(x1 - px1);
      const speed = dt > 0 ? moved / dt : 0;
      px0 = x0;
      px1 = x1;
      py = y;
      let target = 0;
      const playable = p.fine && p.inside && !s.flags.small && speed < 900 && len > 60 && draw >= 1 && out === 0;
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
      else if (stepped) {
        const h = STEP_W / 2;
        d = `M${f(x0)} ${f(restY)}L${f(stepX)} ${f(restY)}C${f(stepX + h)} ${f(restY)} ${f(stepX + h)} ${f(y)} ${f(stepX + STEP_W)} ${f(y)}L${f(x1)} ${f(y)}`;
      }
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
        hot.setAttribute("d", d);
        soft.setAttribute("d", d);
      }
      const w = Math.max(1, weight).toFixed(2);
      if (w !== last.w) {
        last.w = w;
        path.style.strokeWidth = `${w}px`;
        hot.style.strokeWidth = `${Math.max(0.7, Number(w) * 0.42).toFixed(2)}px`;
        soft.style.strokeWidth = `${(Number(w) + 4).toFixed(1)}px`;
      }

      /* colour: gold with a white-hot core at night, amber on day and on paper */
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
      const co = color === GOLD ? "0.92" : "0";
      if (co !== last.co) hot.style.opacity = last.co = co;
      const go = color === GOLD && !worldBus.glReady ? "0.24" : "0";
      if (go !== last.go) soft.style.opacity = last.go = go;

      /* label */
      if (line.label !== last.label) {
        last.label = line.label;
        if (line.label) {
          tag.textContent = line.label;
          labelW = line.label.length * 7.5;
        }
        place.checkedAt = 0;
      }
      let slot = -1;
      // The store blanks the label once the line has docked under copy; on paper it never shows.
      // Small screens: the acts already name the passes on the page, so the label only speaks during a chapter change.
      if (line.label !== "" && draw >= 1 && !onPaper && len > 40 && hand < 0.5 && out === 0 && (!s.flags.small || line.sweep)) {
        // Four places. Edge to edge: above or below the line, at the right or left end.
        // Shorter: above or below its right end, then beside its left end, then beside its right.
        const order = s.beat === "hero" ? [1, 3, 0, 2] : [0, 1, 2, 3];
        const refresh = now - place.checkedAt > 160;
        for (let k = 0; k < 4 && slot < 0; k++) {
          const c = order[k];
          const lx = slotX(c, wide, x0, x1, vw, labelW);
          const ly = slotY(c, wide, y);
          if (lx < 12 || lx + labelW > vw - 12 || ly < 76 || ly + 11 > vh - 10) continue;
          if ((a.present || a.docked) && lx < a.x + a.w + 10 && lx + labelW > a.x - 10 && ly < a.y + a.h + 10 && ly + 11 > a.y - 10) continue;
          if (refresh) place.free[c] = !(occupied(lx + 4, ly + 5) || occupied(lx + labelW / 2, ly + 5) || occupied(lx + labelW - 4, ly + 5));
          if (place.free[c]) slot = c;
        }
        if (refresh) place.checkedAt = now;
      }
      // Changing place is a fade out and in, never a jump.
      place.want = slot;
      if (labelO < 0.02) place.slot = place.want;
      const show = place.slot >= 0 && place.slot === place.want;
      labelO += ((show ? 1 : 0) - labelO) * (1 - Math.exp(-(show ? 10 : 14) * dt));
      const lo = (labelO < 0.01 ? 0 : labelO).toFixed(2);
      if (lo !== last.lo) tag.style.opacity = last.lo = lo;
      if (labelO >= 0.01 && place.slot >= 0) {
        const lx = slotX(place.slot, wide, x0, x1, vw, labelW);
        const ly = slotY(place.slot, wide, y);
        const lt = `translate3d(${f(lx)}px,${f(ly)}px,0)`;
        if (lt !== last.lt) tag.style.transform = last.lt = lt;
        // The label takes the colour of the ground it stands on.
        const lc = ly > s.dayTop || !night ? AMBER : GOLD;
        if (lc !== last.lc) tag.style.color = last.lc = lc;
      }
      const vis = len < 0.5 ? "hidden" : "visible";
      if (vis !== last.vis) root.style.visibility = last.vis = vis;
    };
    const off = story.frame("line", frame);
    return () => {
      off();
      worldBus.line.set = false;
      worldBus.demo.on = false;
    };
  }, []);

  return (
    <>
      <svg ref={svg} aria-hidden="true" data-world-line className="world-line only-motion" style={{ color: GOLD, visibility: "hidden" }}>
        <path ref={glow} className="world-line-glow" fill="none" stroke="#ffb84a" strokeLinecap="round" style={{ opacity: 0 }} />
        <path ref={body} data-line-core fill="none" stroke="currentColor" strokeLinecap="round" />
        <path ref={core} fill="none" stroke="#fffaf0" strokeLinecap="round" style={{ opacity: 0.92 }} />
      </svg>
      <div ref={label} aria-hidden="true" data-line-label className="world-line-label type-mono only-motion" style={{ opacity: 0 }} />
    </>
  );
}
