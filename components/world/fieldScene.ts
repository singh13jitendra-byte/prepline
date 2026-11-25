import type * as THREE_NS from "three";
import type { Three } from "@/lib/gl";
import { LENS_RADIUS } from "./bus";

/**
 * THE FIELD — draw call 1 of 2.
 *
 * One instanced quad per role. Everything a speck does is decided in the vertex
 * shader from a handful of uniforms, so a scroll frame costs no CPU work:
 *
 *   unread      a slip or a soft warm disc, drifting; size, alpha and softness come from its depth
 *   pass 1      read = its own screen y against the line's y (uT1). Dropped specks flare,
 *               dim to 7% and sink. Kept ones come into focus and snap to the 48px grid.
 *   pass 2      the kept are read again from below (uT2): 12 turn gold, the rest dim
 *   afterglow   a speck just read stays lit for about 0.4s: the shader compares its y with
 *               where the line was 0.1, 0.2, 0.3 and 0.4s ago (uHist1, uHist2), so a fast scrub
 *               drags a trail of embers and a still line has none
 *   ranked      the 12 fly an arc to the live row rects (uRows) and stretch into the full row
 *   day / prep  the lattice lets go and everything is dust: ink on day, lamp-lit at night
 *   dawn, seat  25 of the survivors ride the day line up and are left in the seat rings (uRings)
 *
 * In focus a speck is a tiny listing: a 7x4 rounded slip with a brighter top edge.
 * Out of focus it is a disc of warm light.
 *
 * The fragment shader draws a signed-distance rounded box (a disc is a box with
 * full radius) and picks the night or day colour per pixel from the line.
 */

export const GRID = 48;
/** Homes are spread a little past the viewport so drift and dolly never show an edge. */
const SPREAD = 1.1;
/** The dolly the grid is fitted for (the field's push-in during the passes). */
export const PASS_DOLLY = 0.13;
/**
 * The ranked flight, shared with Act I (components/acts/read/ReadPanel.tsx):
 * speck i leaves STAGGER * i seconds after `ranked` entry, flies FLIGHT seconds and lands as the
 * full row rect. The DOM row i fades in from ROW_IN + STAGGER * i over LAND_FADE seconds, and the
 * speck's gold border fades into the row's glass border over the same window.
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
  /** Instance index of the brightest of the twelve (rank 1): where the hero lens parks. */
  first: number;
  /** home.x, home.y (−0.5..0.5), depth z, seed */
  a: Float32Array;
  /**
   * grid.x, grid.y (px), kind (0 dropped in pass 1, 1 dropped in pass 2, 2 kept), slot.
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

/** Give every kept speck its own node of the strict 48px grid, nearest to where it drifts. */
export function fitGrid(data: FieldData, w: number, canvasH: number, stageH = canvasH) {
  const { count, a, b } = data;
  // The canvas is as tall as the largest viewport; the story happens in the stage (100svh).
  const h = stageH;
  const ox = ((w % GRID) + GRID) / 2;
  const oy = ((h % GRID) + GRID) / 2;
  const nx = Math.max(1, Math.floor((w - ox * 2) / GRID) + 1);
  const ny = Math.max(1, Math.floor((h - oy * 2) / GRID) + 1);
  const j0 = Math.max(0, Math.ceil((h * 0.17 - oy) / GRID));
  const j1 = Math.min(ny - 1, Math.floor((h * 0.87 - oy) / GRID));
  const taken = new Uint8Array(nx * ny);
  for (let i = 0; i < count; i++) {
    if (b[i * 4 + 2] < 1) continue;
    const persp = 0.5 + a[i * 4 + 2];
    const px = w / 2 + a[i * 4] * w * SPREAD * (1 + PASS_DOLLY * persp);
    const py = canvasH / 2 + a[i * 4 + 1] * canvasH * SPREAD * (1 + PASS_DOLLY * persp);
    let best = -1;
    let bestD = Infinity;
    for (let j = j0; j <= j1; j++) {
      for (let k = 0; k < nx; k++) {
        if (taken[j * nx + k]) continue;
        const dx = ox + k * GRID - px;
        const dy = oy + j * GRID - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = j * nx + k;
        }
      }
    }
    if (best < 0) {
      b[i * 4] = Math.round(px / GRID) * GRID;
      b[i * 4 + 1] = Math.round(py / GRID) * GRID;
      continue;
    }
    taken[best] = 1;
    b[i * 4] = ox + (best % nx) * GRID;
    b[i * 4 + 1] = oy + Math.floor(best / nx) * GRID;
  }
}

