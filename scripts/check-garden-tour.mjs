#!/usr/bin/env node
/**
 * Self-check for the garden's scroll tour (components/garden/tour/tour.ts). No test framework: plain
 * asserts, run on the real garden (the jobs the scene puts on stage) and on a few awkward lists.
 *
 *   node scripts/check-garden-tour.mjs        # exit 1 on any failure
 *
 * Node runs the TypeScript directly (type stripping, Node 23.6+); a small resolve hook maps the
 * repo's "@/" alias and extensionless imports.
 *
 * What it asserts:
 *   - the hold in tour.ts matches lib/story.ts (EXPLORE_IN[1], EXPLORE_OUT[0])
 *   - the stops come from the data: top = highest fit, a bellflower, a bud (fit 5 and under)
 *   - scrubbed: a forward sweep, a backward sweep and a shuffled set of jumps give identical states
 *   - continuous: slip, card, hint and every stop's open (override or stage) never jump
 *   - the target, and so Lumi's flower, only changes at rest (no slip, no card, flower at its stage)
 *   - the steps never go backwards as bp grows; the open override only lives in bloom / card / fold
 *   - free explore only in [t1, t2), and the tour takes about 55–60% of the hold
 *   - no NaN, and no crash on an empty garden, no bellflower, no bud, a single flower
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const ROOT = new URL("..", import.meta.url).href;
const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(ROOT)};
export async function resolve(spec, ctx, next) {
  let s = spec.startsWith("@/") ? ROOT + spec.slice(2) : spec;
  if ((s.startsWith(".") || s.startsWith("file:")) && !/\\.[cm]?[jt]sx?$/.test(s)) {
    const base = s.startsWith("file:") ? s : new URL(s, ctx.parentURL).href;
    for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(fileURLToPath(base + ext))) return next(base + ext, ctx);
  }
  return next(s, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook));
process.removeAllListeners("warning");
process.on("warning", (w) => (w.name === "ExperimentalWarning" ? null : console.warn(w)));

const tour = await import(ROOT + "components/garden/tour/tour.ts");
const { FIREFLY_JOBS } = await import(ROOT + "components/fireflies/jobs.ts");
const { pickGardenJobs } = await import(ROOT + "components/garden/scene/stage.ts");
const { flowerOf } = await import(ROOT + "components/world/fieldFlowers.ts");
const { openForFit } = await import(ROOT + "components/garden/flowers.ts");

let failures = 0;
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) {
    failures++;
    console.error("  FAIL", msg);
  }
};

/* ── the hold matches lib/story.ts ── */
const storySrc = readFileSync(fileURLToPath(ROOT + "lib/story.ts"), "utf8");
const pair = (name) => {
  const m = storySrc.match(new RegExp(`export const ${name}[^=]*=\\s*\\[([\\d.]+),\\s*([\\d.]+)\\]`));
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const IN = pair("EXPLORE_IN");
const OUT = pair("EXPLORE_OUT");
ok(IN && OUT, "EXPLORE_IN / EXPLORE_OUT found in lib/story.ts");
if (IN && OUT) ok(tour.DEFAULT_HOLD[0] === IN[1] && tour.DEFAULT_HOLD[1] === OUT[0], `DEFAULT_HOLD ${tour.DEFAULT_HOLD} = [EXPLORE_IN[1], EXPLORE_OUT[0]] = [${IN[1]}, ${OUT[0]}]`);

/* ── the sweep ── */
const N = 20000;
const bpAt = (i) => i / N;
const finite = (s) => [s.stepP, s.tour, s.stage, s.slip, s.card, s.lit, s.hint, s.open ?? 0].every(Number.isFinite);

function sweep(name, flowers, { expectStops } = {}) {
  console.log(`\n${name}: ${flowers.length} flowers`);
  const plan = tour.planTour(flowers);
  const stops = [plan.top, plan.bell, plan.bud];
  const fwd = Array.from({ length: N + 1 }, (_, i) => tour.tourAt(plan, bpAt(i)));
  const back = [];
  for (let i = N; i >= 0; i--) back[i] = tour.tourAt(plan, bpAt(i));
  ok(fwd.every((s, i) => isDeepStrictEqual(s, back[i])), "forward and backward sweeps agree");
  // Jumps in a random order (a seeded shuffle): the same states, with no history.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const order = fwd.map((_, i) => i).sort(() => rnd() - 0.5);
  ok(order.every((i) => isDeepStrictEqual(tour.tourAt(plan, bpAt(i)), fwd[i])), "random jumps agree with the sweep");
  ok(fwd.every(finite), "no NaN");

  const rank = (s) => {
    if (s.step === "rest") return s.tour >= 1 ? 1e3 : -1;
    if (s.step === "free") return 999;
    return plan.steps.findIndex((t) => t.step === s.step && t.stop === s.stop);
  };
  const stageOf = (job) => openForFit(job.fit);
  const MAX = 0.02;
  let worst = { d: 0, at: 0, what: "" };
  let switches = 0;
  for (let i = 1; i <= N; i++) {
    const a = fwd[i - 1];
    const b = fwd[i];
    for (const k of ["slip", "card", "hint"]) {
      const d = Math.abs(b[k] - a[k]);
      if (d > worst.d) worst = { d, at: bpAt(i), what: k };
    }
    for (const job of stops) {
      if (!job) continue;
      const d = Math.abs(tour.openOf(b, job.id, stageOf(job)) - tour.openOf(a, job.id, stageOf(job)));
      if (d > worst.d) worst = { d, at: bpAt(i), what: `open of ${job.id}` };
    }
    if (rank(b) < rank(a)) ok(false, `step went backwards at bp ${bpAt(i)}: ${a.step} → ${b.step}`);
    if ((a.target?.id ?? null) !== (b.target?.id ?? null)) {
      switches++;
      const rest = (s) => s.slip === 0 && s.card === 0 && (!s.target || tour.openOf(s, s.target.id, s.stage) === s.stage);
      ok(rest(a) && rest(b), `target changes at rest (bp ${bpAt(i)}: ${a.target?.id ?? "none"} → ${b.target?.id ?? "none"})`);
    }
  }
  ok(worst.d < MAX, `continuous (largest step between samples ${worst.d.toFixed(4)} in ${worst.what || "nothing"} at bp ${worst.at.toFixed(4)})`);
  ok(fwd.every((s) => s.open === null || ["bloom", "card", "fold"].includes(s.step)), "open override only in bloom / card / fold");
  ok(fwd.every((s) => s.open === null || (s.open >= s.stage - 1e-9 && s.open <= 1)), "open override between the stage and full bloom");
  ok(fwd.every((s) => s.free === (s.step === "free")), "free exactly in the free step");
  ok(fwd.every((s, i) => !s.free || (bpAt(i) >= (plan.steps.length ? plan.t1 : plan.t0) && bpAt(i) < plan.t2)), "free only in [t1, t2) (from t0 with no tour)");
  ok(fwd.every((s) => !["rest", "hint", "free"].includes(s.step) || s.lumi === null), "no flower is named for Lumi at rest, in the hint and in free explore (Lumi says its hint)");
  ok(fwd.every((s) => ["rest", "hint", "free"].includes(s.step) || s.lumi?.id === s.target?.id), "during the tour Lumi's flower is the target");
  ok(fwd.every((s) => !s.lumi?.perch || s.card >= 0.5), "Lumi perches only while the card is at least half grown (on the card)");
  ok(fwd.every((s) => s.card === 0 || s.stop === 0), "only the top match grows into the card");
  ok(fwd.every((s) => s.card === 0 || s.slip === 1 || s.step === "fold"), "the card grows out of a slip that is fully up");

  if (expectStops) {
    const [h0, h1] = tour.DEFAULT_HOLD;
    const share = (plan.t1 - h0) / (h1 - h0);
    ok(share >= 0.55 && share <= 0.6, `tour ends ${(share * 100).toFixed(1)}% into the hold (55–60%)`);
    const top = Math.max(...flowers.map((f) => f.job.fit));
    ok(plan.top && plan.top.fit === top, `top match is the highest fit (${plan.top?.id} ${plan.top?.fit})`);
    ok(plan.bell && flowerOf(plan.bell.title) === 1 && plan.bell.id !== plan.top?.id, `the bellflower is a UX role (${plan.bell?.id}: ${plan.bell?.title})`);
    ok(plan.bud && plan.bud.fit <= 5 && plan.bud.gap, `the bud is set aside, with a reason (${plan.bud?.id} ${plan.bud?.fit}: ${plan.bud?.gap})`);
    ok(new Set(stops.map((j) => j?.id)).size === 3, "three different stops");
    ok(switches === 4, `the target changes 4 times through the beat (none → top → bell → bud → none): ${switches}`);
    const seen = new Set(fwd.map((s) => `${s.step}${s.stop >= 0 ? s.stop : ""}`));
    for (const s of ["rest", "approach0", "slip0", "bloom0", "card0", "fold0", "next1", "next2", "hint2", "free"]) ok(seen.has(s), `step ${s} happens`);
    ok(fwd.some((s) => s.lumi?.perch === 1), "Lumi perches during the card");
    console.log(`  stops: top ${plan.top?.id} (${plan.top?.fit}), bell ${plan.bell?.id} (${plan.bell?.fit}), bud ${plan.bud?.id} (${plan.bud?.fit})`);
    console.log(`  tour bp ${plan.t0.toFixed(3)}–${plan.t1.toFixed(3)}, free to ${plan.t2.toFixed(3)}`);
    for (const m of tour.stepMarks(plan)) console.log(`    ${m.bp.toFixed(3)}  ${m.step}${m.stop >= 0 ? " " + m.stop : ""}`);
  }
  return plan;
}

/* ── the real garden ── */
const garden = pickGardenJobs(FIREFLY_JOBS).map((i) => ({ job: FIREFLY_JOBS[i] }));
sweep("the garden", garden, { expectStops: true });

/* ── awkward lists ── */
const noBell = garden.filter((f) => flowerOf(f.job.title) !== 1);
const p1 = sweep("no bellflower", noBell);
ok(p1.bell === null || (openForFit(p1.bell.fit) === 0.5 && p1.bell.id !== p1.top?.id), "without a bellflower a half-open flower stands in");
const noBud = garden.filter((f) => f.job.fit > 5);
const p2 = sweep("no bud", noBud);
ok(p2.bud === null, "no bud: the bud stop is skipped");
const p3 = sweep("one flower", garden.slice(0, 1));
ok(p3.bell === null && p3.bud === null && p3.steps.at(-1).step === "hint", "one flower: top, then the hint");
const p4 = sweep("empty", []);
ok(p4.steps.length === 0 && tour.tourAt(p4, 0.5).step === "free", "empty: no tour, straight to free explore");

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
