/**
 * FLOWER SHAPE — the load-time analysis of one Tripo flower mesh (components/garden/tripoFlower.ts).
 *
 * Pure maths on plain arrays, no three.js, so it runs in the browser at load (and in a node check).
 *
 *   normaliseFlower   the model faces +X and is centred on its bounding box: turn it to face +Z and
 *                     pin the stem base to the origin (y 0..1).
 *   analyseFlower     which vertices are petal (texture colour at each UV: stem/leaf green = 0, any
 *                     petal colour = 1), which flower head each belongs to (grid flood fill), and each
 *                     vertex's `heart`, the centre its petals fold toward.
 */

export type Head = {
  /** Centroid of the head's petal vertices, flower space. */
  center: [number, number, number];
  /** Petal vertices in it. */
  count: number;
  /** Farthest petal vertex from the centre. */
  radius: number;
};

export type FlowerShape = {
  /** Per vertex, 0 stem/leaf .. 1 petal. */
  petal: Float32Array;
  /** Per vertex (xyz), the centre of its head. */
  heart: Float32Array;
  heads: Head[];
  /** Per vertex, its head (index into `heads`), or -1 when there is none. */
  headOf: Int32Array;
  /** Index into `heads` of the main head (the biggest, favouring the higher one). */
  main: number;
};

/** Reads the base colour at a UV (0..1, v down the image as glTF has it) as sRGB 0..1. */
export type ColorSampler = (u: number, v: number, out: [number, number, number]) => void;

/**
 * Turns +X to +Z (−90° about Y) and moves the stem base to the origin, in place. The base is the x/z
 * centroid of the vertices within `band` of the lowest point, y from 0 up.
 */
export function normaliseFlower(position: Float32Array, band = 0.03): void {
  const n = position.length / 3;
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    const x = position[i * 3];
    const z = position[i * 3 + 2];
    position[i * 3] = -z;
    position[i * 3 + 2] = x;
    minY = Math.min(minY, position[i * 3 + 1]);
  }
  let sx = 0;
  let sz = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (position[i * 3 + 1] > minY + band) continue;
    sx += position[i * 3];
    sz += position[i * 3 + 2];
    c++;
  }
  const bx = c ? sx / c : 0;
  const bz = c ? sz / c : 0;
  for (let i = 0; i < n; i++) {
    position[i * 3] -= bx;
    position[i * 3 + 1] -= minY;
    position[i * 3 + 2] -= bz;
  }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much a colour reads as stem/leaf green (0..1). Petals: whites, blues, corals, violets, the dark poppy centre. */
export function greenness(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (max <= 0 || d <= 1e-5) return 0;
  const s = d / max;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  const v = smooth(0.06, 0.13, max);
  // the greens proper (stems, leaves, sepals; some read teal) ...
  const green = smooth(54, 62, h) * (1 - smooth(190, 205, h)) * smooth(0.07, 0.14, s);
  // ... and yellow-greens, which only count when saturated: moonflower cream sits at the same hue, paler
  const olive = smooth(40, 48, h) * (1 - smooth(54, 62, h)) * smooth(0.28, 0.38, s);
  return Math.max(green, olive) * v;
}

type Options = {
  /** Grid cell for the flood fill, in flower units. */
  cell?: number;
  /** Smoothing passes over the index adjacency. */
  passes?: number;
  /** A head with fewer petal vertices than this share of all petal vertices is merged into the nearest bigger one. */
  minShare?: number;
  /** Which grid neighbours connect: 1 faces, 2 faces and edges, 3 all 26. */
  reach?: number;
  /** An island farther than this from every head (in flower units) is not petal. */
  maxGap?: number;
  /** A connected petal-coloured patch with fewer (welded) vertices than this, or 1% of all, is a speck, not petal. */
  minPatch?: number;
};

