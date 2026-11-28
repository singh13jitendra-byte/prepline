"use client";

/**
 * THE TOUR'S SLIP: a flower's tooltip (role · company · city · fit) that grows into its role card.
 *
 *   <GardenSlip ref={slip} job={job} anchor={{ x, y, r }} show={s.slip} grow={s.card} inset={{ top: 88 }} />
 *   slip.current?.set({ anchor, show, grow })   // per frame, without a React render
 *
 * Driven entirely by props (or the handle): `show` 0..1 brings the slip up (a lamp leader draws out
 * from the flower, then the slip unrolls from the side nearest it), `grow` 0..1 grows it into the
 * role card. No timers, no transitions, no internal clock: the same inputs always draw the same
 * frame, so the scroll tour can scrub it both ways (components/garden/tour/tour.ts).
 *
 * WHY ITS OWN ELEMENT, NOT A MODE OF JobCard. JobCard (components/fireflies/card) is an event-driven
 * dialog: it opens on a `job` prop with a 380ms unfold and closes on a 70ms grace plus a 240ms fold,
 * all on setTimeout and CSS transitions, takes focus when opened from the keyboard and listens for
 * Esc. None of that can be scrubbed by the scroll or reversed exactly. So the slip is its own
 * element, and its "card" is a twin of JobCard's: the same markup and classes (`.pp.pp-role.ffc-card`
 * on the night skin, card.css), the same width (400px), the same placement rule (right of the
 * anchor, flipped left when there is no room, 42% above it, kept inside the insets) and, where the
 * card docks (JOBCARD_DOCK_QUERY), the same bottom sheet. At grow = 1 it stands exactly where JobCard
 * would open for the same anchor and gap (checked in the lab with ?card=1). In free explore the camera
 * cranes onto the flower first, so the real card opens beside the close-up, not on this footprint. The twin is decorative (aria-hidden, inert; its buttons are drawn for the footprint and do nothing, and it has no close): the accessible list and JobCard
 * carry the roles for assistive tech.
 *
 * NIGHT DESK: one opaque paper at every frame (its rect is the slip's growing into the card's), the
 * type always inside it, never on the painting. The paper goes from a night slip (pine, a night
 * hairline, the tile radius) to the card's raised night surface, keyline, radius and print. Type
 * changes over (the slip's lines out, the card's in) only while the paper is fully under it. Lamp
 * is a line here (the leader) and the score's numeral on night; never text on cream.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "@/components/product/product.css";
import "@/components/fireflies/card/card.css";
import { Button, ScoreRule, StatusPill } from "@/components/product/primitives";
import { JOBCARD_DOCK_QUERY } from "@/components/fireflies/card/JobCard";
import { fireflyCardCopy, jobFits, levelLine, type FireflyJob } from "@/components/fireflies/jobs";

/* ────────────────────────────────────────────────────── pure layout ── */

export type SlipAnchor = { x: number; y: number; r?: number };
export type SlipRect = { x: number; y: number; w: number; h: number };
export type SlipInset = { top: number; right: number; bottom: number; left: number };
export type SlipSide = "right" | "left" | "above" | "below";
export type SlipLayout = { side: SlipSide; docked: boolean; gap: number; slip: SlipRect; card: SlipRect };

/** JobCard's width as a floating card (card.css --ffc-w). */
export const CARD_W = 400;
/** The slip's width, and how close it may come to the screen's edge. */
export const SLIP_W = 288;
/** The docked card's height cap (card.css: min(78vh, 620px)). */
const DOCK_MAX = (vh: number) => Math.min(vh * 0.78, 620);
/** The leader never meets the paper closer than this to a corner (JobCard's EDGE). */
const EDGE = 28;

/** From the flower to the card's near edge: ExploreStage's rule for JobCard (`0.75 r + 16`, 44 with no radius). */
export const gapFor = (r?: number) => (r ? Math.round(r * 0.75 + 16) : 44);

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Where the slip and the card stand for an anchor. Floating: JobCard's own rule (place() in
 * JobCard.tsx), the slip on the card's side with its near edge where the card's is. Docked: the card
 * is the bottom sheet; the slip sits beside the flower if it fits, else above it.
 */
