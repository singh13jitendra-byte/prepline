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
 * - Faces: at travel midpoint the surface stays whole while the old content
 *   leaves (t 0.40..0.50) and the new content arrives (t 0.50..0.60): no frame
 *   shows two layouts at once. A move with `crossfade: false` wears the
 *   from-face for the whole travel and cuts to the to-face at the end. A move
 *   with a `flip` channel turns on rotateY instead.
 *   Each face is scaled uniformly from its natural size to the box width
 *   (or to the box height, with a flexing width, when its meta says fit: "height").
 * - Skins: outside wipes one skin is shown. While the line sweeps, both are
 *   stacked and each is clipped at the line (state.dayTop), so the Actor is cut
 *   into glass above and paper below at exactly the line. Lean is 0 while split.
 * - Docking: on a `dock` move, once travel is complete the real DOM face in the
 *   `to` anchor gets `data-docked` (FaceSlot shows it) and the Actor is hidden
 *   in the same frame. Leaving the beat undocks.
 * - Fold, flip, progress and lift (0..1..0 while travelling): in
 *   story.get().actor, and as CSS variables ONLY on elements inside a face that
 *   ask for them with data-actor-var="fold flip progress lift". They are not
 *   set on the Actor itself: an inherited variable there restyled 700 nodes a frame.
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
import { faceRadius } from "@/lib/theme";

type FaceEls = { root: HTMLDivElement | null; night: HTMLDivElement | null; day: HTMLDivElement | null };
type Clock = { travel: number; fold: number; flip: number };

