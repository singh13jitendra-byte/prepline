"use client";

/**
 * LUMI — the companion firefly that walks the visitor through the page (storyboard: the Lumi canvas).
 *
 * The character is the existing 3D firefly (rig.ts). This component decides where it is, how it
 * feels and what it says, once per page frame, in the store's "world" phase:
 *
 *   hero, at the top   it dozes above the desk lamp, wakes (a stretch, eyes pop open) and says hello;
 *                      with a fine pointer it then flies to the cursor and follows it ("I'll come with you")
 *   from first scroll  it follows LUMI_TRACK (track.ts): through the window, over the meadow, onto the
 *                      Role as the Actor carries it, beside the prep sheet as a reading light, to the ticket
 *   seat saved         on `prepline:seat-claimed` / `prepline:seat-docked` it says goodbye and settles by
 *                      the nav's CTA for the rest of the visit
 *
 * Its light is the lantern the meadow answers (worldBus.lantern, read by fieldScene.ts): fireflies
 * near Lumi brighten and drift toward it, so it visibly reads them. The cursor lantern is retired.
 *
 * Writes only transform, opacity and a few data attributes, and only when they change. Layout is
 * never read here: spots come from anchorRect() (measured by the store) and the Actor's state.
 * Decorative: aria-hidden, no pointer events, `.only-motion` (reduced motion and no-JS get nothing),
 * and nothing at all without WebGL.
 */

import { useEffect, useRef } from "react";
import { anchorRect, watchAnchors, type AnchorId } from "@/lib/anchors";
import { storyCopy } from "@/lib/content";
import { webglAvailable } from "@/lib/gl";
import { story, type BeatId, type StoryState } from "@/lib/story";
import { worldBus } from "@/components/world/bus";
import { mountLumi, type LumiRig, type RigMood } from "./rig";
import { LUMI_SIZE, LUMI_TRACK, NAV_SEAT, type Mood, type NoteId, type Spot } from "./track";
import "./lumi.css";

/** Spring toward the target (1/s²) and its damping. Following the cursor is a little lazier. */
const K = 46;
const K_FOLLOW = 30;
/** Above this speed (px/s) it flies (the `fly` clip, leaning in) whatever the track's mood. */
const FLY_SPEED = 420;
/** The timed hero intro, in seconds from the moment the character is ready. */
const WAKE_AT = 1.3;
const HELLO = [2.1, 6.8] as const;
const FOLLOW_AT = 5.2;
const JOIN_FOR = 3.2;
const BYE_FOR = 3.6;
/** Hero progress below which the intro holds (before the first real scroll). */
const INTRO_END = 0.035;
/** The cursor offset while it follows: up and to the right of the pointer, out of the way. */
const FOLLOW_OFF = [46, -42] as const;
const POOL_R = 200;
const SEAT_KEY = "prepline:seat";
const LIGHTS_MEADOW: readonly BeatId[] = ["hero", "pass1", "pass2", "explore", "ranked"];

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

function seatSaved(): boolean {
  try {
    return window.sessionStorage.getItem(SEAT_KEY) !== null;
  } catch {
    return false;
  }
}

function anchorsOf(beat: BeatId): AnchorId[] {
  const ids = new Set<AnchorId>(["nav-cta", "desk-lamp"]);
  for (const k of LUMI_TRACK[beat]?.keys ?? []) if ("a" in k.spot) ids.add(k.spot.a);
  return [...ids];
}

