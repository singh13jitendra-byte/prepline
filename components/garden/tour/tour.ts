/**
 * THE GARDEN'S SCROLL TOUR — a pure schedule, scrubbed by the explore beat's progress.
 *
 * Everyone sees it on the way into the garden (CLAUDE.md, "The garden"): Lumi flies to the top match,
 * its slip comes up (role · company · city · fit), the flower blooms fully while the slip grows into
 * the role card and Lumi perches, the card folds back and the flower returns to its stage, Lumi moves
 * to a bellflower, then to a bud (whose slip says why it was set aside), Lumi's hint comes up, and
 * the rest of the hold is free explore.
 *
 *   const plan = planTour(flowers);          // once, when the flowers on stage are known
 *   const s = tourAt(plan, beatProgress);    // every frame: everything the tour wants right now
 *
 * PURE: no clock, no module state, no DOM. The state is a function of `bp` alone, so scrolling back
 * runs it backwards exactly, and a jump straight to any `bp` gives the right state with no history.
 * Lumi's flight between targets is Lumi's own (time-eased); the tour only names the target.
 *
 * WHERE IT RUNS, in beat progress (the hold is EXPLORE_IN[1]..EXPLORE_OUT[0] of lib/story.ts):
 *
 *   rest     before the tour starts (the hand-in, and `lead` into the hold) and after free explore
 *   tour     from hold start + `lead` to `share` of the way through the hold (about 58%)
 *   free     from there to hold end − `tail` (ExploreStage lets go of a focus LET_GO before the
 *            hand-out; `tail` is the same margin)
 *
 * Inside the tour the steps take weighted shares (STEP_WEIGHT). A stop with no flower to show (no
 * bellflower, no bud on stage) is left out and the others share its time.
 *
 * INVARIANTS (scripts/check-garden-tour.mjs asserts them on the real garden):
 *   - `slip`, `card`, `open ?? stage` and `hint` are continuous in `bp`
 *   - the target (and so Lumi's flower) changes only where slip = card = 0 and the flower is at its stage
 *   - `open` is null outside bloom / card / fold, and equals the stage at both ends of them
 *   - steps never go backwards as `bp` grows
 */

import { flowerOf } from "@/components/world/fieldFlowers";
import type { FireflyJob } from "@/components/fireflies/jobs";
import { openForFit } from "../flowers";

/* ─────────────────────────────────────────────────────────────── types ── */

/** One flower on stage: its job, and the `open` it rests at (default: its stage, `openForFit(job.fit)`). */
export type TourFlower = { job: FireflyJob; stage?: number };

export type TourStep =
  /** Outside the tour and free explore: the tour asks for nothing. */
  | "rest"
  /** Lumi flies to the top match. */
  | "approach"
  /** The top match's slip comes up. */
  | "slip"
  /** The flower opens fully, the slip grows into the role card, Lumi perches. */
  | "bloom"
  /** The card is held open, to be read. */
  | "card"
  /** The card folds back into the slip, the flower returns to its stage, Lumi lifts off; the slip goes. */
  | "fold"
  /** Lumi moves to the next stop (`stop` 1 the bellflower, 2 the bud) and its slip comes up and goes. */
  | "next"
  /** Lumi's hint ("Go on, peek inside one."), held a moment. */
  | "hint"
  /** The visitor's turn: hover / tap. The tour asks for nothing but the hint. */
  | "free";

/** The three stops, by index: 0 the top match, 1 a bellflower, 2 a bud. */
export type TourStop = 0 | 1 | 2;

