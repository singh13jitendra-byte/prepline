"use client";

/**
 * LINE SCOPE — where the per-frame line variables live.
 *
 *   <LineScope targets=".nav-pill" lineY={false}><Nav /></LineScope>
 *   <LineScope><div className="reader" /></LineScope>          no targets: the wrapper's children
 *
 * The store writes `--line-y`, `--day-top` and `--day-side` every frame they
 * change on each target element, never on <html>. The three are registered in
 * app/globals.css as NON-INHERITED properties, so a write restyles the target
 * alone and not its subtree: the element whose own rule says var(--day-top)
 * must itself be a target. A descendant of a target reads the static defaults.
 *
 *   targets   a selector for the readers inside (default: the direct children).
 *   lineY     false leaves --line-y out. It moves on almost every scroll frame;
 *             --day-top only moves during a wipe. Split-at-the-wipe UI needs
 *             only the latter. With `targets`, it may also be a selector: only
 *             the targets that match it take --line-y.
 * Targets that mount later (lazy layers) are picked up as they appear.
 *
 * The wrapper is `display: contents`: it makes no box and no stacking context,
 * so fixed layers inside keep their own z-index. StoryRoot wraps its `world`
 * prop with its readers as targets; app/page.tsx scopes the nav and the beat rail to their
 * split skins. Do not wrap an act in it: that would bring back the whole-page
 * restyle. Acts read story.get().line instead.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { story } from "@/lib/story";

export function LineScope({ children, targets, lineY = true }: { children: ReactNode; targets?: string; lineY?: boolean | string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced()) return;
    const sel = targets ?? ":scope > *";
    // Targets may mount later (lazy world layers): keep the set in step with the subtree.
    const live = new Map<HTMLElement, () => void>();
    const sync = () => {
      const now = new Set(el.querySelectorAll<HTMLElement>(sel));
      live.forEach((off, t) => {
        if (!now.has(t)) {
          off();
          live.delete(t);
        }
      });
      now.forEach((t) => {
        if (!live.has(t)) live.set(t, story.lineScope(t, { lineY: typeof lineY === "string" ? t.matches(lineY) : lineY }));
      });
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      live.forEach((off) => off());
    };
  }, [targets, lineY]);
  return (
    <div ref={ref} className="story-vars">
      {children}
    </div>
  );
}
