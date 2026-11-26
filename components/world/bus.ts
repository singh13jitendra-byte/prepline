/**
 * Shared, non-React state of the world layers. The canvas loop is the only
 * writer of the lens (Lens.tsx only lends its elements); Line.tsx is the only
 * writer of the drawn line.
 */
/** How near the pointer a firefly lights up, and how far the pointer's note looks for a role. */
export const LENS_RADIUS = 90;

export const worldBus = {
  /** True once the WebGL world has drawn its first frame. */
  glReady: false,
  lensLabel: null as HTMLDivElement | null,
  /** Pointer is over a control (link, button, field): the lens steps back. */
  overControl: false,
  /** A real pointer has moved since load. */
  pointerMoved: false,
  /**
   * The line as drawn. Line.tsx writes it every frame (store line + the ranked hold); the canvas reads it for the reading thresholds.
   */
  line: { x0: 0, x1: 0, y: 0, weight: 2, set: false },
  /**
   * What the painted scene gives the fireflies, written every frame by SceneDirector:
   * the window's glass on screen (they are drawn only inside it), whether the field shows at
   * all (0 indoors and by day), the pointer parallax in px, and how far through the window we are.
   */
  scene: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5, field: 1, px: 0, py: 0, push: 1 },
  /** 1 while the ranked flight is in the air (the line waits), easing to 0 after the last landing. */
  dockHold: 0,
  /** Last measured numbers, for the debug console (window.__world). */
  stats: { calls: 0, dpr: 0, frameMs: 0, cpuMs: 0, gpuMs: -1, rendered: 0, skipped: 0, instances: 0 },
};

/** Force a mode from the URL for testing: ?world=gl | css. */
export function worldOverride(): "gl" | "css" | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("world");
  return v === "gl" || v === "css" ? v : null;
}