export type TourState = {
  step: TourStep;
  /** 0..1 through the current step (0 for rest and free). */
  stepP: number;
  /** 0..1 through the whole tour (0 before it, 1 after it). */
  tour: number;
  /** Which stop the tour is on, or -1 (rest, free). */
  stop: TourStop | -1;
  /** The tour's flower right now: its slip, the open override and Lumi all refer to it. */
  target: FireflyJob | null;
  /** The target's resting `open` (its stage), for convenience. */
  stage: number;
  /**
   * The target flower's `open` override, 0..1, or null: let it rest at its stage. Only one flower is
   * ever overridden, and only during bloom / card / fold.
   */
  open: number | null;
  /** How far the slip is up at the target, 0..1 (GardenSlip `show`). */
  slip: number;
  /** How far the slip has grown into the role card, 0..1 (GardenSlip `grow`). */
  card: number;
  /** How lit the target flower is as "the one being shown", 0..1 (the scene's chosen light, if it wants it). */
  lit: number;
  /**
   * Where Lumi should be: beside a flower's heart (`id`), or perched (`perch` 1). Perch is 1 only while the
   * card is at least half grown, so "perched" means on the card (GardenSlip `slipPerch`); see the report on
   * worldBus.garden. Null: the garden names no flower (rest, the hint, free explore until a flower is
   * focused): Lumi rests, and in the hold it says its "explore" note, the hint.
   */
  lumi: { id: string; perch: 0 | 1 } | null;
  /** Lumi's hint, 0..1 (storyCopy.lumi.notes.explore). Up through the hint step and free explore. Lumi says it itself whenever `lumi` is null in the hold. */
  hint: number;
  /** Free explore is live: the scene may take the pointer and focus flowers. */
  free: boolean;
};

export type TourOptions = {
  /** The hold, in beat progress: [EXPLORE_IN[1], EXPLORE_OUT[0]] from lib/story.ts. */
  hold?: readonly [number, number];
  /** Share of the hold the tour takes. The rest is free explore. */
  share?: number;
  /** Beat progress after the hold starts before the tour does (the scene is fully up by then). */
  lead?: number;
  /** Beat progress before the hold ends where free explore stops (ExploreStage's LET_GO). */
  tail?: number;
};

export type TourPlan = {
  /** The three stops' jobs (null: nothing on stage fits that stop). */
  top: FireflyJob | null;
  bell: FireflyJob | null;
  bud: FireflyJob | null;
  /** Resting `open` of each stop's flower. */
  stages: Record<string, number>;
  /** Beat progress: tour start, tour end (= free start), free end. */
  t0: number;
  t1: number;
  t2: number;
  /** The steps in order, with where each starts and ends as a share of the tour (0..1). */
  steps: readonly { step: TourStep; stop: TourStop | -1; a: number; b: number }[];
};

/* ────────────────────────────────────────────────────────────── tuning ── */

/** Mirrors lib/story.ts (EXPLORE_IN[1], EXPLORE_OUT[0]); the self-check fails if they drift apart. */
export const DEFAULT_HOLD: readonly [number, number] = [0.16, 0.84];
export const TOUR_SHARE = 0.58;
export const TOUR_LEAD = 0.02;
export const TOUR_TAIL = 0.025;

/** Relative length of each step inside the tour. `next` is per stop. */
export const STEP_WEIGHT = { approach: 1, slip: 0.8, bloom: 1.3, card: 1.7, fold: 1.1, next: 2, hint: 1.4 } as const;

/** Inside a `next` stop: Lumi travels, the slip comes up, holds, and goes. Shares of the step. */
const NEXT_TRAVEL = 0.3;
const NEXT_IN = 0.45;
const NEXT_OUT = 0.8;
/** The slip is gone a little before a stop ends, so Lumi's flower changes over a moment of true rest. */
const NEXT_GONE = 0.95;
/** Inside `slip`: the slip is fully up by this share; the rest is a beat to read it. */
const SLIP_IN = 0.75;
/** Lumi is perched while the card is at least this far grown (it lands in `bloom`, lifts off in `fold`). */
const PERCH_AT = 0.5;
/** Inside `fold`: the card is back to a slip (and the flower to its stage) by this share; then the slip goes. */
const FOLD_CARD = 0.7;
const FOLD_GONE = 0.94;
/** Inside `hint`: the hint is up by this share. */
const HINT_IN = 0.35;
/** Beat progress over which the hint goes at the end of free explore. */
const HINT_OUT = 0.03;

/* ───────────────────────────────────────────────────────────── helpers ── */

const BELL = 1;
const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const lin = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
/** Smoothstep from a to b. */
export const ss = (a: number, b: number, x: number) => {
  const t = lin(a, b, x);
  return t * t * (3 - 2 * t);
};

