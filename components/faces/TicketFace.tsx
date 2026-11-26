"use client";

/**
 * TICKET FACE — the visitor's beta seat, on the back of the folded prep sheet
 * (storyboard 2.7, round-4 brief, review 3 P1-8 / P1-9 / P2-3): the product's own <SeatTicket>.
 *
 * - host "dock": the real ticket in Act IV, holding the real <WaitlistForm tone="ticket">.
 *   The 25 seats are printed on the stub as hand-drawn rings (anchors seat-ring-1..25, so the
 *   World still knows where the seats are). A successful request presses the stamp and fills
 *   the centre seat on the stub, where the eye already is. The request status is shared
 *   (seatState) so the seat act can redraw the Line and send `prepline:seat-claimed`.
 * - host "actor": the flying copy seen while the sheet flips (inert, aria-hidden). A still print:
 *   the same ticket and stub with the form drawn as text (WaitlistPrint), no live form, no
 *   anchors, so a flight carries a small tree and the hand-over is pixel-identical at rest.
 *
 * Laid out at the face's natural size, 520 x 300. On phones the ticket is laid out 468 wide
 * (still the wide layout, stub and seats included) and scaled to the slot.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { registerAnchor, type AnchorId } from "@/lib/anchors";
import { WaitlistForm, WaitlistPrint, type WaitlistStatus } from "@/components/WaitlistForm";
import { SeatTicket } from "@/components/product";
import { ART, SEAT_RINGS } from "@/components/art";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { CLAIM_RING, SEATS, seatState, useSeatState } from "@/components/acts/seat/seatState";
import "./ticket.css";

/** The 25 seats on the stub: three hands of the same ring, each turned, so it is not 25 clones. */
function StubSeats({ host, skin, claimed, fresh }: { host: FaceProps["host"]; skin: FaceProps["skin"]; claimed: boolean; fresh: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  // Only the real ticket owns the anchors (the latest registration wins, see faces.ts).
  useEffect(() => {
    const el = ref.current;
    if (!el || host !== "dock") return;
    const offs = Array.from(el.children).map((c, i) => registerAnchor(`seat-ring-${i + 1}` as AnchorId, c as HTMLElement));
    return () => offs.forEach((off) => off());
  }, [host]);

  return (
    <span ref={ref} className="tkx-seats" aria-hidden="true">
      {Array.from({ length: SEATS }, (_, i) => {
        const Ring = SEAT_RINGS[i % 3];
        const taken = claimed && i === CLAIM_RING;
        return (
          <span
            key={i}
            className="tkx-seat"
            data-taken={taken ? "" : undefined}
            data-fresh={taken && fresh ? "" : undefined}
            style={{ "--turn": `${(i * 37) % 360}deg` } as CSSProperties}
          >
            <Ring taken={taken} idPrefix={`tk-${host}-${skin}-${i}`} className="tkx-seat-art" />
          </span>
        );
      })}
    </span>
  );
}

/**
 * The same 25 seats as one drawing, for the flying copy: the three ring paths from the art
 * registry, placed and turned exactly as the stub's grid places them (14px seats, 4px gaps),
 * under one hand-drawn filter. 26 nodes instead of 25 small drawings.
 */
const RING_IDS = ["seat-ring-a", "seat-ring-b", "seat-ring-c"] as const;
function StubSeatsPrint() {
  const S = 14;
  const G = 4;
  const W = 5 * S + 4 * G;
  return (
    <svg className="tkx-seats tkx-seats-print" width={W} height={W} viewBox={`0 0 ${W} ${W}`} fill="none" aria-hidden="true" style={{ overflow: "visible" }}>
      <g style={{ filter: "var(--art-wobble, url(#nd-hand))" }}>
        {Array.from({ length: SEATS }, (_, i) => {
          const a = ART[RING_IDS[i % 3]];
          const x = (i % 5) * (S + G);
          const y = Math.floor(i / 5) * (S + G);
          const k = S / a.w;
          return (
            <path
              key={i}
              d={a.d}
              transform={`translate(${x} ${y}) rotate(${(i * 37) % 360} ${S / 2} ${S / 2}) scale(${k})`}
              style={{
                stroke: "var(--art-stroke-color, var(--c-line))",
                strokeWidth: "var(--art-stroke, 3px)",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}

function TicketFace({ skin, host }: FaceProps) {
  const { status, at } = useSeatState();
  const live = host === "dock";
  const stamped = live && status === "done";
  // Press the stamp and fill the seat only for a request made just now, never on a later remount.
  const fresh = stamped && typeof performance !== "undefined" && performance.now() - at < 2500;
  const onStatus = useCallback((s: WaitlistStatus) => seatState.set(s), []);

  // The seats are printed into the product's own stub, between its label and "of 25".
  const rootRef = useRef<HTMLDivElement>(null);
  const [stub, setStub] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setStub(rootRef.current?.querySelector<HTMLElement>(".pp-ticket-stub") ?? null);
  }, []);

  return (
    <div ref={rootRef} className="tkx" data-host={host} data-skin={skin} data-fresh={fresh ? "" : undefined}>
      <div className="tkx-inner" data-skin="day">
        <SeatTicket skin="day" stamped={stamped}>
          {live ? <WaitlistForm tone="ticket" onStatusChange={onStatus} /> : <WaitlistPrint />}
        </SeatTicket>
      </div>
      {stub ? createPortal(live ? <StubSeats host={host} skin={skin} claimed={stamped} fresh={fresh} /> : <StubSeatsPrint />, stub) : null}
    </div>
  );
}

registerFace("ticket", TicketFace, { width: 520, height: 300, chrome: false, clip: false });

export { TicketFace };
