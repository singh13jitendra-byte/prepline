"use client";

/**
 * FACES — what the Actor (the Role) looks like at each stop of its journey.
 *
 * The Actor is one travelling rectangle. Its content is a face: `row`, `card`,
 * `tile`, `sheet` or `ticket`. The story engine owns position, size, radius,
 * clipping and crossfades; a face only draws its content.
 *
 *   registerFace(id, Component, meta?): () => void
 *   getFace(id): RegisteredFace                  (falls back to a grey placeholder)
 *   FACE_DEFAULTS                                natural size and radius per face
 *
 * Usage (module scope of the face file, so it is registered on import):
 *
 *   function CardFace({ skin, host }: FaceProps) {
 *     return <div className="p-6 text-[var(--face-fg)]">…</div>;
 *   }
 *   registerFace("card", CardFace);
 *
 * The contract a face must follow
 * - Design it at ONE natural size (FACE_DEFAULTS, or the `meta` you pass). The
 *   engine scales it uniformly to the box width. Never read the box size.
 * - It is rendered several times at once: once per skin inside the Actor (both
 *   skins exist during a wipe) and once inside each <FaceSlot> in the real DOM.
 *   Keep shared state (votes, form status) outside the component.
 * - `skin` is "night" or "day". Theme through the CSS variables the engine sets
 *   on the wrapper: --face-bg, --face-fg, --face-muted, --face-border,
 *   --face-accent, --face-shadow. With the default `chrome: true` the engine
 *   already paints background, border, radius and shadow on a box that morphs
 *   cleanly between aspect ratios; draw content only. Pass `chrome: false` to
 *   paint everything yourself (the sheet: three paper panels).
 * - `host` is "actor" (the flying copy: aria-hidden and inert, purely visual)
 *   or "dock" (the real, semantic, interactive copy inside a <FaceSlot>).
 * - Per-frame values never arrive as React props (that would re-render every
 *   frame). They are in story.get().actor ({ fold, flip, travel }) for JS, and
 *   as CSS variables for the elements that ASK for them:
 *     <div data-actor-var="progress lift">…</div>
 *     --fold      0 folded .. 1 open
 *     --progress  0 at the from anchor .. 1 at the to anchor
 *     --flip      0 front .. 1 back
 *     --lift      0 at rest, 1 mid-flight
 *   The Actor writes each variable on those elements only, never on itself, so
 *   put the attribute on the smallest element that reads the variable (a leaf
 *   if you can). In a <FaceSlot> the same variables are static on the slot
 *   (fold as given, progress 1, flip 0) and simply inherit.
 *   The `fold` and `progress` props are the settled values for the current beat
 *   (they change on beat change only): use them for discrete decisions.
 * - A face that contains an anchor (the card's `card-meter`, the sheet's
 *   `sheet-q1..3` and `sheet-foot`) must register it only when host === "dock".
 *   The latest registration wins, so an anchor registered by the flying copy
 *   would make the line chase the Actor instead of the page.
 * - Both skins must be pixel-identical in layout: only colours may differ, or
 *   the split at the line will show an offset.
 */

import { createContext, createElement, type ComponentType, type ReactElement } from "react";
import type { FaceId, Skin } from "@/lib/story";

export type FaceProps = {
  skin: Skin;
  /** Settled fold for the current beat: 0 folded, 1 open. Live value: CSS var --fold. */
  fold: number;
  /** Settled travel for the current beat. Live value: CSS var --progress. */
  progress: number;
  /** "actor": the flying, aria-hidden copy. "dock": the real DOM copy in a FaceSlot. */
  host: "actor" | "dock";
};

export type FaceMeta = {
  /** Natural design size in px. */
  width: number;
  height: number;
  /** Corner radius at natural size. */
  radius: number;
  /** Let the engine paint background, border, radius and shadow. Default true. */
  chrome: boolean;
  /** Clip content to the box (needed while the box morphs between aspect ratios). Default true. */
  clip: boolean;
  /**
   * How the Actor scales the face to its box. "width" (default): uniform scale to the box width.
   * "height": uniform scale to the box height, and the content's layout width follows the box
   * (natural height stays), so a flex layout re-spaces as the box changes aspect ratio.
   */
  fit?: "width" | "height";
  /**
   * The natural size on small screens (under 768px). A face is scaled to its box, and a desktop
   * layout scaled to a phone is 8px type. Give the size your narrow layout is designed at and the
   * face is laid out there instead, at close to 1:1:
   *
   *   registerFace("ticket", TicketFace, { width: 520, height: 300, small: { width: 360, height: 360 } });
   *
   * FaceSlot takes its aspect ratio from it and the Actor its scale, so anchors and the flying copy
   * stay coherent. Inside the face, read the size from the `--face-w` / `--face-h` variables on the
   * content box (px), or use <Showcase scale={…}>, which follows them by itself. Do not hard-code
   * the desktop width in the face's own CSS.
   */
  small?: { width: number; height: number; radius?: number };
};

