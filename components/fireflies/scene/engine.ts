/**
 * THE MEADOW — the runtime of the 3D firefly scene. No React in here.
 *
 *   one clock      `frame(dt)` is called by the host's single loop (the gsap ticker). Everything
 *                  timed, the camera's GSAP move included, advances by that dt on a paused timeline
 *                  this engine owns, so a hidden tab or an off-screen host freezes the lot, and a
 *                  test can step it frame by frame.
 *   heroes         one job each: the full model, its own rig (flock.ts), a curl-noise wander with
 *                  banking, hovering pauses, a slow lantern pulse.
 *   far flock      the LOD model on shared rigs, on cheap closed paths; behind them, sprites that
 *                  wander and pulse entirely in their vertex shader (scenery.ts Glows).
 *   focus          pointer rays against enlarged bounding spheres. A firefly under the pointer for
 *                  a few frames is chosen: it stops, turns to the camera and plays `notice`; the
 *                  camera (rig.ts) flies to it; its lantern lights the grass, the mist and its
 *                  neighbours; everything else dims and goes soft (post.ts).
 *   presence       0 is the page's painted meadow exactly, with no fireflies: what the story shows
 *                  at the end of pass 2. 1 is the whole scene. `setActive` eases between them, so
 *                  the scene can take over from the painting and hand back with no cut.
 */

import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { Flock, type SharedUniforms } from "./flock";
import { loadFireflies, type FireflyModels } from "./model";
import { curl3, mulberry } from "./noise";
import { Post } from "./post";
import { CLOSE_FOV, CameraRig, WIDE_FOV, type Composition } from "./rig";
import { DEPTH, Glows, Scenery, type Layout } from "./scenery";
import { readFfColors, type FfColors } from "./tokens";
import { FIT_LINE } from "../jobs";
import type { FireflyFraming, FireflyJob } from "./types";

/* ───────────────────────────────────────────────────────────── tuning ── */

/** A hero firefly's height in world units. */
const HERO = 0.62;
/** Fit at and above which a lantern is lamp yellow (the roles that fit). Below it fades to the paler light. */
const KEPT_FIT = FIT_LINE;
/** Seconds the pointer must rest on a firefly before it is chosen (from the wide shot / from a close-up). */
const DWELL = 0.07;
const DWELL_RETARGET = 0.16;
/** Seconds the pointer may be off the chosen firefly before the focus is left. */
const GRACE = 0.45;
/** Fireflies keep this far (world units) from the line between the lens and the chosen one. */
const CLEAR = 1.35;
/** Camera move progress at which the job is revealed (onFocus fires). Sooner between two fireflies: the card is already open. */
const REVEAL_AT = 0.56;
const REVEAL_AT_SWITCH = 0.32;
/** The page's meadow at the end of pass 2 (SceneDirector: scale 1 + 0.06u, grass GRASS_LOW − 0.02u, u ≈ 0.51). */
export const PAGE_FRAMING: FireflyFraming = { meadowScale: 1.0305, grassLow: 0.2898 };

const TAU = Math.PI * 2;
const FLY = 0;
const PAUSE = 1;
const HELD = 2;
const LEAVE = 3;

export type Quality = {
  phone: boolean;
  /** Most hero fireflies drawn (each is one job). */
  heroes: number;
  lod: number;
  lodRigs: number;
  sprites: number;
  maxDpr: number;
  samples: number;
  bloomLevels: number;
  bloomStart: 2 | 4;
  mist: number;
  /** Depth of field as a lens pass (post.ts). Off on phones: the backdrop's own soft focus stays. */
  dof: boolean;
};

export function pickQuality(phone: boolean, dpr: number): Quality {
  return phone
    ? { phone, heroes: 18, lod: 36, lodRigs: 4, sprites: 160, maxDpr: 2, samples: 0, bloomLevels: 3, bloomStart: 4, mist: 1, dof: false }
    : { phone, heroes: 60, lod: 110, lodRigs: 8, sprites: 340, maxDpr: 2, samples: dpr >= 1.75 ? 2 : 4, bloomLevels: 5, bloomStart: 2, mist: 3, dof: true };
}

export type FocusSource = "pointer" | "touch" | "api";

export type MeadowOptions = {
  host: HTMLElement;
  jobs: readonly FireflyJob[];
  reduced: boolean;
  phone: boolean;
  framing: FireflyFraming;
  /** "veil": fade in from black once. "match": first frame is the painted meadow. */
  intro: "match" | "veil";
  /**
   * `job` is an index into `jobs`, or -1. `x, y` are CSS px inside the host; `r` is the firefly's
   * radius on screen. Fired on reveal, on anchor moves of more than a pixel, and on leaving.
   */
  onFocus: (job: number, x: number, y: number, r: number) => void;
  /** The pointer is over a firefly it could choose (for the cursor). */
  onHot?: (hot: boolean) => void;
};

/** Test and tuning switches, read once from `window.__ffDebug`. */
type Debug = { dpr?: number; standin?: boolean; noAdapt?: boolean };

type Agent = {
  /** Index into jobs. */
  job: number;
  /** Home in the wide frustum: u, v in -1..1 of the frame at depth d. */
  hu: number;
  hv: number;
  hd: number;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  yawRate: number;
  cruise: number;
  range: number;
  seed: number;
  mode: number;
  until: number;
  nextPause: number;
  speedK: number;
  hoverW: number;
  noticeT: number;
  /** 0..1: how much it is the chosen one (eased). */
  sel: number;
  /** 0..1: the pointer is on it. */
  hot: number;
  phase: number;
  rate: number;
  base: number;
  tint: [number, number, number];
  blinkAt: number;
  /** When it was last the chosen one (for handing a firefly to another job on phones). */
  usedAt: number;
  lamp: THREE.Vector3;
};

type Far = { hx: number; hy: number; hz: number; a: number; b: number; c: number; w: number; p1: number; p2: number; p3: number; size: number; rate: number; phase: number; base: number; yaw: number };

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const frac = (x: number) => x - Math.floor(x);
const turn = (a: number) => {
  let d = (a + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
};
const lin = (c: readonly [number, number, number]) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

/* ───────────────────────────────────────────────────────────── assets ── */

type Manifest = Record<string, { width: number; height: number; widths: number[] }>;
const MANIFEST_FALLBACK: Manifest = {
  "meadow-night": { width: 1280, height: 720, widths: [960, 1280] },
  "grass-fg": { width: 2048, height: 1152, widths: [960, 1600, 2048] },
};

async function readManifest(): Promise<Manifest> {
  try {
    const r = await fetch("/scenes/manifest.json");
    if (!r.ok) return MANIFEST_FALLBACK;
    const m = (await r.json()) as Manifest;
    return m["meadow-night"]?.widths?.length && m["grass-fg"]?.widths?.length ? m : MANIFEST_FALLBACK;
  } catch {
    return MANIFEST_FALLBACK;
  }
}

/** The smallest exported width that is at least `need` (or the largest there is). */
const widthFor = (widths: number[], need: number) => widths.find((w) => w >= need) ?? widths[widths.length - 1];

/** Fetch and decode a picture off the main thread. Rows are flipped here, as WebGL wants them. */
async function loadTexture(url: string, opts: { premultiply: boolean; srgb: boolean; maxAniso: number }): Promise<THREE.Texture> {
  let tex: THREE.Texture;
  try {
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: opts.premultiply ? "premultiply" : "none", colorSpaceConversion: "none" });
    tex = new THREE.Texture(bitmap as unknown as HTMLImageElement);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.userData.bitmap = bitmap;
  } catch {
    // No ImageBitmap options (older Safari): an <img>, decoded before use.
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    tex = new THREE.Texture(img);
    tex.flipY = true;
    tex.premultiplyAlpha = opts.premultiply;
  }
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(4, opts.maxAniso);
  tex.needsUpdate = true;
  return tex;
}

