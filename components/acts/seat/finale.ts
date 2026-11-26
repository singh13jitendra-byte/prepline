"use client";

/**
 * THE STAMP FINALE (Delight 8) — the choreography after a seat request succeeds.
 *
 *   0       the success line takes the form's place (WaitlistForm)
 *   120     the stamp head appears above the ticket, falling (TicketFace: playStamp)
 *   380     impact: the head squashes, the ticket stage shakes 2-3px for 120ms, the ink is left
 *   640     the head lifts away
 *   1150    the ticket tears along the perforation (tearAndFly): the stub hinges off its bottom
 *           corner, ragged edges on both pieces, then flies a curved path (900ms) into the nav's
 *           "Save me a seat" and docks there
 *   2330    arrival: `prepline:seat-docked` (cancelable). If nothing handles it (Nav calls
 *           preventDefault() once it shows its own seated state), a pine ring pulses round the CTA
 *           and a lamp badge "Seat 13 saved ✓" covers it for 3s (the fallback).
 *
 * Motion is WAAPI on transform and opacity only, so nothing is restyled per frame: no inline style
 * is written while it plays. The flight is one sampled keyframe list (a cubic Bézier path).
 * If the nav CTA is not on screen, the stub tears off and settles beside the ticket instead.
 * Reduced motion never comes here: TicketFace draws the impression statically and only docks.
 */

import { SEATS, SEAT_NO, seatState } from "./seatState";
import { stampCopy } from "./Stamp";

/* ── timing (ms from the success) ── */
export const T_HEAD = 120;
export const T_FALL = 260;
export const T_IMPACT = T_HEAD + T_FALL;
export const T_LIFT = 640;
export const T_TEAR = 1150;
const D_TEAR = 280;
const D_FLY = 900;
const D_SETTLE = 520;

/* ── the torn edge: one ragged line both pieces share ── */
const TEAR_N = 26;
const TEAR_D = Array.from({ length: TEAR_N + 1 }, (_, i) => {
  const r = Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
  return +((i % 2 ? 1 : -1) * (1.1 + r * 1.9)).toFixed(2);
});
const ys = (i: number) => `${((i * 100) / TEAR_N).toFixed(3)}%`;
/** Left of the flyer's perforation (px): room for the ragged edge. */
const PAD = 6;
const mainX = (d: number) => `calc(100% - var(--pp-keyline-w) - var(--pp-stub) - var(--hairline) / 2 + ${d}px)`;
const stubX = (d: number) => `calc(${PAD}px + var(--hairline) / 2 + ${d}px)`;
/** The ticket body once the stub is gone: everything left of the tear (the print shadow included). */
export const TEAR_MAIN = `polygon(-24px -24px, ${mainX(TEAR_D[0])} -24px, ${TEAR_D.map((d, i) => `${mainX(d)} ${ys(i)}`).join(", ")}, ${mainX(TEAR_D[TEAR_N])} calc(100% + 24px), -24px calc(100% + 24px))`;
/** The stub: everything right of the same tear. */
const TEAR_STUB = `polygon(${stubX(TEAR_D[0])} -24px, calc(100% + 24px) -24px, calc(100% + 24px) calc(100% + 24px), ${stubX(TEAR_D[TEAR_N])} calc(100% + 24px), ${TEAR_D.map((d, i) => `${stubX(d)} ${ys(i)}`)
  .reverse()
  .join(", ")})`;

type V = { x: number; y: number };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bez = (p0: V, p1: V, p2: V, p3: V, t: number): V => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};
const rot = (v: V, deg: number): V => {
  const r = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
};

/** The nav's "Save me a seat", if it is on screen (found at runtime: Nav is not ours to edit). */
export function findNavCta(): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(".nav-base .nav-cta") ?? document.querySelector<HTMLElement>('header a[href="#join"]');
  if (!el) return null;
  const nav = el.closest<HTMLElement>(".nav");
  if (nav?.hasAttribute("data-hidden")) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
  return getComputedStyle(el).visibility === "hidden" ? null : el;
}

/** Where the ticket's local px land on screen (tilt, lift and face scale included), from three probes. */
function mapper(tkx: HTMLElement) {
  const pts = [
    [0, 0],
    [100, 0],
    [0, 100],
  ].map(([x, y]) => {
    const s = document.createElement("span");
    s.className = "tkx-probe";
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    tkx.appendChild(s);
    const r = s.getBoundingClientRect();
    s.remove();
    return { x: r.left, y: r.top };
  });
  const ux = { x: (pts[1].x - pts[0].x) / 100, y: (pts[1].y - pts[0].y) / 100 };
  const uy = { x: (pts[2].x - pts[0].x) / 100, y: (pts[2].y - pts[0].y) / 100 };
  return {
    at: (x: number, y: number): V => ({ x: pts[0].x + ux.x * x + uy.x * y, y: pts[0].y + ux.y * x + uy.y * y }),
    angle: (Math.atan2(ux.y, ux.x) * 180) / Math.PI,
    scale: Math.hypot(ux.x, ux.y),
  };
}

