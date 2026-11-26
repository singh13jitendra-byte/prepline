"use client";

/**
 * THE LINE — the page's one instrument, and its only transition. Round 4: a hand-drawn stroke.
 *
 * A fixed inline SVG that draws the store's line (story.get().line) every frame as ONE path
 * whose wobble is in its geometry: a point every 40px, each lifted by seeded value noise
 * (about 2px, a wavelength of about 180px) sampled by absolute x, so the wobble belongs to
 * the page like a drawn line and does not shimmer while the Line travels. No filter, no
 * glow, no second "core". Three seeds; the seed changes as the Line leaves full width to
 * dock on something, so each dock looks freshly drawn.
 *
 * - Colour: lamp (--c-line) on night, pine (--c-accent) on day and on paper. While it is
 *   the boundary of a chapter change it is lamp with a thin pine under-stroke, so it reads
 *   on both grounds.
 * - Weight: the store's weight, never under 1.5px. Round caps; at a viewport edge it runs
 *   8px past it, so no cap shows.
 * - It is a string: within 80px a fine pointer bends it up to 6px toward the cursor,
 *   crossing it plucks it, and it rings out on a spring (about 0.5s).
 * - Ranked hold: the line docks as the list rule only after the last of the twelve has
 *   landed, however fast the wheel gets there. What is drawn is published as worldBus.line.
 * - The label is a margin note (--font-accent, sentence case as written in LINE_TRACK),
 *   written in from the left. It is hidden once the line docks under copy (the store blanks
 *   it), on paper, and on small screens outside chapter changes. Otherwise it is placed
 *   where nothing else is: four places around the line's end, each rejected if it touches
 *   the Actor, the nav band, or visible text and controls (a throttled hit-test).
 *
 * Reduced motion: never mounts. The static rule under "ready." is CSS (index.tsx).
 */

import { useEffect, useRef } from "react";
import { anchorRect } from "@/lib/anchors";
import { clamp01, story, type StoryState } from "@/lib/story";
import { labelWidth, onThemeChange } from "@/lib/theme";
import { worldBus } from "./bus";

const NIGHT = "var(--c-line)";
const DAY = "var(--c-accent)";
const NOTE_NIGHT = "var(--c-on-night)";
const NOTE_DAY = "var(--c-ink)";
const f = (n: number) => n.toFixed(1);
const io = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Beat progress at which LINE_TRACK.ranked starts its last move, onto the rule (lib/story.ts). */
const DOCK_FROM = 0.4;
/** The hand: a point every STEP px, lifted by up to AMP px, on a wavelength of about WAVE px. */
const STEP = 40;
const AMP = 2.2;
const WAVE = 180;
const NOTE_H = 20;

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
/** Seeded 1D value noise in -1..1, sampled by absolute x: fixed to the page, not to time. */
function wobble(x: number, seed: number) {
  const u = x / WAVE + seed * 37.7;
  const i = Math.floor(u);
  const t = u - i;
  const a = hash(i + seed * 101);
  const b = hash(i + 1 + seed * 101);
  return (a + (b - a) * t * t * (3 - 2 * t)) * 2 - 1;
}

const CONTENT = "a,button,input,textarea,select,label,svg,img,h1,h2,h3,h4,p,span,strong,em,small,time,dt,dd,th,td";
/** The beat rail keeps a wide, empty hover area beside its ticks: the note may stand there, clear of the ticks. */
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

const ORDER = [0, 1, 2, 3];
const HERO_ORDER = [1, 3, 0, 2];
const SWEEP_ORDER = [0, 1];
/** Free of visible text and controls, with a margin: the note must not even touch its neighbours. */
function clear(lx: number, ly: number, w: number): boolean {
  for (let r = 0; r < 2; r++) {
    const y = r === 0 ? ly - 5 : ly + NOTE_H + 5;
    for (let k = 0; k < 4; k++) if (occupied(lx - 10 + ((w + 20) * k) / 3, y)) return false;
  }
  return true;
}
function slotX(c: number, wide: boolean, x0: number, x1: number, vw: number, w: number) {
  if (wide) return c < 2 ? vw - RAIL_INSET - w : 20;
  return c < 2 ? x1 - w : c === 2 ? x0 - 12 - w : x1 + 12;
}
function slotY(c: number, wide: boolean, y: number) {
  if (wide || c < 2) return c % 2 === 0 ? y - 10 - NOTE_H : y + 10;
  return y - NOTE_H / 2;
}

