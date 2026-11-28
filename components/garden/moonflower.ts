/**
 * THE MOONFLOWER — a garden flower in real 3D (step 1 of the garden: the Product Designer flower).
 *
 * A moonflower really does this: at dusk its bud, a tight twisted spindle, untwists in about a
 * minute into a wide white disc of five fused petals, with a five-pointed star of creases. Here
 * one number drives it all, `open`, 0..1:
 *
 *   0     bud      a twisted spindle, petals wrapped round each other, sepals hugging it
 *   0.5   half     a trumpet, flaring
 *   1     bloom    a wide, slightly cupped disc; the star creases; the heart lit; pollen rising
 *
 * The petals are one mesh rebuilt on the CPU when `open` changes (5 x 22 x 12 vertices: cheap for
 * the dozen flowers in the garden). Their material is the "glass X-ray" look in the Night Desk
 * palette: see-through, veins that catch the light, a rim that shifts from dusk blue to lamp at
 * grazing angles, and a lamp-coloured heart whose glow spreads out along the petals as it opens.
 *
 * Plain Three: the caller passes the THREE namespace (lib/gl loads it on demand) and the colours
 * (theme tokens via lib/theme readWorld). No literals.
 */

import type * as THREE_NS from "three";

type Three = typeof THREE_NS;
type V3 = readonly [number, number, number];

export type FlowerColors = { petal: V3; rim: V3; lamp: V3; heart: V3; stem: V3 };

export type FlowerRig = {
  group: THREE_NS.Group;
  /** 0 bud .. 0.5 half .. 1 full bloom. */
  setOpen: (o: number) => void;
  /** Lumi's light on it, 0..1: the rim and veins catch more. */
  setLit: (k: number) => void;
  /** Per frame: sway, pollen. */
  update: (t: number, dt: number) => void;
  dispose: () => void;
};

const SEG = 5;
const NU = 22; // base -> edge
const NV = 12; // across a petal
const R = 1;

const petalVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const petalFrag = /* glsl */ `
  uniform vec3 uPetal;
  uniform vec3 uRim;
  uniform vec3 uLamp;
  uniform vec3 uHeart;
  uniform float uOpen;
  uniform float uLit;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float u = vUv.x;            // 0 at the heart, 1 at the edge
    float v = vUv.y;            // 0..1 across one petal; 0.5 is its star crease
    float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.0);
    // veins: fine lines fanning out from the heart, and the crease brighter than the rest
    float lines = 1.0 - smoothstep(0.0, 0.035, abs(fract(v * 6.0 + 0.5) - 0.5));
    float crease = 1.0 - smoothstep(0.0, 0.045, abs(v - 0.5));
    float vein = max(lines * 0.45, crease) * smoothstep(0.02, 0.25, u);
    // light: a soft key from above front, plus light through the petal from behind
    vec3 L = normalize(vec3(0.3, 0.8, 0.5));
    float key = 0.5 + 0.5 * dot(n, L);
    float through = pow(max(0.0, dot(-n, L)), 1.5);
    vec3 col = mix(uPetal, uRim, 0.18 * (1.0 - f) * u) * (0.16 + 0.32 * key + 0.42 * through);
    // the rim shifts from dusk blue to lamp with the angle and along the petal (the iridescence)
    vec3 rim = mix(uRim, uLamp, 0.5 + 0.5 * sin(f * 5.0 + u * 3.0 + v * 2.0));
    col += rim * f * (1.1 + 0.9 * uLit);
    col += mix(uPetal, uLamp, 0.35) * vein * (0.32 + 0.35 * uLit) * (0.3 + u);
    // the heart's glow spreads out along the petals as the flower opens
    float heart = pow(1.0 - u, 3.0) * uOpen;
    col += uHeart * heart * 0.9;
    float a = mix(0.2, 0.86, f) + vein * 0.16 + heart * 0.28;
    a *= smoothstep(0.0, 0.03, 1.0 - u + 0.02);
    gl_FragColor = vec4(min(col, vec3(1.0)) * a, a);
  }
`;

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function buildMoonflower(THREE: Three, C: FlowerColors): FlowerRig {
  const group = new THREE.Group();
  const head = new THREE.Group(); // the flower itself, tilted toward the viewer
  group.add(head);
  const disposables: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  /* ── petals: one mesh, five fused segments ── */
  const count = SEG * NU * NV;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const idx: number[] = [];
  for (let s = 0; s < SEG; s++)
    for (let i = 0; i < NU; i++)
      for (let j = 0; j < NV; j++) {
        const k = (s * NU + i) * NV + j;
        uv[k * 2] = i / (NU - 1);
        uv[k * 2 + 1] = j / (NV - 1);
        if (i < NU - 1 && j < NV - 1) {
          const a = k;
          const b = k + NV;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
  const geo = own(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);

  const v3 = (c: V3) => new THREE.Vector3(c[0], c[1], c[2]);
  // Theme colours are sRGB; lit materials work in linear, so convert (the petal shader outputs sRGB as is).
  const srgb = (c: V3) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const petalMat = own(
    new THREE.ShaderMaterial({
      vertexShader: petalVert,
      fragmentShader: petalFrag,
      uniforms: {
        uPetal: { value: v3(C.petal) },
        uRim: { value: v3(C.rim) },
        uLamp: { value: v3(C.lamp) },
        uHeart: { value: v3(C.heart) },
        uOpen: { value: 0 },
        uLit: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }),
  );
  const petals = new THREE.Mesh(geo, petalMat);
  petals.frustumCulled = false;
  head.add(petals);

  /** One vertex of the petals at openness `o` (bud -> trumpet -> disc, as a quadratic blend). */
  const shape = (s: number, u: number, v: number, o: number, out: THREE_NS.Vector3) => {
    const seg = (s / SEG) * Math.PI * 2;
    const d = (Math.PI * 2) / SEG;
    const w = v - 0.5;
    // bud: a twisted spindle; each petal wraps a little past its neighbour, a hair further out
    const tw = 1.7 * u;
    const rb = R * (0.19 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.85) + 0.04 * (1 - u)) + 0.006 * s;
    const ab = seg + w * d * 1.4 + tw;
    const bud = [rb * Math.cos(ab), R * 1.2 * u, rb * Math.sin(ab)];
    // trumpet: flaring from the throat, edges starting to curl out
    const rt = R * (0.1 + 0.5 * Math.pow(u, 1.7));
    const at = seg + w * d * 1.02 + 0.35 * u;
    const tr = [rt * Math.cos(at), R * (0.7 * u - 0.06 * u * u), rt * Math.sin(at)];
    // disc: wide, a shallow bowl, the star crease raised, the edge scalloped between petals
    const scallop = 1 - 0.16 * Math.pow(Math.abs(2 * w), 2.4);
    const rd = R * (0.06 + 0.94 * u) * scallop;
    const ad = seg + w * d * 1.02;
    const crease = 0.05 * u * (1 - Math.abs(2 * w));
    const ruffle = 0.05 * Math.pow(u, 3) * Math.sin(w * Math.PI * 4 + s * 1.7);
    const ds = [rd * Math.cos(ad), R * (0.22 * u * u + 0.1 * u) + crease + ruffle, rd * Math.sin(ad)];
    // stagger: the edges catch up after the throat (it opens from the inside out)
    const ol = clamp01((o - 0.12 * (1 - u)) / 0.88);
    const t = ease(ol);
    const res = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const a = bud[c] + (tr[c] - bud[c]) * t;
      const b = tr[c] + (ds[c] - tr[c]) * t;
      res[c] = a + (b - a) * t;
    }
    out.set(res[0], res[1], res[2]);
  };

  const tmp = new THREE.Vector3();
  let builtFor = -1;
  const rebuild = (o: number) => {
    if (Math.abs(o - builtFor) < 0.0005) return;
    builtFor = o;
    for (let s = 0; s < SEG; s++)
      for (let i = 0; i < NU; i++)
        for (let j = 0; j < NV; j++) {
          const k = (s * NU + i) * NV + j;
          shape(s, i / (NU - 1), j / (NV - 1), o, tmp);
          pos[k * 3] = tmp.x;
          pos[k * 3 + 1] = tmp.y;
          pos[k * 3 + 2] = tmp.z;
        }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };

  /* ── the heart: a small lamp in the throat, and its halo ── */
  const heartMat = own(new THREE.MeshBasicMaterial({ color: srgb(C.heart), transparent: true }));
  const heart = new THREE.Mesh(own(new THREE.SphereGeometry(0.05, 16, 12)), heartMat);
  heart.position.y = 0.06;
  head.add(heart);
  const haloTex = own(radialTexture(THREE));
  const haloMat = own(new THREE.SpriteMaterial({ map: haloTex, color: srgb(C.lamp), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(0.9);
  halo.position.y = 0.12;
  head.add(halo);

  /* ── the throat's tube, sepals, stem and a heart-shaped leaf ── */
  const green = own(new THREE.MeshStandardMaterial({ color: srgb(C.stem), roughness: 0.6, metalness: 0 }));
  const tubeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, -0.25, 0), new THREE.Vector3(0, -0.55, 0)]);
  const tubeMat = own(new THREE.MeshStandardMaterial({ color: srgb(C.petal).lerp(srgb(C.stem), 0.7), roughness: 0.55 }));
  const tube = new THREE.Mesh(own(new THREE.TubeGeometry(tubeCurve, 12, 0.04, 10, false)), tubeMat);
  head.add(tube);
  // Sepals: five green blades at the base of the petals. Each hangs on a pivot turned to its place
  // round the bud; tilting the blade about its pivot's x swings it out (hug -> folded back).
  const sepals: THREE_NS.Mesh[] = [];
  const sepalGeo = own(leafGeometry(THREE, 0.1, 0.36));
  for (let s = 0; s < SEG; s++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (s / SEG) * Math.PI * 2 + 0.3;
    const m = new THREE.Mesh(sepalGeo, green);
    m.position.z = 0.05;
    pivot.add(m);
    head.add(pivot);
    sepals.push(m);
  }
  head.position.y = 0.55;
  head.rotation.x = 0.55; // face the viewer a little

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, -0.15),
    new THREE.Vector3(0.06, -0.8, -0.05),
    new THREE.Vector3(-0.05, -1.7, 0),
    new THREE.Vector3(0.02, -2.6, 0),
  ]);
  const stem = new THREE.Mesh(own(new THREE.TubeGeometry(stemCurve, 24, 0.035, 8, false)), green);
  group.add(stem);
  const leaf = new THREE.Mesh(own(leafGeometry(THREE, 0.32, 0.62, true)), green);
  leaf.position.set(0.04, -1.5, 0);
  leaf.rotation.set(0.4, 0.6, -1.0);
  group.add(leaf);

  /* ── pollen: a few motes rising from the heart once it is open ── */
  const MOTES = 18;
  const motePos = new Float32Array(MOTES * 3);
  const moteSeed = Array.from({ length: MOTES }, (_, i) => ((i * 0.6180339) % 1) + 0.0001);
  const moteGeo = own(new THREE.BufferGeometry());
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3).setUsage(THREE.DynamicDrawUsage));
  const moteMat = own(new THREE.PointsMaterial({ map: haloTex, color: srgb(C.lamp), size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  head.add(motes);

  let open = 0;
  let lit = 0;
  const apply = () => {
    rebuild(open);
    const u = petalMat.uniforms;
    u.uOpen.value = ease(clamp01((open - 0.35) / 0.65));
    u.uLit.value = lit;
    const glow = ease(clamp01((open - 0.4) / 0.6));
    heartMat.opacity = glow;
    haloMat.opacity = glow * (0.55 + 0.35 * lit);
    halo.scale.setScalar(0.5 + 0.8 * glow);
    // sepals hug the bud, then fold back as it opens
    sepals.forEach((m) => (m.rotation.x = 0.12 + 2.1 * ease(clamp01(open / 0.6))));
  };
  apply();

  return {
    group,
    setOpen(o) {
      open = clamp01(o);
      apply();
    },
    setLit(k) {
      lit = clamp01(k);
      apply();
    },
    update(t) {
      head.rotation.z = Math.sin(t * 0.7) * 0.03;
      head.rotation.y = Math.sin(t * 0.45) * 0.06;
      const show = ease(clamp01((open - 0.85) / 0.15));
      moteMat.opacity = 0.9 * show;
      for (let i = 0; i < MOTES; i++) {
        const s = moteSeed[i];
        const life = (t * (0.12 + 0.1 * s) + s) % 1;
        const a = s * 40 + t * 0.3;
        const r = 0.05 + life * (0.25 + 0.2 * s);
        motePos[i * 3] = Math.cos(a) * r;
        motePos[i * 3 + 1] = 0.12 + life * (0.9 + 0.5 * s);
        motePos[i * 3 + 2] = Math.sin(a) * r;
      }
      moteGeo.attributes.position.needsUpdate = true;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** A soft round sprite for the halo and the pollen. */
function radialTexture(THREE: Three) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "white");
  grad.addColorStop(0.35, "rgb(255 255 255 / 0.45)"); // token-ok: a white alpha ramp for a sprite mask, tinted by the theme colour
  grad.addColorStop(1, "rgb(255 255 255 / 0)"); // token-ok: the same mask ramp
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** A leaf or sepal: a pointed blade along -Y (sepal) or a heart-shaped leaf. */
function leafGeometry(THREE: Three, w: number, h: number, heart = false) {
  const s = new THREE.Shape();
  if (heart) {
    s.moveTo(0, 0);
    s.bezierCurveTo(-w * 0.2, h * 0.15, -w * 1.1, h * 0.25, -w * 0.9, h * 0.62);
    s.bezierCurveTo(-w * 0.7, h * 0.95, -w * 0.1, h * 0.9, 0, h * 0.78);
    s.bezierCurveTo(w * 0.1, h * 0.9, w * 0.7, h * 0.95, w * 0.9, h * 0.62);
    s.bezierCurveTo(w * 1.1, h * 0.25, w * 0.2, h * 0.15, 0, 0);
  } else {
    s.moveTo(-w * 0.5, 0);
    s.quadraticCurveTo(-w * 0.6, h * 0.5, 0, h);
    s.quadraticCurveTo(w * 0.6, h * 0.5, w * 0.5, 0);
    s.lineTo(-w * 0.5, 0);
  }
  return new THREE.ShapeGeometry(s, 10);
}
