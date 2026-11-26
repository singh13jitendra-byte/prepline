/**
 * SCENE GEOMETRY — the painted world, as numbers. No React, no DOM: imported by the
 * server-rendered layer (Scenes.tsx) and by the client director (SceneDirector.tsx).
 *
 * The six paintings come from public/scenes/manifest.json (written by scenes/fetch.mjs).
 * Until that file exists, SCENE_FALLBACK stands in: same sizes, no files, and each layer
 * shows its flat placeholder colour instead. Nothing here hard-fails without the files.
 *
 * Every rect below is in the SOURCE IMAGE's own pixels (desk-night is 2048 x 1152), so a
 * re-export at another size changes nothing. Layers are laid out as a "cover box": a box
 * with the image's aspect ratio that covers the viewport, placed by a focal fraction.
 * Hotspots are children of that box in percentages, so they follow resize, the cover crop
 * and every transform for free, and anchorRect() can read them like any other anchor.
 *
 * Measured from public/scenes/desk-night-1600.webp (x 1.28 to source pixels). To re-check
 * after a new export: open /?scenes=debug, which outlines and labels every hotspot.
 */

export const SCENE_NAMES = ["desk-night", "meadow-night", "desk-bluehour", "desk-dawn", "grass-fg", "window-frame"] as const;
export type SceneName = (typeof SCENE_NAMES)[number];

export type SceneEntry = {
  width: number;
  height: number;
  alpha: boolean;
  /** Exported widths. Empty: the files are not there yet. */
  widths: number[];
  /** Tiny blurred data URI, shown until the picture has loaded. */
  placeholder?: string;
};
export type SceneManifest = Record<SceneName, SceneEntry>;

/** Sizes from the brief. `widths: []` means "no files": the layer paints its fallback colour. */
export const SCENE_FALLBACK: SceneManifest = {
  "desk-night": { width: 2048, height: 1152, alpha: false, widths: [] },
  "meadow-night": { width: 1280, height: 720, alpha: false, widths: [] },
  "desk-bluehour": { width: 1280, height: 720, alpha: false, widths: [] },
  "desk-dawn": { width: 2048, height: 1152, alpha: false, widths: [] },
  "grass-fg": { width: 2048, height: 1152, alpha: true, widths: [] },
  "window-frame": { width: 2048, height: 1152, alpha: true, widths: [] },
};

/** Flat stand-ins while a painting is missing or still loading (theme tokens, never literals). */
export const SCENE_GROUND: Record<SceneName, string> = {
  "desk-night": "linear-gradient(100deg,var(--c-night) 0%,var(--c-night) 40%,var(--c-night-2) 100%)",
  "meadow-night": "linear-gradient(180deg,var(--c-night) 0%,var(--c-night-2) 100%)",
  "desk-bluehour": "linear-gradient(100deg,var(--c-night) 0%,var(--c-night-2) 100%)",
  "desk-dawn": "linear-gradient(100deg,var(--c-paper-2) 0%,var(--c-paper) 100%)",
  "grass-fg": "none",
  "window-frame": "none",
};

export type Rect = { x0: number; y0: number; x1: number; y1: number };

/** desk-night, source pixels (2048 x 1152). */
export const DESK = { w: 2048, h: 1152 };
export const HOTSPOTS = {
  /** The laptop's blank screen (an upright rectangle, no skew). */
  "laptop-screen": { x0: 1309, y0: 744, x1: 1576, y1: 906 },
  /** The window opening inside its frame, casements included: the push-through aims here. */
  "window-view": { x0: 950, y0: 83, x1: 1933, y1: 819 },
  /** The lamp's shade. */
  "desk-lamp": { x0: 1126, y0: 525, x1: 1261, y1: 685 },
} as const satisfies Record<string, Rect>;
/**
 * The clear sky between the two open casements and above the lamp: in the hero the
 * fireflies are drawn only inside this, so none crosses the woodwork, the lamp or the laptop.
 */
export const WINDOW_SKY: Rect = { x0: 1158, y0: 90, x1: 1709, y1: 538 };
export type HotspotId = keyof typeof HOTSPOTS;

/**
 * Where each cover box sits when the viewport is narrower or shorter than the painting:
 * 0 = pinned left/top, 1 = pinned right/bottom. `small` is under 768px (portrait): the room
 * is framed on the window and the laptop, the wall is off to the left.
 */
export const FOCUS: Record<"room" | "meadow" | "dawn", { wide: [number, number]; small: [number, number] }> = {
  room: { wide: [0.5, 0.5], small: [0.78, 0.5] },
  meadow: { wide: [0.5, 0.5], small: [0.5, 0.5] },
  dawn: { wide: [0.5, 0.5], small: [0.78, 0.5] },
};

/**
 * Act III: the same painting, framed close on the lamp-lit desk. `at` is the point of the
 * painting (fractions of the image) that is brought to `to` (fractions of the viewport),
 * magnified by `scale` over the cover fit.
 */
export const DESK_CLOSE = {
  wide: { at: [0.585, 0.56], to: [0.44, 0.4], scale: 1.36 },
  small: { at: [0.6, 0.56], to: [0.5, 0.42], scale: 1.5 },
} as const;

/**
 * The hero on small (portrait) screens: the copy takes the top of the screen, so the room is
 * drawn smaller than cover and stood on the bottom edge, with the laptop (image x 0.70) at
 * `laptopAt` of the viewport width. Above it the wall is the pine wash.
 */
export const HERO_SMALL = { scale: 0.64, laptopAt: 0.6 };

/** Layout of a cover box in CSS px, for a viewport. Pure maths: no layout is read. */
export function coverBox(vw: number, vh: number, ar: number, fx: number, fy: number) {
  const w = Math.max(vw, vh * ar);
  const h = w / ar;
  return { x: (vw - w) * fx, y: (vh - h) * fy, w, h };
}
