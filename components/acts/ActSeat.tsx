"use client";

/**
 * ACT IV — SEAT (day, sunrise in the room). Storyboard 2.7, round-4 brief, review 3 (P0-2, P1-8).
 *
 *   dawn (wipe, prep's)  in blue hour the sheet folds, turns over into the ticket and lands on its
 *                        place (ACTOR_TRACK.dawn); only then (DAWN_WIPE) does the Line rise, the
 *                        World bring desk-dawn up under it, and "Walk in / ready." ride up just
 *                        under the rising line on the sunlit wall, so the line reveals it bottom-up
 *   seat                 the Line docks under "ready." (scrubbed, the bookend) and the ticket lifts
 *                        (scrubbed). Nothing else: the headline, one paragraph and the ticket
 *                        breathe on the painting; small copy never sits on it.
 *   footer               the stage scrolls away into the after-stage column (components/acts/after):
 *                        the promises and the data note on a paper slip, then the founder note
 *
 * The ticket is the product <SeatTicket> with the real <WaitlistForm tone="ticket">, docked in
 * a FaceSlot, tilted -2deg until hovered. The 25 seats are printed on its stub (TicketFace).
 * A successful request fills the centre seat there and sends the window event
 * `prepline:seat-claimed`, detail { ring: 1..25 }; the stamp presses onto the ticket and the
 * Line under "ready." draws itself once more.
 */

import { useEffect, useRef, useState } from "react";
import { anchorElement, useAnchor } from "@/lib/anchors";
import { storyCopy } from "@/lib/content";
import { gsap } from "@/lib/gsap";
import { DAWN_WIPE, clamp01, story } from "@/lib/story";
import { ease } from "@/lib/theme";
import { ArtDefs } from "@/components/art";
import { FaceFrame, FaceSlot } from "@/components/story/FaceSlot";
import { Panel, Stage } from "@/components/story/Stage";
import "@/components/faces/TicketFace";
import { AfterStage } from "./after/AfterStage";
import { CLAIM_RING, seatState } from "./seat/seatState";
import "./seat/seat.css";

/** The real ticket, inside its FaceSlot: a tilt layer around the shared face (-2deg at rest). */
function TicketDock({ tiltRef }: { tiltRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={tiltRef} className="seat-tilt">
      <FaceFrame face="ticket" skin="day" fold={1} progress={1} host="dock" />
    </div>
  );
}

/** The SVG filters the hand-drawn marks use, mounted once unless another part of the page already did. */
function MarksDefs() {
  const [need, setNeed] = useState(false);
  useEffect(() => setNeed(!document.getElementById("nd-hand")), []);
  return need ? <ArtDefs /> : null;
}

export function ActSeat() {
  const underline = useAnchor("ready-underline");
  const underlineEl = useRef<HTMLSpanElement | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rideRef = useRef<HTMLDivElement>(null);

  // The bookend: the Line ends the page under "ready." at the hero underline's own size.
  useEffect(() => {
    const el = underlineEl.current;
    if (!el) return;
    const fit = () => {
      const hero = anchorElement("hero-underline");
      const w = hero?.offsetWidth ?? 0;
      el.style.right = w > 0 ? "auto" : "";
      el.style.width = w > 0 ? `${w}px` : "";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, []);

  // Scrubbed (the "breath"): in dawn's sunrise wipe, "Walk in / ready." rides up just under the
  // rising line, so the line reveals it bottom-up. Written in whole px, and only while it moves.
  useEffect(() => {
    const ride = rideRef.current;
    if (!ride || story.reduced()) return;
    let last = NaN;
    return story.subscribe((s) => {
      const rise = s.beat === "dawn" ? clamp01((s.beatProgress - DAWN_WIPE) / (1 - DAWN_WIPE)) : s.beat === "seat" || s.beat === "footer" ? 1 : 0;
      // How far below its place it starts: 46% of the stage. Phones stack the headline above the
      // ticket, so a ride would pass it behind the landed ticket: there the line reveals it in place.
      const px = s.flags.small ? 0 : Math.round((1 - rise) * 0.46 * s.viewport.h);
      if (px === last) return;
      last = px;
      ride.style.transform = px ? `translate3d(0,${px}px,0)` : "none";
    });
  }, []);

  // seat (breath API): the ticket lifts 10px over the whole beat.
  useEffect(() => {
    const tilt = tiltRef.current;
    if (!tilt) return;
    return story.breath(tilt, "seat", { from: 0, name: "--lift", reduced: 0 });
  }, []);

  // A successful request: the World hears which seat (its firefly fills it), the Line redraws.
  useEffect(() => {
    let was = seatState.get().status;
    return seatState.subscribe(() => {
      const now = seatState.get().status;
      if (now === "done" && was !== "done") {
        window.dispatchEvent(new CustomEvent("prepline:seat-claimed", { detail: { ring: CLAIM_RING + 1 } }));
        if (underlineEl.current && !story.reduced()) {
          gsap.fromTo(underlineEl.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: ease.inOutFirm, delay: 0.2, clearProps: "transform" });
        }
      }
      was = now;
    });
  }, []);

  // Fine pointer: the ticket straightens and tilts toward the cursor (paper is stiff: 3deg at most).
  useEffect(() => {
    const wrap = wrapRef.current;
    const tilt = tiltRef.current;
    if (!wrap || !tilt || story.reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const v = { tx: 0, ty: 0, rest: -2 };
    const write = () => {
      tilt.style.setProperty("--tx", `${v.tx.toFixed(2)}deg`);
      tilt.style.setProperty("--ty", `${v.ty.toFixed(2)}deg`);
      tilt.style.setProperty("--rest", `${v.rest.toFixed(2)}deg`);
    };
    const to = (vars: Partial<typeof v>, duration: number) => gsap.to(v, { ...vars, duration, ease: ease.outFirm, overwrite: "auto", onUpdate: write });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      to({ tx: -py * 3, ty: px * 3, rest: 0 }, 0.5);
    };
    const leave = () => to({ tx: 0, ty: 0, rest: -2 }, 0.9);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerleave", leave);
    return () => {
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(v);
    };
  }, []);

  return (
    <>
      <Stage act="seat" labelledBy="join-title">
        <MarksDefs />
        <Panel beats={["seat", "footer"]} focusable className="seat-panel">
          <div className="seat-grid">
            <div className="seat-left">
              <div ref={rideRef} className="seat-ride">
                <h2 id="join-title" className="seat-h">
                  <span className="seat-h-line">{storyCopy.seat.h2}</span>{" "}
                  <span className="seat-h-line">
                    <span className="seat-accent">
                      {storyCopy.seat.h2Accent}
                      <span
                        ref={(el) => {
                          underlineEl.current = el;
                          return underline(el) ?? undefined;
                        }}
                        className="seat-underline"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </h2>
                <p className="seat-body">{storyCopy.seat.body}</p>
              </div>
            </div>

            <div className="seat-right">
              <div ref={wrapRef} className="seat-ticket-wrap">
                <FaceSlot anchor="ticket" face="ticket" skin="day" className="seat-ticket-slot">
                  <TicketDock tiltRef={tiltRef} />
                </FaceSlot>
              </div>
            </div>
          </div>
        </Panel>
      </Stage>
      <AfterStage />
    </>
  );
}
