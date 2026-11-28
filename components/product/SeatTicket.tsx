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
  /** Decoration in the main part's top-right corner (the seat act's pressed flower), never on the stub. */
  decor?: ReactNode;
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
 * No seat number, ever (CLAUDE.md: no seat numbers): the stub names the capacity ("of 25"), and a
 * request is marked by a filled ring and a stamp, not a number.
 *
 * The perforation notches are painted in `--pp-notch` (defaults to the page
 * paper). Set it to the stage background when the ticket sits on another colour.
 */
export function SeatTicket({
  children,
  seats = copy.seats,
  stamped = false,
  decor,
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
        {decor ? <span className="pp-ticket-decor">{decor}</span> : null}
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
        <span className="pp-ticket-seats pp-num" data-empty="" aria-hidden="true" />
        <span className="pp-meta">of {seats}</span>
      </div>
      <span className="pp-sr">
        {`One of ${seats} beta seats.`}
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
