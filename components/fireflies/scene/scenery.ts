/**
 * THE SCENERY — the painted meadow as a place the camera can move through.
 *
 *   Backdrop   meadow-night on a far plane. In the wide shot it is laid out exactly as the page's
 *              own cover box, with the page's highlight knee and local hush (Scenes.tsx), so the
 *              3D scene can take over from the DOM painting, and hand back to it, without a cut.
 *              It is extended sideways by mirroring and upwards into flat sky, so a pan never
 *              shows an edge. Focus is faked the cheap way: the painting is pre-blurred into a few
 *              small copies once, and the shader cross-fades to them as the lens opens.
 *   Grass      grass-fg on a near plane, at the page's own position and night grade. The camera
 *              pushes through it; the lantern of the chosen firefly lights the blades it is near.
 *   Mist       three low, slow sheets of haze between the layers of fireflies. They catch the
 *              chosen firefly's light, which is what makes its glow read as light in air.
 *   Glows      every firefly's halo and the far "sprite" fireflies: instanced quads. Out of focus
 *              they open into soft discs sized by the same thin-lens rule as the backdrop's blur.
 *
 * Every colour arrives as a uniform from the theme (tokens.ts).
 */

import * as THREE from "three";
import { mistTile } from "./noise";

/** Camera-space depths of the layers in the wide shot (the wide camera sits at the origin, looking down -Z). */
export const DEPTH = { grass: 5, backdrop: 110, mist: [34, 58, 86] as const };

export type Layout = {
  /** Host size in CSS px. */
  vw: number;
  vh: number;
  /** Wide-shot vertical field of view, degrees. */
  fov: number;
  /** The meadow painting: aspect, and the scale over its cover box (the page's slow push). */
  meadowAr: number;
  meadowScale: number;
  /** The grass painting: aspect, and how far down it sits as a fraction of the height (GRASS_LOW). */
  grassAr: number;
  grassLow: number;
};

/** World units per CSS px at camera-space depth `d` in the wide shot. */
export const unitsPerPx = (l: Layout, d: number) => (2 * d * Math.tan(THREE.MathUtils.degToRad(l.fov) / 2)) / l.vh;

