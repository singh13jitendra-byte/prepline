/**
 * THE FLOCK — batched skinned rendering.
 *
 * Three's InstancedMesh shares one skeleton between its instances, so every firefly would strike
 * the same pose. Here each instance reads its own pose from a "palette": a float texture with one
 * row per rig and four texels per joint. The model's meshes become one InstancedMesh each (one per
 * material), and the whole flock draws in that many calls however many fireflies there are.
 *
 *   rig        a clone of the model's hierarchy with its own AnimationMixer. It is never drawn:
 *              after the mixer runs, its joint matrices are written into its palette row.
 *   instance   a firefly on screen: a matrix (place, heading, size), a rig row, a lantern level.
 *              Heroes have a rig each. The far flock shares a handful of rigs.
 *
 * The model's own materials are kept (so the artist's textures and PBR values survive) and patched
 * in onBeforeCompile: skinning from the palette, the lantern's pulse, the light the lantern throws
 * on its own body, the light of the firefly the camera is on, moon rim, haze, dimming.
 */

import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLB_SETUP, meshesOf, type ClipName, type FireflyModel, type PartKind } from "./model";

/** Uniforms every patched material shares with the rest of the scene (engine.ts owns the values). */
export type SharedUniforms = {
  /** xyz: world position of the firefly the camera is on. w: its light (0 when none). */
  uKey: { value: THREE.Vector4 };
  uKeyColor: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  /** View-space direction the moonlight comes from. */
  uRimDir: { value: THREE.Vector3 };
  uFogColor: { value: THREE.Color };
  /** x: distance where haze starts, y: where it is full, z: the most it can cover. */
  uFog: { value: THREE.Vector3 };
  /** 0..1: how far the camera is into a close-up. Everything not chosen dims by it. */
  uFocus: { value: number };
  /** Lamp yellow: the colour the model's lantern is painted in. An instance's own light colour is its tint. */
  uGlowColor: { value: THREE.Color };
  uGlowHot: { value: THREE.Color };
};

type RigAction = Record<ClipName, THREE.AnimationAction | null>;
export type Rig = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: RigAction;
  meshes: THREE.Mesh[];
  /** Blend weights the engine steers; applied in advance(). */
  w: { fly: number; hover: number; notice: number };
  /** Playback rate (wing-beat variety). */
  rate: number;
};

const VERT_PARS = /* glsl */ `
uniform sampler2D uPalette;
attribute vec4 ffSkinIndex;
attribute vec4 ffSkinWeight;
attribute float aRig;
attribute vec4 aFx;
attribute vec3 aTint;
varying vec4 vFx;
varying vec3 vTint;
varying vec3 vFfPos;
varying vec3 vFfNrm;
#ifdef FF_VERTEX_EMIT
  attribute float aEmit;
  varying float vEmit;
#endif
#ifdef FF_MORPH
  attribute vec3 ffMorph;
#endif
mat4 ffJoint(float j) {
  int x = int(j + 0.5) * 4;
  int y = int(aRig + 0.5);
  return mat4(texelFetch(uPalette, ivec2(x, y), 0), texelFetch(uPalette, ivec2(x + 1, y), 0), texelFetch(uPalette, ivec2(x + 2, y), 0), texelFetch(uPalette, ivec2(x + 3, y), 0));
}
`;

const VERT_SKINBASE = /* glsl */ `
mat4 ffSkin = ffSkinWeight.x * ffJoint(ffSkinIndex.x);
if (ffSkinWeight.y > 0.0) ffSkin += ffSkinWeight.y * ffJoint(ffSkinIndex.y);
if (ffSkinWeight.z > 0.0) ffSkin += ffSkinWeight.z * ffJoint(ffSkinIndex.z);
if (ffSkinWeight.w > 0.0) ffSkin += ffSkinWeight.w * ffJoint(ffSkinIndex.w);
`;

const VERT_SKINNORMAL = /* glsl */ `
objectNormal = normalize((ffSkin * vec4(objectNormal, 0.0)).xyz);
#ifdef USE_TANGENT
  objectTangent = normalize((ffSkin * vec4(objectTangent, 0.0)).xyz);
#endif
vFfNrm = objectNormal;
`;

