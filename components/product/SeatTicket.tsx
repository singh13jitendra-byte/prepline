import type { ReactNode } from "react";
import { Icon } from "./icons";
import { cx, type SurfaceProps } from "./primitives";
import { ticket as copy } from "./data";

export type SeatTicketProps = SurfaceProps & {
  /** The real waitlist form goes here (e.g. <WaitlistForm tone="ticket" />). */
  children?: ReactNode;
  seats?: number;
  /** After a successful request: press the stamp. */
  stamped?: boolean;
  /** The seat number once one is assigned. Until then the stub shows an empty slot. */
  seatNumber?: number;
  header?: string;
  cohort?: string;
  foot?: string;
  promise?: string;
};

/**
 * The beta seat ticket. Presentational: it draws the ticket and leaves the
 * form to its children. Set `stamped` after a successful request to press the
 * stamp and fill the visitor's ring.
 *
 * The perforation notches are painted in `--pp-notch` (defaults to the page
 * paper). Set it to the stage background when the ticket sits on another colour.
 */
export function SeatTicket({
  children,
  seats = copy.seats,
  stamped = false,
  seatNumber,
  header = copy.header,
  cohort = copy.cohort,
  foot = copy.foot,
  promise = copy.promise,
  skin = "auto",
  bare,
  className,
  style,
}: SeatTicketProps) {

  return (
    <div
      className={cx("pp pp-ticket", className)}
      data-skin={skin}
      data-bare={bare ? "" : undefined}
      data-stamped={stamped ? "" : undefined}
      style={style}
    >
      <div className="pp-ticket-main">
        <div className="pp-ticket-top">
          <span className="pp-label">{header}</span>
        </div>
        <p className="pp-ticket-brand">
          Prepline <span>{cohort}</span>
        </p>

          <div className="pp-ticket-slot">{children}</div>
        <p className="pp-ticket-foot">
          <Icon name="lock" size={14} />
          <span>
            {foot} {promise}
          </span>
        </p>
      </div>
      <div className="pp-ticket-perf" aria-hidden="true" />
      <div className="pp-ticket-stub">
        <span className="pp-label">{copy.stubLabel}</span>
        <span className="pp-ticket-seats pp-num" data-empty={seatNumber === undefined ? "" : undefined} aria-hidden="true">
          {seatNumber !== undefined ? String(seatNumber).padStart(2, "0") : null}
        </span>
        <span className="pp-meta">of {seats}</span>
      </div>
      <span className="pp-sr">
        {seatNumber !== undefined ? `Seat ${seatNumber} of ${seats}.` : `One of ${seats} beta seats.`}
      </span>
      {stamped ? (
        <span className="pp-stamp" aria-hidden="true">
          <Icon name="check" size={14} />
          {copy.stamp}
        </span>
      ) : null}
    </div>
  );
}
