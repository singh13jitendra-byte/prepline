import { Art, type ArtProps } from "./Art";
import { ART } from "./registry";

/**
 * Lamp, 300 x 340. Act III, above and right of the sheet. Hangs from the top-right corner.
 * One path. The same lamp as in Desk: same shade, same mouth angle, same joint loop.
 * Pen route, top to bottom: in at (300,0), bracket arm down and left, joint loop at the elbow,
 * second arm to the shade neck, upper shade edge, mouth, lower shade edge, then the retrace
 * back up 8px below the first pass. The two lines open to 24px at the wall: that is the clamp.
 * Joins: enters (300,0), exits (300,24), both on the right edge.
 * Fill: bulb only (solid on night). The cone is the World's; it reads `shadeLip`.
 */
export function Lamp(props: ArtProps) {
  return <Art id="lamp" {...props} />;
}

/** Lip points of the shade in drawing coordinates, upper lip first. */
export const shadeLip = ART.lamp.shadeLip!;