/** A small night sky to reflect: what puts the moon in a firefly's eye. */
function makeEnvironment(renderer: THREE.WebGLRenderer, c: { sky: THREE.Color; ground: THREE.Color; moon: THREE.Color; warm: THREE.Color }): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSky: { value: c.sky }, uGround: { value: c.ground }, uMoon: { value: c.moon }, uWarm: { value: c.warm } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uMoon; uniform vec3 uWarm;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(uGround, uSky, smoothstep(-0.35, 0.6, d.y));
        // The moon: up, to the left, a little in front of the firefly.
        float m = max(dot(d, normalize(vec3(-0.55, 0.62, 0.56))), 0.0);
        c += uMoon * (pow(m, 90.0) * 9.0 + pow(m, 9.0) * 0.5);
        // A warm bounce from the grass and the other lanterns, low and in front.
        float w = max(dot(d, normalize(vec3(0.5, -0.4, 0.75))), 0.0);
        c += uWarm * pow(w, 5.0) * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const geo = new THREE.SphereGeometry(10, 24, 16);
  scene.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  return rt;
}

/* ───────────────────────────────────────────────────────────── engine ── */

const V = new THREE.Vector3();
const V2 = new THREE.Vector3();
const Q = new THREE.Quaternion();
const E = new THREE.Euler(0, 0, 0, "YXZ");
const M = new THREE.Matrix4();
const S = new THREE.Vector3();
const C3 = new Float32Array(3);

