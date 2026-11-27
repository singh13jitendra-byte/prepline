/**
 * Simplex noise in 3D with its analytic gradient, and the curl of a three-component potential
 * built from it. Curl noise is divergence-free: paths that follow it swirl and never bunch up or
 * stall, which is what makes a wander read as flight. Plain arrays, no allocation per call.
 */

const F3 = 1 / 3;
const G3 = 1 / 6;
const GRAD = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
const perm = new Uint8Array(512);
const perm12 = new Uint8Array(512);

export function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle the permutation table. Called once with the scene's seed. */
export function seedNoise(seed: number) {
  const rand = mulberry(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const s = p[i];
    p[i] = p[j];
    p[j] = s;
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    perm12[i] = perm[i] % 12;
  }
}
seedNoise(2340);

let gx = 0;
let gy = 0;
let gz = 0;

function corner(gi: number, x: number, y: number, z: number): number {
  // Radius² 0.5: the kernel reaches zero with a zero gradient, so the field is smooth everywhere.
  const t = 0.5 - x * x - y * y - z * z;
  if (t <= 0) return 0;
  const g = gi * 3;
  const ax = GRAD[g];
  const ay = GRAD[g + 1];
  const az = GRAD[g + 2];
  const dot = ax * x + ay * y + az * z;
  const t2 = t * t;
  const t4 = t2 * t2;
  const k = -8 * t2 * t * dot;
  gx += t4 * ax + k * x;
  gy += t4 * ay + k * y;
  gz += t4 * az + k * z;
  return t4 * dot;
}

/** out[o] = value, out[o+1..o+3] = d/dx, d/dy, d/dz. Unnormalised (the wander scales by speed). */
export function snoise3(x: number, y: number, z: number, out: Float32Array, o = 0) {
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const z0 = z - (k - t);
  let i1 = 0;
  let j1 = 0;
  let k1 = 0;
  let i2 = 0;
  let j2 = 0;
  let k2 = 0;
  if (x0 >= y0) {
    if (y0 >= z0) (i1 = 1), (i2 = 1), (j2 = 1);
    else if (x0 >= z0) (i1 = 1), (i2 = 1), (k2 = 1);
    else (k1 = 1), (i2 = 1), (k2 = 1);
  } else if (y0 < z0) (k1 = 1), (j2 = 1), (k2 = 1);
  else if (x0 < z0) (j1 = 1), (j2 = 1), (k2 = 1);
  else (j1 = 1), (i2 = 1), (j2 = 1);
  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3;
  const y2 = y0 - j2 + 2 * G3;
  const z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 0.5;
  const y3 = y0 - 1 + 0.5;
  const z3 = z0 - 1 + 0.5;
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  gx = gy = gz = 0;
  const n =
    corner(perm12[ii + perm[jj + perm[kk]]], x0, y0, z0) +
    corner(perm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1) +
    corner(perm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2) +
    corner(perm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);
  out[o] = n;
  out[o + 1] = gx;
  out[o + 2] = gy;
  out[o + 3] = gz;
}

const A = new Float32Array(4);
const B = new Float32Array(4);
const C = new Float32Array(4);
/** Scale that brings the curl's root-mean-square length to about 1 (measured below, once). */
let curlScale = 1;

function rawCurl(x: number, y: number, z: number, out: Float32Array, o: number) {
  snoise3(x, y, z, A);
  snoise3(x + 31.416, y - 47.853, z + 12.679, B);
  snoise3(x - 233.145, y + 113.408, z - 71.23, C);
  out[o] = C[2] - B[3];
  out[o + 1] = A[3] - C[1];
  out[o + 2] = B[1] - A[2];
}

/** Curl of the potential at (x, y, z): a unit-ish, divergence-free direction. */
export function curl3(x: number, y: number, z: number, out: Float32Array, o = 0) {
  rawCurl(x, y, z, out, o);
  out[o] *= curlScale;
  out[o + 1] *= curlScale;
  out[o + 2] *= curlScale;
}

{
  const rand = mulberry(7);
  const v = new Float32Array(3);
  let sum = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    rawCurl(rand() * 40, rand() * 40, rand() * 40, v, 0);
    sum += v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  }
  curlScale = 1 / Math.sqrt(sum / N || 1);
}

/** A tiling fBm value-noise tile for the mist (R8, `size` square). Built once on the CPU. */
export function mistTile(size: number, seed: number): Uint8Array {
  const rand = mulberry(seed);
  const lattice = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const octaves = [4, 8, 16, 32].map((n) => ({ n, g: lattice(n) }));
  const out = new Uint8Array(size * size);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      for (const { n, g } of octaves) {
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = sm(fx - x0);
        const ty = sm(fy - y0);
        const a = g[(y0 % n) * n + (x0 % n)];
        const b = g[(y0 % n) * n + ((x0 + 1) % n)];
        const c = g[((y0 + 1) % n) * n + (x0 % n)];
        const d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        v += amp * (a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty);
        amp *= 0.5;
      }
      out[y * size + x] = Math.max(0, Math.min(255, Math.round((v / 0.9375) * 255)));
    }
  }
  return out;
}
