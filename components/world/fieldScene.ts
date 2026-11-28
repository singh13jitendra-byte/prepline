import type * as THREE_NS from "three";
import type { Three } from "@/lib/gl";
import type { WorldColorRole } from "@/lib/theme";
import { LENS_RADIUS } from "./bus";
import { FLY_DUR, FLY_STAGGER, FLY_START, LAND_T, PATH_T, TRAIL, TRAIL_SMALL } from "./flight";
import { ATLAS_COLS, ATLAS_ROWS, paintFlowerAtlas, type FlowerColors } from "./fieldFlowers";

/** The moth: how far a firefly drifted toward the lantern. Flowers are rooted: 0 (Lumi's light opens them instead). */
const MOTH_PULL = 0;
const MOTH_MAX = 14;
/** How bright an ember the lantern finds in the grass is. */
const EMBER_A = 0.34;

/**
 * THE FLOWERS — the World's one draw call. Round 6, with Lumi: every job is a flower rooted in the
 * meadow (fieldFlowers.ts: flower type = role type), so the one firefly on the page is Lumi. The
 * reading story below is unchanged from the fireflies it replaced; only the look changed:
 *   unread   a closed bud, quiet, swaying            read and set aside   it stays a bud, dims, sinks a little
 *   kept     it opens (half) as the Line reads it    the twelve           full bloom, warmer, as their rows' roles
 *   ranked   each of the twelve's blossoms lifts off its stem and flies into its row
 *   Lumi     near its light flowers open a little and catch the lamp (uLens; no moth pull)
 * Seats at dawn and the twelve's glow trails are still drawn as the soft discs described below.
 * The notes that follow are the round-4 design, kept for the maths.
 *
 * THE FIREFLIES — the World's one draw call (round 4: the painted world).
 *
 * One instanced quad per role, and every role is a firefly over the painted meadow: small,
 * warm, soft, and mostly dark. Each blinks on its own slow clock, so of the 2,340 only a
 * few hundred are lit at any moment; that is what keeps them fireflies and not a particle
 * field. No bloom, no halo, no lens glass, no dust. Everything a firefly does is decided
 * in the vertex shader from a handful of uniforms, so a scroll frame costs no CPU work:
 *
 *   unread      drifting, blinking, a pale warm green-yellow
 *   hero        drawn only inside the window's glass (uClip follows the painted window as
 *               the camera pushes through it)
 *   pass 1      read = its own screen y against the Line's y (uT1). Dropped: one last flare,
 *               then it goes out like an ember: it cools from lamp to red-amber (--art-ember-cool)
 *               as it drifts down into the grass, and fades. Kept: it stops blinking, blooms
 *               once, brightens to lamp yellow and settles near its home with a slow drift and
 *               bob, holding its glow (no grid since round 5).
 *   pass 2      the kept are read again from below (uT2): 174 go out as embers, 12 stay lit and grow
 *   afterglow   a firefly just read stays lit for about 0.4s (uHist1, uHist2)
 *   ranked      delight 3 (flight.ts): the 12 fly, in rank order and scrubbed by the wheel, on a
 *               bowed, fluttering path to the tip of their row's score rule (uRows), overshoot a
 *               hair, settle, and are absorbed into it. A short glow trail follows each: lagged
 *               copies of the flight clock (uFlyLag), drawn as extra instances after the field.
 *   dawn        25 come back up with the day line and ride it toward the seat rings (uRings),
 *               going out as the sweep ends (round 5: the rings are printed on the ticket, so
 *               nothing is drawn in the seat at rest)
 *
 * Indoors and by day the field is not drawn at all (uField), except the 25 in their rings.
 * The fragment shader draws a signed-distance rounded box: a firefly is a soft-edged disc,
 * a landed row is a hard-edged bar.
 */

/** Homes are spread a little past the viewport so drift and dolly never show an edge. */
const SPREAD = 1.1;
/**
 * The flowers grow in the meadow, not in the sky: a home's y (0 top .. 1 bottom of the lattice) is
 * mapped onto the ground, from the horizon (HORIZON of the canvas height) to just past the bottom.
 * Depth follows it (nearer = lower = bigger), with a little of the home's own random depth kept.
 */
const HORIZON = 0.47;
const GROUND = 1.02;
const DEPTH_FROM_Y = 0.72;
/** Flower height in px, far to near (an unread bud). */
const FLOWER_H = [16, 46] as const;

/** Screen position of a home at rest (no sway), for the CPU mirrors of the shader. */
export function homeOf(ax: number, ay: number, z: number, w: number, h: number, dolly: number) {
  const yy = ay + 0.5;
  const zz = z + (yy - z) * DEPTH_FROM_Y;
  const persp = 0.5 + zz;
  const gx = w / 2 + ax * w * SPREAD;
  const gy = h * (HORIZON + (GROUND - HORIZON) * Math.pow(Math.min(1, Math.max(0, yy)), 0.8));
  return { x: w / 2 + (gx - w / 2) * (1 + dolly * persp), y: h / 2 + (gy - h / 2) * (1 + dolly * persp), zz, persp };
}
/** The dolly the settle points are fitted for (the field's push-in during the passes). */
export const PASS_DOLLY = 0.13;
/** The breeze through the window (delight 4): how far out a firefly is blown, per px from the window's middle, far (z 0) + near (z 1). */
const BREEZE_NEAR = 0.06;
const BREEZE_Z = 0.18;
export const SEATS = 25;
export const BIG = 1e6;

