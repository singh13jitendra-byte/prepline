import { Art, type ArtProps } from "./Art";

/**
 * Calendar page, 72 x 72. Act II, beside the Interview header. One path.
 * Pen route: starts on the right edge at header height, down the right edge, loop at the
 * bottom-right corner, bottom edge, left edge, top-left corner, top edge with two binder
 * bumps, top-right corner and back to the start; then the header bar runs across to the left,
 * turns and comes back 4px lower, dives into the page as the tick's down-stroke and ends on
 * the long up-stroke. The tick starts at ART.calendar.tickFrom of the length (about 0.82).
 * Fill: one day square under the tick, solid on night too.
 */
export function Calendar(props: ArtProps) {
  return <Art id="calendar" {...props} />;
}
