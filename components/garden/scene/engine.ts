/**
 * THE GARDEN — the runtime of the 3D garden scene (GardenScene.tsx is its React shell). No React here.
 *
 * About fifteen job flowers stand in the painted meadow's foreground (stage.ts picks them and their
 * places). Everything else is the firefly scene's, imported, not copied:
 *
 *   scenery   components/fireflies/scene/scenery.ts: the painted meadow and grass laid out pixel for
 *             pixel as the page shows them in the wide shot (`matchPage`), the mist, the moon.
 *   camera    rig.ts: a crane move onto the flower's heart, and back to the locked-off wide shot.
 *   lens      post.ts: bloom, depth of field in a close-up, grade, the fade from black.
 *
 *   one clock      `frame(dt)` is called by the host's single loop (the gsap ticker). The camera's
 *                  GSAP move runs on a paused timeline this engine owns and advances by that dt, so a
 *                  hidden tab or an off-screen host freezes everything, and a test can step it.
 *   flowers        one per job, standing on one ground plane, bases sunk in the painted grass. Open
 *                  state is the job's stage (`openForFit`); a focused flower opens fully, and goes
 *                  back to its stage when let go, eased over OPEN_S.
 *   focus          pointer rays against a sphere round each flower's head (enlarged to a minimum on
 *                  screen). A flower under a moving pointer for a moment is chosen: the camera flies
 *                  to it, and its job is revealed (onFocus) as the camera arrives, anchored on the
 *                  heart. Touch: a first tap marks a flower (it lights), a second tap on it opens it.
 *   presence       0 is the page's painted meadow exactly, no flowers. 1 is the whole garden: the
 *                  flowers grow up out of the grass, the moon and mist come up. `setActive` eases
 *                  between them so the scene takes over from the painting and hands back without a cut.
 */

import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { readWorld } from "@/lib/theme";
import { Post } from "@/components/fireflies/scene/post";
import { CLOSE_FOV, CameraRig, WIDE_FOV, type Composition } from "@/components/fireflies/scene/rig";
import { DEPTH, Scenery, type Layout } from "@/components/fireflies/scene/scenery";
import { readFfColors } from "@/components/fireflies/scene/tokens";
import type { FireflyFraming, FireflyJob } from "@/components/fireflies/scene/types";
import { OPEN_FULL, openForFit, type FlowerKind, type GardenFlower } from "../flowers";
import { freeTexture, loadTexture, readManifest, widthFor } from "./assets";
import { makeFlower } from "./flowerSource";
import { kindOf, pickGardenJobs, slotsFor } from "./stage";

/* ───────────────────────────────────────────────────────────── tuning ── */

/** A flower's height in world units (before its kind's own proportion). */
const FLOWER = 1.6;
const KIND_HEIGHT: Record<FlowerKind, number> = { moon: 1, bell: 0.96, poppy: 0.92, allium: 1.08, lavender: 1.04 };
/** Seconds the pointer must rest on a flower before it is chosen (from the wide shot / from a close-up). */
const DWELL = 0.08;
const DWELL_RETARGET = 0.18;
/** Seconds the pointer may be off the chosen flower before the focus is left. */
const GRACE = 0.45;
/** Seconds a flower takes to open fully when chosen, and to go back to its stage when let go. */
const OPEN_S = 0.6;
/** Camera move progress at which the job is revealed (onFocus fires). Sooner between two flowers: the card is already open. */
const REVEAL_AT = 0.56;
const REVEAL_AT_SWITCH = 0.32;
/** A first tap marks a flower for this long; a second tap on it inside that time opens it. */
const TAP_HOLD = 5;
/**
 * The head's radius, in flower units, for picking and for the anchor's `r`. GardenFlower.radius is a
 * sphere round the whole flower (stem included), too big for either: the card would stand far off.
 */
const HEAD = 0.27;
/**
 * The anchor's `r` is a circle round the head with room for the petals' reach and sway: the explore
 * stop stands the card `0.75 r + 16` px off (a rule made for a firefly's sparse wings), and a flower's
 * head is a solid disc of petals, so this is what keeps the card off them.
 */