/** The stub as a separate piece of paper: a clone of the real stub and perforation, cut along the tear. */
function buildStub(tkx: HTMLElement) {
  const ticket = tkx.querySelector<HTMLElement>(".pp-ticket");
  const perf = ticket?.querySelector<HTMLElement>(".pp-ticket-perf");
  const stub = ticket?.querySelector<HTMLElement>(".pp-ticket-stub");
  if (!ticket || !perf || !stub) return null;
  const cs = getComputedStyle(ticket);
  const b = parseFloat(cs.borderLeftWidth) || 0;
  const W = ticket.offsetWidth;
  const H = ticket.offsetHeight;
  const x0 = b + perf.offsetLeft - PAD;
  const w = W - x0;

  const root = document.createElement("div");
  root.className = "tkx tkx-piece";
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("data-skin", "day");
  root.setAttribute("data-paper", "");
  root.style.width = `${w}px`;
  root.style.height = `${H}px`;
  const paper = document.createElement("div");
  paper.className = "pp pp-ticket tkx-piece-paper";
  paper.setAttribute("data-skin", "day");
  paper.style.setProperty("--pp-stub", `${stub.offsetWidth}px`);
  paper.style.paddingLeft = `${PAD}px`;
  paper.style.borderTopRightRadius = cs.borderTopRightRadius;
  paper.style.borderBottomRightRadius = cs.borderBottomRightRadius;
  paper.style.clipPath = TEAR_STUB;
  const p = perf.cloneNode(true) as HTMLElement;
  const s = stub.cloneNode(true) as HTMLElement;
  // A still copy: no entrance animations replay, no anchors, no focusable parts.
  s.querySelectorAll("[data-fresh]").forEach((n) => n.removeAttribute("data-fresh"));
  paper.append(p, s);
  root.append(paper);
  return { root, x0, w, H };
}

let badge: { el: HTMLElement; timer: number } | null = null;
function dropBadge() {
  if (!badge) return;
  clearTimeout(badge.timer);
  badge.el.remove();
  badge = null;
}

/**
 * Arrival in the nav: tell the page (Nav listens and shows its seated state), and if nothing took
 * the event, pulse a ring round the CTA and lay the fallback badge over it for 3s.
 */
export function dock(opts: { reduced: boolean }) {
  const ev = new CustomEvent("prepline:seat-docked", {
    cancelable: true,
    detail: { ring: SEAT_NO, seat: SEAT_NO, of: SEATS, label: stampCopy.docked, reduced: opts.reduced },
  });
  window.dispatchEvent(ev);
  if (ev.defaultPrevented) return;
  const cta = findNavCta();
  if (!cta) return;
  const r = cta.getBoundingClientRect();
  const cs = getComputedStyle(cta);

  if (!opts.reduced) {
    const ring = document.createElement("span");
    ring.className = "tkx-dock-ring";
    ring.setAttribute("aria-hidden", "true");
    Object.assign(ring.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(ring);
    const a = ring.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.1, 1.32)", opacity: 0 },
      ],
      { duration: 620, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
    );
    a.onfinish = () => ring.remove();
  }

  dropBadge();
  const el = document.createElement("span");
  el.className = "tkx-dock-badge";
  el.setAttribute("aria-hidden", "true");
  el.style.height = `${r.height}px`;
  el.style.minWidth = `${r.width}px`;
  el.style.fontSize = cs.fontSize;
  el.style.top = `${r.top}px`;
  el.innerHTML = `<span></span><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 10.5l3.25 3.25 7.25-7.5"/></svg>`;
  (el.firstChild as HTMLElement).textContent = stampCopy.docked;
  document.body.appendChild(el);
  el.style.left = `${Math.round(r.right - Math.max(el.offsetWidth, r.width))}px`;
  el.animate(
    opts.reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "scale(0.86)" },
          { opacity: 1, transform: "scale(1.06)", offset: 0.6 },
          { opacity: 1, transform: "scale(1)" },
        ],
    { duration: opts.reduced ? 160 : 300, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
  );
  const timer = window.setTimeout(() => {
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: "ease-out", fill: "forwards" });
    out.onfinish = () => {
      if (badge?.el === el) badge = null;
      el.remove();
    };
  }, 3000);
  badge = { el, timer };
}

/** The visitor edited their address: the seat is open again. */
export function release() {
  dropBadge();
  window.dispatchEvent(new CustomEvent("prepline:seat-released", { detail: { ring: SEAT_NO } }));
}

