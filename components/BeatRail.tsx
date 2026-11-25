"use client";

/**
 * BEAT RAIL — five ticks on the right edge (desktop, motion only). Storyboard 3 "Nav".
 * A <nav aria-label="Story"> of real links; the active tick is 16px long, a mono
 * label shows on hover and focus, and a click scrolls to that beat. Like the nav,
 * it is drawn in both skins during a wipe and split at the line.
 */

import { useEffect, useRef } from "react";
import { storyCopy } from "@/lib/content";
import { BEATS, story, type BeatId } from "@/lib/story";
import "./chrome.css";

const idx = (b: BeatId) => BEATS.findIndex((x) => x.id === b);
const RAIL = storyCopy.nav.rail as readonly { label: string; beat: BeatId }[];
const HREF: Record<string, string> = { hero: "#read", ranked: "#read", saved: "#board", unfold: "#prep", seat: "#join" };
/** Where each tick lands inside its beat. */
const AT: Record<string, number> = { hero: 0, ranked: 0.7, saved: 0.85, unfold: 0.95, seat: 0.6 };

function activeTick(beat: BeatId): number {
  const i = idx(beat);
  let k = 0;
  // The last section whose first beat has been reached (a tick stays lit through the wipe after it).
  RAIL.forEach((r, n) => {
    if (i >= idx(r.beat)) k = n;
  });
  return k;
}

function Ticks({ live }: { live: boolean }) {
  return (
    <>
      {RAIL.map((r) => (
        <li key={r.label}>
          <a
            href={HREF[r.beat]}
            className="rail-link"
            data-rail={r.beat}
            tabIndex={live ? undefined : -1}
            onClick={(e) => {
              e.preventDefault();
              story.scrollToBeat(r.beat, AT[r.beat] ?? 0);
            }}
          >
            <span className="rail-label">{r.label}</span>
            <span className="rail-tick" aria-hidden="true" />
          </a>
        </li>
      ))}
    </>
  );
}

export function BeatRail() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced()) return;
    const apply = (beat: BeatId) => {
      const k = activeTick(beat);
      el.querySelectorAll<HTMLElement>(".rail-link").forEach((a) => {
        const on = a.dataset.rail === RAIL[k].beat;
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };
    apply(story.get().beat);
    return story.onBeatChange(apply);
  }, []);

  return (
    <nav ref={ref} className="rail only-motion" aria-label={storyCopy.nav.railLabel}>
      <ul className="rail-copy rail-base">
        <Ticks live />
      </ul>
      <ul className="rail-copy rail-overlay" aria-hidden="true">
        <Ticks live={false} />
      </ul>
    </nav>
  );
}