export function slipLayout(a: {
  anchor: SlipAnchor;
  vw: number;
  vh: number;
  slip: { w: number; h: number };
  card: { w: number; h: number };
  docked: boolean;
  inset: SlipInset;
  gap?: number;
  /** Docked only: the most of the sheet that shows (its head), so the flower stays visible above it. */
  sheetMax?: number;
  /** Which side of the flower the slip takes when both fit (default right, as JobCard). */
  prefer?: "right" | "left";
}): SlipLayout {
  const { anchor, vw, vh, slip, card, docked, inset: o } = a;
  const gap = a.gap ?? gapFor(anchor.r);
  const { x: ax, y: ay } = anchor;
  const sy = clamp(ay - slip.h / 2, o.top, vh - o.bottom - slip.h);
  if (docked) {
    const h = Math.min(card.h, DOCK_MAX(vh), a.sheetMax ?? Infinity);
    const sheet = { x: 0, y: vh - h, w: vw, h };
    const fitsR = ax + gap + slip.w <= vw - o.right;
    const fitsL = ax - gap - slip.w >= o.left;
    if (fitsR || fitsL) {
      const right = fitsR && !(a.prefer === "left" && fitsL);
      const x = right ? ax + gap : ax - gap - slip.w;
      return { side: right ? "right" : "left", docked, gap, card: sheet, slip: { x, y: sy, w: slip.w, h: slip.h } };
    }
    // Above the flower, or below it when the room above (under the stage's line slip, `inset.top`) is short.
    const lift = (anchor.r ?? 30) * 0.9 + 12;
    const x = clamp(ax - slip.w / 2, o.left, vw - o.right - slip.w);
    const up = ay - lift - slip.h;
    if (up >= o.top) return { side: "above", docked, gap, card: sheet, slip: { x, y: up, w: slip.w, h: slip.h } };
    const y = clamp(ay + lift, o.top, vh - o.bottom - slip.h);
    return { side: "below", docked, gap, card: sheet, slip: { x, y, w: slip.w, h: slip.h } };
  }
  const fitsR = ax + gap + card.w <= vw - o.right;
  const fitsL = ax - gap - card.w >= o.left;
  const side: SlipSide = a.prefer === "left" && fitsL ? "left" : fitsR ? "right" : fitsL ? "left" : vw - ax >= ax ? "right" : "left";
  const cx = clamp(side === "right" ? ax + gap : ax - gap - card.w, o.left, vw - o.right - card.w);
  const cy = clamp(ay - card.h * 0.42, o.top, vh - o.bottom - card.h);
  const sx = clamp(side === "right" ? ax + gap : ax - gap - slip.w, o.left, vw - o.right - slip.w);
  return { side, docked, gap, card: { x: cx, y: cy, w: card.w, h: card.h }, slip: { x: sx, y: sy, w: slip.w, h: slip.h } };
}

/** The paper's rect for `show` and `grow`: the slip's rect grown into the card's, unrolled from the flower's side. */
export function slipPaper(l: SlipLayout, show: number, grow: number): SlipRect {
  const g = clamp(grow, 0, 1);
  const r = { x: lerp(l.slip.x, l.card.x, g), y: lerp(l.slip.y, l.card.y, g), w: lerp(l.slip.w, l.card.w, g), h: lerp(l.slip.h, l.card.h, g) };
  const u = ss(0.25, 1, show);
  if (u >= 1) return r;
  if (l.side === "above") return { x: r.x, y: r.y + r.h * (1 - u), w: r.w, h: r.h * u };
  if (l.side === "below") return { x: r.x, y: r.y, w: r.w, h: r.h * u };
  if (l.side === "left") return { x: r.x + r.w * (1 - u), y: r.y, w: r.w * u, h: r.h };
  return { x: r.x, y: r.y, w: r.w * u, h: r.h };
}

/** The leader, from the flower's head to the paper's near edge, or null when there is no room for it. */
export function slipLeader(l: SlipLayout, anchor: SlipAnchor, paper: SlipRect, show: number, grow: number) {
  const k = ss(0, 0.45, show) * (l.docked ? 1 - ss(0, 0.5, grow) : 1);
  if (k <= 0 || paper.w < 1 || paper.h < 1) return null;
  const r0 = (anchor.r ?? 24) * 0.45;
  const mid = (lo: number, len: number, v: number) => (len > 2 * EDGE ? clamp(v, lo + EDGE, lo + len - EDGE) : lo + len / 2);
  const ex = l.side === "right" ? paper.x : l.side === "left" ? paper.x + paper.w : mid(paper.x, paper.w, anchor.x);
  const ey = l.side === "above" ? paper.y + paper.h : l.side === "below" ? paper.y : mid(paper.y, paper.h, anchor.y);
  const dx = ex - anchor.x;
  const dy = ey - anchor.y;
  const d = Math.hypot(dx, dy);
  if (d < r0 + 6) return null;
  return { x: anchor.x + (dx / d) * r0, y: anchor.y + (dy / d) * r0, angle: Math.atan2(dy, dx), length: (d - r0) * k };
}

