"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/gl";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Inertial smooth scrolling (Lenis) on GSAP's ticker, so ScrollTrigger scenes
 * and Motion's scroll hooks see the same position. Touch keeps native scrolling.
 * Off for visitors who ask for reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1, anchors: true, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