const vert = /* glsl */ `
  attribute vec4 aA;
  attribute vec4 aB;

  uniform vec2 uRes;
  uniform float uTime;
  uniform float uT1;
  uniform float uT1Min;
  uniform float uT2;
  uniform vec4 uHist1;
  uniform vec4 uHist2;
  uniform float uBand;
  uniform float uDolly;
  uniform float uBright;
  uniform float uIntro;
  uniform float uAnt;
  uniform float uGatherT;
  uniform vec4 uRows[12];
  uniform float uRowR;
  uniform float uRelease;
  uniform vec3 uLens;
  uniform vec3 uLamp;
  uniform vec2 uLampR;
  uniform float uPulse;
  uniform float uFocus;
  uniform vec4 uRings[${SEATS}];
  uniform float uSeatC;
  uniform float uSeatLine;
  uniform float uBeadY;
  uniform vec2 uClaim; // seat number (0 none), fill 0..1

  varying vec2 vP;
  varying vec2 vBox;
  varying float vRad;
  varying float vSoft;
  varying vec4 vCol;
  varying vec4 vDay;
  varying vec4 vFx;   // halo, border, top edge, halo reach
  varying vec3 vEdge; // border colour

  const float PI = 3.14159265;
  const vec3 WARM = vec3(1.0, 0.94, 0.82);
  const vec3 COOL = vec3(0.80, 0.89, 1.0);
  const vec3 GOLD = vec3(1.0, 0.843, 0.478);
  const vec3 EMBER = vec3(1.0, 0.74, 0.38);
  const vec3 LAMP = vec3(1.0, 0.80, 0.56);
  const vec3 INK = vec3(0.106, 0.098, 0.086);
  const vec3 AMBER = vec3(0.706, 0.325, 0.035);
  const vec3 SEAT = vec3(0.96, 0.66, 0.16);

  float backOut(float x) {
    float s = 1.4;
    float y = x - 1.0;
    return 1.0 + (s + 1.0) * y * y * y + s * y * y;
  }
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
  // How recently the line passed y: 1 just now, 0 from about 0.4s ago. dir +1 reads downward.
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
    ) * (5.0 + 20.0 * z);
    vec2 P0 = c + aA.xy * uRes * ${SPREAD.toFixed(2)} * (1.0 + uDolly * persp) + drift;

    // Depth of field: the focal plane sits mid-field. Near specks are soft warm light, far ones small.
    float near = clamp((z - 0.7) / 0.3, 0.0, 1.0);
    float far = clamp((0.3 - z) / 0.3, 0.0, 1.0);
    float blur = near * near * 4.0 + far * far * 1.0;
    float r0 = mix(0.75, 2.0, z) + h4 * 0.35;
    float a0 = mix(0.34, 1.0, smoothstep(0.0, 0.7, z)) * (0.88 + 0.12 * sin(uTime * (0.6 + h2) + h1 * 40.0));

    vec2 P = P0;
    float radius = r0;
    float alpha = a0;
    vec3 col = mix(mix(WARM, COOL, step(0.8, h3) * 0.75), EMBER, near * 0.6);
    vec3 dayCol = INK;
    vec3 edgeCol = GOLD;
    float halo = 0.0;
    float reach = 28.0;
    float border = 0.0;
    vec2 box = vec2(0.0);
    float rad = 0.0;
    float shape = 0.0;
    float gone = 0.0;
    float slip = 1.0;   // 1 = a listing slip, 0 = a disc
    float seatK = 0.0;
    float dayA = (0.035 + 0.055 * z) * (1.0 - near);

    // Pass 1: read the moment the line's y passes the speck's own y.
    float inBand = clamp((P0.y - uT1Min) / 16.0, 0.0, 1.0);
    float r1 = clamp((uT1 - P0.y) / uBand, 0.0, 1.0) * inBand;
    float e1 = r1 * r1 * (3.0 - 2.0 * r1);
    float flare = sin(PI * clamp(r1 * 2.2, 0.0, 1.0));
    float glow = afterglow(P0.y, uT1, uHist1, 1.0) * inBand;
    float dustA = 0.10 + 0.16 * z;

    if (kind < 0.5) {
      // Dropped: it holds its light for a moment (the afterglow), then dims and sinks.
      float dim = e1 * (1.0 - glow * 0.85);
      P = mix(P0, c + (P0 - c) * 0.955 + vec2(0.0, 7.0), e1);
      radius = r0 * mix(1.0, 0.6, dim) + flare * 0.5 + glow * 0.5;
      alpha = mix(alpha, dustA, dim) + (flare * 0.35 + glow * 0.3) * (1.0 - e1 * 0.5);
      col = mix(col, EMBER, max(glow, flare * 0.5));
      slip = 1.0 - dim;
    } else {
      float r2 = clamp((G.y - uT2) / uBand, 0.0, 1.0) * r1;
      float e2 = r2 * r2 * (3.0 - 2.0 * r2);
      float glow2 = afterglow(G.y, uT2, uHist2, -1.0) * step(0.5, r1);
      float held = kind < 1.5 ? 1.0 - uRelease : 1.0;
      P = mix(P0, G, backOut(r1) * held);
      blur *= 1.0 - e1 * held;
      radius = mix(r0, 1.9, e1) + flare * 0.9 + glow * 0.5;
      alpha = mix(alpha, 1.0, e1);
      col = mix(mix(col, WARM, e1), GOLD, glow * 0.7);
      halo = glow * 0.35;
      reach = 14.0;
      if (kind < 1.5) {
        float flare2 = sin(PI * clamp(r2 * 2.2, 0.0, 1.0));
        float dim2 = e2 * (1.0 - glow2 * 0.85);
        radius = radius * mix(1.0, 0.62, dim2) + flare2 * 0.5;
        alpha = mix(alpha, 0.2, dim2);
        col = mix(col, EMBER, glow2);
        alpha = mix(alpha, dustA, uRelease);
        radius = mix(radius, r0 * 0.6, uRelease);
        slip = (1.0 - dim2 * 0.6) * (1.0 - uRelease);

        // Dawn: 25 survivors are collected by the line, ride it up as it brings the day,
        // and are left behind in the seat rings as it passes them.
        if (slot > 0.5 && uSeatC > 0.0) {
          vec4 ring = uRings[int(slot - 0.5)];
          seatK = uSeatC * uSeatC * (3.0 - 2.0 * uSeatC) * step(0.5, ring.z);
          float span = uRes.y * 0.22;
          float g = clamp((ring.y + span - uSeatLine) / (span + 24.0), 0.0, 1.0);
          float tr = travelEase(g);
          vec2 S = vec2(mix(P.x, ring.x, tr), max(uBeadY, ring.y));
          float fill = step(abs(slot - uClaim.x), 0.5) * uClaim.y;
          float pin = mix(2.6, max(2.0, ring.z * 0.36), tr);
          P = mix(P, S, seatK);
          radius = mix(radius, mix(pin, ring.z - 0.5, backOut(fill)), seatK);
          alpha = mix(alpha, 1.0, seatK);
          col = mix(col, GOLD, seatK);
          dayCol = mix(dayCol, mix(AMBER, SEAT, fill), seatK);
          dayA = mix(dayA, 0.92, seatK);
          halo = max(halo, seatK * (0.45 + 0.5 * sin(PI * fill) + 0.35 * fill));
          reach = mix(reach, 18.0 + 10.0 * fill, seatK);
          blur *= 1.0 - seatK;
          slip *= 1.0 - seatK;
        }
      } else {
        float pop = backOut(r2);
        col = mix(col, GOLD, e2);
        radius = radius * mix(1.0, 1.8, pop) * (1.0 + 0.55 * uPulse);
        halo = max(halo, e2 * (0.55 + 0.6 * uPulse));
        reach = 28.0;
        dayA = 0.0;

        // Ranked: fly an arc to the live row rect and stretch from a slip into the full row.
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
        // Landed: the gold glass turns into the row's own glass as the DOM row fades in over it.
        float landed = clamp((t0 - ${ROW_IN.toFixed(2)}) / ${LAND_FADE.toFixed(2)}, 0.0, 1.0);
        border = shape;
        edgeCol = mix(GOLD, vec3(1.0), landed);
        alpha = mix(1.0, 0.34, shape);
        halo *= 1.0 - shape;
        gone = mix(landed, clamp(uGatherT / 0.3, 0.0, 1.0), 1.0 - has);
      }
    }

    // The lamp catches dust (Act III).
    vec2 lv = (P - uLamp.xy) / uLampR;
    float lampK = uLamp.z * exp(-pow(length(lv), 1.5) * 2.2);
    float dusty = step(shape, 0.0) * step(kind, 1.5) * (1.0 - seatK);
    alpha *= 1.0 + 5.0 * lampK * dusty;
    col = mix(col, LAMP, clamp(lampK * 1.6, 0.0, 1.0) * dusty);

    // The reading lens: magnify, sharpen, and let the twelve glint.
    vec2 dl = P - uLens.xy;
    float lk = uLens.z * (1.0 - smoothstep(${(LENS_RADIUS * 0.55).toFixed(1)}, ${LENS_RADIUS.toFixed(1)}, length(dl))) * (1.0 - shape);
    float focus = step(abs(float(gl_InstanceID) - uFocus), 0.5) * uLens.z;
    P += dl * 0.16 * lk;
    radius *= 1.0 + 1.2 * lk + 0.5 * focus;
    blur *= 1.0 - lk;
    alpha = mix(alpha, max(alpha, 0.72 + 0.26 * z), lk);
    alpha = mix(alpha, 1.0, focus);
    slip = max(slip, lk * (1.0 - seatK));
    if (kind > 1.5) {
      col = mix(col, GOLD, lk);
      if (lk * 0.5 > halo) {
        halo = lk * 0.5;
        reach = 22.0;
      }
    }

    // Load: the field arrives from the centre outward.
    float order = length(aA.xy) * 1.5;
    alpha *= smoothstep(order, order + 0.3, uIntro * 1.85);
    alpha *= (1.0 - gone) * mix(uBright, 1.0, max(step(1.5, kind), seatK));

    // In focus a speck is a listing slip; out of focus it is a disc whose light thins as it spreads.
    float disc = radius + blur * 0.6;
    float thin = (radius * radius) / (disc * disc);
    slip *= 1.0 - clamp(blur / 1.2, 0.0, 1.0);
    if (shape <= 0.0) {
      alpha *= mix(max(thin, 0.24), 0.86, slip);
      vec2 slipBox = vec2(radius * 1.75 + 0.3, radius);
      box = mix(vec2(disc), slipBox, slip);
      rad = min(mix(disc, 1.25, slip), box.y);
    } else {
      vec4 row = uRows[int(slot + 0.5)];
      vec2 from = vec2(radius * 1.75 + 0.3, radius);
      box = mix(from, row.zw * 0.5, shape);
      rad = min(mix(1.25, uRowR, shape), min(box.x, box.y));
      slip = 0.0;
    }
    float soft = max(0.75, blur * 0.9) * (1.0 - shape) + 0.75 * shape;
    dayA *= 1.0 - gone;

    float pad = soft + 1.5 + step(0.001, halo) * reach;
    vec2 hs = box + pad;
    vP = position.xy * hs;
    vBox = box;
    vRad = rad;
    vSoft = soft;
    vCol = vec4(col, alpha);
    vDay = vec4(dayCol, dayA);
    vFx = vec4(halo, border * (1.0 - gone), slip, reach);
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

  varying vec2 vP;
  varying vec2 vBox;
  varying float vRad;
  varying float vSoft;
  varying vec4 vCol;
  varying vec4 vDay;
  varying vec4 vFx;
  varying vec3 vEdge;

  void main() {
    vec2 q = abs(vP) - (vBox - vRad);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - vRad;
    float fill = 1.0 - smoothstep(-vSoft, vSoft, d);
    // The halo is windowed to reach exactly zero inside the quad's padding: no square can show.
    float dh = max(d, 0.0);
    float window = 1.0 - smoothstep(vFx.w * 0.45, vFx.w * 0.92, dh);
    float halo = vFx.x * (exp(-dh / 4.0) * 0.36 + exp(-dh / 11.0) * 0.16) * window;
    float edge = vFx.y * (1.0 - smoothstep(0.35, 1.25, abs(d + 0.9)));
    // A slip's top edge catches the light; its body sits back.
    float top = 1.0 - smoothstep(0.5, 1.5, vP.y + vBox.y);
    float body = mix(1.0, 0.56 + 0.44 * top, vFx.z);

    float y = uRes.y - gl_FragCoord.y / uDpr;
    float day = step(uDayTop, y);
    float aBody = mix(vCol.a, vDay.a, day) * fill * body;
    float aHalo = halo * (1.0 - fill) * mix(1.0, 0.55, day);
    float aEdge = edge * 0.72 * (1.0 - day);
    float a = clamp(aBody + aHalo + aEdge, 0.0, 1.0);
    if (a < 0.002) discard;
    vec3 base = mix(vCol.rgb, vDay.rgb, day);
    vec3 col = (base * (aBody + aHalo) + vEdge * aEdge) / max(aBody + aHalo + aEdge, 0.0001);
    gl_FragColor = vec4(col * a, a);
  }
`;

