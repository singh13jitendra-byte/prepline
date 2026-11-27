/**
 * THE FIREFLY MODEL — one loader for the artist's files and for the stand-in.
 *
 * The contract (the character artist's README, next to the files):
 *   public/fireflies/firefly.glb       the hero model
 *   public/fireflies/firefly-lod.glb   the far model
 *   clips      `fly`, `hover`, `notice`, `blink`
 *   materials  `glow`, `wing`, `eye` (anything else is treated as body)
 *
 * loadFireflies() asks for the two files. Whatever is missing is built by standin.ts with the same
 * names, so nothing downstream knows which it got: flock.ts only ever sees a FireflyModel.
 *
 * A model is normalised here: wrapped so it stands 1 unit tall, centred on its bounding box, face
 * down +Z. The wrapper's matrix is baked into the joint matrices, so instances only place it.
 */

import * as THREE from "three";
import { buildStandin, type FireflyAsset } from "./standin";
import type { FfColors } from "./tokens";

export const FIREFLY_FILES = { hero: "/fireflies/firefly.glb", lod: "/fireflies/firefly-lod.glb" } as const;
export const CLIP_NAMES = ["fly", "hover", "notice", "blink"] as const;
export type ClipName = (typeof CLIP_NAMES)[number];
export type PartKind = "glow" | "wing" | "eye" | "body";

/** A run of joint matrices in the palette: a skin's bones, or one animated node. */
export type JointBlock = { mesh: number; skinned: boolean; offset: number; count: number };

export type FireflyPart = {
  /** Index of the source mesh in traversal order (the same index in every clone). */
  mesh: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  kind: PartKind;
  block: number;
};

export type FireflyModel = {
  source: FireflyAsset["source"];
  /** The normalising wrapper with the asset's scene inside. Cloned once per rig. */
  proto: THREE.Group;
  clips: Record<ClipName, THREE.AnimationClip | null>;
  parts: FireflyPart[];
  blocks: JointBlock[];
  /** Palette width in joints. */
  joints: number;
  /** The lantern's centre, in the normalised model's space. */
  lamp: THREE.Vector3;
  /** Radius of a sphere around the normalised model (for picking). */
  radius: number;
  triangles: number;
};

/**
 * How the artist's files sit in the world before normalising. glTF's own convention is +Y up and
 * the front of the asset facing +Z; if the README says otherwise, turn the model here.
 */
export const GLB_SETUP = {
  yaw: 0,
  pitch: 0,
  /** Emissive multiplier for the `glow` material: a lit lantern is brighter than paint, so it blooms (post.ts). */
  glowGain: 1.7,
  /** The lantern's light on its own body, computed. The artist's model has that bounce painted in already. */
  selfLight: 0.7,
};

const kindOf = (name: string): PartKind => (/glow|lantern|light/i.test(name) ? "glow" : /wing/i.test(name) ? "wing" : /eye/i.test(name) ? "eye" : "body");

export function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

/** Area-weighted centroid of a mesh's surface in its rest pose, in `root`'s space. */
function centroid(mesh: THREE.Mesh, target: THREE.Vector3): number {
  const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const idx = mesh.geometry.index;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
  const at = (i: number, out: THREE.Vector3) => {
    if (skinned) skinned.getVertexPosition(i, out);
    else out.fromBufferAttribute(pos, i);
    return out.applyMatrix4(mesh.matrixWorld);
  };
  let area = 0;
  target.set(0, 0, 0);
  const tris = (idx ? idx.count : pos.count) / 3;
  for (let t = 0; t < tris; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    at(i0, a);
    at(i1, b);
    at(i2, c);
    const w = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5;
    target.addScaledVector(a.add(b).add(c).multiplyScalar(1 / 3), w);
    area += w;
  }
  if (area > 0) target.multiplyScalar(1 / area);
  return area;
}

