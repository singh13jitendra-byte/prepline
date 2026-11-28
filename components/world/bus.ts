/**
 * Shared, non-React state of the world layers. Lumi (components/lumi/Lumi.tsx) is the only writer
 * of the lantern (where its light is, how lit it is); the canvas loop reads the lantern for
 * its uniforms and answers with `pick` (the firefly to name). Line.tsx is the only writer of the
 * drawn line.
 */
/** How near the lantern a firefly brightens and drifts toward it, like a moth (CSS px). */
export const LENS_RADIUS = 120;
/** How near the resting pointer a firefly has to be to be named (CSS px). */
export const PICK_RADIUS = 28;

/** What a named firefly says. Built by the canvas loop; nothing draws it since the cursor lantern was retired (Lumi never names). */
export type RoleTag = {
  /** "Product Designer · Pune" */
  role: string;
  /** "7/10", or "" while the role has no portfolio score yet. */
  score: string;
  /** kept (lamp dot), set aside (a dot gone out), or not read yet (a pale dot). */
  verdict: "kept" | "aside" | "unread";
  /** "kept · fits your portfolio", "set aside · five days on-site", "not read yet" */
  note: string;
};

export const worldBus = {
  /** True once the WebGL world has drawn its first frame. */
  glReady: false,
  /** Pointer is over a control (link, button, field): the lantern names nothing there. */
  overControl: false,
  /** A real pointer has moved since load. */
  pointerMoved: false,
  /**
   * The lantern: Lumi's light (Lumi.tsx). `x, y` is its centre in viewport px, `k` how lit it is
   * (0 out, 1 lit: lit only in the meadow beats; reduced motion keeps it at 0). `rest` is how long the
   * pointer has been still, in seconds; `px, py` is the pointer itself.
   */
  lantern: { x: -999, y: -999, k: 0, rest: 0, px: -999, py: -999, names: false },
  /**
   * The firefly being named (written by the canvas loop; only while `names`, which Lumi keeps false). `id` is the
   * firefly's instance, -1 for none; `x, y` is where it is held while it is read (it stops for
   * the reader, so the tag and its leader stay still). `seq` changes whenever the pick does.
   */
  pick: { id: -1, x: 0, y: 0, seq: 0, tag: null as RoleTag | null },
  /**
   * The line as drawn. Line.tsx writes it every frame (store line + the ranked hold); the canvas reads it for the reading thresholds.
   */
  line: { x0: 0, x1: 0, y: 0, weight: 2, set: false },
  /**
   * What the painted scene gives the fireflies, written every frame by SceneDirector:
   * the window's glass on screen (they are drawn only inside it), whether the field shows at
   * all (0 indoors and by day), the pointer parallax in px, and how far through the window we are.
   * `bx, by, breeze`: the middle of the window opening on screen and how hard the breeze through it
   * blows (0..1, hero only): the fireflies by the window drift out toward the viewer (delight 4).
   */
  scene: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5, field: 1, px: 0, py: 0, push: 1, bx: 0, by: 0, breeze: 0 },
  /** 1 while the ranked flight is in the air (the line waits), easing to 0 after the last landing. */
  dockHold: 0,
  /**
   * The explore stop (components/acts/explore, behind ?explore=1): how far the 3D meadow has taken
   * over from the dot field, 0 (the dots, as at the end of pass 2) to 1 (the 3D scene alone).
   * ExploreStage is the only writer; without the flag it stays 0. The canvas fades the field by it
   * (Lumi flies through the garden for the stop: see `garden` below).
   */
  explore: { k: 0 },
  /**
   * The garden (the explore stop's flowers, components/garden/scene): where Lumi should be. The garden
   * scene (or the scroll tour driving it) is the only writer; Lumi (components/lumi) reads it during the
   * `explore` beat. `x, y` is the target in viewport px (the flower's heart; -999 for none), `perch` is 1
   * when Lumi should land on it and 0 to hover beside it, `seq` changes whenever the target flower does.
   */
  garden: { x: -999, y: -999, perch: 0, seq: 0 },
  /** Last measured numbers, for the debug console (window.__world). */
  stats: { calls: 0, dpr: 0, frameMs: 0, cpuMs: 0, gpuMs: -1, rendered: 0, skipped: 0, instances: 0 },
};

/** Force a mode from the URL for testing: ?world=gl | css. */
export function worldOverride(): "gl" | "css" | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("world");
  return v === "gl" || v === "css" ? v : null;
}
