"use client";

/**
 * TICKET FACE — the visitor's beta seat, on the back of the folded prep sheet
 * (storyboard 2.7, 5.3).
 *
 * - host "dock": the real ticket in Act IV. Holds the real <WaitlistForm tone="ticket">
 *   (a normal, focusable form) and, after a successful request, the success
 *   message, a stamp and a filled seat on the stub.
 * - host "actor": the flying copy seen while the sheet flips into the ticket.
 *   It carries an inert copy of the form so the flip reveals a complete ticket.
 *
 * Request status is shared (seatState), so every copy agrees.
 */

import { useCallback, useEffect, useRef } from "react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { pkg3Copy, storyCopy } from "@/lib/content";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { seatState, useSeatState, type SeatStatus } from "@/components/acts/seat/seatState";
import "../cta.css";
import "./ticket.css";

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Success({ live, fresh }: { live: boolean; fresh: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keyboard focus was on the button that just disappeared: hand it to the message.
  useEffect(() => {
    if (live && fresh) ref.current?.focus({ preventScroll: true });
  }, [live, fresh]);
  return (
    <div ref={ref} className="tk-success" role={live ? "status" : undefined} tabIndex={live ? -1 : undefined}>
      <span className="tk-check" aria-hidden="true">
        <Check />
      </span>
      <p>{storyCopy.common.success}</p>
    </div>
  );
}

function TicketFace({ skin, host }: FaceProps) {
  const { status, at } = useSeatState();
  const live = host === "dock";
  const done = status === "done";
  // Animate the stamp only for a request made just now, never on a later remount.
  const fresh = done && typeof performance !== "undefined" && performance.now() - at < 2500;
  const onStatus = useCallback((s: SeatStatus) => seatState.set(s), []);

  return (
    <div className="tk-root" data-skin={skin} data-host={host} data-status={status} data-fresh={fresh ? "" : undefined}>
      <div className="tk-shadow">
        <div className="tk-paper">
          <div className="tk-main">
            <p className="tk-head">
              <i aria-hidden="true" />
              {storyCopy.seat.ticketHeader}
            </p>
            <div className="tk-body">
              {/* The flying copy carries the same form, inert (the Actor layer is inert and aria-hidden). */}
              {done ? <Success live={live} fresh={fresh} /> : <WaitlistForm tone="ticket" onStatusChange={live ? onStatus : undefined} />}
            </div>
            <p className="tk-foot">{storyCopy.seat.ticketFoot}</p>
          </div>
          <div className="tk-perf" aria-hidden="true" />
          <div className="tk-stub" aria-hidden="true">
            <span className="tk-stub-label">{pkg3Copy.ticket.stubLabel}</span>
            <span className="tk-ring">
              <Check />
            </span>
            <span className="tk-stub-label">{pkg3Copy.ticket.stubOf}</span>
          </div>
          <div className="tk-light" aria-hidden="true" />
          {live ? null : <div className="tk-sheen" aria-hidden="true" />}
        </div>
      </div>
      {done ? (
        <div className="tk-stamp" aria-hidden="true">
          <Check />
          {pkg3Copy.ticket.stamp}
        </div>
      ) : null}
    </div>
  );
}

registerFace("ticket", TicketFace, { chrome: false, clip: false });

export { TicketFace };
