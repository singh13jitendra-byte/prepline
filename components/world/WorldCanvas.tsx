"use client";

/**
 * WORLD CANVAS — one fixed, transparent WebGL canvas for the whole page, two
 * draw calls (fieldScene.ts, lightPass.ts), driven from the story's frame loop.
 * This file is only the shell: the runtime and Three are imported on idle.
 *
 * Budget rules (storyboard 5.6)
 * - Nothing here is in the first-load bundle but this shell. Until the world's
 *   first frame, and for good when WebGL is missing, the device is small with
 *   4 or fewer cores, or Save-Data is on, <CssField /> is the field.
 * - It draws only when something it shows changed, or when a time-based thing
 *   is on screen (drift at night, the dawn light, the load, a flight). On the
 *   day board it draws on scroll only. A hidden tab draws nothing.
 * - DPR is capped at 1.75 (1.5 small) and steps down to 1.25, then 1.0, when
 *   the average of 60 frames is over 20ms.
 * - Reduced motion: never mounts.
 *
 * Testing: ?world=css forces the fallback, ?world=gl forces WebGL.
 * window.__world holds draw calls, DPR and the 60-frame average.
 */

import { useEffect, useRef } from "react";
import { webglAvailable } from "@/lib/gl";
import { story } from "@/lib/story";
import { worldOverride } from "./bus";

function shouldMount(): boolean {
  const force = worldOverride();
  if (force === "css") return false;
  if (!webglAvailable()) return false;
  if (force === "gl") return true;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  const small = window.matchMedia("(max-width: 767px)").matches;
  if (small && (navigator.hardwareConcurrency ?? 8) <= 4) return false;
  return true;
}

export function WorldCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || story.reduced() || !shouldMount()) return;

    let disposed = false;
    let dispose: (() => void) | null = null;
    const small = window.matchMedia("(max-width: 767px)").matches;

    const boot = async () => {
      try {
        const { startWorld } = await import("./worldRuntime");
        if (disposed) return;
        const stop = await startWorld(el, small);
        if (disposed) stop();
        else dispose = stop;
      } catch {
        /* the CSS field stays */
      }
    };

    const w = window as Window & { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const viaIdle = typeof w.requestIdleCallback === "function";
    const handle = viaIdle ? w.requestIdleCallback!(() => void boot(), { timeout: 900 }) : window.setTimeout(() => void boot(), 120);

    return () => {
      disposed = true;
      if (viaIdle) w.cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
      dispose?.();
    };
  }, []);

  return <div ref={host} aria-hidden="true" data-world-canvas className="world-canvas only-motion" />;
}
