/**
 * LUMI'S TRACK — where the companion firefly is, how it feels and what it says, per beat.
 * Data only, like LINE_TRACK and SCENE_TRACK in lib/story.ts: no React, no Three.
 *
 * Each beat has keys at beat-progress points. Between two keys Lumi's target slides (smoothstep)
 * from one spot to the next; Lumi itself springs after the target, so it always flies, never jumps.
 *
 *   spot     { a: anchor, at: [fx, fy] inside its rect, off: [px, py] }   follows the layout
 *            the same with actor: true: on the flying Role while the Actor carries it
 *            { vp: [fx, fy], off }                                          a point of the viewport
 *   mood     the clip it plays there (rig.ts): perch, hover, curious, cheer (a one-shot notice), sleepy
 *   glow     its lantern, 0..1.2 (night 1, day a little lower)
 *   note     one handwritten line (lib/content.ts story.lumi.notes), shown between two beat-progress points
 *
 * The hero's first moments are not here: waking on the lamp and joining the cursor are timed, not
 * scrolled (Lumi.tsx). The track takes over once the visitor scrolls.
 */

import type { AnchorId } from "@/lib/anchors";
import type { BeatId } from "@/lib/story";
import type { storyCopy } from "@/lib/content";

export type Mood = "perch" | "hover" | "curious" | "cheer" | "sleepy";
export type NoteId = keyof typeof storyCopy.lumi.notes;

export type Spot =
  | { a: AnchorId; at?: readonly [number, number]; off?: readonly [number, number]; small?: readonly [number, number]; actor?: boolean }
  | { vp: readonly [number, number]; off?: readonly [number, number]; small?: readonly [number, number] };

export type LumiKey = { at: number; spot: Spot; mood?: Mood; glow?: number };
/** `side` pins the note left or right of Lumi (default: the side with more room). */
export type LumiBeat = { keys: readonly LumiKey[]; note?: { id: NoteId; from: number; to: number; side?: "l" | "r" } };

/** Size of Lumi's box (CSS px): the character fills about two thirds of it. */
export const LUMI_SIZE = { wide: 156, small: 104 };

const A = (a: AnchorId, at: readonly [number, number] = [0.5, 0.5], off: readonly [number, number] = [0, 0], small?: readonly [number, number]): Spot => ({ a, at, off, small });
/** On the Role itself while the Actor flies it (state.actor), else on the anchor it rests on. */
const R = (a: AnchorId, at: readonly [number, number] = [1, 0], off: readonly [number, number] = [0, 0], small?: readonly [number, number]): Spot => ({ a, at, off, small, actor: true });
const V = (x: number, y: number, small?: readonly [number, number]): Spot => ({ vp: [x, y], small });