/** Wrap, measure and describe an asset. */
export function describe(asset: FireflyAsset): FireflyModel {
  const proto = new THREE.Group();
  proto.name = "firefly-norm";
  proto.add(asset.scene);
  if (asset.source === "glb") asset.scene.rotation.set(GLB_SETUP.pitch, GLB_SETUP.yaw, 0);
  proto.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(asset.scene, true);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(size.y, 1e-4);
  proto.scale.setScalar(k);
  proto.position.copy(centre).multiplyScalar(-k);
  proto.updateMatrixWorld(true);

  const meshes = meshesOf(proto);
  const blocks: JointBlock[] = [];
  const parts: FireflyPart[] = [];
  const skinBlock = new Map<THREE.Skeleton, number>();
  let joints = 0;
  let triangles = 0;
  const lamp = new THREE.Vector3();
  let lampArea = 0;
  const cTmp = new THREE.Vector3();

  meshes.forEach((mesh, i) => {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const kind = kindOf(material.name || mesh.name);
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
    let block: number;
    if (skinned) {
      // Meshes that share a skeleton and a bind matrix share one run of joints.
      const known = skinBlock.get(skinned.skeleton);
      const same = known !== undefined && (meshes[blocks[known].mesh] as THREE.SkinnedMesh).bindMatrix.equals(skinned.bindMatrix);
      if (same) block = known;
      else {
        block = blocks.length;
        blocks.push({ mesh: i, skinned: true, offset: joints, count: skinned.skeleton.bones.length });
        joints += skinned.skeleton.bones.length;
        skinBlock.set(skinned.skeleton, block);
      }
    } else {
      block = blocks.length;
      blocks.push({ mesh: i, skinned: false, offset: joints, count: 1 });
      joints += 1;
    }
    parts.push({ mesh: i, geometry: mesh.geometry, material, kind, block });
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : (g.getAttribute("position") as THREE.BufferAttribute).count) / 3;
    if (kind === "glow") {
      const area = centroid(mesh, cTmp);
      lamp.addScaledVector(cTmp, area);
      lampArea += area;
    }
  });
  // The artist marks the lantern's centre with a node. Without it: the centroid of what glows.
  const anchor = proto.getObjectByName("GlowAnchor");
  if (anchor) anchor.getWorldPosition(lamp);
  else if (lampArea > 0) lamp.multiplyScalar(1 / lampArea);
  else lamp.set(0, -0.3, -0.05);

  const normBox = new THREE.Box3().setFromObject(proto, true);
  const radius = normBox.getBoundingSphere(new THREE.Sphere()).radius;

  const clips = {} as FireflyModel["clips"];
  for (const name of CLIP_NAMES) {
    clips[name] = asset.animations.find((c) => c.name === name) ?? asset.animations.find((c) => c.name.toLowerCase().split(/[|._\s-]/).includes(name)) ?? null;
  }
  return { source: asset.source, proto, clips, parts, blocks, joints, lamp, radius, triangles };
}

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-cache" });
    const type = r.headers.get("content-type") ?? "";
    return r.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

async function loadGlb(url: string): Promise<FireflyAsset | null> {
  if (!(await exists(url))) return null;
  try {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/libs/meshopt_decoder.module.js")]);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    return { scene: gltf.scene, animations: gltf.animations, source: "glb" };
  } catch (err) {
    console.warn(`[fireflies] ${url} did not load; using the stand-in.`, err);
    return null;
  }
}

export type FireflyModels = { hero: FireflyModel; lod: FireflyModel; missing: ClipName[] };

/** The two models: the artist's where they exist, the stand-in where they do not. */
export async function loadFireflies(colors: FfColors, opts: { standin?: boolean } = {}): Promise<FireflyModels> {
  const [heroGlb, lodGlb] = opts.standin ? [null, null] : await Promise.all([loadGlb(FIREFLY_FILES.hero), loadGlb(FIREFLY_FILES.lod)]);
  const hero = describe(heroGlb ?? buildStandin(colors, false));
  const lod = describe(lodGlb ?? buildStandin(colors, true));
  const missing = CLIP_NAMES.filter((n) => !hero.clips[n]);
  if (hero.source === "glb" && missing.length) console.warn(`[fireflies] firefly.glb has no clip named: ${missing.join(", ")}`);
  return { hero, lod, missing };
}
