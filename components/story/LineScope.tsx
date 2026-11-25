"use client";

/**
 * LINE SCOPE — where the per-frame line variables live.
 *
 *   <LineScope>
 *     <Nav />
 *   </LineScope>
 *
 * Everything inside can read `var(--line-y)`, `var(--day-top)` and
 * `var(--day-side)` in CSS. The store writes them on this wrapper every frame
 * they change, instead of on <html>, so only this subtree is restyled.
 *
 * The wrapper is `display: contents`: it makes no box and no stacking context,
 * so fixed layers inside keep their own z-index. StoryRoot already wraps its
 * `world` and `chrome` props in a scope each; use this for fixed UI that
 * lives outside StoryRoot (the nav header). Do not wrap an act in it: that
 * would bring back the whole-page restyle. Acts read story.get().line instead.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { story } from "@/lib/story";

export function LineScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || story.reduced()) return;
    return story.lineScope(ref.current);
  }, []);
  return (
    <div ref={ref} className="story-vars">
      {children}
    </div>
  );
}
