/**
 * WORLD RUNTIME — everything the WebGL world needs, in one lazily imported
 * module (with Three), so none of it weighs on first load. WorldCanvas.tsx
 * imports it on idle and calls startWorld.
 *
 * Each frame the director below turns the store (beat, progress, line, pointer,
 * anchors) into uniforms. Nothing here reads layout: row and sheet rects come
 * from anchorRect, which the store measures in its read phase.
 */

import { anchorElement, anchorRect, watchAnchors, type AnchorId } from "@/lib/anchors";
import { rankedRoles, storyCopy } from "@/lib/content";
import { mountGL, type GLController } from "@/lib/gl";
import { ACTOR_TRACK, BEATS, clamp01, story, type BeatId, type StoryState } from "@/lib/story";
import { LENS_RADIUS, worldBus } from "./bus";
import { BIG, FLIGHT, LAND_FADE, PASS_DOLLY, STAGGER, buildField, createField, nearestSpeck, type FieldData, type FieldUniforms, type Verdict } from "./fieldScene";
import { createLight, type LightUniforms } from "./lightPass";

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const ROW_IDS = Array.from({ length: 12 }, (_, i) => `row-${i + 1}` as AnchorId);
const GATHER_END = 11 * STAGGER + FLIGHT + LAND_FADE + 0.05;
const INTRO = 1.4;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

