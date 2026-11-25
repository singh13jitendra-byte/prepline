"use client";

import { MotionConfig } from "motion/react";
import { SmoothScroll } from "./SmoothScroll";

/** Honour the visitor's reduced-motion setting for every animation on the page. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      {children}
    </MotionConfig>
  );
}
