"use client";

/**
 * <FireflyScene /> — the 3D firefly meadow (research/fireflies-contract.md, builder 2).
 *
 * This file is only the shell: a host element, the pointer wiring and one loop. The scene itself
 * (three.js, the models, the shaders) is engine.ts, imported on mount, so none of it weighs on the
 * page until a FireflyScene is mounted.
 *
 *   one loop       a single gsap.ticker callback calls engine.frame(dt). No React state changes per
 *                  frame, ever: the only thing that reaches React is `onFocus`.
 *   onFocus        (job, anchor) as the camera arrives on a firefly, again when the anchor has
 *                  moved by more than a pixel (it rarely does: the camera follows the firefly), and
 *                  (null, null) the moment the focus is left. `anchor` also carries `r`, the
 *                  firefly's radius on screen (types.ts).
 *   pausing        nothing is drawn while `active` is false (after the scene has wound back to the
 *                  painted meadow), while the host is off screen, or while the tab is hidden.
 *   keyboard       the canvas is decorative (aria-hidden, never focusable). The accessible list
 *                  drives the camera through the ref: focusJob(id) / clearFocus().
 *   the pointer    leaving the scene for another element (the card, the list) keeps the focus;
 *                  leaving the window, or resting on empty meadow, lets it go after a short grace.
 *   re-target      from one firefly straight to another, onFocus goes (jobA) → (jobB) with no
 *                  (null) between, so a card switches instead of closing and opening.
 *   docked card    where the card is a bottom sheet (`dockQuery`), a focused firefly is framed in
 *                  the top third, and a hover holds until a click or tap on empty meadow.
 *
 * Debug (lab and tests): window.__ff is the engine (stats, state, freeze, step, screenOf).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { Meadow } from "./engine";
import type { FireflyAnchor, FireflySceneHandle, FireflySceneProps } from "./types";
import "./scene.css";

export type { FireflyAnchor, FireflyFraming, FireflyJob, FireflySceneHandle, FireflySceneProps } from "./types";

/** Where components/fireflies/card docks as a bottom sheet (its JOBCARD_DOCK_QUERY; kept in step by hand). */
const DOCK_QUERY = "(max-width: 839px), (max-height: 519px)";
/** A tap: the pointer went down and came up in nearly the same place, quickly. */
const TAP_SLOP = 10;
const TAP_MS = 700;