const SRGB_GLSL = /* glsl */ `
vec3 ffToSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 ffToLinear(vec3 c) { return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
`;

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** One direction of a 9-tap Gaussian. `uDir` is the step in UV. Works on whatever the source holds. */
const BLUR_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uTex, vUv) * 0.2270270270;
  c += (texture2D(uTex, vUv + uDir * 1.3846153846) + texture2D(uTex, vUv - uDir * 1.3846153846)) * 0.3162162162;
  c += (texture2D(uTex, vUv + uDir * 3.2307692308) + texture2D(uTex, vUv - uDir * 3.2307692308)) * 0.0702702703;
  gl_FragColor = c;
}
`;

/** Runs full-screen passes into render targets (used once, at load, for the pre-blurred copies). */
export class Blitter {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private blur: THREE.ShaderMaterial;
  constructor(private renderer: THREE.WebGLRenderer) {
    this.blur = new THREE.ShaderMaterial({ uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }
  /** `levels` Gaussian-blurred copies of `source`, each half the size of the one before. */
  pyramid(source: THREE.Texture, width: number, height: number, levels: number, opts: { type: THREE.TextureDataType; spread: number; wrapS: THREE.Wrapping }): THREE.WebGLRenderTarget[] {
    const out: THREE.WebGLRenderTarget[] = [];
    let from = source;
    let w = width;
    let h = height;
    const prev = this.renderer.getRenderTarget();
    for (let i = 0; i < levels; i++) {
      w = Math.max(8, Math.round(w / 2));
      h = Math.max(8, Math.round(h / 2));
      const make = () => {
        const rt = new THREE.WebGLRenderTarget(w, h, { type: opts.type, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
        rt.texture.wrapS = opts.wrapS;
        rt.texture.wrapT = THREE.ClampToEdgeWrapping;
        return rt;
      };
      const a = make();
      const b = make();
      this.blur.uniforms.uTex.value = from;
      this.blur.uniforms.uDir.value.set(opts.spread / w, 0);
      this.renderer.setRenderTarget(a);
      this.renderer.render(this.scene, this.camera);
      this.blur.uniforms.uTex.value = a.texture;
      this.blur.uniforms.uDir.value.set(0, opts.spread / h);
      this.renderer.setRenderTarget(b);
      this.renderer.render(this.scene, this.camera);
      a.dispose();
      out.push(b);
      from = b.texture;
    }
    this.renderer.setRenderTarget(prev);
    return out;
  }
  dispose() {
    this.quad.geometry.dispose();
    this.blur.dispose();
  }
}

/** Cross-fade weights for [sharp, blur 1, blur 2, ...] at a continuous blur level. */
export function blurWeights(level: number, out: number[]) {
  const n = out.length;
  const l = Math.min(n - 1, Math.max(0, level));
  for (let i = 0; i < n; i++) out[i] = Math.max(0, 1 - Math.abs(l - i));
}

/* ───────────────────────────────────────────────────────── backdrop ── */

const BACKDROP_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BACKDROP_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform sampler2D uB3;
uniform vec4 uBlurW;
uniform vec3 uNight;
uniform vec3 uSky;
uniform vec3 uMoon;
uniform vec2 uMoonAt;
uniform float uAspect;
uniform float uHush;
uniform float uPresence;
uniform float uDim;
varying vec2 vUv;
${SRGB_GLSL}
// The page's highlight knee (Scenes.tsx, #sc-knee): a transfer table on sRGB values.
float ffKnee(float x) {
  return x < 0.5 ? x : (x < 0.75 ? 0.5 + (x - 0.5) * 0.4 : 0.6 + (x - 0.75) * 0.16);
}
void main() {
  vec2 st = vec2(vUv.x, clamp(vUv.y, 0.003, 0.997));
  vec3 c = vec3(0.0);
  if (uBlurW.x > 0.0) c += uBlurW.x * texture2D(uTex, st).rgb;
  if (uBlurW.y > 0.0) c += uBlurW.y * texture2D(uB1, st).rgb;
  if (uBlurW.z > 0.0) c += uBlurW.z * texture2D(uB2, st).rgb;
  if (uBlurW.w > 0.0) c += uBlurW.w * texture2D(uB3, st).rgb;

  vec3 s = ffToSRGB(clamp(c, 0.0, 1.0));
  s = vec3(ffKnee(s.r), ffKnee(s.g), ffKnee(s.b));
  // The page's local hush (.sc-hush-meadow): radial-gradient(ellipse 70% 42% at 50% 62%, ...).
  vec2 e = (clamp(vUv, 0.0, 1.0) - vec2(0.5, 0.38)) / vec2(0.70, 0.42);
  float r = length(e);
  float a = r < 0.7 ? mix(0.34, 0.18, r / 0.7) : mix(0.18, 0.0, clamp((r - 0.7) / 0.3, 0.0, 1.0));
  s = mix(s, uNight, a * uHush);
  c = ffToLinear(s);

  // Above the painting the sky simply goes on.
  c = mix(c, uSky, smoothstep(0.99, 1.3, vUv.y));

  // The moon, behind thin cloud: a wide veil, a glow, a soft heart.
  vec2 d = (vUv - uMoonAt) * vec2(uAspect, 1.0);
  float rr = dot(d, d);
  float moon = 0.07 * exp(-rr / 0.22) + 0.16 * exp(-rr / 0.018) + 0.75 * exp(-rr / 0.0011);
  c += uMoon * (moon * uPresence);

  gl_FragColor = vec4(c * uDim, 1.0);
}
`;

/* ──────────────────────────────────────────────────────────── grass ── */