export type FieldData = {
  /** Fireflies (the roles). Instances past `count` are the twelve's glow trails. */
  count: number;
  /** Instances drawn: count + 12 * trail. */
  total: number;
  /** Glow-trail copies per one of the twelve. */
  trail: number;
  mid: number;
  /** Instance index of the brightest of the twelve (rank 1): the first of the twelve. */
  first: number;
  /** home.x, home.y (−0.5..0.5), depth z, seed */
  a: Float32Array;
  /**
   * settle.x, settle.y (px), kind (0 dropped in pass 1, 1 dropped in pass 2, 2 kept), slot.
   * slot is the rank (0..11) for the kept, and seat number (1..25, 0 for none) for kind 1.
   */
  b: Float32Array;
};

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic field: a jittered lattice of homes, so the noise is even, never clumped. */
export function buildField(small: boolean): FieldData {
  const count = small ? 1200 : 2340;
  const mid = small ? 56 : 186;
  const rand = mulberry(2340);
  const aspect = small ? 0.5 : 1.6;
  const cols = Math.round(Math.sqrt(count * aspect));
  const rows = Math.ceil(count / cols);

  type S = { x: number; y: number; z: number; seed: number; kind: number; rank: number };
  const all: S[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    all.push({
      x: (c + 0.08 + rand() * 0.84) / cols - 0.5,
      y: (r + 0.08 + rand() * 0.84) / rows - 0.5,
      z: Math.pow(rand(), 1.45), // more far and faint than near and bright
      seed: rand(),
      kind: 0,
      rank: 0,
    });
  }
  // The kept come from the calm middle of the screen, so their snap is short.
  const pool = all.filter((s) => Math.abs(s.x * SPREAD) < 0.46 && s.y * SPREAD + 0.5 > 0.2 && s.y * SPREAD + 0.5 < 0.84);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const kept = pool.slice(0, mid);
  kept.forEach((s) => (s.kind = 1));
  // The twelve: spread over the screen, ranked top to bottom so their flights do not cross.
  const gold: S[] = [];
  const inner = small ? 0.38 : 0.4;
  for (const s of kept) {
    if (gold.length === 12) break;
    if (Math.abs(s.x * SPREAD) < inner && gold.every((g) => Math.hypot(g.x - s.x, (g.y - s.y) * 0.8) > (small ? 0.12 : 0.1))) gold.push(s);
  }
  for (const s of kept) {
    if (gold.length === 12) break;
    if (!gold.includes(s) && Math.abs(s.x * SPREAD) < inner) gold.push(s);
  }
  // Rank 1 sits right of centre and a little low: the empty half of the hero, where the lens parks on it.
  const lead = gold.reduce((best, s) => (Math.hypot(s.x - 0.17, s.y - 0.16) < Math.hypot(best.x - 0.17, best.y - 0.16) ? s : best), gold[0]);
  gold.sort((p, q) => (p === lead ? -1 : q === lead ? 1 : p.y - q.y));
  gold.forEach((s, i) => {
    s.kind = 2;
    s.rank = i;
    s.z = 0.5 + 0.2 * rand();
  });
  // 25 of the survivors of pass 1 will become the seats.
  kept.filter((s) => s.kind === 1).slice(0, SEATS).forEach((s, i) => (s.rank = i + 1));
  // Draw order: dust first, the kept above it, the gold last.
  all.sort((p, q) => p.kind - q.kind || p.rank - q.rank);

  // The glow trails (delight 3): copies of the twelve, after everything else. kind 2 + k marks
  // trail copy k (1..trail) of the firefly of the same rank; they share its home and seed.
  const trail = small ? TRAIL_SMALL : TRAIL;
  const total = count + 12 * trail;
  const a = new Float32Array(total * 4);
  const b = new Float32Array(total * 4);
  all.forEach((s, i) => {
    a.set([s.x, s.y, s.z, s.seed], i * 4);
    b.set([0, 0, s.kind, s.rank], i * 4);
  });
  for (let k = 1; k <= trail; k++) {
    gold.forEach((s, r) => {
      const i = count + (k - 1) * 12 + r;
      a.set([s.x, s.y, s.z, s.seed], i * 4);
      b.set([0, 0, 2 + k, r], i * 4);
    });
  }
  return { count, total, trail, mid, first: count - 12, a, b };
}

/**
 * Where every kept firefly settles: its own home, as it stands at the passes' dolly, held inside
 * the band the Line reads (17%–87% of the stage). No lattice (round 5, review P1-1): the kept come
 * from an evenly jittered field, so their homes are already spaced like a loose swarm; the shader
 * gives each a slow drift and bob around it. Pass 2 reads this y, and the twelve fly from here.
 */
export function fitSettle(data: FieldData, w: number, canvasH: number, stageH = canvasH) {
  const { count, a, b } = data;
  // The canvas is as tall as the largest viewport; the story happens in the stage (100svh).
  // Flowers: the kept stay on the ground, inside the part of it the Line reads.
  const y0 = stageH * 0.5;
  const y1 = stageH * 0.9;
  for (let i = 0; i < count; i++) {
    if (b[i * 4 + 2] < 1) continue;
    const hm = homeOf(a[i * 4], a[i * 4 + 1], a[i * 4 + 2], w, canvasH, PASS_DOLLY);
    b[i * 4] = Math.min(w - 24, Math.max(24, hm.x));
    b[i * 4 + 1] = Math.min(y1, Math.max(y0, hm.y));
  }
  // The trails settle where their firefly does.
  for (let i = count; i < data.total; i++) {
    const head = count - 12 + b[i * 4 + 3];
    b[i * 4] = b[head * 4];
    b[i * 4 + 1] = b[head * 4 + 1];
  }
}

