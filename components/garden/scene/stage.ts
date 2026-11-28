/**
 * WHO STANDS IN THE GARDEN, AND WHERE — pure helpers, no three.js.
 *
 *   pickGardenJobs   about 15 of the jobs the scene is given: every role that fits (the twelve), then
 *                    a few set-aside ones, chosen so every flower kind shows and every stage shows
 *                    (full bloom 8–10, half open 6–7, bud 5 and under; flowers.ts `openForFit`).
 *   slotsFor         where each one stands, as a loose drift over the meadow's foreground: where its
 *                    heart lands in the wide shot and how big it is there (which sets its depth, so
 *                    the drift has real parallax when the camera moves).
 *
 * Slots are listed most prominent first (the nearest), alternating sides, so the best match gets
 * the best place and neighbours in rank do not crowd together. Every head lands below the line
 * copy (top left) and above the list button and the cue (bottom left, bottom centre): see the
 * ExploreStage CSS. Bases sink into the painted grass.
 */

import { flowerOf } from "@/components/world/fieldFlowers";
import { FIT_LINE, type FireflyJob } from "@/components/fireflies/jobs";
import { FLOWER_KINDS, type FlowerKind } from "../flowers";

export const GARDEN_SIZE = 15;
const ASIDE = 3;

export const kindOf = (job: FireflyJob): FlowerKind => FLOWER_KINDS[flowerOf(job.title)] ?? "moon";

/**
 * Indices into `jobs`, highest fit first (the order slots are handed out in). All the roles that fit
 * (at most GARDEN_SIZE − 3 of them), then set-aside roles, each time of the kind least represented so
 * far (best fit first, then reading order), until GARDEN_SIZE.
 */
export function pickGardenJobs(jobs: readonly FireflyJob[], size = GARDEN_SIZE): number[] {
  const byFit = (a: number, b: number) => jobs[b].fit - jobs[a].fit || a - b;
  const all = jobs.map((_, i) => i);
  const kept = all.filter((i) => jobs[i].fit >= FIT_LINE).sort(byFit);
  const aside = all.filter((i) => jobs[i].fit < FIT_LINE).sort(byFit);
  const keepN = Math.min(kept.length, Math.max(size - Math.min(ASIDE, aside.length), 0));
  const out = kept.slice(0, keepN);
  const count = new Map<FlowerKind, number>(FLOWER_KINDS.map((k) => [k, 0]));
  for (const i of out) count.set(kindOf(jobs[i]), (count.get(kindOf(jobs[i])) ?? 0) + 1);
  const pool = [...aside, ...kept.slice(keepN)];
  while (out.length < size && pool.length) {
    let best = 0;
    for (let p = 1; p < pool.length; p++) {
      const a = count.get(kindOf(jobs[pool[p]])) ?? 0;
      const b = count.get(kindOf(jobs[pool[best]])) ?? 0;
      if (a < b) best = p;
    }
    const [i] = pool.splice(best, 1);
    out.push(i);
    count.set(kindOf(jobs[i]), (count.get(kindOf(jobs[i])) ?? 0) + 1);
  }
  return out.sort(byFit);
}

/**
 * A place in the wide shot: where the flower's heart lands on screen (x, y: 0..1 of the width and
 * height) and how tall a reference flower stands there (s: its height as a share of the screen's),
 * which sets its depth: nearer is bigger. Its base is wherever that puts it, sunk in the grass.
 */
export type Slot = { x: number; y: number; s: number };

// Landscape: one broad drift over the meadow; the nearest flowers centre right (a focused flower's
// card opens to its right), the far ones up on the slope. Heads stay below the line (top left, to
// about 25% of the height) and above the list button and the cue (the bottom 8%).
const WIDE: Slot[] = [
  { x: 0.6, y: 0.66, s: 0.4 },
  { x: 0.3, y: 0.6, s: 0.34 },
  { x: 0.86, y: 0.63, s: 0.35 },
  { x: 0.46, y: 0.52, s: 0.26 },
  { x: 0.73, y: 0.5, s: 0.25 },
  { x: 0.16, y: 0.55, s: 0.27 },
  { x: 0.95, y: 0.47, s: 0.21 },
  { x: 0.56, y: 0.45, s: 0.19 },
  { x: 0.38, y: 0.47, s: 0.18 },
  { x: 0.07, y: 0.46, s: 0.17 },
  { x: 0.81, y: 0.44, s: 0.15 },
  { x: 0.24, y: 0.45, s: 0.15 },
  { x: 0.66, y: 0.42, s: 0.13 },
  { x: 0.5, y: 0.4, s: 0.12 },
  { x: 0.13, y: 0.71, s: 0.25 },
];

// Portrait (phones, a narrow window): smaller and deeper, between the line at the top (to about 24%)
// and the list button and cue at the bottom. A docked card frames a focused flower up top anyway.
const TALL: Slot[] = [
  { x: 0.62, y: 0.66, s: 0.25 },
  { x: 0.26, y: 0.58, s: 0.21 },
  { x: 0.88, y: 0.56, s: 0.19 },
  { x: 0.44, y: 0.5, s: 0.16 },
  { x: 0.1, y: 0.7, s: 0.17 },
  { x: 0.74, y: 0.46, s: 0.14 },
  { x: 0.3, y: 0.44, s: 0.12 },
  { x: 0.92, y: 0.74, s: 0.15 },
  { x: 0.55, y: 0.41, s: 0.1 },
  { x: 0.07, y: 0.48, s: 0.1 },
  { x: 0.68, y: 0.38, s: 0.085 },
  { x: 0.18, y: 0.38, s: 0.08 },
  { x: 0.84, y: 0.4, s: 0.08 },
  { x: 0.4, y: 0.36, s: 0.07 },
  { x: 0.5, y: 0.78, s: 0.15 },
];

export const slotsFor = (aspect: number): Slot[] => (aspect < 0.85 ? TALL : WIDE);
