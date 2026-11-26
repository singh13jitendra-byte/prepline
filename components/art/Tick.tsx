import { Art, type ArtProps } from "./Art";

/**
 * Tick, 22 x 18. Inside a pressed "Asked" pill. One path, no fills.
 * Pen route: short down-stroke, long up-stroke that overshoots by 3px.
 */
export function Tick(props: ArtProps) {
  return <Art id="tick" {...props} />;
}
