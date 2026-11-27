"use client";

/**
 * THE FIREFLY'S JOB CARD: one role, opened out of the firefly's light.
 *
 *   <JobCard job={job} anchor={anchor} onClose={close} />
 *
 * `anchor` is the focused firefly in viewport CSS px. The card sits to its right, flips left when
 * the right side has no room, and always keeps 16px of screen around it. A thin lamp leader runs
 * from the firefly to the card's near edge. With no anchor (opened from the list before the scene
 * reports one) the card opens in the middle of the screen with no leader.
 *
 * The card is a product object: a `.pp` root on the night skin, built from RoleDetail's own header,
 * ScoreRule, reason rows and footer (components/product). It is opaque at every frame.
 *
 *   open      the leader runs out, the card unfolds from the firefly's side (clip + scale, 380ms),
 *             one lamp wash crosses it behind the type, the type settles in six small steps
 *   close     the reverse, 240ms
 *   switch    (a new job while open) the content goes out, is swapped, and comes back: never two
 *             jobs at once. The card glides to the new firefly and its height eases to the new size
 *   follow    the card stays put while the firefly bobs (a 10px leash), and trails it smoothly when
 *             it really moves. The leader follows every frame
 *   phones    under 840px wide (or 520px tall) it docks as a bottom sheet: JOBCARD_DOCK_QUERY
 *   reduced   a fade, and nothing else
 *
 * Cost: the anchor can change every frame. That path never renders React past this component's
 * memoised body, and writes at most two transforms (the card's box, the leader), only when a value
 * changes. At rest nothing is written. To skip React entirely, push the anchor through the ref:
 * `cardRef.current?.setAnchor({ x, y })`.
 *
 * Accessibility: a non-modal dialog named by the job. Esc and the "×" call onClose. When it was
 * opened from the keyboard, focus moves to the card and returns to where it was on close. Closed,
 * the card is inert. "View posting" and "Save" change nothing outside the card.
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import "@/components/product/product.css";
import "./card.css";
import { Icon } from "@/components/product/icons";
import { Button, ScoreRule, StatusPill, cx } from "@/components/product/primitives";
import { fireflyCardCopy, jobFits, jobLabel, levelLine, whereParts, type FireflyJob } from "../jobs";

export type JobCardAnchor = { x: number; y: number };

export type JobCardProps = {
  job: FireflyJob | null;
  /** The firefly, in viewport CSS px. May change every frame. */
  anchor: JobCardAnchor | null;
  onClose: () => void;
  /** From the anchor to the card's near edge. Default 44. */
  gap?: number;
  /** Where the leader starts, measured out from the anchor (the firefly's lit body). Default 12. */
  anchorRadius?: number;
  /** Screen kept clear around the card, per side. Default 16 each. Raise `top` to clear a nav. */
  inset?: Partial<Record<"top" | "right" | "bottom" | "left", number>>;
  /** Move focus into the card when it opens. "keyboard" (default): only when the last input was a key. */
  focusOnOpen?: boolean | "keyboard";
  className?: string;
};

export type JobCardHandle = {
  /** The same as the `anchor` prop, without a React render. */
  setAnchor: (anchor: JobCardAnchor | null) => void;
};

/** Where the card stops floating and docks as a bottom sheet. card.css uses the same query. */
export const JOBCARD_DOCK_QUERY = "(max-width: 839px), (max-height: 519px)";

const UNFOLD_MS = 380;
const FOLD_MS = 240;
const FADE_MS = 160;
/** A switch: content out, then in (card.css), while the box glides. */
const OUT_MS = 110;
const GLIDE_MS = 300;
/** A job that goes null and comes straight back (the pointer crossing between fireflies) is a switch, not a close. */
const CLOSE_GRACE_MS = 70;
/** Follow rate, per second: 95% of a move is done in about 230ms. */
const FOLLOW = 13;
/** The firefly can move this far before the card follows. */
const LEASH = 10;
/** The leader never meets the card closer than this to a corner. */
const EDGE = 28;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const px = (v: number) => String(Math.round(v * 10) / 10);

/* ── last input: keyboard or pointer (decides whether opening takes focus) ── */

let keyAt = 0;
let pointerAt = 0;
let watchers = 0;
const onKey = (e: KeyboardEvent) => {
  if (!e.metaKey && !e.ctrlKey && !e.altKey) keyAt = e.timeStamp;
};
const onPointer = (e: Event) => {
  pointerAt = e.timeStamp;
};
function watchInput() {
  if (watchers++ === 0) {
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointermove", onPointer, { capture: true, passive: true });
  }
  return () => {
    if (--watchers === 0) {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointermove", onPointer, true);
    }
  };
}