export const LUMI_TRACK: Record<BeatId, LumiBeat> = {
  // From the lamp (or the cursor) to the window, then through it with the push: follow-cam, low and centred.
  hero: {
    keys: [
      { at: 0, spot: A("desk-lamp", [0.5, 0], [0, -36]), mood: "perch", glow: 1 },
      { at: 0.1, spot: A("window-view", [0.5, 0.42]), mood: "hover" },
      { at: 0.3, spot: V(0.56, 0.64, [0.7, 0.84]), mood: "hover" },
      { at: 1, spot: V(0.6, 0.66, [0.7, 0.85]), mood: "hover" },
    ],
    note: { id: "window", from: 0.12, to: 0.45 },
  },
  // Skimming the meadow: the fireflies near it brighten as it reads them (worldBus.lantern).
  pass1: {
    keys: [
      { at: 0, spot: V(0.6, 0.66, [0.7, 0.85]), mood: "hover" },
      { at: 0.5, spot: V(0.74, 0.58, [0.76, 0.82]) },
      { at: 1, spot: V(0.66, 0.7, [0.66, 0.86]) },
    ],
    note: { id: "meadow", from: 0.12, to: 0.75 },
  },
  pass2: {
    keys: [
      { at: 0, spot: V(0.66, 0.7, [0.66, 0.86]), mood: "hover" },
      { at: 0.55, spot: V(0.72, 0.6, [0.74, 0.84]), mood: "cheer" },
      { at: 1, spot: V(0.72, 0.6, [0.74, 0.84]), mood: "hover" },
    ],
    note: { id: "kept", from: 0.5, to: 0.98 },
  },
  // Only with ?explore=1: Lumi steps back to a corner and lets the 3D meadow have the stage.
  explore: {
    keys: [
      { at: 0, spot: V(0.72, 0.6), mood: "hover" },
      { at: 0.12, spot: V(0.9, 0.2, [0.84, 0.16]), mood: "curious" },
      { at: 0.88, spot: V(0.9, 0.2, [0.84, 0.16]), mood: "curious" },
      { at: 1, spot: V(0.72, 0.6), mood: "hover" },
    ],
    note: { id: "explore", from: 0.12, to: 0.5 },
  },
  // The twelve fly into the list: Lumi leads them in and waits by the top row.
  ranked: {
    keys: [
      { at: 0, spot: V(0.72, 0.6, [0.74, 0.84]), mood: "hover" },
      { at: 0.4, spot: A("row-1", [0, 0.5], [-64, 0], [8, -40]), mood: "hover" },
      { at: 1, spot: A("row-1", [0, 0.5], [-64, 0], [8, -40]), mood: "curious" },
    ],
  },
  // The card opens: Lumi lands on its corner.
  reason: {
    keys: [
      { at: 0, spot: A("row-1", [0, 0.5], [-64, 0], [8, -40]), mood: "hover" },
      { at: 0.35, spot: R("card", [1, 0], [-18, -40], [-30, -40]), mood: "perch" },
      { at: 1, spot: R("card", [1, 0], [-18, -40], [-30, -40]), mood: "perch" },
    ],
    note: { id: "fits", from: 0.35, to: 0.95 },
  },
  daybreak: {
    keys: [
      { at: 0, spot: R("card", [1, 0], [-18, -40], [-30, -40]), mood: "perch", glow: 1 },
      { at: 0.6, spot: R("card", [1, 0], [-18, -40], [-30, -40]), mood: "hover", glow: 0.7 },
      { at: 1, spot: R("tile-saved", [1, 0], [-10, -36]), mood: "hover", glow: 0.7 },
    ],
    note: { id: "keep", from: 0.55, to: 1 },
  },
  saved: {
    keys: [
      { at: 0, spot: R("tile-saved", [1, 0], [-10, -36]), mood: "hover", glow: 0.7 },
      { at: 0.5, spot: R("tile-saved", [1, 0], [-10, -36]), mood: "perch" },
    ],
  },
  applied: {
    keys: [
      { at: 0, spot: R("tile-saved", [1, 0], [-10, -36]), mood: "hover", glow: 0.7 },
      { at: 0.55, spot: R("tile-applied", [1, 0], [-10, -36]), mood: "perch" },
    ],
  },
  interview: {
    keys: [
      { at: 0, spot: R("tile-applied", [1, 0], [-10, -36]), mood: "hover", glow: 0.7 },
      { at: 0.55, spot: R("tile-interview", [1, 0], [-10, -36]), mood: "cheer", glow: 0.9 },
      { at: 1, spot: R("tile-interview", [1, 0], [-10, -36]), mood: "hover" },
    ],
    note: { id: "interview", from: 0.5, to: 1 },
  },
  // The card floats up to "Book the interview…": Lumi rides with it, then back to the night desk.
  hinge: {
    keys: [
      { at: 0, spot: R("tile-interview", [1, 0], [-10, -36]), mood: "hover", glow: 0.8 },
      { at: 0.4, spot: R("hinge-float", [1, 0], [-6, -40]), mood: "perch" },
    ],
  },
  nightfall: {
    keys: [
      { at: 0, spot: R("hinge-float", [1, 0], [-6, -40]), mood: "perch", glow: 0.8 },
      { at: 0.7, spot: A("desk-lamp", [0.5, 0], [0, -36]), mood: "hover", glow: 1 },
    ],
  },
  // The prep sheet: Lumi is the reading light, beside the line being written.
  unfold: {
    keys: [
      { at: 0, spot: A("desk-lamp", [0.5, 0], [0, -36]), mood: "hover", glow: 1 },
      { at: 0.7, spot: A("sheet", [0, 0.2], [-80, 0], [24, -54]), mood: "hover", glow: 1.1 },
    ],
  },
  q1: {
    keys: [{ at: 0, spot: A("sheet", [0, 0.2], [-80, 0], [24, -54]), mood: "hover", glow: 1.1 }, { at: 0.4, spot: A("sheet-q1", [0, 0.5], [-80, 0], [24, -50]), mood: "curious" }],
    note: { id: "prep", from: 0.35, to: 1, side: "l" },
  },
  q2: {
    keys: [{ at: 0, spot: A("sheet-q1", [0, 0.5], [-80, 0], [24, -50]), mood: "hover", glow: 1.1 }, { at: 0.4, spot: A("sheet-q2", [0, 0.5], [-80, 0], [24, -50]), mood: "curious" }],
  },
  q3: {
    keys: [{ at: 0, spot: A("sheet-q2", [0, 0.5], [-80, 0], [24, -50]), mood: "hover", glow: 1.1 }, { at: 0.4, spot: A("sheet-q3", [0, 0.5], [-80, 0], [24, -50]), mood: "curious" }],
  },
  votes: {
    keys: [{ at: 0, spot: A("sheet-q3", [0, 0.5], [-80, 0], [24, -50]), mood: "hover", glow: 1 }, { at: 0.4, spot: A("sheet-foot", [0, 0.5], [-80, -20], [24, -60]), mood: "curious" }],
    note: { id: "votes", from: 0.4, to: 1, side: "l" },
  },
  // Morning: its night shift is ending.
  dawn: {
    keys: [
      { at: 0, spot: A("sheet-foot", [0, 0.5], [-80, -20], [24, -60]), mood: "hover", glow: 0.9 },
      { at: 0.6, spot: V(0.5, 0.36, [0.5, 0.3]), mood: "sleepy", glow: 0.45 },
      { at: 1, spot: V(0.5, 0.36, [0.5, 0.3]), mood: "sleepy", glow: 0.45 },
    ],
    note: { id: "morning", from: 0.55, to: 1 },
  },
  // The seat: Lumi lands on the ticket. After the stamp (Lumi.tsx) it settles by the nav's CTA and stays.
  seat: {
    keys: [
      { at: 0, spot: V(0.5, 0.36, [0.5, 0.3]), mood: "hover", glow: 0.6 },
      { at: 0.5, spot: R("ticket", [1, 0], [-28, -44], [-36, -44]), mood: "perch", glow: 0.7 },
    ],
    note: { id: "seat", from: 0.5, to: 1 },
  },
  footer: {
    keys: [{ at: 0, spot: R("ticket", [1, 0], [-28, -44], [-36, -44]), mood: "perch", glow: 0.6 }],
  },
};

/** After the seat is claimed: just under the nav's CTA (the nav sits above Lumi), for the rest of the visit. */
export const NAV_SEAT: Spot = A("nav-cta", [0.1, 1], [0, 62], [0, 48]);