export function Lumi() {
  const host = useRef<HTMLDivElement>(null);
  const pool = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = host.current;
    const pl = pool.current;
    const nt = note.current;
    if (!el || !pl || !nt) return;
    if (story.reduced() || !webglAvailable()) return;

    let rig: LumiRig | null = null;
    let disposed = false;
    let offFrame: (() => void) | null = null;
    let unwatch: (() => void) | null = null;
    let offBeat: (() => void) | null = null;

    const small = window.matchMedia("(max-width: 767px)").matches;
    const S = small ? LUMI_SIZE.small : LUMI_SIZE.wide;
    el.style.width = el.style.height = `${S}px`;

    // where it is, how fast it moves, what it looks like
    let px = NaN;
    let py = NaN;
    let vx = 0;
    let vy = 0;
    let yaw = 0.3;
    let roll = 0;
    let pitch = 0;
    let glow = 0.25;
    let night = 1;
    let elapsed = 0;
    let introDone = false;
    let following = false;
    let followSince = -1;
    let claimed = seatSaved();
    let byeAt = -1;
    let rigMood: RigMood = "perch";
    let wantMood: Mood | "wake" = "perch";
    let oneShotUntil = 0;
    // what was last written, to write only changes
    let lastT = "";
    let lastPoolT = "";
    let lastPoolO = "";
    let noteId: NoteId | null = null;
    let noteOnNext = false;
    let lastNoteT = "";
    let lastSide = "";
    let lastDay = "";

    const onClaim = () => {
      if (claimed) return;
      claimed = true;
      byeAt = elapsed;
    };
    window.addEventListener("prepline:seat-claimed", onClaim);
    window.addEventListener("prepline:seat-docked", onClaim);
    // Lumi only follows a pointer that has really moved (not one parked over the page at load).
    const onFirstMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      worldBus.pointerMoved = true;
      window.removeEventListener("pointermove", onFirstMove);
    };
    window.addEventListener("pointermove", onFirstMove, { passive: true });

    const resolve = (spot: Spot, s: Readonly<StoryState>): [number, number] | null => {
      const vw = s.viewport.w || window.innerWidth;
      const vh = s.viewport.h || window.innerHeight;
      if ("vp" in spot) {
        const v = small && spot.small ? spot.small : spot.vp;
        return [v[0] * vw, v[1] * vh];
      }
      let x: number, y: number, w: number, h: number;
      if (spot.actor && s.actor.present && !s.actor.docked) {
        ({ x, y, w, h } = s.actor);
      } else {
        const r = anchorRect(spot.a);
        if (!r || (r.w < 1 && r.h < 1)) return null;
        ({ x, y, w, h } = r);
      }
      const at = spot.at ?? [0.5, 0.5];
      const off = small && spot.small ? spot.small : (spot.off ?? [0, 0]);
      // never park it off screen: keep the whole character inside the viewport
      return [clamp(x + w * at[0] + off[0], S * 0.4, vw - S * 0.4), clamp(y + h * at[1] + off[1], S * 0.45, vh - S * 0.45)];
    };

    /** The track's target for the current beat: position, mood, glow and note. */
    const fromTrack = (s: Readonly<StoryState>) => {
      const tr = LUMI_TRACK[s.beat];
      const keys = tr?.keys ?? [];
      const p = s.beatProgress;
      let i = 0;
      while (i < keys.length - 1 && keys[i + 1].at <= p) i++;
      const a = keys[i];
      const b = keys[Math.min(i + 1, keys.length - 1)];
      const f = b === a || b.at <= a.at ? 0 : ease(clamp((p - a.at) / (b.at - a.at), 0, 1));
      const pa = a ? resolve(a.spot, s) : null;
      const pb = b ? resolve(b.spot, s) : null;
      const pos = pa && pb ? ([pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f] as const) : (pa ?? pb);
      let mood: Mood = "hover";
      let ga = 1;
      for (let j = 0; j <= i; j++) {
        if (keys[j].mood) mood = keys[j].mood!;
        if (keys[j].glow !== undefined) ga = keys[j].glow!;
      }
      const gb = b?.glow ?? ga;
      const on = tr?.note && p >= tr.note.from && p <= tr.note.to;
      return { pos, mood, glow: ga + (gb - ga) * f, note: on ? tr.note!.id : null, side: on ? tr.note!.side : undefined };
    };

    const frame = (t: number, dt0: number, s: Readonly<StoryState>) => {
      if (!rig) return;
      const dt = Math.min(0.05, Math.max(0, dt0));
      elapsed += dt;
      const vw = s.viewport.w || window.innerWidth;
      const vh = s.viewport.h || window.innerHeight;

      let target: readonly [number, number] | null = null;
      let mood: Mood | "wake" = "hover";
      let wantGlow = 1;
      let wantNote: NoteId | null = null;
      let noteSide: "l" | "r" | undefined;
      let k = K;

      const inIntro = s.beat === "hero" && s.beatProgress < INTRO_END;
      if (!inIntro && s.beatProgress > 0) introDone = true;

      if (claimed && (s.beat === "seat" || s.beat === "footer" || byeAt >= 0)) {
        // after the seat: goodbye, then perched by the nav's CTA
        target = resolve(NAV_SEAT, s) ?? fromTrack(s).pos;
        mood = "perch";
        wantGlow = 0.6;
        if (byeAt >= 0 && elapsed - byeAt < BYE_FOR) wantNote = "bye";
        if (s.beat !== "seat" && s.beat !== "footer") byeAt = -1;
      } else if (inIntro) {
        // the timed intro: doze above the lamp, wake, say hello, then (fine pointer) follow the cursor
        // on phones the lamp sits under the hero copy: Lumi dozes by the laptop instead
        const lamp = resolve(small ? { vp: [0.84, 0.88] } : { a: "desk-lamp", at: [0.5, 0], off: [0, -36] }, s);
        const canFollow = s.pointer.fine && !s.flags.coarse && s.pointer.inside && worldBus.pointerMoved;
        if (!introDone && elapsed < WAKE_AT) {
          mood = "sleepy";
          wantGlow = 0.35;
        } else if (!introDone && elapsed < WAKE_AT + 1.5) {
          mood = "wake";
          wantGlow = 1;
        } else mood = "hover";
        if (!introDone && elapsed >= HELLO[0] && elapsed <= HELLO[1]) wantNote = "wake";
        if (canFollow && (introDone || elapsed >= FOLLOW_AT)) {
          if (!following) {
            following = true;
            if (followSince < 0) followSince = elapsed;
          }
          const fx = s.pointer.x + FOLLOW_OFF[0] * (s.pointer.x > vw - 160 ? -1 : 1);
          const fy = s.pointer.y + FOLLOW_OFF[1] * (s.pointer.y < 120 ? -1 : 1);
          target = [clamp(fx, S * 0.4, vw - S * 0.4), clamp(fy, S * 0.45, vh - S * 0.45)];
          k = K_FOLLOW;
          if (followSince >= 0 && elapsed - followSince < JOIN_FOR && wantNote === null) wantNote = "join";
        } else {
          following = false;
          target = lamp;
          if (mood === "hover" && Math.hypot(vx, vy) < 60) mood = "perch";
        }
      } else {
        const tr = fromTrack(s);
        target = tr.pos;
        mood = tr.mood;
        wantGlow = tr.glow;
        wantNote = tr.note;
        noteSide = tr.side;
        following = false;
      }

      if (!target) target = [vw * 0.6, vh * 0.55];
      if (Number.isNaN(px)) {
        px = target[0];
        py = target[1];
      }

      // the spring
      const C = 2 * Math.sqrt(k) * 0.92;
      vx += (k * (target[0] - px) - C * vx) * dt;
      vy += (k * (target[1] - py) - C * vy) * dt;
      px += vx * dt;
      py += vy * dt;
      const speed = Math.hypot(vx, vy);

      // mood: one-shots (wake, cheer) fire on the edge and run out; fast travel flies
      if (mood !== wantMood) {
        wantMood = mood;
        if (mood === "cheer" || mood === "wake") {
          rig.mood(mood);
          rigMood = mood;
          oneShotUntil = elapsed + (mood === "wake" ? 1.5 : 1.2);
        }
      }
      if (elapsed >= oneShotUntil) {
        const base: RigMood = wantMood === "cheer" || wantMood === "wake" ? "hover" : wantMood;
        const eff: RigMood = speed > FLY_SPEED && base !== "sleepy" ? "fly" : base;
        if (eff !== rigMood) {
          rigMood = eff;
          rig.mood(eff);
        }
      }

      // a little life: it never hangs perfectly still (less when perched)
      const still = rigMood === "perch" ? 0.2 : 1;
      const wx = (Math.sin(t * 1.3) * 4 + Math.sin(t * 2.7 + 1) * 2) * still;
      const wy = (Math.sin(t * 1.7 + 2) * 5 + Math.sin(t * 3.1) * 2) * still;
      const x = px + wx;
      const y = py + wy;

      // turn toward where it flies, lean into it
      yaw = damp(yaw, 0.28 + clamp(vx / 700, -1, 1) * 0.95, 6, dt);
      roll = damp(roll, -clamp(vx / 900, -1, 1) * 0.28, 6, dt);
      pitch = damp(pitch, clamp(vy / 1100, -1, 1) * 0.22, 6, dt);
      glow = damp(glow, wantGlow, 3, dt);
      night = damp(night, y < s.dayTop ? 1 : 0, 8, dt);
      rig.set({ glow, yaw, pitch, roll });

      const tf = `translate3d(${(x - S / 2).toFixed(1)}px,${(y - S / 2).toFixed(1)}px,0)`;
      if (tf !== lastT) el.style.transform = lastT = tf;

      // its light on the painting, and the lantern the meadow answers
      const pt = `translate3d(${(x - POOL_R).toFixed(0)}px,${(y + S * 0.12 - POOL_R).toFixed(0)}px,0)`;
      if (pt !== lastPoolT) pl.style.transform = lastPoolT = pt;
      const po = (glow * night * 0.85).toFixed(2);
      if (po !== lastPoolO) pl.style.opacity = lastPoolO = po;
      const L = worldBus.lantern;
      L.x = x;
      L.y = y + S * 0.12;
      L.k = damp(L.k, LIGHTS_MEADOW.includes(s.beat) ? night * clamp(glow, 0, 1) : 0, 5, dt);
      if (L.k < 0.004) L.k = 0;
      L.names = false;
      L.rest = 0;
      L.px = s.pointer.x;
      L.py = s.pointer.y;

      // the note: written on when it changes, beside Lumi, on the side with room
      if (wantNote !== noteId) {
        noteId = wantNote;
        nt.removeAttribute("data-on");
        if (noteId) {
          nt.textContent = storyCopy.lumi.notes[noteId];
          noteOnNext = true;
        }
      } else if (noteOnNext) {
        noteOnNext = false;
        nt.setAttribute("data-on", "");
      }
      if (noteId) {
        const side = small ? (x > vw * 0.5 ? "l" : "r") : (noteSide ?? (x > vw * 0.6 ? "l" : "r"));
        if (side !== lastSide) nt.dataset.side = lastSide = side;
        const nx = side === "r" ? x + S * 0.36 : x - S * 0.36;
        const ny = y - S * 0.34;
        const ntf = `translate3d(${nx.toFixed(0)}px,${ny.toFixed(0)}px,0)`;
        if (ntf !== lastNoteT) nt.style.transform = lastNoteT = ntf;
        const day = night < 0.5 ? "1" : "0";
        if (day !== lastDay) nt.dataset.day = lastDay = day;
      }

      rig.render(t, dt);
    };

    const watch = (beat: BeatId) => {
      unwatch?.();
      unwatch = watchAnchors(anchorsOf(beat));
    };

    mountLumi(el).then((r) => {
      if (disposed) {
        r?.dispose();
        return;
      }
      if (!r) return;
      rig = r;
      // already scrolled past the top (a reload mid-page): no intro
      if (story.get().beat !== "hero" || story.get().beatProgress > INTRO_END) introDone = true;
      rig.mood(introDone ? "hover" : "sleepy");
      rigMood = introDone ? "hover" : "sleepy";
      wantMood = rigMood === "sleepy" ? "sleepy" : "hover";
      watch(story.get().beat);
      offBeat = story.onBeatChange((b) => watch(b));
      offFrame = story.frame("world", frame);
      el.setAttribute("data-on", "");
      (window as unknown as { __lumi?: unknown }).__lumi = { get: () => ({ x: px, y: py, mood: rigMood, note: noteId, glow, claimed }) };
    });

    return () => {
      disposed = true;
      offFrame?.();
      offBeat?.();
      unwatch?.();
      rig?.dispose();
      window.removeEventListener("prepline:seat-claimed", onClaim);
      window.removeEventListener("prepline:seat-docked", onClaim);
      window.removeEventListener("pointermove", onFirstMove);
      worldBus.lantern.k = 0;
    };
  }, []);

  return (
    <>
      <div ref={pool} aria-hidden="true" className="lumi-pool only-motion" />
      <div ref={host} aria-hidden="true" className="lumi only-motion" data-lumi="" />
      <p ref={note} aria-hidden="true" className="lumi-note only-motion" data-side="r" />
    </>
  );
}