const stageOf = (f: TourFlower) => f.stage ?? openForFit(f.job.fit);

/**
 * The three stops, from the data. Ties always go to the earlier flower in the list.
 *   top    the highest fit on stage.
 *   bell   a bellflower (a UX role, `flowerOf(title) === 1`) other than the top: half open (6–7) first,
 *          so the tour shows all three stages; then any bellflower, highest fit first. With no
 *          bellflower on stage, the highest-fit half-open flower stands in; with none, the stop is skipped.
 *   bud    a bud (fit 5 and under, so its slip says why it was set aside), not already a stop: one that
 *          has a reason (`gap`) first, then highest fit (the nearest miss); with none, the stop is skipped.
 */
export function pickStops(flowers: readonly TourFlower[]): { top: TourFlower | null; bell: TourFlower | null; bud: TourFlower | null } {
  const best = (list: readonly TourFlower[], score: (f: TourFlower) => number) => {
    let out: TourFlower | null = null;
    let top = -Infinity;
    for (const f of list) {
      const s = score(f);
      if (s > top) {
        top = s;
        out = f;
      }
    }
    return out;
  };
  const top = best(flowers, (f) => f.job.fit);
  const rest = flowers.filter((f) => f !== top);
  const half = (f: TourFlower) => stageOf(f) > 0 && stageOf(f) < 1;
  const bells = rest.filter((f) => flowerOf(f.job.title) === BELL);
  const bell = best(bells, (f) => (half(f) ? 100 : 0) + f.job.fit) ?? best(rest.filter(half), (f) => f.job.fit);
  const buds = rest.filter((f) => f !== bell && f.job.fit <= 5);
  const bud = best(buds, (f) => (f.job.gap ? 100 : 0) + f.job.fit);
  return { top, bell, bud };
}

/* ──────────────────────────────────────────────────────────────── plan ── */

/** Work out the stops and the step table, once per set of flowers (and per hold). */
export function planTour(flowers: readonly TourFlower[], opts: TourOptions = {}): TourPlan {
  const [h0, h1] = opts.hold ?? DEFAULT_HOLD;
  const share = opts.share ?? TOUR_SHARE;
  const lead = opts.lead ?? TOUR_LEAD;
  const tail = opts.tail ?? TOUR_TAIL;
  const { top, bell, bud } = pickStops(flowers);
  const stages: Record<string, number> = {};
  for (const f of [top, bell, bud]) if (f) stages[f.job.id] = stageOf(f);

  const t0 = h0 + lead;
  const t1 = Math.max(t0, h0 + (h1 - h0) * share);
  const t2 = Math.max(t1, h1 - tail);

  const raw: { step: TourStep; stop: TourStop | -1; w: number }[] = [];
  if (top) {
    raw.push({ step: "approach", stop: 0, w: STEP_WEIGHT.approach });
    raw.push({ step: "slip", stop: 0, w: STEP_WEIGHT.slip });
    raw.push({ step: "bloom", stop: 0, w: STEP_WEIGHT.bloom });
    raw.push({ step: "card", stop: 0, w: STEP_WEIGHT.card });
    raw.push({ step: "fold", stop: 0, w: STEP_WEIGHT.fold });
    if (bell) raw.push({ step: "next", stop: 1, w: STEP_WEIGHT.next });
    if (bud) raw.push({ step: "next", stop: 2, w: STEP_WEIGHT.next });
    raw.push({ step: "hint", stop: bud ? 2 : bell ? 1 : 0, w: STEP_WEIGHT.hint });
  }
  const total = raw.reduce((s, r) => s + r.w, 0);
  let at = 0;
  const steps = raw.map((r) => {
    const a = at / total;
    at += r.w;
    return { step: r.step, stop: r.stop, a, b: at / total };
  });
  if (steps.length) steps[steps.length - 1].b = 1;
  return { top: top?.job ?? null, bell: bell?.job ?? null, bud: bud?.job ?? null, stages, t0, t1, t2, steps };
}

/* ─────────────────────────────────────────────────────────────── state ── */

