"use client";

/**
 * ACTOR — the Role. One fixed rectangle that never leaves the screen from
 * `ranked` to `seat` (storyboard 1 and 5.3).
 *
 * Mounted once by <StoryRoot>. You never render it yourself. To take part:
 * - put the anchors it travels between in your layout with <FaceSlot> (see FaceSlot.tsx);
 * - register the faces it wears with registerFace (see faces.ts);
 * - its path is data: ACTOR_TRACK in lib/story.ts.
 *
 * What the engine does every frame (phase "actor", after the store's read phase)
 * - Box = interpolation of the beat's from and to anchor rects (x, y, width,
 *   height, radius), plus a low arc perpendicular to travel and a lean into it.
 *   Travel is scrubbed (linear in beat progress) or timed (cubic-bezier(0.65,0,0.15,1)).
 * - Faces: the from-face crossfades to the to-face at travel midpoint with a
 *   4px blur dip, or flips on rotateY when the move has a `flip` channel.
 *   Each face is scaled uniformly from its natural size to the box width.
 * - Skins: outside wipes one skin is shown. While the line sweeps, both are
 *   stacked and each is clipped at the line (state.dayTop), so the Actor is cut
 *   into glass above and paper below at exactly the line. Lean is 0 while split.
 * - Docking: on a `dock` move, once travel is complete the real DOM face in the
 *   `to` anchor gets `data-docked` (FaceSlot shows it) and the Actor is hidden
 *   in the same frame. Leaving the beat undocks.
 * - Fold and flip: published as CSS variables --fold, --flip, --progress and
 *   --lift (0..1..0 while travelling) on the Actor, and in story.get().actor.
 *
 * Timed channels chase their target: scrolling back above their start point
 * plays them in reverse (the fold and the flip are visibly reversible). Entering
 * a beat backward shows the end state at once. Crossing several beats in one
 * frame lands on the last beat's state with nothing left half-played.
 *
 * No React render happens per frame. React re-renders on beat change only, to
 * mount the faces the current and neighbouring beats need.
 */

import { useEffect, useMemo, useRef } from "react";
import { anchorElement, anchorRect } from "@/lib/anchors";
import {
  ACTOR_TRACK,
  BEATS,
  clamp01,
  lerp,
  story,
  travelEase,
  type ActorChannel,
  type ActorMove,
  type BeatId,
  type FaceId,
  type StoryState,
} from "@/lib/story";
import { FaceFrame } from "./FaceSlot";
import { FACE_ORDER, getFace } from "./faces";

type FaceEls = { root: HTMLDivElement | null; night: HTMLDivElement | null; day: HTMLDivElement | null };
type Clock = { travel: number; fold: number; flip: number };

const DEFAULT_ARC = 0.06;
const DEFAULT_LEAN = 4;
const FAR = 4000;

function facesFor(move: ActorMove | undefined): FaceId[] {
  if (!move) return [];
  return move.faceFrom && move.faceFrom !== move.face ? [move.faceFrom, move.face] : [move.face];
}

function total(c: ActorChannel | undefined): number {
  return c && c.drive === "timed" ? (c.delay ?? 0) + c.duration : 0;
}

/** Advance a timed clock toward its target and return it. */
function chase(raw: number, on: boolean, length: number, dt: number): number {
  return on ? Math.min(length, raw + dt) : Math.max(0, raw - dt);
}

function channelValue(c: ActorChannel | undefined, fallback: number, travel: number, raw: number): number {
  if (!c) return fallback;
  if (c.drive === "travel") return lerp(c.from, c.to, travel);
  const k = travelEase(clamp01((raw - (c.delay ?? 0)) / c.duration));
  return lerp(c.from, c.to, k);
}

