"use client";

/**
 * BEAT RAIL — five ticks on the right edge (desktop, motion only). Storyboard 3 "Nav".
 * A <nav aria-label="Story"> of real links; the active tick is 16px long, a small
 * label shows on hover and focus, and a click scrolls to that beat. Like the nav,
 * it is drawn in both skins during a wipe and split at the line.
 */

import { useEffect, useRef, useState } from "react";
import { storyCopy } from "@/lib/content";
import { BEATS, EXPLORE, story, type BeatId } from "@/lib/story";
import "./chrome.css";

type Tick = { label: string; beat: BeatId };
const idx = (b: BeatId) => BEATS.findIndex((x) => x.id === b);
const RAIL = storyCopy.nav.rail as readonly Tick[];
/** With the explore stop (?explore=1, known after mount only) it has a tick of its own, before "Rank". */
const RAIL_EXPLORE: readonly Tick[] = RAIL.flatMap((r) => (r.beat === "ranked" ? [{ label: storyCopy.explore.rail, beat: "explore" as BeatId }, r] : [r]));
const HREF: Record<string, string> = { hero: "#read", explore: "#read", ranked: "#read", saved: "#board", unfold: "#prep", seat: "#join" };
/** Where each tick lands inside its beat. */
const AT: Record<string, number> = { hero: 0, explore: 0.3, ranked: 0.7, saved: 0.85, unfold: 0.95, seat: 0.6 };

function activeTick(rail: readonly Tick[], beat: BeatId): number {
  const i = idx(beat);
  let k = 0;
  // The last section whose first beat has been reached (a tick stays lit through the wipe after it).
  rail.forEach((r, n) => {
    if (i >= idx(r.beat)) k = n;
  });
  return k;
}

function Ticks({ rail, live }: { rail: readonly Tick[]; live: boolean }) {
  return (
    <>
      {rail.map((r) => (
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
  // The server never knows the flag: the extra tick is added after mount.
  const [explore, setExplore] = useState(false);
  useEffect(() => setExplore(EXPLORE), []);
  const rail = explore ? RAIL_EXPLORE : RAIL;
  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced()) return;
    const apply = (beat: BeatId) => {
      const k = activeTick(rail, beat);
      el.querySelectorAll<HTMLElement>(".rail-link").forEach((a) => {
        const on = a.dataset.rail === rail[k].beat;
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };
    apply(story.get().beat);
    return story.onBeatChange(apply);
  }, [rail]);

  return (
    <nav ref={ref} className="rail only-motion" aria-label={storyCopy.nav.railLabel} data-explore={explore ? "" : undefined}>
      <ul className="rail-copy rail-base">
        <Ticks rail={rail} live />
      </ul>
      <ul className="rail-copy rail-overlay" aria-hidden="true">
        <Ticks rail={rail} live={false} />
      </ul>
    </nav>
  );
}
