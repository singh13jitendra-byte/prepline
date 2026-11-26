"use client";

/**
 * TICKET FACE — the visitor's beta seat, on the back of the folded prep sheet
 * (storyboard 2.7, round-4 brief, review 3 P1-8 / P1-9 / P2-3): the product's own <SeatTicket>.
 *
 * - host "dock": the real ticket in Act IV, holding the real <WaitlistForm tone="ticket">.
 *   The 25 seats are printed on the stub as hand-drawn rings (anchors seat-ring-1..25, so the
 *   World still knows where the seats are). A successful request fills the centre seat on the
 *   stub, where the eye already is. The request status is shared (seatState) so the seat act can
 *   redraw the Line and send `prepline:seat-claimed`.
 *   The stamp finale (Delight 8, components/acts/seat/finale.ts): a rubber stamp slams down and
 *   leaves "SEAT SAVED · Nº 13 of 25" in pine ink, the stub tears off along the perforation and
 *   flies into the nav's "Save me a seat", which then shows the seat (`prepline:seat-docked`).
 *   A duplicate gets a gentler "ALREADY SAVED" and keeps its stub; errors get no stamp.
 *   Reduced motion: the impression is simply there, nothing flies.
 * - host "actor": the flying copy seen while the sheet flips (inert, aria-hidden). A still print:
 *   the same ticket and stub with the form drawn as text (WaitlistPrint), no live form, no
 *   anchors, so a flight carries a small tree and the hand-over is pixel-identical at rest.
 *   After a request it prints what the real ticket shows: the success line, the impression, and
 *   the torn edge once the stub has flown.
 *
 * Laid out at the face's natural size, 520 x 300. On phones the face is registered small
 * (TICKET_SMALL): a real narrow layout at about 1:1, the stub and its seats kept beside the form,
 * so the smallest text stays 11px or more at 390.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { registerAnchor, type AnchorId } from "@/lib/anchors";
import { WaitlistForm, WaitlistPrint, type WaitlistStatus } from "@/components/WaitlistForm";
import { SeatTicket } from "@/components/product";
import { ART, SEAT_RINGS } from "@/components/art";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { story } from "@/lib/story";
import { CLAIM_RING, SEATS, seatState, useSeatState } from "@/components/acts/seat/seatState";
import { StampHead, StampImpression, StampPrint, stampCopy } from "@/components/acts/seat/Stamp";
import { T_HEAD, T_IMPACT, T_LIFT, T_TEAR, TEAR_MAIN, dock, release, settleStub, tearAndFly } from "@/components/acts/seat/finale";
import "@/components/acts/seat/stamp.css";
import "./ticket.css";

/** The torn edge, declared on the ticket itself (its --pp-stub and keyline are defined there). */
const TEAR_STYLE = { "--tkx-tear": TEAR_MAIN } as CSSProperties;

const ease = { fall: "cubic-bezier(0.55, 0, 0.9, 0.4)", lower: "cubic-bezier(0.3, 0.2, 0.4, 1)", out: "cubic-bezier(0.2, 0.7, 0.3, 1)", lift: "cubic-bezier(0.5, 0, 0.6, 1)" };

/**
 * The stamp's fall, impact and lift (WAAPI: transform and opacity, nothing written per frame).
 * `since`: ms already gone since the request succeeded. A duplicate is lowered, not slammed.
 */
