import { Art, type ArtProps } from "./Art";

/**
 * Mug, 96 x 110, baseline y 104. Act III, left of the sheet. One path.
 * Pen route: baseline in, up the left side, loop at the rim corner, rim, down to the handle,
 * D handle out and back, down to the baseline, out.
 * Joins: enters (0,104), exits (96,104), so the Line can run through it.
 * Fill: steam teardrop above the rim (night 0.2).
 */
export function Mug(props: ArtProps) {
  return <Art id="mug" {...props} />;
}
