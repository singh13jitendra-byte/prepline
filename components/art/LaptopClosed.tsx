import { Art, type ArtProps } from "./Art";

/**
 * Closed laptop in side profile, 160 x 60, baseline y 52. Footer. One path, no fills.
 * Pen route: baseline in, round the hinge, lid top to the front edge, front lip,
 * back along the seam, turn at the hinge and out along the base (which is the baseline).
 * Joins: enters (0,52), exits (160,52).
 */
export function LaptopClosed(props: ArtProps) {
  return <Art id="laptop-closed" {...props} />;
}
