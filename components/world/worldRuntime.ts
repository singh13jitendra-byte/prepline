/**
 * WORLD RUNTIME — everything the WebGL world needs, in one lazily imported
 * module (with Three), so none of it weighs on first load. WorldCanvas.tsx
 * imports it on idle and calls startWorld.
 *
 * Each frame the director below turns the store (beat, progress, line, pointer,
 * anchors) into uniforms. Nothing here reads layout: row and sheet rects come
 * from anchorRect, which the store measures in its read phase.
 */

import { anchorElement, anchorRect, registerAnchor, watchAnchors, type AnchorId } from "@/lib/anchors";
import { rankedRoles, storyCopy } from "@/lib/content";
import { mountGL, type GLController } from "@/lib/gl";
import { BEATS, beatPosition, clamp01, story, type BeatId, type StoryState } from "@/lib/story";
import { LENS_RADIUS, worldBus } from "./bus";
import { BIG, FIELD_COLORS, LAND_FADE, LAST_LANDING, PASS_DOLLY, ROW_IN, SEATS, STAGGER, buildField, createField, nearestSpeck, type FieldData, type FieldUniforms, type Verdict } from "./fieldScene";
import { LIGHT_COLORS, createLight, type LightUniforms } from "./lightPass";
import { labelWidth, onThemeChange, readWorld } from "@/lib/theme";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ROW_IDS = Array.from({ length: 12 }, (_, i) => `row-${i + 1}` as AnchorId);
const RING_IDS = Array.from({ length: SEATS }, (_, i) => `seat-ring-${i + 1}` as AnchorId);
/** After the last landing the line takes this long to dock as the list rule. */
const DOCK = 0.6;
const GATHER_END = Math.max(11 * STAGGER + ROW_IN + LAND_FADE, LAST_LANDING + DOCK) + 0.05;
const INTRO = 1.4;
/** The exposure breath at the two day-breaks: beat, progress it fires at, seconds it lasts. */
const FLASH: Partial<Record<BeatId, number>> = { daybreak: 0.5, dawn: 0.25 };
const FLASH_S = 0.28;
const CLAIM_S = 0.7;
/** The parked lens sits this far below the first of the twelve; its label is 18px lower still. */
const PARK_DY = 66;
/** Interview: the dust pulls in for 0.6s, holds, and has let go by this many seconds. */
const FIL_S = 1.6;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

/** Field push-in and brightness along the story, keyed to beats so they follow any re-budgeting. */
const K = (beat: BeatId, at: number, v: number): [number, number] => [beatPosition(beat, at), v];
const DOLLY: [number, number][] = [
  K("hero", 0, 0),
  K("hero", 1, 0.12),
  K("pass1", 1, PASS_DOLLY),
  K("pass2", 1, 0.14),
  K("ranked", 1, 0.11),
  K("reason", 1, 0.09),
  K("daybreak", 1, 0.16),
  K("hinge", 1, 0.22),
  K("nightfall", 1, 0.1),
  K("votes", 1, 0.16),
  K("dawn", 1, 0.2),
  K("footer", 1, 0.26),
];
const BRIGHT: [number, number][] = [K("hero", 0, 0.8), K("hero", 1, 1), K("pass2", 1, 1), K("ranked", 1, 0.9), K("reason", 1, 0.8), K("nightfall", 1, 0.8), K("unfold", 1, 1)];
function track(keys: [number, number][], pos: number) {
  if (pos <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (pos <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return v0 + ((v1 - v0) * (pos - p0)) / (p1 - p0 || 1);
    }
  }
  return keys[keys.length - 1][1];
}

const pick = <T,>(list: readonly T[], seed: number, salt: number) => list[Math.floor(((seed * salt) % 1) * list.length) % list.length];
const JUNIOR = ["Junior UI Designer", "UX Designer", "Visual Designer"] as const;
const AT_LEVEL = ["Senior Product Designer", "Product Designer", "Design Systems Designer", "Interaction Designer", "Senior Product Designer"] as const;

