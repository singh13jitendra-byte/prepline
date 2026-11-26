"use client";

/**
 * TICKET FACE — the visitor's beta seat, on the back of the folded prep sheet
 * (storyboard 2.7, round-4 brief): the product's own <SeatTicket> holding the real
 * <WaitlistForm tone="ticket">.
 *
 * - host "dock": the real ticket in Act IV (a normal, focusable form). A successful request
 *   presses the stamp; the request status is shared (seatState) so the seat act can claim a
 *   ring and redraw the Line.
 * - host "actor": the flying copy seen while the sheet flips (inert, aria-hidden: the Actor
 *   layer is both). It carries the same ticket so the flip reveals a complete seat.
 *
 * Laid out at the face's natural size, 520 x 300. On phones the ticket is laid out 460 wide
 * (still the wide layout, stub and all) and scaled up, so its text stays readable.
 */

import { useCallback } from "react";
import { WaitlistForm, type WaitlistStatus } from "@/components/WaitlistForm";
import { SeatTicket } from "@/components/product";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { seatState, useSeatState } from "@/components/acts/seat/seatState";
import "./ticket.css";

function TicketFace({ skin, host }: FaceProps) {
  const { status, at } = useSeatState();
  const live = host === "dock";
  const stamped = status === "done";
  // Press the stamp only for a request made just now, never on a later remount.
  const fresh = stamped && typeof performance !== "undefined" && performance.now() - at < 2500;
  const onStatus = useCallback((s: WaitlistStatus) => seatState.set(s), []);

  return (
    <div className="tkx" data-host={host} data-skin={skin} data-fresh={fresh ? "" : undefined}>
      <div className="tkx-inner" data-skin="day">
        <SeatTicket skin="day" stamped={live ? stamped : false}>
          <WaitlistForm tone="ticket" onStatusChange={live ? onStatus : undefined} />
        </SeatTicket>
      </div>
    </div>
  );
}

registerFace("ticket", TicketFace, { width: 520, height: 300, chrome: false, clip: false });

export { TicketFace };
