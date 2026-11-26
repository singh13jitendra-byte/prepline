"use client";

/**
 * PERFORMANCES — "scroll selects, time performs".
 *
 * A performance is the one timed GSAP timeline a beat may own (0.5 to 1.1s).
 * You describe it once; the runner decides when it plays, so every beat obeys
 * the same rules and nothing is ever left half-played.
 *
 *   definePerformance(beatId, build): () => void
 *   usePerformance(beatId, build, deps?)        the same, as a React effect
 *
 * `build(tl, ctx)` receives a paused timeline to fill. Return nothing (or the
 * timeline). `ctx.reduced` is true under reduced motion.
 *
 * Usage:
 *
 *   usePerformance("reason", (tl) => {
 *     tl.fromTo(ring, { drawSVG: 0 }, { drawSVG: "90%", duration: 1.1, ease: ease.out })
 *       .from(chips, { autoAlpha: 0, y: 8, stagger: 0.12 }, 0.2)
 *       .from(privacy, { autoAlpha: 0 }, ">");
 *   });
 *
 * Runner rules (storyboard 2.2 and 5.5)
 * - Enter forward (scrolling down into the beat): plays from the start.
 * - Leave forward: snaps to the end state.
 * - Leave backward: resets to the start state.
 * - Enter backward: shows the end state at once. No reverse replay.
 * - A fling (a beat entered and left within 120ms, or several beats crossed in
 *   one frame): follows from the rules above. The beat goes straight to its end
 *   state, or its reset state when travelling up, and never plays out.
 *   `ctx.skipped()` is true inside any timeline callback fired by such a jump,
 *   so a burst or a pulse can stay quiet for beats nobody saw. End-state
 *   callbacks still run.
 * - Registered while its beat is already behind the scroll position: end state.
 *   Registered while its beat is current: plays.
 * - Reduced motion: built, set to the end state, never played.
 *
 * Write performances so the END of the timeline is the complete, correct state:
 * use tween end values (or a callback placed at the end that is safe to run
 * twice), not React state set halfway through. Typing is a tween on a proxy
 * whose onUpdate writes text. Scrubbed anticipation (the first 20% of a beat)
 * is not a performance: do it in story.subscribe.
 */

import { useEffect, type DependencyList } from "react";
import { gsap } from "./gsap";
import { BEATS, story, type BeatId, type Direction } from "./story";
import { ease } from "@/lib/theme";

export type PerformanceContext = {
  beat: BeatId;
  reduced: boolean;
  /** True while the timeline is being jumped to an end or start state rather than played. */
  skipped: () => boolean;
};
export type PerformanceBuild = (tl: gsap.core.Timeline, ctx: PerformanceContext) => gsap.core.Timeline | void;

const order = (id: BeatId) => BEATS.findIndex((b) => b.id === id);

/** Register the timed performance of a beat. Call on the client once its elements exist. Returns dispose. */
export function definePerformance(beatId: BeatId, build: PerformanceBuild): () => void {
  if (typeof window === "undefined") return () => {};
  const s = story.get();
  const reduced = story.reduced();
  let jumping = false;
  const tl = gsap.timeline({ paused: true });
  build(tl, { beat: beatId, reduced, skipped: () => jumping });
  const jump = (to: 0 | 1) => {
    jumping = true;
    tl.pause().progress(to);
    jumping = false;
  };

  if (reduced) {
    jump(1);
    return () => tl.kill();
  }


  const here = order(s.beat);
  const mine = order(beatId);
  if (here > mine) jump(1);
  else if (here === mine) tl.play(0);

  const off = story.onBeat(beatId, {
    enter(direction: Direction) {
      if (direction === 1) tl.play(0);
      else jump(1);
    },
    leave(direction: Direction) {
      jump(direction === 1 ? 1 : 0);
    },
  });

  return () => {
    off();
    tl.kill();
  };
}

/** `definePerformance` as an effect. Rebuilds when `deps` change. */
export function usePerformance(beatId: BeatId, build: PerformanceBuild, deps: DependencyList = []) {
  useEffect(
    () => definePerformance(beatId, build),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beatId, ...deps],
  );
}
