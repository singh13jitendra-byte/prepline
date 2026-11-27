/**
 * THE STAND-IN FIREFLY — a procedural character that keeps the artist's contract until
 * public/fireflies/firefly.glb (and firefly-lod.glb) land:
 *
 *   clips       `fly`, `hover` (loops), `notice`, `blink` (one-shots)
 *   materials   `glow` (the lantern and the antenna tips), `wing`, `eye`, plus `body`
 *   axes        +Y up, the face looks down +Z, about 1.3 units tall before normalising
 *
 * It returns exactly what GLTFLoader returns (`scene` + `animations`), so model.ts treats both the
 * same way and swapping in the real files changes nothing downstream.
 *
 * The look follows the founder's references: a big round head, big glossy eyes, a small body, a
 * glowing abdomen, veined translucent wings, lit antenna tips, tiny limbs. Built from primitives
 * merged per material and skinned to a small skeleton. Colours come from the theme (tokens.ts).
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FfColors } from "./tokens";

export type FireflyAsset = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  source: "glb" | "standin";
};

type V3 = [number, number, number];

/** name, parent, absolute rest position. Order is the skeleton's joint order. */
const BONES: [string, string | null, V3][] = [
  ["root", null, [0, 0, 0]],
  ["body", "root", [0, -0.16, -0.02]],
  ["head", "body", [0, -0.02, 0]],
  ["abdomen", "body", [0, -0.27, -0.06]],
  ["wingL", "body", [0.07, -0.05, -0.13]],
  ["wingR", "body", [-0.07, -0.05, -0.13]],
  ["wingL2", "body", [0.06, -0.13, -0.14]],
  ["wingR2", "body", [-0.06, -0.13, -0.14]],
  ["armL", "body", [0.125, -0.12, 0.05]],
  ["armR", "body", [-0.125, -0.12, 0.05]],
  ["legL", "body", [0.065, -0.27, 0.03]],
  ["legR", "body", [-0.065, -0.27, 0.03]],
  ["antL1", "head", [0.095, 0.47, 0.05]],
  ["antL2", "antL1", [0.165, 0.6, 0.085]],
  ["antR1", "head", [-0.095, 0.47, 0.05]],
  ["antR2", "antR1", [-0.165, 0.6, 0.085]],
  ["eyeL", "head", [0.118, 0.215, 0.255]],
  ["eyeR", "head", [-0.118, 0.215, 0.255]],
  ["lidL", "eyeL", [0.118, 0.215, 0.255]],
  ["lidR", "eyeR", [-0.118, 0.215, 0.255]],
];
const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b[0], i])) as Record<string, number>;
const restOf = (name: string) => BONES[BONE_INDEX[name]][2];

const HEAD: V3 = [0, 0.21, 0.03];
const HEAD_R = 0.3;
const HEAD_S: V3 = [1.06, 0.96, 0.98];
const EYE_R = 0.105;

type Skin = number | ((p: THREE.Vector3) => [number, number, number]);
type PartOpts = {
  /** Applied to the primitive first. */
  m?: THREE.Matrix4;
  color: THREE.Color | ((p: THREE.Vector3, local: THREE.Vector3) => THREE.Color);
  /** Bone index, or (position) → [boneA, boneB, weightOfB]. */
  bone: Skin;
  /** Emissive strength per vertex (the `glow` and `eye` materials read it). */
  emit?: number | ((p: THREE.Vector3, local: THREE.Vector3) => number);
};

const tmpP = new THREE.Vector3();
const tmpL = new THREE.Vector3();