/**
 * Where Lumi can perch on the grown card: on its top edge, near the corner on the flower's side
 * (docked: near the sheet's top right, clear of the title). On a phone the sheet covers the flower,
 * so perching on the card is the only perch the visitor can see.
 */
export function slipPerch(l: SlipLayout): { x: number; y: number } {
  const c = l.card;
  if (l.docked) return { x: c.x + c.w - 64, y: c.y };
  return { x: l.side === "left" ? c.x + c.w - 36 : c.x + 36, y: c.y };
}

/* ─────────────────────────────────────────────────────────── component ── */

export type GardenSlipProps = {
  job: FireflyJob | null;
  /** The flower's heart in viewport px; `r` its head's radius on screen (sets the gap, as for JobCard). */
  anchor: SlipAnchor | null;
  /** 0..1: the slip comes up (leader, then the paper unrolls). */
  show: number;
  /** 0..1: the slip grows into the role card. */
  grow: number;
  /** Screen kept clear, per side (JobCard's `inset`; ExploreStage gives the card { top: 88 }). Default 16. */
  inset?: Partial<SlipInset>;
  /** From the flower to the card. Default `gapFor(anchor.r)`, the gap ExploreStage gives JobCard. */
  gap?: number;
  /**
   * Where the card docks as a bottom sheet: grow only into its head (title, meta, facts and score), so the
   * flower, framed in the wide shot behind it, stays in view above the sheet. The tour sets it.
   */
  dockHead?: boolean;
  /** Which side of the flower the slip takes when both fit (default right, as JobCard; Lumi hovers right of a flower). */
  prefer?: "right" | "left";
  className?: string;
};

export type GardenSlipHandle = {
  /** The same as the props, without a React render (any field left out keeps its value). */
  set: (p: { anchor?: SlipAnchor | null; show?: number; grow?: number; prefer?: "right" | "left" }) => void;
  /** Where the slip and the card stand right now (null with no job or anchor). */
  layout: () => SlipLayout | null;
  /** Where Lumi perches on the grown card (`slipPerch`), or null. */
  perch: () => { x: number; y: number } | null;
};

type Live = { anchor: SlipAnchor | null; show: number; grow: number; inset: SlipInset; gap?: number; dockHead: boolean; prefer?: "right" | "left" };
type Cache = { vw: number; vh: number; docked: boolean; slipH: number; slipW: number; cardW: number; cardH: number; headH: number; ok: boolean };

const px = (v: number) => String(Math.round(v * 10) / 10);
const step = (i: number) => ({ "--i": i }) as CSSProperties;

