import { Art, type ArtProps } from "./Art";

/**
 * Stamp frame, 132 x 64, rendered rotated -8deg by the ticket. One path.
 * Pen route: starts on the top edge, clockwise round the outer lap, slips 4px inside at the
 * top-left corner, second lap, ends just past its own start.
 * Fill: the inner rectangle, solid. The words ("seat kept") are real text, not in the path.
 * It is pressed, not drawn on: leave `draw` unset and animate scale and opacity on the element.
 */
export function Stamp({ fills = true, ...props }: ArtProps) {
  return <Art id="stamp" fills={fills} {...props} />;
}
