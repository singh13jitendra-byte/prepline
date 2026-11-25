"use client";

import { useEffect, useRef, type RefObject } from "react";
import { matches } from "@/lib/content";
import { isSmallScreen, mountGL, prefersReducedMotion, webglAvailable } from "@/lib/gl";
import { gsap } from "@/lib/gsap";
import { onReveal } from "@/lib/intro";
import type { StageInput } from "./heroStage";

export type StageState = "pending" | "ready" | "fallback";

/**
 * Full-bleed WebGL layer for the hero: draws the video and the glass match cards.
 * Reports "fallback" when WebGL is missing or motion is reduced, so the hero can
 * show the plain HTML card instead.
 */
export function HeroStage({
  videoRef,
  slotRef,
  scrollRef,
  onState,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  slotRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<number>;
  onState: (s: StageState) => void;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (prefersReducedMotion() || !webglAvailable()) {
      onState("fallback");
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const input: StageInput = {
      video: videoRef.current,
      getSlot: () => {
        const s = slotRef.current;
        if (!s) return null;
        const a = s.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
      },
      scroll: 0,
      zoom: 1.16,
      pointer: { x: 0, y: 0, inside: false, type: "mouse" },
      revealedAt: -1,
    };

    const section = el.parentElement ?? el;
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      input.pointer.x = e.clientX - b.left;
      input.pointer.y = e.clientY - b.top;
      input.pointer.inside = true;
      input.pointer.type = e.pointerType;
    };
    const onLeave = () => {
      input.pointer.inside = false;
    };
    const stopReveal = onReveal(() => {
      input.revealedAt = performance.now() / 1000;
      gsap.to(input, { zoom: 1, duration: 2.2, ease: "expo.out" });
    });
    const tick = () => {
      input.scroll = scrollRef.current ?? 0;
    };
    gsap.ticker.add(tick);

    (async () => {
      const [mod] = await Promise.all([
        import("./heroStage"),
        Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]),
      ]);
      if (disposed) return;
      const ctrl = await mountGL(
        el,
        (THREE, size, renderer) => mod.buildHeroStage(THREE, size, renderer, matches, input, el),
        { animate: true, maxDpr: isSmallScreen() ? 1.5 : 1.75 },
      );
      if (!ctrl) {
        if (!disposed) onState("fallback");
        return;
      }
      if (disposed) return ctrl.dispose();
      section.addEventListener("pointermove", onMove);
      section.addEventListener("pointerleave", onLeave);
      onState("ready");
      cleanup = () => {
        section.removeEventListener("pointermove", onMove);
        section.removeEventListener("pointerleave", onLeave);
        ctrl.dispose();
      };
    })();

    return () => {
      disposed = true;
      stopReveal();
      gsap.ticker.remove(tick);
      cleanup?.();
    };
    // Mount once; refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} aria-hidden className="absolute inset-0 -z-10 touch-pan-y" />;
}
