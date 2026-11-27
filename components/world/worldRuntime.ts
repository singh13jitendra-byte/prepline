/**
 * WORLD RUNTIME — everything the WebGL world needs, in one lazily imported module (with
 * Three), so none of it weighs on first load. WorldCanvas.tsx imports it on idle.
 *
 * Round 4: the world is the fireflies over the painted meadow, and nothing else. One draw
 * call. Each frame the director below turns the store (beat, progress, line, pointer,
 * anchors) and the scene (worldBus.scene: the window's glass, the parallax) into uniforms.
 * Nothing here reads layout per frame: rects come from anchorRect, measured in the store's read
 * phase. The one exception is the flight's landing points (delight 3), read once on entering pass2
 * or ranked, on resize and when the wheel comes to rest near them.
 */

import { anchorElement, anchorRect, watchAnchors, type AnchorId } from "@/lib/anchors";
import { rankedRoles, storyCopy } from "@/lib/content";
import { mountGL, type GLController } from "@/lib/gl";
import { BEATS, clamp01, story, type BeatId, type StoryState } from "@/lib/story";
import { onThemeChange, readWorld } from "@/lib/theme";
import { PICK_RADIUS, worldBus, type RoleTag } from "./bus";
import { BIG, FIELD_COLORS, PASS_DOLLY, SEATS, buildField, createField, pickSpeck, type FieldData, type FieldUniforms, type Verdict } from "./fieldScene";
import { FLY_START, LAST_ABSORBED, TRAIL_RATE, listDrift } from "./flight";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ROW_IDS = Array.from({ length: 12 }, (_, i) => `row-${i + 1}` as AnchorId);
const RING_IDS = Array.from({ length: SEATS }, (_, i) => `seat-ring-${i + 1}` as AnchorId);
/** Beat progress after the last absorption over which the Line's hold under the rule lets go. */
const DOCK = 0.05;
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

/**
 * What a firefly says when the lantern names it, deterministic per firefly (copy from
 * lib/content.ts; the twelve are the ranked roles of components/product/data.ts, so the tag
 * agrees with the list they become). A role has a score only once pass 2 has read it against
 * the portfolio; pass 1 sets aside on level, city and office days, before any scoring.
 */