export type RegisteredFace = {
  id: FaceId;
  Component: ComponentType<FaceProps>;
  /** The meta for this screen (the small size applied under 768px). */
  meta: FaceMeta;
  /** The meta as registered (the desktop size), when `meta` is the small-screen one. */
  base?: FaceMeta;
  placeholder: boolean;
};

/** Natural sizes from the storyboard (row 440x44, card 520x320, tile 154x92, sheet 560x720, ticket 520x300). */
export const FACE_DEFAULTS: Record<FaceId, FaceMeta> = {
  row: { width: 440, height: 44, radius: 8, chrome: true, clip: true },
  card: { width: 520, height: 320, radius: 22, chrome: true, clip: true },
  tile: { width: 154, height: 92, radius: 14, chrome: true, clip: true },
  sheet: { width: 560, height: 720, radius: 22, chrome: false, clip: false },
  ticket: { width: 520, height: 300, radius: 22, chrome: true, clip: true },
};

/**
 * Small-screen natural sizes used when a face registers none of its own.
 * card: RoleDetail's compact layout at phone width needs a taller box than 520x320 scaled down.
 */
export const FACE_SMALL_DEFAULTS: Partial<Record<FaceId, NonNullable<FaceMeta["small"]>>> = {
  card: { width: 360, height: 300 },
};

/**
 * What a face's content can know about the box it is drawn in. <Showcase> reads it: a screen whose
 * size is the face's registered size is "the face's own screen", follows the small-screen size and
 * obeys the minimum scale. Anything else inside a face (the tile on the folded sheet's cover) is
 * left exactly as its author sized it.
 */
export const FaceBoxContext = createContext<{ registered: { width: number; height: number }; now: { width: number; height: number } } | null>(null);

export const FACE_ORDER: readonly FaceId[] = ["row", "card", "tile", "sheet", "ticket"];

const registry = new Map<FaceId, RegisteredFace>();
const placeholders = new Map<FaceId, RegisteredFace>();
const listeners = new Set<() => void>();
let version = 0;

/* Small screens. Server markup and the first client render use the desktop sizes (so hydration
   matches); the first subscriber then checks the breakpoint and, on a phone, every face re-renders
   at its small size. */
let small = false;
let watching = false;
const resolved = new WeakMap<RegisteredFace, RegisteredFace>();
function watchBreakpoint() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const mq = window.matchMedia("(max-width: 767px)");
  const sync = () => {
    if (mq.matches === small) return;
    small = mq.matches;
    version++;
    listeners.forEach((fn) => fn());
  };
  mq.addEventListener("change", sync);
  sync();
}
function forScreen(face: RegisteredFace): RegisteredFace {
  const s = small ? (face.meta.small ?? FACE_SMALL_DEFAULTS[face.id]) : undefined;
  if (!s) return face;
  let hit = resolved.get(face);
  if (!hit) {
    hit = { ...face, base: face.meta, meta: { ...face.meta, width: s.width, height: s.height, radius: s.radius ?? face.meta.radius } };
    resolved.set(face, hit);
  }
  return hit;
}

/** Register the component for a face. The latest registration wins. Returns an unregister function. */
export function registerFace(id: FaceId, Component: ComponentType<FaceProps>, meta: Partial<FaceMeta> = {}): () => void {
  const entry: RegisteredFace = { id, Component, meta: { ...FACE_DEFAULTS[id], ...meta }, placeholder: false };
  registry.set(id, entry);
  version++;
  listeners.forEach((fn) => fn());
  return () => {
    if (registry.get(id) === entry) {
      registry.delete(id);
      version++;
      listeners.forEach((fn) => fn());
    }
  };
}

/** The registered face, or a grey placeholder that shows the face id (stubs, and before a package lands). */
export function getFace(id: FaceId): RegisteredFace {
  const hit = registry.get(id);
  if (hit) return forScreen(hit);
  let ph = placeholders.get(id);
  if (!ph) {
    ph = { id, Component: placeholderFace(id), meta: { ...FACE_DEFAULTS[id], chrome: true, clip: true }, placeholder: true };
    placeholders.set(id, ph);
  }
  return ph;
}

/** For useSyncExternalStore: re-render when the registry changes. */
export function subscribeFaces(fn: () => void): () => void {
  listeners.add(fn);
  watchBreakpoint();
  return () => listeners.delete(fn);
}
export function facesVersion(): number {
  return version;
}

function placeholderFace(id: FaceId): ComponentType<FaceProps> {
  function Placeholder({ skin }: FaceProps): ReactElement {
    return createElement(
      "div",
      { className: "face-placeholder", "data-skin": skin },
      createElement("span", null, id),
    );
  }
  Placeholder.displayName = `Placeholder(${id})`;
  return Placeholder;
}