const DEFAULT_ARC = 0.06;
const DEFAULT_LEAN = 4;
const FAR = 4000;
/** Faces wider than this are never blurred. */
const BLUR_MAX_W = 300;
/** How far outside its box a skin may draw (shadow, glow): it is kept while the line is this close. */
const SKIN_PAD = 80;

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
    let wasMoving = false;
    let frameNo = 0;
    // Last value written per element and property: a write happens only when the value changes.
    const written = new WeakMap<HTMLElement, Map<string, string>>();
    const put = (el: HTMLElement, prop: string, value: string) => {
      let m = written.get(el);
      if (!m) written.set(el, (m = new Map()));
      if (m.get(prop) === value) return;
      m.set(prop, value);
      if (prop.startsWith("--")) el.style.setProperty(prop, value);
      else (el.style as unknown as Record<string, string>)[prop] = value;
    };
    // The few elements inside a skin that take per-frame values. Looked up again every half second
    // and after a beat change, because a face may re-render and replace them.
    type Leaves = { at: number; chrome: HTMLElement | null; clip: HTMLElement | null; content: HTMLElement | null; vars: { el: HTMLElement; names: string[] }[] };
    const leafCache = new WeakMap<HTMLElement, Leaves>();
    let leavesValidFrom = 0;
    const leaves = (wrap: HTMLElement): Leaves => {
      let l = leafCache.get(wrap);
      if (!l || l.at < leavesValidFrom || frameNo - l.at > 30) {
        l = {
          at: frameNo,
          chrome: wrap.querySelector<HTMLElement>(":scope > .face > .face-chrome"),
          clip: wrap.querySelector<HTMLElement>(":scope > .face > .face-clip"),
          content: wrap.querySelector<HTMLElement>(":scope > .face > .face-clip > .face-content"),
          vars: Array.from(wrap.querySelectorAll<HTMLElement>("[data-actor-var]"), (el) => ({ el, names: (el.dataset.actorVar ?? "").split(" ") })),
        };
        leafCache.set(wrap, l);
      }
      return l;
    };

    const undock = () => {
      if (dockedEl) {
        dockedEl.removeAttribute("data-docked");
        dockedEl = null;
      }
    };

    const offBeat = story.onBeatChange((_beat, _prev, direction) => {
      pendingDirection = direction;
      // Faces re-render on beat change: look their leaves up again over the next frames.
      leavesValidFrom = frameNo + 2;
    });

    const frame = (_time: number, dt: number, s: Readonly<StoryState>) => {
      const actor = story.actorState();
      const move = ACTOR_TRACK[s.beat];
      if (!move) {
        undock();
        put(root, "visibility", "hidden");
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
        put(root, "visibility", "hidden");
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
      const fromId = (faceFrom ?? faceTo).id;
      const radius = lerp(faceRadius(fromId, fromMeta.radius) * (a.w / fromMeta.width), faceRadius(faceTo.id, faceTo.meta.radius) * (b.w / faceTo.meta.width), t);
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
      actor.face = faceFrom && (move.crossfade === false ? t < 1 : t < 0.5) ? faceFrom.id : faceTo.id;
      actor.x = x;
      actor.y = y;
      actor.w = w;
      actor.h = h;
      actor.travel = t;
      actor.fold = fold;
      actor.flip = flip;

      /* ── writes ── */
      // Everything below is written on the element that uses it. Nothing inheritable is ever set on the
      // Actor root or a skin wrapper: those have hundreds of descendants and would all be restyled.
      put(root, "visibility", docked || opacity <= 0.01 ? "hidden" : "visible");
      if (docked) return;
      put(root, "width", `${w.toFixed(2)}px`);
      put(root, "height", `${h.toFixed(2)}px`);
      put(root, "transform", `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${rot.toFixed(3)}deg)`);
      put(root, "opacity", opacity.toFixed(3));
      put(flipEl, "transform", move.flip ? `rotateY(${(flip * 180).toFixed(2)}deg)` : "none");

      // Face change. Default: the surface (chrome) never dips; the old content leaves (t 0.40..0.50)
      // before the new content arrives (t 0.50..0.60), so no frame shows two layouts at once.
      // `crossfade: false`: the from-face is worn for the whole travel and the to-face takes over at
      // the end (the two are designed to be identical there: the tile is the folded sheet's cover).
      const cut = move.crossfade === false;
      const outK = !faceFrom ? 0 : cut ? (t < 1 ? 1 : 0) : 1 - clamp01((t - 0.4) / 0.1);
      const inK = !faceFrom ? 1 : cut ? (t < 1 ? 0 : 1) : clamp01((t - 0.5) / 0.1);
      const surfaceK = !faceFrom ? 1 : cut ? inK : clamp01((t - 0.4) / 0.2);
      const blur = faceFrom && !cut && !move.flip && w <= BLUR_MAX_W ? 2 * Math.sin(Math.PI * clamp01((t - 0.42) / 0.16)) : 0;
      put(root, "filter", blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none");
      const moving = t > 0 && t < 1;
      if (moving !== wasMoving) {
        wasMoving = moving;
        root.toggleAttribute("data-moving", moving);
      }

      // Skins: one outside a wipe. During a wipe a skin is drawn only if the line leaves it something to show.
      const reach = Math.max(h, ...[faceFrom, faceTo].map((f) => (f && !f.meta.clip ? f.meta.height * (w / f.meta.width) : 0)));
      const nightOn = split ? s.dayTop > y - SKIN_PAD : s.dayTop > 0;
      const dayOn = split ? s.dayTop < y + reach + SKIN_PAD : s.dayTop <= 0;
      const nightClip = split && dayOn ? `inset(${-FAR}px ${-FAR}px ${(y + h - s.dayTop).toFixed(2)}px ${-FAR}px)` : "none";
      const dayClip = split && nightOn ? `inset(${(s.dayTop - y).toFixed(2)}px ${-FAR}px ${-FAR}px ${-FAR}px)` : "none";
      const radiusPx = `${radius.toFixed(2)}px`;
      frameNo++;

      els.current.forEach((e, id) => {
        if (!e.root) return;
        const isTo = id === faceTo.id;
        const isFrom = faceFrom !== null && id === faceFrom.id;
        const k = move.flip ? 1 : isTo ? inK : isFrom ? outK : 0;
        // Under the incoming surface the old one holds (opaque paper) or hands over (glass, where two
        // translucent layers would read denser), and is gone once the new one is whole.
        const surface = move.flip ? 1 : isTo ? surfaceK : !isFrom ? 0 : cut ? outK : surfaceK >= 1 ? 0 : nightOn && !dayOn ? 1 - surfaceK : 1;
        if ((!isTo && !isFrom) || (k <= 0.001 && surface <= 0.001)) {
          put(e.root, "display", "none");
          return;
        }
        const meta = isTo ? faceTo.meta : (faceFrom ?? faceTo).meta;
        put(e.root, "display", "block");
        put(e.root, "transform", move.flip && isTo ? "rotateY(180deg)" : "none");
        put(e.root, "backfaceVisibility", move.flip ? "hidden" : "visible");
        // Height-fit faces keep their natural height and let their layout take the box's width.
        const scale = meta.fit === "height" ? h / meta.height : w / meta.width;
        const tf = `scale(${scale.toFixed(4)})`;
        const cw = meta.fit === "height" ? `${(w / scale).toFixed(2)}px` : "";
        for (let n = 0; n < 2; n++) {
          const wrap = n === 0 ? e.night : e.day;
          if (!wrap) continue;
          const on = n === 0 ? nightOn : dayOn;
          put(wrap, "display", on ? "block" : "none");
          if (!on) continue;
          put(wrap, "clipPath", n === 0 ? nightClip : dayClip);
          const leaf = leaves(wrap);
          if (leaf.chrome) {
            put(leaf.chrome, "borderRadius", radiusPx);
            put(leaf.chrome, "opacity", surface.toFixed(3));
            if (n === 1) put(leaf.chrome, "--lift", bump.toFixed(3));
          }
          if (leaf.clip) {
            put(leaf.clip, "borderRadius", radiusPx);
            put(leaf.clip, "opacity", (meta.chrome ? k : Math.max(k, surface)).toFixed(3));
          }
          if (leaf.content) {
            put(leaf.content, "transform", tf);
            if (cw) put(leaf.content, "width", cw);
          }
          for (let i = 0; i < leaf.vars.length; i++) {
            const v = leaf.vars[i];
            for (let j = 0; j < v.names.length; j++) {
              const name = v.names[j];
              const value = name === "fold" ? fold : name === "flip" ? flip : name === "progress" ? t : name === "lift" ? bump : null;
              if (value !== null) put(v.el, `--${name}`, value.toFixed(4));
            }
          }
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