export function Actor() {
  const beat = story.useBeat();
  const rootRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<FaceId, FaceEls>());

  // Mount the faces of the previous, current and next beat, so a face is always there before it is needed.
  const mounted = useMemo(() => {
    const i = BEATS.findIndex((b) => b.id === beat);
    const set = new Set<FaceId>();
    for (let k = i - 1; k <= i + 1; k++) {
      const b = BEATS[k];
      if (b) facesFor(ACTOR_TRACK[b.id]).forEach((f) => set.add(f));
    }
    return FACE_ORDER.filter((f) => set.has(f));
  }, [beat]);

  useEffect(() => {
    if (story.reduced()) return;
    const root = rootRef.current;
    const flipEl = flipRef.current;
    if (!root || !flipEl) return;

    const clock: Clock = { travel: 0, fold: 0, flip: 0 };
    let clockBeat: BeatId | null = null;
    let pendingDirection: 1 | -1 | 0 = 0;
    let dockedEl: HTMLElement | null = null;
    const last = new Map<string, string>();
    const seen = new Map<FaceId, HTMLElement>();
    const put = (key: string, el: HTMLElement, prop: string, value: string) => {
      if (last.get(key) === value) return;
      last.set(key, value);
      if (prop.startsWith("--")) el.style.setProperty(prop, value);
      else (el.style as unknown as Record<string, string>)[prop] = value;
    };

    const undock = () => {
      if (dockedEl) {
        dockedEl.removeAttribute("data-docked");
        dockedEl = null;
      }
    };

    const offBeat = story.onBeatChange((_beat, _prev, direction) => {
      pendingDirection = direction;
    });

    const frame = (_time: number, dt: number, s: Readonly<StoryState>) => {
      const actor = story.actorState();
      const move = ACTOR_TRACK[s.beat];
      if (!move) {
        undock();
        put("vis", root, "visibility", "hidden");
        actor.present = false;
        actor.docked = false;
        actor.face = null;
        clockBeat = s.beat;
        return;
      }

      const p = s.beatProgress;
      const r0 = move.range?.[0] ?? 0;
      const r1 = move.range?.[1] ?? 1;
      const duration = move.duration ?? 0.8;
      const travelOn = p >= r0;
      const foldOn = move.fold?.drive === "timed" ? p >= move.fold.at : false;
      const flipOn = move.flip?.drive === "timed" ? p >= move.flip.at : false;

      if (clockBeat !== s.beat) {
        if (clockBeat !== null && pendingDirection === 1) {
          // Forward entry: timed channels start from zero and play.
          clock.travel = clock.fold = clock.flip = 0;
        } else if (clockBeat !== null && pendingDirection === -1) {
          // Backward entry: the end state at once, no reverse replay.
          clock.travel = duration;
          clock.fold = total(move.fold);
          clock.flip = total(move.flip);
        } else {
          // First frame (page load or restore): wherever the scroll position says they belong.
          clock.travel = travelOn ? duration : 0;
          clock.fold = foldOn ? total(move.fold) : 0;
          clock.flip = flipOn ? total(move.flip) : 0;
        }
        clockBeat = s.beat;
        pendingDirection = 0;
      }
      clock.travel = chase(clock.travel, travelOn, duration, dt);
      clock.fold = chase(clock.fold, foldOn, total(move.fold), dt);
      clock.flip = chase(clock.flip, flipOn, total(move.flip), dt);

      // A move with nowhere to go is at rest.
      const t = move.from === move.to ? 1 : move.mode === "timed" ? travelEase(clock.travel / duration) : clamp01((p - r0) / (r1 - r0 || 1));
      const fold = channelValue(move.fold, 1, t, clock.fold);
      const flip = channelValue(move.flip, 0, t, clock.flip);

      const a = anchorRect(move.from) ?? anchorRect(move.to);
      const b = anchorRect(move.to) ?? a;
      if (!a || !b) {
        undock();
        put("vis", root, "visibility", "hidden");
        actor.present = false;
        actor.docked = false;
        return;
      }

      const faceTo = getFace(move.face);
      const faceFrom = move.faceFrom && move.faceFrom !== move.face ? getFace(move.faceFrom) : null;

      const w = lerp(a.w, b.w, t);
      const h = lerp(a.h, b.h, t);
      const dx = b.x + b.w / 2 - (a.x + a.w / 2);
      const dy = b.y + b.h / 2 - (a.y + a.h / 2);
      const dist = Math.hypot(dx, dy);
      const bump = Math.sin(Math.PI * t);
      let ox = 0;
      let oy = 0;
      if (dist > 1) {
        // Perpendicular to travel, on the side that points up the screen.
        let nx = dy / dist;
        let ny = -dx / dist;
        if (ny > 0) {
          nx = -nx;
          ny = -ny;
        }
        const peak = (move.arc ?? DEFAULT_ARC) * dist * bump;
        ox = nx * peak;
        oy = ny * peak;
      }
      const x = lerp(a.x, b.x, t) + ox;
      const y = lerp(a.y, b.y, t) + oy;

      const vh = s.viewport.h;
      const split = s.dayTop > 0 && s.dayTop < vh;
      const lean = split || dist <= 1 ? 0 : (move.lean ?? DEFAULT_LEAN) * bump * Math.sign(dx || 1);
      const rot = (move.rotate ? lerp(move.rotate[0], move.rotate[1], t) : 0) + lean;

      const fromMeta = (faceFrom ?? faceTo).meta;
      const radius = lerp(fromMeta.radius * (a.w / fromMeta.width), faceTo.meta.radius * (b.w / faceTo.meta.width), t);
      const opacity = move.fadeIn ? clamp01((p - move.fadeIn[0]) / (move.fadeIn[1] - move.fadeIn[0] || 1)) : 1;

      const target = move.dock && t >= 1 && !split ? anchorElement(move.to) : null;
      const docked = target !== null;
      if (target !== dockedEl) {
        undock();
        if (target) {
          target.setAttribute("data-docked", "");
          dockedEl = target;
        }
      }

      actor.present = docked || opacity > 0.01;
      actor.docked = docked;
      actor.face = faceFrom && t < 0.5 ? faceFrom.id : faceTo.id;
      actor.x = x;
      actor.y = y;
      actor.w = w;
      actor.h = h;
      actor.travel = t;
      actor.fold = fold;
      actor.flip = flip;

      /* ── writes ── */
      put("vis", root, "visibility", docked || opacity <= 0.01 ? "hidden" : "visible");
      if (docked) return;
      put("w", root, "width", `${w.toFixed(2)}px`);
      put("h", root, "height", `${h.toFixed(2)}px`);
      put("tf", root, "transform", `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${rot.toFixed(3)}deg)`);
      put("op", root, "opacity", opacity.toFixed(3));
      put("rad", root, "--face-radius", `${radius.toFixed(2)}px`);
      put("fold", root, "--fold", fold.toFixed(4));
      put("flipv", root, "--flip", flip.toFixed(4));
      put("prog", root, "--progress", t.toFixed(4));
      put("lift", root, "--lift", bump.toFixed(3));
      put("flip", flipEl, "transform", move.flip ? `rotateY(${(flip * 180).toFixed(2)}deg)` : "none");

      const mix = faceFrom ? clamp01((t - 0.4) / 0.2) : 1;
      const blur = faceFrom && !move.flip ? 4 * Math.sin(Math.PI * clamp01((t - 0.25) / 0.5)) : 0;
      put("blur", root, "filter", blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none");

      const nightOn = s.dayTop > 0;
      const dayOn = s.dayTop < vh;
      const nightClip = split ? `inset(${-FAR}px ${-FAR}px ${(y + h - s.dayTop).toFixed(2)}px ${-FAR}px)` : "none";
      const dayClip = split ? `inset(${(s.dayTop - y).toFixed(2)}px ${-FAR}px ${-FAR}px ${-FAR}px)` : "none";

      els.current.forEach((e, id) => {
        if (!e.root) return;
        if (seen.get(id) !== e.root) {
          // A face was (re)mounted: its element has none of the cached styles.
          seen.set(id, e.root);
          last.forEach((_, key) => {
            if (key.startsWith(`${id}:`)) last.delete(key);
          });
        }
        const isTo = id === faceTo.id;
        const isFrom = faceFrom !== null && id === faceFrom.id;
        if (!isTo && !isFrom) {
          put(`${id}:d`, e.root, "display", "none");
          return;
        }
        const faceOpacity = move.flip ? 1 : isTo ? mix : 1 - mix;
        if (faceOpacity <= 0.001) {
          put(`${id}:d`, e.root, "display", "none");
          return;
        }
        const meta = isTo ? faceTo.meta : (faceFrom ?? faceTo).meta;
        put(`${id}:d`, e.root, "display", "block");
        put(`${id}:s`, e.root, "--face-scale", (w / meta.width).toFixed(4));
        if (move.flip) {
          put(`${id}:o`, e.root, "opacity", "1");
          put(`${id}:t`, e.root, "transform", isTo ? "rotateY(180deg)" : "none");
          put(`${id}:b`, e.root, "backfaceVisibility", "hidden");
        } else {
          put(`${id}:o`, e.root, "opacity", faceOpacity.toFixed(3));
          put(`${id}:t`, e.root, "transform", "none");
          put(`${id}:b`, e.root, "backfaceVisibility", "visible");
        }
        if (e.night) {
          put(`${id}:nv`, e.night, "display", nightOn ? "block" : "none");
          put(`${id}:nc`, e.night, "clipPath", nightClip);
        }
        if (e.day) {
          put(`${id}:dv`, e.day, "display", dayOn ? "block" : "none");
          put(`${id}:dc`, e.day, "clipPath", dayClip);
        }
      });
    };

    const offFrame = story.frame("actor", frame);
    return () => {
      offFrame();
      offBeat();
      undock();
    };
  }, []);

  const move = ACTOR_TRACK[beat];
  const settledFold = move?.fold ? move.fold.to : 1;
  const slot = (id: FaceId): FaceEls => {
    let e = els.current.get(id);
    if (!e) els.current.set(id, (e = { root: null, night: null, day: null }));
    return e;
  };

  return (
    <div className="actor-layer" aria-hidden="true" inert>
      <div ref={rootRef} className="actor" data-actor="">
        <div ref={flipRef} className="actor-flip">
          {mounted.map((id) => (
            <div
              key={id}
              className="actor-face"
              data-face={id}
              ref={(el) => {
                slot(id).root = el;
              }}
            >
              <div
                className="actor-skin"
                data-skin="night"
                ref={(el) => {
                  slot(id).night = el;
                }}
              >
                <FaceFrame face={id} skin="night" fold={settledFold} progress={1} host="actor" />
              </div>
              <div
                className="actor-skin"
                data-skin="day"
                ref={(el) => {
                  slot(id).day = el;
                }}
              >
                <FaceFrame face={id} skin="day" fold={settledFold} progress={1} host="actor" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
