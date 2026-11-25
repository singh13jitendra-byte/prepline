/**
 * Shared, non-React state of the world layers. The canvas loop is the only
 * writer of the lens (Lens.tsx only lends its elements); Line.tsx is the only
 * writer of the drawn line.
 */
export const LENS_RADIUS = 140;

export const worldBus = {
  /** True once the WebGL world has drawn its first frame. */
  glReady: false,
  lensRing: null as HTMLDivElement | null,
  lensLabel: null as HTMLDivElement | null,
  /** Pointer is over a control (link, button, field): the lens steps back. */
  overControl: false,
  /** True once the field's load-in has finished (the hero demonstration waits for it). */
  fieldReady: false,
  /** Grid position of the first of the twelve, where the hero demonstration dips to and the lens parks. */
  firstX: 0,
  firstY: 0,
  /** A real pointer has moved since load: the lens leaves its parking place for good. */
  pointerMoved: false,
  /**
   * The line as drawn. Line.tsx writes it every frame (store line + the hero demonstration +
   * the ranked hold); the canvas reads it for the bloom, the wake and the reading thresholds.
   */
  line: { x0: 0, x1: 0, y: 0, weight: 2, set: false },
  /** 1 while the ranked flight is in the air (the line waits), easing to 0 after the last landing. */
  dockHold: 0,
  /** The hero's autonomous demonstration sweep. y0 is the line's rest y while it runs. */
  demo: { on: false, shown: false, y0: 0 },
  /** Last measured numbers, for the debug console (window.__world). */
  stats: { calls: 0, dpr: 0, frameMs: 0, cpuMs: 0, gpuMs: -1, rendered: 0, skipped: 0, instances: 0 },
};

/** Force a mode from the URL for testing: ?world=gl | css. */
export function worldOverride(): "gl" | "css" | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("world");
  return v === "gl" || v === "css" ? v : null;
}
