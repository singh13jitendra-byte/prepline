"use client";

/**
 * THE LANTERN — the cursor carries a little of the desk lamp's light (delight 2).
 *
 * In the night scenes (the hero room, the meadow, the prep desk) a soft warm pool follows a fine
 * pointer: one small fixed element, a radial gradient in the lamp's own colours, screen-blended
 * over the painting and under the copy, moved with transform only. It eases after the pointer
 * (lerp 0.18 per 60th of a second) and breathes on a CSS animation (compositor only).
 * Where day has come (board, seat, founder note) it is out; under the Line's sweep it goes out
 * as the day crosses it.
 *
 * The fireflies answer it in their own shader (fieldScene.ts, uLens): near it they brighten and
 * drift a little toward it, like moths, and the ones already set aside glow again as embers.
 * When the pointer rests for 250ms by a firefly, the canvas loop names it (worldBus.pick) and
 * this component shows one small tag beside it on a night slip, with a 1px leader: the role,
 * its score once it has one, and what the reading decided. The named firefly holds still while
 * it is read, so the tag is written once and then left alone.
 *
 * Cost: pointer events only move the store's target (lib/story.ts). Everything here runs in the
 * store's frame loop and writes only when a value changes: at rest, nothing is written at all.
 * Only the lantern, the tag and the hint are ever restyled; no painted layer is touched.
 *
 * Off: touch and coarse pointers (never mounted), reduced motion (the store does not run, so
 * nothing here does), keyboard (aria-hidden, never focusable, no pointer events).
 */

import { useEffect, useRef } from "react";
import { storyCopy } from "@/lib/content";
import { story, type StoryState } from "@/lib/story";
import { worldBus } from "./bus";

/** Half the pool's box (CSS px). Its light reaches about two thirds of this. */
const R = 190;
/** Lerp per 60th of a second. */
const EASE = 0.18;
const HINT_KEY = "prepline:lantern-hint";
const HINT_AFTER = 2;
const HINT_FOR = 2.8;

const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