export class Meadow {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  /** Numbers for the lab and the tests (window.__ff.stats). */
  readonly stats = { frameMs: 0, cpuMs: 0, fps: 0, dpr: 1, calls: 0, triangles: 0, heroes: 0, lod: 0, sprites: 0, source: "standin", lodSource: "standin", frames: 0, missing: "" };

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig: CameraRig;
  private timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });
  private scenery: Scenery;
  private post: Post;
  private heroes: Flock;
  private far: Flock;
  private halos: Glows;
  private sprites: Glows;
  private env: THREE.WebGLRenderTarget;
  private models: FireflyModels;
  private colors: FfColors;
  private aside = new THREE.Color();
  private keyColor = new THREE.Color();
  private clearAmt = 0;
  private shared: SharedUniforms & { uTime: { value: number }; uLens: { value: THREE.Vector2 }; uLevel: { value: number } };
  private agents: Agent[] = [];
  private fars: Far[] = [];
  /** job index → agent index (or -1 when no firefly carries it right now). */
  private carrier: Int16Array;
  private rand = mulberry(2340);
  private layoutIn: Layout;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private tanV = Math.tan(THREE.MathUtils.degToRad(WIDE_FOV) / 2);
  private time = 0;
  private fade = 0;
  private fadeDur: number;
  private presence = 0;
  private active = false;
  private visible = true;
  private frozen = false;
  private disposed = false;
  private hdr: boolean;
  private debug: Debug;

  /* focus */
  private sel = -1;
  private source: FocusSource = "pointer";
  private revealed = false;
  private switching = false;
  private docked = false;
  private focusT = 0;
  private target = new THREE.Vector3();
  private comp: Composition = { x: 0, y: 0 };
  private landing = { x: 0, y: 0 };
  private sent = { job: -1, x: -1e4, y: -1e4, r: 0 };
  private key = new THREE.Vector3();
  private keyLevel = 0;
  private dimAmt = 0;
  private ptr = { x: 0, y: 0, inside: false, parked: false, mouse: false, lastMove: -10, movedSinceFocus: false };
  private hotIdx = -1;
  private hotT = 0;
  private away = 0;
  private wasHot = false;
  private ray = new THREE.Ray();
  private adapt = { n: 0, sum: 0, cool: 0 };

  private constructor(
    private opts: MeadowOptions,
    renderer: THREE.WebGLRenderer,
    quality: Quality,
    models: FireflyModels,
    tex: { meadow: THREE.Texture; grass: THREE.Texture },
    sizes: { meadowAr: number; grassAr: number },
    debug: Debug,
  ) {
    this.renderer = renderer;
    this.canvas = renderer.domElement;
    this.quality = quality;
    this.models = models;
    this.debug = debug;
    this.fadeDur = opts.intro === "veil" ? (opts.reduced ? 0.5 : 1.5) : 0;
    this.fade = opts.intro === "veil" ? 0 : 1;
    const colors = (this.colors = readFfColors(opts.host));
    this.hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");

    const fog = lin(colors.fog);
    this.aside.copy(lin(colors.lanternAside)).multiplyScalar(0.8);
    this.keyColor.copy(lin(colors.lantern));
    this.shared = {
      uTime: { value: 0 },
      uLens: { value: new THREE.Vector2(20, 0) },
      uLevel: { value: 0 },
      uKey: { value: new THREE.Vector4(0, 0, -20, 0) },
      uKeyColor: { value: lin(colors.lantern) },
      uRimColor: { value: lin(colors.rim).multiplyScalar(0.55) },
      uRimDir: { value: new THREE.Vector3(-0.5, 0.6, 0.5).normalize() },
      uFogColor: { value: fog },
      uFog: { value: new THREE.Vector3(22, 96, 0.74) },
      uFocus: { value: 0 },
      uGlowColor: { value: lin(colors.lantern) },
      uGlowHot: { value: lin(colors.lanternHot) },
    };

    /* ── camera ── */
    this.rig = new CameraRig(this.timeline);
    this.rig.setSubject(HERO);
    this.rig.setReduced(opts.reduced);

    /* ── light: a dim night sky, the moon from the upper left, and a sky to reflect ── */
    this.scene.add(new THREE.HemisphereLight(lin(colors.rim), lin(colors.night), 0.9));
    const moon = new THREE.DirectionalLight(lin(colors.moon), 1.15);
    moon.position.set(-0.55, 0.62, 0.56);
    this.scene.add(moon);
    this.env = makeEnvironment(renderer, { sky: lin(colors.fog).multiplyScalar(0.9), ground: lin(colors.night).multiplyScalar(0.5), moon: lin(colors.moon), warm: lin(colors.lantern) });
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.55;

    /* ── scenery ── */
    this.scenery = new Scenery(renderer, tex, { night: lin(colors.night), sky: lin(colors.sky), moon: lin(colors.moon), mist: lin(colors.mist) }, this.shared, { hdr: this.hdr, mistLayers: quality.mist });
    this.scene.add(this.scenery.group);
    this.layoutIn = { vw: 1, vh: 1, fov: WIDE_FOV, meadowAr: sizes.meadowAr, meadowScale: opts.framing.meadowScale, grassAr: sizes.grassAr, grassLow: opts.framing.grassLow };

    /* ── fireflies ── */
    const jobs = opts.jobs;
    const count = Math.max(1, Math.min(quality.heroes, jobs.length));
    this.heroes = new Flock(models.hero, count, count, this.shared, { order: 5, wingDepth: quality.dof });
    this.far = new Flock(models.lod, quality.lod, quality.lodRigs, this.shared, { order: 4, wingDepth: false });
    this.heroes.scatter(this.rand);
    this.far.scatter(this.rand);
    this.scene.add(this.far.group, this.heroes.group);
    this.halos = new Glows({ count: count + quality.lod, dynamic: true, core: 0.5 }, this.shared);
    this.sprites = new Glows({ count: quality.sprites, dynamic: false, core: 1.4 }, this.shared);
    this.halos.mesh.renderOrder = 10;
    this.sprites.mesh.renderOrder = 9;
    this.scene.add(this.sprites.mesh, this.halos.mesh);

    this.carrier = new Int16Array(jobs.length).fill(-1);
    this.seedAgents(count);
    this.seedFar();
    this.seedSprites();

    /* ── lens ── */
    this.post = new Post(renderer, { hdr: this.hdr, samples: quality.samples, bloomLevels: quality.bloomLevels, bloomStart: quality.bloomStart, dof: quality.dof });
    this.post.veil.copy(lin(colors.veil));

    this.stats.heroes = count;
    this.stats.lod = quality.lod;
    this.stats.sprites = quality.sprites;
    this.stats.source = models.hero.source;
    this.stats.lodSource = models.lod.source;
    this.stats.missing = models.missing.join(",");
    this.stats.triangles = models.hero.triangles * count + models.lod.triangles * quality.lod;
    if (opts.intro === "veil") this.presence = 1;
  }

  /** Load, decode and compile everything, and draw the first frame. Resolves when the scene can be shown. */
  static async create(opts: MeadowOptions): Promise<Meadow> {
    const debug = ((window as unknown as { __ffDebug?: Debug }).__ffDebug ?? {}) as Debug;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance", premultipliedAlpha: true });
    if (!gl) throw new Error("no-webgl2");
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
    renderer.autoClear = true;
    renderer.info.autoReset = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1); // token-ok: clear value of the offscreen target, never seen (the backdrop covers it)
    const quality = pickQuality(opts.phone, Math.min(window.devicePixelRatio || 1, 2));
    try {
      const rect = opts.host.getBoundingClientRect();
      const dpr = debug.dpr ?? Math.min(window.devicePixelRatio || 1, quality.maxDpr);
      const colors = readFfColors(opts.host);
      const manifest = await readManifest();
      const mw = widthFor(manifest["meadow-night"].widths, opts.phone ? 960 : 1280);
      const gNeed = Math.max(rect.width, (rect.height * manifest["grass-fg"].width) / manifest["grass-fg"].height) * dpr * 0.8;
      const gw = widthFor(manifest["grass-fg"].widths, opts.phone ? 960 : gNeed);
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const [meadow, grass, models] = await Promise.all([
        loadTexture(`/scenes/meadow-night-${mw}.webp`, { premultiply: false, srgb: true, maxAniso }),
        loadTexture(`/scenes/grass-fg-${gw}.webp`, { premultiply: true, srgb: false, maxAniso }),
        loadFireflies(colors, { standin: debug.standin }),
      ]);
      const m = new Meadow(opts, renderer, quality, models, { meadow, grass }, { meadowAr: manifest["meadow-night"].width / manifest["meadow-night"].height, grassAr: manifest["grass-fg"].width / manifest["grass-fg"].height }, debug);
      m.resize(Math.max(1, rect.width), Math.max(1, rect.height));
      // Compile every program before the first visible frame, then draw one (uploads the textures).
      m.advance(0);
      await renderer.compileAsync(m.scene, m.rig.camera);
      m.draw();
      return m;
    } catch (err) {
      renderer.dispose();
      throw err;
    }
  }

  /* ─────────────────────────────────────────────────────── seeding ── */

  private tanH() {
    return this.tanV * (this.w / this.h);
  }

  /** A firefly's light: its colour (linear) and how bright its lantern burns. */
  private tintFor(fit: number): { tint: [number, number, number]; base: number } {
    // Kept: lamp yellow. Set aside: the paler, cooler light.
    const k = ss(KEPT_FIT - 1, KEPT_FIT, fit);
    const g = this.shared.uGlowColor.value;
    const a = this.aside;
    const tint: [number, number, number] = [a.r + (g.r - a.r) * k, a.g + (g.g - a.g) * k, a.b + (g.b - a.b) * k];
    return { tint, base: 0.55 + 0.45 * k + 0.05 * clamp(fit - KEPT_FIT, 0, 4) };
  }

  private seedAgents(count: number) {
    const rand = this.rand;
    const jobs = this.opts.jobs;
    const near = this.quality.phone ? 13 : 8;
    for (let i = 0; i < count; i++) {
      const job = jobs[i];
      const kept = job.fit >= KEPT_FIT;
      // R2 low-discrepancy points: an even spread over the frame, whatever the count.
      const hu = (frac(0.5 + (i + 1) * 0.7548776662466927) * 2 - 1) * 0.92;
      const hv = -0.2 + frac(0.5 + (i + 1) * 0.5698402909980532) * 1.02;
      // The roles that fit fly nearest: they are the ones to meet.
      const hd = kept ? near + rand() * 8.5 : near + 4 + rand() * 17;
      const look = this.tintFor(job.fit);
      const a: Agent = {
        job: i,
        hu,
        hv,
        hd,
        home: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        yaw: (rand() - 0.5) * 1.6,
        pitch: 0.15,
        roll: 0,
        yawRate: 0,
        cruise: (0.75 + rand() * 0.75) * (this.opts.reduced ? 0.32 : 1),
        range: 1.4 + rand() * 1.6,
        seed: rand() * 100,
        mode: FLY,
        until: 0,
        nextPause: rand() * 11,
        speedK: 1,
        hoverW: 0,
        noticeT: -1,
        sel: 0,
        hot: 0,
        phase: rand() * TAU,
        rate: 1.5 + rand() * 1.9,
        base: look.base,
        tint: look.tint,
        blinkAt: 1 + rand() * 4,
        usedAt: -1,
        lamp: new THREE.Vector3(),
      };
      this.carrier[i] = i;
      this.agents.push(a);
      this.heroes.setRig(i, i);
      this.heroes.setTint(i, a.tint[0], a.tint[1], a.tint[2]);
      this.halos.tint.setXYZ(i, a.tint[0], a.tint[1], a.tint[2]);
    }
  }

  private seedFar() {
    const rand = this.rand;
    const n = this.quality.lod;
    const aside = this.tintFor(0).tint;
    const keptTint = this.tintFor(10).tint;
    for (let i = 0; i < n; i++) {
      const hz = 31 + Math.pow(rand(), 0.8) * 34;
      const f: Far = {
        hx: (rand() * 2 - 1) * 1.5,
        hy: -0.34 + rand() * 1.1,
        hz,
        a: 1.2 + rand() * 2.6,
        b: 0.5 + rand() * 1.1,
        c: 0.8 + rand() * 1.8,
        w: 0.1 + rand() * 0.16,
        p1: rand() * TAU,
        p2: rand() * TAU,
        p3: rand() * TAU,
        size: HERO * (0.85 + rand() * 0.3),
        rate: 1.3 + rand() * 2,
        phase: rand() * TAU,
        base: 0.45 + rand() * 0.4,
        yaw: 0,
      };
      this.fars.push(f);
      // One in six is a kept colour; the market is mostly roles that do not fit.
      const kept = rand() < 0.16;
      const t = kept ? keptTint : aside;
      this.far.setTint(i, t[0], t[1], t[2]);
      this.halos.tint.setXYZ(this.agents.length + i, t[0], t[1], t[2]);
    }
    this.halos.tint.needsUpdate = true;
  }

  private seedSprites() {
    const rand = this.rand;
    const sp = this.sprites;
    const g = this.shared.uGlowColor.value;
    const aside = this.tintFor(0).tint;
    const tanV = this.tanV;
    for (let i = 0; i < this.quality.sprites; i++) {
      const d = 40 + Math.pow(rand(), 0.7) * 62;
      // Wider than the frame: a pan must never find where they stop.
      const x = (rand() * 2 - 1) * d * tanV * 3.4;
      const y = (-0.5 + Math.pow(rand(), 1.4) * 1.25) * d * tanV;
      sp.pos.setXYZ(i, x, y, -d);
      sp.drift.setXYZW(i, 0.5 + rand() * 1.4, 0.12 + rand() * 0.2, rand() * TAU, 0);
      sp.look.setXYZW(i, 0.2 + rand() * 0.22, 0.5 + rand() * 0.6, 0.5 + rand() * 0.9, rand() * TAU);
      const kept = rand() < 0.2;
      sp.tint.setXYZ(i, kept ? g.r : aside[0], kept ? g.g : aside[1], kept ? g.b : aside[2]);
    }
    sp.pos.needsUpdate = sp.drift.needsUpdate = sp.look.needsUpdate = sp.tint.needsUpdate = true;
  }

  private placeHomes(reset: boolean) {
    const tanH = this.tanH();
    for (const a of this.agents) {
      a.home.set(a.hu * a.hd * tanH, a.hv * a.hd * this.tanV, -a.hd);
      if (reset) {
        a.pos.copy(a.home);
        a.pos.x += (this.rand() - 0.5) * a.range;
        a.pos.y += (this.rand() - 0.5) * a.range * 0.6;
      }
    }
  }

  /* ───────────────────────────────────────────────────────── sizing ── */

  resize(w: number, h: number) {
    const first = this.w === 1 && this.h === 1;
    this.w = w;
    this.h = h;
    if (first) this.dpr = this.debug.dpr ?? Math.min(window.devicePixelRatio || 1, this.quality.maxDpr);
    this.applySize();
    this.rig.setAspect(w / h);
    this.layoutIn.vw = w;
    this.layoutIn.vh = h;
    this.scenery.layout(this.layoutIn);
    this.placeHomes(first);
    this.sent.x = -1e4;
  }

  private applySize() {
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.post.setSize(Math.round(this.w * this.dpr), Math.round(this.h * this.dpr));
    this.stats.dpr = this.dpr;
  }

  /** Lay the wide shot out differently (the page's meadow keeps a slow push while the scene is up). */
  setFraming(f: Partial<FireflyFraming>) {
    if (f.meadowScale !== undefined) this.layoutIn.meadowScale = f.meadowScale;
    if (f.grassLow !== undefined) this.layoutIn.grassLow = f.grassLow;
    this.scenery.layout(this.layoutIn);
  }

  /** Draw the current moment again without advancing it (after a resize, so the canvas is never blank). */
  redraw() {
    if (this.disposed) return;
    this.advance(0);
    this.draw();
  }

  /* ────────────────────────────────────────────────────────── focus ── */

  /** The firefly that carries a job; on phones (fewer heroes than jobs) one is handed the job. */
  private agentFor(job: number): number {
    const have = this.carrier[job];
    if (have >= 0) return have;
    // The one chosen longest ago, never the current one, preferring one of the same kind.
    let best = -1;
    let bestAt = Infinity;
    for (let i = 0; i < this.agents.length; i++) {
      if (i === this.sel) continue;
      const a = this.agents[i];
      const sameKind = this.opts.jobs[a.job].fit >= KEPT_FIT === this.opts.jobs[job].fit >= KEPT_FIT;
      const at = a.usedAt + (sameKind ? 0 : 1e3);
      if (at < bestAt) {
        bestAt = at;
        best = i;
      }
    }
    if (best < 0) return -1;
    const a = this.agents[best];
    this.carrier[a.job] = -1;
    a.job = job;
    this.carrier[job] = best;
    const look = this.tintFor(this.opts.jobs[job].fit);
    a.tint = look.tint;
    a.base = look.base;
    this.heroes.setTint(best, a.tint[0], a.tint[1], a.tint[2]);
    this.halos.tint.setXYZ(best, a.tint[0], a.tint[1], a.tint[2]);
    this.halos.tint.needsUpdate = true;
    return best;
  }

  /** Focus a job by its index (the list, the keyboard). */
  focusJob(job: number) {
    if (job < 0 || job >= this.opts.jobs.length) return;
    const i = this.agentFor(job);
    if (i >= 0) this.focus(i, "api");
  }

  /** The card is a bottom sheet here (a phone, a short window): fireflies are framed in the top third, clear of it. */
  setDocked(on: boolean) {
    this.docked = on;
  }

  private defaultComp(): Composition {
    // Docked: the firefly high, the sheet under it. Otherwise left of centre, the card to its right.
    return this.docked ? { x: 0, y: this.w / this.h < 0.8 ? 0.6 : 0.5 } : { x: -0.24, y: 0.04 };
  }

  private focus(i: number, source: FocusSource) {
    if (i === this.sel) {
      this.source = source;
      return;
    }
    // From one firefly to another the host hears no "left" in between: the card switches, it does not close.
    const prev = this.sel;
    if (prev >= 0) this.letGo(prev);
    this.switching = prev >= 0 && this.revealed;
    const a = this.agents[i];
    this.sel = i;
    this.source = source;
    this.revealed = false;
    this.focusT = 0;
    this.away = 0;
    this.ptr.movedSinceFocus = false;
    a.mode = HELD;
    a.usedAt = this.time;
    a.noticeT = 0;
    this.heroes.rigs[i].w.notice = 0;
    this.heroes.notice(i);
    if (source === "pointer" && this.ptr.inside && !this.docked) {
      // Land it where the pointer is, so the pointer is still on it when the camera arrives.
      this.comp = { x: clamp((this.ptr.x / this.w) * 2 - 1, -0.5, 0.5), y: clamp(1 - (this.ptr.y / this.h) * 2, -0.2, 0.3) };
    } else this.comp = this.defaultComp();
    this.landing.x = (this.comp.x * 0.5 + 0.5) * this.w;
    this.landing.y = (1 - (this.comp.y * 0.5 + 0.5)) * this.h;
    this.target.copy(a.pos);
    this.rig.focusOn(this.target, this.comp);
  }

  private letGo(i: number) {
    const a = this.agents[i];
    a.mode = LEAVE;
    a.until = this.time + 1.5;
    a.usedAt = this.time;
    // Off it goes: up and away from the lens, to one side.
    const side = a.pos.x >= this.rig.camera.position.x ? 1 : -1;
    a.vel.set(side * (0.9 + this.rand() * 0.7), 0.7 + this.rand() * 0.5, -0.5 - this.rand() * 0.6).multiplyScalar(this.opts.reduced ? 0.3 : 1.25);
  }

  /** Leave the focus: the firefly flies off, the camera eases back. */
  clearFocus() {
    if (this.sel < 0) return;
    this.letGo(this.sel);
    this.sel = -1;
    this.revealed = false;
    this.away = 0;
    this.rig.release();
    this.emit(-1, 0, 0, 0);
  }

  private emit(job: number, x: number, y: number, r: number) {
    const s = this.sent;
    if (job === s.job && Math.abs(x - s.x) < 1.25 && Math.abs(y - s.y) < 1.25) return;
    if (job < 0 && s.job < 0) return;
    s.job = job;
    s.x = x;
    s.y = y;
    s.r = r;
    this.opts.onFocus(job, x, y, r);
  }

  /* ──────────────────────────────────────────────────────── pointer ── */

  pointerMove(x: number, y: number, mouse: boolean) {
    const p = this.ptr;
    if (mouse && (Math.abs(x - p.x) > 0.5 || Math.abs(y - p.y) > 0.5)) {
      p.lastMove = this.time;
      p.movedSinceFocus = true;
    }
    p.x = x;
    p.y = y;
    p.inside = true;
    p.parked = false;
    p.mouse = mouse;
  }

  /** `parked`: the pointer went onto something else on the page (the card, the list), not away. */
  pointerLeave(parked: boolean) {
    this.ptr.inside = false;
    this.ptr.parked = parked;
    this.ptr.movedSinceFocus = true;
    this.hotIdx = -1;
    this.hotT = 0;
  }

  /** A click or a tap: on a firefly, choose it; on empty meadow, go back. */
  tap(x: number, y: number, touch: boolean) {
    if (!this.active) return;
    this.setRay(x, y);
    const i = this.pick(touch ? 34 : 22, -1);
    if (i >= 0) {
      if (touch) this.ptr.inside = false;
      this.focus(i, touch ? "touch" : "pointer");
    } else this.clearFocus();
  }

  private setRay(x: number, y: number) {
    const cam = this.rig.camera;
    V.set((x / this.w) * 2 - 1, 1 - (y / this.h) * 2, 0.5).unproject(cam);
    this.ray.origin.copy(cam.position);
    this.ray.direction.copy(V).sub(cam.position).normalize();
  }

  /**
   * The firefly under the current ray: bounding spheres, enlarged to at least `minPx` on screen.
   * `only` tests one agent (with a wider margin: keeping a focus is easier than getting one).
   */
  private pick(minPx: number, only: number): number {
    const o = this.ray.origin;
    const d = this.ray.direction;
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(this.rig.camera.fov) / 2)) / this.h;
    const R0 = this.models.hero.radius * HERO;
    let best = -1;
    let bestScore = 1;
    const from = only >= 0 ? only : 0;
    const to = only >= 0 ? only + 1 : this.agents.length;
    for (let i = from; i < to; i++) {
      const a = this.agents[i];
      const lx = a.pos.x - o.x;
      const ly = a.pos.y - o.y;
      const lz = a.pos.z - o.z;
      const t = lx * d.x + ly * d.y + lz * d.z;
      if (t < HERO * 1.2) continue;
      const r = Math.max(R0 * (only >= 0 ? 1.7 : 1.2), minPx * perPx * t);
      const d2 = lx * lx + ly * ly + lz * lz - t * t;
      const score = d2 / (r * r);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  private policy(dt: number) {
    const p = this.ptr;
    let hot = -1;
    if (this.active && p.inside && p.mouse && this.presence > 0.6) {
      this.setRay(p.x, p.y);
      hot = this.pick(22, -1);
      // A firefly that drifts under a resting pointer is not a hover: the pointer has to have moved.
      const intent = this.time - p.lastMove < 0.9;
      if (hot >= 0 && hot !== this.sel && intent) {
        this.hotT = hot === this.hotIdx ? this.hotT + dt : 0;
        if (this.hotT >= (this.sel >= 0 ? DWELL_RETARGET : DWELL)) {
          this.hotT = 0;
          this.focus(hot, "pointer");
        }
      } else this.hotT = 0;
      this.hotIdx = hot;
    }
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      a.hot += ((i === hot ? 1 : 0) - a.hot) * (1 - Math.exp(-dt * 12));
    }
    const isHot = hot >= 0;
    if (isHot !== this.wasHot) {
      this.wasHot = isHot;
      this.opts.onHot?.(isHot);
    }
    // Where the card docks the firefly is moved up out of the pointer's way, so a hover holds until a click elsewhere.
    if (this.sel >= 0 && this.source === "pointer" && !this.docked) {
      let on = p.parked;
      if (!on && p.inside) {
        this.setRay(p.x, p.y);
        on = this.pick(30, this.sel) >= 0;
      }
      // A pointer that has not moved since the firefly was chosen never dismisses it.
      if (on || !p.movedSinceFocus) this.away = 0;
      else this.away += dt;
      if (this.away > GRACE) this.clearFocus();
    }
  }

  /* ─────────────────────────────────────────────────────────── life ── */

  /** Render and accept input only while active. Turning it off winds the scene back to the painting first. */
  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (!on) {
      this.clearFocus();
      this.ptr.inside = false;
      this.hotIdx = -1;
      if (this.wasHot) {
        this.wasHot = false;
        this.opts.onHot?.(false);
      }
    }
  }

  setVisible(on: boolean) {
    this.visible = on;
  }

  /** True while there is anything to draw: active, or still winding back to the painting. */
  get running(): boolean {
    return this.active || this.presence > 0.001 || this.rig.moving || this.rig.focusAmount > 0.001 || this.fade < 1;
  }

  /** One frame. `dt` in seconds. Returns false when nothing was drawn. */
  frame(dt: number): boolean {
    if (this.disposed || this.frozen || !this.visible || !this.running) return false;
    const t0 = performance.now();
    const step = Math.min(dt, 1 / 15);
    this.advance(step);
    this.draw();
    const cpu = performance.now() - t0;
    this.stats.cpuMs += (cpu - this.stats.cpuMs) * 0.1;
    this.stats.frameMs += (dt * 1000 - this.stats.frameMs) * 0.1;
    this.stats.fps = 1000 / Math.max(this.stats.frameMs, 0.001);
    this.stats.frames++;
    this.adaptQuality(dt);
    return true;
  }

  /** Too slow for long enough: draw fewer pixels. Never while the camera is moving. */
  private adaptQuality(dt: number) {
    if (this.debug.noAdapt || this.debug.dpr || this.rig.moving) return;
    const a = this.adapt;
    if (this.time < a.cool) return;
    a.sum += dt;
    if (++a.n < 90) return;
    const avg = a.sum / a.n;
    a.n = 0;
    a.sum = 0;
    if (avg > 0.024 && this.dpr > 1) {
      this.dpr = this.dpr > 1.5 ? 1.5 : this.dpr > 1.25 ? 1.25 : 1;
      this.applySize();
      a.cool = this.time + 2;
    }
  }

  /** Advance everything by `dt` seconds (no drawing). */
  private advance(dt: number) {
    this.lastDt = dt;
    this.time += dt;
    const time = this.time;
    this.shared.uTime.value = time;
    if (dt > 0) this.timeline.time(this.timeline.time() + dt);

    if (this.fade < 1) this.fade = this.fadeDur > 0 ? Math.min(1, this.fade + dt / this.fadeDur) : 1;
    const want = this.active ? 1 : 0;
    if (this.presence !== want) {
      const rate = this.opts.reduced ? 4 : want ? 1 / 1.3 : 1 / 0.8;
      this.presence = want ? Math.min(1, this.presence + dt * rate) : Math.max(0, this.presence - dt * rate);
    }
    const pres = this.presence;

    this.policy(dt);
    this.simulate(dt, pres);
    this.simulateFar(dt, pres);

    /* ── the camera, and what follows it ── */
    const sel = this.sel;
    if (sel >= 0) {
      const a = this.agents[sel];
      this.focusT += dt;
      // The camera follows the firefly gently: a soft spring onto where it is.
      this.target.lerp(a.pos, 1 - Math.exp(-dt * 5));
    }
    this.rig.update(dt);
    const rig = this.rig;
    const cam = rig.camera;
    const focus = rig.focusAmount;

    // The light the chosen one throws is its own colour.
    if (sel >= 0) {
      const t = this.agents[sel].tint;
      const k = 1 - Math.exp(-dt * 4);
      this.keyColor.r += (t[0] - this.keyColor.r) * k;
      this.keyColor.g += (t[1] - this.keyColor.g) * k;
      this.keyColor.b += (t[2] - this.keyColor.b) * k;
      this.shared.uKeyColor.value.copy(this.keyColor);
    }
    // What is not chosen steps back: with the lens in a close-up, by the chosen one's own light without it.
    const selAmt = sel >= 0 ? this.agents[sel].sel : 0;
    this.dimAmt += ((sel >= 0 ? 1 : 0) - this.dimAmt) * (1 - Math.exp(-dt * 3));
    const dim = Math.max(focus, this.opts.reduced ? this.dimAmt * 0.7 : 0);
    this.shared.uFocus.value = dim;
    this.shared.uLens.value.set(rig.now.focus, rig.now.aperture);
    this.shared.uLevel.value = pres;
    this.shared.uRimDir.value.set(-0.55, 0.62, 0.56).transformDirection(cam.matrixWorldInverse);

    // The chosen lantern as a light in the scene. It outlives the focus by a moment, as it flies off.
    // Without the camera move the whole foreground is in its reach: it is turned down, or the meadow would change its grade.
    const keyWant = sel >= 0 ? (0.55 + 1.65 * selAmt) * (this.opts.reduced ? 0.35 : 1) : 0;
    this.keyLevel += (keyWant - this.keyLevel) * (1 - Math.exp(-dt * (sel >= 0 ? 4 : 2.2)));
    if (sel >= 0) this.key.copy(this.agents[sel].lamp);
    this.shared.uKey.value.set(this.key.x, this.key.y, this.key.z, this.keyLevel < 0.004 ? 0 : this.keyLevel);

    /* ── the painting behind the lens ── */
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / this.h;
    const backD = DEPTH.backdrop + cam.position.z;
    const backPx = rig.blurAt(backD) / (perPx * backD);
    const grassD = DEPTH.grass + cam.position.z;
    const grassPx = grassD > 0.05 ? rig.blurAt(grassD) / (perPx * grassD) : 0;
    this.scenery.update({
      backdropBlur: clamp(Math.log2(1 + backPx / 2.4), 0, 3),
      grassBlur: clamp(Math.log2(1 + grassPx / 4), 0, 2),
      // The camera goes through the grass: it is let go just before the lens reaches it.
      grassOpacity: ss(0.5, 2.2, grassD),
      presence: pres,
      dim: 1 - 0.34 * dim,
      mist: 1,
    });

    /* ── tell the host where the chosen one is ── */
    if (sel >= 0) {
      const a = this.agents[sel];
      if (!this.revealed && (this.opts.reduced ? this.focusT > 0.12 : rig.progress >= (this.switching ? REVEAL_AT_SWITCH : REVEAL_AT) || !rig.moving)) this.revealed = true;
      if (this.revealed) {
        // The anchor is the lantern (the artist's GlowAnchor): the card opens out of the light.
        V.copy(a.lamp).project(cam);
        const dist = a.pos.distanceTo(cam.position);
        const r = (this.models.hero.radius * HERO) / (perPx * Math.max(dist, 0.1));
        // While the camera is still arriving, the anchor is where the lantern will land.
        const arriving = !this.opts.reduced && rig.progress < 1;
        const closePx = ((2 * Math.tan(THREE.MathUtils.degToRad(CLOSE_FOV) / 2)) / this.h) * rig.closeDistance();
        const x = arriving ? this.landing.x : (V.x * 0.5 + 0.5) * this.w;
        const y = arriving ? this.landing.y - (this.models.hero.lamp.y * HERO) / closePx : (1 - (V.y * 0.5 + 0.5)) * this.h;
        const rr = arriving ? (this.models.hero.radius * HERO) / closePx : r;
        this.emit(a.job, x, y, rr);
      }
    }
  }

  private simulate(dt: number, pres: number) {
    const agents = this.agents;
    const n = agents.length;
    const time = this.time;
    const cam = this.rig.camera;
    const heroes = this.heroes;
    const halos = this.halos;
    const model = this.models.hero;
    const reduced = this.opts.reduced;
    const dimOthers = this.shared.uFocus.value;
    const F = 0.13;
    // While the camera is on one firefly the others keep out of its shot: clear of the line from
    // where the camera will stand to the chosen one. Behind it they stay, as lights out of focus.
    const sel = this.sel;
    const stage = sel >= 0 && this.rig.closeUp;
    this.clearAmt += ((stage ? 1 : 0) - this.clearAmt) * (1 - Math.exp(-dt * 3));
    const lens = this.rig.closePos;
    const chosen = stage ? agents[sel].pos : null;
    const sx0 = chosen ? chosen.x - lens.x : 0;
    const sy0 = chosen ? chosen.y - lens.y : 0;
    const sz0 = chosen ? chosen.z - lens.z : 0;
    const sLen2 = sx0 * sx0 + sy0 * sy0 + sz0 * sz0 || 1;
    for (let i = 0; i < n; i++) {
      const a = agents[i];
      /* ── what it is doing ── */
      if (a.mode === FLY && time > a.nextPause) {
        a.mode = PAUSE;
        a.until = time + 1.6 + this.rand() * 2.2;
      } else if (a.mode === PAUSE && time > a.until) {
        a.mode = FLY;
        a.nextPause = time + 5 + this.rand() * 10;
      } else if (a.mode === LEAVE && time > a.until) {
        a.mode = FLY;
        a.nextPause = time + 4 + this.rand() * 8;
      }
      const held = a.mode === HELD;
      const speedT = a.mode === FLY ? 1 : a.mode === PAUSE ? 0.06 : held ? 0 : 1.7;
      a.speedK += (speedT - a.speedK) * (1 - Math.exp(-dt * (held ? 5 : 1.5)));
      const hoverT = a.mode === PAUSE || held ? 1 : 0;
      a.hoverW += (hoverT - a.hoverW) * (1 - Math.exp(-dt * (held ? 6 : 2.4)));
      a.sel += ((held ? 1 : 0) - a.sel) * (1 - Math.exp(-dt * (held ? 3.2 : 2.4)));

      /* ── where it wants to go: the curl of a slow noise field, on a leash to its home ── */
      curl3(a.pos.x * F + a.seed, a.pos.y * F - a.seed * 0.7, a.pos.z * F + time * 0.021, C3);
      let dx = C3[0] * a.cruise;
      let dy = C3[1] * a.cruise * 0.62;
      let dz = C3[2] * a.cruise * 0.5;
      const hx = a.home.x - a.pos.x;
      const hy = a.home.y - a.pos.y;
      const hz = a.home.z - a.pos.z;
      const hl = Math.hypot(hx, hy, hz);
      if (hl > a.range) {
        const pull = ((hl - a.range) * 0.85) / hl;
        dx += hx * pull;
        dy += hy * pull;
        dz += hz * pull;
      }
      // Keep clear of each other (a few dozen: every pair is cheaper than a grid).
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const b = agents[j];
        const sx = a.pos.x - b.pos.x;
        const sy = a.pos.y - b.pos.y;
        const sz = a.pos.z - b.pos.z;
        const d2 = sx * sx + sy * sy + sz * sz;
        if (d2 < 1.3 && d2 > 1e-5) {
          const k = (1.3 - d2) * 0.9;
          dx += sx * k;
          dy += sy * k;
          dz += sz * k;
        }
      }
      const steer = 1 - Math.exp(-dt * (a.mode === LEAVE ? 0.9 : held ? 5 : 1.35));
      a.vel.x += (dx * a.speedK - a.vel.x) * steer;
      a.vel.y += (dy * a.speedK - a.vel.y) * steer;
      a.vel.z += (dz * a.speedK - a.vel.z) * steer;
      a.pos.addScaledVector(a.vel, dt);
      if (chosen && i !== sel && this.clearAmt > 0.01) {
        const t = clamp(((a.pos.x - lens.x) * sx0 + (a.pos.y - lens.y) * sy0 + (a.pos.z - lens.z) * sz0) / sLen2, -0.1, 1.12);
        let ox = a.pos.x - (lens.x + sx0 * t);
        let oy = a.pos.y - (lens.y + sy0 * t);
        const oz = a.pos.z - (lens.z + sz0 * t);
        const ol = Math.hypot(ox, oy, oz);
        if (ol < CLEAR) {
          // Dead on the line: step to whichever side its seed says.
          if (ol < 1e-3) {
            ox = frac(a.seed) < 0.5 ? -1 : 1;
            oy = 0.3;
          }
          const k = ((CLEAR - ol) / CLEAR) * 3.2 * this.clearAmt * dt;
          const inv = 1 / Math.max(Math.hypot(ox, oy), 0.05);
          a.pos.x += ox * inv * k;
          a.pos.y += oy * inv * k;
        }
      }

      /* ── which way it faces: along its flight, cheated toward the lens; hovering, at the lens ── */
      const speed = Math.hypot(a.vel.x, a.vel.y, a.vel.z);
      const cx = cam.position.x - a.pos.x;
      const cy = cam.position.y - a.pos.y;
      const cz = cam.position.z - a.pos.z;
      const toCam = Math.atan2(cx, cz);
      const along = Math.atan2(a.vel.x, a.vel.z * 0.5 + 0.55 * a.cruise + 0.12);
      const face = a.hoverW * a.hoverW * (3 - 2 * a.hoverW);
      const yawT = along + turn(toCam - along) * face;
      const dyaw = turn(yawT - a.yaw) * (1 - Math.exp(-dt * (held ? 5.5 : 2.6)));
      a.yaw += dyaw;
      a.yawRate += ((dt > 0 ? dyaw / dt : 0) - a.yawRate) * (1 - Math.exp(-dt * 6));
      // Nose down with speed, up when climbing; the chosen one looks up or down at the lens.
      const lookUp = -Math.atan2(cy, Math.hypot(cx, cz)) * 0.7;
      const pitchT = (0.2 * Math.min(1.4, speed / Math.max(a.cruise, 0.1)) - a.vel.y * 0.16) * (1 - face) + lookUp * a.sel;
      a.pitch += (pitchT - a.pitch) * (1 - Math.exp(-dt * 4));
      // Bank into the turn.
      const rollT = clamp(-a.yawRate * 0.34, -0.5, 0.5) * (1 - face);
      a.roll += (rollT - a.roll) * (1 - Math.exp(-dt * 5));

      /* ── its rig ── */
      const rg = heroes.rigs[i];
      if (a.noticeT >= 0) {
        a.noticeT += dt;
        // `notice` plays once over the hover; it fades out into the loop it ends on.
        rg.w.notice = reduced ? 0 : ss(0, 0.12, a.noticeT) * (1 - ss(0.95, 1.25, a.noticeT * rg.rate));
        if (a.noticeT * rg.rate > 1.3 || !held) {
          a.noticeT = -1;
          rg.w.notice = 0;
        }
      }
      rg.w.hover = a.hoverW * (1 - rg.w.notice);
      if (time > a.blinkAt) {
        heroes.blink(i);
        a.blinkAt = time + 1.8 + this.rand() * 4.5;
      }

      /* ── its place, size and light ── */
      // Coming up with the scene: the lantern first, then the body grows around it.
      const born = ss(0.25 + 0.4 * frac(a.seed), 0.6 + 0.4 * frac(a.seed), pres);
      const bob = Math.sin(time * 6.2 + a.seed) * 0.022 * HERO * (1 - a.hoverW);
      E.set(a.pitch, a.yaw, a.roll);
      Q.setFromEuler(E);
      V.set(a.pos.x, a.pos.y + bob, a.pos.z);
      const size = HERO * (1 + 0.06 * a.sel) * Math.max(born, 1e-4);
      M.compose(V, Q, S.setScalar(size));
      heroes.setMatrix(i, M);
      a.lamp.copy(model.lamp).applyMatrix4(M);

      a.phase += a.rate * dt;
      const pulse = 0.5 + 0.5 * Math.sin(a.phase) * (0.75 + 0.25 * Math.sin(a.phase * 0.37 + a.seed));
      const level = (a.base * (0.5 + 0.5 * pulse) * (1 + 0.4 * a.hot) + 0.9 * a.sel) * ss(0, 0.5, pres);
      // What drives the lantern itself has a ceiling (past it the painted bulb clips flat); the
      // extra brightness of a chosen firefly is in its halo and in the light it throws.
      const lantern = 1.25 * (1 - Math.exp(-level * 1.15));
      // Close to the lens it lets the camera through.
      const dist = Math.hypot(cx, cy, cz);
      const near = held ? 1 : ss(HERO * 1.4, HERO * 3.4, dist);
      // Wings in fast flight are a blur; hovering, they are there to see.
      heroes.setFx(i, lantern, near, a.sel, 0.62 + 0.38 * a.hoverW);

      const others = 1 - 0.4 * dimOthers * (1 - a.sel);
      halos.pos.setXYZ(i, a.lamp.x, a.lamp.y, a.lamp.z);
      halos.look.setXYZW(i, HERO * (0.8 + 0.35 * a.sel), level * 0.75 * (1 - 0.45 * a.sel) * others * near, 0, 0);
      // The halo hangs behind the whole character along the view ray, so the body stands against it.
      halos.drift.setXYZW(i, 0, 0, 0, HERO * 0.62);
    }
  }

  private simulateFar(dt: number, pres: number) {
    const far = this.far;
    const halos = this.halos;
    const model = this.models.lod;
    const time = this.time;
    const tanH = this.tanH();
    const off = this.agents.length;
    const grow = ss(0.1, 0.8, pres);
    const dim = 1 - 0.4 * this.shared.uFocus.value;
    for (let i = 0; i < this.fars.length; i++) {
      const f = this.fars[i];
      const t = time * f.w;
      const x = f.hx * f.hz * tanH + f.a * Math.sin(t + f.p1) + f.a * 0.4 * Math.sin(t * 2.3 + f.p2);
      const y = f.hy * f.hz * this.tanV + f.b * Math.sin(t * 1.3 + f.p2) + f.b * 0.3 * Math.sin(t * 3.1 + f.p3);
      const z = -f.hz + f.c * Math.cos(t * 0.8 + f.p3);
      const vx = f.w * f.a * (Math.cos(t + f.p1) + 0.92 * Math.cos(t * 2.3 + f.p2));
      const vz = -f.w * f.c * 0.8 * Math.sin(t * 0.8 + f.p3);
      f.yaw += turn(Math.atan2(vx, vz * 0.5 + 0.3) - f.yaw) * (1 - Math.exp(-dt * 2.5));
      E.set(0.16, f.yaw, 0);
      Q.setFromEuler(E);
      V.set(x, y, z);
      M.compose(V, Q, S.setScalar(f.size * Math.max(grow, 1e-4)));
      far.setMatrix(i, M);
      f.phase += f.rate * dt;
      const level = f.base * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin(f.phase))) * grow;
      far.setFx(i, 1.25 * (1 - Math.exp(-level * 1.15)), 1, 0, 0.7);
      V2.copy(model.lamp).applyMatrix4(M);
      halos.pos.setXYZ(off + i, V2.x, V2.y, V2.z);
      halos.look.setXYZW(off + i, f.size * 0.7, level * 0.5 * dim, 0, 0);
      halos.drift.setXYZW(off + i, 0, 0, 0, f.size * 0.62);
    }
  }

  /** Run the rigs' clips for the step just advanced, and hand the frame's buffers to the GPU. */
  private animate() {
    const heroes = this.heroes;
    const far = this.far;
    const show = this.presence > 0.002;
    heroes.group.visible = far.group.visible = this.halos.mesh.visible = this.sprites.mesh.visible = show;
    if (!show) return;
    const dt = this.lastDt;
    for (let i = 0; i < heroes.rigs.length; i++) heroes.advance(i, dt);
    for (let i = 0; i < far.rigs.length; i++) far.advance(i, dt);
    heroes.commit();
    far.commit();
    this.halos.pos.needsUpdate = this.halos.look.needsUpdate = this.halos.drift.needsUpdate = true;
  }

  private draw() {
    const pres = this.presence;
    this.animate();
    const focus = this.rig.focusAmount;
    this.renderer.info.reset();
    this.post.render(this.scene, this.rig.camera, {
      bloom: 0.95 + 0.25 * focus,
      threshold: this.hdr ? 1.0 : 0.8,
      knee: 0.5,
      exposure: 1,
      vignette: 0.3 * focus * pres,
      fade: this.fade * this.fade * (3 - 2 * this.fade),
      focus: this.rig.now.focus,
      aperture: this.rig.now.aperture,
    });
    this.stats.calls = this.renderer.info.render.calls;
  }

  private lastDt = 0;

  /* ─────────────────────────────────────────────────── tests, tuning ── */

  /** Stop the live loop; `step` then advances exact amounts (deterministic contact sheets). */
  freeze(on: boolean) {
    this.frozen = on;
  }
  step(dt: number, n = 1) {
    for (let i = 0; i < n; i++) {
      this.advance(dt);
      if (i < n - 1) this.animate();
    }
    this.draw();
    this.stats.frames++;
  }
  /** Where a job's firefly is on screen (host px), or null when no firefly carries it. */
  screenOf(job: number): { x: number; y: number; r: number; depth: number } | null {
    const i = this.carrier[job];
    if (i === undefined || i < 0) return null;
    const a = this.agents[i];
    const cam = this.rig.camera;
    V.copy(a.pos).project(cam);
    const dist = a.pos.distanceTo(cam.position);
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / this.h;
    return { x: (V.x * 0.5 + 0.5) * this.w, y: (1 - (V.y * 0.5 + 0.5)) * this.h, r: (this.models.hero.radius * HERO) / (perPx * dist), depth: dist };
  }
  get focused(): number {
    return this.sel >= 0 ? this.agents[this.sel].job : -1;
  }
  get state() {
    const c = this.rig.camera;
    return { time: this.time, presence: this.presence, fade: this.fade, focus: this.rig.focusAmount, moving: this.rig.moving, progress: this.rig.progress, fov: c.fov, cam: [c.position.x, c.position.y, c.position.z], sel: this.focused, active: this.active };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.timeline.kill();
    this.rig.dispose();
    this.heroes.dispose();
    this.far.dispose();
    this.halos.dispose();
    this.sprites.dispose();
    this.scenery.dispose();
    this.post.dispose();
    this.env.dispose();
    for (const k of ["uTex"] as const) {
      const t = (this.scenery.uBackdrop[k]?.value ?? null) as THREE.Texture | null;
      (t?.userData.bitmap as ImageBitmap | undefined)?.close?.();
      t?.dispose();
      const g = (this.scenery.uGrass[k]?.value ?? null) as THREE.Texture | null;
      (g?.userData.bitmap as ImageBitmap | undefined)?.close?.();
      g?.dispose();
    }
    this.models.hero.parts.forEach((p) => (p.geometry.dispose(), p.material.dispose()));
    this.models.lod.parts.forEach((p) => (p.geometry.dispose(), p.material.dispose()));
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
