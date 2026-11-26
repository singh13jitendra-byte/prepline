import { Art, type ArtProps } from "./Art";

/**
 * Portrait frame, 104 x 104 (holds a 96px image). One path.
 * Pen route: starts on the top edge near the top-left corner, clockwise, four corners with
 * unequal radii, and overlaps its own start by about 14px.
 * Fill: rounded square, shown only when `empty` (no image). For the dashed dev state set
 * `stroke-dasharray: 5 6` on the line from CSS and do not animate it.
 */
export function Frame({ empty = false, ...props }: ArtProps & { empty?: boolean }) {
  return <Art id="frame" fills={empty} {...props} />;
}