export const GardenSlip = forwardRef<GardenSlipHandle, GardenSlipProps>(function GardenSlip({ job, anchor, show, grow, inset, gap, dockHead = false, className }, ref) {
  const [mounted, setMounted] = useState(false);
  const els = useRef<{ root: HTMLDivElement | null; paper: HTMLDivElement | null; card: HTMLDivElement | null; slip: HTMLDivElement | null; lead: HTMLSpanElement | null }>({ root: null, paper: null, card: null, slip: null, lead: null });
  const insetV: SlipInset = { top: inset?.top ?? 16, right: inset?.right ?? 16, bottom: inset?.bottom ?? 16, left: inset?.left ?? 16 };
  const live = useRef<Live>({ anchor, show, grow, inset: insetV, gap, dockHead });
  const cache = useRef<Cache>({ vw: 0, vh: 0, docked: false, slipH: 0, slipW: SLIP_W, cardW: CARD_W, cardH: 0, headH: 0, ok: false });
  const last = useRef<Record<string, string>>({});
  const dock = useRef<MediaQueryList | null>(null);

  /** Write a style only when it changes. */
  const put = (key: string, el: HTMLElement | null, prop: string, v: string) => {
    if (!el || last.current[key] === v) return;
    last.current[key] = v;
    if (prop.startsWith("--")) el.style.setProperty(prop, v);
    else (el.style as unknown as Record<string, string>)[prop] = v;
  };

  const layoutNow = useCallback((): SlipLayout | null => {
    const c = cache.current;
    const L = live.current;
    if (!c.ok || !L.anchor) return null;
    return slipLayout({ anchor: L.anchor, vw: c.vw, vh: c.vh, slip: { w: c.slipW, h: c.slipH }, card: { w: c.cardW, h: c.cardH }, docked: c.docked, inset: L.inset, gap: L.gap, sheetMax: L.dockHead && c.headH ? c.headH : undefined, prefer: L.prefer });
  }, []);

  /** Sizes: the viewport, the dock, the slip's height at its width, the card twin's height at its width. Reads layout. */
  const measure = useCallback(() => {
    const { card, slip } = els.current;
    const c = cache.current;
    c.vw = document.documentElement.clientWidth;
    c.vh = window.innerHeight;
    c.docked = dock.current?.matches ?? false;
    c.slipW = Math.min(SLIP_W, c.vw - 32);
    c.cardW = c.docked ? c.vw : Math.min(CARD_W, c.vw - 32);
    if (slip) {
      put("slipW", slip, "width", `${px(c.slipW)}px`);
      c.slipH = slip.offsetHeight;
    }
    if (card) {
      put("cardW", card, "width", `${px(c.cardW)}px`);
      c.cardH = card.offsetHeight;
      const head = card.querySelector<HTMLElement>(".pp-role-h");
      c.headH = head ? card.clientTop + head.offsetTop + head.offsetHeight : 0;
    }
    c.ok = Boolean(card && slip && c.slipH && c.cardH);
  }, []);

  /** Place everything for the live values. Style writes only. */
  const write = useCallback(() => {
    const { root, paper, card, slip, lead } = els.current;
    const L = live.current;
    const l = layoutNow();
    const on = Boolean(l && L.anchor && L.show > 0);
    put("on", root, "visibility", on ? "visible" : "hidden");
    if (!on || !l || !L.anchor) {
      // A child's own `visible` would show through a hidden root.
      put("cV", card, "visibility", "hidden");
      put("sV", slip, "visibility", "hidden");
      return;
    }
    const g = clamp(L.grow, 0, 1);
    const r = slipPaper(l, L.show, g);
    // The type rides the growing paper's top-left corner (the title stays where the eye is, the rest is
    // uncovered below it); while the slip unrolls it holds still and is uncovered from the flower's side.
    const at = g > 0 ? slipPaper(l, 1, g) : l.slip;
    const c = { ...l.card, x: at.x, y: at.y };
    const s = { ...l.slip, x: at.x, y: at.y };
    put("g", root, "--g", g.toFixed(4));
    put("dock", root, "--dock", l.docked ? "1" : "0");
    put("pT", paper, "transform", `translate3d(${px(r.x)}px,${px(r.y)}px,0)`);
    put("pW", paper, "width", `${px(r.w)}px`);
    put("pH", paper, "height", `${px(r.h)}px`);
    // The card twin and the slip's lines are clipped to the paper, so no type is ever off it.
    const clip = (b: SlipRect, rad: string) => `inset(${px(r.y - b.y)}px ${px(b.x + b.w - (r.x + r.w))}px ${px(b.y + b.h - (r.y + r.h))}px ${px(r.x - b.x)}px round ${rad})`;
    const cardK = ss(0.35, 0.9, g);
    put("cV", card, "visibility", g > 0 ? "visible" : "hidden");
    put("cT", card, "transform", `translate3d(${px(c.x)}px,${px(c.y)}px,0)`);
    put("cC", card, "clipPath", clip(c, "var(--r-md)"));
    put("cO", card, "opacity", cardK.toFixed(3));
    const slipK = 1 - ss(0, 0.3, g);
    put("sV", slip, "visibility", slipK > 0 ? "visible" : "hidden");
    put("sT", slip, "transform", `translate3d(${px(s.x)}px,${px(s.y)}px,0)`);
    put("sC", slip, "clipPath", clip(s, "var(--r-md)"));
    put("sO", slip, "opacity", slipK.toFixed(3));
    const ld = slipLeader(l, L.anchor, r, L.show, g);
    put("lT", lead, "transform", ld ? `translate3d(${px(ld.x)}px,${px(ld.y)}px,0) rotate(${ld.angle.toFixed(4)}rad) scaleX(${px(ld.length)})` : "scaleX(0)");
  }, [layoutNow]);

  live.current = { ...live.current, inset: insetV, gap, dockHead };

  useImperativeHandle(
    ref,
    () => ({
      set: (p) => {
        const L = live.current;
        if (p.anchor !== undefined) L.anchor = p.anchor;
        if (p.show !== undefined) L.show = p.show;
        if (p.grow !== undefined) L.grow = p.grow;
        if (p.prefer !== undefined) L.prefer = p.prefer;
        write();
      },
      layout: layoutNow,
      perch: () => {
        const l = layoutNow();
        return l ? slipPerch(l) : null;
      },
    }),
    [write, layoutNow],
  );

  /* mount: the portal, the dock query, resize */
  useEffect(() => {
    setMounted(true);
    dock.current = window.matchMedia(JOBCARD_DOCK_QUERY);
    const again = () => {
      measure();
      write();
    };
    dock.current.addEventListener("change", again);
    window.addEventListener("resize", again, { passive: true });
    return () => {
      dock.current?.removeEventListener("change", again);
      window.removeEventListener("resize", again);
    };
  }, [measure, write]);

  /* the props path */
  const ax = anchor?.x;
  const ay = anchor?.y;
  const ar = anchor?.r;
  useLayoutEffect(() => {
    const L = live.current;
    L.anchor = ax === undefined || ay === undefined ? null : { x: ax, y: ay, r: ar };
    L.show = show;
    L.grow = grow;
    write();
  }, [ax, ay, ar, show, grow, write, insetV.top, insetV.right, insetV.bottom, insetV.left, gap, dockHead]);

  /* new content: measure, then place */
  const jobId = job?.id;
  useLayoutEffect(() => {
    if (!mounted) return;
    measure();
    write();
  }, [mounted, jobId, measure, write]);

  /* sizes that change on their own (fonts arriving, a wrapped line) */
  useEffect(() => {
    const { card, slip } = els.current;
    if (!mounted || !card || !slip || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const c = cache.current;
      if (card.offsetHeight === c.cardH && slip.offsetHeight === c.slipH) return;
      measure();
      write();
    });
    ro.observe(card);
    ro.observe(slip);
    return () => ro.disconnect();
  }, [mounted, measure, write]);

  if (!mounted) return null;
  const fits = job ? jobFits(job) : true;
  const c = fireflyCardCopy.card;

  return createPortal(
    <div ref={(el) => void (els.current.root = el)} className={className ? `gts ${className}` : "gts"} aria-hidden="true" data-fits={String(fits)}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span ref={(el) => void (els.current.lead = el)} className="gts-lead" />
      <div ref={(el) => void (els.current.paper = el)} className="gts-paper" />
      <div ref={(el) => void (els.current.card = el)} className="pp pp-role ffc-card gts-card" data-skin="night" data-fits={String(fits)} inert>
        {job ? <CardTwin job={job} /> : null}
      </div>
      <div ref={(el) => void (els.current.slip = el)} className="pp gts-slip" data-skin="night" data-bare="" inert>
        {job ? (
          <>
            <p className="gts-slip-t">{job.title}</p>
            <p className="pp-meta gts-slip-m">
              {job.company}
              <span className="pp-sep">·</span>
              {job.city}
            </p>
            <ScoreRule score={job.fit} size="sm" suffix className="gts-slip-rule" />
            {!fits && job.gap ? (
              <p className="gts-slip-why">
                <span className="gts-slip-why-l">{c.aside}</span> {job.gap}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
});

/** The card's body as JobCard draws it (its Body, without the buttons, the close and the motion). */
function CardTwin({ job }: { job: FireflyJob }) {
  const c = fireflyCardCopy.card;
  const fits = jobFits(job);
  const where = job.city === job.mode ? [job.company, job.mode] : [job.company, job.city, job.mode];
  return (
    <div className="ffc-body">
      <header className="pp-role-h">
        <div className="pp-role-id">
          <div className="pp-role-t ffc-s" style={step(0)}>
            <p className="pp-title">{job.title}</p>
          </div>
          <div className="ffc-where ffc-s" style={step(1)}>
            <p className="pp-meta">
              {where.map((part, i) => (
                <span key={i}>
                  {i ? <span className="pp-sep">·</span> : null}
                  {part}
                </span>
              ))}
            </p>
            <StatusPill tone={fits ? "accent" : "quiet"} dot={fits}>
              {fits ? c.kept : c.aside}
            </StatusPill>
          </div>
          <dl className="pp-kv ffc-s" style={step(2)}>
            <div>
              <dt>{c.facts.level}</dt>
              <dd>{levelLine(job)}</dd>
            </div>
            <div>
              <dt>{c.facts.posted}</dt>
              <dd>{c.ago(job.posted)}</dd>
            </div>
            <div>
              <dt>{c.facts.pay}</dt>
              <dd data-none={job.salary ? undefined : ""}>{job.salary ?? c.noBand}</dd>
            </div>
          </dl>
        </div>
        <div className="ffc-s" style={step(3)}>
          <ScoreRule score={job.fit} size="lg" suffix className="pp-role-rule" />
        </div>
      </header>
      <div className="pp-claims">
        <section className="pp-reasons">
          <div className="ffc-why">
            <p className="pp-h3">{c.why(job.fit)}</p>
            <p className="ffc-src">
              {c.source}: {job.source}
            </p>
          </div>
          <ul>
            {job.reasons.map((r, i) => (
              <li key={i} className="pp-reason">
                <span className="ffc-mark" aria-hidden="true" />
                <span className="pp-reason-body">
                  <span className="ffc-reason-l">{r.label}</span>
                  <span className="pp-reason-t">{r.text}</span>
                </span>
              </li>
            ))}
            {job.gap ? (
              <li className="pp-reason">
                <span className="ffc-mark" data-gap="" aria-hidden="true" />
                <span className="pp-reason-body">
                  <span className="ffc-reason-l" data-gap="">
                    {c.gap}
                  </span>
                  <span className="pp-reason-t">{job.gap}</span>
                </span>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
      {/* Kept for the footprint (JobCard's height, so its placement), inert like the rest of the twin. */}
      <footer className="pp-role-f">
        <Button size="sm" variant="primary" icon="external" tabIndex={-1}>
          {c.view}
        </Button>
        <Button size="sm" icon="bookmark" tabIndex={-1}>
          {c.save}
        </Button>
        <p className="pp-quiet">{c.note}</p>
      </footer>
    </div>
  );
}

/* Tokens only. `--g` (0 slip, 1 card) is written per frame on the root; everything else is placed in px. */
const CSS = `
.gts{--g:0;position:fixed;inset:0;z-index:var(--gts-z,var(--ffc-z,var(--z-nav,5)));pointer-events:none;visibility:hidden}
.gts>*{position:absolute;top:0;left:0;will-change:transform}
.gts-lead{width:1px;height:2px;margin-top:-1px;transform-origin:0 50%;transform:scaleX(0);background:var(--art-lamp)}
/* The paper: a night slip at 0, the card's raised night surface, keyline, radius and print at 1. Opaque throughout. */
.gts-paper{
  --gts-rad:calc(var(--r-md) + (var(--r-lg) - var(--r-md)) * var(--g));
  background:color-mix(in oklab,var(--c-night-2) calc(var(--g) * 100%),var(--c-night));
  border-radius:var(--gts-rad);
  box-shadow:inset 0 0 0 calc(var(--hairline) + 0.5px * var(--g)) color-mix(in oklab,color-mix(in oklab,var(--c-on-night) 40%,var(--c-night-2)) calc(var(--g) * 100%),var(--c-rule-night));
}
.gts-paper::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:var(--shadow-1);opacity:var(--g);pointer-events:none}
/* The card twin: JobCard's own markup and classes; the paper behind it draws its surface. */
.gts .pp.gts-card{background:transparent;border-color:transparent;box-shadow:none;visibility:hidden}
.gts .pp.gts-card .ffc-s{animation:none}
/* The slip's lines. */
.gts .pp.gts-slip{width:${SLIP_W}px;height:auto;padding:12px 16px 12px;background:transparent;display:block;visibility:hidden}
.gts-slip-t{margin:0;font-family:var(--font-display);font-size:17px;line-height:22px;letter-spacing:-0.01em;color:var(--pp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gts-slip-m{margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gts .gts-slip-rule{display:flex;width:100%;margin-top:8px}
.gts .gts-slip-rule .pp-rule-track{flex:1 1 0;width:auto;min-width:0}
.gts[data-fits="false"] .gts-slip-rule .pp-rule-fill{background:var(--pp-fg-2)}
.gts-slip-why{margin:8px 0 0;padding-top:8px;border-top:var(--hairline) solid var(--c-rule-night);font-size:var(--pp-fs-meta);line-height:18px;color:var(--pp-fg);text-wrap:pretty}
.gts-slip-why-l{font-weight:var(--weight-label);color:var(--pp-warn)}
@media (max-width:839px),(max-height:519px){
  /* Docked, the card is the bottom sheet: its bottom corners go square and its print goes, as card.css's sheet. */
  .gts-paper{border-radius:var(--gts-rad) var(--gts-rad) calc(var(--r-md) * (1 - var(--g))) calc(var(--r-md) * (1 - var(--g)))}
  .gts-paper::after{opacity:0}
}
`;