/** Field push-in and brightness along the story (position in story units). */
const DOLLY: [number, number][] = [
  [0, 0],
  [55, 0.12],
  [155, PASS_DOLLY],
  [245, 0.14],
  [320, 0.11],
  [420, 0.09],
  [480, 0.16],
  [740, 0.22],
  [800, 0.1],
  [1100, 0.16],
  [1170, 0.2],
  [1430, 0.26],
];
const BRIGHT: [number, number][] = [
  [0, 0.8],
  [55, 1],
  [245, 1],
  [320, 0.9],
  [420, 0.8],
  [800, 0.8],
  [845, 1],
  [1430, 1],
];
function track(keys: [number, number][], pos: number) {
  if (pos <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (pos <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return v0 + ((v1 - v0) * (pos - p0)) / (p1 - p0);
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
  let getDpr = () => 1;
  let needs = true;

  const controller = await mountGL(
    host,
    (THREE, { width, height }, renderer) => {
      data = buildField(small);
      const field = createField(THREE, data, width, height);
      const lightPass = createLight(THREE, width, height);
      fu = field.uniforms;
      lu = lightPass.uniforms;
      light = lightPass.mesh;
      info = renderer.info;
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
  worldBus.stats.instances = data.count;

  /* ── timed pieces (the load, the flight, the pulse) ── */
  let intro = 0;
  let gatherT = ORDER[story.get().beat] > ORDER.ranked ? GATHER_END : 0;
  let gatherOn = story.get().beat === "ranked";
  let pulse = 1; // 0..1 clock, 1 = done
  let pulseArmed = true;
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
  // Row and sheet rects are measured by the store while their beats are near.
  let unwatch: (() => void) | null = null;
  let watching = "";
  const watchFor = (beat: BeatId) => {
    const i = ORDER[beat];
    const want = i >= ORDER.pass2 && i <= ORDER.ranked ? "rows" : i >= ORDER.nightfall && i <= ORDER.dawn ? "sheet" : "";
    if (want === watching) return;
    unwatch?.();
    watching = want;
    unwatch = want === "rows" ? watchAnchors(ROW_IDS) : want === "sheet" ? watchAnchors(["sheet"]) : null;
  };
  watchFor(story.get().beat);
  offs.push(story.onBeatChange(watchFor), () => unwatch?.());

  /* ── lens (fine pointers only) ── */
  const lens = { x: -999, y: -999, k: 0, seen: false, label: "", focus: -1, w: 0 };
  const lamp = { x: 0, y: 0, ready: false };

  /* ── dirty tracking and adaptive quality ── */
  let lastKey = "";
  let lastStamp = 0;
  let acc = 0;
  let accN = 0;
  const steps = small ? [1.5, 1.25, 1] : [1.75, 1.25, 1];
  let step = 0;
  let first = true;

  const frame = (time: number, dt: number, s: Readonly<StoryState>) => {
    if (!gl || document.hidden) return;
    const { beat, beatProgress: bp, pos } = s;
    const i = ORDER[beat];
    const vw = fu.uRes.value.x;
    const vh = s.viewport.h || fu.uRes.value.y;
    let live = false; // a time-based element is on screen

    /* load */
    if (intro < 1) {
      intro = pos > 2 ? 1 : Math.min(1, intro + dt / INTRO);
      live = true;
    }
    fu.uIntro.value = intro;

    /* chapters */
    const split = s.line.daySide === "below";
    const dayTop = split ? s.dayTop : s.chapter === "night" ? BIG : -BIG;
    fu.uDayTop.value = lu.uDayTop.value = dayTop;
    const nightOnScreen = dayTop > 0;

    /* the two passes: thresholds follow the line's own y */
    const band = Math.max(56, vh * 0.09);
    fu.uBand.value = band;
    let t1 = -BIG;
    let t2 = BIG;
    if (beat === "pass1") {
      // Exact at the line for the middle of the pass. The strips the line never crosses
      // (above 14%, below 90%) are gathered in during the first and last tenth.
      t1 = s.line.y - (vh * 0.14 + band + 40) * (1 - ss(0, 0.1, bp)) + (vh * 0.1 + band * 1.2 + 60) * ss(0.9, 1, bp);
    } else if (i > ORDER.pass1) t1 = BIG;
    if (beat === "pass2") t2 = s.line.y - band * 1.3 * ss(0.88, 1, bp);
    else if (i > ORDER.pass2) t2 = -BIG;
    fu.uT1.value = t1;
    fu.uT2.value = t2;

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
      live = true;
    }
    fu.uPulse.value = Math.sin(Math.PI * pulse) * (1 - pulse * 0.4);

    /* ranked: anticipation is scrubbed, the flight is timed */
    if (gatherOn) {
      gatherT = Math.min(GATHER_END, gatherT + dt);
      if (gatherT >= GATHER_END) gatherOn = false;
      live = true;
    }
    fu.uGatherT.value = gatherT;
    fu.uAnt.value = beat === "ranked" ? 0.08 * ss(0, 0.2, bp) : i > ORDER.ranked ? 0.08 : 0;
    // Row 1 hands over to the Actor: its speck goes exactly as the Actor arrives.
    const fade = ACTOR_TRACK.ranked?.fadeIn ?? [0.22, 0.34];
    const actorIn = beat === "ranked" ? clamp01((bp - fade[0]) / (fade[1] - fade[0] || 1)) : i > ORDER.ranked ? 1 : 0;
    fu.uLand1.value = actorIn * clamp01((gatherT - FLIGHT) / LAND_FADE);
    fu.uRowR.value = rowRadius;
    if (watching === "rows") {
      for (let n = 0; n < 12; n++) {
        const r = anchorRect(ROW_IDS[n]);
        if (r && r.w > 1) fu.uRows.value[n].set(r.x, r.y, r.w, r.h);
        else fu.uRows.value[n].set(0, 0, 0, 0);
      }
    }

    /* the lattice lets go in daylight; from there on the field is dust */
    fu.uRelease.value = beat === "saved" ? ss(0, 1, bp) : i > ORDER.saved ? 1 : 0;
    fu.uDayDust.value = 1;

    /* line light */
    const line = s.line;
    const len = line.x1 - line.x0;
    const a = s.actor;
    const onPaper =
      (a.present || a.docked) &&
      (a.face === "sheet" || a.face === "ticket") &&
      (line.x0 + line.x1) / 2 > a.x &&
      (line.x0 + line.x1) / 2 < a.x + a.w &&
      line.y > a.y &&
      line.y < a.y + a.h + 2;
    let bloom = nightOnScreen ? (0.35 + 0.65 * clamp01(line.weight - 1)) * (0.5 + 0.5 * clamp01(len / (vw * 0.5))) : 0;
    if (onPaper) bloom *= 0.2;
    if (len < 2) bloom = 0;
    bloom *= intro;
    lu.uLine.value.set(line.x0, line.x1, line.y, line.weight);
    lu.uBloom.value = bloom;
    lu.uWake.value = beat === "pass1" ? ss(0, 0.08, bp) * (1 - ss(0.92, 1, bp)) : beat === "pass2" ? -ss(0, 0.08, bp) * (1 - ss(0.92, 1, bp)) : 0;
    lu.uSweep.value = split ? ss(0, 0.06, s.dayTop / vh) * (1 - ss(0.94, 1, s.dayTop / vh)) : 0;

    /* lamp: rises through `unfold`, leaves with the dawn */
    let lampK = 0;
    if (beat === "unfold") lampK = ss(0, 1, bp);
    else if (i > ORDER.unfold && i < ORDER.dawn) lampK = 1;
    else if (beat === "dawn") lampK = 1 - ss(0.35, 1, bp);
    if (lampK > 0) {
      const sheet = anchorRect("sheet");
      let lx = sheet ? sheet.x + sheet.w / 2 : vw * (small ? 0.5 : 0.72);
      let ly = sheet ? sheet.y - vh * 0.015 : vh * 0.12;
      if (s.pointer.fine && s.pointer.inside) {
        lx += (s.pointer.x - lx) * 0.1;
        ly += (s.pointer.y - ly) * 0.1;
      }
      if (!lamp.ready) {
        lamp.x = lx;
        lamp.y = ly;
        lamp.ready = true;
      }
      lamp.x = damp(lamp.x, lx, 5, dt);
      lamp.y = damp(lamp.y, ly, 5, dt);
      const r = Math.max(vh * 0.62, sheet ? sheet.w * 0.95 : 0);
      fu.uLamp.value.set(lamp.x, lamp.y, lampK);
      lu.uLamp.value.set(lamp.x, lamp.y, lampK);
      fu.uLampR.value = lu.uLampR.value = r;
    } else {
      lamp.ready = false;
      fu.uLamp.value.z = lu.uLamp.value.z = 0;
    }

    /* dawn */
    const dawn = i >= ORDER.dawn ? 1 : 0;
    lu.uDawn.value = dawn;

    /* lens */
    const lensOn = s.pointer.fine && s.pointer.inside && i <= ORDER.pass2 && intro >= 1 && !worldBus.overControl;
    if (s.pointer.fine && s.pointer.inside) {
      if (!lens.seen) {
        lens.x = s.pointer.x;
        lens.y = s.pointer.y;
        lens.seen = true;
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
        const hit = nearestSpeck(data, fu, lens.x, lens.y, lens.focus);
        const text = hit ? lensText(hit.seed, hit.kind, hit.rank, hit.verdict) : "";
        lens.focus = hit ? hit.index : -1;
        if (text !== lens.label) {
          lens.label = text;
          label.textContent = text;
          lens.w = text.length * 6.7 + 18;
        }
        const flip = lens.x + 18 + lens.w > vw - 8;
        ring.style.transform = `translate3d(${(lens.x - LENS_RADIUS).toFixed(1)}px,${(lens.y - LENS_RADIUS).toFixed(1)}px,0) scale(${(0.92 + 0.08 * lens.k).toFixed(3)})`;
        label.style.transform = `translate3d(${(flip ? lens.x - 16 - lens.w : lens.x + 16).toFixed(1)}px,${(lens.y + 18).toFixed(1)}px,0)`;
      } else lens.focus = -1;
      const ro = (lens.k * 0.25).toFixed(3);
      if (ring.style.opacity !== ro) ring.style.opacity = ro;
      const lo = (lens.label ? lens.k : 0).toFixed(3);
      if (label.style.opacity !== lo) label.style.opacity = lo;
    }
    fu.uFocus.value = lens.focus;

    /* draw only when it matters */
    if (nightOnScreen || dawn > 0 || lens.k > 0) live = true;
    light.visible = lu.uBloom.value > 0.001 || lu.uSweep.value > 0.001 || lampK > 0.001 || dawn > 0 || lens.k > 0;
    const key = `${pos.toFixed(3)}|${dayTop.toFixed(1)}|${line.y.toFixed(1)}|${line.x0.toFixed(1)}|${line.x1.toFixed(1)}`;
    if (key !== lastKey) {
      lastKey = key;
      needs = true;
    }
    if (!live && !needs) {
      worldBus.stats.skipped++;
      lastStamp = 0;
      return;
    }
    needs = false;
    gl.render(time, live ? dt : 0);

    const stats = worldBus.stats;
    stats.calls = info.render.calls;
    stats.dpr = getDpr();
    stats.rendered++;
    if (first) {
      first = false;
      worldBus.glReady = true;
      document.documentElement.classList.add("world-on");
    }
    // Adaptive quality: the average of 60 consecutive frames.
    const now = performance.now();
    if (lastStamp) {
      acc += now - lastStamp;
      if (++accN === 60) {
        stats.frameMs = acc / 60;
        if (stats.frameMs > 20 && step < steps.length - 1) gl.setMaxDpr(steps[++step]);
        acc = accN = 0;
      }
    }
    lastStamp = now;
  };
  offs.push(story.frame("world", frame));
  (window as unknown as { __world?: unknown }).__world = worldBus.stats;

  return () => {
    offs.forEach((off) => off());
    gl?.dispose();
    gl = null;
    worldBus.glReady = false;
    document.documentElement.classList.remove("world-on");
  };
}