const VERT_SKINNING = /* glsl */ `
#ifdef FF_MORPH
  // The one morph target (the mouth opening): its weight rides in the rig's palette row, after the joints.
  transformed += ffMorph * texelFetch(uPalette, ivec2(FF_MORPH, int(aRig + 0.5)), 0).x;
#endif
transformed = (ffSkin * vec4(transformed, 1.0)).xyz;
vFfPos = transformed;
vFx = aFx;
vTint = aTint;
#ifdef FF_VERTEX_EMIT
  vEmit = aEmit;
#endif
`;

const FRAG_PARS = /* glsl */ `
varying vec4 vFx;
varying vec3 vTint;
varying vec3 vFfPos;
varying vec3 vFfNrm;
#ifdef FF_VERTEX_EMIT
  varying float vEmit;
#endif
uniform vec3 uLampPos;
uniform vec3 uGlowColor;
uniform vec3 uGlowHot;
uniform vec4 uKey;
uniform vec3 uKeyColor;
uniform vec3 uRimColor;
uniform vec3 uRimDir;
uniform vec3 uFogColor;
uniform vec3 uFog;
uniform float uFocus;
uniform float uGlowGain;
uniform float uSelfLight;
// How far this firefly's light is from lamp yellow (0 for a kept one).
float ffCool() { return clamp(distance(vTint, uGlowColor) * 2.5, 0.0, 1.0); }
float ffLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** After the emissive map: the lantern's own pulse, per instance. */
const FRAG_EMISSIVE = /* glsl */ `
#ifdef FF_VERTEX_EMIT
  totalEmissiveRadiance *= vEmit;
#endif
#ifdef FF_GLOW
  {
    // The lantern is painted lamp yellow. A set-aside firefly keeps the painting's light and shade in its own colour.
    float ffC = ffCool();
    vec3 ffE = mix(totalEmissiveRadiance, vTint * (ffLuma(totalEmissiveRadiance) / max(ffLuma(uGlowColor), 1e-3)), ffC);
    // A lit bulb, not a painted disc: brighter and paler where we look into it.
    float ffCore = pow(clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 1.6);
    totalEmissiveRadiance = ffE * (uGlowGain * vFx.x) * mix(0.62, 1.12, ffCore) + mix(uGlowHot, vTint, ffC) * (vFx.x * ffCore * ffCore * 0.3 * uGlowGain);
  }
#endif
#ifdef FF_BAKED
  {
    // The body's emissive map is a low night ambient plus the lantern's bounce, baked: it follows the lantern.
    vec3 ffB = totalEmissiveRadiance * (0.55 + 0.45 * min(vFx.x, 1.2));
    totalEmissiveRadiance = mix(ffB, ffLuma(ffB) * (0.5 + 0.5 * vTint / max(ffLuma(vTint), 1e-3)), ffCool() * 0.6);
  }
