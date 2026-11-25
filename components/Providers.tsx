"use client";

import { MotionConfig } from "motion/react";

/** Honour the visitor's reduced-motion setting for every animation on the page. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
