/**
 * THE TRIPO FLOWERS — the garden's job flowers (CLAUDE.md, "The garden"), the GardenFlower rig of
 * components/garden/flowers.ts built from the bud/bloom pairs in public/garden.
 *
 * Each pair is two different static meshes, so "opening" is a crossing between them, driven by one
 * `open` value 0..1:
 *
 *   0          the bud, as modelled
 *   0.25–0.45  the swap: a dithered, per-pixel handover (no transparency, nothing sorted); the bud's
 *              petals close in toward their heads, the bloom's grow out from theirs
 *   0.5        half open (fit 6–7 rests here): only the bloom, its heads at about 0.69 of full size
 *   1          the full bloom, as modelled
 *
 * At load, in the browser (no preprocessing step), each mesh is turned to face +Z, its stem base pinned
 * to the origin, and analysed (components/garden/flowerShape.ts): a per-vertex `petal` weight from the
 * base-colour texture (stem green 0, petal 1) and `heart`, the centre of the flower head it belongs to.
 * One material patch on the GLTF's MeshStandardMaterial scales petal vertices toward their heart, does
 * the dither, a faint lamp glow at each heart (brighter with setLit) and Lumi's light on nearby petals.
 *
 * The rig is loop-free: the caller's frame loop calls `update(t, dt)` (sway, Lumi's light). Lit by the
 * scene's lights (MeshStandardMaterial). Colours are theme tokens (readWorld), never literals.
 */

import type * as THREE_NS from "three";
import { readWorld } from "@/lib/theme";
import { FLOWER_KINDS, flowerFiles, type FlowerKind, type GardenFlower } from "./flowers";
import { analyseFlower, normaliseFlower, type FlowerShape } from "./flowerShape";

type Three = typeof THREE_NS;
type V3 = readonly [number, number, number];

/** sRGB 0..1 colours (theme tokens). petal: the flower's own token; lamp, heart: the lamp's edge and heart. */
export type FlowerPalette = { petal: V3; lamp: V3; heart: V3 };

const PETAL_TOKEN = { moon: "flowerMoon", bell: "flowerBell", poppy: "flowerPoppy", allium: "flowerAllium", lavender: "flowerLavender" } as const;

/** The flower's colours from the live theme. */
export function flowerColors(kind: FlowerKind): FlowerPalette {
  const { colors } = readWorld();
  return { petal: colors[PETAL_TOKEN[kind]], lamp: colors.lampDeep, heart: colors.lampHeart };
}

/* ── loading: each GLB fetched, baked and analysed once, then shared by every flower ── */

type Part = {
  geometry: THREE_NS.BufferGeometry;
  /** The GLTF's material (with its base-colour map). Flowers clone it; the map stays shared. */
  material: THREE_NS.MeshStandardMaterial;
  shape: FlowerShape;
  /** Main head centre, flower space. */
  heart: THREE_NS.Vector3;
  positions: Float32Array;
};

type Loader = { loadAsync: (url: string) => Promise<{ scene: THREE_NS.Group }> };
let loaderP: Promise<Loader> | null = null;
const parts = new Map<string, Promise<Part>>();

function loader(): Promise<Loader> {
  loaderP ??= Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/libs/meshopt_decoder.module.js")]).then(
    ([{ GLTFLoader }, { MeshoptDecoder }]) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder) as unknown as Loader,
  );
  return loaderP;
}

const SAMPLE = 256;

/** Reads a texture's image into a small canvas and returns a nearest-pixel sampler on it. */
function sampler(THREE: Three, map: THREE_NS.Texture | null) {
  const img = map?.image as CanvasImageSource | undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let data: Uint8ClampedArray | null = null;
  if (ctx && img) {
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  }
  if (map?.matrixAutoUpdate) map.updateMatrix();
  const m = map?.matrix ?? new THREE.Matrix3();
  const t = new THREE.Vector3();
  return (u: number, v: number, out: [number, number, number]) => {
    if (!data) {
      out[0] = out[1] = out[2] = 1; // no texture: all petal
      return;
    }
    t.set(u, v, 1).applyMatrix3(m);
    const x = Math.min(SAMPLE - 1, Math.max(0, Math.floor((t.x - Math.floor(t.x)) * SAMPLE)));
    const y = Math.min(SAMPLE - 1, Math.max(0, Math.floor((t.y - Math.floor(t.y)) * SAMPLE)));
    const o = (y * SAMPLE + x) * 4;
    out[0] = data[o] / 255;
    out[1] = data[o + 1] / 255;
    out[2] = data[o + 2] / 255;
  };
}