/** A primitive → transformed, coloured, skinned, with every attribute the merge needs. */
function part(src: THREE.BufferGeometry, { m, color, bone, emit = 0 }: PartOpts): THREE.BufferGeometry {
  const g = src.index ? src : src.toNonIndexed();
  const local = (g.getAttribute("position") as THREE.BufferAttribute).clone();
  if (m) g.applyMatrix4(m);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const em = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    tmpP.fromBufferAttribute(pos, i);
    tmpL.fromBufferAttribute(local, i);
    const c = typeof color === "function" ? color(tmpP, tmpL) : color;
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    if (typeof bone === "number") {
      si[i * 4] = bone;
      sw[i * 4] = 1;
    } else {
      const [a, b, w] = bone(tmpP);
      si[i * 4] = a;
      si[i * 4 + 1] = b;
      sw[i * 4] = 1 - w;
      sw[i * 4 + 1] = w;
    }
    em[i] = typeof emit === "function" ? emit(tmpP, tmpL) : emit;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  g.setAttribute("aEmit", new THREE.BufferAttribute(em, 1));
  if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/** Mirror a finished part across x = 0 (the character's other side), re-binding its bones. */
function mirror(src: THREE.BufferGeometry, remap: (bone: number) => number): THREE.BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
    nrm.setX(i, -nrm.getX(i));
  }
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      idx.setX(i, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
  }
  const si = g.getAttribute("skinIndex") as THREE.BufferAttribute;
  for (let i = 0; i < si.count; i++) si.setXYZW(i, remap(si.getX(i)), remap(si.getY(i)), 0, 0);
  return g;
}

const LR: Record<string, string> = { wingL: "wingR", wingL2: "wingR2", armL: "armR", legL: "legR", antL1: "antR1", antL2: "antR2", eyeL: "eyeR", lidL: "lidR" };
const toRight = (bone: number) => {
  const other = LR[BONES[bone][0]];
  return other ? BONE_INDEX[other] : bone;
};

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const mat = () => new THREE.Matrix4();
const T = (x: number, y: number, z: number) => mat().makeTranslation(x, y, z);
const Sc = (x: number, y: number, z: number) => mat().makeScale(x, y, z);
const R = (axis: THREE.Vector3, a: number) => mat().makeRotationAxis(axis, a);
/** Rotation taking +Y onto `dir`. */
const aimY = (dir: THREE.Vector3) => mat().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize()));
const aimZ = (dir: THREE.Vector3) => mat().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, dir.clone().normalize()));
/** a · b · c: `c` is applied first. */
const chain = (...ms: THREE.Matrix4[]) => ms.reduce((acc, m) => acc.multiply(m), mat());
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A point on the head's surface in direction `dir`, and the surface normal there. */
function onHead(dir: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
  const d = dir.clone().normalize();
  const p = v(HEAD[0] + HEAD_R * HEAD_S[0] * d.x, HEAD[1] + HEAD_R * HEAD_S[1] * d.y, HEAD[2] + HEAD_R * HEAD_S[2] * d.z);
  const n = v(d.x / HEAD_S[0], d.y / HEAD_S[1], d.z / HEAD_S[2]).normalize();
  return { p, n };
}

/** The wing membrane: alpha carries a soft body and the veins. White, tinted by the material. */
function wingTexture(): THREE.DataTexture {
  const W = 128;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const t = y / (H - 1);
      let vein = 0;
      // Five veins fanning out from the root, and a heavy one along the leading edge.
      for (let k = -2; k <= 2; k++) {
        const line = 0.5 + k * 0.19 * Math.min(1, u * 1.5) + 0.03 * Math.sin(u * 9 + k);
        vein = Math.max(vein, 1 - Math.min(1, Math.abs(t - line) / 0.022));
      }
      const cross = 1 - Math.min(1, Math.abs(((u * 5.2 + t * 0.9) % 1) - 0.5) / 0.035);
      vein = Math.max(vein, cross * 0.5 * (u > 0.2 ? 1 : 0));
      const lead = 1 - Math.min(1, Math.abs(t - (0.86 - 0.3 * u * u)) / 0.05);
      const body = 0.3 + 0.2 * (1 - u);
      const a = Math.min(1, body + 0.42 * vein * vein + 0.3 * lead);
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function wingShape(length: number, width: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.1 * length, 0.62 * width, 0.72 * length, 0.66 * width, length, 0.12 * width);
  s.bezierCurveTo(1.06 * length, -0.24 * width, 0.5 * length, -0.52 * width, 0, 0);
  const g = new THREE.ShapeGeometry(s, 9);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / length, pos.getY(i) / width + 0.5);
  return g;
}

