import { Art, type ArtProps } from "./Art";

/**
 * Margin-note arrow, 48 x 34, pointing right and down (mirror or rotate with CSS). One path.
 * Pen route: shallow curve to the tip, out along the lower barb, back to the tip,
 * out along the upper barb. The return is 1px off the barb so the retrace is not exact.
 */
export function Arrow(props: ArtProps) {
  return <Art id="arrow" {...props} />;
}
