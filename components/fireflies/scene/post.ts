/**
 * THE LENS — the scene is drawn into a float target, and finished in one small chain:
 *
 *   bloom      selective by brightness. The painting never exceeds 1.0 (its highlights are kneed
 *              to 0.64), a lantern is several times brighter, so a threshold near 1 blooms only
 *              what is actually lit. A dual-filter chain (13-tap down, tent up) instead of
 *              UnrealBloomPass: about a third of a full-screen pass in total, and no shimmer on
 *              small bright things, which is all this scene is made of.
 *   focus      depth of field, in a close-up only (aperture > 0). The painted layers bring their own
 *              soft focus (scenery.ts); this is what softens the fireflies the lens is not on. The
 *              scene's depth gives every pixel a blur disc (thin lens, as rig.blurAt); the picture
 *              is gathered at half size on a rotated spiral, taking only taps at least as blurred
 *              as they are far away, so a sharp firefly never smears onto what is behind it; the
 *              result is laid over the sharp picture by each pixel's own disc. Before the bloom
 *              and the shoulder, so an out-of-focus lantern opens into a bright disc.
 *   grade      exposure, a vignette that closes a little in a close-up, and a shoulder that is the
 *              identity below 0.75, so the painting leaves the lens exactly as the page shows it.
 *   out        sRGB, a static sub-LSB dither (night gradients band on 8 bits), and the fade from
 *              black.
 *
 * Phones get the cheap version: no MSAA, no focus pass, the chain starts a quarter size and runs
 * three levels.
 */

import * as THREE from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Bright pass + first downsample. 13 taps, weighted by 1 / (1 + luma) so one hot pixel cannot flicker. */
const PREFILTER = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uKnee;
varying vec2 vUv;
vec3 bright(vec3 c) {
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - uKnee.x + uKnee.y, 0.0, 2.0 * uKnee.y);
  soft = soft * soft / (4.0 * uKnee.y + 1e-4);
  return c * max(soft, l - uKnee.x) / max(l, 1e-4);
}
vec4 tap(vec2 o) {
  vec3 c = bright(min(texture2D(uTex, vUv + o * uTexel).rgb, vec3(24.0)));
  float w = 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)));
  return vec4(c * w, w);
}
void main() {
  vec4 s = tap(vec2(0.0)) * 4.0;
  s += (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 4.0;
  s += (tap(vec2(-2.0, 0.0)) + tap(vec2(2.0, 0.0)) + tap(vec2(0.0, -2.0)) + tap(vec2(0.0, 2.0))) * 2.0;
  s += tap(vec2(-2.0, -2.0)) + tap(vec2(2.0, -2.0)) + tap(vec2(-2.0, 2.0)) + tap(vec2(2.0, 2.0));
  gl_FragColor = vec4(s.rgb / max(s.a, 1e-4), 1.0);
}
`;

const DOWN = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(uTex, vUv + o * uTexel).rgb; }
void main() {
  vec3 s = tap(vec2(0.0)) * 4.0;
  s += (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 4.0;
  s += (tap(vec2(-2.0, 0.0)) + tap(vec2(2.0, 0.0)) + tap(vec2(0.0, -2.0)) + tap(vec2(0.0, 2.0))) * 2.0;
  s += tap(vec2(-2.0, -2.0)) + tap(vec2(2.0, -2.0)) + tap(vec2(-2.0, 2.0)) + tap(vec2(2.0, 2.0));
  gl_FragColor = vec4(s / 32.0, 1.0);
}
`;

/** 3x3 tent, added onto the level above it. */
const UP = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uGain;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(uTex, vUv + o * uTexel).rgb; }
void main() {
  vec3 s = tap(vec2(0.0)) * 4.0;
  s += (tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0))) * 2.0;
  s += tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  gl_FragColor = vec4(s / 16.0 * uGain, 1.0);
}
`;

/** A pixel's blur disc radius in full-size pixels, from the depth buffer. */
const COC = /* glsl */ `
uniform sampler2D uDepth;
/** focus distance, aperture radius (world), world units per pixel at distance 1, largest disc (px) */
uniform vec4 uLens;
/** near, far, the disc of everything that writes no depth (the painting, the glows) */
uniform vec3 uClip;
float cocAt(vec2 uv) {
  float d = texture2D(uDepth, uv).r;
  if (d >= 0.99999) return uClip.z;
  float zn = d * 2.0 - 1.0;
  float z = 2.0 * uClip.x * uClip.y / (uClip.y + uClip.x - zn * (uClip.y - uClip.x));
  return min(uLens.y * abs(z - uLens.x) / (max(uLens.x, 0.1) * z * uLens.z), uLens.w);
}
`;

/** Half size: colour, and the blur disc in alpha. */
const DOF_DOWN = /* glsl */ `
uniform sampler2D uTex;
varying vec2 vUv;
${COC}
void main() {
  gl_FragColor = vec4(min(texture2D(uTex, vUv).rgb, vec3(24.0)), cocAt(vUv));
}
`;

/** The gather: a golden-angle spiral inside the pixel's own disc, turned per pixel. */
const DOF_GATHER = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
varying vec2 vUv;
const int TAPS = 22;
void main() {
  vec4 c0 = texture2D(uTex, vUv);
  float coc = c0.a;
  if (coc < 0.6) {
    gl_FragColor = c0;
    return;
  }
  float turn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
  vec3 sum = c0.rgb;
  float w = 1.0;
  for (int i = 0; i < TAPS; i++) {
    float r = sqrt((float(i) + 0.5) / float(TAPS)) * coc;
    float a = float(i) * 2.39996323 + turn;
    vec4 s = texture2D(uTex, vUv + vec2(cos(a), sin(a)) * r * uTexel);
    // A tap counts only if it is at least as blurred as it is far from here.
    float k = smoothstep(r - 1.0, r + 1.0, s.a + 0.5);
    sum += s.rgb * k;
    w += k;
  }
  gl_FragColor = vec4(sum / w, coc);
}
`;