/**
 * The stub, torn off and left lying beside the ticket (the nav CTA is not on screen, or a remount
 * after that). Lives inside the ticket face, so it scrolls with it.
 */
export function settleStub(tkx: HTMLElement, animate: boolean): (() => void) | null {
  tkx.querySelector(".tkx-piece")?.remove();
  const piece = buildStub(tkx);
  if (!piece) return null;
  const { root, x0, H } = piece;
  root.classList.add("tkx-piece-settled");
  root.style.left = `${x0}px`;
  root.style.transformOrigin = `${PAD}px ${H}px`;
  tkx.appendChild(root);
  if (!animate) return () => root.remove();
  const a = root.animate(
    [
      { transform: "none" },
      { transform: "translate(3px, -2px) rotate(5deg)", offset: 0.45 },
      { transform: "translate(7px, 3px) rotate(3deg)" },
    ],
    { duration: D_SETTLE, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
  );
  return () => {
    a.cancel();
    root.remove();
  };
}

/**
 * Tear the stub off along the perforation and fly it into the nav CTA (or settle it).
 * Returns a cancel function (Edit it., unmount): the piece goes, nothing is left half-way.
 */
export function tearAndFly(tkx: HTMLElement): () => void {
  const cta = findNavCta();
  const mark = (stub: "torn" | "flown" | "settled") => {
    tkx.setAttribute("data-stub", stub);
    seatState.finale({ stub });
  };
  if (!cta) {
    mark("settled");
    return settleStub(tkx, true) ?? (() => {});
  }
  const piece = buildStub(tkx);
  if (!piece) return () => {};
  const m = mapper(tkx);
  const { root, x0, w, H } = piece;
  root.classList.add("tkx-piece-fly");

  // Where it starts: exactly over the real stub.
  const c0 = m.at(x0 + w / 2, H / 2);
  const pivot = m.at(x0 + PAD, H);
  const s0 = m.scale;
  const a0 = m.angle;
  // Where it ends: the CTA's centre, the size of the button.
  const r = cta.getBoundingClientRect();
  const end = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const s1 = (r.height * 1.25) / H;
  const tearTurn = 5;
  const total = D_TEAR + D_FLY;
  const centreAt = (turn: number, push: number): V => {
    const v = rot({ x: (w / 2 - PAD) * s0, y: (-H / 2) * s0 }, a0 + turn);
    return { x: pivot.x + v.x + push, y: pivot.y + v.y };
  };
  const c1 = centreAt(tearTurn, 4);
  // A curved path: up and out first, then in to the button from below-left.
  const dx = end.x - c1.x;
  const dy = end.y - c1.y;
  const side = dx > 0 ? -1 : 1;
  const p1 = { x: c1.x + side * Math.min(160, Math.abs(dy) * 0.32) + dx * 0.1, y: c1.y + dy * 0.18 - 40 };
  const p2 = { x: end.x + side * Math.min(140, Math.abs(dy) * 0.28), y: end.y + Math.max(80, Math.abs(dy) * 0.3) };

  const frames: Keyframe[] = [];
  const N = Math.round(total / 16);
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * total;
    let c: V;
    let a: number;
    let s: number;
    let o = 1;
    if (t <= D_TEAR) {
      // The tear: the stub hinges off its bottom corner, the top first.
      const k = easeOut(t / D_TEAR);
      c = centreAt(tearTurn * k, 4 * k);
      a = a0 + tearTurn * k;
      s = s0;
    } else {
      const k = (t - D_TEAR) / D_FLY;
      const e = easeInOut(k);
      c = bez(c1, p1, p2, end, e);
      // A little spin through the air, square again as it lands.
      a = k < 0.55 ? lerp(a0 + tearTurn, -9, easeInOut(k / 0.55)) : lerp(-9, 0, easeInOut((k - 0.55) / 0.45));
      s = lerp(s0, s1, easeInOut(Math.min(1, k * 1.15)));
      o = k < 0.84 ? 1 : 1 - (k - 0.84) / 0.16;
    }
    frames.push({
      transform: `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) rotate(${a.toFixed(3)}deg) scale(${s.toFixed(4)}) translate(${(-w / 2).toFixed(2)}px, ${(-H / 2).toFixed(2)}px)`,
      opacity: +o.toFixed(3),
    });
  }
  root.style.transform = String(frames[0].transform);
  document.body.appendChild(root);
  mark("torn");
  const anim = root.animate(frames, { duration: total, easing: "linear", fill: "forwards" });
  let done = false;
  anim.onfinish = () => {
    done = true;
    root.remove();
    mark("flown");
    dock({ reduced: false });
  };
  return () => {
    anim.cancel();
    root.remove();
    // Unmounted mid-flight with the request still standing: land it, so a remount draws the end.
    if (!done && seatState.get().status === "done") mark("flown");
  };
}