async function loadPart(THREE: Three, url: string): Promise<Part> {
  const gltf = await (await loader()).loadAsync(url);
  let mesh: THREE_NS.Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!mesh && (o as THREE_NS.Mesh).isMesh) mesh = o as THREE_NS.Mesh;
  });
  if (!mesh) throw new Error(`garden: no mesh in ${url}`);
  const src = (mesh as THREE_NS.Mesh).geometry;
  const material = (mesh as THREE_NS.Mesh).material as THREE_NS.MeshStandardMaterial;
  gltf.scene.updateMatrixWorld(true);
  const world = (mesh as THREE_NS.Mesh).matrixWorld;
  const normalWorld = new THREE.Matrix3().getNormalMatrix(world);

  // bake the quantized attributes to Float32 with the node transform applied (getX denormalizes)
  const P = src.getAttribute("position");
  const N = src.getAttribute("normal");
  const U = src.getAttribute("uv");
  const n = P.count;
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(world);
    position[i * 3] = v.x;
    position[i * 3 + 1] = v.y;
    position[i * 3 + 2] = v.z;
    if (N) {
      v.fromBufferAttribute(N, i).applyMatrix3(normalWorld).normalize();
      // the same quarter turn as normaliseFlower: +X faces +Z
      normal[i * 3] = -v.z;
      normal[i * 3 + 1] = v.y;
      normal[i * 3 + 2] = v.x;
    }
    if (U) {
      uv[i * 2] = U.getX(i);
      uv[i * 2 + 1] = U.getY(i);
    }
  }
  normaliseFlower(position);
  const index = src.index ? (src.index.array.slice() as Uint16Array | Uint32Array) : Uint32Array.from({ length: n }, (_, i) => i);
  const shape = analyseFlower(position, uv, index, sampler(THREE, material.map));

  const heart4 = new Float32Array(n * 4);
  const radius = shape.heads.map((h) => h.radius);
  for (let i = 0; i < n; i++) {
    heart4[i * 4] = shape.heart[i * 3];
    heart4[i * 4 + 1] = shape.heart[i * 3 + 1];
    heart4[i * 4 + 2] = shape.heart[i * 3 + 2];
    const h = shape.headOf[i];
    heart4[i * 4 + 3] = h >= 0 ? Math.max(0.04, radius[h]) : 0.1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  if (N) geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  else geometry.computeVertexNormals();
  if (U) geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("aPetal", new THREE.BufferAttribute(shape.petal, 1));
  // xyz: the heart its petals fold toward; w: that head's radius (the glow's reach)
  geometry.setAttribute("aHeart", new THREE.BufferAttribute(heart4, 4));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  src.dispose();

  const main = shape.heads[shape.main];
  const heart = main ? new THREE.Vector3(...main.center) : new THREE.Vector3(0, 0.75, 0);
  return { geometry, material, shape, heart, positions: position };
}

function part(THREE: Three, url: string): Promise<Part> {
  let p = parts.get(url);
  if (!p) {
    p = loadPart(THREE, url);
    p.catch(() => parts.delete(url)); // let a later call retry
    parts.set(url, p);
  }
  return p;
}

/** Fetch and analyse all ten models once (cached); later createFlower calls resolve at once. */
export async function preloadFlowers(THREE: Three): Promise<void> {
  await Promise.all(FLOWER_KINDS.flatMap((k) => [part(THREE, flowerFiles(k).bud), part(THREE, flowerFiles(k).bloom)]));
}

/* ── the material patch ── */