function roleTag(seed: number, kind: number, rank: number, verdict: Verdict): RoleTag {
  const lens = storyCopy.lens;
  const t = storyCopy.lantern;
  if (kind > 1.5) {
    const role = rankedRoles[Math.round(rank)] ?? rankedRoles[0];
    const read = verdict === "kept2";
    return {
      role: `${role.title} · ${role.city}`,
      score: read ? `${role.score}${storyCopy.ranked.scoreSuffix}` : "",
      verdict: verdict === "unread" ? "unread" : "kept",
      note: verdict === "unread" ? lens.unread : read ? t.keptFit : t.keptLevel,
    };
  }
  const reason1 = pick(lens.droppedPass1, seed, 31.7);
  let title: string = pick(lens.titles, seed, 7.3);
  if (kind > 0.5) title = pick(AT_LEVEL, seed, 7.3);
  else if (reason1 === "too junior") title = pick(JUNIOR, seed, 7.3);
  else if (reason1 === "too senior") title = "Design Lead";
  const role = `${title} · ${pick(lens.cities, seed, 13.9)}`;
  if (verdict === "unread") return { role, score: "", verdict: "unread", note: lens.unread };
  if (verdict === "dropped1") return { role, score: "", verdict: "aside", note: `${t.aside} · ${reason1}` };
  if (verdict === "dropped2") {
    // Read for fit and below the bar: 3 to 5 out of 10.
    const score = 3 + Math.floor(((seed * 97.1) % 1) * 3);
    return { role, score: `${score}${storyCopy.ranked.scoreSuffix}`, verdict: "aside", note: `${t.aside} · ${pick(lens.droppedPass2, seed, 53.1)}` };
  }
  return { role, score: "", verdict: "kept", note: t.keptLevel };
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

  /* ── timed pieces (the load, a claimed seat) ── */
  let intro = 0;
  const claim = { seat: 0, t: 1 };

  /* ── the flight (delight 3): where each of the twelve lands, measured rarely ──
     The tip of each row's score rule (on phones, rows 7 to 12 are the "6 more" pill). Measured on
     entering pass2 or ranked, on resize and once each time the wheel comes to rest nearby; between
     measures the rows only drift with the list's breath (listDrift), which is added per frame. */
  const land = Array.from({ length: 12 }, () => ({ x: 0, y: 0, has: 0 }));
  let landDrift = 0;
  let measureDue = true;
  let settled = 0;
  let settledPos = -1;
  const measureLanding = () => {
    measureDue = false;
    landDrift = listDrift();
    for (let n = 0; n < 12; n++) {
      const slot = land[n];
      const el = anchorElement(ROW_IDS[n]);
      slot.has = 0;
      if (!el) continue;
      if (el.classList.contains("rd-more")) {
        // The "6 more" pill: they merge into its words, a few px apart.
        const words = el.querySelector("[data-row-in]");
        const range = document.createRange();
        if (words) range.selectNodeContents(words);
        const r = words ? range.getBoundingClientRect() : el.getBoundingClientRect();
        if (r.width < 1) continue;
        slot.x = r.left + r.width / 2 + (n - 8.5) * 4;
        slot.y = r.top + r.height / 2;
        slot.has = 1;
        continue;
      }
      const fill = el.querySelector<HTMLElement>(".pp-rule-fill");
      const track = fill?.parentElement;
      if (!fill || !track) continue;
      const t = track.getBoundingClientRect();
      if (t.width < 1) continue;
      const f = fill.getBoundingClientRect();
      slot.x = f.width > 0.5 ? f.right : t.left;
      slot.y = t.top + t.height / 2;
      slot.has = 1;
    }
  };
  const onResize = () => (measureDue = true);
  window.addEventListener("resize", onResize, { passive: true });
  offs.push(() => window.removeEventListener("resize", onResize));
  document.fonts?.ready.then(onResize).catch(() => {});
  offs.push(
    story.onBeat("pass2", { enter: () => (measureDue = true) }),
    story.onBeat("ranked", { enter: () => (measureDue = true) }),
  );
  // The flight clock and its lagged copies (the glow trail).
  let fly = -1;
  const lag = [-1, -1, -1, -1];
  // While the twelve are over the list, the canvas sits above the acts (under the Actor).
  let lifted = false;
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
    const want = i >= ORDER.votes && i <= ORDER.dawn ? "seats" : "";
    if (want === watching) return;
    unwatch?.();
    watching = want;
    unwatch = want === "seats" ? watchAnchors(RING_IDS) : null;
  };
  watchFor(story.get().beat);
  offs.push(story.onBeatChange(watchFor), () => unwatch?.());

  /* ── the lantern's tag: the firefly being named ── */
  const focus = { id: -1, x: 0, y: 0, k: 0, tryAt: 0, pos: -1 };
  /** How far the resting pointer may wander from a named firefly before its tag goes. */
  const KEEP = PICK_RADIUS + 16;
  const release = () => {
    const p = worldBus.pick;
    if (p.id < 0) return;
    p.id = -1;
    p.tag = null;
    p.seq++;
  };
  offs.push(release);
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
    // The explore stop (flag): the 3D meadow takes the field's place (worldBus.explore.k, else 0).
    const ex = worldBus.explore.k;
    const outdoors = (i <= ORDER.daybreak ? scene.field : 0) * (1 - ex);
    fu.uField.value = outdoors;
    fu.uClip.value.set(scene.x0, scene.y0, scene.x1, scene.y1);
    fu.uPar.value.set(scene.px, scene.py);
    // The camera's push through the window carries the fireflies with it.
    fu.uDolly.value = i === ORDER.hero ? PASS_DOLLY * scene.push : PASS_DOLLY;
    // The breeze through the window as we pass it (delight 4): scroll-driven, so `pos` keys the redraw.
    fu.uBreeze.value.set(scene.bx, scene.by, i === ORDER.hero ? scene.breeze : 0, 0.6 * Math.max(vw, vh));

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

    /* ranked (delight 3): the twelve fly to their rows, scrubbed by the wheel; the trail lags in time */
    const near = i >= ORDER.pass2 && i <= ORDER.ranked;
    if (near) {
      // Measure again once each time the wheel comes to rest here (never while it moves).
      if (pos !== settledPos) {
        settledPos = pos;
        settled = 0;
      } else if (settled >= 0 && ++settled > 8) {
        settled = -1;
        measureDue = true;
      }
      if (measureDue) measureLanding();
    }
    fly = beat === "ranked" ? bp : i > ORDER.ranked ? 2 : -1;
    fu.uFly.value = fly;
    // A jump from far away (a nav link) snaps the trail rather than drawing a streak across the page.
    const k = 1 - Math.exp(-TRAIL_RATE * dt);
    for (let n = 0; n < 4; n++) {
      const ahead = n === 0 ? fly : lag[n - 1];
      lag[n] = Math.abs(ahead - lag[n]) > 0.5 ? ahead : lag[n] + (ahead - lag[n]) * k;
      if (Math.abs(ahead - lag[n]) < 1e-4) lag[n] = ahead;
      else live = true;
    }
    fu.uFlyLag.value.set(lag[0], lag[1], lag[2], lag[3]);
    const drift = listDrift() - landDrift;
    for (let n = 0; n < 12; n++) fu.uRows.value[n].set(land[n].x, land[n].y + drift, land[n].has, 0);
    // The Line docks as the list rule only once the last of the twelve is absorbed.
    worldBus.dockHold = beat === "ranked" ? 1 - ss(LAST_ABSORBED, LAST_ABSORBED + DOCK, bp) : 0;
    const lift = beat === "ranked";
    if (lift !== lifted) {
      lifted = lift;
      host.toggleAttribute("data-lift", lift);
    }
    fu.uOnly12.value = lift ? 1 : 0;

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

    /* the lantern: nearby fireflies brighten and drift toward it; a resting pointer names one */
    const L = worldBus.lantern;
    fu.uLens.value.set(L.x, L.y, L.k);
    const nameable = L.names && (i === ORDER.hero || i === ORDER.pass1 || i === ORDER.pass2) && outdoors > 0.5;
    const pk = worldBus.pick;
    if (pk.id >= 0) {
      // A tag holds while the pointer stays by its firefly and the page does not scroll under it.
      if (!nameable || pos !== focus.pos || Math.hypot(L.px - pk.x, L.py - pk.y) > KEEP) release();
    } else if (nameable && L.rest >= 0.25 && focus.k < 0.02 && clock >= focus.tryAt) {
      // One search when the pointer comes to rest, then a few a second while fireflies drift in.
      focus.tryAt = clock + 0.2;
      const hit = pickSpeck(data, fu, L.px, L.py, PICK_RADIUS);
      if (hit) {
        pk.id = focus.id = hit.index;
        pk.x = focus.x = hit.x;
        pk.y = focus.y = hit.y;
        pk.tag = roleTag(hit.seed, hit.kind, hit.rank, hit.verdict);
        pk.seq++;
        focus.pos = pos;
      }
    }
    if (L.rest < 0.25) focus.tryAt = 0;
    // The named firefly glides to its hold and back (about 0.3s each way).
    focus.k = damp(focus.k, pk.id >= 0 ? 1 : 0, pk.id >= 0 ? 14 : 10, dt);
    if (focus.k < 0.004 && pk.id < 0) {
      focus.k = 0;
      focus.id = -1;
    }
    fu.uFocus.value.set(focus.id, focus.x, focus.y, focus.k);
    if (L.k > 0 && L.k < 1) live = true;

    /* draw only when it matters: fireflies blink, so outdoors at night is always live */
    const fieldOn = outdoors > 0 && dayTop > 0;
    if (fieldOn || focus.k > 0) live = true;
    const key = `${drift.toFixed(1)}|${L.x.toFixed(1)}|${L.y.toFixed(1)}|${pos.toFixed(3)}|${dayTop.toFixed(1)}|${line.y.toFixed(1)}|${scene.x0.toFixed(1)}|${scene.y0.toFixed(1)}|${scene.px.toFixed(2)}|${ringKey.toFixed(1)}|${fieldOn ? 1 : 0}${seats ? 1 : 0}|${ex.toFixed(3)}`;
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
    host.removeAttribute("data-lift");
    document.documentElement.classList.remove("world-on");
  };
}
