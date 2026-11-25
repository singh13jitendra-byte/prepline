/**
 * Shared, non-React state of the world layers. The canvas loop is the only
 * writer of the lens; Lens.tsx only lends its elements.
 */
export const LENS_RADIUS = 140;

export const worldBus = {
  /** True once the WebGL world has drawn its first frame. */
  glReady: false,
  lensRing: null as HTMLDivElement | null,
  lensLabel: null as HTMLDivElement | null,
  /** Pointer is over a control (link, button, field): the lens steps back. */
  overControl: false,
  /** Last measured numbers, for the debug console (window.__world). */
  stats: { calls: 0, dpr: 0, frameMs: 0, rendered: 0, skipped: 0, instances: 0 },
};

/** Force a mode from the URL for testing: ?world=gl | css. */
export function worldOverride(): "gl" | "css" | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("world");
  return v === "gl" || v === "css" ? v : null;
}
