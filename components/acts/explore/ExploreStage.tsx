"use client";

/**
 * THE EXPLORE STOP (fireflies, research/fireflies-contract.md) — behind `?explore=1`, between
 * `pass2` and `ranked`. The twelve are held and the market they came from comes up as fireflies
 * you can read: hover (or tap) one and its role opens beside it. Then scroll on to the list.
 *
 * This file is the stage: it lazy-loads the three parts and connects them.
 *
 *   FireflyScene   components/fireflies/scene/FireflyScene.tsx   (default export)
 *   JobCard        components/fireflies/card/JobCard.tsx         (named export)
 *   JobsList       components/fireflies/card/JobsList.tsx        (named export)
 *
 * All three are `next/dynamic`, ssr off, and this file is itself loaded only when the flag is on
 * (ExploreMount.tsx), so without the flag none of it is on the page or in its bundle. They are
 * mounted once the hero is behind (so the scene has two viewports of scroll to load in), with
 * `active` false until the beat is the current one.
 *
 * THE HAND-OFF (motion). Everything is scrubbed by `explore` beat progress and written by one
 * frame callback, only when a value changes:
 *
 *   the lead-in   from the top of the beat to EXPLORE_IN nothing of the stage shows: the Line lifts
 *                 away (LINE_TRACK.explore) while the scene, active since the beat began, brings
 *                 its fireflies up over the painted meadow, unseen (about 1.3s).
 *   EXPLORE_IN    the dot field (worldBus.explore.k, read by the World's canvas) fades down as the
 *                 3D scene fades up, on opacity only; the painted meadow never changes. Over the
 *                 same stretch the counter and its slip go (the first part of it), then this
 *                 stage's line, hint and cue are unrolled by a clip from the left (the rest): the
 *                 two sets of copy are never on screen together, and a slip is never see-through.
 *   the hold      the scene is live: it takes the pointer, and the lamp rule in the cue fills with
 *                 the scroll, so the wheel always shows how far the list is.
 *   EXPLORE_OUT   the reverse, so `ranked` starts from the exact end state of `pass2`.
 *
 * The scene's half of the fade waits for `onReady`: until then the dots are held, and once it
 * arrives the fade plays over READY_S (a still wheel is not left looking at a cut). Per frame, at
 * most four elements are written during a hand-off (the scene's opacity, the copy's clip, the
 * counter's opacity, the cue's rule) and one (the rule) during the hold. Nothing is written at rest.
 *
 * Scrolling is the page's own: nothing here listens to the wheel or to touch moves, and a wheel
 * over the scene, the card, the cue or the list's button moves the page. The one scroller is the
 * "All roles" drawer while a visitor has it open (48 rows; it keeps the list's data-lenis-prevent).
 *
 * `active` is true only while `explore` is the current beat. Leaving the beat, or scrolling into
 * either hand-off, lets go of the focused firefly and closes its card.
 *
 * Wiring (as app/lab/fireflies/Lab.tsx): the focused job is React state; its anchor goes straight
 * to the card through `setAnchor`, so a firefly bobbing under the camera never renders React. The
 * list picks through the scene (`focusJob`), and the card closes through it (`clearFocus`).
 *
 * If the scene cannot start (`onError`: no WebGL2, a failed load, a lost context) the stop is the
 * plain beat: the dot field stays, the line and the list are there, and a picked role opens its
 * card in the middle of the screen.
 *
 * Reduced motion (the story does not run): the stop is a still block between the figures and the
 * list. The scene gets `reducedMotion` (no camera moves) and is active while it is on screen.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import type { JobCardHandle, JobCardProps } from "@/components/fireflies/card/JobCard";
import { FIREFLY_JOBS, type FireflyJob } from "@/components/fireflies/jobs";
import type { FireflyAnchor, FireflySceneHandle, FireflySceneProps } from "@/components/fireflies/scene/FireflyScene";
import { worldBus } from "@/components/world/bus";
import { storyCopy } from "@/lib/content";
import { BEATS, EXPLORE_IN, EXPLORE_OUT, story, type BeatId, type StoryState } from "@/lib/story";

// The handles travel as props: a ref does not reliably cross next/dynamic.
const Scene = dynamic(
  async () => {
    // The scene frames a focused firefly clear of the card's bottom sheet: it is told where the card docks.
    const [{ default: FireflyScene }, { JOBCARD_DOCK_QUERY }] = await Promise.all([import("@/components/fireflies/scene/FireflyScene"), import("@/components/fireflies/card/JobCard")]);
    return function Scene({ handle, ...props }: FireflySceneProps & { handle: Ref<FireflySceneHandle> }) {
      return <FireflyScene ref={handle} dockQuery={JOBCARD_DOCK_QUERY} {...props} />;
    };
  },
  { ssr: false },
);
const Card = dynamic(
  async () => {
    const { JobCard } = await import("@/components/fireflies/card/JobCard");
    return function Card({ handle, ...props }: JobCardProps & { handle: Ref<JobCardHandle> }) {
      return <JobCard ref={handle} {...props} />;
    };
  },
  { ssr: false },
);
const List = dynamic(() => import("@/components/fireflies/card/JobsList").then((m) => m.JobsList), { ssr: false });

/** Seconds the scene takes to come up when it becomes ready with the stop already on screen. */
const READY_S = 0.5;
/** The card stands clear of the nav (and, by the scene's advice, of the firefly's wings). */
const CARD_INSET = { top: 88 };
const CARD_ANCHOR_R = 34;

