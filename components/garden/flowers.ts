/**
 * THE GARDEN'S FLOWERS — the shared contract between the flower rig (components/garden/tripoFlower.ts,
 * the Tripo models in public/garden) and the garden scene that lays them over the painted meadow.
 *
 * Flower type = role type, as in components/world/fieldFlowers.ts (`flowerOf(title)`).
 * Stage = fit: full bloom 8–10, half open 6–7, bud 5 and under (CLAUDE.md, "The garden").
 *
 * Plain types and pure helpers only: no three.js import at runtime, so the scene and the lab can both
 * import it for free.
 */

import type * as THREE_NS from "three";
import type { FlowerRig } from "./moonflower";

export type FlowerKind = "moon" | "bell" | "poppy" | "allium" | "lavender";

export const FLOWER_KINDS: readonly FlowerKind[] = ["moon", "bell", "poppy", "allium", "lavender"];

/** The two models of each pair, in public/garden (see its README). */
export const flowerFiles = (kind: FlowerKind) => ({ bud: `/garden/${kind}-bud.glb`, bloom: `/garden/${kind}-bloom.glb` });

/** `open` for a fit score: 0 bud, 0.5 half open, 1 full bloom. */
export const OPEN_BUD = 0;
export const OPEN_HALF = 0.5;
export const OPEN_FULL = 1;
export function openForFit(fit: number): number {
  if (fit >= 8) return OPEN_FULL;
  if (fit >= 6) return OPEN_HALF;
  return OPEN_BUD;
}

/**
 * One garden flower: a bud/bloom pair behind one `open` value. In its own space the stem base is at
 * the origin, it is 1 unit tall (y up) and its face points at +Z.
 */
export type GardenFlower = FlowerRig & {
  kind: FlowerKind;
  /** Where the main flower head is, in the flower's own space: where a tooltip, the card's leader and Lumi aim. */
  heart: THREE_NS.Vector3;
  /** Radius of a sphere round the whole flower (about the heart), in its own units: for picking and framing. */
  radius: number;
  /** Lumi's light, in world space (null for none), and how lit it is (0..1). The petals near it catch it. */
  setLantern: (world: THREE_NS.Vector3 | null, k: number) => void;
};