const ANCHOR_R = 1.3;
/** How far (world units, past their own head) flowers keep from the line between the lens and the chosen one. */
const CLEAR = 0.45;
/** The most a flower in the way leans aside (radians). */
const LEAN = 0.85;
/** The part of a flower the close-up is composed on, as a share of its height (the head and the top of the stem). */
const SUBJECT = 0.4;
/** Docked in portrait the flower has only the space above the sheet: it is framed wider. */
const SUBJECT_DOCKED = 0.62;
/** The page's meadow at the end of pass 2 (as the firefly engine's PAGE_FRAMING; not imported, that would pull in its engine). */
export const PAGE_FRAMING: FireflyFraming = { meadowScale: 1.0305, grassLow: 0.2898 };

export type Quality = { phone: boolean; maxDpr: number; samples: number; bloomLevels: number; bloomStart: 2 | 4; mist: number; dof: boolean };

export function pickQuality(phone: boolean, dpr: number): Quality {
  return phone ? { phone, maxDpr: 2, samples: 0, bloomLevels: 3, bloomStart: 4, mist: 1, dof: false } : { phone, maxDpr: 2, samples: dpr >= 1.75 ? 2 : 4, bloomLevels: 5, bloomStart: 2, mist: 3, dof: true };
}

export type FocusSource = "pointer" | "touch" | "api";

export type GardenOptions = {
  host: HTMLElement;
  jobs: readonly FireflyJob[];
  reduced: boolean;
  phone: boolean;
  framing: FireflyFraming;
  intro: "match" | "veil";
  /** `job` is an index into `jobs`, or -1. `x, y` are CSS px inside the host; `r` the flower's radius on screen. */
  onFocus: (job: number, x: number, y: number, r: number) => void;
  /** The pointer is over a flower it could choose (for the cursor). */
  onHot?: (hot: boolean) => void;
};

/** Test switches, read once from `window.__gardenDebug`. */
type Debug = { dpr?: number; noAdapt?: boolean };

type Bloom = {
  flower: GardenFlower;
  /** Its own job (index into jobs), and the job it carries right now (another, while lent to the list). */
  own: number;
  job: number;
  kind: FlowerKind;
  /** World height. */
  height: number;
  seed: number;
  yawJitter: number;
  /** Stem base, world. */
  base: THREE.Vector3;
  /** Its place at full size, and from it the heart and the head's radius, world. */
  place: THREE.Matrix4;
  heart: THREE.Vector3;
  radius: number;
  /** Open: the eased value, where it is going, where it started, and when. */
  open: number;
  openFrom: number;
  openTo: number;
  openAt: number;
  sentOpen: number;
  lit: number;
  sentLit: number;
  hot: number;
  lantern: boolean;
  /** -1..1: leaning out of a close-up's way (eased), and how far it has sunk with it. */
  lean: number;
};

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const frac = (x: number) => x - Math.floor(x);
const lin = (c: readonly [number, number, number]) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

const V = new THREE.Vector3();
const V2 = new THREE.Vector3();