/** Places a wing drawn in XY (root at the origin, tip along +X) at `root`, tip along `dir`, facing `face`. */
function wingMatrix(root: V3, dir: THREE.Vector3, face: THREE.Vector3): THREE.Matrix4 {
  const d = dir.clone().normalize();
  const n = face.clone().addScaledVector(d, -face.dot(d)).normalize();
  const u = new THREE.Vector3().crossVectors(n, d);
  return mat().makeBasis(d, u, n).setPosition(root[0], root[1], root[2]);
}

const lin = (rgb: V3) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);

function buildGeometry(colors: FfColors, lod: boolean) {
  const B = BONE_INDEX;
  const seg = (hi: number, lo: number) => (lod ? lo : hi);
  const skin = lin(colors.skin);
  const shell = lin(colors.shell);
  const limb = lin(colors.limb);
  const cheek = lin(colors.cheek);
  const white = lin(colors.eyeWhite);
  const pupil = lin(colors.eye);
  const one = new THREE.Color(1, 1, 1);
  const scratch = new THREE.Color();

  const body: THREE.BufferGeometry[] = [];
  const eye: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const wing: THREE.BufferGeometry[] = [];

  /* ── head: a big soft sphere, a touch paler low on the face ── */
  const headM = chain(T(...HEAD), Sc(...HEAD_S));
  body.push(
    part(new THREE.SphereGeometry(HEAD_R, seg(30, 12), seg(22, 9)), {
      m: headM,
      bone: B.head,
      color: (_p, l) => scratch.copy(skin).lerp(white, 0.1 * Math.max(0, -l.y / HEAD_R) + 0.05).clone(),
    }),
  );
  /* ── cap: a darker shell over the top and back of the head ── */
  body.push(
    part(new THREE.SphereGeometry(HEAD_R * 1.022, seg(30, 12), seg(9, 4), 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(82)), {
      m: chain(T(...HEAD), Sc(...HEAD_S), aimY(v(0, 0.72, -0.69))),
      bone: B.head,
      color: shell,
    }),
  );

  /* ── eyes: sclera, a big dark pupil looking a little inward, two catchlights ── */
  const eyeC = restOf("eyeL");
  const gaze = v(-0.1, 0.02, 1).normalize();
  const eyeL: THREE.BufferGeometry[] = [];
  eyeL.push(part(new THREE.SphereGeometry(EYE_R, seg(22, 10), seg(16, 7)), { m: T(...eyeC), bone: B.eyeL, color: white }));
  eyeL.push(
    part(new THREE.SphereGeometry(EYE_R * 1.022, seg(20, 10), seg(7, 3), 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(50)), {
      m: chain(T(...eyeC), aimY(gaze)),
      bone: B.eyeL,
      color: pupil,
    }),
  );
  for (const g of eyeL) eye.push(g, mirror(g, toRight));
  // Catchlights sit on the same side of both eyes (the moon is up and to the viewer's left).
  for (const side of [1, -1]) {
    const c: V3 = [eyeC[0] * side, eyeC[1], eyeC[2]];
    const gz = v(gaze.x * side, gaze.y, gaze.z);
    const boneI = side === 1 ? B.eyeL : B.eyeR;
    const spots: [THREE.Vector3, number, number][] = lod ? [[v(-0.34, 0.36, 0), 15, 1]] : [[v(-0.34, 0.36, 0), 14, 1], [v(0.24, -0.27, 0), 6.5, 0.7]];
    for (const [off, deg, emit] of spots) {
      eye.push(
        part(new THREE.SphereGeometry(EYE_R * 1.045, 10, 3, 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(deg)), {
          m: chain(T(...c), aimY(gz.clone().add(off))),
          bone: boneI,
          color: one,
          emit,
        }),
      );
    }
  }

  if (!lod) {
    /* ── upper lids: a skin-coloured cap that the `blink` clip rolls down over the eye ── */
    const lidCol = skin.clone().lerp(cheek, 0.18);
    const open = THREE.MathUtils.degToRad(118);
    const lid = part(new THREE.SphereGeometry(EYE_R * 1.07, 18, 8, 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(75)), {
      m: chain(T(...eyeC), aimY(v(0, Math.sin(open), Math.cos(open)))),
      bone: B.lidL,
      color: lidCol,
    });
    body.push(lid, mirror(lid, toRight));

    /* ── a small smile, and blush ── */
    const mouth = onHead(v(0, -0.36, 1));
    const arc = THREE.MathUtils.degToRad(120);
    body.push(
      part(new THREE.TorusGeometry(0.07, 0.0105, 6, 16, arc), {
        m: chain(T(mouth.p.x, mouth.p.y, mouth.p.z + 0.004), aimZ(mouth.n), R(Z, -Math.PI / 2 - arc / 2)),
        bone: B.head,
        color: limb,
      }),
    );
    const ch = onHead(v(0.62, -0.3, 0.72));
    const blush = part(new THREE.SphereGeometry(0.052, 12, 8), {
      m: chain(T(ch.p.x, ch.p.y, ch.p.z), aimZ(ch.n), Sc(1, 0.8, 0.22)),
      bone: B.head,
      color: cheek,
    });
    body.push(blush, mirror(blush, toRight));
  }

  /* ── thorax, with a paler belly ── */
  const th = restOf("body");
  body.push(
    part(new THREE.SphereGeometry(0.15, seg(18, 8), seg(14, 6)), {
      m: chain(T(...th), Sc(1.02, 0.95, 0.9)),
      bone: B.body,
      color: (_p, l) => scratch.copy(shell).lerp(skin, 0.4 * THREE.MathUtils.smoothstep(l.z / 0.15, 0.1, 0.9)).clone(),
    }),
  );

  /* ── abdomen: the lantern. Two darker segment rings; the top fades into a shell collar ── */
  const abM = chain(T(0, -0.4, -0.12), R(X, 0.42), Sc(0.95, 1.22, 0.95));
  const ring = (ly: number, at: number) => 1 - THREE.MathUtils.smoothstep(Math.abs(ly - at), 0.02, 0.05);
  glow.push(
    part(new THREE.SphereGeometry(0.19, seg(22, 10), seg(18, 8)), {
      m: abM,
      bone: B.abdomen,
      color: one,
      emit: (_p, l) => {
        const ly = l.y / 0.19;
        const rings = Math.max(ring(ly, 0.04), ring(ly, -0.5));
        const top = 1 - 0.6 * THREE.MathUtils.smoothstep(ly, 0.1, 0.55);
        return (1 - 0.42 * rings) * top;
      },
    }),
  );
  body.push(
    part(new THREE.SphereGeometry(0.1945, seg(22, 10), seg(6, 3), 0, Math.PI * 2, 0, Math.PI * 0.34), {
      m: abM,
      bone: B.abdomen,
      color: shell,
    }),
  );

  /* ── arms and legs: tiny capsules with mitten hands and feet ── */
  const limbAt = (from: V3, dir: THREE.Vector3, len: number, r: number, boneI: number, tip: V3) => {
    const d = dir.clone().normalize();
    const out = [
      part(new THREE.CapsuleGeometry(r, len, 3, seg(7, 5)), {
        m: chain(T(...from), aimY(d.clone().negate()), T(0, -(len / 2 + r * 0.5), 0)),
        bone: boneI,
        color: limb,
      }),
    ];
    const end = v(...from).addScaledVector(d, len + r * 1.6);
    out.push(part(new THREE.SphereGeometry(r * 1.55, seg(10, 6), seg(8, 5)), { m: chain(T(end.x, end.y, end.z), Sc(...tip)), bone: boneI, color: limb }));
    return out;
  };
  if (!lod) for (const g of limbAt(restOf("armL"), v(0.35, -0.8, 0.48), 0.1, 0.02, B.armL, [1, 1, 1])) body.push(g, mirror(g, toRight));
  for (const g of limbAt(restOf("legL"), v(0.12, -0.95, 0.28), 0.1, 0.021, B.legL, [1, 0.8, 1.35])) body.push(g, mirror(g, toRight));

  /* ── antennae: a curved stalk on two bones, a lit bead at the tip ── */
  const a0 = v(...restOf("antL1"));
  const a1 = v(...restOf("antL2"));
  const a2 = v(0.245, 0.665, 0.16);
  const curve = new THREE.CatmullRomCurve3([a0.clone().add(v(-0.01, -0.03, 0)), a0, a1, a2]);
  const stalk = part(new THREE.TubeGeometry(curve, seg(12, 5), 0.0105, seg(6, 4)), {
    bone: (p) => [B.antL1, B.antL2, THREE.MathUtils.smoothstep(p.y, a0.y + 0.04, a1.y + 0.03)],
    color: limb,
  });
  body.push(stalk, mirror(stalk, toRight));
  const bead = part(new THREE.SphereGeometry(0.036, seg(12, 6), seg(9, 5)), { m: T(a2.x, a2.y, a2.z), bone: B.antL2, color: one, emit: 0.85 });
  glow.push(bead, mirror(bead, toRight));

  /* ── wings: two pairs, flat and veined ── */
  const front = part(wingShape(0.46, 0.21), { m: wingMatrix(restOf("wingL"), v(0.78, 0.5, -0.38), v(-0.15, 0.25, 0.95)), bone: B.wingL, color: one });
  wing.push(front, mirror(front, toRight));
  if (!lod) {
    const hind = part(wingShape(0.33, 0.17), { m: wingMatrix(restOf("wingL2"), v(0.82, 0.06, -0.42), v(-0.1, 0.3, 0.95)), bone: B.wingL2, color: one });
    wing.push(hind, mirror(hind, toRight));
  }

  const merge = (list: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(list, false);
    if (!g) throw new Error("firefly stand-in: geometry merge failed");
    list.forEach((x) => x.dispose());
    return g;
  };
  return { body: merge(body), eye: merge(eye), glow: merge(glow), wing: merge(wing) };
}