const vert = /* glsl */ `
  attribute vec4 aA;
  attribute vec4 aB;

  uniform vec2 uRes;
  uniform float uTime;
  uniform float uT1;
  uniform float uT2;
  uniform vec4 uHist1;
  uniform vec4 uHist2;
  uniform float uBand;
  uniform float uDolly;
  uniform vec2 uPar;
  uniform float uField;
  uniform float uIntro;
  uniform float uFly;     // ranked beat progress (-1 before it, 2 after it): the flight clock
  uniform vec4 uFlyLag;   // the same clock, lagged in time, one per trail copy
  uniform float uOnly12;  // 1 while the canvas is lifted over the list: only the twelve are drawn
  uniform vec4 uRows[12]; // landing point per rank: x, y (CSS px), has (1 when the row is laid out)
  uniform vec3 uLens;   // the lantern: x, y (CSS px), how lit 0..1
  uniform vec4 uFocus;  // the firefly being named: instance id (-1 none), held x, y, hold 0..1
  uniform vec4 uRings[${SEATS}];
  uniform float uSeatC;
  uniform float uSeatLine;
  uniform float uBeadY;
  uniform vec2 uClaim; // seat number (0 none), fill 0..1
  uniform vec4 uBreeze; // the window's middle x, y (CSS px), strength 0..1, reach (CSS px): delight 4
  uniform float uRankType[12]; // the twelve's flower (fieldFlowers.ts flowerOf, from each row's title)

  // Colours come from the theme (lib/theme.ts readWorld, set in worldRuntime.ts): no literals here.
  uniform vec3 ucWarm;  // --art-speck-warm: an unlit, unread firefly leans this way
  uniform vec3 ucGold;  // --c-match (night): lamp
  uniform vec3 ucSeat;  // --art-seat: a seat by day
  uniform vec3 ucEdge;  // --c-on-night: a landed row's border
  uniform vec3 ucEmber; // --art-ember-cool: a set-aside firefly cooling as it sinks

  varying vec2 vP;
  varying vec2 vBox;
  varying float vRad;
  varying float vSoft;
  varying vec4 vCol;
  varying vec4 vDay;
  varying vec2 vFx;   // border, flat fill (0 = soft firefly, 1 = flat shape)
  varying vec3 vEdge;
  varying vec2 vUV;      // flower sprite: 0..1 inside its cell
  varying vec4 vSprite;  // flower: type row, stage column a, stage column b, blend
  varying float vMode;   // 1 = a flower from the atlas, 0 = the soft disc (seats, glow trails)
  varying float vGlow;   // flower: how much lamp light it holds (a flare, the twelve, Lumi near)

  const float PI = 3.14159265;

  // cubic-bezier(0.65, 0, 0.15, 1): the page's travel curve.
  float travelEase(float x) {
    if (x <= 0.0) return 0.0;
    if (x >= 1.0) return 1.0;
    float t = x;
    for (int i = 0; i < 5; i++) {
      float fx = ((2.5 * t - 3.45) * t + 1.95) * t - x;
      float d = (7.5 * t - 6.9) * t + 1.95;
      t -= fx / max(d, 0.0001);
    }
    return (3.0 - 2.0 * t) * t * t;
  }
  // How recently the Line passed y: 1 just now, 0 from about 0.4s ago. dir +1 reads downward.
  float afterglow(float y, float now, vec4 hist, float dir) {
    vec4 unread = clamp((y - hist) * dir / 10.0 + 0.5, 0.0, 1.0);
    float read = clamp((now - y) * dir / 10.0 + 0.5, 0.0, 1.0);
    return read * dot(unread, vec4(0.25));
  }

  void main() {
    float z = aA.z;
    float sd = aA.w;
    float kind = aB.z;
    float slot = aB.w;
    vec2 G = aB.xy;
    float h1 = fract(sd * 17.13);
    float h2 = fract(sd * 91.7);
    float h3 = fract(sd * 263.1);
    float h4 = fract(sd * 571.3);

    // A flower is rooted in the meadow: home on the ground, nearer (bigger) toward the bottom.
    float yy = clamp(aA.y + 0.5, 0.0, 1.0);
    z = mix(z, yy, ${DEPTH_FROM_Y.toFixed(2)});
    float persp = 0.5 + z;
    vec2 c = uRes * 0.5;
    vec2 G0 = vec2(c.x + aA.x * uRes.x * ${SPREAD.toFixed(2)}, uRes.y * (${HORIZON.toFixed(3)} + ${(GROUND - HORIZON).toFixed(3)} * pow(yy, 0.8)));
    // It sways in the night air; it does not wander.
    vec2 drift = vec2(sin(uTime * (0.35 + 0.30 * h1) + h2 * 6.283) + 0.4 * sin(uTime * (0.9 + 0.4 * h3) + h4 * 6.283), 0.0) * (0.8 + 2.2 * z);
    vec2 P0 = c + (G0 - c) * (1.0 + uDolly * persp) + drift + uPar * persp;
    // The breeze through the window (hero push): the ones near it are blown gently out toward the
    // viewer, the near ones (z) more: a parallax burst that dies away. Mirrored by pickSpeck.
    vec2 bd = P0 - uBreeze.xy;
    float bw = uBreeze.z * exp(-dot(bd, bd) / (uBreeze.w * uBreeze.w));
    P0 += bd * bw * (${BREEZE_NEAR.toFixed(2)} + ${BREEZE_Z.toFixed(2)} * z) * 0.2; // a rooted flower only bends

    // Each firefly blinks on its own slow clock: lit for about a third of it, dark for the rest.
    float phase = fract(uTime * (0.055 + 0.07 * h1) + h2);
    float lit = smoothstep(0.0, 0.10, phase) * (1.0 - smoothstep(0.22, 0.46, phase));
    float r0 = (mix(1.3, 2.8, z) + h4 * 0.4) * (1.0 + 0.35 * bw * z);
    // Unread tops out below the kept (0.8 against 0.96 and a bigger disc), so read = lit is legible.
    float a0 = (0.07 + 0.73 * lit) * mix(0.45, 1.0, z);

    vec2 P = P0;
    float radius = r0 * (0.8 + 0.4 * lit);
    float alpha = a0;
    vec3 col = mix(ucWarm, ucGold, 0.35 + 0.35 * lit);
    vec3 dayCol = ucGold; // a seat is a small lamp dot; claimed, the lamp fills the ring
    vec3 edgeCol = ucGold;
    float dayA = 0.0;
    float border = 0.0;
    float flat_ = 0.0;
    float shape = 0.0;
    float gone = 0.0;
    float seatK = 0.0;
    float aside = 0.0; // 0..1: read and set aside (gone out)
    float inFlight = 0.0; // one of the twelve, on its way to its row (or absorbed in it)
    float field = uField;
    vec2 box = vec2(0.0);
    float rad = 0.0;
    // The flower: how open (0 bud, 0.5 half, 1 full bloom), the lamp light it holds, how far it has
    // gone back into the grass (set aside), whether it is a head in flight (ranked).
    float open = 0.0;
    float fGlow = 0.0;
    float fDim = 0.0;
    float headK = 0.0;
    float fH = mix(${FLOWER_H[0].toFixed(1)}, ${FLOWER_H[1].toFixed(1)}, z) * (0.85 + 0.3 * h4);
    float fA = mix(0.4, 0.78, z);
    float fTint = mix(0.52, 0.74, z);

    // Pass 1: read the moment the Line's y passes the firefly's own y.
    float r1 = clamp((uT1 - P0.y) / uBand, 0.0, 1.0);
    float e1 = r1 * r1 * (3.0 - 2.0 * r1);
    float flare = sin(PI * clamp(r1 * 2.2, 0.0, 1.0));
    float glow = afterglow(P0.y, uT1, uHist1, 1.0);

    if (kind < 0.5) {
      // Dropped: it brightens for a moment (one last flare), then goes out like an ember: it cools
      // from lamp to red-amber as it drifts down into the grass, and fades.
      float dim = e1 * (1.0 - glow * 0.85);
      aside = smoothstep(0.5, 0.9, e1);
      float ember = smoothstep(0.1, 0.34, e1) * (1.0 - smoothstep(0.5, 1.0, e1)) * (1.0 - glow * 0.5);
      float cool = smoothstep(0.16, 0.62, e1);
      P.y += e1 * (2.0 + 5.0 * z);
      fGlow = max(flare * 0.9, glow * 0.5) * (1.0 - e1 * 0.6);
      fDim = dim;
      alpha = mix(alpha, 0.0, dim) + (flare * 0.9 + glow * 0.4) * (1.0 - e1) + ember * (0.34 + 0.24 * z);
      radius = mix(radius, mix(r0 * 0.55, max(r0 * 0.85, 1.5), ember), dim) + flare * 1.1;
      col = mix(col, ucGold, max(glow, flare) * 0.85);
      col = mix(col, ucEmber, cool * (1.0 - flare * 0.7));
    } else {
      float r2 = clamp((G.y - uT2) / uBand, 0.0, 1.0) * r1;
      float e2 = r2 * r2 * (3.0 - 2.0 * r2);
      float glow2 = afterglow(G.y, uT2, uHist2, -1.0) * step(0.5, r1);
      float flare2 = sin(PI * clamp(r2 * 2.2, 0.0, 1.0));
      // Kept: it stops blinking, brightens to lamp yellow and settles near its home, where it
      // keeps a slow drift and bob (smaller and slower than the unread's) and holds its glow.
      vec2 settle = vec2(sin(uTime * (0.3 + 0.2 * h2) + h1 * 6.283) * (0.8 + 1.6 * z), 0.0);
      float breathe = 1.0 + 0.06 * sin(uTime * (0.35 + 0.2 * h3) + h2 * 6.283);
      P = mix(P0, G + settle, e1);
      // Kept: one bloom as the Line reads it, then a steady lamp.
      radius = mix(radius, 4.4 * breathe, e1) + flare * 1.8;
      alpha = max(mix(alpha, 0.98, e1), flare);
      col = mix(col, min(ucGold * 1.12, vec3(1.0)), e1);
      open = 0.6 * e1 + 0.25 * flare;
      fGlow = flare * 0.9 + 0.08 * e1;
      fA = mix(fA, 1.0, e1);
      fTint = mix(fTint, 1.0, e1);
      fH *= 1.0 + 0.15 * e1;
      if (kind < 1.5) {
        float dim2 = e2 * (1.0 - glow2 * 0.85);
        aside = smoothstep(0.5, 0.9, e2);
        float ember2 = smoothstep(0.1, 0.34, e2) * (1.0 - smoothstep(0.5, 1.0, e2)) * (1.0 - glow2 * 0.5);
        float cool2 = smoothstep(0.16, 0.62, e2);
        P.y += e2 * (2.0 + 5.0 * z);
        open = mix(open, 0.06, e2) + 0.2 * flare2;
        fGlow = max(fGlow * (1.0 - e2), max(flare2 * 0.8, glow2 * 0.4));
        fDim = dim2;
        alpha = mix(alpha, 0.0, dim2) + (flare2 * 0.8 + glow2 * 0.35) * (1.0 - e2) + ember2 * 0.5;
        radius = mix(radius, mix(1.4, 2.4, ember2), dim2) + flare2 * 1.0;
        col = mix(col, ucGold, flare2 * 0.8);
        col = mix(col, ucEmber, cool2 * (1.0 - flare2 * 0.7));

        // Dawn: 25 of them come back up, ride the Line as it brings the day, and are left
        // in the seat rings as it passes them.
        if (slot > 0.5 && uSeatC > 0.0) {
          vec4 ring = uRings[int(slot - 0.5)];
          seatK = uSeatC * uSeatC * (3.0 - 2.0 * uSeatC) * step(0.5, ring.z);
          float span = uRes.y * 0.22;
          float g = clamp((ring.y + span - uSeatLine) / (span + 24.0), 0.0, 1.0);
          float tr = travelEase(g);
          vec2 S = vec2(mix(G.x, ring.x, tr), max(uBeadY, ring.y));
          float fill = step(abs(slot - uClaim.x), 0.5) * uClaim.y;
          float pin = mix(2.4, max(1.6, ring.z * 0.2), tr);
          P = mix(P, S, seatK);
          radius = mix(radius, mix(pin, ring.z * 0.64, fill * fill * (3.0 - 2.0 * fill)), seatK);
          alpha = mix(alpha, 1.0, seatK);
          dayA = seatK;
          flat_ = seatK * tr;
          field = max(field, seatK);
        }
      } else {
        // The twelve: lamp, a little larger, steady. No halo. kind 2 is the firefly; 3.. its trail.
        float trail = kind - 2.0;
        radius *= mix(1.0, 2.3, e2) * (1.0 + 0.3 * sin(PI * clamp(glow2 * 1.2, 0.0, 1.0)));
        // Full bloom for the twelve, a hair less open the lower its rank (the fit), and warm.
        open = mix(open, 1.0 - 0.03 * slot, e2) + 0.15 * flare2;
        fGlow = max(fGlow, flare2 * 0.8) + 0.22 * e2;
        fH *= mix(1.0, 1.45, e2);

        // Ranked (delight 3): it flies to its row in rank order, scrubbed by the wheel, and is
        // absorbed into the tip of the row's score rule: the dots become the product.
        vec4 tgt = uRows[int(slot + 0.5)];
        float has = step(0.5, tgt.z);
        float lead = ${FLY_START.toFixed(3)} + slot * ${FLY_STAGGER.toFixed(3)};
        float tH = clamp((uFly - lead) / ${FLY_DUR.toFixed(3)}, 0.0, 1.0);
        float clk = trail < 0.5 ? uFly : dot(uFlyLag, vec4(equal(vec4(trail), vec4(1.0, 2.0, 3.0, 4.0))));
        float t = clamp((clk - lead) / ${FLY_DUR.toFixed(3)}, 0.0, 1.0);
        vec2 A = P;
        vec2 d = tgt.xy - A;
        float dist = max(length(d), 1.0);
        vec2 dir = d / dist;
        vec2 n = vec2(dir.y, -dir.x);
        if (n.y > 0.0) n = -n; // the path bows upward, like a light tossed from the hand
        vec2 Cc = (A + tgt.xy) * 0.5 + n * (0.16 + 0.1 * h2) * dist;
        float u = travelEase(clamp(t / ${PATH_T.toFixed(2)}, 0.0, 1.0));
        vec2 Q = mix(mix(A, Cc, u), mix(Cc, tgt.xy, u), u);
        vec2 arrive = normalize(tgt.xy - Cc + vec2(0.0001));
        float air = sin(PI * clamp(t / ${LAND_T.toFixed(2)}, 0.0, 1.0));
        // A small dip back before it leaves; it sails a hair past the dot and settles onto it.
        Q -= dir * 6.0 * sin(PI * clamp(t / 0.14, 0.0, 1.0));
        Q += arrive * min(0.035 * dist, 9.0) * sin(PI * clamp((t - 0.56) / ${(LAND_T - 0.56).toFixed(2)}, 0.0, 1.0));
        // A firefly never flies straight: a slow weave along the path and a quick flutter in time.
        Q += n * sin(t * 17.0 + h1 * 6.283) * 4.0 * air;
        Q += vec2(sin(uTime * 6.3 + h3 * 6.283), cos(uTime * 4.9 + h4 * 6.283)) * 1.8 * air;
        P = mix(A, Q, has);
        inFlight = has * step(0.0005, tH);
        float absorb = smoothstep(${LAND_T.toFixed(2)}, 1.0, t);
        float pop = sin(PI * clamp((t - ${(LAND_T - 0.06).toFixed(2)}) / 0.12, 0.0, 1.0));
        radius = mix(radius, radius * 0.6, smoothstep(0.0, 0.2, t) * has);
        radius = mix(radius, 1.0, absorb * has) + pop * 1.4 * has;
        // The blossom lifts off its stem and flies; it shrinks into the row's dot as it lands.
        headK = smoothstep(0.0, 0.12, tH) * has;
        fH = mix(fH, 17.0, smoothstep(0.0, 0.2, t) * has) * (1.0 - 0.82 * absorb * has) + pop * 4.0 * has;
        fGlow = mix(fGlow, 0.5, max(air, pop) * has);
        fA = mix(fA, 1.0, max(air, pop) * has);
        alpha = mix(alpha, 1.0, max(air, pop) * has);
        col = mix(col, min(ucGold * 1.15, vec3(1.0)), max(air, pop) * has);
        // Absorbed: drawn no more. With no row to go to (not laid out) it simply goes out.
        gone = has * step(0.9999, t) + (1.0 - has) * smoothstep(0.0, 0.3, tH);
        if (trail > 0.5) {
          // The glow trail: a lagged copy, fainter and smaller, gone as soon as the wheel rests.
          float lagK = clamp(abs(tH - t) * 30.0, 0.0, 1.0);
          alpha *= 0.4 * pow(0.6, trail - 1.0) * lagK * step(0.0005, t) * (1.0 - absorb) * has;
          radius *= 0.92 - 0.12 * trail;
          gone = has * step(0.9999, t) + (1.0 - has);
        }
      }
    }

    // The lantern: near it a firefly brightens and drifts a little toward it, like a moth. The
    // ones already set aside (gone out in the grass) glow again faintly as embers where the lamp
    // finds them, so the reader can ask them why. Mirrored on the CPU by pickSpeck below.
    float dl = distance(P, uLens.xy);
    float lk = uLens.z * (1.0 - smoothstep(${(LENS_RADIUS * 0.3).toFixed(1)}, ${LENS_RADIUS.toFixed(1)}, dl)) * (1.0 - inFlight) * (1.0 - seatK) * step(kind, 2.5);
    P += (uLens.xy - P) / max(dl, 1.0) * min(dl * ${MOTH_PULL.toFixed(2)}, ${MOTH_MAX.toFixed(1)}) * lk;
    radius *= 1.0 + 0.18 * lk;
    alpha = mix(alpha, max(alpha, 0.85), lk * step(0.02, alpha + lit) * (1.0 - aside));
    alpha = max(alpha, ${EMBER_A.toFixed(2)} * lk * aside);
    col = mix(col, ucWarm * 0.72, lk * aside);
    radius = mix(radius, max(radius, 1.8), lk * aside);
    // Lumi's light: the flowers it passes open a little and catch the lamp (it reads them).
    open += 0.32 * lk * (1.0 - aside);
    fGlow += 0.35 * lk;
    fDim *= 1.0 - 0.6 * lk;

    // Named: it stops for the reader and holds still beside its tag, lit (an ember stays an ember).
    float fk = step(abs(float(gl_InstanceID) - uFocus.x), 0.5) * uFocus.w * (1.0 - inFlight) * (1.0 - seatK);
    P = mix(P, uFocus.yz, fk);
    alpha = mix(alpha, mix(1.0, 0.62, aside), fk);
    radius = mix(radius, max(radius, mix(3.6, 2.4, aside)), fk);

    // A flower unless it is a seat being carried to its ring or a glow trail: those stay soft discs.
    float mode = (seatK > 0.5 || kind > 2.5) ? 0.0 : 1.0;
    if (mode > 0.5) {
      alpha = fA * mix(1.0, 0.32, fDim);
      if (inFlight > 0.5) alpha = max(alpha, 0.98);
    }

    // Load: they come out a few at a time.
    alpha *= smoothstep(h3 * 0.7, h3 * 0.7 + 0.3, uIntro);
    alpha *= (1.0 - gone) * field;
    // Lifted over the list (ranked): only the twelve and their trails, never an ember over the copy.
    alpha *= mix(1.0, step(1.5, kind), uOnly12);
    dayA *= 1.0 - gone;

    if (shape <= 0.0) {
      box = vec2(radius);
      rad = radius;
    }
    // A firefly's edge is as soft as it is wide; a row or a seat is printed flat.
    float soft = mix(radius * 0.95, 0.75, flat_);
    float pad = soft + 1.5;
    vec2 hs = box + pad;
    vP = position.xy * hs;
    vBox = box;
    vRad = rad;
    vSoft = soft;
    vCol = vec4(col, alpha);
    vDay = vec4(dayCol, dayA);
    vFx = vec2(border * (1.0 - gone), flat_);
    vEdge = edgeCol;
    vMode = mode;
    vGlow = clamp(fGlow, 0.0, 1.0);
    vUV = position.xy * 0.5 + 0.5;
    vec2 px = P + vP;
    if (mode > 0.5) {
      // Which flower: the twelve are their rows' roles; every other job is weighted like the market.
      float hT = fract(sd * 37.77);
      float ftype = kind > 1.5 ? uRankType[int(slot + 0.5)] : (hT < 0.36 ? 0.0 : hT < 0.6 ? 1.0 : hT < 0.75 ? 2.0 : hT < 0.88 ? 3.0 : 4.0);
      float st = mix(clamp(open, 0.0, 1.0) * 2.0, 3.0, headK);
      float sa = min(floor(st), 2.0 + step(2.999, st));
      vSprite = vec4(ftype, sa, min(sa + 1.0, 3.0), st - sa);
      vCol = vec4(vec3(fTint * mix(1.0, 0.55, fDim)), alpha);
      // The stem's base is on the ground at P; a flying head is centred on P.
      vec2 hs = vec2(fH * 0.5);
      vP = position.xy * hs;
      px = P - vec2(0.0, fH * 0.5 * (1.0 - headK)) + vP;
    }
    gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
    if (alpha < 0.004 && dayA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uDayTop;
  uniform vec4 uClip; // x0, y0, x1, y1: the window's glass, in CSS px
  uniform sampler2D uAtlas; // the flowers (fieldFlowers.ts): ${ATLAS_ROWS} types x ${ATLAS_COLS} stages, premultiplied
  uniform vec3 ucGold;

  varying vec2 vP;
  varying vec2 vBox;
  varying float vRad;
  varying float vSoft;
  varying vec4 vCol;
  varying vec4 vDay;
  varying vec2 vFx;
  varying vec3 vEdge;
  varying vec2 vUV;
  varying vec4 vSprite;
  varying float vMode;
  varying float vGlow;

  void main() {
    vec2 p = vec2(gl_FragCoord.x / uDpr, uRes.y - gl_FragCoord.y / uDpr);
    // Inside the glass only, with a few px of give so nothing is cut hard at the frame.
    vec2 inside = smoothstep(uClip.xy - 2.0, uClip.xy + 6.0, p) * (1.0 - smoothstep(uClip.zw - 6.0, uClip.zw + 2.0, p));
    float clip = inside.x * inside.y;

    if (vMode > 0.5) {
      // A flower: two neighbouring stages of its type, blended by how open it is. Night only.
      vec2 uv = clamp(vUV, 0.004, 0.996);
      vec2 grid = vec2(${ATLAS_COLS.toFixed(1)}, ${ATLAS_ROWS.toFixed(1)});
      vec4 ta = texture2D(uAtlas, (vec2(vSprite.y, vSprite.x) + uv) / grid);
      vec4 tb = texture2D(uAtlas, (vec2(vSprite.z, vSprite.x) + uv) / grid);
      vec4 t = mix(ta, tb, vSprite.w);
      float fa = t.a * vCol.a * clip * (1.0 - step(uDayTop, p.y));
      if (fa < 0.003) discard;
      vec3 straight = t.rgb / max(t.a, 0.001);
      vec3 fc = straight * vCol.rgb + ucGold * vGlow * 0.55;
      gl_FragColor = vec4(min(fc, vec3(1.0)) * fa, fa);
      return;
    }

    vec2 q = abs(vP) - (vBox - vRad);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - vRad;
    float fill = 1.0 - smoothstep(-vSoft, vSoft, d);
    // A soft light falls off toward its edge; a printed shape does not.
    fill = mix(fill * fill * (0.55 + 0.45 * fill), fill, vFx.y);
    float edge = vFx.x * (1.0 - smoothstep(0.35, 1.25, abs(d + 0.9)));

    float day = step(uDayTop, p.y);
    float aBody = mix(vCol.a, vDay.a, day) * fill;
    float aEdge = edge * 0.85 * (1.0 - day);
    float a = clamp(aBody + aEdge, 0.0, 1.0) * clip;
    if (a < 0.003) discard;
    vec3 base = mix(vCol.rgb, vDay.rgb, day);
    vec3 col = (base * aBody + vEdge * aEdge) / max(aBody + aEdge, 0.0001);
    gl_FragColor = vec4(col * a, a);
  }
`;