#endif
`;

/** Before the fragment is written: light the model does not get from the scene's lights. */
const FRAG_LIGHT = /* glsl */ `
{
  vec3 ffView = normalize(vViewPosition);
  // 1. The lantern lights its own body: wrapped, falling off with the square of the distance.
  vec3 ffToLamp = uLampPos - vFfPos;
  float ffD2 = dot(ffToLamp, ffToLamp);
  float ffWrap = clamp((dot(normalize(vFfNrm), ffToLamp * inversesqrt(ffD2 + 1e-5)) + 0.5) / 1.5, 0.0, 1.0);
  vec3 ffLamp = vTint * (vFx.x * ffWrap / (1.0 + ffD2 * 11.0));
  #ifndef FF_GLOW
    outgoingLight += diffuseColor.rgb * ffLamp * uSelfLight;
  #endif
  // 2. The firefly the camera is on lights its neighbours (never itself: its own lantern does that).
  vec3 ffToKey = (viewMatrix * vec4(uKey.xyz, 1.0)).xyz + vViewPosition;
  float ffK2 = dot(ffToKey, ffToKey);
  float ffKn = clamp(dot(normal, ffToKey * inversesqrt(ffK2 + 1e-4)) * 0.6 + 0.4, 0.0, 1.0);
  outgoingLight += diffuseColor.rgb * uKeyColor * (uKey.w * (1.0 - vFx.w) * ffKn / (1.0 + ffK2 * 0.3));
  // 3. Moonlight on the edge that faces the moon.
  float ffFres = pow(1.0 - clamp(dot(normal, ffView), 0.0, 1.0), 2.4);
  outgoingLight += uRimColor * (ffFres * clamp(dot(normal, uRimDir) * 0.6 + 0.4, 0.0, 1.0));
  #ifdef FF_WING
    // A wing is a thin membrane: the lantern shines through it, and it catches the moon at a glancing angle.
    // Where the card is clear it stays clear (the wing's outline is painted into its alpha).
    if (diffuseColor.a < 0.03) discard;
    float ffLum = dot(ffLamp, vec3(0.3, 0.6, 0.1));
    outgoingLight += vTint * ffLum * 1.6;
    // vFx.y: the wing's own opacity (lower in fast flight, which reads as motion blur).
    diffuseColor.a = clamp(diffuseColor.a * (0.75 + 0.9 * ffFres + ffLum * 1.2) * vFx.y, 0.0, 0.95);
  #endif
  // 4. While the camera is on one firefly, the others step back.
  outgoingLight *= 1.0 - 0.42 * uFocus * (1.0 - vFx.w);
  // 5. Night haze with distance.
  float ffHaze = smoothstep(uFog.x, uFog.y, length(vViewPosition)) * uFog.z;
  outgoingLight = mix(outgoingLight, uFogColor, ffHaze);
  #ifdef FF_WING
    diffuseColor.a *= 1.0 - ffHaze * 0.6;
  #endif
}
// Coming and going (and too close to the lens): a screen-door fade, so nothing needs sorting.
if (vFx.z < 0.995) {
  float ffNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (vFx.z <= ffNoise) discard;
}
`;

type Own = { uPalette: { value: THREE.Texture | null }; uLampPos: { value: THREE.Vector3 }; uGlowGain: { value: number }; uSelfLight: { value: number } };

function patch(material: THREE.Material, kind: PartKind, shared: SharedUniforms, own: Own, opts: { vertexEmit: boolean; baked: boolean; morphAt: number }) {
  const defines: string[] = [];
  if (kind === "glow") defines.push("FF_GLOW");
  if (kind === "wing") defines.push("FF_WING");
  if (opts.vertexEmit) defines.push("FF_VERTEX_EMIT");
  if (opts.baked) defines.push("FF_BAKED");
  if (opts.morphAt >= 0) defines.push(`FF_MORPH ${opts.morphAt}`);
  const head = defines.map((d) => `#define ${d}\n`).join("");
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, own);
    shader.vertexShader =
      head +
      shader.vertexShader
        .replace("#include <skinning_pars_vertex>", `#include <skinning_pars_vertex>\n${VERT_PARS}`)
        .replace("#include <skinbase_vertex>", VERT_SKINBASE)
        .replace("#include <skinnormal_vertex>", VERT_SKINNORMAL)
        .replace("#include <skinning_vertex>", VERT_SKINNING);
    shader.fragmentShader =
      head +
      shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`)
        .replace("#include <opaque_fragment>", `${FRAG_LIGHT}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `ff-${kind}-${defines.join("-")}`;
  material.needsUpdate = true;
}

/** A lit, standard material for the patch to work on (an unlit glTF material is given one). */
function litCopy(src: THREE.Material): THREE.MeshStandardMaterial {
  const m = src as THREE.MeshStandardMaterial;
  if (m.isMeshStandardMaterial) return m.clone();
  // Unlit (the highlights in the eyes): it keeps its own brightness in any light, so its colour becomes its emission.
  const basic = src as THREE.MeshBasicMaterial;
  const out = new THREE.MeshStandardMaterial({ name: src.name, color: 0x000000, emissive: basic.color?.clone() ?? new THREE.Color(1, 1, 1), emissiveMap: basic.map ?? null, emissiveIntensity: 1, transparent: src.transparent, opacity: src.opacity, side: src.side, roughness: 1, metalness: 0 }); // token-ok: black base under an emissive-only material
  out.envMapIntensity = 0;
  out.vertexColors = src.vertexColors;
  return out;
}