export type FieldUniforms = {
  uRes: { value: THREE_NS.Vector2 };
  uDpr: { value: number };
  uTime: { value: number };
  uDayTop: { value: number };
  uT1: { value: number };
  uT1Min: { value: number };
  uHist1: { value: THREE_NS.Vector4 };
  uHist2: { value: THREE_NS.Vector4 };
  uT2: { value: number };
  uBand: { value: number };
  uDolly: { value: number };
  uBright: { value: number };
  uIntro: { value: number };
  uAnt: { value: number };
  uGatherT: { value: number };
  uRows: { value: THREE_NS.Vector4[] };
  uRowR: { value: number };
  uRelease: { value: number };
  uLens: { value: THREE_NS.Vector3 };
  uLamp: { value: THREE_NS.Vector3 };
  uLampR: { value: THREE_NS.Vector2 };
  uPulse: { value: number };
  uFocus: { value: number };
  uRings: { value: THREE_NS.Vector4[] };
  uSeatC: { value: number };
  uSeatLine: { value: number };
  uBeadY: { value: number };
  uClaim: { value: THREE_NS.Vector2 };
};

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

  const uniforms: FieldUniforms = {
    uRes: { value: new THREE.Vector2(width, height) },
    uDpr: { value: 1 },
    uTime: { value: 0 },
    uDayTop: { value: BIG },
    uT1: { value: -BIG },
    uT1Min: { value: -BIG },
    uHist1: { value: new THREE.Vector4(-BIG, -BIG, -BIG, -BIG) },
    uHist2: { value: new THREE.Vector4(BIG, BIG, BIG, BIG) },
    uT2: { value: BIG },
    uBand: { value: 80 },
    uDolly: { value: 0 },
    uBright: { value: 0.82 },
    uIntro: { value: 0 },
    uAnt: { value: 0 },
    uGatherT: { value: 0 },
    uRows: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uRowR: { value: 12 },
    uRelease: { value: 0 },
    uLens: { value: new THREE.Vector3(0, 0, 0) },
    uLamp: { value: new THREE.Vector3(0, 0, 0) },
    uLampR: { value: new THREE.Vector2(500, 500) },
    uPulse: { value: 0 },
    uFocus: { value: -1 },
    uRings: { value: Array.from({ length: SEATS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uSeatC: { value: 0 },
    uSeatLine: { value: BIG },
    uBeadY: { value: BIG },
    uClaim: { value: new THREE.Vector2(0, 0) },
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
  mesh.renderOrder = 1;

  const resize = (w: number, h: number) => {
    uniforms.uRes.value.set(w, h);
    const stage = document.querySelector<HTMLElement>(".story-stage");
    fitGrid(data, w, h, Math.min(h, (stage && stage.offsetHeight) || h));
    attrB.needsUpdate = true;
  };
  resize(width, height);

  return { mesh, uniforms, resize, dispose: () => base.dispose() };
}

/* ───────────────────────────── CPU mirror, for the lens label only ── */

export type Verdict = "unread" | "dropped1" | "kept" | "dropped2";
const hit = { index: -1, verdict: "unread" as Verdict, kind: 0, rank: 0, seed: 0, x: 0, y: 0 };

/**
 * The speck nearest to (x, y), with the state the shader shows it in. Mirrors
 * the vertex shader's position maths (drift, dolly, read, snap); the lens
 * magnification and the flight are left out, which the label never needs.
 */
export function nearestSpeck(data: FieldData, u: FieldUniforms, x: number, y: number, stick: number): typeof hit | null {
  const { count, a, b } = data;
  const w = u.uRes.value.x;
  const h = u.uRes.value.y;
  const t = u.uTime.value;
  const band = u.uBand.value;
  const release = u.uRelease.value;
  let best = -1;
  let bestD = LENS_RADIUS * LENS_RADIUS;
  let bx = 0;
  let by = 0;
  let br1 = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const z = a[o + 2];
    const hx = w / 2 + a[o] * w * SPREAD * (1 + u.uDolly.value * (0.5 + z));
    const hy = h / 2 + a[o + 1] * h * SPREAD * (1 + u.uDolly.value * (0.5 + z));
    // Cheap reject before the trigonometry (drift is under 40px).
    if (Math.abs(hx - x) > LENS_RADIUS + 90 && b[o + 2] < 1) continue;
    const sd = a[o + 3];
    const h1 = (sd * 17.13) % 1;
    const h2 = (sd * 91.7) % 1;
    const h3 = (sd * 263.1) % 1;
    const h4 = (sd * 571.3) % 1;
    const amp = 5 + 20 * z;
    const px0 = hx + (Math.sin(t * (0.1 + 0.16 * h1) + h2 * 6.283) + 0.5 * Math.sin(t * (0.23 + 0.1 * h3) + h4 * 6.283)) * amp;
    const py0 = hy + (Math.cos(t * (0.09 + 0.15 * h3) + h1 * 6.283) + 0.5 * Math.cos(t * (0.19 + 0.12 * h2) + h4 * 6.283)) * amp;
    const r1 = Math.min(1, Math.max(0, (u.uT1.value - py0) / band)) * Math.min(1, Math.max(0, (py0 - u.uT1Min.value) / 16));
    const e1 = r1 * r1 * (3 - 2 * r1);
    let px = px0;
    let py = py0;
    if (b[o + 2] < 0.5) {
      px = px0 + (w / 2 + (px0 - w / 2) * 0.955 - px0) * e1;
      py = py0 + (h / 2 + (py0 - h / 2) * 0.955 + 7 - py0) * e1;
    } else {
      const yy = r1 - 1;
      const k = (1 + 2.4 * yy * yy * yy + 1.4 * yy * yy) * (b[o + 2] < 1.5 ? 1 - release : 1);
      px = px0 + (b[o] - px0) * k;
      py = py0 + (b[o + 1] - py0) * k;
    }
    let d = (px - x) * (px - x) + (py - y) * (py - y);
    if (i === stick) d -= 500; // hysteresis: the label does not flicker between neighbours
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
  const kind = b[o + 2];
  const r2 = kind >= 1 ? Math.min(1, Math.max(0, (b[o + 1] - u.uT2.value) / band)) * br1 : 0;
  hit.index = best;
  hit.kind = kind;
  hit.rank = b[o + 3];
  hit.seed = a[o + 3];
  hit.x = bx;
  hit.y = by;
  hit.verdict = br1 < 0.5 ? "unread" : kind < 0.5 ? "dropped1" : kind < 1.5 && r2 >= 0.5 ? "dropped2" : "kept";
  return hit;
}
