/**
 * WORLD RUNTIME — everything the WebGL world needs, in one lazily imported module (with
 * Three), so none of it weighs on first load. WorldCanvas.tsx imports it on idle.
 *
 * Round 4: the world is the fireflies over the painted meadow, and nothing else. One draw
 * call. Each frame the director below turns the store (beat, progress, line, pointer,
 * anchors) and the scene (worldBus.scene: the window's glass, the parallax) into uniforms.
 * Nothing here reads layout: rects come from anchorRect, measured in the store's read phase.
 */

import { anchorElement, anchorRect, watchAnchors, type AnchorId } from "@/lib/anchors";
import { rankedRoles, storyCopy } from "@/lib/content";
import { mountGL, type GLController } from "@/lib/gl";
import { BEATS, clamp01, story, type BeatId, type StoryState } from "@/lib/story";
import { labelWidth, onThemeChange, readWorld } from "@/lib/theme";
import { worldBus } from "./bus";
import { BIG, FIELD_COLORS, LAND_FADE, LAST_LANDING, PASS_DOLLY, ROW_IN, SEATS, STAGGER, buildField, createField, nearestSpeck, type FieldData, type FieldUniforms, type Verdict } from "./fieldScene";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ROW_IDS = Array.from({ length: 12 }, (_, i) => `row-${i + 1}` as AnchorId);
const RING_IDS = Array.from({ length: SEATS }, (_, i) => `seat-ring-${i + 1}` as AnchorId);
/** After the last landing the line takes this long to dock as the list rule. */
const DOCK = 0.6;
const GATHER_END = Math.max(11 * STAGGER + ROW_IN + LAND_FADE, LAST_LANDING + DOCK) + 0.05;
const INTRO = 1.6;
const CLAIM_S = 0.7;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

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
  let info!: { render: { calls: number } };
  let glc: WebGL2RenderingContext | null = null;
  let getDpr = () => 1;
  let needs = true;

  /* ── theme: every colour the shader draws is a uniform read from the live theme ── */
  const applyColors = () => {
    const { colors } = readWorld();
    for (const [u, role] of Object.entries(FIELD_COLORS)) fu[u as keyof typeof FIELD_COLORS].value.fromArray(colors[role]);
    needs = true;
  };

  const controller = await mountGL(
    host,
    (THREE, { width, height }, renderer) => {
      data = buildField(small);
      const field = createField(THREE, data, width, height);
      fu = field.uniforms;
      applyColors();
      info = renderer.info;
      glc = renderer.getContext() as WebGL2RenderingContext;
      getDpr = () => renderer.getPixelRatio();
      const scene = new THREE.Scene();
      scene.add(field.mesh);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      return {
        scene,
        camera,
        update: (t) => {
          fu.uTime.value = t;
        },
        resize: (w, h) => {
          field.resize(w, h);
          fu.uDpr.value = renderer.getPixelRatio();
          needs = true;
        },
        dispose: field.dispose,
      };
    },
    { animate: false, external: true, maxDpr: small ? 1.5 : 1.75 },
  );
  if (!controller) return () => {};
  gl = controller;
  worldBus.stats.instances = data.count;
  offs.push(onThemeChange(applyColors));

  /* ── timed pieces (the load, the flight, a claimed seat) ── */
  let intro = 0;
  let gatherT = ORDER[story.get().beat] > ORDER.ranked ? GATHER_END : 0;
  let gatherOn = story.get().beat === "ranked";
  const claim = { seat: 0, t: 1 };
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
  // Act IV dispatches this when a request for a seat succeeds. Since round 5 no firefly sits in the
  // rings at rest (they are printed on the ticket), so this only matters if the seat is claimed
  // while the dawn sweep is still on screen; otherwise it is a no-op behind the paper.
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
  const watchFor = (beat: BeatId) => {
    const i = ORDER[beat];
    const want = i >= ORDER.pass2 && i <= ORDER.ranked ? "rows" : i >= ORDER.votes && i <= ORDER.dawn ? "seats" : "";
    if (want === watching) return;
    unwatch?.();
    watching = want;
    unwatch = want === "rows" ? watchAnchors(ROW_IDS) : want === "seats" ? watchAnchors(RING_IDS) : null;
  };
  watchFor(story.get().beat);
  offs.push(story.onBeatChange(watchFor), () => unwatch?.());

  /* ── the pointer's note ── */
  const lens = { x: -999, y: -999, k: 0, label: "", focus: -1, w: 0 };
  // The Line's thresholds over the last half second, for the afterglow.
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
  let first = true;
  const steps = small ? [1.5, 1.25, 1] : [1.75, 1.25, 1];
  const q = { step: 0, readyAt: 0, winStart: 0, n: 0, cpu: 0, gpu: 0, gpuN: 0, interval: 0, intervalN: 0, lastStamp: 0, refresh: 1000 / 60, bad: 0, good: 0, upAfter: 0, falls: 0, moved: false };
  const timer = glc ? ((glc as WebGL2RenderingContext).getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null) : null;
  let query: WebGLQuery | null = null;
  let pending: WebGLQuery | null = null;

  /**
   * Adaptive quality. One-second windows of rendered frames, judged on what a frame costs
   * (GPU time where the timer-query extension exists, CPU time of the draw otherwise) and,
   * while the page stands still, on the frame interval relative to this display's own
   * refresh. The first 2s are ignored. Two bad windows in a row step the DPR down; five good
   * ones step it back up. Each fall makes the next climb wait longer.
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

  const frame = (time: number, dt: number, s: Readonly<StoryState>) => {
    if (!gl || document.hidden) return;
    const { beat, beatProgress: bp, pos } = s;
    const i = ORDER[beat];
    const vw = fu.uRes.value.x;
    const vh = s.viewport.h || fu.uRes.value.y;
    const scene = worldBus.scene;
    let live = false; // a time-based element is on screen
    clock += dt;

    /* load */
    if (intro < 1) {
      intro = pos > 2 ? 1 : Math.min(1, intro + dt / INTRO);
      live = true;
    }
    fu.uIntro.value = intro;

    /* the line as drawn (Line.tsx adds the ranked hold to the store's line) */
    const line = worldBus.line.set ? worldBus.line : s.line;

    /* chapters, and where the painted scene lets the fireflies show */
    const split = s.line.daySide === "below";
    const dayTop = split ? s.dayTop : s.chapter === "night" ? BIG : -BIG;
    fu.uDayTop.value = dayTop;
    const outdoors = i <= ORDER.daybreak ? scene.field : 0;
    fu.uField.value = outdoors;
    fu.uClip.value.set(scene.x0, scene.y0, scene.x1, scene.y1);
    fu.uPar.value.set(scene.px, scene.py);
    // The camera's push through the window carries the fireflies with it.
    fu.uDolly.value = i === ORDER.hero ? PASS_DOLLY * scene.push : PASS_DOLLY;

    /* the two passes: thresholds follow the Line's own y */
    const band = Math.max(56, vh * 0.09);
    fu.uBand.value = band;
    let t1 = -BIG;
    let t2 = BIG;
    if (beat === "pass1") {
      // Exact at the line for the middle of the pass. The strips the line never crosses
      // (above 14%, below 90%) are gathered in during the first and last tenth.
      t1 = line.y - (vh * 0.14 + band + 40) * (1 - ss(0, 0.1, bp)) + (vh * 0.1 + band * 1.2 + 60) * ss(0.9, 1, bp);
    } else if (i > ORDER.pass1) t1 = BIG;
    if (beat === "pass2") t2 = line.y - band * 1.3 * ss(0.88, 1, bp);
    else if (i > ORDER.pass2) t2 = -BIG;
    fu.uT1.value = t1;
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
    if (fu.uHist1.value.w !== t1 || fu.uHist2.value.w !== t2) live = true;

    /* ranked: anticipation is scrubbed, the flight is timed, and the line waits for the last landing */
    if (gatherOn) {
      gatherT = Math.min(GATHER_END, gatherT + dt);
      if (gatherT >= GATHER_END) gatherOn = false;
      live = true;
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

    /* dawn: 25 come back up with the day line and ride it toward the seat rings. Since round 5 the
       rings are printed on the ticket stub (acts layer, above this canvas), so the fireflies go out
       as the sweep ends: nothing is drawn at rest in the seat, and none sits behind the paper. */
    let ringKey = 0;
    let seats = false;
    if (beat === "dawn") {
      seats = true;
      fu.uSeatC.value = ss(0, 0.15, bp) * (1 - ss(0.8, 0.97, bp));
      fu.uBeadY.value = line.y;
      fu.uSeatLine.value = bp < 0.15 ? BIG : line.y;
      for (let n = 0; n < SEATS; n++) {
        const r = anchorRect(RING_IDS[n]);
        if (r && r.w > 1) fu.uRings.value[n].set(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0);
        else fu.uRings.value[n].set(0, 0, 0, 0);
        if (n === 0 || n === SEATS - 1) ringKey += r ? r.x + r.y * 3 + r.w * 7 : 0;
      }
    } else fu.uSeatC.value = 0;
    if (claim.t < 1) {
      claim.t = Math.min(1, claim.t + dt / CLAIM_S);
      live = true;
    }
    fu.uClaim.value.set(claim.seat, claim.t);

    /* the pointer: nearby fireflies light up, and a note names the nearest role (meadow only) */
    const fine = s.pointer.fine && !s.flags.small;
    const lensOn = fine && worldBus.pointerMoved && s.pointer.inside && (i === ORDER.pass1 || i === ORDER.pass2) && !worldBus.overControl;
    if (fine && s.pointer.inside) {
      if (lens.k === 0) {
        lens.x = s.pointer.x;
        lens.y = s.pointer.y;
      }
      const k = 1 - Math.pow(1 - 0.18, dt * 60);
      lens.x += (s.pointer.x - lens.x) * k;
      lens.y += (s.pointer.y - lens.y) * k;
    }
    lens.k = damp(lens.k, lensOn ? 1 : 0, lensOn ? 9 : 6, dt);
    if (lens.k < 0.003) lens.k = 0;
    fu.uLens.value.set(lens.x, lens.y, lens.k);
    const label = worldBus.lensLabel;
    if (label) {
      if (lens.k > 0) {
        const hit = nearestSpeck(data, fu, lens.x, lens.y, lens.focus);
        const text = hit ? lensText(hit.seed, hit.kind, hit.rank, hit.verdict) : "";
        lens.focus = hit ? hit.index : -1;
        if (text !== lens.label) {
          lens.label = text;
          if (text) {
            label.textContent = text;
            lens.w = labelWidth(label, text, 6.7) + 18;
          }
        }
        const flip = lens.x + 18 + lens.w > vw - 8;
        label.style.transform = `translate3d(${(flip ? lens.x - 16 - lens.w : lens.x + 16).toFixed(1)}px,${(lens.y + 18).toFixed(1)}px,0)`;
      } else lens.focus = -1;
      const lo = (lens.label ? lens.k : 0).toFixed(3);
      if (label.style.opacity !== lo) label.style.opacity = lo;
    }

    /* draw only when it matters: fireflies blink, so outdoors at night is always live */
    const fieldOn = outdoors > 0 && dayTop > 0;
    if (fieldOn || lens.k > 0) live = true;
    const key = `${pos.toFixed(3)}|${dayTop.toFixed(1)}|${line.y.toFixed(1)}|${scene.x0.toFixed(1)}|${scene.y0.toFixed(1)}|${scene.px.toFixed(2)}|${ringKey.toFixed(1)}|${fieldOn ? 1 : 0}${seats ? 1 : 0}`;
    if (key !== lastKey) {
      lastKey = key;
      needs = true;
      q.moved = true;
    }
    if (!live && !needs) {
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
    gl.render(time, live ? dt : 0);
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
      q.readyAt = q.winStart = now;
      document.documentElement.classList.add("world-on");
    }
    q.n++;
    q.cpu += now - before;
    if (q.lastStamp) {
      q.interval += now - q.lastStamp;
      q.intervalN++;
    }
    q.lastStamp = now;
    judge(now);
  };
  offs.push(story.frame("world", frame));
  (window as unknown as { __world?: unknown }).__world = worldBus.stats;

  return () => {
    offs.forEach((off) => off());
    gl?.dispose();
    gl = null;
    worldBus.glReady = false;
    worldBus.dockHold = 0;
    document.documentElement.classList.remove("world-on");
  };
}
