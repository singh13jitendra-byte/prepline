import { Art, type ArtProps } from "./Art";

/**
 * Chair, 300 x 360, baseline y 340. Act IV, "your seat". One path.
 * Pen route: baseline in, front-left leg up, across the seat front, up the seat's right edge,
 * right post, rounded top with a loop at the top-left corner, left post down to the seat,
 * forward along the seat's left edge, under the seat front with two short down-and-up strokes
 * (the far legs), front-right leg down, baseline out.
 * Joins: enters (0,340), exits (300,340).
 * Fills: back panel and seat pad (smaller than the outline, printed off register).
 */
export function Chair(props: ArtProps) {
  return <Art id="chair" {...props} />;
}
