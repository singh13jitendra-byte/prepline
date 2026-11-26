import { Art, type ArtProps } from "./Art";

type SeatProps = ArtProps & {
  /** Shows the solid fill. A seat's fill is hidden until that seat is taken. */
  taken?: boolean;
};

/**
 * Seat rings, 28 x 28. Three different hands so the 5 x 5 grid is not 25 clones:
 * assign by index % 3 and rotate each by index * 37deg.
 *  A: from 1 o'clock, anticlockwise, 24 degree overlap.
 *  B: from 7 o'clock, taller than wide, 40 degree overlap.
 *  C: from 10 o'clock, wider than tall, barely closes.
 * Each is one path that ends inside its own start. Fill: circle r 9, off unless `taken`.
 * The fill is authored up and left of centre so that, after the register offset, it lands
 * about 2.5px off the ring instead of 6.
 */
export function SeatRingA({ taken = false, ...props }: SeatProps) {
  return <Art id="seat-ring-a" fills={taken} {...props} />;
}
export function SeatRingB({ taken = false, ...props }: SeatProps) {
  return <Art id="seat-ring-b" fills={taken} {...props} />;
}
export function SeatRingC({ taken = false, ...props }: SeatProps) {
  return <Art id="seat-ring-c" fills={taken} {...props} />;
}

export const SEAT_RINGS = [SeatRingA, SeatRingB, SeatRingC] as const;