export type FieldUniforms = {
  uRes: { value: THREE_NS.Vector2 };
  uDpr: { value: number };
  uTime: { value: number };
  uDayTop: { value: number };
  uClip: { value: THREE_NS.Vector4 };
  uT1: { value: number };
  uT2: { value: number };
  uHist1: { value: THREE_NS.Vector4 };
  uHist2: { value: THREE_NS.Vector4 };
  uBand: { value: number };
  uDolly: { value: number };
  uPar: { value: THREE_NS.Vector2 };
  uField: { value: number };
  uIntro: { value: number };
  uFly: { value: number };
  uFlyLag: { value: THREE_NS.Vector4 };
  uOnly12: { value: number };
  uRows: { value: THREE_NS.Vector4[] };
  uLens: { value: THREE_NS.Vector3 };
  uFocus: { value: THREE_NS.Vector4 };
  uRings: { value: THREE_NS.Vector4[] };
  uSeatC: { value: number };
  uSeatLine: { value: number };
  uBeadY: { value: number };
  uClaim: { value: THREE_NS.Vector2 };
  uBreeze: { value: THREE_NS.Vector4 };
  uRankType: { value: number[] };
  uAtlas: { value: THREE_NS.Texture | null };
  ucWarm: { value: THREE_NS.Vector3 };
  ucGold: { value: THREE_NS.Vector3 };
  ucSeat: { value: THREE_NS.Vector3 };
  ucEdge: { value: THREE_NS.Vector3 };
  ucEmber: { value: THREE_NS.Vector3 };
};

