"use client";

/**
 * ANCHORS — named layout slots the Actor, the Line and the World aim at.
 *
 * An anchor is an ordinary element in an act's layout. Register it under one of
 * the fixed ids below and the story engine can ask where it is on screen. Move
 * the element in CSS (breakpoints, flex, grid) and everything that targets it
 * follows: there are no coordinates anywhere else.
 *
 *   registerAnchor(id, element): () => void     register; returns unregister
 *   useAnchor(id): (el: HTMLElement | null) => void   React ref that does the same
 *   anchorRect(id): Rect | null                 viewport rect, measured once per frame
 *   watchAnchors(ids): () => void               keep extra anchors measured every frame
 *
 * Usage:
 *
 *   function Row1() {
 *     const ref = useAnchor("row-1");
 *     return <li ref={ref}>…</li>;
 *   }
 *
 *   // World package, while the `ranked` beat is on screen:
 *   const stop = watchAnchors(["row-1", "row-2", "row-3"]);
 *   story.frame("world", () => { const r = anchorRect("row-1"); … });
 *
 * Rules
 * - The frame loop measures the anchors of the current beat (line from/to, actor
 *   from/to) plus every watched anchor in its read phase, before any write.
 *   `anchorRect` then returns that cached rect, so calling it in a write phase
 *   costs nothing. An anchor that was not pre-measured is measured on first use
 *   and cached for the rest of the frame (one forced layout: prefer watchAnchors).
 * - The returned object is shared and reused. Read it, do not keep or mutate it.
 * - The line follows an anchor live. To make the line grow with typed text or a
 *   filling meter, animate the anchor element itself (its width): no extra API.
 * - Anchors the Actor rests on (ACTOR_ANCHORS) should be rendered with <FaceSlot>,
 *   which handles the hide-while-covered / show-when-docked rule for you.
 */

import { useCallback } from "react";

export const ANCHOR_IDS = [
  "hero-underline",
  "row-1",
  "row-2",
  "row-3",
  "row-4",
  "row-5",
  "row-6",
  "row-7",
  "row-8",
  "row-9",
  "row-10",
  "row-11",
  "row-12",
  "ranked-rule",
  "card",
  "card-meter",
  "tile-saved",
  "tile-applied",
  "tile-interview",
  "col-saved",
  "col-applied",
  "col-interview",
  "hinge-float",
  "hinge-text",
  "sheet-folded",
  "sheet",
  "sheet-q1",
  "sheet-q2",
  "sheet-q3",
  "sheet-foot",
  "ticket",
  "ready-underline",
  // The 25 hollow seat rings in Act IV (registered by Acts III–IV, read by the World to gather specks into them).
  "seat-ring-1",
  "seat-ring-2",
  "seat-ring-3",
  "seat-ring-4",
  "seat-ring-5",
  "seat-ring-6",
  "seat-ring-7",
  "seat-ring-8",
  "seat-ring-9",
  "seat-ring-10",
  "seat-ring-11",
  "seat-ring-12",
  "seat-ring-13",
  "seat-ring-14",
  "seat-ring-15",
  "seat-ring-16",
  "seat-ring-17",
  "seat-ring-18",
  "seat-ring-19",
  "seat-ring-20",
  "seat-ring-21",
  "seat-ring-22",
  "seat-ring-23",
  "seat-ring-24",
  "seat-ring-25",
  // The Interview column floor in Act II (its glow hands over to the Act III lamp).
  "col-offer",
  "board-days",
] as const;

export type AnchorId = (typeof ANCHOR_IDS)[number];

/** Anchors the Actor travels between. Their real DOM face is hidden unless the Actor is docked on it. */
export const ACTOR_ANCHORS: readonly AnchorId[] = [
  "row-1",
  "card",
  "tile-saved",
  "tile-applied",
  "tile-interview",
  "hinge-float",
  "sheet-folded",
  "sheet",
  "ticket",
];

/** Viewport rectangle in CSS pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

type Entry = { el: HTMLElement; rect: Rect; frame: number };

const entries = new Map<AnchorId, Entry>();
const watched = new Map<AnchorId, number>();
const listeners = new Set<() => void>();
let frame = 0;

function measure(entry: Entry) {
  const r = entry.el.getBoundingClientRect();
  entry.rect.x = r.left;
  entry.rect.y = r.top;
  entry.rect.w = r.width;
  entry.rect.h = r.height;
  entry.frame = frame;
}

/** Register `element` as the anchor `id`. The latest registration wins. Returns an unregister function. */
export function registerAnchor(id: AnchorId, element: HTMLElement): () => void {
  const entry: Entry = { el: element, rect: { x: 0, y: 0, w: 0, h: 0 }, frame: -1 };
  entries.set(id, entry);
  element.setAttribute("data-anchor", id);
  listeners.forEach((fn) => fn());
  return () => {
    if (entries.get(id) === entry) {
      entries.delete(id);
      listeners.forEach((fn) => fn());
    }
  };
}

/** React ref callback that registers the element it is attached to. */
export function useAnchor(id: AnchorId): (el: HTMLElement | null) => void | (() => void) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      return registerAnchor(id, el);
    },
    [id],
  );
}

/** The anchor's viewport rect for this frame, or null when nothing is registered under `id`. */
export function anchorRect(id: AnchorId): Readonly<Rect> | null {
  const entry = entries.get(id);
  if (!entry) return null;
  if (entry.frame !== frame) measure(entry);
  return entry.rect;
}

/** The element registered under `id`, if any. */
export function anchorElement(id: AnchorId): HTMLElement | null {
  return entries.get(id)?.el ?? null;
}

/** Measure these anchors in every frame's read phase until the returned function is called. */
export function watchAnchors(ids: readonly AnchorId[]): () => void {
  ids.forEach((id) => watched.set(id, (watched.get(id) ?? 0) + 1));
  return () => {
    ids.forEach((id) => {
      const n = (watched.get(id) ?? 1) - 1;
      if (n <= 0) watched.delete(id);
      else watched.set(id, n);
    });
  };
}

/** Ids currently registered (for the debug overlay). */
export function registeredAnchors(): AnchorId[] {
  return [...entries.keys()];
}

/** Called when an anchor is registered or removed. */
export function onAnchorsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Frame loop only. Starts a new measuring frame and measures the active and
 * watched anchors in one batch of reads. Do not call from components.
 */
export function measureAnchorFrame(active: readonly (AnchorId | undefined)[]) {
  frame++;
  for (let i = 0; i < active.length; i++) {
    const id = active[i];
    if (!id) continue;
    const entry = entries.get(id);
    if (entry && entry.frame !== frame) measure(entry);
  }
  watched.forEach((_, id) => {
    const entry = entries.get(id);
    if (entry && entry.frame !== frame) measure(entry);
  });
}
