"use client";

/**
 * NAV — floating pill with two skins, split at the line (storyboard 3 "Nav").
 *
 * - Clear over the hero, frosted from the first reading pass on.
 * - Night glass on night chapters, day paper on day chapters. During a wipe both
 *   skins are drawn and each is clipped at the line (--day-top), like the stages.
 *   The base copy is the real one (keyboard, screen readers); the second copy is
 *   aria-hidden and only there for the split.
 * - Hides upward while you scroll down through the hinge and the prep beats;
 *   comes back on any upward scroll, on keyboard focus, and near the top edge.
 * - Links to #board, #prep and #join are routed by StoryRoot into the right beat.
 * - Under 768px: logo, CTA and a menu button.
 *
 * Delight 9, small touches on the CTA:
 * - A firefly orbits it: one lamp dot on a slow loop that hugs the pill, pausing once a lap to
 *   blink. Pure CSS animation (transform and opacity), aria-hidden, gone under reduced motion.
 *   During a wipe the overlay copy's firefly is put on the base one's clock, once per wipe.
 * - It leans up to 3.5px toward a nearby fine pointer (a CSS transition carries it; a write
 *   happens only on pointer moves near the nav, never per frame).
 * - Seat docked: on `prepline:seat-docked` { seat } (the ticket stub lands here) the CTA
 *   ignites, then its label crossfades to "Seat 13 saved" with a check. `prepline:seat-claimed`
 *   { ring } is the fallback if no stub arrives. Remembered for the session; still a link to
 *   #join. The two labels share one grid cell, so the pill never changes width.
 */

import { useEffect, useRef, useState } from "react";
import { storyCopy } from "@/lib/content";
import { landmarks } from "@/components/acts/after/copy";
import { BEATS, story, type ActId, type BeatId } from "@/lib/story";
import { installRowTilt } from "@/components/product/tilt";
import "./chrome.css";

const HIDE_IN: readonly BeatId[] = ["hinge", "nightfall", "unfold", "q1", "q2", "q3", "votes"];
const LINK_ACT: Record<string, ActId> = { "#board": "board", "#prep": "prep", "#join": "seat" };
const idx = (b: BeatId) => BEATS.findIndex((x) => x.id === b);
/** Session memory of a saved seat. */
const SEAT_KEY = "prepline:seat";
/** How long a claimed seat waits for its stub to dock before the CTA changes anyway (ms). */
const DOCK_WAIT = 3200;
/** The ignite and the label crossfade, end to end (ms): `data-fresh` comes off after it. */
const FRESH_MS = 1300;
/** The lean toward a nearby pointer: at most LEAN px, felt from REACH px outside the CTA. */
const LEAN = 3.5;
const REACH = 64;
const seatOf = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 && n < 1000 ? n : null);

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="cta-arrow" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * The B mark (brand/direction-b.html): a one-stroke p whose descender runs on as the line,
 * here underlining the Young Serif wordmark. Lamp on night, pine on day.
 */