const ORDER = Object.fromEntries(BEATS.map((b, i) => [b.id, i])) as Record<BeatId, number>;
const lin = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const ss = (a: number, b: number, x: number) => {
  const t = lin(a, b, x);
  return t * t * (3 - 2 * t);
};
/** Inside each hand-off: the counter is gone (or back) by this point, and the stage's copy unrolls after it. */
const [IN0, IN1] = EXPLORE_IN;
const [OUT0, OUT1] = EXPLORE_OUT;
const LET_GO = 0.025;
const IN_MID = IN0 + (IN1 - IN0) * 0.42;
const OUT_MID = OUT1 - (OUT1 - OUT0) * 0.42;

const CSS = `
.ex{--ex-pad:clamp(24px,3.4vw,48px);--ex-cap:clamp(16px,2.6vh,28px);font-family:var(--font-text);color:var(--c-on-night)}
.ex-scene,.ex-ui,.ex-ff{position:absolute;inset:0}
.ex-ui{pointer-events:none}
/* motion: a full-stage layer over the counter, on screen only while it has something to show */
html.motion .ex{position:absolute;inset:0;z-index:1;visibility:hidden}
html.motion .ex[data-on]{visibility:visible}
html.motion .ex-scene{opacity:0;will-change:opacity;pointer-events:none}
html.motion .ex-ui{clip-path:inset(0 100% 0 0)}
html.motion .ex[data-live] .ex-scene{pointer-events:auto}
/* static: a still block between the figures and the list */
html:not(.motion) .ex{position:relative;height:clamp(440px,72svh,680px);overflow:clip}
html:not(.motion) .ex-cue{display:none}
html:not(.motion) .slip-night.ex-line{top:clamp(20px,3vh,32px)}

/* the line and the hint, on a night slip (type never sits on the painting) */
.slip-night.ex-line{position:absolute;left:calc(var(--ex-pad) - 20px);top:clamp(88px,12svh,116px);max-width:min(27rem,calc(100% - 2 * var(--ex-pad) + 40px))}
.ex-line-t{margin:0;font-size:var(--fs-lead);line-height:1.3;font-weight:var(--weight-strong);text-wrap:balance}
.ex-hint{margin:6px 0 0;font-size:var(--fs-small);line-height:var(--leading-small)}
.ex:not([data-ready],[data-failed]) .ex-hint{visibility:hidden}
.ex-hint-touch,.ex-hint-list{display:none}
@media (hover:none),(pointer:coarse){.ex-hint-fine{display:none}.ex-hint-touch{display:inline}}
.ex[data-failed] :is(.ex-hint-fine,.ex-hint-touch){display:none}
.ex[data-failed] .ex-hint-list{display:inline}

/* the cue: where the scroll goes next, and a lamp rule that fills as it gets there */
.slip-night.ex-cue{position:absolute;left:50%;bottom:var(--ex-cap);margin:0;padding:7px 12px 11px;display:flex;align-items:center;gap:8px;white-space:nowrap;transform:translate3d(-50%,0,0);font-size:var(--fs-small);line-height:var(--leading-small);font-weight:var(--weight-label)}
.ex-cue svg{flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.ex-meter{position:absolute;left:12px;right:12px;bottom:5px;height:2px;border-radius:var(--r-pill);background:var(--c-rule-night);overflow:hidden}
.ex-meter>i{position:absolute;inset:0;background:var(--art-lamp);transform-origin:0 50%;transform:scaleX(0)}

/* All roles: the list's button and drawer are position:fixed; this box (a transform makes it their
   containing block) stands them clear of the nav above and the "Illustrative data" caption below. */
.ex-list-box{position:absolute;top:76px;left:calc(var(--ex-pad) - 16px);right:0;bottom:calc(var(--ex-cap) + 22px);transform:translateZ(0);pointer-events:none}
.ex[data-on] .ex-list,html:not(.motion) .ex-list{pointer-events:auto}
.ex .ex-list{--ffl-inset:16px;--ffl-top:16px}

/* Where the card docks as a sheet (JOBCARD_DOCK_QUERY) the list's button is placed from the top and
   its drawer is a bottom sheet: the box goes edge to edge, and the button is kept where it is on
   wide screens, bottom left, above the caption (a top in % is measured on the box). */
@media (max-width:839px),(max-height:519px){
  /* The scene frames the chosen firefly in the top third, above the sheet: the line steps aside for
     it (rolled up by a clip, as it came), and is back when the sheet closes. */
  .slip-night.ex-line{clip-path:inset(0 0 0 0 round var(--r-md));transition:clip-path var(--dur-2) var(--ease-out)}
  .ex[data-focused] .slip-night.ex-line{clip-path:inset(0 100% 0 0 round var(--r-md))}
  .ex-list-box{left:0;bottom:0}
  .ex .ex-list{--ffl-inset:var(--ex-pad);--ffl-top:calc(100% - var(--ex-cap) - 74px)}
}
@media (max-width:767px){
  .ex{--ex-pad:20px}
  .slip-night.ex-line{left:calc(var(--ex-pad) - 14px);right:calc(var(--ex-pad) - 14px);top:84px;max-width:none}
  .slip-night.ex-cue{left:auto;right:var(--ex-pad);transform:none}
}
`;

