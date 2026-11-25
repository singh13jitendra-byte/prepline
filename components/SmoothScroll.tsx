"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { story } from "@/lib/story";

let instance: Lenis | null = null;
/** The page's Lenis instance, if smooth scrolling is on. Prefer story.scrollToBeat / scrollToAct. */
export const getLenis = () => instance;

/**
 * Scroll wiring (storyboard 5.5).
 *
 * - Lenis with autoRaf off, driven from gsap.ticker ahead of everything else,
 *   so the frame order is Lenis → ScrollTrigger → story store → Actor → Line → world.
 *   Touch keeps native scrolling. Off under reduced motion.
 * - ScrollTrigger ignores mobile URL-bar resizes, and is refreshed once fonts
 *   have loaded and 150ms after the last resize.
 * - Hash links are not handled by Lenis (`anchors` is off): StoryRoot routes
 *   them, because an act's hash must land inside a beat, not on the section top.
 * - `?lenis=0` turns Lenis off (native scrolling) to test the story without it.
 */
export function SmoothScroll() {
  useEffect(() => {
    ScrollTrigger.config({ ignoreMobileResize: true });

    let timer = 0;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    window.addEventListener("resize", refresh, { passive: true });
    document.fonts?.ready.then(refresh).catch(() => {});

    let stopLenis = () => {};
    const native = new URLSearchParams(window.location.search).get("lenis") === "0";
    if (!story.reduced() && !native) {
      const lenis = new Lenis({ lerp: 0.1, anchors: false, autoRaf: false });
      instance = lenis;
      story.attachLenis(lenis);
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      // Prioritised: Lenis runs before ScrollTrigger's own ticker callback.
      gsap.ticker.add(tick, false, true);
      gsap.ticker.lagSmoothing(0);
      stopLenis = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        story.attachLenis(null);
        instance = null;
      };
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
      stopLenis();
    };
  }, []);
  return null;
}
