/**
 * THE FLIGHT — the fireflies become the jobs (delight 3). Shared by the World (fieldScene.ts,
 * worldRuntime.ts) and Act I (components/acts/read/ReadPanel.tsx), so the shader and the DOM agree
 * on the frame each row ignites. No Three, no React: plain numbers.
 *
 * In `ranked` the twelve kept fireflies fly, in rank order, to the twelve rows of the list and land
 * on the tip of each row's score rule. Everything is scrubbed by `ranked` beat progress (not timed),
 * so it is exact to the wheel and plays backwards when scrolling up: the dots lift back out of the
 * rows into the meadow.
 *
 *   firefly i (0 = rank 1) leaves at  FLY_START + i * FLY_STAGGER
 *   it is in the air for              FLY_DUR      (beat progress; 0.26 of 60 units, about 0.6-0.8s of scroll)
 *   it touches down at                travel LAND_T: its row ignites (ReadPanel: data-lit)
 *   it is absorbed by                 travel 1: shrunk into the dot, no longer drawn
 *
 * On phones rows 7 to 12 are folded into the "6 more" pill: fireflies 7 to 12 merge into it.
 *
 * The landing points are measured rarely (beat entry, resize, scroll settle), never per frame. The
 * list's only movement in `ranked` is its breath (a translateY written by ReadPanel), so the World
 * adds `listDrift()` now minus `listDrift()` at measure time instead of measuring again.
 */

import { story } from "@/lib/story";

/** Beat progress (`ranked`) at which rank 1 leaves. */
export const FLY_START = 0.02;
/** Beat progress between two departures. */
export const FLY_STAGGER = 0.016;
/** Beat progress one firefly spends from its place in the meadow to absorbed in its row. */
export const FLY_DUR = 0.26;
/** Travel (0..1) at which it touches down on the score rule: after the overshoot, before it is absorbed. */
export const LAND_T = 0.9;
/** Travel at which the path itself is done (the overshoot then settles it onto the dot by LAND_T). */
export const PATH_T = 0.8;
/** Glow trail: lagged copies of the flight clock (time-based, so a still wheel lets the trail fade). */
export const TRAIL = 4;
export const TRAIL_SMALL = 3;
/** How fast each trail copy catches up with the one ahead of it (1/s). */
export const TRAIL_RATE = 15;

/** Beat progress at which firefly `i` (0-based rank) touches down and its row ignites. */
export function landAt(i: number): number {
  return FLY_START + i * FLY_STAGGER + FLY_DUR * LAND_T;
}
/** Beat progress at which the last of the twelve is absorbed. */
export const LAST_ABSORBED = FLY_START + 11 * FLY_STAGGER + FLY_DUR;

/**
 * The ranked list's vertical drift (px): it breathes up through `ranked` and `reason`. ReadPanel
 * writes it as the list's translateY; the World uses it to follow the rows without measuring them.
 */
export function listDrift(): number {
  return 10 - 22 * story.breathOf("ranked", 0.15) - 10 * story.breathOf("reason", 0);
}