export function Lockup() {
  return (
    <>
      <svg className="nav-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M19 37C41 37 50 33 50 25.5C50 17 41 13 30 13L24.5 13C20.5 13 19 15 19 18.5L19 53C19 57 22 59 27 59L60 59" />
      </svg>
      <span className="nav-word">
        {storyCopy.nav.brand}
        <svg className="nav-tail" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M0 4C30 5.5 64 2.4 100 4.6" vectorEffect="non-scaling-stroke" />
        </svg>
      </span>
    </>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="cta-check" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

type Seat = { n: number | null; fresh: boolean };

function PillContent({ live, open, onMenu, seat }: { live: boolean; open?: boolean; onMenu?: () => void; seat: Seat }) {
  const t = live ? undefined : -1;
  const saved = seat.n !== null;
  const cta = (
    <span className="nav-cta-wrap" data-cta-wrap="">
      <span className="nav-cta-ignite" aria-hidden="true" />
      <a href="#join" className="cta nav-cta" tabIndex={t} data-saved={saved ? "" : undefined} data-fresh={seat.fresh ? "" : undefined}>
        <span className="nav-cta-labels">
          <span className="cta-label nav-cta-label" data-label="ask" aria-hidden={saved ? true : undefined}>
            {storyCopy.nav.cta}
            <Arrow />
          </span>
          <span className="cta-label nav-cta-label" data-label="saved" aria-hidden={saved ? undefined : true}>
            {storyCopy.nav.ctaSaved.replace("{seat}", String(seat.n ?? 13))}
            <Check />
          </span>
        </span>
      </a>
      <span className="nav-fly" aria-hidden="true">
        <i />
      </span>
    </span>
  );
  return (
    <>
      <a
        href="#read"
        className="nav-brand"
        tabIndex={t}
        aria-label={live ? storyCopy.nav.brand : undefined}
        onClick={(e) => {
          e.preventDefault();
          story.scrollToBeat("hero", 0);
        }}
      >
        <Lockup />
      </a>
      <nav aria-label={live ? landmarks.sections : undefined}>
        <ul className="nav-links">
          {storyCopy.nav.links.map((l) => (
            <li key={l.label}>
              <a href={l.href} className="nav-link" data-act={LINK_ACT[l.href]} tabIndex={t}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav-right">
        {cta}
        <button
          type="button"
          className="nav-menu-btn"
          tabIndex={t}
          aria-label={live ? storyCopy.nav.menu : undefined}
          aria-expanded={live ? Boolean(open) : undefined}
          aria-controls={live ? "nav-menu" : undefined}
          onClick={onMenu}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

export function Nav() {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [seat, setSeat] = useState<Seat>({ n: null, fresh: false });

  // A saved seat: restored from the session silently, or arriving live (docked, or claimed as fallback).
  useEffect(() => {
    try {
      const n = seatOf(Number(window.sessionStorage.getItem(SEAT_KEY)));
      if (n !== null) setSeat({ n, fresh: false });
    } catch {}
    let wait = 0;
    let freshTimer = 0;
    let have = false;
    const save = (n: number) => {
      window.clearTimeout(wait);
      if (have) return;
      have = true;
      try {
        window.sessionStorage.setItem(SEAT_KEY, String(n));
      } catch {}
      setSeat({ n, fresh: !story.reduced() });
      freshTimer = window.setTimeout(() => setSeat((s) => (s.fresh ? { ...s, fresh: false } : s)), FRESH_MS);
    };
    const onDocked = (e: Event) => {
      const n = seatOf((e as CustomEvent<{ seat?: unknown }>).detail?.seat);
      if (n !== null) save(n);
    };
    const onClaimed = (e: Event) => {
      const n = seatOf((e as CustomEvent<{ ring?: unknown }>).detail?.ring);
      if (n === null || have) return;
      window.clearTimeout(wait);
      if (story.reduced()) save(n);
      else wait = window.setTimeout(() => save(n), DOCK_WAIT);
    };
    window.addEventListener("prepline:seat-docked", onDocked);
    window.addEventListener("prepline:seat-claimed", onClaimed);
    return () => {
      window.clearTimeout(wait);
      window.clearTimeout(freshTimer);
      window.removeEventListener("prepline:seat-docked", onDocked);
      window.removeEventListener("prepline:seat-claimed", onClaimed);
    };
  }, []);

  // Rows tilt under a fine pointer (one delegated listener for the page; see product/tilt.ts).
  useEffect(() => installRowTilt(), []);

  // The CTA leans toward a nearby fine pointer. Both copies lean together, so the split stays true.
  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced() || !window.matchMedia("(pointer: fine)").matches) return;
    const wraps = () => el.querySelectorAll<HTMLElement>("[data-cta-wrap]");
    let raf = 0;
    let px = -1e4;
    let py = -1e4;
    let last = "";
    const lean = () => {
      raf = 0;
      const base = el.querySelector<HTMLElement>(".nav-base [data-cta-wrap]");
      if (!base) return;
      let x = 0;
      let y = 0;
      if (py < 160 && !el.hasAttribute("data-hidden")) {
        const r = base.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Distance from the pointer to the CTA's box (0 inside it), and the lean it earns.
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        const k = Math.max(0, 1 - Math.hypot(dx, dy) / REACH);
        if (k > 0) {
          // Direction: toward the pointer, measured against the pill's own shape. It fades out
          // near the centre (no flip-flopping over the label) and eases in with distance.
          const ox = (px - cx) / (r.width / 2);
          const oy = (py - cy) / (r.height / 2);
          const m = Math.hypot(ox, oy) || 1;
          const s = LEAN * k * k * (3 - 2 * k) * Math.min(1, m * 1.5);
          x = (ox / m) * s;
          y = (oy / m) * s * 0.6;
        }
      }
      const t = x === 0 && y === 0 ? "" : `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      if (t === last) return;
      last = t;
      wraps().forEach((w) => (w.style.transform = t));
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      // Far below the nav and already at rest: nothing to do, not even a read.
      if (py >= 160 && last === "") return;
      if (!raf) raf = requestAnimationFrame(lean);
    };
    const leave = () => {
      px = py = -1e4;
      if (!raf) raf = requestAnimationFrame(lean);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced()) return;
    let hidden = false;
    let act = "";
    let travelled = 0;
    let lastPos = 0;
    let wiping = false;
    const links = () => el.querySelectorAll<HTMLElement>(".nav-link[data-act]");
    // The overlay copy only exists on screen during a wipe, and its CSS animations start when it
    // appears: put its firefly on the base firefly's clock, so the two halves show one firefly.
    const syncFly = () => {
      const from = el.querySelectorAll<HTMLElement>(".nav-base .nav-fly, .nav-base .nav-fly i");
      const to = el.querySelectorAll<HTMLElement>(".nav-overlay .nav-fly, .nav-overlay .nav-fly i");
      to.forEach((node, i) => {
        const a = from[i]?.getAnimations()[0];
        const b = node.getAnimations()[0];
        if (a && b && a.startTime !== null) b.startTime = a.startTime;
      });
    };
    return story.subscribe((s) => {
      const wipe = document.documentElement.hasAttribute("data-wipe");
      if (wipe !== wiping) {
        wiping = wipe;
        if (wipe) syncFly();
      }
      // Hide on a real downward scroll inside the quiet beats; return on any upward scroll.
      const dPos = s.pos - lastPos;
      lastPos = s.pos;
      travelled = dPos > 0 ? travelled + dPos : 0;
      const nearTop = s.pointer.fine && s.pointer.inside && s.pointer.y < 72;
      let want = hidden;
      if (!HIDE_IN.includes(s.beat) || nearTop || dPos < -0.05) want = false;
      else if (travelled > 2.5) want = true;
      if (want !== hidden) {
        hidden = want;
        el.toggleAttribute("data-hidden", hidden);
      }
      // The current act's link carries a dot.
      const i = idx(s.beat);
      const current = i >= idx("seat") || s.beat === "dawn" ? "seat" : i >= idx("unfold") || s.beat === "nightfall" ? "prep" : i >= idx("saved") ? "board" : "read";
      if (current !== act) {
        act = current;
        links().forEach((a) => {
          if (a.dataset.act === act) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      }
    });
  }, []);

  // Close the menu on Escape or after following a link.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header ref={ref} className="nav" data-open={open ? "" : undefined}>
      <div className="nav-stack">
        <div className="nav-pill nav-base">
          <PillContent live open={open} onMenu={() => setOpen((o) => !o)} seat={seat} />
        </div>
        <div className="nav-pill nav-overlay" data-skin-overlay="" aria-hidden="true">
          <PillContent live={false} onMenu={() => setOpen((o) => !o)} seat={seat} />
        </div>
      </div>
      {open ? (
        <nav id="nav-menu" className="nav-menu" aria-label={storyCopy.nav.menu}>
          {[...storyCopy.nav.links, { href: "#join", label: seat.n !== null ? storyCopy.nav.ctaSaved.replace("{seat}", String(seat.n)) : storyCopy.nav.cta }].map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
