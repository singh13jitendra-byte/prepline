"use client";

/**
 * Shared state of the prep sheet (Act III). Lives outside the sheet face,
 * because the face renders several times at once (two skins in the Actor and
 * the real copy docked in the page): every copy reads the same votes.
 *
 * Votes come from two sources:
 * - the self-running demo of the `votes` beat (scroll-driven, reversible), and
 * - the visitor's own presses on the real buttons.
 * The first real press cancels the demo for good. The votes on screen at that
 * moment become the visitor's starting point, so nothing jumps.
 */

import { useSyncExternalStore } from "react";

export type Vote = "asked" | "not-asked" | null;
export type Votes = readonly [Vote, Vote, Vote];

const EMPTY: Votes = [null, null, null];

let demo: Votes = EMPTY;
let user: Votes = EMPTY;
let cancelled = false;
let pressedOnce = false;
let snapshot = { votes: EMPTY as Votes, cancelled: false, thanks: false };

const listeners = new Set<() => void>();
const bursts = new Set<(index: number, source: "demo" | "user") => void>();

function emit() {
  snapshot = { votes: cancelled ? user : demo, cancelled, thanks: pressedOnce };
  listeners.forEach((fn) => fn());
}

export const prepState = {
  get: () => snapshot,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** The demo writes here. Ignored once the visitor has pressed a button. */
  setDemo(next: Votes) {
    if (cancelled) return;
    if (next[0] === demo[0] && next[1] === demo[1] && next[2] === demo[2]) return;
    demo = next;
    emit();
  },
  /** A real press: toggles that vote and cancels the demo for good. */
  press(index: number, vote: Exclude<Vote, null>) {
    if (!cancelled) {
      user = demo;
      cancelled = true;
    }
    pressedOnce = true;
    const next = [...user] as Vote[];
    next[index] = next[index] === vote ? null : vote;
    user = next as unknown as Votes;
    emit();
    if (next[index] === "asked") bursts.forEach((fn) => fn(index, "user"));
  },
  /** A real vote with an explicit value (PrepSheet's onVote already toggled it). Cancels the demo. */
  set(index: number, vote: Vote) {
    if (!cancelled) {
      user = demo;
      cancelled = true;
    }
    pressedOnce = true;
    const next = [...user] as Vote[];
    next[index] = vote;
    user = next as unknown as Votes;
    emit();
  },
  /** Where the story leaves the sheet's own scroll at the end of `votes` (px), so the flying copy matches. */
  scrollEnd: 0,
  /** The real sheet's header height, in its own layout px (0 until measured), and its bottom in face
   *  units (of 720): the flying panels skip what they cannot show. */
  headPx: 0,
  headFace: 0,
  /** Ask the real buttons to play their press (demo presses). */
  burst(index: number) {
    bursts.forEach((fn) => fn(index, "demo"));
  },
  onBurst(fn: (index: number, source: "demo" | "user") => void) {
    bursts.add(fn);
    return () => {
      bursts.delete(fn);
    };
  },
  isCancelled: () => cancelled,
};

export function asked(votes: Votes): number {
  return votes.filter((v) => v === "asked").length;
}

export function usePrepState() {
  return useSyncExternalStore(prepState.subscribe, prepState.get, () => snapshot);
}