const VERT_HEAD = /* glsl */ `
attribute float aPetal;
attribute vec4 aHeart;
uniform float uScale;
uniform vec3 uLantern;
uniform float uLanternK;
varying float vPetal;
varying float vHeartD;
varying float vLamp;
`;

const VERT_BODY = /* glsl */ `
#include <begin_vertex>
// petals fold toward (or grow out from) the centre of their flower head
transformed = mix(transformed, aHeart.xyz + (transformed - aHeart.xyz) * uScale, aPetal);
vPetal = aPetal;
vHeartD = length(transformed - aHeart.xyz) / max(1e-3, aHeart.w * uScale);
{
  // Lumi's light: a soft point light, flower space, gone by 0.6 units
  vec3 toL = uLantern - transformed;
  float d = length(toL);
  float fall = 1.0 - smoothstep(0.0, 0.6, d);
  float facing = 0.35 + 0.65 * abs(dot(normalize(objectNormal), toL / max(d, 1e-4)));
  vLamp = uLanternK * fall * fall * facing * mix(0.25, 1.0, aPetal);
}
`;

const FRAG_HEAD = /* glsl */ `
uniform float uW;
uniform float uSide;
uniform float uSeed;
uniform float uOpen;
uniform float uGlow;
uniform vec3 uGlowCol;
uniform vec3 uLampCol;
varying float vPetal;
varying float vHeartD;
varying float vLamp;
// interleaved gradient noise on the pixel grid: an even, fine stipple for the bud/bloom handover
float gardenDither(vec2 p) {
  p += vec2(uSeed, uSeed * 1.7);
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
`;

