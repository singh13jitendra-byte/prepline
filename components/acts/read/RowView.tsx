"use client";

/**
 * One ranked row, drawn at its natural size (440 x 44, storyboard 2.4 beat 4).
 * Used by the `row` face (row 1, the Actor) and by the plain DOM rows 2 to 12,
 * so all twelve are pixel-identical. Colours come from the --face-* variables
 * of the nearest [data-skin].
 *
 * Layout, left to right: the landing dot (where the gold speck lands), rank
 * numeral (mono, tabular), initials tile, title over company and city, score.
 * On hover the company line slides up and the one-line reason takes its place.
 */

import { useSyncExternalStore } from "react";
import { storyCopy, type RankedRole } from "@/lib/content";

const pad = (n: number) => String(n).padStart(2, "0");

export function RowView({ role, hover }: { role: RankedRole; hover?: boolean }) {
  const reason = role.reason ?? storyCopy.ranked.rowHoverFallback;
  return (
    <div className="rv" data-hover={hover ? "" : undefined}>
      <span className="rv-dot" aria-hidden="true" />
      <span className="rv-rank" aria-hidden="true">
        {pad(role.rank)}
      </span>
      <span className="rv-ini" aria-hidden="true">
        {role.initials}
      </span>
      <span className="rv-main">
        <span className="rv-title">{role.title}</span>
        <span className="rv-sub">
          <span className="rv-meta">
            <span className="sr-only">, </span>
            {role.company} · {role.city}
          </span>
          <span className="rv-reason" aria-hidden={role.reason ? undefined : true}>
            <span className="sr-only">. </span>
            {reason}
          </span>
        </span>
      </span>
      <span className="rv-score">
        <span className="sr-only">, scored </span>
        <b>{role.score}</b>
        <span className="rv-of">{storyCopy.ranked.scoreSuffix}</span>
      </span>
    </div>
  );
}

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
