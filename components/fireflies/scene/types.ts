/**
 * THE SCENE'S PUBLIC TYPES — the contract in research/fireflies-contract.md, plus optional extras.
 *
 * `FireflyJob` is owned by components/fireflies/jobs.ts (the card and data builder).
 */

export type { FireflyJob } from "../jobs";
import type { FireflyJob } from "../jobs";

/**
 * Where the focused firefly is, in CSS px, viewport coordinates.
 * `x, y` are the contract: the centre of its lantern (the model's GlowAnchor), which is where the
 * card's leader starts. `r` is extra: the radius on screen of a circle round the whole firefly,
 * wings and antennae included (about 18% of the viewport height in a close-up). A card that should
 * stand clear of the wings wants a gap of about `0.75 * r + 16`.
 */
export type FireflyAnchor = { x: number; y: number; r?: number };

/** How the scene lays the painting out in its wide shot (see scenery.ts `Layout`). */
export type FireflyFraming = {
  /** Scale of the meadow painting over its cover box (the page's slow push). */
  meadowScale: number;
  /** How far down the foreground grass sits, as a fraction of the height. */
  grassLow: number;
};

export type FireflySceneProps = {
  /** Render and accept pointer input only while true. */
  active: boolean;
  jobs: FireflyJob[];
  /**
   * The focused job and where its firefly is. Called when a firefly is revealed (as the camera
   * arrives on it), again whenever the anchor has moved by more than a pixel, and with
   * (null, null) the moment the focus is left. Going from one firefly straight to another there
   * is no (null, null) in between: the next call carries the new job.
   */
  onFocus: (job: FireflyJob | null, anchor: { x: number; y: number } | null) => void;
  /** Assets loaded and decoded, shaders compiled, first frame drawn. */
  onReady?: () => void;
  reducedMotion?: boolean;
  className?: string;

  /* ── optional extras (not in the contract; every default suits the story beat) ── */

  /**
   * "match" (default): nothing is shown until the scene is ready, then its wide shot is the page's
   * painted meadow exactly, and the fireflies, moon and mist come up from there.
   * "veil": the lab. A dark veil until ready, then one fade in from black.
   */
  intro?: "match" | "veil";
  /** The painting's layout in the wide shot. Default: the page's meadow at the end of pass 2. */
  framing?: Partial<FireflyFraming>;
  /**
   * Where the job card docks as a bottom sheet (a media query). There a focused firefly is framed
   * in the top third, clear of the sheet. Default: the card's own JOBCARD_DOCK_QUERY.
   */
  dockQuery?: string;
  /** The scene could not start (no WebGL2, or a load failed). The accessible list still works. */
  onError?: (reason: string) => void;
};

export type FireflySceneHandle = {
  /** Move the camera onto a job's firefly (the accessible list calls this on focus). */
  focusJob: (id: string) => void;
  /** Back to the wide shot. */
  clearFocus: () => void;
  /**
   * Extra: read where the page's painted meadow and grass are right now (components/world Scenes)
   * and lay the wide shot out to coincide with them. Call it just before `active` turns true, and
   * again just before it turns false. Returns false when the painted layers are not on the page.
   */
  matchPage: () => boolean;
};
