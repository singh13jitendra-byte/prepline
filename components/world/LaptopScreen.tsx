"use client";

import { useLayoutEffect, useRef } from "react";
import { MatchesList } from "@/components/product";

/**
 * The hero laptop's screen: a live MatchesList (the real component, real data module),
 * laid out at its natural width and scaled as one picture into the `laptop-screen` hotspot.
 * Decorative: inert and hidden from assistive tech. The real, usable list is in Act I.
 *
 * Frozen (round 5, review P1-9): the list is laid out once and never restyled by the scroll.
 *   - Its scale is a transform on the list's own wrapper, measured on resize only. (The shared
 *     Showcase writes an inherited custom property on its root, which restyles the whole
 *     ~370-node list, and it did so each time the room left and re-entered the render tree.)
 *   - A zero size (the room is display:none) is ignored, so hiding and showing the room never
 *     writes anything here.
 *   - The hotspot is `contain: strict`, so nothing inside it can invalidate the room around it.
 *
 * The painting is 11:25 PM; the list's "Last read: today, 11:10 PM" lives in components/product/data.ts.
 */
const SCREEN = { w: 580, h: 352 }; // the painted screen's proportions (267 : 162)

export function LaptopScreen() {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = outer.current;
    const list = inner.current;
    if (!el || !list) return;
    let last = "";
    const apply = () => {
      const W = el.clientWidth;
      if (W <= 0) return;
      const t = `scale(${(W / SCREEN.w).toFixed(5)})`;
      if (t !== last) list.style.transform = last = t;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="sc-laptop" aria-hidden="true" inert>
      <div ref={inner} className="sc-laptop-list" style={{ width: SCREEN.w, height: SCREEN.h }}>
        <MatchesList skin="day" bare illustrative={false} hints={false} cut={false} defaultSelectedId={null} />
      </div>
    </div>
  );
}