/* ── placement: everything that moves, outside React ───────────────────── */

type Side = "right" | "left";

function createMotion() {
  let root: HTMLDivElement | null = null;
  let pos: HTMLDivElement | null = null;
  let lead: HTMLSpanElement | null = null;
  let card: HTMLDivElement | null = null;
  const o = { gap: 44, radius: 12, top: 16, right: 16, bottom: 16, left: 16 };
  const L = {
    /** the anchor, live, and the leashed copy the card is placed from */
    ax: 0,
    ay: 0,
    sx: 0,
    sy: 0,
    has: false,
    /** the card's box now, and where it is going */
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    w: 0,
    h: 0,
    vw: 0,
    vh: 0,
    side: "right" as Side,
    placed: false,
    docked: false,
    reduced: false,
    /** the card's height is easing to a new size: place from the final size, not the frames between */
    hold: false,
    wantLead: false,
    raf: 0,
    last: 0,
    posT: "",
    leadT: "",
  };

  const writeLeader = () => {
    if (!lead) return;
    let t = "scaleX(0)";
    if (L.has && L.placed && !L.docked) {
      const ex = L.side === "right" ? L.x : L.x + L.w;
      const clear = L.side === "right" ? ex - L.ax : L.ax - ex;
      if (clear > o.radius + 6) {
        const ey = clamp(L.ay, L.y + EDGE, L.y + L.h - EDGE);
        const dx = ex - L.ax;
        const dy = ey - L.ay;
        const d = Math.hypot(dx, dy);
        t = `translate3d(${px(L.ax + (dx / d) * o.radius)}px,${px(L.ay + (dy / d) * o.radius)}px,0) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${px(d - o.radius)})`;
      }
    }
    if (t !== L.leadT) lead.style.transform = L.leadT = t;
  };

  const write = () => {
    if (pos && !L.docked) {
      const t = `translate3d(${px(L.x)}px,${px(L.y)}px,0)`;
      if (t !== L.posT) pos.style.transform = L.posT = t;
    }
    writeLeader();
  };

  const tick = (now: number) => {
    const dt = clamp((now - L.last) / 1000, 0.001, 0.05);
    L.last = now;
    const k = 1 - Math.exp(-FOLLOW * dt);
    L.x += (L.tx - L.x) * k;
    L.y += (L.ty - L.y) * k;
    if (Math.abs(L.tx - L.x) < 0.35 && Math.abs(L.ty - L.y) < 0.35) {
      L.x = L.tx;
      L.y = L.ty;
      L.raf = 0;
    } else L.raf = requestAnimationFrame(tick);
    write();
  };

  const stop = () => {
    if (L.raf) cancelAnimationFrame(L.raf);
    L.raf = 0;
  };

  /** The fold opens from the point on the card's edge the leader meets. */
  const origin = () => {
    if (!pos) return;
    if (L.has && !L.docked) pos.style.setProperty("--ffc-oy", `${Math.round(clamp(L.ay - L.ty, EDGE, L.h - EDGE))}px`);
    else pos.style.removeProperty("--ffc-oy");
  };

  const applyLead = () => root?.toggleAttribute("data-lead", L.wantLead && L.has && !L.docked);

  /** Work out where the card goes. `fresh`: a new job, so start again from the right-hand side. */
  const place = (fresh: boolean) => {
    if (!pos || !root || L.docked || !L.w) return;
    if (!L.has && L.placed) return writeLeader(); // the anchor went away: stay where we are
    let side = L.side;
    let tx: number;
    let ty: number;
    if (!L.has) {
      tx = (L.vw - L.w) / 2;
      ty = (L.vh - L.h) / 2;
    } else {
      if (fresh || !L.placed) {
        L.sx = L.ax;
        L.sy = L.ay;
      } else {
        const dx = L.ax - L.sx;
        const dy = L.ay - L.sy;
        if (Math.abs(dx) > LEASH) L.sx = L.ax - Math.sign(dx) * LEASH;
        if (Math.abs(dy) > LEASH) L.sy = L.ay - Math.sign(dy) * LEASH;
      }
      const fitsR = L.sx + o.gap + L.w <= L.vw - o.right;
      const fitsL = L.sx - o.gap - L.w >= o.left;
      if (fresh || !L.placed || (side === "right" ? !fitsR : !fitsL)) side = fitsR ? "right" : fitsL ? "left" : L.vw - L.sx >= L.sx ? "right" : "left";
      tx = side === "right" ? L.sx + o.gap : L.sx - o.gap - L.w;
      ty = L.sy - L.h * 0.42;
    }
    L.tx = Math.round(clamp(tx, o.left, L.vw - o.right - L.w));
    L.ty = Math.round(clamp(ty, o.top, L.vh - o.bottom - L.h));
    if (side !== L.side || !root.dataset.side) root.dataset.side = L.side = side;
    if (!L.placed || L.reduced) {
      stop();
      L.x = L.tx;
      L.y = L.ty;
      if (!L.placed) origin();
      L.placed = true;
      write();
    } else if (L.tx !== L.x || L.ty !== L.y) {
      if (!L.raf) {
        L.last = performance.now();
        L.raf = requestAnimationFrame(tick);
      }
      writeLeader();
    } else writeLeader();
  };

  const measure = () => {
    if (card) {
      L.w = card.offsetWidth;
      L.h = card.offsetHeight;
    }
    L.vw = document.documentElement.clientWidth;
    L.vh = window.innerHeight;
  };

  return {
    L,
    o,
    setRoot: (el: HTMLDivElement | null) => void (root = el),
    setPos: (el: HTMLDivElement | null) => void (pos = el),
    setLeadEl: (el: HTMLSpanElement | null) => void (lead = el),
    setCard: (el: HTMLDivElement | null) => void (card = el),
    card: () => card,
    measure,
    place,
    origin,
    stop,
    /** Commit the closed state's styles, so the unfold starts from this side and not the last one. */
    flush: () => void pos?.offsetWidth,
    lead(on: boolean) {
      L.wantLead = on;
      applyLead();
    },
    setAnchor(p: JobCardAnchor | null) {
      if (!p) {
        if (!L.has) return;
        L.has = false;
        applyLead(); // the leader draws back in; the card stays
        return;
      }
      if (L.has && p.x === L.ax && p.y === L.ay) return;
      L.ax = p.x;
      L.ay = p.y;
      if (!L.has) {
        L.has = true;
        L.sx = p.x;
        L.sy = p.y;
        applyLead();
      }
      place(false);
    },
    setDocked(d: boolean) {
      if (d === L.docked) return;
      L.docked = d;
      root?.toggleAttribute("data-dock", d);
      if (d) {
        stop();
        L.placed = false;
        if (pos) pos.style.transform = L.posT = "";
        writeLeader();
      } else {
        measure();
        place(true);
      }
      applyLead();
    },
    /** Fully closed: the next open is placed from scratch. */
    reset() {
      stop();
      L.placed = false;
      L.hold = false;
    },
  };
}