const REST: TourState = { step: "rest", stepP: 0, tour: 0, stop: -1, target: null, stage: 0, open: null, slip: 0, card: 0, lit: 0, lumi: null, hint: 0, free: false };

/** Everything the tour wants at beat progress `bp` (0..1 of the explore beat). */
export function tourAt(plan: TourPlan, bp: number): TourState {
  const { t0, t1, t2, steps } = plan;
  if (!(bp >= t0) || bp >= t2) return { ...REST, tour: bp >= t2 ? 1 : 0 };
  if (bp >= t1 || !steps.length) {
    if (!steps.length) return { ...REST, step: "free", tour: 1, free: true };
    // The garden names no flower until the visitor focuses one: Lumi rests and says its hint.
    const hint = 1 - ss(t2 - HINT_OUT, t2, bp);
    return { ...REST, step: "free", tour: 1, hint, free: true };
  }

  const tour = (bp - t0) / (t1 - t0);
  let k = steps.length - 1;
  while (k > 0 && tour < steps[k].a) k--;
  const seg = steps[k];
  const p = clamp01((tour - seg.a) / (seg.b - seg.a));
  const stop = seg.stop as TourStop;
  const target = stop === 0 ? plan.top : stop === 1 ? plan.bell : plan.bud;
  if (!target) return { ...REST, tour };
  const stage = plan.stages[target.id] ?? openForFit(target.fit);
  const s: TourState = { ...REST, step: seg.step, stepP: p, tour, stop, target, stage, lumi: { id: target.id, perch: 0 } };

  switch (seg.step) {
    case "approach":
      break;
    case "slip":
      s.slip = ss(0, SLIP_IN, p);
      break;
    case "bloom": {
      const g = ss(0, 1, p);
      s.slip = 1;
      s.card = g;
      s.open = stage + (1 - stage) * g;
      s.lumi = { id: target.id, perch: g >= PERCH_AT ? 1 : 0 };
      break;
    }
    case "card":
      s.slip = 1;
      s.card = 1;
      s.open = 1;
      s.lumi = { id: target.id, perch: 1 };
      break;
    case "fold": {
      const g = 1 - ss(0, FOLD_CARD, p);
      s.card = g;
      s.slip = 1 - ss(FOLD_CARD, FOLD_GONE, p);
      // Back at its stage the override is let go (null), so the scene's own rest state takes over seamlessly.
      s.open = p >= FOLD_CARD ? null : stage + (1 - stage) * g;
      s.lumi = { id: target.id, perch: g >= PERCH_AT ? 1 : 0 };
      break;
    }
    case "next":
      s.slip = p < NEXT_OUT ? ss(NEXT_TRAVEL, NEXT_IN, p) : 1 - ss(NEXT_OUT, NEXT_GONE, p);
      break;
    case "hint":
      // Lumi is let go (no flower named): Lumi.tsx then rests and says its note, "Go on, peek inside one."
      // (GARDEN.noteAfter), which is the hint. `hint` is for anything else that wants to show it.
      s.hint = ss(0, HINT_IN, p);
      s.lumi = null;
      break;
  }
  s.lit = Math.max(s.slip, s.card);
  return s;
}

/** Plan and read in one call (fine in a lab; in a frame loop keep the plan). */
export function tourState(bp: number, flowers: readonly TourFlower[], opts?: TourOptions): TourState {
  return tourAt(planTour(flowers, opts), bp);
}

/** The `open` a given flower should show right now: the tour's override if it is the target, else its resting stage. */
export function openOf(s: TourState, id: string, stage: number): number {
  return s.target && s.target.id === id && s.open !== null ? s.open : stage;
}

/** Beat progress where each step starts, for a lab's tick marks: [{ step, stop, bp }]. */
export function stepMarks(plan: TourPlan): { step: TourStep; stop: TourStop | -1; bp: number }[] {
  const span = plan.t1 - plan.t0;
  return [...plan.steps.map((s) => ({ step: s.step, stop: s.stop, bp: plan.t0 + s.a * span })), { step: "free" as const, stop: -1 as const, bp: plan.t1 }];
}