/* ───────────────────────────────────────────────────────────── clips ── */

type Pose = { rot?: V3; pos?: V3; scale?: number };
type Track = { fps: number; fn: (t: number) => Pose };

const TAU = Math.PI * 2;
const sn = (t: number, hz: number, phase = 0) => Math.sin(TAU * hz * t + phase);
const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** 0 at `a`, 1 at `p`, 0 again at `b`, smooth on both sides. */
const bump = (a: number, p: number, b: number, x: number) => (x <= p ? ss(a, p, x) : 1 - ss(p, b, x));

function bake(name: string, duration: number, tracks: Record<string, Track>, has: (bone: string) => boolean): THREE.AnimationClip {
  const out: THREE.KeyframeTrack[] = [];
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  for (const [bone, { fps, fn }] of Object.entries(tracks)) {
    if (!has(bone)) continue;
    const n = Math.max(2, Math.round(duration * fps) + 1);
    const times = new Float32Array(n);
    const rot: number[] = [];
    const pos: number[] = [];
    const scl: number[] = [];
    const rest = restLocal(bone);
    const first = fn(0);
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * duration;
      times[i] = t;
      const p = fn(t);
      if (first.rot) {
        const r = p.rot ?? [0, 0, 0];
        q.setFromEuler(e.set(r[0], r[1], r[2], "XYZ"));
        rot.push(q.x, q.y, q.z, q.w);
      }
      if (first.pos) {
        const d = p.pos ?? [0, 0, 0];
        pos.push(rest[0] + d[0], rest[1] + d[1], rest[2] + d[2]);
      }
      if (first.scale !== undefined) {
        const s = p.scale ?? 1;
        scl.push(s, s, s);
      }
    }
    if (rot.length) out.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, rot));
    if (pos.length) out.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, pos));
    if (scl.length) out.push(new THREE.VectorKeyframeTrack(`${bone}.scale`, times, scl));
  }
  return new THREE.AnimationClip(name, duration, out);
}