/** Field uniform ← world colour role (lib/theme.ts WORLD_COLORS). */
export const FIELD_COLORS = {
  ucWarm: "speckWarm",
  ucGold: "match",
  ucSeat: "seat",
  ucEdge: "edge",
  ucEmber: "emberCool",
} as const satisfies Partial<Record<keyof FieldUniforms, WorldColorRole>>;

export function createField(THREE: Three, data: FieldData, width: number, height: number) {
  const base = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  const attrB = new THREE.InstancedBufferAttribute(data.b, 4);
  attrB.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aA", new THREE.InstancedBufferAttribute(data.a, 4));
  geo.setAttribute("aB", attrB);
  geo.instanceCount = data.total;

  const v3 = () => new THREE.Vector3(1, 1, 1);
  const uniforms: FieldUniforms = {
    uRes: { value: new THREE.Vector2(width, height) },
    uDpr: { value: 1 },
    uTime: { value: 0 },
    uDayTop: { value: BIG },
    uClip: { value: new THREE.Vector4(-BIG, -BIG, BIG, BIG) },
    uT1: { value: -BIG },
    uT2: { value: BIG },
    uHist1: { value: new THREE.Vector4(-BIG, -BIG, -BIG, -BIG) },
    uHist2: { value: new THREE.Vector4(BIG, BIG, BIG, BIG) },
    uBand: { value: 80 },
    uDolly: { value: 0 },
    uPar: { value: new THREE.Vector2(0, 0) },
    uField: { value: 1 },
    uIntro: { value: 0 },
    uFly: { value: -1 },
    uFlyLag: { value: new THREE.Vector4(-1, -1, -1, -1) },
    uOnly12: { value: 0 },
    uRows: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uLens: { value: new THREE.Vector3(0, 0, 0) },
    uFocus: { value: new THREE.Vector4(-1, 0, 0, 0) },
    uRings: { value: Array.from({ length: SEATS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uSeatC: { value: 0 },
    uSeatLine: { value: BIG },
    uBeadY: { value: BIG },
    uClaim: { value: new THREE.Vector2(0, 0) },
    uBreeze: { value: new THREE.Vector4(0, 0, 0, 1) },
    uRankType: { value: Array.from({ length: 12 }, () => 0) },
    uAtlas: { value: null },
    ucWarm: { value: v3() },
    ucGold: { value: v3() },
    ucSeat: { value: v3() },
    ucEdge: { value: v3() },
    ucEmber: { value: v3() },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide, // y is flipped to screen space, which reverses the winding
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  // The flowers' atlas, repainted whenever the theme changes (worldRuntime calls paint()).
  let atlas: THREE_NS.CanvasTexture | null = null;
  const paint = (colors: FlowerColors) => {
    const tex = new THREE.CanvasTexture(paintFlowerAtlas(colors));
    tex.flipY = false;
    tex.premultiplyAlpha = true;
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 2;
    atlas?.dispose();
    atlas = tex;
    uniforms.uAtlas.value = tex;
  };

  const resize = (w: number, h: number) => {
    uniforms.uRes.value.set(w, h);
    const stage = document.querySelector<HTMLElement>(".story-stage");
    fitSettle(data, w, h, Math.min(h, (stage && stage.offsetHeight) || h));
    attrB.needsUpdate = true;
  };
  resize(width, height);

  return {
    mesh,
    uniforms,
    resize,
    paint,
    dispose: () => {
      base.dispose();
      atlas?.dispose();
    },
  };
}

/* ───────────────────────────── CPU mirror, for the lantern's tag only ── */

/**
 * unread     not read yet (below the Line in pass 1, and every firefly in the hero)
 * dropped1   set aside in pass 1 (level, city, office days)
 * kept1      survived pass 1, not yet read for portfolio fit
 * dropped2   set aside in pass 2 (portfolio fit)
 * kept2      one of the twelve, read twice and kept
 */
export type Verdict = "unread" | "dropped1" | "kept1" | "dropped2" | "kept2";
const hit = { index: -1, verdict: "unread" as Verdict, kind: 0, rank: 0, seed: 0, x: 0, y: 0 };

/**
 * The firefly nearest to (x, y), within `radius`, that is on screen to be named, with the state
 * the shader shows it in and where it is drawn right now. Mirrors the vertex shader's position
 * maths (drift, dolly, parallax, read, settle, the lantern's pull) and its clip to the window.
 * Called a few times a second at most, only while the pointer rests: never per frame.
 */
export function pickSpeck(data: FieldData, u: FieldUniforms, x: number, y: number, radius: number): typeof hit | null {
  const { count, a, b } = data;
  if (u.uField.value < 0.5) return null;
  const w = u.uRes.value.x;
  const h = u.uRes.value.y;
  const t = u.uTime.value;
  const band = u.uBand.value;
  const T1 = u.uT1.value;
  const T2 = u.uT2.value;
  const dolly = u.uDolly.value;
  const par = u.uPar.value;
  const clip = u.uClip.value;
  const L = u.uLens.value;
  const br = u.uBreeze.value;
  let best = -1;
  let bestD = radius * radius;
  let bx = 0;
  let by = 0;
  let bv: Verdict = "unread";
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const z = a[o + 2];
    const kind = b[o + 2];
    // One of the twelve on its way to its row (or absorbed in it) is never named (delight 3).
    if (kind > 1.5 && u.uFly.value > FLY_START + b[o + 3] * FLY_STAGGER) continue;
    const hm = homeOf(a[o], a[o + 1], z, w, h, dolly);
    const hx = hm.x + par.x * hm.persp;
    // Cheap reject before the trigonometry (drift is under 40px, the pull under 15); the kept
    // settle elsewhere, so they are always tested.
    if (kind < 1 && Math.abs(hx - x) > radius + 60) continue;
    const hy = hm.y + par.y * hm.persp;
    const sd = a[o + 3];
    const h1 = (sd * 17.13) % 1;
    const h2 = (sd * 91.7) % 1;
    const h3 = (sd * 263.1) % 1;
    const h4 = (sd * 571.3) % 1;
    const amp = 6 + 18 * z;
    let px0 = hx + (Math.sin(t * (0.1 + 0.16 * h1) + h2 * 6.283) + 0.5 * Math.sin(t * (0.23 + 0.1 * h3) + h4 * 6.283)) * amp;
    let py0 = hy + (Math.cos(t * (0.09 + 0.15 * h3) + h1 * 6.283) + 0.5 * Math.cos(t * (0.19 + 0.12 * h2) + h4 * 6.283)) * amp;
    if (br.z > 0) {
      const bdx = px0 - br.x;
      const bdy = py0 - br.y;
      const bk = br.z * Math.exp(-(bdx * bdx + bdy * bdy) / (br.w * br.w)) * (BREEZE_NEAR + BREEZE_Z * z);
      px0 += bdx * bk;
      py0 += bdy * bk;
    }
    const r1 = Math.min(1, Math.max(0, (T1 - py0) / band));
    const e1 = r1 * r1 * (3 - 2 * r1);
    let px = px0;
    let py = py0;
    let verdict: Verdict = r1 < 0.5 ? "unread" : kind < 0.5 ? "dropped1" : "kept1";
    if (kind < 0.5) {
      py += e1 * (34 + 80 * h3);
      px += Math.sin(e1 * 3 + h1 * 6.283) * 5 * e1;
    } else {
      const sx = Math.sin(t * (0.07 + 0.05 * h2) + h1 * 6.283) * (3 + 3 * z);
      const sy = Math.sin(t * (0.21 + 0.09 * h4) + h3 * 6.283) * (2.5 + 2 * h1);
      px = px0 + (b[o] + sx - px0) * e1;
      py = py0 + (b[o + 1] + sy - py0) * e1;
      const r2 = Math.min(1, Math.max(0, (b[o + 1] - T2) / band)) * r1;
      if (r2 >= 0.5) verdict = kind < 1.5 ? "dropped2" : "kept2";
      if (kind < 1.5) py += r2 * r2 * (3 - 2 * r2) * (34 + 80 * h3);
    }
    // The lantern's pull, as the shader applies it.
    const dlx = L.x - px;
    const dly = L.y - py;
    const dl = Math.hypot(dlx, dly);
    const lk = L.z * (1 - smooth(LENS_RADIUS * 0.3, LENS_RADIUS, dl));
    if (lk > 0) {
      const m = (Math.min(dl * MOTH_PULL, MOTH_MAX) * lk) / Math.max(dl, 1);
      px += dlx * m;
      py += dly * m;
    }
    // Only what is drawn can be named: inside the window's glass in the hero.
    if (px < clip.x + 4 || px > clip.z - 4 || py < clip.y + 4 || py > clip.w - 4) continue;
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      bestD = d;
      best = i;
      bx = px;
      by = py;
      bv = verdict;
    }
  }
  if (best < 0) return null;
  const o = best * 4;
  hit.index = best;
  hit.kind = b[o + 2];
  hit.rank = b[o + 3];
  hit.seed = a[o + 3];
  hit.x = bx;
  hit.y = by;
  hit.verdict = bv;
  return hit;
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