export class Garden {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly stats = { frameMs: 0, cpuMs: 0, fps: 0, dpr: 1, calls: 0, triangles: 0, flowers: 0, frames: 0 };

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig: CameraRig;
  private timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });
  private scenery: Scenery;
  private post: Post;
  private garden = new THREE.Group();
  private blooms: Bloom[];
  /** job index → flower index, or -1 (the job has no flower on stage). */
  private carrier: Int16Array;
  private shared: { uTime: { value: number }; uKey: { value: THREE.Vector4 }; uKeyColor: { value: THREE.Color }; uRimColor: { value: THREE.Color } };
  private layoutIn: Layout;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private tanV = Math.tan(THREE.MathUtils.degToRad(WIDE_FOV) / 2);
  private time = 0;
  private lastDt = 0;
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
  private comp: Composition = { x: 0, y: 0 };
  private landing = { x: 0, y: 0 };
  private sent = { job: -1, x: -1e4, y: -1e4, r: 0 };
  private key = new THREE.Vector3();
  private keyLevel = 0;
  private ptr = { x: 0, y: 0, inside: false, parked: false, mouse: false, lastMove: -10, movedSinceFocus: false };
  private hotIdx = -1;
  private hotT = 0;
  private away = 0;
  private wasHot = false;
  /** Touch: the flower a first tap marked, and until when. */
  private marked = -1;
  private markedUntil = 0;
  private ray = new THREE.Ray();
  /** 0..1: how much the flowers in a close-up's way have stepped aside. */
  private clearAmt = 0;
  private adapt = { n: 0, sum: 0, cool: 0 };

  private constructor(
    private opts: GardenOptions,
    renderer: THREE.WebGLRenderer,
    quality: Quality,
    flowers: { flower: GardenFlower; job: number }[],
    tex: { meadow: THREE.Texture; grass: THREE.Texture },
    sizes: { meadowAr: number; grassAr: number },
    debug: Debug,
  ) {
    this.renderer = renderer;
    this.canvas = renderer.domElement;
    this.quality = quality;
    this.debug = debug;
    this.fadeDur = opts.intro === "veil" ? (opts.reduced ? 0.5 : 1.5) : 0;
    this.fade = opts.intro === "veil" ? 0 : 1;
    this.hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const ff = readFfColors(opts.host);
    const { colors: world } = readWorld();

    this.shared = {
      uTime: { value: 0 },
      uKey: { value: new THREE.Vector4(0, 0, -20, 0) },
      uKeyColor: { value: lin(world.lampHeart) },
      uRimColor: { value: lin(ff.rim).multiplyScalar(0.55) },
    };

    /* ── camera ── */
    this.rig = new CameraRig(this.timeline);
    this.rig.setReduced(opts.reduced);

    /* ── light: a dim night sky, the moon from the upper left ── */
    this.scene.add(new THREE.HemisphereLight(lin(ff.rim), lin(ff.night), 1.25));
    const moon = new THREE.DirectionalLight(lin(ff.moon), 1.6);
    moon.position.set(-0.55, 0.62, 0.56);
    this.scene.add(moon);
    // A soft fill from the lens side, so the faces turned to us are not lost in the dark.
    const fill = new THREE.DirectionalLight(lin(ff.mist), 0.55);
    fill.position.set(0.3, 0.2, 1);
    this.scene.add(fill);

    /* ── scenery ── */
    this.scenery = new Scenery(renderer, tex, { night: lin(ff.night), sky: lin(ff.sky), moon: lin(ff.moon), mist: lin(ff.mist) }, this.shared, { hdr: this.hdr, mistLayers: quality.mist });
    this.scene.add(this.scenery.group);
    this.layoutIn = { vw: 1, vh: 1, fov: WIDE_FOV, meadowAr: sizes.meadowAr, meadowScale: opts.framing.meadowScale, grassAr: sizes.grassAr, grassLow: opts.framing.grassLow };

    /* ── flowers ── */
    this.carrier = new Int16Array(opts.jobs.length).fill(-1);
    this.blooms = flowers.map(({ flower, job }, i) => {
      const seed = frac(Math.sin((i + 1) * 91.17) * 43758.5453);
      const kind = flower.kind;
      const open = openForFit(opts.jobs[job].fit);
      flower.setOpen(open);
      flower.setLit(0);
      flower.setLantern(null, 0);
      this.garden.add(flower.group);
      this.carrier[job] = i;
      return {
        flower,
        own: job,
        job,
        kind,
        height: FLOWER * KIND_HEIGHT[kind] * (0.94 + 0.12 * seed),
        seed,
        yawJitter: (frac(seed * 7.31) - 0.5) * 0.7,
        base: new THREE.Vector3(),
        place: new THREE.Matrix4(),
        heart: new THREE.Vector3(),
        radius: 0,
        open,
        openFrom: open,
        openTo: open,
        openAt: -10,
        sentOpen: open,
        lit: 0,
        sentLit: 0,
        hot: 0,
        lantern: false,
        lean: 0,
      };
    });
    this.scene.add(this.garden);

    /* ── lens ── */
    this.post = new Post(renderer, { hdr: this.hdr, samples: quality.samples, bloomLevels: quality.bloomLevels, bloomStart: quality.bloomStart, dof: quality.dof });
    this.post.veil.copy(lin(ff.veil));

    this.stats.flowers = this.blooms.length;
    if (opts.intro === "veil") this.presence = 1;
  }

  /** Load, decode and compile everything, and draw the first frame. Resolves when the scene can be shown. */
  static async create(opts: GardenOptions): Promise<Garden> {
    const debug = ((window as unknown as { __gardenDebug?: Debug }).__gardenDebug ?? {}) as Debug;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance", premultipliedAlpha: true });
    if (!gl) throw new Error("no-webgl2");
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
    renderer.autoClear = true;
    renderer.info.autoReset = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1); // token-ok: clear value of the offscreen target, never seen (the backdrop covers it)
    const quality = pickQuality(opts.phone, Math.min(window.devicePixelRatio || 1, 2));
    const made: GardenFlower[] = [];
    try {
      if (!opts.jobs.length) throw new Error("no-jobs");
      const rect = opts.host.getBoundingClientRect();
      const dpr = debug.dpr ?? Math.min(window.devicePixelRatio || 1, quality.maxDpr);
      const manifest = await readManifest();
      const mw = widthFor(manifest["meadow-night"].widths, opts.phone ? 960 : 1280);
      const gNeed = Math.max(rect.width, (rect.height * manifest["grass-fg"].width) / manifest["grass-fg"].height) * dpr * 0.8;
      const gw = widthFor(manifest["grass-fg"].widths, opts.phone ? 960 : gNeed);
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const picked = pickGardenJobs(opts.jobs);
      const [meadow, grass, flowers] = await Promise.all([
        loadTexture(`/scenes/meadow-night-${mw}.webp`, { premultiply: false, srgb: true, maxAniso }),
        loadTexture(`/scenes/grass-fg-${gw}.webp`, { premultiply: true, srgb: false, maxAniso }),
        Promise.all(
          picked.map(async (job) => {
            const flower = await makeFlower(THREE, kindOf(opts.jobs[job]));
            made.push(flower);
            return { flower, job };
          }),
        ),
      ]);
      const g = new Garden(opts, renderer, quality, flowers, { meadow, grass }, { meadowAr: manifest["meadow-night"].width / manifest["meadow-night"].height, grassAr: manifest["grass-fg"].width / manifest["grass-fg"].height }, debug);
      g.resize(Math.max(1, rect.width), Math.max(1, rect.height));
      // Compile every program before the first visible frame, then draw one (uploads the textures).
      // The flowers are compiled too, even when the first frame (presence 0) does not show them.
      g.advance(0);
      const shown = g.garden.visible;
      g.garden.visible = true;
      g.blooms.forEach((b) => (b.flower.group.visible = true));
      await renderer.compileAsync(g.scene, g.rig.camera);
      g.garden.visible = shown;
      g.advance(0);
      g.draw();
      return g;
    } catch (err) {
      made.forEach((f) => f.dispose());
      renderer.dispose();
      throw err;
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
    this.plant();
    this.sent.x = -1e4;
  }

  private applySize() {
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.post.setSize(Math.round(this.w * this.dpr), Math.round(this.h * this.dpr));
    this.stats.dpr = this.dpr;
  }

  /** Stand every flower in its slot for this aspect (stage.ts): its heart where the slot says, at the slot's depth. */
  private plant() {
    const aspect = this.w / this.h;
    const slots = slotsFor(aspect);
    const tanV = this.tanV;
    const tanH = tanV * aspect;
    for (let i = 0; i < this.blooms.length; i++) {
      const b = this.blooms[i];
      const slot = slots[i % slots.length];
      // Depth from how tall the slot asks a reference flower to stand on screen.
      const d = FLOWER / (2 * slot.s * tanV);
      const x = (slot.x * 2 - 1) * d * tanH;
      const heartY = (1 - slot.y * 2) * d * tanV;
      b.base.set(x, heartY - b.flower.heart.y * b.height, -d);
      const g = b.flower.group;
      g.position.copy(b.base);
      // Turned to the lens, give or take.
      g.rotation.set(0, Math.atan2(-x, d) + b.yawJitter, 0);
      g.scale.setScalar(b.height);
      g.updateMatrixWorld(true);
      b.place.copy(g.matrixWorld);
      b.heart.copy(b.flower.heart).applyMatrix4(b.place);
      b.radius = Math.min(b.flower.radius, HEAD) * b.height;
    }
  }

  setFraming(f: Partial<FireflyFraming>) {
    if (f.meadowScale !== undefined) this.layoutIn.meadowScale = f.meadowScale;
    if (f.grassLow !== undefined) this.layoutIn.grassLow = f.grassLow;
    this.scenery.layout(this.layoutIn);
  }

  redraw() {
    if (this.disposed) return;
    this.advance(0);
    this.draw();
  }

  /* ────────────────────────────────────────────────────────── focus ── */

  /** The flower for a job: its own, or (for a job with no flower on stage) the nearest stand-in, lent for the visit. */
  private flowerFor(job: number): number {
    const have = this.carrier[job];
    if (have >= 0) return have;
    const want = this.opts.jobs[job];
    const kind = kindOf(want);
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.blooms.length; i++) {
      if (i === this.sel) continue;
      const b = this.blooms[i];
      // Same kind first (flower type = role type), then the nearest in fit (so the stage is close).
      const score = (b.kind === kind ? 0 : 100) + Math.abs(this.opts.jobs[b.own].fit - want.fit);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) this.blooms[best].job = job;
    return best;
  }

  focusJob(job: number) {
    if (job < 0 || job >= this.opts.jobs.length) return;
    if (this.sel >= 0 && this.blooms[this.sel].job === job) return;
    const i = this.flowerFor(job);
    if (i < 0) return;
    // Its own flower, lent out to the list and chosen right now: it takes its own job back (the card switches).
    if (i === this.sel) this.blooms[i].job = job;
    else this.focus(i, "api");
  }

  setDocked(on: boolean) {
    this.docked = on;
  }

  private defaultComp(): Composition {
    // Docked: the flower high, the sheet under it. Otherwise left of centre, the card to its right.
    return this.docked ? { x: 0, y: this.w / this.h < 0.8 ? 0.56 : 0.42 } : { x: -0.24, y: 0.12 };
  }

  private focus(i: number, source: FocusSource) {
    if (i === this.sel) {
      this.source = source;
      return;
    }
    const prev = this.sel;
    if (prev >= 0) this.letGo(prev);
    this.switching = prev >= 0 && this.revealed;
    const b = this.blooms[i];
    this.sel = i;
    this.source = source;
    this.revealed = false;
    this.focusT = 0;
    this.away = 0;
    this.marked = -1;
    this.ptr.movedSinceFocus = false;
    if (!this.opts.reduced) this.openTo(b, OPEN_FULL);
    if (source === "pointer" && this.ptr.inside && !this.docked) {
      // Land it where the pointer is, so the pointer is still on it when the camera arrives.
      this.comp = { x: clamp((this.ptr.x / this.w) * 2 - 1, -0.5, 0.5), y: clamp(1 - (this.ptr.y / this.h) * 2, -0.2, 0.3) };
    } else this.comp = this.defaultComp();
    this.landing.x = (this.comp.x * 0.5 + 0.5) * this.w;
    this.landing.y = (1 - (this.comp.y * 0.5 + 0.5)) * this.h;
    this.rig.setSubject(b.height * (this.docked && this.w / this.h < 0.8 ? SUBJECT_DOCKED : SUBJECT));
    this.rig.focusOn(b.heart, this.comp);
  }

  private letGo(i: number) {
    const b = this.blooms[i];
    b.job = b.own;
    this.openTo(b, openForFit(this.opts.jobs[b.own].fit));
  }

  private openTo(b: Bloom, to: number) {
    if (b.openTo === to) return;
    b.openFrom = b.open;
    b.openTo = to;
    b.openAt = this.time;
    if (this.opts.reduced) b.open = b.openFrom = to;
  }

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

  pointerLeave(parked: boolean) {
    this.ptr.inside = false;
    this.ptr.parked = parked;
    this.ptr.movedSinceFocus = true;
    this.hotIdx = -1;
    this.hotT = 0;
  }

  /**
   * A click or a tap. A click on a flower chooses it. A tap on a flower marks it (it lights); a second
   * tap on the marked one opens it; with a card already open, one tap moves it to another flower.
   * On empty meadow, back to the wide shot.
   */
  tap(x: number, y: number, touch: boolean) {
    if (!this.active) return;
    this.setRay(x, y);
    const i = this.pick(touch ? 34 : 22, -1);
    if (i < 0) {
      this.marked = -1;
      this.clearFocus();
      return;
    }
    if (touch) {
      this.ptr.inside = false;
      if (this.sel < 0 && (this.marked !== i || this.time > this.markedUntil)) {
        this.marked = i;
        this.markedUntil = this.time + TAP_HOLD;
        return;
      }
    }
    this.focus(i, touch ? "touch" : "pointer");
  }

  private setRay(x: number, y: number) {
    const cam = this.rig.camera;
    V.set((x / this.w) * 2 - 1, 1 - (y / this.h) * 2, 0.5).unproject(cam);
    this.ray.origin.copy(cam.position);
    this.ray.direction.copy(V).sub(cam.position).normalize();
  }

  /** The flower under the current ray: a sphere round each head, at least `minPx` on screen. `only` tests one. */
  private pick(minPx: number, only: number): number {
    const o = this.ray.origin;
    const d = this.ray.direction;
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(this.rig.camera.fov) / 2)) / this.h;
    let best = -1;
    let bestScore = 1;
    const from = only >= 0 ? only : 0;
    const to = only >= 0 ? only + 1 : this.blooms.length;
    for (let i = from; i < to; i++) {
      const b = this.blooms[i];
      // A flower leaning out of the close-up is not where its spheres are, and is out of the way anyway.
      if (Math.abs(b.lean) > 0.2) continue;
      // The head, and two points down the stem (thinner), so a stem is a target too.
      for (let k = 0; k < 3; k++) {
        const f = k * 0.3;
        const px = b.heart.x + (b.base.x - b.heart.x) * f;
        const py = b.heart.y + (b.base.y - b.heart.y) * f;
        const pz = b.heart.z + (b.base.z - b.heart.z) * f;
        const lx = px - o.x;
        const ly = py - o.y;
        const lz = pz - o.z;
        const t = lx * d.x + ly * d.y + lz * d.z;
        if (t < 0.3) continue;
        const rr = b.radius * (k ? 0.55 : 1);
        const r = Math.max(rr * (only >= 0 ? 1.7 : 1.15), (k ? 0.6 : 1) * minPx * perPx * t);
        const d2 = lx * lx + ly * ly + lz * lz - t * t;
        // Nearer flowers win a tie.
        const score = (d2 / (r * r)) * (0.85 + 0.15 * Math.min(1, t / 20));
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
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
      // A pointer that rests is not a hover: it has to have moved.
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
    if (this.marked >= 0 && this.time > this.markedUntil) this.marked = -1;
    for (let i = 0; i < this.blooms.length; i++) {
      const b = this.blooms[i];
      const want = i === hot || i === this.marked ? 1 : 0;
      b.hot += (want - b.hot) * (1 - Math.exp(-dt * 10));
    }
    const isHot = hot >= 0;
    if (isHot !== this.wasHot) {
      this.wasHot = isHot;
      this.opts.onHot?.(isHot);
    }
    // Where the card docks, a hover holds until a click or tap elsewhere.
    if (this.sel >= 0 && this.source === "pointer" && !this.docked) {
      let on = p.parked;
      if (!on && p.inside) {
        this.setRay(p.x, p.y);
        on = this.pick(30, this.sel) >= 0;
      }
      if (on || !p.movedSinceFocus) this.away = 0;
      else this.away += dt;
      if (this.away > GRACE) this.clearFocus();
    }
  }

  /* ─────────────────────────────────────────────────────────── life ── */

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (!on) {
      this.clearFocus();
      this.marked = -1;
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

  get running(): boolean {
    return this.active || this.presence > 0.001 || this.rig.moving || this.rig.focusAmount > 0.001 || this.fade < 1;
  }

  frame(dt: number): boolean {
    if (this.disposed || this.frozen || !this.visible || !this.running) return false;
    const t0 = performance.now();
    this.advance(Math.min(dt, 1 / 15));
    this.draw();
    const cpu = performance.now() - t0;
    this.stats.cpuMs += (cpu - this.stats.cpuMs) * 0.1;
    this.stats.frameMs += (dt * 1000 - this.stats.frameMs) * 0.1;
    this.stats.fps = 1000 / Math.max(this.stats.frameMs, 0.001);
    this.stats.frames++;
    this.adaptQuality(dt);
    return true;
  }

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
    this.rig.update(dt);
    const rig = this.rig;
    const cam = rig.camera;
    const sel = this.sel;

    /* ── the flowers: grow up with the scene, open to their stage, light when chosen ── */
    this.garden.visible = pres > 0.002;
    // In a close-up, the flowers between the lens and the chosen one lean out of the shot (and sink a little).
    const stage = sel >= 0 && rig.closeUp;
    this.clearAmt += ((stage ? 1 : 0) - this.clearAmt) * (1 - Math.exp(-dt * 3));
    const lens = rig.closePos;
    const aim = stage ? this.blooms[sel].heart : null;
    const ax = aim ? aim.x - lens.x : 0;
    const ay = aim ? aim.y - lens.y : 0;
    const az = aim ? aim.z - lens.z : 0;
    const aLen2 = ax * ax + ay * ay + az * az || 1;
    for (let i = 0; i < this.blooms.length; i++) {
      const b = this.blooms[i];
      // Up out of the grass with the scene, each in its own time; reduced motion: there, or not.
      const born = this.opts.reduced ? (pres > 0.02 ? 1 : 0) : ss(0.1 + 0.45 * b.seed, 0.5 + 0.45 * b.seed, pres);
      let leanT = 0;
      if (aim && i !== sel) {
        // The nearest point to its heart on the line from where the lens will stand to the chosen heart.
        const t = ((b.heart.x - lens.x) * ax + (b.heart.y - lens.y) * ay + (b.heart.z - lens.z) * az) / aLen2;
        if (t > -0.05 && t < 0.98) {
          const ox = b.heart.x - (lens.x + ax * t);
          const oy = b.heart.y - (lens.y + ay * t);
          const oz = b.heart.z - (lens.z + az * t);
          const reach = b.radius + CLEAR + this.blooms[sel].radius * 0.6;
          const dist = Math.hypot(ox, oy, oz);
          if (dist < reach) leanT = (1 - dist / reach) * (ox >= 0 ? 1 : -1);
        }
      }
      b.lean += (leanT * this.clearAmt - b.lean) * (1 - Math.exp(-dt * 4));
      const g = b.flower.group;
      // A marked or hovered flower stands up a touch (a tap's first answer, before the second opens it).
      g.scale.setScalar(b.height * Math.max(born, 1e-4) * (1 + 0.05 * b.hot));
      g.visible = born > 0.001;
      if (Math.abs(b.lean) > 1e-4 || g.rotation.z !== 0) {
        // Away from the line: a flower right of it leans further right (its top toward +x).
        g.rotation.z = -b.lean * LEAN;
        g.position.y = b.base.y - Math.abs(b.lean) * 0.35 * b.height;
        if (Math.abs(b.lean) <= 1e-4) {
          g.rotation.z = 0;
          g.position.y = b.base.y;
        }
      }
      if (b.openTo !== b.open) {
        const k = clamp((time - b.openAt) / OPEN_S, 0, 1);
        b.open = k >= 1 ? b.openTo : b.openFrom + (b.openTo - b.openFrom) * (k * k * (3 - 2 * k));
      }
      if (Math.abs(b.open - b.sentOpen) > 0.0005 || (b.open === b.openTo && b.sentOpen !== b.open)) {
        b.flower.setOpen(b.open);
        b.sentOpen = b.open;
        // The heart moves as the head hands over from bud to bloom (the camera follows it: a live target).
        b.heart.copy(b.flower.heart).applyMatrix4(b.place);
      }
      const litWant = i === sel || i === this.marked ? 1 : 0.55 * b.hot;
      b.lit += (litWant - b.lit) * (1 - Math.exp(-dt * 5));
      if (Math.abs(b.lit - b.sentLit) > 0.004 || (litWant === 0 && b.lit < 0.004 && b.sentLit !== 0)) {
        const v = b.lit < 0.004 ? 0 : b.lit;
        b.flower.setLit(v);
        b.sentLit = v;
      }
      if (i === sel || b.lantern) {
        if (i === sel) {
          // Lumi's light: just in front of the heart, toward the lens.
          V2.copy(cam.position).sub(b.heart).normalize().multiplyScalar(b.radius * 1.4).add(b.heart);
          b.flower.setLantern(V2, b.lit);
          b.lantern = true;
        } else if (b.lit < 0.01) {
          b.flower.setLantern(null, 0);
          b.lantern = false;
        } else b.flower.setLantern(V2.copy(b.heart), b.lit);
      }
      if (this.garden.visible) b.flower.update(time, dt);
    }

    /* ── the chosen flower's light on the grass and the mist ── */
    // A tap-marked flower throws a softer pool of it, so the first tap visibly lands.
    const keyAt = sel >= 0 ? sel : this.marked;
    const keyWant = sel >= 0 ? (this.opts.reduced ? 0.4 : 1.3) : keyAt >= 0 ? 0.9 : 0;
    this.keyLevel += (keyWant - this.keyLevel) * (1 - Math.exp(-dt * (keyAt >= 0 ? 4 : 2.2)));
    if (keyAt >= 0) this.key.copy(this.blooms[keyAt].heart);
    this.shared.uKey.value.set(this.key.x, this.key.y, this.key.z, this.keyLevel < 0.004 ? 0 : this.keyLevel);

    /* ── the painting behind the lens ── */
    const focus = rig.focusAmount;
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / this.h;
    const backD = DEPTH.backdrop + cam.position.z;
    const backPx = rig.blurAt(backD) / (perPx * backD);
    const grassD = DEPTH.grass + cam.position.z;
    const grassPx = grassD > 0.05 ? rig.blurAt(grassD) / (perPx * grassD) : 0;
    this.scenery.update({
      backdropBlur: clamp(Math.log2(1 + backPx / 2.4), 0, 3),
      grassBlur: clamp(Math.log2(1 + grassPx / 4), 0, 2),
      // The camera goes toward the grass: it is let go before the lens reaches it.
      grassOpacity: ss(0.6, 2.6, grassD),
      presence: pres,
      dim: 1 - 0.3 * focus,
      mist: 1,
    });

    /* ── tell the host where the chosen flower is ── */
    if (sel >= 0) {
      const b = this.blooms[sel];
      this.focusT += dt;
      if (!this.revealed && (this.opts.reduced ? this.focusT > 0.12 : rig.progress >= (this.switching ? REVEAL_AT_SWITCH : REVEAL_AT) || !rig.moving)) this.revealed = true;
      if (this.revealed) {
        const arriving = !this.opts.reduced && rig.progress < 1;
        if (arriving) {
          // While the camera is still arriving, the anchor is where the heart will land.
          const closePx = ((2 * Math.tan(THREE.MathUtils.degToRad(CLOSE_FOV) / 2)) / this.h) * rig.closeDistance();
          this.emit(b.job, this.landing.x, this.landing.y, (ANCHOR_R * b.radius) / closePx);
        } else {
          V.copy(b.heart).project(cam);
          const dist = b.heart.distanceTo(cam.position);
          this.emit(b.job, (V.x * 0.5 + 0.5) * this.w, (1 - (V.y * 0.5 + 0.5)) * this.h, (ANCHOR_R * b.radius) / (perPx * Math.max(dist, 0.1)));
        }
      }
    }
  }

  private draw() {
    const pres = this.presence;
    const focus = this.rig.focusAmount;
    this.renderer.info.reset();
    this.post.render(this.scene, this.rig.camera, {
      bloom: 0.8 + 0.25 * focus,
      threshold: this.hdr ? 1.0 : 0.8,
      knee: 0.5,
      exposure: 1,
      vignette: 0.3 * focus * pres,
      fade: this.fade * this.fade * (3 - 2 * this.fade),
      focus: this.rig.now.focus,
      aperture: this.rig.now.aperture,
    });
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
  }

  /* ─────────────────────────────────────────────────── tests, tuning ── */

  freeze(on: boolean) {
    this.frozen = on;
  }
  step(dt: number, n = 1) {
    for (let i = 0; i < n; i++) this.advance(dt);
    this.draw();
    this.stats.frames++;
  }
  /** Every flower: its job, kind, open state, and where its heart is on screen (host px). */
  flowers() {
    const cam = this.rig.camera;
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / this.h;
    return this.blooms.map((b, i) => {
      V.copy(b.heart).project(cam);
      const dist = b.heart.distanceTo(cam.position);
      const job = this.opts.jobs[b.job];
      return {
        index: i,
        id: job.id,
        own: this.opts.jobs[b.own].id,
        title: job.title,
        fit: this.opts.jobs[b.own].fit,
        kind: b.kind,
        open: b.open,
        x: (V.x * 0.5 + 0.5) * this.w,
        y: (1 - (V.y * 0.5 + 0.5)) * this.h,
        r: b.radius / (perPx * Math.max(dist, 0.1)),
        depth: dist,
        focused: i === this.sel,
      };
    });
  }
  get focused(): number {
    return this.sel >= 0 ? this.blooms[this.sel].job : -1;
  }
  get state() {
    const c = this.rig.camera;
    return { time: this.time, presence: this.presence, fade: this.fade, focus: this.rig.focusAmount, moving: this.rig.moving, progress: this.rig.progress, fov: c.fov, cam: [c.position.x, c.position.y, c.position.z], sel: this.focused, active: this.active, docked: this.docked, marked: this.marked };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.timeline.kill();
    this.rig.dispose();
    this.blooms.forEach((b) => b.flower.dispose());
    freeTexture(this.scenery.uBackdrop.uTex?.value as THREE.Texture | null);
    freeTexture(this.scenery.uGrass.uTex?.value as THREE.Texture | null);
    this.scenery.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