function restLocal(bone: string): V3 {
  const [, parent, p] = BONES[BONE_INDEX[bone]];
  if (!parent) return p;
  const q = restOf(parent);
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}

/** Wing beat: a sweep about the body's upright axis, with a lift a quarter turn behind (a figure of eight). */
const wings = (hz: number, sweep: number, lift: number, grow: (t: number) => number = () => 1): Record<string, Track> => {
  const w = (sign: number, lag: number, k: number): Track => ({
    fps: 60,
    fn: (t) => ({ rot: [0, sign * sweep * k * grow(t) * sn(t, hz, -lag), sign * (0.1 + lift * k * grow(t) * sn(t, hz, Math.PI / 2 - lag))] }),
  });
  return { wingL: w(1, 0, 1), wingR: w(-1, 0, 1), wingL2: w(1, 0.5, 0.82), wingR2: w(-1, 0.5, 0.82) };
};

function buildClips(has: (bone: string) => boolean): THREE.AnimationClip[] {
  const fly = bake(
    "fly",
    1,
    {
      ...wings(10, 0.62, 0.22),
      body: { fps: 30, fn: (t) => ({ rot: [0.05 * sn(t, 2), 0, 0], pos: [0, 0.006 * sn(t, 10, 1.2), 0] }) },
      head: { fps: 30, fn: (t) => ({ rot: [-0.1 + 0.03 * sn(t, 2, 0.5), 0, 0.02 * sn(t, 1)] }) },
      abdomen: { fps: 30, fn: (t) => ({ rot: [0.22 + 0.07 * sn(t, 2, 1), 0, 0.05 * sn(t, 1)] }) },
      legL: { fps: 30, fn: (t) => ({ rot: [0.55 + 0.08 * sn(t, 3), 0, -0.06] }) },
      legR: { fps: 30, fn: (t) => ({ rot: [0.55 + 0.08 * sn(t, 3, 1.7), 0, 0.06] }) },
      armL: { fps: 30, fn: (t) => ({ rot: [0.35 + 0.05 * sn(t, 3, 0.4), 0, 0.1] }) },
      armR: { fps: 30, fn: (t) => ({ rot: [0.35 + 0.05 * sn(t, 3, 2.1), 0, -0.1] }) },
      antL1: { fps: 30, fn: (t) => ({ rot: [-0.3 + 0.05 * sn(t, 3), 0, 0.03 * sn(t, 2)] }) },
      antL2: { fps: 30, fn: (t) => ({ rot: [-0.26 + 0.08 * sn(t, 3, 1), 0, 0] }) },
      antR1: { fps: 30, fn: (t) => ({ rot: [-0.3 + 0.05 * sn(t, 3, 0.6), 0, -0.03 * sn(t, 2)] }) },
      antR2: { fps: 30, fn: (t) => ({ rot: [-0.26 + 0.08 * sn(t, 3, 1.6), 0, 0] }) },
    },
    has,
  );

  const hover = bake(
    "hover",
    2,
    {
      ...wings(8, 0.5, 0.2),
      root: { fps: 30, fn: (t) => ({ pos: [0, 0.012 * sn(t, 1), 0] }) },
      body: { fps: 30, fn: (t) => ({ rot: [0.03 * sn(t, 0.5), 0, 0.02 * sn(t, 0.5, 1)] }) },
      head: { fps: 30, fn: (t) => ({ rot: [0.02 * sn(t, 0.5, 0.3), 0.04 * sn(t, 0.5), 0.05 * sn(t, 0.5, 1.2)] }) },
      abdomen: { fps: 30, fn: (t) => ({ rot: [0.08 + 0.1 * sn(t, 1), 0, 0.06 * sn(t, 0.5)] }) },
      legL: { fps: 30, fn: (t) => ({ rot: [0.15 + 0.18 * sn(t, 1), 0, -0.05] }) },
      legR: { fps: 30, fn: (t) => ({ rot: [0.15 + 0.18 * sn(t, 1, Math.PI), 0, 0.05] }) },
      armL: { fps: 30, fn: (t) => ({ rot: [0.1 + 0.08 * sn(t, 1, 0.6), 0, 0.12 + 0.06 * sn(t, 0.5)] }) },
      armR: { fps: 30, fn: (t) => ({ rot: [0.1 + 0.08 * sn(t, 1, 2.2), 0, -0.12 - 0.06 * sn(t, 0.5, 0.8)] }) },
      antL1: { fps: 30, fn: (t) => ({ rot: [0.05 * sn(t, 1), 0, 0.06 * sn(t, 0.5)] }) },
      antL2: { fps: 30, fn: (t) => ({ rot: [0.1 * sn(t, 1, 0.8), 0, 0.08 * sn(t, 0.5, 0.6)] }) },
      antR1: { fps: 30, fn: (t) => ({ rot: [0.05 * sn(t, 1, 0.5), 0, 0.06 * sn(t, 0.5, 0.4)] }) },
      antR2: { fps: 30, fn: (t) => ({ rot: [0.1 * sn(t, 1, 1.3), 0, 0.08 * sn(t, 0.5, 1)] }) },
    },
    has,
  );

  // "Oh, hello": a small duck, a pop upward, the head tips to one side, eyes widen, antennae
  // spring up, one arm waves. It ends in a pose the hover loop can take over from.
  const D = 1.1;
  const up = (t: number) => ss(0.28, 0.48, t) * (1 - ss(0.88, 1.08, t));
  const notice = bake(
    "notice",
    D,
    {
      ...wings(9, 0.5, 0.2, (t) => 1 + 0.4 * bump(0.2, 0.42, 0.75, t)),
      root: { fps: 60, fn: (t) => ({ pos: [0, -0.035 * bump(0, 0.16, 0.3, t) + 0.085 * bump(0.24, 0.44, 0.86, t), 0] }) },
      body: { fps: 30, fn: (t) => ({ rot: [0.05 * bump(0, 0.16, 0.3, t) - 0.07 * bump(0.26, 0.45, 0.95, t), 0, 0] }) },
      head: {
        fps: 60,
        fn: (t) => ({
          rot: [0.14 * bump(0, 0.16, 0.3, t) - 0.15 * bump(0.26, 0.46, 0.9, t) - 0.05 * ss(0.3, 0.9, t), 0, 0.13 * ss(0.34, 0.62, t) + 0.05 * bump(0.5, 0.66, 0.95, t)],
        }),
      },
      eyeL: { fps: 30, fn: (t) => ({ scale: 1 + 0.17 * bump(0.24, 0.42, 0.9, t) + 0.07 * ss(0.3, 0.6, t) }) },
      eyeR: { fps: 30, fn: (t) => ({ scale: 1 + 0.17 * bump(0.24, 0.42, 0.9, t) + 0.07 * ss(0.3, 0.6, t) }) },
      lidL: { fps: 30, fn: (t) => ({ rot: [-0.2 * bump(0.24, 0.44, 1.0, t) - 0.1 * ss(0.3, 0.7, t), 0, 0] }) },
      lidR: { fps: 30, fn: (t) => ({ rot: [-0.2 * bump(0.24, 0.44, 1.0, t) - 0.1 * ss(0.3, 0.7, t), 0, 0] }) },
      abdomen: { fps: 30, fn: (t) => ({ rot: [0.08 + 0.22 * bump(0.26, 0.42, 0.85, t), 0, 0] }) },
      legL: { fps: 30, fn: (t) => ({ rot: [0.15 - 0.32 * bump(0.26, 0.42, 0.75, t), 0, -0.05] }) },
      legR: { fps: 30, fn: (t) => ({ rot: [0.15 - 0.24 * bump(0.3, 0.46, 0.8, t), 0, 0.05] }) },
      armL: { fps: 30, fn: (t) => ({ rot: [0.1, 0, 0.12 + 0.3 * up(t)] }) },
      armR: { fps: 60, fn: (t) => ({ rot: [0.1 - 0.25 * up(t), 0, -0.12 - (1.95 + 0.26 * sn(t, 4.5)) * up(t)] }) },
      antL1: { fps: 30, fn: (t) => ({ rot: [-0.1 * bump(0, 0.16, 0.3, t) + 0.2 * bump(0.26, 0.42, 0.8, t) + 0.1 * ss(0.4, 0.9, t), 0, 0] }) },
      antL2: { fps: 60, fn: (t) => ({ rot: [0.34 * bump(0.28, 0.46, 0.72, t) - 0.12 * bump(0.6, 0.74, 0.98, t) + 0.1 * ss(0.4, 0.9, t), 0, 0] }) },
      antR1: { fps: 30, fn: (t) => ({ rot: [-0.1 * bump(0, 0.16, 0.3, t) + 0.2 * bump(0.27, 0.43, 0.8, t) + 0.1 * ss(0.4, 0.9, t), 0, 0] }) },
      antR2: { fps: 60, fn: (t) => ({ rot: [0.34 * bump(0.3, 0.48, 0.74, t) - 0.12 * bump(0.62, 0.76, 1.0, t) + 0.1 * ss(0.4, 0.9, t), 0, 0] }) },
    },
    has,
  );

  const shut = THREE.MathUtils.degToRad(104);
  const blinkFn = (t: number): Pose => ({ rot: [shut * Math.min(1, 1.25 * bump(0, 0.1, 0.24, t)), 0, 0] });
  const blink = bake("blink", 0.24, { lidL: { fps: 60, fn: blinkFn }, lidR: { fps: 60, fn: blinkFn } }, has);

  return [fly, hover, notice, blink];
}