const FireflyScene = forwardRef<FireflySceneHandle, FireflySceneProps>(function FireflyScene(props, ref) {
  const { active, jobs, reducedMotion, className, intro = "match", framing } = props;
  const host = useRef<HTMLDivElement>(null);
  const meadow = useRef<Meadow | null>(null);
  // The latest props, for callbacks that outlive a render (the engine is not rebuilt for them).
  const live = useRef(props);
  live.current = props;
  const jobsKey = jobs.map((j) => j.id).join("|");
  const meadowScale = framing?.meadowScale;
  const grassLow = framing?.grassLow;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let m: Meadow | null = null;
    const offs: (() => void)[] = [];
    const rect = { left: 0, top: 0 };
    const measure = () => {
      const r = el.getBoundingClientRect();
      rect.left = r.left;
      rect.top = r.top;
      return r;
    };
    const reduced = reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 767px)").matches || (window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 600);
    const list = live.current.jobs;
    el.dataset.state = "loading";

    void (async () => {
      try {
        if (!list.length) throw new Error("no-jobs");
        const { Meadow: Engine, PAGE_FRAMING } = await import("./engine");
        if (dead) return;
        let focused = -1;
        const made = await Engine.create({
          host: el,
          jobs: list,
          reduced,
          phone,
          intro,
          framing: { ...PAGE_FRAMING, ...live.current.framing },
          onFocus: (job, x, y, r) => {
            if (job < 0) {
              focused = -1;
              live.current.onFocus(null, null);
              return;
            }
            if (focused !== job) measure();
            focused = job;
            const anchor: FireflyAnchor = { x: rect.left + x, y: rect.top + y, r };
            live.current.onFocus(list[job], anchor);
          },
          onHot: (hot) => el.toggleAttribute("data-hot", hot),
        });
        if (dead) {
          made.dispose();
          return;
        }
        m = meadow.current = made;
        (window as unknown as { __ff?: Meadow }).__ff = made;
        el.appendChild(made.canvas);
        made.setActive(live.current.active);

        /* ── the one loop ── */
        let on = false;
        const tick = (_time: number, deltaMs: number) => {
          made.frame(deltaMs / 1000);
          const run = made.running;
          if (run !== on) el.toggleAttribute("data-on", (on = run));
        };
        gsap.ticker.add(tick);
        offs.push(() => gsap.ticker.remove(tick));

        /* ── pause off screen and in a hidden tab ── */
        let seen = true;
        const vis = () => made.setVisible(seen && !document.hidden);
        const io = new IntersectionObserver((entries) => {
          seen = entries[entries.length - 1].isIntersecting;
          vis();
        });
        io.observe(el);
        document.addEventListener("visibilitychange", vis);
        offs.push(() => (io.disconnect(), document.removeEventListener("visibilitychange", vis)));

        /* ── where the card docks, fireflies are framed above it ── */
        const dock = window.matchMedia(live.current.dockQuery ?? DOCK_QUERY);
        const onDock = () => made.setDocked(dock.matches);
        onDock();
        dock.addEventListener("change", onDock);
        offs.push(() => dock.removeEventListener("change", onDock));

        /* ── size ── */
        const ro = new ResizeObserver(() => {
          const r = measure();
          if (r.width < 1 || r.height < 1) return;
          made.resize(r.width, r.height);
          made.redraw();
        });
        ro.observe(el);
        offs.push(() => ro.disconnect());

        /* ── pointer ── */
        const down = { x: 0, y: 0, t: 0, id: -1 };
        const onMove = (e: PointerEvent) => {
          if (e.pointerType === "touch" || !live.current.active) return;
          made.pointerMove(e.clientX - rect.left, e.clientY - rect.top, true);
        };
        const onEnter = () => measure();
        const onLeave = (e: PointerEvent) => {
          if (e.pointerType === "touch") return;
          const to = e.relatedTarget;
          made.pointerLeave(to instanceof Element && !el.contains(to));
        };
        const onDown = (e: PointerEvent) => {
          if (!e.isPrimary || e.button > 0) return;
          measure();
          down.x = e.clientX;
          down.y = e.clientY;
          down.t = performance.now();
          down.id = e.pointerId;
        };
        const onUp = (e: PointerEvent) => {
          if (e.pointerId !== down.id || !live.current.active) return;
          down.id = -1;
          if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP || performance.now() - down.t > TAP_MS) return;
          made.tap(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === "touch");
        };
        const onCancel = () => (down.id = -1);
        el.addEventListener("pointermove", onMove, { passive: true });
        el.addEventListener("pointerenter", onEnter, { passive: true });
        el.addEventListener("pointerleave", onLeave, { passive: true });
        el.addEventListener("pointerdown", onDown, { passive: true });
        el.addEventListener("pointerup", onUp, { passive: true });
        el.addEventListener("pointercancel", onCancel, { passive: true });
        offs.push(() => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerenter", onEnter);
          el.removeEventListener("pointerleave", onLeave);
          el.removeEventListener("pointerdown", onDown);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onCancel);
        });

        /* ── a lost context: say so; the host can remount (change `key`) ── */
        const onLost = (e: Event) => {
          e.preventDefault();
          made.setVisible(false);
          el.dataset.state = "failed";
          live.current.onFocus(null, null);
          live.current.onError?.("context-lost");
        };
        made.canvas.addEventListener("webglcontextlost", onLost);
        offs.push(() => made.canvas.removeEventListener("webglcontextlost", onLost));

        el.dataset.state = "ready";
        live.current.onReady?.();
      } catch (err) {
        if (dead) return;
        el.dataset.state = "failed";
        live.current.onError?.(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      dead = true;
      offs.forEach((off) => off());
      if (m) {
        const w = window as unknown as { __ff?: Meadow };
        if (w.__ff === m) delete w.__ff;
        m.dispose();
      }
      meadow.current = null;
      el.removeAttribute("data-on");
      el.removeAttribute("data-hot");
    };
    // The engine is rebuilt only when what it is built from changes: the set of jobs, the motion mode, the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey, reducedMotion, intro]);

  useEffect(() => {
    meadow.current?.setActive(active);
  }, [active]);

  useEffect(() => {
    if (meadowScale === undefined && grassLow === undefined) return;
    const m = meadow.current;
    if (!m) return;
    m.setFraming({ meadowScale, grassLow });
    m.redraw();
  }, [meadowScale, grassLow]);

  useImperativeHandle(
    ref,
    () => ({
      focusJob: (id: string) => {
        const m = meadow.current;
        if (!m) return;
        m.focusJob(live.current.jobs.findIndex((j) => j.id === id));
      },
      clearFocus: () => meadow.current?.clearFocus(),
      matchPage: () => {
        const el = host.current;
        const m = meadow.current;
        const painted = document.querySelector<HTMLElement>(".sc-meadow");
        const grass = document.querySelector<HTMLElement>(".sc-grass");
        if (!el || !m || !painted) return false;
        const box = el.getBoundingClientRect();
        const pr = painted.getBoundingClientRect();
        if (pr.width < 1 || box.width < 1) return false;
        const ar = pr.width / pr.height;
        const next: { meadowScale: number; grassLow?: number } = { meadowScale: pr.width / Math.max(box.width, box.height * ar) };
        const gr = grass?.getBoundingClientRect();
        if (gr && gr.width > 1) {
          // The grass's cover box stands on the bottom edge; what is left is how far it has been lowered.
          const gh = Math.max(box.width, (box.height * gr.width) / gr.height) / (gr.width / gr.height);
          next.grassLow = (gr.top - box.top - (box.height - gh)) / box.height;
        }
        m.setFraming(next);
        m.redraw();
        return true;
      },
    }),
    [],
  );

  return <div ref={host} aria-hidden="true" className={className ? `ffs ${className}` : "ffs"} data-intro={intro} data-active={active ? "" : undefined} />;
});

export default FireflyScene;
