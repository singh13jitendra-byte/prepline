import type * as THREE_NS from "three";
import type { Three } from "@/lib/gl";
import type { WorldColorRole } from "@/lib/theme";
import { LENS_RADIUS } from "./bus";

/**
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
 *               then it goes out (an ember for a moment) and sinks into the grass. Kept: it stops
 *               blinking, brightens to lamp yellow and settles near its home with a slow drift
 *               and bob, holding its glow (no grid since round 5).
 *   pass 2      the kept are read again from below (uT2): 174 dim and sink, 12 stay lit and grow
 *   afterglow   a firefly just read stays lit for about 0.4s (uHist1, uHist2)
 *   ranked      the 12 fly an arc to the live row rects (uRows) and stretch into the full row:
 *               a flat lamp tint with a lamp border, which hands over to the DOM row
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
/** The dolly the settle points are fitted for (the field's push-in during the passes). */
export const PASS_DOLLY = 0.13;
/**
 * The ranked flight, shared with Act I (components/acts/read/ReadPanel.tsx):
 * speck i leaves STAGGER * i seconds after `ranked` entry, flies FLIGHT seconds and lands as the
 * full row rect. The DOM row i fades in from ROW_IN + STAGGER * i over LAND_FADE seconds, and the
 * firefly's lamp border fades into the row's own border over the same window.
 */
export const STAGGER = 0.05;
export const FLIGHT = 0.55;
export const ROW_IN = 0.65;
export const LAND_FADE = 0.18;
/** Seconds after `ranked` entry at which the last speck has landed. */
export const LAST_LANDING = 11 * STAGGER + FLIGHT;
export const SEATS = 25;
export const BIG = 1e6;