export default function ExploreStage() {
  const copy = storyCopy.explore;
  // Decided once, at first paint, by the boot script: this component only ever renders in the browser.
  const [reduced] = useState(() => story.reduced());
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<FireflySceneHandle>(null);
  const card = useRef<JobCardHandle>(null);
  /** Load the three parts (the scene's engine is the heavy one). */
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [job, setJob] = useState<FireflyJob | null>(null);
  /** From the firefly to the card: the scene reports the firefly's radius, the same in every close-up. */
  const [gap, setGap] = useState(140);
  /** For the frame loop and the callbacks, which outlive a render. */
  const live = useRef({ ready: false, failed: false, active: false, focused: false });
  live.current.focused = job !== null;

  const drop = useCallback(() => {
    scene.current?.clearFocus();
    card.current?.setAnchor(null);
    setJob(null);
  }, []);

  /* ── the scene and the list report; the card follows ── */
  const onFocus = useCallback((next: FireflyJob | null, anchor: FireflyAnchor | null) => {
    const on = next !== null && live.current.active;
    // The anchor first, and not through React: the card must know where to open before it has a job.
    card.current?.setAnchor(on ? anchor : null);
    setJob(on ? next : null);
    if (on && anchor?.r) setGap(Math.round(anchor.r * 0.75 + 16));
  }, []);
  const onReady = useCallback(() => {
    live.current.ready = true;
    setReady(true);
  }, []);
  const onError = useCallback(() => {
    // No scene: the dot field stays (the fade below never starts) and the list carries the stop.
    live.current.ready = false;
    live.current.failed = true;
    setReady(false);
    setFailed(true);
  }, []);
  const onPick = useCallback((id: string) => {
    if (!live.current.active) return;
    // The scene flies to the firefly and reports it; the card opens as the camera arrives.
    if (live.current.ready) return scene.current?.focusJob(id);
    // No scene (yet): the card opens in the middle of the screen.
    card.current?.setAnchor(null);
    setJob(FIREFLY_JOBS.find((j) => j.id === id) ?? null);
  }, []);

  /* ── motion: one frame callback does the whole hand-off ── */
  useEffect(() => {
    const el = root.current;
    if (reduced || !el) return;
    const sceneEl = el.querySelector<HTMLElement>(".ex-scene");
    const ui = el.querySelector<HTMLElement>(".ex-ui");
    const fill = el.querySelector<HTMLElement>(".ex-meter > i");
    // The counter and its slip (ReadPanel): they step aside for the stop and are back before `ranked`.
    const pass = el.closest(".story-stage")?.querySelector<HTMLElement>(".rd-pass") ?? null;
    // The no-WebGL field (only on screen with ?world=css; hidden once the World's canvas draws).
    const gold = document.querySelector<HTMLElement>(".cf-gold");
    const last = { ui: "", scene: "", pass: "", fill: "", gold: "", on: false, live: false };
    last.ui = "inset(0 100% 0 0)";
    let gate = 0;
    let loaded = false;

    const frame = (_t: number, dt: number, s: Readonly<StoryState>) => {
      const i = ORDER[s.beat];
      if (!loaded && i >= ORDER.pass1) {
        loaded = true;
        setNear(true);
      }
      const here = s.beat === "explore";
      const bp = s.beatProgress;

      /* active: only while the beat is the current one */
      if (here !== live.current.active) {
        // The scene lays its wide shot over the painted meadow as it stands now.
        scene.current?.matchPage();
        live.current.active = here;
        setActive(here);
        if (!here && live.current.focused) drop();
      }

      /* how far the stop has taken over: the copy by the scroll alone, the scene once it is ready */
      const sc = here ? Math.min(ss(IN0, IN1, bp), 1 - ss(OUT0, OUT1, bp)) : 0;
      const gone = here ? Math.min(ss(IN0, IN_MID, bp), 1 - ss(OUT_MID, OUT1, bp)) : 0;
      const wipe = here ? Math.min(lin(IN_MID, IN1, bp), 1 - lin(OUT0, OUT_MID, bp)) : 0;
      if (live.current.failed) gate = 0;
      else if (live.current.ready && gate < 1) gate = Math.min(1, gate + dt / READY_S);
      const k = sc * gate * gate * (3 - 2 * gate);

      const on = sc > 0;
      if (on !== last.on) el.toggleAttribute("data-on", (last.on = on));
      // Inline only while the stop holds it: otherwise the counter's own rule (--reveal-a) applies.
      const passV = on ? (1 - gone).toFixed(3) : "";
      if (pass && passV !== last.pass) pass.style.opacity = last.pass = passV;
      // The copy: opaque the whole way, unrolled from the left.
      const uiV = wipe >= 1 ? "none" : `inset(0 ${((1 - wipe) * 100).toFixed(2)}% 0 0)`;
      if (ui && uiV !== last.ui) ui.style.clipPath = last.ui = uiV;
      const sceneV = k.toFixed(3);
      if (sceneV !== last.scene) {
        last.scene = sceneV;
        if (sceneEl) sceneEl.style.opacity = sceneV;
        worldBus.explore.k = Number(sceneV);
      }
      const goldV = k > 0 ? (1 - k).toFixed(3) : "";
      if (gold && goldV !== last.gold) gold.style.opacity = last.gold = goldV;

      /* the scene takes the pointer only when it is fully up. It lets go of its firefly a little
         before a hand-off starts (LET_GO of beat progress), so the camera is already on its way
         back to the wide shot, the painted meadow's framing, when the fade begins. */
      const isLive = k >= 0.999 && bp > IN1 + LET_GO && bp < OUT0 - LET_GO;
      if (isLive !== last.live) {
        el.toggleAttribute("data-live", (last.live = isLive));
        if (!isLive && live.current.focused) drop();
      }

      /* the cue's rule: how far through the stop the wheel is */
      const fillV = `scaleX(${(here ? bp : i > ORDER.explore ? 1 : 0).toFixed(4)})`;
      if (fill && fillV !== last.fill) fill.style.transform = last.fill = fillV;
    };
    const off = story.frame("actor", frame);
    return () => {
      off();
      worldBus.explore.k = 0;
      if (pass) pass.style.opacity = "";
      if (gold) gold.style.opacity = "";
    };
  }, [reduced, drop]);

  /* ── reduced motion: a still block, active while it is on screen ── */
  useEffect(() => {
    const el = root.current;
    if (!reduced || !el) return;
    setNear(true);
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries[entries.length - 1].intersectionRatio >= 0.4;
        if (on === live.current.active) return;
        scene.current?.matchPage();
        live.current.active = on;
        setActive(on);
        if (!on) drop();
      },
      { threshold: [0, 0.4, 0.6] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, drop]);

  return (
    <div
      ref={root}
      className="ex"
      data-explore-stage=""
      role="group"
      aria-label={copy.label}
      data-ready={ready ? "" : undefined}
      data-failed={failed ? "" : undefined}
      data-active={active ? "" : undefined}
      data-focused={active && job ? "" : undefined}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ex-scene">
        {near ? (
          <Scene
            handle={scene}
            active={active}
            jobs={FIREFLY_JOBS}
            onFocus={onFocus}
            onReady={onReady}
            onError={onError}
            reducedMotion={reduced}
            className="ex-ff"
          />
        ) : null}
      </div>
      <div className="ex-ui">
        <div className="slip-night ex-line">
          <p className="ex-line-t">{copy.line}</p>
          <p className="ex-hint muted">
            <span className="ex-hint-fine">{copy.hint}</span>
            <span className="ex-hint-touch">{copy.hintTouch}</span>
            <span className="ex-hint-list">{copy.hintList}</span>
          </p>
        </div>
        <div className="ex-list-box">{near ? <List jobs={FIREFLY_JOBS} onPick={onPick} activeId={job?.id ?? null} className="ex-list" /> : null}</div>
        <p className="slip-night ex-cue" data-size="s">
          <span>{copy.cue}</span>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />
          </svg>
          <span className="ex-meter" aria-hidden="true">
            <i />
          </span>
        </p>
      </div>
      {near ? <Card handle={card} job={active ? job : null} anchor={null} onClose={drop} gap={gap} anchorRadius={CARD_ANCHOR_R} inset={CARD_INSET} /> : null}
    </div>
  );
}