export function Line() {
  const svg = useRef<SVGSVGElement>(null);
  const body = useRef<SVGPathElement>(null);
  const under = useRef<SVGPathElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (story.reduced()) return;
    const born = performance.now();
    const spring = { v: 0, x: 0, cx: 0, lastDy: 0, had: false };
    const last = { d: "", w: "", color: "", label: "", lt: "", lo: "", vis: "", uo: "", lc: "", on: "" };
    const place = { slot: -1, want: -1, checkedAt: 0, free: [true, true, true, true] };
    let labelW = 0;
    let px0 = 0;
    let px1 = 0;
    let py = 0;
    let draw = 0; // the load: the underline draws left to right
    let seed = 0;
    let wasWide = false;
    const remeasure = () => {
      if (last.label && label.current) labelW = labelWidth(label.current, last.label, 8);
    };

    const frame = (_t: number, dt: number, s: Readonly<StoryState>) => {
      const path = body.current;
      const shade = under.current;
      const tag = label.current;
      const root = svg.current;
      if (!path || !shade || !tag || !root) return;
      const vw = s.viewport.w;
      const vh = s.viewport.h;
      if (!vw) return;
      const now = performance.now();

      // Load: wait for the headline, then draw (0.7s). Any scroll finishes it.
      if (draw < 1) draw = io(s.pos > 0.5 ? 1 : clamp01((now - born - 650) / 700));

      /* the line as drawn */
      const line = s.line;
      let x0 = line.x0;
      let x1 = line.x1;
      let y = line.y;
      let weight = line.weight;
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
      const shown = worldBus.line;
      shown.x0 = x0;
      shown.x1 = x1;
      shown.y = y;
      shown.weight = weight;
      shown.set = true;
      const len = x1 - x0;
      const wide = x0 <= 2 && x1 >= vw - 2; // edge to edge: at large, not docked on anything
      // A new hand each time it leaves full width to dock on something.
      if (wasWide && !wide) seed = (seed + 1) % 3;
      wasWide = wide;

      /* the string */
      const moved = Math.abs(y - py) + Math.abs(x0 - px0) + Math.abs(x1 - px1);
      const speed = dt > 0 ? moved / dt : 0;
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
          const shape = ad < 20 ? ad / 20 : 1 - (ad - 20) / 60;
          target = Math.sign(dy) * 6 * shape * shape * (3 - 2 * shape);
          spring.cx = Math.min(x1, Math.max(x0, p.x));
          if (spring.had && Math.sign(dy) !== Math.sign(spring.lastDy) && spring.lastDy !== 0) {
            spring.v += Math.max(-260, Math.min(260, ((dy - spring.lastDy) / Math.max(dt, 0.008)) * 0.35));
          }
        }
        spring.lastDy = dy;
        spring.had = true;
      } else spring.had = false;
      const steps = Math.max(1, Math.ceil(dt / 0.008));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        spring.v += (-380 * (spring.x - target) - 15 * spring.v) * h;
        spring.x += spring.v * h;
      }
      if (Math.abs(spring.x) < 0.02 && Math.abs(spring.v) < 0.5 && target === 0) spring.x = spring.v = 0;
      const bend = Math.max(-9, Math.min(9, spring.x));

      /* the path: one stroke, its wobble in the geometry */
      let d = "";
      if (len >= 0.5) {
        const a0 = wide ? -8 : x0;
        const a1 = wide ? vw + 8 : x1;
        const span = a1 - a0;
        const amp = AMP * Math.min(1, span / 140);
        const n = Math.max(2, Math.ceil(span / STEP));
        const at = (x: number) => {
          let yy = y + wobble(x, seed) * amp;
          if (bend !== 0) {
            const u = (x - spring.cx) / 150;
            yy += bend / (1 + u * u * u * u);
          }
          return yy;
        };
        // Quadratic segments through the midpoints: smooth, and still one M.
        let prevX = a0;
        let prevY = at(a0);
        d = `M${f(prevX)} ${f(prevY)}`;
        for (let i = 1; i <= n; i++) {
          const x = i === n ? a1 : a0 + (span * i) / n;
          const yy = at(x);
          if (i === n) d += `Q${f(prevX)} ${f(prevY)} ${f(x)} ${f(yy)}`;
          else if (i > 1) d += `Q${f(prevX)} ${f(prevY)} ${f((prevX + x) / 2)} ${f((prevY + yy) / 2)}`;
          else d += `L${f((prevX + x) / 2)} ${f((prevY + yy) / 2)}`;
          prevX = x;
          prevY = yy;
        }
      }
      if (d !== last.d) {
        last.d = d;
        path.setAttribute("d", d);
        shade.setAttribute("d", d);
      }
      const w = Math.max(1.5, weight).toFixed(2);
      if (w !== last.w) path.style.strokeWidth = `${(last.w = w)}px`;

      /* colour: lamp at night, pine on day and on paper; both while it is the boundary */
      const a = s.actor;
      const mid = (x0 + x1) / 2;
      const onPaper =
        (a.present || a.docked) && (a.face === "sheet" || a.face === "ticket") && mid > a.x && mid < a.x + a.w && y > a.y && y < a.y + a.h + 2;
      const night = s.chapter === "night" || line.sweep;
      const color = night && !onPaper ? NIGHT : DAY;
      if (color !== last.color) root.style.color = last.color = color;
      const uo = line.sweep ? "1" : "0";
      if (uo !== last.uo) shade.style.opacity = last.uo = uo;

      /* the note */
      if (line.label !== last.label) {
        last.label = line.label;
        if (line.label) {
          tag.textContent = line.label;
          labelW = labelWidth(tag, line.label, 8);
          // Replaced, never cross-faded: the new note writes in from the left.
          tag.removeAttribute("data-on");
          last.on = "";
        }
        place.checkedAt = 0;
      }
      let slot = -1;
      // The store blanks the label once the line has docked under copy; on paper it never shows.
      // Small screens: the acts already name the passes, so the note only speaks during a chapter change.
      // It speaks while the line runs edge to edge, and as the short stub in `ranked`; never while the
      // line rides something (the board's week strip, a rule): there is always content beside it there.
      if (line.label !== "" && draw >= 1 && !onPaper && len > 40 && (wide || s.beat === "ranked") && (!s.flags.small || line.sweep) && !(s.beat === "hero" && s.beatProgress < 0.2)) {
        const order = line.sweep ? SWEEP_ORDER : s.beat === "hero" ? HERO_ORDER : ORDER;
        const refresh = now - place.checkedAt > 160;
        for (let k = 0; k < order.length && slot < 0; k++) {
          const c = order[k];
          const lx = slotX(c, wide, x0, x1, vw, labelW);
          const ly = slotY(c, wide, y);
          if (lx < 12 || lx + labelW > vw - 12 || ly < 76 || ly + NOTE_H > vh - 10) continue;
          if ((a.present || a.docked) && lx < a.x + a.w + 10 && lx + labelW > a.x - 10 && ly < a.y + a.h + 10 && ly + NOTE_H > a.y - 10) continue;
          if (refresh) place.free[c] = clear(lx, ly, labelW);
          if (place.free[c]) slot = c;
        }
        if (refresh) place.checkedAt = now;
      }
      // Changing place is a step out and a fresh write-in, never a slide.
      place.want = slot;
      if (place.slot !== place.want && last.on !== "1") place.slot = place.want;
      const show = place.slot >= 0 && place.slot === place.want;
      const lo = show ? "1" : "0";
      if (lo !== last.lo) tag.style.opacity = last.lo = lo;
      if (!show && last.on === "1") {
        tag.removeAttribute("data-on");
        last.on = "";
        place.slot = -1;
      }
      if (show) {
        const lx = slotX(place.slot, wide, x0, x1, vw, labelW);
        const ly = slotY(place.slot, wide, y);
        const lt = `translate3d(${f(lx)}px,${f(ly)}px,0) rotate(var(--art-note-rotate,-2deg))`;
        if (lt !== last.lt) tag.style.transform = last.lt = lt;
        const lc = ly > s.dayTop || !night ? NOTE_DAY : NOTE_NIGHT;
        if (lc !== last.lc) tag.style.color = last.lc = lc;
        if (last.on !== "1") {
          tag.setAttribute("data-on", "");
          last.on = "1";
        }
      }
      const vis = len < 0.5 ? "hidden" : "visible";
      if (vis !== last.vis) root.style.visibility = last.vis = vis;
    };
    const off = story.frame("line", frame);
    const offTheme = onThemeChange(remeasure);
    return () => {
      off();
      offTheme();
      worldBus.line.set = false;
    };
  }, []);

  return (
    <>
      <svg ref={svg} aria-hidden="true" data-world-line className="world-line only-motion" style={{ color: NIGHT, visibility: "hidden" }}>
        <path ref={under} className="world-line-under" fill="none" stroke={DAY} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0 }} />
        <path ref={body} data-line-core fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div ref={label} aria-hidden="true" data-line-label className="world-line-label type-note only-motion" style={{ opacity: 0 }} />
    </>
  );
}
