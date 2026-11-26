"use client";

/**
 * Row 1's hover, relayed. Row 1 lives in the Actor (pointer-events: none) while
 * it rests in the list, so the list item tells the flying row face it is hovered.
 * (The row itself is the product's MatchRow: see components/faces/RowFace.tsx.)
 */

import { useSyncExternalStore } from "react";

/* Row 1 lives in the Actor (pointer-events: none), so its hover is relayed from the list. */
let row1Hover = false;
const hoverSubs = new Set<() => void>();
export function setRow1Hover(v: boolean) {
  if (v === row1Hover) return;
  row1Hover = v;
  hoverSubs.forEach((fn) => fn());
}
export function getRow1Hover() {
  return row1Hover;
}
function subscribeRow1Hover(fn: () => void) {
  hoverSubs.add(fn);
  return () => hoverSubs.delete(fn);
}
export function useRow1Hover() {
  return useSyncExternalStore(subscribeRow1Hover, getRow1Hover, () => false);
}