const FRAG_MAIN = /* glsl */ `
void main() {
  {
    // the bud draws where the hash is at or above the bloom's weight, the bloom where it is below:
    // complementary, so every pixel shows exactly one of them
    float gd = gardenDither(floor(gl_FragCoord.xy));
    if (uSide < 0.5 ? gd < uW : gd >= uW) discard;
  }
`;

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
{
  // a faint lamp glow at each heart, fading out across the head; brighter when lit
  float g = vPetal * (1.0 - smoothstep(0.0, 0.85, vHeartD));
  totalEmissiveRadiance += uGlowCol * g * g * uOpen * (0.06 + 0.3 * uGlow);
  // Lumi's light, caught by the petal's own colour
  totalEmissiveRadiance += diffuseColor.rgb * uLampCol * vLamp * 1.4;
}
`;

let seedCount = 0;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The bloom's visible share at `open` (the bud has the rest). */
export const bloomWeight = (o: number) => smoothstep(0.25, 0.45, o);
/** Petal scale toward their hearts: the bud closes in on the swap, the bloom grows from 0.3 to full. */
export const budScale = (o: number) => 1 - 0.4 * smoothstep(0.05, 0.45, o);
export const bloomScale = (o: number) => {
  const x = clamp01((o - 0.25) / 0.75);
  return 0.3 + 0.7 * (1 - (1 - x) * (1 - x));
};

/**
 * One garden flower of `kind`: the bud/bloom pair behind one `open` value. Stem base at the origin,
 * 1 unit tall, facing +Z. Resolves once both models are loaded and analysed (cached across flowers).
 */
export async function createFlower(THREE: Three, kind: FlowerKind, colors: FlowerPalette = flowerColors(kind)): Promise<GardenFlower> {
  const files = flowerFiles(kind);
  const [bud, bloom] = await Promise.all([part(THREE, files.bud), part(THREE, files.bloom)]);

  const lin = (c: V3) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const seed = ((seedCount++ * 0.6180339887) % 1) * 97;
  const shared = {
    uW: { value: 0 },
    uSeed: { value: seed },
    uOpen: { value: 0 },
    uGlow: { value: 0 },
    uGlowCol: { value: lin(colors.heart).lerp(lin(colors.petal), 0.25) },
    uLampCol: { value: lin(colors.lamp).lerp(lin(colors.heart), 0.5) },
    uLantern: { value: new THREE.Vector3(0, 100, 0) },
    uLanternK: { value: 0 },
  };

  const group = new THREE.Group();
  group.name = `garden-flower-${kind}`;
  const sway = new THREE.Group();
  group.add(sway);
  const owned: { dispose: () => void }[] = [];

  const makeMesh = (p: Part, side: 0 | 1) => {
    const material = p.material.clone();
    material.side = THREE.DoubleSide;
    const uniforms = { ...shared, uSide: { value: side }, uScale: { value: 1 } };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = VERT_HEAD + shader.vertexShader.replace("#include <begin_vertex>", VERT_BODY);
      shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace("void main() {", FRAG_MAIN).replace("#include <emissivemap_fragment>", FRAG_EMISSIVE);
    };
    material.customProgramCacheKey = () => "garden-tripo-flower-1";
    owned.push(material);
    const mesh = new THREE.Mesh(p.geometry, material);
    mesh.name = `${kind}-${side ? "bloom" : "bud"}`;
    sway.add(mesh);
    return { mesh, uniforms };
  };
  const B = makeMesh(bud, 0);
  const F = makeMesh(bloom, 1);

  // the main head (the bloom's, handed over from the bud's through the swap) and a sphere round it all
  const heart = bloom.heart.clone();
  let radius = 0;
  for (const p of [bud, bloom])
    for (const h of [bud.heart, bloom.heart])
      for (let i = 0; i < p.positions.length; i += 3) radius = Math.max(radius, Math.hypot(p.positions[i] - h.x, p.positions[i + 1] - h.y, p.positions[i + 2] - h.z));

  const phase = seed * 0.37;
  const lantern = { world: null as THREE_NS.Vector3 | null, k: 0 };
  const tmp = new THREE.Vector3();
  const placeLantern = () => {
    if (!lantern.world || lantern.k <= 0) {
      shared.uLanternK.value = 0;
      return;
    }
    sway.updateWorldMatrix(true, false);
    shared.uLantern.value.copy(sway.worldToLocal(tmp.copy(lantern.world)));
    shared.uLanternK.value = lantern.k;
  };

  const setOpen = (o: number) => {
    o = clamp01(o);
    const w = bloomWeight(o);
    shared.uW.value = w;
    shared.uOpen.value = o;
    B.uniforms.uScale.value = budScale(o);
    F.uniforms.uScale.value = bloomScale(o);
    B.mesh.visible = w < 1;
    F.mesh.visible = w > 0;
    heart.lerpVectors(bud.heart, bloom.heart, w);
  };
  setOpen(0);

  return {
    kind,
    group,
    heart,
    radius,
    setOpen,
    setLit: (k) => {
      shared.uGlow.value = clamp01(k);
    },
    setLantern: (world, k) => {
      lantern.world = world ? (lantern.world ?? new THREE.Vector3()).copy(world) : null;
      lantern.k = clamp01(k);
      placeLantern();
    },
    update: (t) => {
      sway.rotation.z = Math.sin(t * 0.8 + phase) * 0.035;
      sway.rotation.x = Math.sin(t * 0.55 + phase * 1.7) * 0.022;
      placeLantern();
    },
    dispose: () => {
      owned.forEach((d) => d.dispose());
      group.removeFromParent();
    },
  };
}

/** What the load-time analysis found for a pair (for the lab and debugging): heads and petal share per mesh. */
export async function inspectFlower(THREE: Three, kind: FlowerKind) {
  const files = flowerFiles(kind);
  const [bud, bloom] = await Promise.all([part(THREE, files.bud), part(THREE, files.bloom)]);
  const info = (p: Part) => ({
    heads: p.shape.heads.map((h) => ({ center: h.center.map((x) => +x.toFixed(3)), count: h.count, radius: +h.radius.toFixed(3) })),
    main: p.shape.main,
    petalShare: +(p.shape.petal.reduce((s, x) => s + (x >= 0.5 ? 1 : 0), 0) / p.shape.petal.length).toFixed(3),
  });
  return { bud: info(bud), bloom: info(bloom) };
}