const GRASS_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const GRASS_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform vec3 uBlurW;
uniform mat3 uGrade;
uniform float uOpacity;
uniform float uTime;
uniform float uSway;
uniform vec4 uKey;
uniform vec3 uKeyColor;
uniform vec3 uRimColor;
uniform float uPresence;
uniform float uDim;
varying vec2 vUv;
varying vec3 vWorld;
${SRGB_GLSL}
void main() {
  // vUv.y is 1 at the painting's top edge. Blade tips sway a few pixels; the roots do not.
  float tip = smoothstep(0.28, 0.62, vUv.y);
  vec2 st = vec2(vUv.x + uSway * tip * 0.0016 * sin(uTime * 0.55 + vUv.x * 11.0 + vUv.y * 3.0), clamp(vUv.y, 0.002, 0.998));
  vec4 t = vec4(0.0);
  if (uBlurW.x > 0.0) t += uBlurW.x * texture2D(uTex, st);
  if (uBlurW.y > 0.0) t += uBlurW.y * texture2D(uB1, st);
  if (uBlurW.z > 0.0) t += uBlurW.z * texture2D(uB2, st);
  if (t.a < 0.004) discard;
  vec3 day = t.rgb / t.a;
  // The page's night grade on the daylight painting: brightness(.42) saturate(.7) hue-rotate(28deg), in sRGB.
  vec3 lin = ffToLinear(clamp(uGrade * day, 0.0, 1.0));
  // The chosen firefly lights the blades near it, falling off with the square of the distance.
  vec3 toKey = uKey.xyz - vWorld;
  float d2 = dot(toKey, toKey);
  vec3 albedo = ffToLinear(day);
  lin += albedo * uKeyColor * (uKey.w * 0.9 / (1.0 + d2 * 0.22));
  // A breath of moonlight along the tips.
  lin += albedo * uRimColor * (0.05 * tip * uPresence);
  float a = t.a * uOpacity;
  gl_FragColor = vec4(lin * uDim * a, a);
}
`;

/* ───────────────────────────────────────────────────────────── mist ── */

const MIST_VERT = GRASS_VERT;
const MIST_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uColor;
uniform float uAmount;
uniform float uTime;
uniform vec4 uFlow;
uniform vec4 uKey;
uniform vec3 uKeyColor;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  float n1 = texture2D(uNoise, vUv * uFlow.xy + vec2(uTime * uFlow.z, 0.0)).r;
  float n2 = texture2D(uNoise, vUv * uFlow.xy * 2.3 + vec2(-uTime * uFlow.w, uTime * uFlow.w * 0.3)).r;
  float n = smoothstep(0.32, 0.86, n1 * 0.65 + n2 * 0.35);
  // A band: gone at its top, bottom and side edges.
  float band = smoothstep(0.0, 0.38, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y)) * smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
  float a = n * band * uAmount;
  // The chosen firefly's light, scattered by the haze around it.
  vec3 toKey = uKey.xyz - vWorld;
  float glow = uKey.w / (1.0 + dot(toKey, toKey) * 0.06);
  vec3 c = uColor * a + uKeyColor * (glow * band * (0.25 + 0.75 * n) * 0.05);
  gl_FragColor = vec4(c, a);
}
`;

/* ──────────────────────────────────────────────────────────── glows ── */