export type FieldData = {
  count: number;
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

  const a = new Float32Array(count * 4);
  const b = new Float32Array(count * 4);
  all.forEach((s, i) => {
    a.set([s.x, s.y, s.z, s.seed], i * 4);
    b.set([0, 0, s.kind, s.rank], i * 4);
  });
  return { count, mid, first: count - 12, a, b };
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
  const y0 = stageH * 0.17;
  const y1 = stageH * 0.87;
  for (let i = 0; i < count; i++) {
    if (b[i * 4 + 2] < 1) continue;
    const persp = 0.5 + a[i * 4 + 2];
    const px = w / 2 + a[i * 4] * w * SPREAD * (1 + PASS_DOLLY * persp);
    const py = canvasH / 2 + a[i * 4 + 1] * canvasH * SPREAD * (1 + PASS_DOLLY * persp);
    b[i * 4] = Math.min(w - 24, Math.max(24, px));
    b[i * 4 + 1] = Math.min(y1, Math.max(y0, py));
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
  uniform float uAnt;
  uniform float uGatherT;
  uniform vec4 uRows[12];
  uniform float uRowR;
  uniform vec3 uLens;
  uniform vec4 uRings[${SEATS}];
  uniform float uSeatC;
  uniform float uSeatLine;
  uniform float uBeadY;
  uniform vec2 uClaim; // seat number (0 none), fill 0..1

  // Colours come from the theme (lib/theme.ts readWorld, set in worldRuntime.ts): no literals here.
  uniform vec3 ucWarm;  // --art-speck-warm: an unlit, unread firefly leans this way
  uniform vec3 ucGold;  // --c-match (night): lamp
  uniform vec3 ucSeat;  // --art-seat: a seat by day
  uniform vec3 ucEdge;  // --c-on-night: a landed row's border

  varying vec2 vP;
  varying vec2 vBox;
  varying float vRad;
  varying float vSoft;
  varying vec4 vCol;
  varying vec4 vDay;
  varying vec2 vFx;   // border, flat fill (0 = soft firefly, 1 = flat shape)
  varying vec3 vEdge;

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

    float persp = 0.5 + z;
    vec2 c = uRes * 0.5;
    vec2 drift = vec2(
      sin(uTime * (0.10 + 0.16 * h1) + h2 * 6.283) + 0.5 * sin(uTime * (0.23 + 0.10 * h3) + h4 * 6.283),
      cos(uTime * (0.09 + 0.15 * h3) + h1 * 6.283) + 0.5 * cos(uTime * (0.19 + 0.12 * h2) + h4 * 6.283)
    ) * (6.0 + 18.0 * z);
    vec2 P0 = c + aA.xy * uRes * ${SPREAD.toFixed(2)} * (1.0 + uDolly * persp) + drift + uPar * persp;

    // Each firefly blinks on its own slow clock: lit for about a third of it, dark for the rest.
    float phase = fract(uTime * (0.055 + 0.07 * h1) + h2);
    float lit = smoothstep(0.0, 0.10, phase) * (1.0 - smoothstep(0.22, 0.46, phase));
    float r0 = mix(1.3, 2.8, z) + h4 * 0.4;
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
    float field = uField;
    vec2 box = vec2(0.0);
    float rad = 0.0;

    // Pass 1: read the moment the Line's y passes the firefly's own y.
    float r1 = clamp((uT1 - P0.y) / uBand, 0.0, 1.0);
    float e1 = r1 * r1 * (3.0 - 2.0 * r1);
    float flare = sin(PI * clamp(r1 * 2.2, 0.0, 1.0));
    float glow = afterglow(P0.y, uT1, uHist1, 1.0);

    if (kind < 0.5) {
      // Dropped: one last flash, then it goes out: a dim ember for a moment, falling into the grass.
      float dim = e1 * (1.0 - glow * 0.85);
      float ember = smoothstep(0.2, 0.5, e1) * (1.0 - smoothstep(0.6, 1.0, e1)) * (1.0 - glow);
      P.y += e1 * (34.0 + 80.0 * h3);
      P.x += sin(e1 * 3.0 + h1 * 6.283) * 5.0 * e1;
      alpha = mix(alpha, 0.0, dim) + (flare * 0.8 + glow * 0.4) * (1.0 - e1) + ember * 0.16;
      radius = mix(radius, r0 * 0.55, dim) + flare * 0.9;
      col = mix(col, ucGold, max(glow, flare) * 0.75);
      col = mix(col, ucWarm * 0.55, ember);
    } else {
      float r2 = clamp((G.y - uT2) / uBand, 0.0, 1.0) * r1;
      float e2 = r2 * r2 * (3.0 - 2.0 * r2);
      float glow2 = afterglow(G.y, uT2, uHist2, -1.0) * step(0.5, r1);
      float flare2 = sin(PI * clamp(r2 * 2.2, 0.0, 1.0));
      // Kept: it stops blinking, brightens to lamp yellow and settles near its home, where it
      // keeps a slow drift and bob (smaller and slower than the unread's) and holds its glow.
      vec2 settle = vec2(
        sin(uTime * (0.07 + 0.05 * h2) + h1 * 6.283) * (3.0 + 3.0 * z),
        sin(uTime * (0.21 + 0.09 * h4) + h3 * 6.283) * (2.5 + 2.0 * h1)
      );
      float breathe = 1.0 + 0.06 * sin(uTime * (0.35 + 0.2 * h3) + h2 * 6.283);
      P = mix(P0, G + settle, e1);
      radius = mix(radius, 4.4 * breathe, e1) + flare * 1.0;
      alpha = mix(alpha, 0.98, e1);
      col = mix(col, min(ucGold * 1.12, vec3(1.0)), e1);
      if (kind < 1.5) {
        float dim2 = e2 * (1.0 - glow2 * 0.85);
        float ember2 = smoothstep(0.2, 0.5, e2) * (1.0 - smoothstep(0.6, 1.0, e2)) * (1.0 - glow2);
        P.y += e2 * (34.0 + 80.0 * h3);
        alpha = mix(alpha, 0.0, dim2) + (flare2 * 0.6 + glow2 * 0.35) * (1.0 - e2) + ember2 * 0.16;
        radius = mix(radius, 1.4, dim2) + flare2 * 0.8;
        col = mix(col, ucWarm * 0.55, ember2);

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
        // The twelve: lamp, a little larger, steady. No halo.
        radius *= mix(1.0, 2.3, e2) * (1.0 + 0.3 * sin(PI * clamp(glow2 * 1.2, 0.0, 1.0)));

        // Ranked: fly an arc to the live row rect and stretch from a light into the full row.
        vec4 row = uRows[int(slot + 0.5)];
        float has = step(1.0, row.z);
        float t0 = uGatherT - slot * ${STAGGER.toFixed(2)};
        float tr = travelEase(clamp(t0 / ${FLIGHT.toFixed(2)}, 0.0, 1.0));
        float travel = max(uAnt, tr) * has;
        vec2 C = row.xy + row.zw * 0.5;
        vec2 d = C - G;
        float dist = length(d);
        vec2 n = dist > 1.0 ? vec2(d.y, -d.x) / dist : vec2(0.0);
        if (n.y > 0.0) n = -n;
        P = mix(G, C, travel) + n * 0.06 * dist * sin(PI * travel);
        shape = smoothstep(0.3, 1.0, tr) * has;
        float landed = clamp((t0 - ${ROW_IN.toFixed(2)}) / ${LAND_FADE.toFixed(2)}, 0.0, 1.0);
        border = shape;
        flat_ = shape;
        edgeCol = mix(ucGold, ucEdge, landed);
        alpha = mix(alpha, 0.5, shape); // a flat lamp fill: it reads on the paper panel and on night
        gone = mix(landed, clamp(uGatherT / 0.3, 0.0, 1.0), 1.0 - has);
        box = mix(vec2(radius), row.zw * 0.5, shape);
        rad = min(mix(radius, uRowR, shape), min(box.x, box.y));
      }
    }

    // Near the pointer a firefly lights up and comes a little closer. No glass, no ring.
    float lk = uLens.z * (1.0 - smoothstep(${(LENS_RADIUS * 0.4).toFixed(1)}, ${LENS_RADIUS.toFixed(1)}, distance(P, uLens.xy))) * (1.0 - shape) * (1.0 - seatK);
    radius *= 1.0 + 0.15 * lk;
    alpha = mix(alpha, max(alpha, 0.85), lk * step(0.02, alpha + lit));

    // Load: they come out a few at a time.
    alpha *= smoothstep(h3 * 0.7, h3 * 0.7 + 0.3, uIntro);
    alpha *= (1.0 - gone) * field;
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

    vec2 px = P + vP;
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

  varying vec2 vP;
  varying vec2 vBox;
  varying float vRad;
  varying float vSoft;
  varying vec4 vCol;
  varying vec4 vDay;
  varying vec2 vFx;
  varying vec3 vEdge;

  void main() {
    vec2 p = vec2(gl_FragCoord.x / uDpr, uRes.y - gl_FragCoord.y / uDpr);
    // Inside the glass only, with a few px of give so nothing is cut hard at the frame.
    vec2 inside = smoothstep(uClip.xy - 2.0, uClip.xy + 6.0, p) * (1.0 - smoothstep(uClip.zw - 6.0, uClip.zw + 2.0, p));
    float clip = inside.x * inside.y;

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
  uAnt: { value: number };
  uGatherT: { value: number };
  uRows: { value: THREE_NS.Vector4[] };
  uRowR: { value: number };
  uLens: { value: THREE_NS.Vector3 };
  uRings: { value: THREE_NS.Vector4[] };
  uSeatC: { value: number };
  uSeatLine: { value: number };
  uBeadY: { value: number };
  uClaim: { value: THREE_NS.Vector2 };
  ucWarm: { value: THREE_NS.Vector3 };
  ucGold: { value: THREE_NS.Vector3 };
  ucSeat: { value: THREE_NS.Vector3 };
  ucEdge: { value: THREE_NS.Vector3 };
};

/** Field uniform ← world colour role (lib/theme.ts WORLD_COLORS). */
export const FIELD_COLORS = {
  ucWarm: "speckWarm",
  ucGold: "match",
  ucSeat: "seat",
  ucEdge: "edge",
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
  geo.instanceCount = data.count;

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
    uAnt: { value: 0 },
    uGatherT: { value: 0 },
    uRows: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uRowR: { value: 12 },
    uLens: { value: new THREE.Vector3(0, 0, 0) },
    uRings: { value: Array.from({ length: SEATS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uSeatC: { value: 0 },
    uSeatLine: { value: BIG },
    uBeadY: { value: BIG },
    uClaim: { value: new THREE.Vector2(0, 0) },
    ucWarm: { value: v3() },
    ucGold: { value: v3() },
    ucSeat: { value: v3() },
    ucEdge: { value: v3() },
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

  const resize = (w: number, h: number) => {
    uniforms.uRes.value.set(w, h);
    const stage = document.querySelector<HTMLElement>(".story-stage");
    fitSettle(data, w, h, Math.min(h, (stage && stage.offsetHeight) || h));
    attrB.needsUpdate = true;
  };
  resize(width, height);

  return { mesh, uniforms, resize, dispose: () => base.dispose() };
}

/* ───────────────────────────── CPU mirror, for the pointer note only ── */

export type Verdict = "unread" | "dropped1" | "kept" | "dropped2";
const hit = { index: -1, verdict: "unread" as Verdict, kind: 0, rank: 0, seed: 0, x: 0, y: 0 };

/**
 * The firefly nearest to (x, y) that is still in the air, with the state the shader shows
 * it in. Mirrors the vertex shader's position maths (drift, dolly, parallax, read, settle).
 */
export function nearestSpeck(data: FieldData, u: FieldUniforms, x: number, y: number, stick: number): typeof hit | null {
  const { count, a, b } = data;
  const w = u.uRes.value.x;
  const h = u.uRes.value.y;
  const t = u.uTime.value;
  const band = u.uBand.value;
  let best = -1;
  let bestD = LENS_RADIUS * LENS_RADIUS;
  let bx = 0;
  let by = 0;
  let br1 = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const z = a[o + 2];
    const persp = 0.5 + z;
    const hx = w / 2 + a[o] * w * SPREAD * (1 + u.uDolly.value * persp) + u.uPar.value.x * persp;
    const hy = h / 2 + a[o + 1] * h * SPREAD * (1 + u.uDolly.value * persp) + u.uPar.value.y * persp;
    // Cheap reject before the trigonometry (drift is under 40px).
    if (Math.abs(hx - x) > LENS_RADIUS + 60 && b[o + 2] < 1) continue;
    const sd = a[o + 3];
    const h1 = (sd * 17.13) % 1;
    const h2 = (sd * 91.7) % 1;
    const h3 = (sd * 263.1) % 1;
    const h4 = (sd * 571.3) % 1;
    const amp = 6 + 18 * z;
    const px0 = hx + (Math.sin(t * (0.1 + 0.16 * h1) + h2 * 6.283) + 0.5 * Math.sin(t * (0.23 + 0.1 * h3) + h4 * 6.283)) * amp;
    const py0 = hy + (Math.cos(t * (0.09 + 0.15 * h3) + h1 * 6.283) + 0.5 * Math.cos(t * (0.19 + 0.12 * h2) + h4 * 6.283)) * amp;
    const r1 = Math.min(1, Math.max(0, (u.uT1.value - py0) / band));
    const e1 = r1 * r1 * (3 - 2 * r1);
    const kind = b[o + 2];
    const r2 = kind >= 1 ? Math.min(1, Math.max(0, (b[o + 1] - u.uT2.value) / band)) * r1 : 0;
    // Fireflies that have sunk into the grass are not there to be read.
    if ((kind < 0.5 && r1 > 0.6) || (kind >= 0.5 && kind < 1.5 && r2 > 0.6)) continue;
    const px = kind < 0.5 ? px0 : px0 + (b[o] - px0) * e1;
    const py = kind < 0.5 ? py0 + e1 * (34 + 80 * h3) : py0 + (b[o + 1] - py0) * e1;
    let d = (px - x) * (px - x) + (py - y) * (py - y);
    if (i === stick) d -= 500; // hysteresis: the note does not flicker between neighbours
    if (d < bestD) {
      bestD = d;
      best = i;
      bx = px;
      by = py;
      br1 = r1;
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
  hit.verdict = br1 < 0.5 ? "unread" : "kept";
  return hit;
}