/* ───────────────────────────────────────────────────────────── asset ── */

/**
 * Build the stand-in. `lod: true` is the far model: fewer segments, no lids, arms, hind wings or
 * smile, the same skeleton and clip names.
 */
export function buildStandin(colors: FfColors, lod = false): FireflyAsset {
  const geo = buildGeometry(colors, lod);

  const bones = BONES.map(([name]) => {
    const b = new THREE.Bone();
    b.name = name;
    return b;
  });
  BONES.forEach(([name, parent], i) => {
    const l = restLocal(name);
    bones[i].position.set(l[0], l[1], l[2]);
    if (parent) bones[BONE_INDEX[parent]].add(bones[i]);
  });
  const scene = new THREE.Group();
  scene.name = lod ? "firefly-lod" : "firefly";
  scene.add(bones[0]);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const lantern = lin(colors.lantern);
  const materials: Record<keyof typeof geo, THREE.Material> = {
    body: new THREE.MeshPhysicalMaterial({ name: "body", vertexColors: true, roughness: 0.74, metalness: 0, sheen: lod ? 0 : 0.7, sheenRoughness: 0.55, sheenColor: lin(colors.skin).lerp(new THREE.Color(1, 1, 1), 0.4) }),
    eye: new THREE.MeshPhysicalMaterial({ name: "eye", vertexColors: true, roughness: 0.07, metalness: 0, clearcoat: lod ? 0 : 1, clearcoatRoughness: 0.04, emissive: lin(colors.eyeWhite), emissiveIntensity: 1.5, envMapIntensity: 1.5 }),
    glow: new THREE.MeshStandardMaterial({ name: "glow", color: lantern.clone().multiplyScalar(0.55), emissive: lantern, emissiveIntensity: 2.4, roughness: 0.45, metalness: 0 }),
    wing: new THREE.MeshPhysicalMaterial({ name: "wing", color: lin(colors.wing), map: wingTexture(), transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, roughness: 0.28, metalness: 0 }),
  };

  (Object.keys(geo) as (keyof typeof geo)[]).forEach((key) => {
    const mesh = new THREE.SkinnedMesh(geo[key], materials[key]);
    mesh.name = key;
    mesh.bind(skeleton, new THREE.Matrix4());
    scene.add(mesh);
  });

  const lodBones = new Set(["root", "body", "head", "abdomen", "wingL", "wingR", "legL", "legR", "antL1", "antL2", "antR1", "antR2", "eyeL", "eyeR"]);
  const animations = buildClips((bone) => !lod || lodBones.has(bone));
  return { scene, animations, source: "standin" };
}