function playStamp(els: { tkx: HTMLElement; head: HTMLElement | null; print: HTMLElement | null; ink: HTMLElement | null }, gentle: boolean, since: number) {
  const out: Animation[] = [];
  const D = T_LIFT + 300 - T_HEAD;
  const at = (ms: number) => +((ms - T_HEAD) / D).toFixed(4);
  const hi = gentle ? 1.16 : 1.42;
  const tf = (x: number, y: number, sx: number, sy: number, r: number) => `translate(${x}px, ${y}px) scale(${sx}, ${sy}) rotate(${r}deg)`;
  const timing = (delay: number, duration: number): KeyframeAnimationOptions => ({ delay: delay - since, duration, fill: "both", easing: "linear" });
  if (els.head) {
    out.push(
      els.head.animate(
        [
          { offset: 0, opacity: 0, transform: tf(0, -26, hi, hi, -7), easing: gentle ? ease.lower : ease.fall },
          { offset: at(T_HEAD + 60), opacity: 1 },
          { offset: at(T_IMPACT), transform: tf(0, 0, 1, 1, 0), easing: ease.out },
          { offset: at(T_IMPACT + 50), transform: gentle ? tf(0, 0, 1.006, 0.994, 0) : tf(0, 1, 1.035, 0.95, 0), easing: ease.out },
          { offset: at(T_IMPACT + 110), transform: tf(0, 0, 0.996, 1.01, 0) },
          { offset: at(T_IMPACT + 170), transform: tf(0, 0, 1, 1, 0) },
          // The lift: up and toward the eye at full strength, gone only in its last 110ms (no ghost
          // of the block over the ink).
          { offset: at(T_LIFT), opacity: 1, transform: tf(0, 0, 1, 1, 0), easing: ease.lift },
          { offset: at(T_LIFT + 190), opacity: 1, transform: tf(0, -28, hi - 0.1, hi - 0.1, 4), easing: "linear" },
          { offset: 1, opacity: 0, transform: tf(0, -36, hi - 0.04, hi - 0.04, 5) },
        ],
        timing(T_HEAD, D),
      ),
    );
  }
  if (els.print) {
    out.push(
      els.print.animate(
        [
          { offset: 0, opacity: 0, transform: tf(22, 28, hi, hi, -7), easing: gentle ? ease.lower : ease.fall },
          { offset: at(T_HEAD + 60), opacity: 1 },
          { offset: at(T_IMPACT), transform: tf(4, 5, 1, 1, 0) },
          { offset: at(T_LIFT), opacity: 1, transform: tf(4, 5, 1, 1, 0), easing: ease.lift },
          { offset: at(T_LIFT + 190), opacity: 1, transform: tf(18, 20, hi - 0.1, hi - 0.1, 4), easing: "linear" },
          { offset: 1, opacity: 0, transform: tf(22, 24, hi - 0.04, hi - 0.04, 5) },
        ],
        timing(T_HEAD, D),
      ),
    );
  }
  if (els.ink) {
    out.push(
      els.ink.animate(
        [
          { opacity: 0, transform: "scale(1.035)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { ...timing(T_IMPACT, gentle ? 200 : 110), easing: ease.out },
      ),
    );
  }
  // The ticket stage takes the blow: 2-3px, 120ms. Never the page, never the painted layers.
  if (!gentle) {
    out.push(
      els.tkx.animate(
        [
          { transform: "translate(0px, 0px)" },
          { transform: "translate(2.5px, -1.5px)" },
          { transform: "translate(-2px, 2px)" },
          { transform: "translate(1px, -0.5px)" },
          { transform: "translate(0px, 0px)" },
        ],
        { delay: T_IMPACT - since, duration: 120, easing: "linear" },
      ),
    );
  }
  return out;
}

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
  const { status, at, finale } = useSeatState();
  const live = host === "dock";
  const stamped = live && status === "done";
  // Fill the seat and run the stamp only for a request made just now, never on a later remount.
  const recent = typeof performance !== "undefined" && performance.now() - at < 2500;
  const fresh = stamped && recent;
  const kind = status === "done" ? "saved" : status === "duplicate" ? "already" : null;
  const play = live && kind !== null && recent && !story.reduced();
  // Where the stub is: the real ticket follows the finale; the flying copy shows the torn edge
  // only once the stub has flown (a stub that settled beside the ticket is drawn attached).
  const stubAt = live ? (kind === "saved" && finale.stub !== "on" ? finale.stub : undefined) : kind === "saved" && (finale.stub === "flown" || finale.stub === "torn") ? "flown" : undefined;
  const onStatus = useCallback((s: WaitlistStatus, email: string) => {
    seatState.set(s);
    if (s === "done") seatState.finale({ note: email });
  }, []);

  const headRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);

  // The finale (real ticket only). Before paint, so the ink is never seen before the stamp lands.
  useLayoutEffect(() => {
    const tkx = rootRef.current;
    if (!live || !tkx) return;
    const st = seatState.get();
    const k = st.status === "done" ? "saved" : st.status === "duplicate" ? "already" : null;
    if (!k) return;
    seatState.finale({ impress: k });
    const since = performance.now() - st.at;
    if (since >= 2500) {
      // A remount long after the request: draw the end state, no replay.
      return st.finale.stub === "settled" && k === "saved" ? (settleStub(tkx, false) ?? undefined) : undefined;
    }
    if (story.reduced()) {
      if (k === "saved") dock({ reduced: true });
      return;
    }
    const anims = playStamp({ tkx, head: headRef.current, print: printRef.current, ink: inkRef.current }, k === "already", since);
    let cancelFly: (() => void) | null = null;
    const timer = k === "saved" ? window.setTimeout(() => (cancelFly = tearAndFly(tkx)), Math.max(0, T_TEAR - since)) : 0;
    return () => {
      anims.forEach((a) => a.cancel());
      clearTimeout(timer);
      cancelFly?.();
    };
  }, [live, status, at]);

  // Edit it.: the seat is open again. The stub comes back (a short fade, never a jump) and the nav
  // hears `prepline:seat-released`.
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (!live || was !== "done" || status === "done") return;
    release();
    if (story.reduced()) return;
    rootRef.current?.querySelectorAll<HTMLElement>(".pp-ticket-stub, .pp-ticket-perf").forEach((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" }),
    );
  }, [live, status]);

  // The seats are printed into the product's own stub, between its label and "of 25".
  const rootRef = useRef<HTMLDivElement>(null);
  const [stub, setStub] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setStub(rootRef.current?.querySelector<HTMLElement>(".pp-ticket-stub") ?? null);
  }, []);

  // Warm (flying copy only): painted, facing the viewer, at 0.4% opacity (sheet.css) from the end of
  // the votes until the dawn's turn is about to show it, so its first visible frame is never unpainted.
  useEffect(() => {
    if (live || story.reduced()) return;
    return story.frame("line", (_t, _dt, s) => {
      const warm = s.beat === "votes" || (s.beat === "dawn" && story.actorState().flip < 0.45);
      const face = rootRef.current?.closest<HTMLElement>(".actor-face");
      if (face && face.hasAttribute("data-warm") !== warm) face.toggleAttribute("data-warm", warm);
    });
  }, [live]);

  return (
    <div
      ref={rootRef}
      className="tkx"
      data-host={host}
      data-skin={skin}
      data-fresh={fresh ? "" : undefined}
      data-stub={stubAt}
    >
      <div className="tkx-inner" data-skin="day">
        {/* The product's own "Seat requested" pill gives way to the stamp's impression (below). */}
        <SeatTicket skin="day" stamped={false} style={TEAR_STYLE}>
          {live ? (
            <WaitlistForm tone="ticket" onStatusChange={onStatus} doneLive={stampCopy.live} />
          ) : (
            <WaitlistPrint doneFor={status === "done" && finale.note ? finale.note : undefined} />
          )}
        </SeatTicket>
      </div>
      {kind ? (
        <div className="tkx-stampbox" data-kind={kind} aria-hidden="true">
          {play ? (
            <div ref={printRef} className="tkx-stamp-layer tkx-stamp-moving">
              <StampPrint />
            </div>
          ) : null}
          <div ref={inkRef} className="tkx-stamp-layer">
            <StampImpression kind={kind} idp={`tk-${host}-${skin}`} />
          </div>
          {play ? (
            <div ref={headRef} className="tkx-stamp-layer tkx-stamp-moving">
              <StampHead />
            </div>
          ) : null}
        </div>
      ) : null}
      {stub ? createPortal(live ? <StubSeats host={host} skin={skin} claimed={stamped} fresh={fresh} /> : <StubSeatsPrint />, stub) : null}
    </div>
  );
}

/** The phone ticket: the seat column's width at 390 (350), tall enough for the stacked form. */
export const TICKET_SMALL = { width: 350, height: 344 };

registerFace("ticket", TicketFace, { width: 520, height: 300, chrome: false, clip: false, small: TICKET_SMALL });

export { TicketFace };