/* ── the card ──────────────────────────────────────────────────────────── */

type Phase = "closed" | "open" | "closing";

export const JobCard = forwardRef<JobCardHandle, JobCardProps>(function JobCard(
  { job, anchor, onClose, gap = 44, anchorRadius = 12, inset, focusOnOpen = "keyboard", className },
  ref,
) {
  const hid = useId();
  const [motion] = useState(createMotion);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState<FireflyJob | null>(null);
  const [phase, setPhaseState] = useState<Phase>("closed");
  const [swap, setSwap] = useState(false);
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const [pressed, setPressed] = useState(false);
  const [nudge, setNudge] = useState(false);

  const shownRef = useRef<FireflyJob | null>(null);
  const phaseRef = useRef<Phase>("closed");
  const jobRef = useRef(job);
  const closeRef = useRef(onClose);
  const returnTo = useRef<HTMLElement | null>(null);
  const lastH = useRef(0);
  const timers = useRef({ close: 0, gone: 0, swap: 0, lead: 0, height: 0, press: 0, nudge: 0 });
  jobRef.current = job;
  closeRef.current = onClose;

  const show = useCallback((j: FireflyJob | null) => {
    shownRef.current = j;
    setShown(j);
  }, []);
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  motion.o.gap = gap;
  motion.o.radius = anchorRadius;
  motion.o.top = inset?.top ?? 16;
  motion.o.right = inset?.right ?? 16;
  motion.o.bottom = inset?.bottom ?? 16;
  motion.o.left = inset?.left ?? 16;

  useImperativeHandle(ref, () => ({ setAnchor: motion.setAnchor }), [motion]);

  /* mount: the portal, the input watcher, the two media queries, resize */
  useEffect(() => {
    setMounted(true);
    const unwatch = watchInput();
    const dock = window.matchMedia(JOBCARD_DOCK_QUERY);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      motion.L.reduced = reduce.matches;
      motion.setDocked(dock.matches);
    };
    sync();
    dock.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    const onResize = () => {
      motion.measure();
      motion.place(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    const t = timers.current;
    return () => {
      unwatch();
      dock.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      window.removeEventListener("resize", onResize);
      motion.stop();
      Object.values(t).forEach((id) => window.clearTimeout(id));
    };
  }, [motion]);

  /* the anchor: no state, straight to the transform */
  const ax = anchor?.x;
  const ay = anchor?.y;
  useLayoutEffect(() => {
    motion.setAnchor(ax === undefined || ay === undefined ? null : { x: ax, y: ay });
  }, [motion, ax, ay]);

  /* the job: open, switch, close */
  useEffect(() => {
    if (!mounted) return;
    const t = timers.current;
    const reduced = motion.L.reduced;
    if (job) {
      window.clearTimeout(t.close);
      window.clearTimeout(t.gone);
      const cur = shownRef.current;
      if (!cur) {
        show(job); // the layout effect below places it, then opens it
      } else if (cur.id === job.id) {
        if (cur !== job) show(job);
        if (phaseRef.current !== "open") {
          setPhase("open");
          motion.lead(true);
        }
      } else {
        setPhase("open");
        motion.lead(false);
        setSwap(true);
        window.clearTimeout(t.swap);
        window.clearTimeout(t.lead);
        t.swap = window.setTimeout(
          () => {
            const next = jobRef.current;
            if (next) show(next);
            setSwap(false);
            t.lead = window.setTimeout(() => motion.lead(Boolean(jobRef.current)), reduced ? 0 : GLIDE_MS);
          },
          reduced ? 0 : OUT_MS,
        );
      }
    } else if (shownRef.current && phaseRef.current === "open") {
      window.clearTimeout(t.close);
      t.close = window.setTimeout(() => {
        const card = motion.card();
        const back = returnTo.current;
        if (card && card.contains(document.activeElement)) {
          if (back && back.isConnected) back.focus({ preventScroll: true });
          else (document.activeElement as HTMLElement | null)?.blur();
        }
        returnTo.current = null;
        motion.origin();
        motion.lead(false);
        setPhase("closing");
        t.gone = window.setTimeout(
          () => {
            setPhase("closed");
            show(null);
            setSwap(false);
            motion.reset();
            lastH.current = 0;
          },
          (reduced ? FADE_MS : FOLD_MS) + 40,
        );
      }, CLOSE_GRACE_MS);
    }
  }, [job, mounted, motion, show, setPhase]);

  /* new content is in the DOM: size, place, open */
  const shownId = shown?.id;
  useLayoutEffect(() => {
    const card = motion.card();
    if (!card || !shownId) return;
    const t = timers.current;
    const L = motion.L;
    window.clearTimeout(t.height);
    card.style.height = "";
    card.style.transition = "";
    L.hold = false;
    motion.measure();
    const before = lastH.current;
    const after = L.h;
    lastH.current = after;
    motion.place(true);
    if (before && before !== after && phaseRef.current === "open" && !L.reduced) {
      // The box eases to its new size while the content is away.
      L.hold = true;
      card.style.height = `${before}px`;
      void card.offsetHeight;
      card.style.transition = `height ${GLIDE_MS}ms var(--ease-in-out-sym)`;
      card.style.height = `${after}px`;
      t.height = window.setTimeout(() => {
        card.style.height = "";
        card.style.transition = "";
        L.hold = false;
      }, GLIDE_MS + 40);
    }
    if (phaseRef.current !== "open" && jobRef.current) {
      motion.flush();
      setPhase("open");
      motion.lead(true);
    }
  }, [motion, shownId, setPhase]);

  /* the card changes size on its own (fonts, a wrapped line, the viewport) */
  useEffect(() => {
    const card = motion.card();
    if (!mounted || !card || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (motion.L.hold || !shownRef.current) return;
      motion.measure();
      motion.place(false);
    });
    ro.observe(card);
    return () => ro.disconnect();
  }, [motion, mounted]);

  /* focus: taken on open and on a switch when asked for; given back in the close path above */
  useEffect(() => {
    if (!shownId || phase !== "open") return;
    if (!(focusOnOpen === true || (focusOnOpen === "keyboard" && keyAt > pointerAt))) return;
    const card = motion.card();
    if (!card || card.contains(document.activeElement)) return;
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) returnTo.current = document.activeElement;
    card.focus({ preventScroll: true });
  }, [motion, shownId, phase, focusOnOpen]);

  /* Esc closes, from anywhere on the page, before anything else hears it */
  const isOpen = job !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("keydown", onEsc, true);
    return () => document.removeEventListener("keydown", onEsc, true);
  }, [isOpen]);

  const onSave = useCallback(() => {
    const id = shownRef.current?.id;
    if (!id) return;
    setSaved((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /** Nothing opens. The button presses, and the note under it lights up and is announced. */
  const onView = useCallback(() => {
    const t = timers.current;
    setPressed(true);
    setNudge(true);
    window.clearTimeout(t.press);
    window.clearTimeout(t.nudge);
    t.press = window.setTimeout(() => setPressed(false), 360);
    t.nudge = window.setTimeout(() => setNudge(false), 2400);
  }, []);

  const close = useCallback(() => closeRef.current(), []);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={motion.setRoot}
      className={cx("ffc", className)}
      data-open={phase === "open" ? "" : undefined}
      data-closing={phase === "closing" ? "" : undefined}
      data-swap={swap ? "out" : undefined}
    >
      <span ref={motion.setLeadEl} className="ffc-leader" aria-hidden="true">
        <i />
      </span>
      <div ref={motion.setPos} className="ffc-pos" inert={phase !== "open"}>
        <div className="ffc-fold">
          <div
            ref={motion.setCard}
            className="pp pp-role ffc-card"
            data-skin="night"
            data-fits={shown ? String(jobFits(shown)) : undefined}
            role="dialog"
            aria-modal="false"
            aria-label={shown ? jobLabel(shown) : undefined}
            tabIndex={-1}
          >
            <span className="ffc-sweep" aria-hidden="true" />
            {shown ? (
              <>
                <Body job={shown} hid={hid} saved={saved.has(shown.id)} pressed={pressed} nudge={nudge} onSave={onSave} onView={onView} />
                <button type="button" className="ffc-x" aria-label={fireflyCardCopy.card.close} onClick={close}>
                  <Icon name="x" size={16} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
});

const step = (i: number) => ({ "--i": i }) as CSSProperties;

type BodyProps = {
  job: FireflyJob;
  hid: string;
  saved: boolean;
  pressed: boolean;
  nudge: boolean;
  onSave: () => void;
  onView: () => void;
};

/** Everything that belongs to one job. Not keyed by job: a switch patches the text in place. */
const Body = memo(function Body({ job, hid, saved, pressed, nudge, onSave, onView }: BodyProps) {
  const c = fireflyCardCopy.card;
  const fits = jobFits(job);
  const where = whereParts(job);
  return (
    <div className="ffc-body">
      <header className="pp-role-h">
        <div className="pp-role-id">
          <div className="pp-role-t ffc-s" style={step(0)}>
            <h2 id={hid} className="pp-title">
              {job.title}
            </h2>
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

      {/* No data-lenis-prevent (the product's RoleDetail has it): in the story a wheel over the card
          must move the page, never stop on the card. A finger still scrolls a long sheet. */}
      <div className="pp-claims">
        <section className="pp-reasons" aria-labelledby={`${hid}-why`}>
          <div className="ffc-why ffc-s" style={step(4)}>
            <h3 id={`${hid}-why`} className="pp-h3">
              {c.why(job.fit)}
            </h3>
            <p className="ffc-src">
              {c.source}: {job.source}
            </p>
          </div>
          <ul>
            {job.reasons.map((r, i) => (
              <li key={i} className="pp-reason ffc-s" style={step(5 + i)}>
                <span className="ffc-mark" aria-hidden="true" />
                <span className="pp-reason-body">
                  <span className="ffc-reason-l">
                    {r.label}
                    <span className="pp-sr">: </span>
                  </span>
                  <span className="pp-reason-t">{r.text}</span>
                </span>
              </li>
            ))}
            {job.gap ? (
              <li key="gap" className="pp-reason ffc-s" style={step(5 + job.reasons.length)}>
                <span className="ffc-mark" data-gap="" aria-hidden="true" />
                <span className="pp-reason-body">
                  <span className="ffc-reason-l" data-gap="">
                    {c.gap}
                    <span className="pp-sr">: </span>
                  </span>
                  <span className="pp-reason-t">{job.gap}</span>
                </span>
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <footer className="pp-role-f ffc-s" style={step(9)}>
        <Button size="sm" variant="primary" icon="external" data-pressed={pressed ? "" : undefined} onClick={onView}>
          {c.view}
        </Button>
        <Button size="sm" icon={saved ? "bookmark-filled" : "bookmark"} aria-pressed={saved} onClick={onSave}>
          {saved ? c.saved : c.save}
        </Button>
        <p className="pp-quiet" data-nudge={nudge ? "" : undefined}>
          {c.note}
        </p>
        <span className="pp-sr" role="status">
          {nudge ? c.note : ""}
        </span>
      </footer>
    </div>
  );
});