const GLOW_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aDrift;
attribute vec4 aLook;
attribute vec3 aTint;
uniform float uTime;
uniform vec2 uLens;
uniform vec3 uFog;
uniform float uFocus;
uniform float uLevel;
varying vec2 vUv;
varying vec3 vCol;
varying vec4 vShape;
void main() {
  vec3 p = aPos;
  float pulse = 1.0;
  if (aDrift.x > 0.0) {
    // A far firefly: it wanders and pulses on its own, entirely here.
    float t = uTime * aDrift.y + aDrift.z;
    p += aDrift.x * vec3(sin(t + aDrift.z * 3.1) + 0.5 * sin(t * 2.3 + 1.0), 0.7 * sin(t * 1.3 + 1.7) + 0.3 * sin(t * 3.1 + aDrift.z), cos(t * 0.9 + 2.3));
    float ph = uTime * aLook.z + aLook.w;
    pulse = 0.12 + 0.88 * pow(0.5 + 0.5 * sin(ph), 3.0) * (0.6 + 0.4 * sin(ph * 0.37 + 2.0));
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = max(0.05, -mv.z);
  // Thin lens: the blur disc of a point at this depth, in world units.
  float coc = uLens.y * abs(dist - uLens.x) / max(uLens.x, 0.1);
  float size = aLook.x;
  float halfSize = max(size, coc * 1.12);
  // A halo hangs behind the firefly that makes it, along the view ray: the body stands against it.
  mv.xyz *= 1.0 + aDrift.w / max(length(mv.xyz), 0.05);
  mv.xy += position.xy * 2.0 * halfSize;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0;
  float defocus = smoothstep(0.25, 1.0, coc / max(size, 1e-3));
  // Spread over a disc the same light is dimmer, but never gone.
  float spread = clamp((size * size) / max(coc * coc, 1e-4), 0.05, 1.0);
  float haze = smoothstep(uFog.x, uFog.y, dist) * uFog.z;
  float level = aLook.y * pulse * (1.0 - 0.65 * haze);
  // Far lights step back while the camera is on one firefly, and come up with the scene
  // (the agents' halos are dimmed and raised on the CPU).
  if (aDrift.x > 0.0) level *= (1.0 - 0.3 * uFocus) * uLevel;
  vCol = aTint * level;
  vShape = vec4(size / halfSize, coc * 1.12 / halfSize, defocus, mix(0.35, 1.0, spread));
}
`;

const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
varying vec4 vShape;
uniform float uCore;
void main() {
  float r = length(vUv);
  if (r >= 1.0) discard;
  float rs = r / max(vShape.x, 1e-3);
  // In focus: a tight heart and a wide, thin skirt that reaches zero at the edge.
  float skirt = exp(-rs * rs * 4.5) * (1.0 - smoothstep(0.6, 1.0, rs));
  float heart = exp(-rs * rs * 70.0) * uCore;
  float sharp = skirt * 0.55 + heart * 2.2;
  // Out of focus: a soft disc, a touch brighter at its rim, as a lens draws it.
  float rd = r / max(vShape.y, 1e-3);
  float disc = (1.0 - smoothstep(0.84, 1.0, rd)) * (0.8 + 0.2 * smoothstep(0.5, 0.95, rd)) * vShape.w * 0.5;
  gl_FragColor = vec4(vCol * mix(sharp, disc, vShape.z), 1.0);
}
`;

export type GlowSpec = { count: number; dynamic: boolean; core: number };

/** A batch of glows: one draw call. */
export class Glows {
  readonly mesh: THREE.Mesh;
  readonly pos: THREE.InstancedBufferAttribute;
  readonly drift: THREE.InstancedBufferAttribute;
  readonly look: THREE.InstancedBufferAttribute;
  readonly tint: THREE.InstancedBufferAttribute;
  readonly material: THREE.ShaderMaterial;
  private geometry: THREE.InstancedBufferGeometry;

  constructor(spec: GlowSpec, shared: { uTime: { value: number }; uLens: { value: THREE.Vector2 }; uFog: { value: THREE.Vector3 }; uFocus: { value: number }; uLevel: { value: number } }) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.instanceCount = spec.count;
    const usage = spec.dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(spec.count * 3), 3).setUsage(usage);
    this.drift = new THREE.InstancedBufferAttribute(new Float32Array(spec.count * 4), 4);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(spec.count * 4), 4).setUsage(usage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(spec.count * 3).fill(1), 3);
    g.setAttribute("aPos", this.pos);
    g.setAttribute("aDrift", this.drift);
    g.setAttribute("aLook", this.look);
    g.setAttribute("aTint", this.tint);
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uLens: shared.uLens, uFog: shared.uFog, uFocus: shared.uFocus, uLevel: shared.uLevel, uCore: { value: spec.core } },
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* ──────────────────────────────────────────────────────── the stage ── */

export type SceneryTextures = {
  /** meadow-night, sRGB, mirrored in x. */
  meadow: THREE.Texture;
  /** grass-fg, premultiplied alpha, uploaded as raw values (the page's grade is done in sRGB). */
  grass: THREE.Texture;
};

export type SceneryColors = { night: THREE.Color; sky: THREE.Color; moon: THREE.Color; mist: THREE.Color };

/** CSS filter chain → one matrix on unpremultiplied sRGB: brightness(b) saturate(s) hue-rotate(deg). */
function gradeMatrix(b: number, s: number, deg: number): THREE.Matrix3 {
  const sat = new THREE.Matrix3().set(0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s);
  const a = THREE.MathUtils.degToRad(deg);
  const c = Math.cos(a);
  const n = Math.sin(a);
  const hue = new THREE.Matrix3().set(
    0.213 + c * 0.787 - n * 0.213,
    0.715 - c * 0.715 - n * 0.715,
    0.072 - c * 0.072 + n * 0.928,
    0.213 - c * 0.213 + n * 0.143,
    0.715 + c * 0.285 + n * 0.14,
    0.072 - c * 0.072 - n * 0.283,
    0.213 - c * 0.213 - n * 0.787,
    0.715 - c * 0.715 + n * 0.715,
    0.072 + c * 0.928 + n * 0.072,
  );
  return hue.multiply(sat).multiplyScalar(b);
}

export class Scenery {
  readonly group = new THREE.Group();
  readonly backdrop: THREE.Mesh;
  readonly grass: THREE.Mesh;
  readonly mist: THREE.Mesh[] = [];
  readonly uBackdrop: Record<string, { value: unknown }>;
  readonly uGrass: Record<string, { value: unknown }>;
  readonly uMist: Record<string, { value: unknown }>[] = [];
  private disposables: { dispose: () => void }[] = [];
  private bw = [1, 0, 0, 0];
  private gw = [1, 0, 0];