const FINAL = /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uDofTex;
uniform vec2 uDofTexel;
uniform float uDof;
uniform float uBloomAmount;
uniform float uExposure;
uniform float uVignette;
uniform float uFade;
uniform vec3 uVeil;
uniform float uAspect;
varying vec2 vUv;
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
// Identity up to 0.75, then a soft roll-off to 1: light can be many times brighter than paint.
vec3 shoulder(vec3 c) {
  vec3 over = max(c - 0.75, vec3(0.0));
  return min(c, vec3(0.75)) + 0.25 * (1.0 - exp(-over * 4.0));
}
${COC}
void main() {
  vec3 c = texture2D(uScene, vUv).rgb;
  if (uDof > 0.5) {
    // Four taps of the half-size gather (a tent: it hides the spiral's grain), laid over by this pixel's own disc.
    vec3 b = texture2D(uDofTex, vUv + uDofTexel * vec2(-0.5, -0.5)).rgb + texture2D(uDofTex, vUv + uDofTexel * vec2(0.5, -0.5)).rgb + texture2D(uDofTex, vUv + uDofTexel * vec2(-0.5, 0.5)).rgb + texture2D(uDofTex, vUv + uDofTexel * vec2(0.5, 0.5)).rgb;
    c = mix(c, b * 0.25, smoothstep(0.6, 2.4, cocAt(vUv)));
  }
  c += texture2D(uBloom, vUv).rgb * uBloomAmount;
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= uExposure * (1.0 - uVignette * smoothstep(0.25, 1.05, length(q)));
  c = toSRGB(shoulder(c));
  c = mix(uVeil, c, uFade);
  // Ordered sub-LSB noise, fixed per pixel: gradients stop banding and nothing shimmers.
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);
}
`;

export type PostQuality = { hdr: boolean; samples: number; bloomLevels: number; bloomStart: 2 | 4; dof: boolean };
export type PostParams = {
  bloom: number;
  threshold: number;
  knee: number;
  exposure: number;
  vignette: number;
  fade: number;
  /** The lens: focus distance and aperture radius, world units (rig.now). Aperture 0: no focus pass at all. */
  focus: number;
  aperture: number;
};

/** Largest blur disc of the focus pass, as a fraction of the picture's height. */
const MAX_COC = 0.017;
/** The disc given to what writes no depth (the painting is already soft; this melts the glows into it). */
const BACK_COC = 0.5;

export class Post {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private target: THREE.WebGLRenderTarget;
  private chain: THREE.WebGLRenderTarget[] = [];
  private dofTargets: THREE.WebGLRenderTarget[] = [];
  private dofDown: THREE.ShaderMaterial | null = null;
  private dofGather: THREE.ShaderMaterial | null = null;
  private lens = new THREE.Vector4(20, 0, 1, 1);
  private clip = new THREE.Vector3(0.1, 400, 0);
  private prefilter: THREE.ShaderMaterial;
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  private final: THREE.ShaderMaterial;
  private type: THREE.TextureDataType;
  readonly veil = new THREE.Color();

  constructor(
    private renderer: THREE.WebGLRenderer,
    private quality: PostQuality,
  ) {
    this.type = quality.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.target = new THREE.WebGLRenderTarget(4, 4, { type: this.type, samples: quality.samples, depthBuffer: true, stencilBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
    if (quality.dof) {
      const depth = new THREE.DepthTexture(4, 4);
      depth.type = THREE.UnsignedIntType;
      depth.minFilter = depth.magFilter = THREE.NearestFilter;
      this.target.depthTexture = depth;
    }
    const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, add = false) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NoBlending, transparent: add });
    this.prefilter = mat(PREFILTER, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uKnee: { value: new THREE.Vector2(1, 0.25) } });
    this.down = mat(DOWN, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = mat(UP, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uGain: { value: 1 } }, true);
    if (quality.dof) {
      this.dofDown = mat(DOF_DOWN, { uTex: { value: null }, uDepth: { value: this.target.depthTexture }, uLens: { value: this.lens }, uClip: { value: this.clip } });
      this.dofGather = mat(DOF_GATHER, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } });
    }
    this.final = mat(FINAL, {
      uScene: { value: null },
      uBloom: { value: null },
      uDofTex: { value: null },
      uDofTexel: { value: new THREE.Vector2() },
      uDof: { value: 0 },
      uDepth: { value: this.target.depthTexture ?? null },
      uLens: { value: this.lens },
      uClip: { value: this.clip },
      uBloomAmount: { value: 0.6 },
      uExposure: { value: 1 },
      uVignette: { value: 0 },
      uFade: { value: 0 },
      uVeil: { value: this.veil },
      uAspect: { value: 1 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.final);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** Size in device pixels. */
  setSize(w: number, h: number) {
    this.target.setSize(w, h);
    this.chain.forEach((t) => t.dispose());
    this.chain = [];
    let cw = Math.max(2, Math.round(w / this.quality.bloomStart));
    let ch = Math.max(2, Math.round(h / this.quality.bloomStart));
    for (let i = 0; i < this.quality.bloomLevels; i++) {
      this.chain.push(new THREE.WebGLRenderTarget(cw, ch, { type: this.type, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false }));
      cw = Math.max(2, Math.round(cw / 2));
      ch = Math.max(2, Math.round(ch / 2));
    }
    this.final.uniforms.uAspect.value = w / h;
    this.dofTargets.forEach((t) => t.dispose());
    this.dofTargets = [];
    if (this.quality.dof) {
      const hw = Math.max(2, Math.ceil(w / 2));
      const hh = Math.max(2, Math.ceil(h / 2));
      for (let i = 0; i < 2; i++) this.dofTargets.push(new THREE.WebGLRenderTarget(hw, hh, { type: this.type, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false }));
      this.final.uniforms.uDofTexel.value.set(1 / hw, 1 / hh);
      this.dofGather!.uniforms.uTexel.value.set(1 / w, 1 / h);
    }
  }

  private pass(material: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(to);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: PostParams) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);

    /* ── focus ── */
    const dof = this.dofDown !== null && this.dofGather !== null && p.aperture > 1e-4;
    if (dof) {
      const h = this.target.height;
      const maxCoc = MAX_COC * h;
      this.lens.set(p.focus, p.aperture, (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / h, maxCoc);
      // The painting's share of the blur grows with the lens, so nothing pops as it opens.
      const open = Math.min(1, p.aperture / (Math.max(p.focus, 0.1) * this.lens.z * maxCoc));
      this.clip.set(camera.near, camera.far, maxCoc * BACK_COC * open);
      this.dofDown!.uniforms.uTex.value = this.target.texture;
      this.pass(this.dofDown!, this.dofTargets[0]);
      this.dofGather!.uniforms.uTex.value = this.dofTargets[0].texture;
      this.pass(this.dofGather!, this.dofTargets[1]);
    }

    const auto = r.autoClear;
    const chain = this.chain;
    if (chain.length && p.bloom > 0) {
      this.prefilter.uniforms.uTex.value = this.target.texture;
      this.prefilter.uniforms.uTexel.value.set(1 / this.target.width, 1 / this.target.height).multiplyScalar(this.quality.bloomStart / 2);
      this.prefilter.uniforms.uKnee.value.set(p.threshold, p.knee);
      this.pass(this.prefilter, chain[0]);
      for (let i = 1; i < chain.length; i++) {
        this.down.uniforms.uTex.value = chain[i - 1].texture;
        this.down.uniforms.uTexel.value.set(1 / chain[i - 1].width, 1 / chain[i - 1].height);
        this.pass(this.down, chain[i]);
      }
      // Up the chain: each level is added onto the one above it.
      r.autoClear = false;
      for (let i = chain.length - 1; i > 0; i--) {
        this.up.uniforms.uTex.value = chain[i].texture;
        this.up.uniforms.uTexel.value.set(1 / chain[i].width, 1 / chain[i].height);
        this.up.uniforms.uGain.value = 1;
        this.pass(this.up, chain[i - 1]);
      }
      r.autoClear = auto;
    }

    const f = this.final.uniforms;
    f.uScene.value = this.target.texture;
    f.uDof.value = dof ? 1 : 0;
    f.uDofTex.value = dof ? this.dofTargets[1].texture : null;
    f.uBloom.value = chain.length ? chain[0].texture : this.target.texture;
    f.uBloomAmount.value = chain.length ? p.bloom / chain.length : 0;
    f.uExposure.value = p.exposure;
    f.uVignette.value = p.vignette;
    f.uFade.value = p.fade;
    this.pass(this.final, null);
  }

  dispose() {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.dofTargets.forEach((t) => t.dispose());
    this.dofDown?.dispose();
    this.dofGather?.dispose();
    this.chain.forEach((t) => t.dispose());
    this.quad.geometry.dispose();
    [this.prefilter, this.down, this.up, this.final].forEach((m) => m.dispose());
  }
}
