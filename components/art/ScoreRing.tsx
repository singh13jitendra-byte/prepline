import { Art, type ArtProps } from "./Art";

/**
 * Score ring, 72 x 72 (also used at 34px). Circles the score numeral. One path, no fills.
 * Pen route: starts near 1 o'clock, anticlockwise all the way round, overlaps its start
 * by about 26 degrees and ends inside it. Oval, tilted -12 degrees.
 */
export function ScoreRing(props: ArtProps) {
  return <Art id="score-ring" {...props} />;
}
