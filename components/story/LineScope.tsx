"use client";

/**
 * LINE SCOPE — where the per-frame line variables live.
 *
 *   <LineScope>…</LineScope>                                  the wrapper gets all three variables
 *   <LineScope targets=".nav-pill" lineY={false}><Nav /></LineScope>
 *
 * Everything inside can read `var(--line-y)`, `var(--day-top)` and
 * `var(--day-side)` in CSS. The store writes them here every frame they change,
 * instead of on <html>, so only this subtree is restyled.
 *
 *   targets   a selector: write the variables on the matching descendants (the
 *             elements whose own rules read them) instead of on the wrapper.
 *             Use it when the readers are a few elements in a larger subtree.
 *   lineY     false leaves --line-y out. It moves on almost every scroll frame;
 *             --day-top only moves during a wipe. Split-at-the-wipe UI needs
 *             only the latter.
 *
 * The wrapper is `display: contents`: it makes no box and no stacking context,
 * so fixed layers inside keep their own z-index. StoryRoot wraps its `world`
 * prop in a full scope; app/page.tsx scopes the nav and the beat rail to their
 * split skins. Do not wrap an act in it: that would bring back the whole-page
 * restyle. Acts read story.get().line instead.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { story } from "@/lib/story";

export function LineScope({ children, targets, lineY = true }: { children: ReactNode; targets?: string; lineY?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced()) return;
    const els = targets ? Array.from(el.querySelectorAll<HTMLElement>(targets)) : [el];
    const offs = els.map((t) => story.lineScope(t, { lineY }));
    return () => offs.forEach((off) => off());
  }, [targets, lineY]);
  return (
    <div ref={ref} className="story-vars">
      {children}
    </div>
  );
}