export function analyseFlower(position: Float32Array, uv: Float32Array, index: ArrayLike<number>, sample: ColorSampler, opts: Options = {}): FlowerShape {
  const { cell = 0.035, passes = 2, minShare = 0.04, reach = 3, maxGap = 0.07, minPatch = 40 } = opts;
  const n = position.length / 3;

  /* ── petal weight from the texture ── */
  let petal = new Float32Array(n);
  const rgb: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    sample(uv[i * 2], uv[i * 2 + 1], rgb);
    petal[i] = 1 - greenness(rgb[0], rgb[1], rgb[2]);
  }

  /* ── smooth over the mesh (CSR adjacency from the triangles) ── */
  const deg = new Uint32Array(n + 1);
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t];
    const b = index[t + 1];
    const c = index[t + 2];
    deg[a] += 2;
    deg[b] += 2;
    deg[c] += 2;
  }
  const start = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, n);
  const adj = new Uint32Array(start[n]);
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t];
    const b = index[t + 1];
    const c = index[t + 2];
    adj[fill[a]++] = b;
    adj[fill[a]++] = c;
    adj[fill[b]++] = a;
    adj[fill[b]++] = c;
    adj[fill[c]++] = a;
    adj[fill[c]++] = b;
  }
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = start[i];
      const e = start[i + 1];
      if (e === s) {
        next[i] = petal[i];
        continue;
      }
      let sum = 0;
      for (let k = s; k < e; k++) sum += petal[adj[k]];
      next[i] = 0.5 * petal[i] + (0.5 * sum) / (e - s);
    }
    petal = next;
  }

  /* ── specks: petal-coloured patches too small to be a petal (a pale fleck on a leaf) are stem ── */
  // weld the UV-seam duplicates so connectivity follows the real surface
  const weld = new Int32Array(n);
  {
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const k = `${position[i * 3].toFixed(5)},${position[i * 3 + 1].toFixed(5)},${position[i * 3 + 2].toFixed(5)}`;
      const w = seen.get(k);
      if (w === undefined) seen.set(k, (weld[i] = i));
      else weld[i] = w;
    }
  }
  const pw = new Float32Array(n); // per welded vertex: the highest weight among its duplicates
  for (let i = 0; i < n; i++) pw[weld[i]] = Math.max(pw[weld[i]], petal[i]);
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x: number) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (let t = 0; t + 2 < index.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = weld[index[t + e]];
      const b = weld[index[t + ((e + 1) % 3)]];
      if (pw[a] >= 0.5 && pw[b] >= 0.5) parent[find(a)] = find(b);
    }
  const size = new Map<number, number>();
  let petalCount = 0;
  for (let i = 0; i < n; i++)
    if (weld[i] === i && pw[i] >= 0.5) {
      petalCount++;
      const r = find(i);
      size.set(r, (size.get(r) ?? 0) + 1);
    }
  const minSpeck = Math.max(minPatch, petalCount * 0.01);
  const kept = new Uint8Array(n); // per welded vertex: part of a real petal patch
  for (let i = 0; i < n; i++) if (weld[i] === i && pw[i] >= 0.5 && (size.get(find(i)) ?? 0) >= minSpeck) kept[i] = 1;
  // a vertex below 0.5 keeps its (blended) weight only on the rim of a real patch
  const rim = new Uint8Array(n);
  for (let t = 0; t + 2 < index.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = weld[index[t + e]];
      const b = weld[index[t + ((e + 1) % 3)]];
      if (kept[a]) rim[b] = 1;
      if (kept[b]) rim[a] = 1;
    }
  for (let i = 0; i < n; i++) {
    const w = weld[i];
    if (petal[i] >= 0.5 ? !kept[w] : !rim[w]) petal[i] = 0;
  }

  /* ── flood fill the petal vertices on a grid into heads ── */
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const cellOf = new Array<string | null>(n).fill(null);
  const cells = new Map<string, { x: number; y: number; z: number; verts: number[]; comp: number }>();
  for (let i = 0; i < n; i++) {
    if (petal[i] < 0.5) continue;
    const x = Math.floor(position[i * 3] / cell);
    const y = Math.floor(position[i * 3 + 1] / cell);
    const z = Math.floor(position[i * 3 + 2] / cell);
    const k = key(x, y, z);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { x, y, z, verts: [], comp: -1 }));
    c.verts.push(i);
    cellOf[i] = k;
  }
  type Comp = { verts: number[]; cx: number; cy: number; cz: number };
  const comps: Comp[] = [];
  for (const c0 of cells.values()) {
    if (c0.comp >= 0) continue;
    const id = comps.length;
    const comp: Comp = { verts: [], cx: 0, cy: 0, cz: 0 };
    comps.push(comp);
    c0.comp = id;
    const stack = [c0];
    while (stack.length) {
      const c = stack.pop()!;
      for (const v of c.verts) comp.verts.push(v);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > reach) continue;
            const nb = cells.get(key(c.x + dx, c.y + dy, c.z + dz));
            if (nb && nb.comp < 0) {
              nb.comp = id;
              stack.push(nb);
            }
          }
    }
  }
  const centroid = (c: Comp) => {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const v of c.verts) {
      x += position[v * 3];
      y += position[v * 3 + 1];
      z += position[v * 3 + 2];
    }
    const k = c.verts.length || 1;
    c.cx = x / k;
    c.cy = y / k;
    c.cz = z / k;
  };
  comps.forEach(centroid);

  /* tiny islands join the nearest big head */
  const total = comps.reduce((s, c) => s + c.verts.length, 0);
  const minCount = Math.max(12, total * minShare);
  const big = comps.filter((c) => c.verts.length >= minCount);
  if (!big.length && comps.length) big.push(comps.reduce((a, b) => (b.verts.length > a.verts.length ? b : a)));
  const owner = new Map<Comp, number>();
  big.forEach((c, i) => owner.set(c, i));
  const nearest = (x: number, y: number, z: number) => {
    let best = 0;
    let bd = Infinity;
    big.forEach((b, i) => {
      const d = (b.cx - x) ** 2 + (b.cy - y) ** 2 + (b.cz - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  /* an island near a head joins it; one far from every head (a pale speck down the stem) is stem after all */
  const cellsOf = new Map<number, { x: number; y: number; z: number }[]>();
  for (const c of cells.values()) {
    let list = cellsOf.get(c.comp);
    if (!list) cellsOf.set(c.comp, (list = []));
    list.push(c);
  }
  const gap = (a: number, b: number) => {
    let g = Infinity;
    for (const p of cellsOf.get(a) ?? []) for (const q of cellsOf.get(b) ?? []) g = Math.min(g, Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z)));
    return (g - 1) * cell;
  };
  const compId = new Map<Comp, number>();
  comps.forEach((c, i) => compId.set(c, i));
  const dropped = new Set<Comp>();
  const members: number[][] = big.map((b) => b.verts.slice());
  for (const c of comps) {
    if (owner.has(c)) continue;
    let to = -1;
    let best = Infinity;
    big.forEach((b, i) => {
      const g = gap(compId.get(c)!, compId.get(b)!);
      if (g < best) {
        best = g;
        to = i;
      }
    });
    if (to < 0 || best > maxGap) {
      dropped.add(c);
      for (const v of c.verts) {
        petal[v] = 0;
        cellOf[v] = null;
      }
      continue;
    }
    owner.set(c, to);
    for (const v of c.verts) members[to].push(v);
  }
  const heads: Head[] = members.map((verts) => {
    const c: Comp = { verts, cx: 0, cy: 0, cz: 0 };
    centroid(c);
    const d = verts.map((v) => Math.hypot(position[v * 3] - c.cx, position[v * 3 + 1] - c.cy, position[v * 3 + 2] - c.cz)).sort((a, b) => a - b);
    // robust size: stray specks on the stem that merely look petal-ish must not stretch it
    return { center: [c.cx, c.cy, c.cz], count: verts.length, radius: d.length ? d[Math.floor(0.97 * (d.length - 1))] : 0 };
  });

  /* ── each vertex's heart: its head's centre (the nearest head for the stem and leaves) ── */
  const heart = new Float32Array(n * 3);
  const headOf = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const k = cellOf[i];
    const h = k ? owner.get(comps[cells.get(k)!.comp])! : heads.length ? nearest(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]) : -1;
    headOf[i] = h;
    const c = h >= 0 ? heads[h].center : [position[i * 3], position[i * 3 + 1], position[i * 3 + 2]];
    heart[i * 3] = c[0];
    heart[i * 3 + 1] = c[1];
    heart[i * 3 + 2] = c[2];
  }

  /* and anything petal-ish left far out from its head's centre fades back to stem */
  for (let i = 0; i < n; i++) {
    if (petal[i] <= 0) continue;
    const h = heads[headOf[i]];
    if (!h) continue;
    const d = Math.hypot(position[i * 3] - heart[i * 3], position[i * 3 + 1] - heart[i * 3 + 1], position[i * 3 + 2] - heart[i * 3 + 2]);
    petal[i] *= 1 - smooth(1.6 * h.radius, 2.2 * h.radius, d);
  }

  let main = 0;
  heads.forEach((h, i) => {
    const score = (x: Head) => x.count * (0.6 + x.center[1]);
    if (score(h) > score(heads[main])) main = i;
  });
  return { petal, heart, heads, headOf, main };
}
