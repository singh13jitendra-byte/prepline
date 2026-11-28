"use client";

/**
 * <GardenScene /> — the garden: about fifteen 3D job flowers standing in the painted meadow.
 *
 * A drop-in for <FireflyScene /> (components/fireflies/scene/FireflyScene.tsx): the same props, the
 * same handle (components/fireflies/scene/types.ts), the same host element and CSS, so the explore
 * stop can swap one for the other with an import change and nothing else.
 *
 * This file is only the shell: a host element, the pointer wiring and one loop. The scene itself is
 * engine.ts, imported on mount, so none of three.js weighs on the page until a GardenScene mounts.
 *
 *   one loop       a single gsap.ticker callback calls engine.frame(dt). No React state changes per
 *                  frame, ever: the only thing that reaches React is `onFocus`.
 *   onFocus        (job, anchor) as the camera arrives on a flower, again when the anchor has moved by
 *                  more than a pixel, and (null, null) the moment the focus is left. `anchor` is the
 *                  flower's heart in viewport px; `r` its head's radius on screen.
 *   flowers        which jobs stand in the garden: every role that fits, plus three set aside so every
 *                  kind and stage shows (stage.ts). Open state is the job's stage; a focused flower
 *                  opens fully while its card is open and goes back to its stage when let go.
 *   focusJob(id)   flies to that job's flower. A job with no flower on stage borrows the nearest
 *                  stand-in (the same kind, the nearest fit) for the visit: onFocus still carries the
 *                  job asked for, anchored on the stand-in's heart.
 *   pausing        nothing is drawn while `active` is false (after the scene has wound back to the
 *                  painted meadow), while the host is off screen, or while the tab is hidden.
 *   the pointer    leaving the scene for another element (the card, the list) keeps the focus;
 *                  leaving the window, or resting on empty meadow, lets it go after a short grace.
 *   touch          a first tap marks a flower (it lights up); a second tap on it opens it. With a card
 *                  already open, one tap moves to another flower; a tap on empty meadow closes.
 *   re-target      from one flower straight to another, onFocus goes (jobA) → (jobB) with no (null)
 *                  between, so a card switches instead of closing and opening.
 *   docked card    where the card is a bottom sheet (`dockQuery`), a focused flower is framed in the
 *                  top part of the screen, and a hover holds until a click or tap on empty meadow.
 *   reduced motion no camera moves, no bloom: the flowers stay at their stage; onFocus still fires.
 *
 * Debug (lab and tests): window.__garden_scene (state, flowers(), focus(id), clear(), freeze, step).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { FireflyAnchor, FireflySceneHandle, FireflySceneProps } from "@/components/fireflies/scene/types";
import type { Garden } from "./engine";
import "@/components/fireflies/scene/scene.css";

export type { FireflyAnchor, FireflyFraming, FireflyJob, FireflySceneHandle, FireflySceneProps } from "@/components/fireflies/scene/types";
export type GardenSceneProps = FireflySceneProps;
export type GardenSceneHandle = FireflySceneHandle;

/** Where components/fireflies/card docks as a bottom sheet (its JOBCARD_DOCK_QUERY; kept in step by hand). */
const DOCK_QUERY = "(max-width: 839px), (max-height: 519px)";
/** A tap: the pointer went down and came up in nearly the same place, quickly. */
const TAP_SLOP = 10;
const TAP_MS = 700;

type DebugHook = {
  engine: Garden;
  readonly state: Garden["state"];
  readonly stats: Garden["stats"];
  /** Every flower, with its heart's position in viewport px. */
  flowers: () => ReturnType<Garden["flowers"]>;
  focus: (id: string) => void;
  clear: () => void;
  freeze: (on: boolean) => void;
  step: (dt: number, n?: number) => void;
};

const GardenScene = forwardRef<FireflySceneHandle, FireflySceneProps>(function GardenScene(props, ref) {
  const { active, jobs, reducedMotion, className, intro = "match", framing } = props;
  const host = useRef<HTMLDivElement>(null);
  const garden = useRef<Garden | null>(null);
  const live = useRef(props);
  live.current = props;
  const jobsKey = jobs.map((j) => j.id).join("|");
  const meadowScale = framing?.meadowScale;
  const grassLow = framing?.grassLow;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let g: Garden | null = null;
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
        const { Garden: Engine, PAGE_FRAMING } = await import("./engine");
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
        g = garden.current = made;
        const hook: DebugHook = {
          engine: made,
          get state() {
            return made.state;
          },
          get stats() {
            return made.stats;
          },
          flowers: () => {
            const r = measure();
            return made.flowers().map((f) => ({ ...f, x: r.left + f.x, y: r.top + f.y }));
          },
          focus: (id) => made.focusJob(list.findIndex((j) => j.id === id)),
          clear: () => made.clearFocus(),
          freeze: (on) => made.freeze(on),
          step: (dt, n) => made.step(dt, n),
        };
        (window as unknown as { __garden_scene?: DebugHook }).__garden_scene = hook;
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

        /* ── where the card docks, flowers are framed above it ── */
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
      if (g) {
        const w = window as unknown as { __garden_scene?: DebugHook };
        if (w.__garden_scene?.engine === g) delete w.__garden_scene;
        g.dispose();
      }
      garden.current = null;
      el.removeAttribute("data-on");
      el.removeAttribute("data-hot");
    };
    // The engine is rebuilt only when what it is built from changes: the set of jobs, the motion mode, the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey, reducedMotion, intro]);

  useEffect(() => {
    garden.current?.setActive(active);
  }, [active]);

  useEffect(() => {
    if (meadowScale === undefined && grassLow === undefined) return;
    const g = garden.current;
    if (!g) return;
    g.setFraming({ meadowScale, grassLow });
    g.redraw();
  }, [meadowScale, grassLow]);

  useImperativeHandle(
    ref,
    () => ({
      focusJob: (id: string) => {
        const g = garden.current;
        if (!g) return;
        g.focusJob(live.current.jobs.findIndex((j) => j.id === id));
      },
      clearFocus: () => garden.current?.clearFocus(),
      matchPage: () => {
        const el = host.current;
        const g = garden.current;
        const painted = document.querySelector<HTMLElement>(".sc-meadow");
        const grass = document.querySelector<HTMLElement>(".sc-grass");
        if (!el || !g || !painted) return false;
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
        g.setFraming(next);
        g.redraw();
        return true;
      },
    }),
    [],
  );

  return <div ref={host} aria-hidden="true" className={className ? `ffs gds ${className}` : "ffs gds"} data-intro={intro} data-active={active ? "" : undefined} />;
});

export default GardenScene;