  constructor(
    renderer: THREE.WebGLRenderer,
    tex: SceneryTextures,
    colors: SceneryColors,
    shared: { uTime: { value: number }; uKey: { value: THREE.Vector4 }; uKeyColor: { value: THREE.Color }; uRimColor: { value: THREE.Color } },
    opts: { hdr: boolean; mistLayers: number },
  ) {
    const blit = new Blitter(renderer);
    const type = opts.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const mImg = tex.meadow.image as { width: number; height: number };
    const gImg = tex.grass.image as { width: number; height: number };
    const mBlur = blit.pyramid(tex.meadow, mImg.width, mImg.height, 3, { type, spread: 1.25, wrapS: THREE.MirroredRepeatWrapping });
    // The grass is far larger than it needs to be once it is out of focus: start its copies two halvings down.
    const gBlur = blit.pyramid(tex.grass, gImg.width / 2, gImg.height / 2, 2, { type: THREE.UnsignedByteType, spread: 1.3, wrapS: THREE.MirroredRepeatWrapping });
    blit.dispose();
    this.disposables.push(...mBlur, ...gBlur);

    /* ── backdrop: UV 0..1 is the painting; the quad reaches one painting to each side, and up ── */
    const bg = new THREE.BufferGeometry();
    const x0 = -1;
    const x1 = 2;
    const y0 = -0.35;
    const y1 = 2.1;
    bg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0 - 0.5, y0 - 0.5, 0, x1 - 0.5, y0 - 0.5, 0, x1 - 0.5, y1 - 0.5, 0, x0 - 0.5, y1 - 0.5, 0]), 3));
    bg.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]), 2));
    bg.setIndex([0, 1, 2, 0, 2, 3]);
    this.uBackdrop = {
      uTex: { value: tex.meadow },
      uB1: { value: mBlur[0].texture },
      uB2: { value: mBlur[1].texture },
      uB3: { value: mBlur[2].texture },
      uBlurW: { value: new THREE.Vector4(1, 0, 0, 0) },
      uNight: { value: colors.night },
      uSky: { value: colors.sky },
      uMoon: { value: colors.moon },
      uMoonAt: { value: new THREE.Vector2(0.2, 0.84) },
      uAspect: { value: mImg.width / mImg.height },
      uHush: { value: 1 },
      uPresence: { value: 1 },
      uDim: { value: 1 },
    };
    const bm = new THREE.ShaderMaterial({ uniforms: this.uBackdrop as never, vertexShader: BACKDROP_VERT, fragmentShader: BACKDROP_FRAG, depthTest: false, depthWrite: false });
    this.backdrop = new THREE.Mesh(bg, bm);
    this.backdrop.renderOrder = -10;
    this.backdrop.frustumCulled = false;
    this.backdrop.position.z = -DEPTH.backdrop;
    this.disposables.push(bg, bm);

    /* ── grass: UV 0..1 is the painting; the quad reaches one painting to each side, and down ── */
    const gg = new THREE.BufferGeometry();
    const gy0 = -0.8;
    gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0 - 0.5, gy0 - 0.5, 0, x1 - 0.5, gy0 - 0.5, 0, x1 - 0.5, 0.5, 0, x0 - 0.5, 0.5, 0]), 3));
    gg.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([x0, gy0, x1, gy0, x1, 1, x0, 1]), 2));
    gg.setIndex([0, 1, 2, 0, 2, 3]);
    this.uGrass = {
      uTex: { value: tex.grass },
      uB1: { value: gBlur[0].texture },
      uB2: { value: gBlur[1].texture },
      uBlurW: { value: new THREE.Vector3(1, 0, 0) },
      uGrade: { value: gradeMatrix(0.42, 0.7, 28) },
      uOpacity: { value: 1 },
      uTime: shared.uTime,
      uSway: { value: 1 },
      uKey: shared.uKey,
      uKeyColor: shared.uKeyColor,
      uRimColor: shared.uRimColor,
      uPresence: { value: 1 },
      uDim: { value: 1 },
    };
    const gm = new THREE.ShaderMaterial({
      uniforms: this.uGrass as never,
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.grass = new THREE.Mesh(gg, gm);
    this.grass.renderOrder = 20;
    this.grass.frustumCulled = false;
    this.grass.position.z = -DEPTH.grass;
    this.disposables.push(gg, gm);

    /* ── mist ── */
    const tile = new THREE.DataTexture(mistTile(128, 91), 128, 128, THREE.RedFormat, THREE.UnsignedByteType);
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
    tile.magFilter = THREE.LinearFilter;
    tile.minFilter = THREE.LinearMipmapLinearFilter;
    tile.generateMipmaps = true;
    tile.needsUpdate = true;
    this.disposables.push(tile);
    const mg = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(mg);
    const flows: [number, number, number, number][] = [
      [1.6, 0.9, 0.006, 0.011],
      [2.2, 1.1, -0.004, 0.008],
      [3.0, 1.3, 0.003, 0.006],
    ];
    for (let i = 0; i < Math.min(opts.mistLayers, DEPTH.mist.length); i++) {
      const u = {
        uNoise: { value: tile },
        uColor: { value: colors.mist },
        uAmount: { value: 0 },
        uTime: shared.uTime,
        uFlow: { value: new THREE.Vector4(...flows[i]) },
        uKey: shared.uKey,
        uKeyColor: shared.uKeyColor,
      };
      const mm = new THREE.ShaderMaterial({
        uniforms: u as never,
        vertexShader: MIST_VERT,
        fragmentShader: MIST_FRAG,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      const mesh = new THREE.Mesh(mg, mm);
      mesh.renderOrder = 3 - i;
      mesh.frustumCulled = false;
      mesh.position.z = -DEPTH.mist[i];
      this.mist.push(mesh);
      this.uMist.push(u);
      this.disposables.push(mm);
    }

    this.group.add(this.backdrop, ...this.mist, this.grass);
  }

  /** Place every layer for the wide shot: pixel for pixel where the page's DOM layers are. */
  layout(l: Layout) {
    // Backdrop: the meadow's cover box, scaled about the middle of the screen.
    const ub = unitsPerPx(l, DEPTH.backdrop);
    const mw = Math.max(l.vw, l.vh * l.meadowAr) * l.meadowScale;
    this.backdrop.scale.set(mw * ub, (mw / l.meadowAr) * ub, 1);
    this.backdrop.position.set(0, 0, -DEPTH.backdrop);
    // Grass: its cover box stood on the bottom edge, then lowered by grassLow of the height.
    const ug = unitsPerPx(l, DEPTH.grass);
    const gw = Math.max(l.vw, l.vh * l.grassAr);
    const gh = gw / l.grassAr;
    const top = l.vh - gh + l.grassLow * l.vh;
    this.grass.scale.set(gw * ug, gh * ug, 1);
    this.grass.position.set(0, -(top + gh / 2 - l.vh / 2) * ug, -DEPTH.grass);
    // Mist: wide bands low in the frame, well past the edges so a pan never finds one.
    const aspect = l.vw / l.vh;
    this.mist.forEach((m, i) => {
      const d = DEPTH.mist[i];
      const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(l.fov) / 2);
      m.scale.set(h * Math.max(aspect, 1) * 3.2, h * (0.62 - i * 0.07), 1);
      m.position.set(0, -h * (0.2 - i * 0.045), -d);
    });
  }

  /**
   * `backdropBlur` and `grassBlur` are continuous blur levels (0 sharp). `presence` 0 is the page's
   * painting exactly; 1 adds the moon, the mist and the sway. `dim` darkens the world behind a close-up.
   */
  update(p: { backdropBlur: number; grassBlur: number; grassOpacity: number; presence: number; dim: number; mist: number }) {
    blurWeights(p.backdropBlur, this.bw);
    (this.uBackdrop.uBlurW.value as THREE.Vector4).set(this.bw[0], this.bw[1], this.bw[2], this.bw[3]);
    blurWeights(p.grassBlur, this.gw);
    (this.uGrass.uBlurW.value as THREE.Vector3).set(this.gw[0], this.gw[1], this.gw[2]);
    this.uBackdrop.uPresence.value = p.presence;
    this.uBackdrop.uDim.value = p.dim;
    this.uGrass.uPresence.value = p.presence;
    this.uGrass.uSway.value = p.presence;
    this.uGrass.uOpacity.value = p.grassOpacity;
    this.uGrass.uDim.value = p.dim;
    this.grass.visible = p.grassOpacity > 0.003;
    this.uMist.forEach((u, i) => (u.uAmount.value = p.mist * p.presence * (0.2 - i * 0.03)));
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.removeFromParent();
  }
}