function hinted(): boolean {
  try {
    return window.sessionStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}
function markHinted() {
  try {
    window.sessionStorage.setItem(HINT_KEY, "1");
  } catch {
    /* private mode: the hint simply does not come back this page view */
  }
}

export function Lantern() {
  const glow = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glow.current;
    const tg = tag.current;
    const hn = hint.current;
    if (!el || !tg || !hn) return;
    if (story.reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const roleEl = tg.querySelector<HTMLElement>("[data-role]");
    const scoreEl = tg.querySelector<HTMLElement>("[data-score]");
    const noteEl = tg.querySelector<HTMLElement>("[data-note]");

    // The tag steps back over anything you can press or type in.
    const onOver = (e: PointerEvent) => {
      worldBus.overControl = Boolean((e.target as Element | null)?.closest?.("a,button,input,textarea,select,label,[role='button']"));
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    const onFirst = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      worldBus.pointerMoved = true;
      window.removeEventListener("pointermove", onFirst);
    };
    window.addEventListener("pointermove", onFirst, { passive: true });

    const L = worldBus.lantern;
    let lastT = "";
    let lastO = "";
    let on = false;
    let lastPx = NaN;
    let lastPy = NaN;
    let shownSeq = -1;
    let hintDone = hinted();
    let hintT = -1; // seconds the hint has been up, -1 while it is down
    let meadowT = 0; // seconds spent in the meadow with the lantern lit

    const showHint = (x: number, y: number, vw: number) => {
      const flip = x + 24 + 150 > vw;
      hn.style.transform = `translate3d(${Math.round(flip ? x - 18 : x + 18)}px,${Math.round(y + 20)}px,0)`;
      hn.toggleAttribute("data-flip", flip);
      hn.setAttribute("data-on", "");
      hintT = 0;
      hintDone = true;
      markHinted();
    };
    const hideHint = () => {
      if (hintT < 0) return;
      hn.removeAttribute("data-on");
      hintT = -1;
    };

    const frame = (_t: number, dt: number, s: Readonly<StoryState>) => {
      const fine = s.pointer.fine && !s.flags.coarse;
      // Night is above the day line: the whole screen in a night beat, the top part under a sweep.
      const night = s.pointer.y < s.dayTop;
      const want = fine && worldBus.pointerMoved && s.pointer.inside && night ? 1 : 0;

      // How long the pointer has been still (the store moves the target; nothing else does).
      if (s.pointer.x !== lastPx || s.pointer.y !== lastPy) {
        lastPx = s.pointer.x;
        lastPy = s.pointer.y;
        L.rest = 0;
      } else L.rest += dt;
      L.px = s.pointer.x;
      L.py = s.pointer.y;

      if (want && L.k === 0) {
        // Lit where the pointer is: it never sweeps in from a corner.
        L.x = s.pointer.x;
        L.y = s.pointer.y;
      }
      const k = 1 - Math.pow(1 - EASE, dt * 60);
      L.x += (s.pointer.x - L.x) * k;
      L.y += (s.pointer.y - L.y) * k;
      if (Math.abs(s.pointer.x - L.x) < 0.05 && Math.abs(s.pointer.y - L.y) < 0.05) {
        L.x = s.pointer.x;
        L.y = s.pointer.y;
      }
      L.k = damp(L.k, want, want ? 7 : 5, dt);
      if (L.k < 0.004) L.k = 0;
      if (L.k > 0.996) L.k = 1;
      L.names = L.k > 0.5 && !worldBus.overControl;

      /* the pool: transform and opacity, only when they change */
      const lit = L.k > 0;
      if (lit !== on) {
        on = lit;
        el.toggleAttribute("data-on", lit);
      }
      if (lit) {
        const t = `translate3d(${(L.x - R).toFixed(1)}px,${(L.y - R).toFixed(1)}px,0)`;
        if (t !== lastT) el.style.transform = lastT = t;
      }
      const o = L.k >= 1 ? "1" : L.k.toFixed(2);
      if (o !== lastO) el.style.opacity = lastO = o;

      /* the tag: written once per pick */
      const pk = worldBus.pick;
      if (pk.seq !== shownSeq) {
        shownSeq = pk.seq;
        const g = pk.tag;
        if (pk.id >= 0 && g && roleEl && scoreEl && noteEl) {
          roleEl.textContent = g.role;
          scoreEl.textContent = g.score;
          noteEl.textContent = g.note;
          const vw = s.viewport.w || window.innerWidth;
          const side = `${pk.y < 72 ? "s" : "n"}${pk.x > vw - 300 ? "w" : "e"}`;
          tg.style.transform = `translate3d(${pk.x.toFixed(1)}px,${pk.y.toFixed(1)}px,0)`;
          tg.dataset.side = side;
          tg.dataset.verdict = g.verdict;
          tg.setAttribute("data-on", "");
          hideHint();
          if (!hintDone) {
            hintDone = true;
            markHinted();
          }
        } else tg.removeAttribute("data-on");
      }

      /* the hint: once per session, after two seconds in the meadow with the lantern lit and
         nothing named yet (a tag that shows first makes it unnecessary) */
      const meadow = s.beat === "pass1" || s.beat === "pass2";
      if (hintT >= 0) {
        hintT += dt;
        if (hintT > HINT_FOR || !L.names || !meadow) hideHint();
      } else if (!hintDone && L.names && worldBus.glReady && meadow) {
        meadowT += dt;
        if (meadowT >= HINT_AFTER && pk.id < 0) showHint(s.pointer.x, s.pointer.y, s.viewport.w || window.innerWidth);
      }
    };
    const off = story.frame("world", frame);
    // Verification (like window.__world): where the lantern is and what it names.
    (window as unknown as { __lantern?: unknown }).__lantern = { lantern: L, pick: worldBus.pick };

    return () => {
      off();
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointermove", onFirst);
      worldBus.overControl = false;
      L.k = 0;
      L.names = false;
    };
  }, []);

  return (
    <>
      <div ref={glow} aria-hidden="true" data-lantern className="lantern only-motion">
        <div className="lantern-pool" />
      </div>
      <div ref={tag} aria-hidden="true" data-lantern-tag className="lantern-tag only-motion" data-side="ne">
        <span className="lantern-leader" />
        <span className="lantern-chip slip-night" data-size="s">
          <span className="lantern-role">
            <span data-role />
            <span className="lantern-score" data-score />
          </span>
          <span className="lantern-note">
            <span className="lantern-dot" />
            <span data-note />
          </span>
        </span>
      </div>
      <div ref={hint} aria-hidden="true" data-lantern-hint className="lantern-hint slip-night only-motion" data-size="s">
        {storyCopy.lantern.hint}
      </div>
    </>
  );
}