const M = new THREE.Matrix4();
const M2 = new THREE.Matrix4();

export class Flock {
  readonly count: number;
  readonly rigs: Rig[] = [];
  readonly meshes: THREE.InstancedMesh[] = [];
  readonly group = new THREE.Group();
  private readonly model: FireflyModel;
  private readonly palette: THREE.DataTexture;
  private readonly paletteData: Float32Array;
  private readonly constant: THREE.Matrix4[];
  private readonly matrix: THREE.InstancedBufferAttribute;
  private readonly rigAttr: THREE.InstancedBufferAttribute;
  private readonly fx: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly owned: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = { geometries: [], materials: [] };
  /** The parts' own uniforms (for the engine to tune). */
  readonly own: Own;
  /** Floats in one rig's palette row: four texels a joint, then one texel of morph weights. */
  private readonly row: number;
  /** The mesh (traversal index) whose first morph target the palette carries, or -1. */
  private readonly morphMesh: number;

  /**
   * `wingDepth`: wings write depth. They are still blended, so a wing behind another firefly's wing
   * can lose a few pixels; in return the lens pass (post.ts) knows where a wing is and keeps the
   * chosen firefly's wings as sharp as the rest of it.
   */
  constructor(model: FireflyModel, count: number, rigCount: number, shared: SharedUniforms, opts: { order?: number; wingDepth?: boolean } = {}) {
    this.model = model;
    this.count = count;
    const width = model.joints * 4 + 1;
    this.row = width * 4;
    this.morphMesh = model.parts.find((p) => p.geometry.morphAttributes.position?.length)?.mesh ?? -1;
    this.paletteData = new Float32Array(width * rigCount * 4);
    this.palette = new THREE.DataTexture(this.paletteData, width, rigCount, THREE.RGBAFormat, THREE.FloatType);
    this.palette.minFilter = this.palette.magFilter = THREE.NearestFilter;
    this.palette.generateMipmaps = false;
    this.palette.needsUpdate = true;
    this.own = { uPalette: { value: this.palette }, uLampPos: { value: model.lamp.clone() }, uGlowGain: { value: model.source === "glb" ? GLB_SETUP.glowGain : 1 }, uSelfLight: { value: model.source === "glb" ? GLB_SETUP.selfLight : 2.6 } };

    this.matrix = new THREE.InstancedBufferAttribute(new Float32Array(count * 16), 16);
    this.matrix.setUsage(THREE.DynamicDrawUsage);
    this.rigAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    this.fx = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.fx.setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    for (let i = 0; i < count; i++) {
      this.rigAttr.setX(i, i % rigCount);
      this.fx.setXYZW(i, 1, 1, 1, 0);
      M.identity().toArray(this.matrix.array, i * 16);
    }

    /* ── one InstancedMesh per part ── */
    const protoMeshes = meshesOf(model.proto);
    for (const part of model.parts) {
      const src = part.geometry;
      const block = model.blocks[part.block];
      const g = new THREE.BufferGeometry();
      // A mirrored node (the artist's left eye is the right one, reflected) turns its triangles
      // inside out. Three corrects that per object; here the node's matrix is applied in the shader,
      // so the winding is put right in the index instead.
      const mirrored = !block.skinned && protoMeshes[block.mesh].matrixWorld.determinant() < 0;
      if (mirrored && src.index) {
        const flipped = src.index.clone();
        const ix = flipped.array;
        for (let t = 0; t + 2 < ix.length; t += 3) {
          const k = ix[t + 1];
          ix[t + 1] = ix[t + 2];
          ix[t + 2] = k;
        }
        g.setIndex(flipped);
      } else g.setIndex(src.index);
      for (const name of ["position", "normal", "uv", "uv1", "color", "tangent", "aEmit"]) {
        const a = src.getAttribute(name);
        if (a) g.setAttribute(name, a);
      }
      const n = (src.getAttribute("position") as THREE.BufferAttribute).count;
      const si = new Float32Array(n * 4);
      const sw = new Float32Array(n * 4);
      const srcI = src.getAttribute("skinIndex") as THREE.BufferAttribute | undefined;
      const srcW = src.getAttribute("skinWeight") as THREE.BufferAttribute | undefined;
      for (let v = 0; v < n; v++) {
        if (block.skinned && srcI && srcW) {
          // Weights are renormalised: an exporter may leave them summing to less than one.
          const w = [srcW.getX(v), srcW.getY(v), srcW.getZ(v), srcW.getW(v)];
          const sum = w[0] + w[1] + w[2] + w[3] || 1;
          si[v * 4] = block.offset + srcI.getX(v);
          si[v * 4 + 1] = block.offset + srcI.getY(v);
          si[v * 4 + 2] = block.offset + srcI.getZ(v);
          si[v * 4 + 3] = block.offset + srcI.getW(v);
          for (let k = 0; k < 4; k++) sw[v * 4 + k] = w[k] / sum;
        } else {
          si[v * 4] = block.offset;
          sw[v * 4] = 1;
        }
      }
      g.setAttribute("ffSkinIndex", new THREE.BufferAttribute(si, 4));
      g.setAttribute("ffSkinWeight", new THREE.BufferAttribute(sw, 4));
      g.setAttribute("aRig", this.rigAttr);
      g.setAttribute("aFx", this.fx);
      g.setAttribute("aTint", this.tint);
      const morph = part.mesh === this.morphMesh ? src.morphAttributes.position?.[0] : undefined;
      if (morph) g.setAttribute("ffMorph", morph);
      this.owned.geometries.push(g);

      const material = litCopy(part.material);
      if (part.kind === "wing") {
        material.transparent = true;
        material.depthWrite = !!opts.wingDepth;
        material.side = THREE.DoubleSide;
      }
      patch(material, part.kind, shared, this.own, { vertexEmit: !!src.getAttribute("aEmit"), baked: part.kind === "body" && !!material.emissiveMap, morphAt: morph ? model.joints * 4 : -1 });
      this.owned.materials.push(material);

      const mesh = new THREE.InstancedMesh(g, material, count);
      mesh.instanceMatrix = this.matrix;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = (opts.order ?? 0) + (part.kind === "wing" ? 1 : 0);
      mesh.name = `flock-${part.kind}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }

    /* ── per joint, the part of its matrix that never changes: inverse bind × bind matrix ── */
    this.constant = [];
    for (const block of model.blocks) {
      const mesh = protoMeshes[block.mesh] as THREE.SkinnedMesh;
      for (let j = 0; j < block.count; j++) this.constant.push(block.skinned ? new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[j], mesh.bindMatrix) : new THREE.Matrix4());
    }

    /* ── rigs ── */
    for (let r = 0; r < rigCount; r++) {
      const root = cloneSkinned(model.proto);
      root.matrixAutoUpdate = true;
      const mixer = new THREE.AnimationMixer(root);
      const actions = {} as RigAction;
      for (const name of Object.keys(model.clips) as ClipName[]) {
        let clip = model.clips[name];
        if (!clip) {
          actions[name] = null;
          continue;
        }
        if (name === "blink") clip = THREE.AnimationUtils.makeClipAdditive(clip.clone());
        const action = mixer.clipAction(clip);
        if (name === "notice" || name === "blink") {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = name === "notice";
        }
        actions[name] = action;
      }
      actions.fly?.play();
      actions.hover?.play();
      actions.hover?.setEffectiveWeight(0);
      this.rigs.push({ root, mixer, actions, meshes: meshesOf(root), w: { fly: 1, hover: 0, notice: 0 }, rate: 1 });
    }
  }

  /** Start every rig at its own point in the loop, at its own wing-beat rate. */
  scatter(rand: () => number) {
    for (const rig of this.rigs) {
      rig.rate = 0.88 + rand() * 0.3;
      for (const name of ["fly", "hover"] as const) {
        const a = rig.actions[name];
        if (a) a.time = rand() * a.getClip().duration;
      }
    }
  }

  /** Play the one-shot `notice` on a rig (the engine fades its weight in and out through rig.w). */
  notice(r: number) {
    const a = this.rigs[r]?.actions.notice;
    if (!a) return;
    a.reset();
    a.setEffectiveWeight(0);
    a.play();
  }

  blink(r: number) {
    const rig = this.rigs[r];
    const a = rig?.actions.blink;
    // `notice` keys the lids itself.
    if (!a || rig.w.notice > 0.01) return;
    a.reset();
    a.setEffectiveWeight(1);
    a.play();
  }

  /** Advance one rig's animation and write its joint matrices into its palette row. */
  advance(r: number, dt: number) {
    const rig = this.rigs[r];
    const { fly, hover, notice } = rig.actions;
    // Without a `notice` clip its weight goes to `hover`; without `hover`, to `fly`.
    const wn = notice ? rig.w.notice : 0;
    const wh = hover ? rig.w.hover + (notice ? 0 : rig.w.notice) : 0;
    const wf = Math.max(0, 1 - wn - wh);
    fly?.setEffectiveWeight(wf);
    hover?.setEffectiveWeight(wh);
    notice?.setEffectiveWeight(wn);
    rig.mixer.update(dt * rig.rate);
    rig.root.updateMatrixWorld(true);

    const width = this.row;
    const out = this.paletteData;
    if (this.morphMesh >= 0) out[r * width + this.model.joints * 16] = rig.meshes[this.morphMesh].morphTargetInfluences?.[0] ?? 0;
    let c = 0;
    for (const block of this.model.blocks) {
      const mesh = rig.meshes[block.mesh];
      if (block.skinned) {
        const sk = mesh as THREE.SkinnedMesh;
        M2.multiplyMatrices(sk.matrixWorld, sk.bindMatrixInverse);
        const bones = sk.skeleton.bones;
        for (let j = 0; j < block.count; j++, c++) {
          M.multiplyMatrices(M2, bones[j].matrixWorld).multiply(this.constant[c]);
          M.toArray(out, r * width + c * 16);
        }
      } else {
        mesh.matrixWorld.toArray(out, r * width + c * 16);
        c++;
      }
    }
  }

  /** Call once per frame after the rigs have advanced. */
  commit() {
    this.palette.needsUpdate = true;
    this.matrix.needsUpdate = true;
    this.fx.needsUpdate = true;
  }

  setMatrix(i: number, m: THREE.Matrix4) {
    m.toArray(this.matrix.array, i * 16);
  }
  /** glow: lantern level. fade: 0 gone .. 1 solid. selected: 1 for the firefly the camera is on. wing: the wings' opacity. */
  setFx(i: number, glow: number, fade: number, selected: number, wing = 1) {
    const a = this.fx.array;
    a[i * 4] = glow;
    a[i * 4 + 1] = wing;
    a[i * 4 + 2] = fade;
    a[i * 4 + 3] = selected;
  }
  setTint(i: number, r: number, g: number, b: number) {
    this.tint.setXYZ(i, r, g, b);
    this.tint.needsUpdate = true;
  }
  setRig(i: number, r: number) {
    if (this.rigAttr.getX(i) === r) return;
    this.rigAttr.setX(i, r);
    this.rigAttr.needsUpdate = true;
  }
  /** Draw only the first `n` instances. */
  setCount(n: number) {
    for (const m of this.meshes) m.count = Math.max(0, Math.min(this.count, n));
  }

  dispose() {
    for (const rig of this.rigs) {
      rig.mixer.stopAllAction();
      rig.mixer.uncacheRoot(rig.root);
    }
    this.owned.geometries.forEach((g) => g.dispose());
    this.owned.materials.forEach((m) => m.dispose());
    this.palette.dispose();
    this.group.removeFromParent();
  }
}