/** `${title} · ${city} · ${verdict}`, deterministic per speck (copy from lib/content.ts). */
function lensText(seed: number, kind: number, rank: number, verdict: Verdict) {
  const lens = storyCopy.lens;
  if (kind > 1.5) {
    const role = rankedRoles[Math.round(rank)] ?? rankedRoles[0];
    return `${role.title} · ${role.city} · ${verdict === "unread" ? lens.unread : lens.kept}`;
  }
  const reason1 = pick(lens.droppedPass1, seed, 31.7);
  let title: string = pick(lens.titles, seed, 7.3);
  if (kind > 0.5) title = pick(AT_LEVEL, seed, 7.3);
  else if (reason1 === "too junior") title = pick(JUNIOR, seed, 7.3);
  else if (reason1 === "too senior") title = "Design Lead";
  const city = pick(lens.cities, seed, 13.9);
  const word =
    verdict === "unread" ? lens.unread : verdict === "dropped1" ? reason1 : verdict === "dropped2" ? pick(lens.droppedPass2, seed, 53.1) : lens.kept;
  return `${title} · ${city} · ${word}`;
}

/** Mount the world into `host`. Resolves to its dispose function (a no-op when WebGL is unavailable). */
export async function startWorld(host: HTMLElement, small: boolean): Promise<() => void> {
  let gl: GLController | null = null;
  const offs: (() => void)[] = [];
  let data!: FieldData;
  let fu!: FieldUniforms;
  let lu!: LightUniforms;
  let light!: { visible: boolean };
  let info!: { render: { calls: number } };
  let glc: WebGL2RenderingContext | null = null;
  let getDpr = () => 1;
  let needs = true;

  /* ── theme: every colour the shaders draw is a uniform read from the live theme ── */
  // An alpha-0 --c-line-glow switches the Line's halo and bloom off: the light pass skips them.
  let glowOn = true;
  const applyColors = () => {
    const { colors, alpha } = readWorld();
    for (const [u, role] of Object.entries(FIELD_COLORS)) fu[u as keyof typeof FIELD_COLORS].value.fromArray(colors[role]);
    for (const [u, role] of Object.entries(LIGHT_COLORS)) lu[u as keyof typeof LIGHT_COLORS].value.fromArray(colors[role]);
    glowOn = alpha.lineGlow > 0;
    needs = true;
  };

  const controller = await mountGL(
    host,
    (THREE, { width, height }, renderer) => {
      data = buildField(small);
      const field = createField(THREE, data, width, height);
      const lightPass = createLight(THREE, width, height);
      fu = field.uniforms;
      lu = lightPass.uniforms;
      applyColors();
      light = lightPass.mesh;
      info = renderer.info;
      glc = renderer.getContext() as WebGL2RenderingContext;
      getDpr = () => renderer.getPixelRatio();
      const scene = new THREE.Scene();
      scene.add(lightPass.mesh, field.mesh);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      return {
        scene,
        camera,
        update: (t) => {
          fu.uTime.value = t;
          lu.uTime.value = t;
        },
        resize: (w, h) => {
          field.resize(w, h);
          lu.uRes.value.set(w, h);
          fu.uDpr.value = lu.uDpr.value = renderer.getPixelRatio();
          needs = true;
        },
        dispose: field.dispose,
      };
    },
    { animate: false, external: true, maxDpr: small ? 1.5 : 1.75 },
  );
  if (!controller) return () => {};
  gl = controller;

  offs.push(onThemeChange(applyColors));
  worldBus.stats.instances = data.count;

  /* ── timed pieces (the load, the flight, the pulse, the exposure, a claimed seat) ── */
  let intro = 0;
  let gatherT = ORDER[story.get().beat] > ORDER.ranked ? GATHER_END : 0;
  let gatherOn = story.get().beat === "ranked";
  let pulse = 1; // 0..1 clock, 1 = done
  let pulseArmed = true;
  let flash = 1;
  let lastBeat: BeatId | null = null;
  let lastBp = 0;
  const claim = { seat: 0, t: 1 };
  const fil = { t: FIL_S };
  let lastTravel = 1;
  let lastTravelBeat: BeatId | null = null;
  let rowRadius = 12;
  const readRowRadius = () => {
    const rowEl = anchorElement("row-2") ?? anchorElement("row-1");
    const r = rowEl ? parseFloat(getComputedStyle(rowEl).borderTopLeftRadius) : NaN;
    if (r > 0) rowRadius = r;
  };
  offs.push(
    story.onBeat("ranked", {
      enter(dir) {
        readRowRadius();
        gatherT = dir === 1 ? 0 : GATHER_END;
        gatherOn = dir === 1;
      },
      leave(dir) {
        gatherT = dir === 1 ? GATHER_END : 0;
        gatherOn = false;
      },
    }),
  );
  // Act IV dispatches this when a request for a seat succeeds: that ring's speck fills gold.
  const onClaim = (e: Event) => {
    const ring = Number((e as CustomEvent<{ ring?: number }>).detail?.ring);
    claim.seat = Number.isFinite(ring) ? Math.min(SEATS, Math.max(1, Math.round(ring))) : 1;
    claim.t = 0;
    needs = true;
  };
  window.addEventListener("prepline:seat-claimed", onClaim);
  offs.push(() => window.removeEventListener("prepline:seat-claimed", onClaim));

  // Rects are measured by the store (read phase) while their beats are near.
  let unwatch: (() => void) | null = null;
  let watching = "";
  const bridged: (() => void)[] = [];
  const watchFor = (beat: BeatId) => {
    const i = ORDER[beat];
    const want =
      i >= ORDER.pass2 && i <= ORDER.ranked ? "rows" : i === ORDER.interview ? "board" : i === ORDER.hinge || i === ORDER.nightfall ? "handoff" : i >= ORDER.unfold && i < ORDER.votes ? "sheet" : i >= ORDER.votes ? "seats" : "";
    if (want === watching) return;
    unwatch?.();
    watching = want;
    if (want === "seats" && !anchorElement("seat-ring-1") && bridged.length === 0) {
      // Until Act IV registers its rings as anchors, register the ring elements here.
      document.querySelectorAll<HTMLElement>(".seat-ring").forEach((el, n) => {
        if (n < SEATS) bridged.push(registerAnchor(RING_IDS[n], el));
      });
    }
    unwatch =
      want === "rows"
        ? watchAnchors(ROW_IDS)
        : want === "board"
          ? watchAnchors(["col-interview"])
          : want === "handoff"
            ? watchAnchors(["hinge-float", "sheet"])
            : want === "sheet"
              ? watchAnchors(["sheet"])
              : want === "seats"
                ? watchAnchors(["sheet", ...RING_IDS])
                : null;
  };
  watchFor(story.get().beat);
  offs.push(story.onBeatChange(watchFor), () => unwatch?.(), () => bridged.forEach((off) => off()));

  /* ── lens (fine pointers only), lamp, wake ── */
  const lens = { x: -999, y: -999, k: 0, seen: false, label: "", focus: -1, w: 0 };
  const lamp = { x: 0, y: 0, rx: 500, ry: 400, ready: false };
  let wakeV = 0;
  let prevLineY = NaN;
  // The line's thresholds over the last half second, for the afterglow.
  const HN = 48;
  const hist = { t: new Float32Array(HN), a: new Float32Array(HN), b: new Float32Array(HN), i: 0, n: 0 };
  let clock = 0;
  const sample = (ago: number, which: Float32Array, fallback: number) => {
    const want = clock - ago;
    for (let k = 1; k <= hist.n; k++) {
      const j = (hist.i - k + HN) % HN;
      if (hist.t[j] <= want) return which[j];
    }
    return hist.n ? which[(hist.i - hist.n + HN) % HN] : fallback;
  };

  /* ── dirty tracking and adaptive quality ── */
  let lastKey = "";
  let frameNo = 0;
  let first = true;
  const steps = small ? [1.5, 1.25, 1] : [1.75, 1.25, 1];
  const q = {
    step: 0,
    readyAt: 0,
    winStart: 0,
    n: 0,
    cpu: 0,
    gpu: 0,
    gpuN: 0,
    interval: 0,
    intervalN: 0,
    lastStamp: 0,
    refresh: 1000 / 60,
    bad: 0,
    good: 0,
    upAfter: 0,
    falls: 0,
    moved: false,
  };
  const timer = glc ? ((glc as WebGL2RenderingContext).getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null) : null;
  let query: WebGLQuery | null = null;
  let pending: WebGLQuery | null = null;

  /**
   * Adaptive quality. One-second windows of rendered frames, judged on what a frame costs
   * (GPU time where the timer-query extension exists, CPU time of the draw otherwise) and on
   * the frame interval relative to this display's own refresh, so 60Hz and 120Hz behave alike.
   * The first 2s are ignored. Two bad windows in a row step the DPR down; five good ones
   * (about 5s) step it back up. Each fall makes the next climb wait longer.
   */
  const judge = (now: number) => {
    if (now - q.winStart < 1000) return;
    const enough = q.n >= 6;
    const cpu = q.n ? q.cpu / q.n : 0;
    const gpu = q.gpuN ? q.gpu / q.gpuN : -1;
    const interval = q.intervalN ? q.interval / q.intervalN : q.refresh;
    worldBus.stats.frameMs = interval;
    worldBus.stats.cpuMs = cpu;
    worldBus.stats.gpuMs = gpu;
    if (enough && now - q.readyAt > 2000) {
      if (interval > 4 && interval < q.refresh) q.refresh = interval;
      // Frame interval only counts in windows where the page stood still: while it scrolls, a long
      // frame is as likely the DOM's doing as the canvas', and a lower DPR would not help.
      const bad = cpu > 6 || gpu > q.refresh * 0.6 || (!q.moved && interval > q.refresh * 1.5);
      const good = cpu < 3 && gpu < q.refresh * 0.35 && interval < q.refresh * 1.15;
      q.bad = bad ? q.bad + 1 : 0;
      q.good = good ? q.good + 1 : 0;
      if (q.bad >= 2 && q.step < steps.length - 1) {
        gl?.setMaxDpr(steps[++q.step]);
        q.bad = q.good = 0;
        q.falls++;
        q.upAfter = now + 5000 * q.falls;
      } else if (q.good >= 5 && q.step > 0 && now > q.upAfter) {
        gl?.setMaxDpr(steps[--q.step]);
        q.bad = q.good = 0;
      }
    }
    q.winStart = now;
    q.n = q.cpu = q.gpu = q.gpuN = q.interval = q.intervalN = 0;
    q.moved = false;
  };

  const first0 = data.first * 4;

  const frame = (time: number, dt: number, s: Readonly<StoryState>) => {
    if (!gl || document.hidden) return;
    const { beat, beatProgress: bp, pos } = s;
    const i = ORDER[beat];
    const vw = fu.uRes.value.x;
    const vh = s.viewport.h || fu.uRes.value.y;
    let live = false; // a time-based element is on screen
    let slow = false; // ...but only slow ones (dust drift, the dawn light): half rate is enough
    let busy = false; // something quick is on screen: full rate
    clock += dt;

    /* load */
    if (intro < 1) {
      intro = pos > 2 ? 1 : Math.min(1, intro + dt / INTRO);
      live = busy = true;
    }
    fu.uIntro.value = intro;
    worldBus.fieldReady = intro >= 1;

    /* the line as drawn (Line.tsx adds the hero demonstration and the ranked hold to the store's line) */
    const line = worldBus.line.set ? worldBus.line : s.line;
    const demo = worldBus.demo.on && beat === "hero";

    /* chapters */
    const split = s.line.daySide === "below";
    const dayTop = split ? s.dayTop : s.chapter === "night" ? BIG : -BIG;
    fu.uDayTop.value = lu.uDayTop.value = dayTop;
    const nightOnScreen = dayTop > 0;

    /* the two passes: thresholds follow the line's own y */
    const band = demo ? 40 : Math.max(56, vh * 0.09);
    fu.uBand.value = band;
    let t1 = -BIG;
    let t1Min = -BIG;
    let t2 = BIG;
    if (demo) {
      // The hero demonstration reads only the strip the line dips through, both passes at once.
      t1 = line.y;
      t1Min = worldBus.demo.y0 + 8;
      t2 = worldBus.demo.y0;
    } else if (beat === "pass1") {
      // Exact at the line for the middle of the pass. The strips the line never crosses
      // (above 14%, below 90%) are gathered in during the first and last tenth.
      t1 = line.y - (vh * 0.14 + band + 40) * (1 - ss(0, 0.1, bp)) + (vh * 0.1 + band * 1.2 + 60) * ss(0.9, 1, bp);
    } else if (i > ORDER.pass1) t1 = BIG;
    if (beat === "pass2") t2 = line.y - band * 1.3 * ss(0.88, 1, bp);
    else if (i > ORDER.pass2) t2 = -BIG;
    fu.uT1.value = t1;
    fu.uT1Min.value = t1Min;
    fu.uT1X.value = demo ? worldBus.demo.x0 : -BIG;
    fu.uT2.value = t2;
    // Afterglow: where the thresholds were 0.1, 0.2, 0.3 and 0.4s ago.
    if (hist.n === 0) {
      fu.uHist1.value.set(t1, t1, t1, t1);
      fu.uHist2.value.set(t2, t2, t2, t2);
    } else {
      fu.uHist1.value.set(sample(0.1, hist.a, t1), sample(0.2, hist.a, t1), sample(0.3, hist.a, t1), sample(0.4, hist.a, t1));
      fu.uHist2.value.set(sample(0.1, hist.b, t2), sample(0.2, hist.b, t2), sample(0.3, hist.b, t2), sample(0.4, hist.b, t2));
    }
    hist.t[hist.i] = clock;
    hist.a[hist.i] = t1;
    hist.b[hist.i] = t2;
    hist.i = (hist.i + 1) % HN;
    hist.n = Math.min(HN, hist.n + 1);
    if (fu.uHist1.value.w !== t1 || fu.uHist2.value.w !== t2) live = busy = true;

    fu.uDolly.value = track(DOLLY, pos);
    fu.uBright.value = track(BRIGHT, pos);

    /* the brightest of the twelve pulses once as pass 2 completes */
    if (beat === "pass2" && bp > 0.965 && s.direction === 1 && pulseArmed) {
      pulse = 0;
      pulseArmed = false;
    }
    if (i < ORDER.pass2 || (beat === "pass2" && bp < 0.9)) pulseArmed = true;
    if (pulse < 1) {
      pulse = Math.min(1, pulse + dt / 0.6);
      live = busy = true;
    }
    fu.uPulse.value = Math.sin(Math.PI * pulse) * (1 - pulse * 0.4);

    /* ranked: anticipation is scrubbed, the flight is timed, and the line waits for the last landing */
    if (gatherOn) {
      gatherT = Math.min(GATHER_END, gatherT + dt);
      if (gatherT >= GATHER_END) gatherOn = false;
      live = busy = true;
    }
    fu.uGatherT.value = gatherT;
    fu.uAnt.value = beat === "ranked" ? 0.08 * ss(0, 0.2, bp) : i > ORDER.ranked ? 0.08 : 0;
    fu.uRowR.value = rowRadius;
    worldBus.dockHold = beat === "ranked" ? 1 - ss(0, 1, (gatherT - LAST_LANDING) / DOCK) : 0;
    if (watching === "rows") {
      for (let n = 0; n < 12; n++) {
        const r = anchorRect(ROW_IDS[n]);
        if (r && r.w > 1) fu.uRows.value[n].set(r.x, r.y, r.w, r.h);
        else fu.uRows.value[n].set(0, 0, 0, 0);
      }
    }

    /* the lattice lets go in daylight; from there on the field is dust */
    fu.uRelease.value = beat === "saved" ? ss(0, 1, bp) : i > ORDER.saved ? 1 : 0;

    /* dawn: 25 survivors ride the day line up and are left in the seat rings */
    let ringKey = 0;
    if (i >= ORDER.dawn) {
      fu.uSeatC.value = beat === "dawn" ? ss(0, 0.15, bp) : 1;
      fu.uBeadY.value = beat === "dawn" ? line.y : -BIG;
      fu.uSeatLine.value = beat === "dawn" ? (bp < 0.15 ? BIG : line.y) : -BIG;
      for (let n = 0; n < SEATS; n++) {
        const r = anchorRect(RING_IDS[n]);
        if (r && r.w > 1) fu.uRings.value[n].set(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0);
        else fu.uRings.value[n].set(0, 0, 0, 0);
        if (n === 0 || n === SEATS - 1) ringKey += r ? r.x + r.y * 3 + r.w * 7 : 0;
      }
    } else fu.uSeatC.value = 0;
    if (claim.t < 1) {
      claim.t = Math.min(1, claim.t + dt / CLAIM_S);
      live = busy = true;
    }
    fu.uClaim.value.set(claim.seat, claim.t);

    /* the exposure breath at the two day-breaks */
    const at = FLASH[beat];
    if (at !== undefined && lastBeat === beat && lastBp < at !== bp < at && Math.abs(bp - lastBp) < 0.3) flash = 0;
    lastBeat = beat;
    lastBp = bp;
    if (flash < 1) {
      flash = Math.min(1, flash + dt / FLASH_S);
      live = busy = true;
    }
    lu.uFlash.value = Math.sin(Math.PI * flash);

    /* line light and its wake */
    const len = line.x1 - line.x0;
    const a = s.actor;
    const onPaper =
      (a.present || a.docked) &&
      (a.face === "sheet" || a.face === "ticket") &&
      (line.x0 + line.x1) / 2 > a.x &&
      (line.x0 + line.x1) / 2 < a.x + a.w &&
      line.y > a.y &&
      line.y < a.y + a.h + 2;
    let bloom = nightOnScreen ? (0.4 + 0.6 * clamp01(line.weight - 1)) * (0.55 + 0.45 * clamp01(len / (vw * 0.5))) : 0;
    if (onPaper || len < 2 || !glowOn) bloom = 0;
    bloom *= intro;
    lu.uLine.value.set(line.x0, line.x1, line.y, line.weight);
    lu.uBloom.value = bloom;
    const sweep = split ? ss(0, 0.06, s.dayTop / vh) * (1 - ss(0.94, 1, s.dayTop / vh)) : 0;
    lu.uSweep.value = sweep;
    const rawV = dt > 0 && !Number.isNaN(prevLineY) && Math.abs(line.y - prevLineY) < vh * 0.4 ? (line.y - prevLineY) / dt : 0;
    prevLineY = line.y;
    wakeV = damp(wakeV, Math.max(-4000, Math.min(4000, rawV)), 9, dt);
    if (Math.abs(wakeV) < 4) wakeV = 0;
    else if (bloom > 0 || sweep > 0) live = busy = true;
    lu.uWakeV.value = wakeV;

    /* interview: as the tile lands, the day dust lines up at the column, then lets go */
    const landed = beat === "interview" && s.actor.present && s.actor.travel >= 1;
    if (landed && lastTravel < 1 && lastTravelBeat === "interview" && s.direction === 1) fil.t = 0;
    lastTravel = s.actor.present ? s.actor.travel : 1;
    lastTravelBeat = beat;
    if (fil.t < FIL_S) {
      fil.t = beat === "interview" ? Math.min(FIL_S, fil.t + dt) : FIL_S;
      const col = anchorRect("col-interview");
      const pull = fil.t < 0.6 ? ss(0, 0.6, fil.t) : 1 - ss(0.85, FIL_S, fil.t);
      if (col) fu.uFil.value.set(col.x, col.y, col.w, Math.max(col.h, vh * 0.5));
      fu.uFilK.value.set(col ? pull : 0, col ? pull * (1 - ss(1.1, FIL_S, fil.t)) : 0);
      live = busy = true;
    } else fu.uFilK.value.set(0, 0);

    /* the lamp: born as a small warm pool under the floating tile at the hinge, it goes with the
       tile into nightfall, becomes the lamp up and left of the sheet, and leaves with the dawn */
    let lampK = 0; // night side
    let lampDay = 0; // day side: the small warm pool under the floating tile
    let travel = 1; // 0 under the tile, 1 at the sheet
    if (beat === "hinge") {
      lampDay = 0.8 * ss(0.05, 0.35, bp);
      travel = 0;
    } else if (beat === "nightfall") {
      travel = ss(0.1, 1, bp);
      lampDay = 0.8 * (1 - travel * 0.4);
      lampK = 0.4 + 0.25 * travel;
    } else if (beat === "unfold") lampK = 0.65 + 0.35 * ss(0, 1, bp);
    else if (i > ORDER.unfold && i < ORDER.dawn) lampK = 1;
    else if (beat === "dawn") lampK = 1 - ss(0.35, 1, bp);
    if (lampK > 0 || lampDay > 0) {
      lampK *= 0.97 + 0.03 * Math.sin(clock * 0.5); // it breathes, on the CPU: nothing per pixel
      const sheet = anchorRect("sheet");
      // Small screens: the copy sits above the sheet, so the pool stays low and close behind its top edge.
      let lx = sheet ? sheet.x + sheet.w * (small ? 0.4 : 0.16) : vw * (small ? 0.4 : 0.62);
      let ly = sheet ? sheet.y - vh * (small ? 0.0 : 0.05) : vh * 0.1;
      let rx = small ? vw * 0.8 : Math.max(vh * 0.92, sheet ? sheet.w * 1.35 : 0);
      let ry = small ? vh * 0.2 : vh * 0.56;
      if (small) lampK *= 0.8;
      if (travel < 1) {
        // The pool is born under the tile and goes where the tile goes.
        const tile = s.actor.present ? s.actor : null;
        const rest = tile ? null : anchorRect("hinge-float");
        const tx = tile ? tile.x : rest ? rest.x : lx;
        const ty = tile ? tile.y : rest ? rest.y : ly;
        const tw = tile ? tile.w : rest ? rest.w : 200;
        const th = tile ? tile.h : rest ? rest.h : 120;
        lx = mix(tx + tw / 2, lx, travel);
        ly = mix(ty + th * 0.85, ly, travel);
        rx = mix(Math.min(tw, 260) * 1.0, rx, travel);
        ry = mix(Math.min(th, 160) * 1.15, ry, travel);
      }
      if (travel >= 1 && s.pointer.fine && s.pointer.inside) {
        lx += (s.pointer.x - lx) * 0.1;
        ly += (s.pointer.y - ly) * 0.1;
      }
      if (!lamp.ready || travel < 1) {
        lamp.x = lx;
        lamp.y = ly;
        lamp.ready = true;
      } else {
        lamp.x = damp(lamp.x, lx, 5, dt);
        lamp.y = damp(lamp.y, ly, 5, dt);
      }
      lamp.rx = rx;
      lamp.ry = ry;
      fu.uLamp.value.set(lamp.x, lamp.y, lampK);
      lu.uLamp.value.set(lamp.x, lamp.y, Math.max(lampK, 0.0011));
      fu.uLampR.value.set(rx, ry);
      lu.uLampR.value.set(rx, ry);
    } else {
      lamp.ready = false;
      fu.uLamp.value.z = lu.uLamp.value.z = 0;
    }
    lu.uLampDay.value = lampDay;

    /* dawn */
    const dawn = i >= ORDER.dawn ? 1 : 0;
    lu.uDawn.value = dawn;

    /* lens: follows a fine pointer; until one has moved, it parks on the first of the twelve */
    const fine = s.pointer.fine && !s.flags.small;
    if (fine && s.pointer.inside) lens.seen = lens.seen || worldBus.pointerMoved;
    const parked = fine && !worldBus.pointerMoved && worldBus.demo.shown && beat === "hero" && pos < 0.5;
    const lensOn = parked || (fine && worldBus.pointerMoved && s.pointer.inside && i <= ORDER.pass2 && intro >= 1 && !worldBus.overControl);
    if (parked) {
      // Below the demonstration's deepest point, so the sweep never crosses the label.
      const tx = data.b[first0] - 46;
      const ty = data.b[first0 + 1] + PARK_DY;
      if (lens.k === 0) {
        lens.x = tx;
        lens.y = ty;
      }
      lens.x = damp(lens.x, tx, 6, dt);
      lens.y = damp(lens.y, ty, 6, dt);
    } else if (fine && s.pointer.inside) {
      if (lens.k === 0) {
        lens.x = s.pointer.x;
        lens.y = s.pointer.y;
      }
      // lerp 0.18 per frame at 60fps
      const k = 1 - Math.pow(1 - 0.18, dt * 60);
      lens.x += (s.pointer.x - lens.x) * k;
      lens.y += (s.pointer.y - lens.y) * k;
    }
    lens.k = damp(lens.k, lensOn ? 1 : 0, lensOn ? 9 : 6, dt);
    if (lens.k < 0.003) lens.k = 0;
    fu.uLens.value.set(lens.x, lens.y, lens.k);
    lu.uLens.value.set(lens.x, lens.y, lens.k);
    const ring = worldBus.lensRing;
    const label = worldBus.lensLabel;
    if (ring && label) {
      if (lens.k > 0) {
        let text = "";
        if (parked) {
          const read = demo && line.y - band * 0.5 > data.b[first0 + 1];
          text = lensText(0, 2, 0, read ? "kept" : "unread");
          lens.focus = data.first;
        } else {
          const hit = nearestSpeck(data, fu, lens.x, lens.y, lens.focus);
          text = hit ? lensText(hit.seed, hit.kind, hit.rank, hit.verdict) : "";
          lens.focus = hit ? hit.index : -1;
        }
        if (text !== lens.label) {
          lens.label = text;
          label.textContent = text;
          lens.w = labelWidth(label, text, 6.7) + 18; // measured when --font-mono is proportional
        }
        const flip = lens.x + 18 + lens.w > vw - 8;
        ring.style.transform = `translate3d(${(lens.x - LENS_RADIUS).toFixed(1)}px,${(lens.y - LENS_RADIUS).toFixed(1)}px,0) scale(${(0.92 + 0.08 * lens.k).toFixed(3)})`;
        label.style.transform = `translate3d(${(flip ? lens.x - 16 - lens.w : lens.x + 16).toFixed(1)}px,${(lens.y + 18).toFixed(1)}px,0)`;
      } else lens.focus = -1;
      const ro = (lens.k * 0.25).toFixed(3);
      if (ring.style.opacity !== ro) ring.style.opacity = ro;
      // If the demonstration's stroke does come near the label, the label steps back.
      const near = demo ? clamp01((Math.abs(line.y - (lens.y + 24)) - 9) / 14) : 1;
      const lo = (lens.label ? lens.k * near : 0).toFixed(3);
      if (label.style.opacity !== lo) label.style.opacity = lo;
    }
    fu.uFocus.value = lens.focus;

    /* draw only when it matters */
    if (lens.k > 0) live = busy = true;
    if (nightOnScreen || dawn > 0) live = true;
    // From Act III on, what is left when nothing quick is happening is dust drift and the dawn
    // light. Both are slow: every other frame is enough, and halves the World's cost at rest.
    if (live && !busy && i >= ORDER.unfold) slow = true;
    light.visible = bloom > 0.001 || sweep > 0.001 || lampK > 0.001 || lampDay > 0.001 || dawn > 0 || lens.k > 0 || flash < 1;
    const key = `${pos.toFixed(3)}|${dayTop.toFixed(1)}|${line.y.toFixed(1)}|${line.x0.toFixed(1)}|${line.x1.toFixed(1)}|${lampDay.toFixed(3)}|${lamp.x.toFixed(1)}|${lamp.y.toFixed(1)}|${ringKey.toFixed(1)}`;
    if (key !== lastKey) {
      lastKey = key;
      needs = true;
      q.moved = true;
    }
    frameNo++;
    // The dawn light drifts slowly: when it is the only thing moving, every other frame is enough.
    if ((!live && !needs) || (slow && !needs && frameNo % 2 === 1)) {
      worldBus.stats.skipped++;
      q.lastStamp = 0;
      return;
    }
    needs = false;

    const g = glc;
    if (timer && g && !pending && !query) {
      query = g.createQuery();
      if (query) g.beginQuery(timer.TIME_ELAPSED_EXT, query);
    }
    const before = performance.now();
    gl.render(time, live ? (slow ? dt * 2 : dt) : 0);
    const now = performance.now();
    if (timer && g && query) {
      g.endQuery(timer.TIME_ELAPSED_EXT);
      pending = query;
      query = null;
    } else if (timer && g && pending && g.getQueryParameter(pending, g.QUERY_RESULT_AVAILABLE)) {
      if (!g.getParameter(timer.GPU_DISJOINT_EXT)) {
        q.gpu += (g.getQueryParameter(pending, g.QUERY_RESULT) as number) / 1e6;
        q.gpuN++;
      }
      g.deleteQuery(pending);
      pending = null;
    }

    const stats = worldBus.stats;
    stats.calls = info.render.calls;
    stats.dpr = getDpr();
    stats.rendered++;
    if (first) {
      first = false;
      worldBus.glReady = true;
      worldBus.firstX = data.b[first0];
      worldBus.firstY = data.b[first0 + 1];
      q.readyAt = q.winStart = now;
      document.documentElement.classList.add("world-on");
    }
    q.n++;
    q.cpu += now - before;
    if (q.lastStamp && !slow) {
      q.interval += now - q.lastStamp;
      q.intervalN++;
    }
    q.lastStamp = now;
    judge(now);
  };
  offs.push(story.frame("world", frame));
  (window as unknown as { __world?: unknown }).__world = worldBus.stats;
  (window as unknown as { __worldUniforms?: unknown }).__worldUniforms = () => ({ field: fu, light: lu });

  return () => {
    offs.forEach((off) => off());
    gl?.dispose();
    gl = null;
    worldBus.glReady = false;
    worldBus.fieldReady = false;
    worldBus.dockHold = 0;
    document.documentElement.classList.remove("world-on");
  };
}
