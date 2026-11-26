"use client";

/**
 * ACT IV — SEAT (day, sunrise in the room). Storyboard 2.7, round-4 brief.
 *
 *   dawn (wipe, prep's)  the World crossfades desk-bluehour into desk-dawn as the Line rises; the
 *                        sheet folds and flips into the ticket; "Walk in / ready." rides up under
 *                        the rising line on the sunlit wall, so the line reveals it bottom-up
 *   seat                 the Line docks under "ready." (scrubbed, the bookend); the 25 hand-drawn
 *                        seat rings gather and the ticket lifts (scrubbed); the promises rise (timed)
 *   footer               the stage scrolls away into the after-stage column (components/acts/after)
 *
 * The ticket is the product <SeatTicket> with the real <WaitlistForm tone="ticket">, docked in
 * a FaceSlot, tilted -2deg until hovered. A successful request claims the ring nearest the
 * ticket: window event `prepline:seat-claimed`, detail { ring: 1..25 }, for the World's gold fill;
 * the stamp presses onto the ticket and the Line under "ready." draws itself once more.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { anchorElement, registerAnchor, useAnchor, type AnchorId } from "@/lib/anchors";
import { storyCopy } from "@/lib/content";
import { gsap } from "@/lib/gsap";
import { usePerformance } from "@/lib/perform";
import { BEATS, clamp01, story } from "@/lib/story";
import { ease } from "@/lib/theme";
import { ArtDefs, SEAT_RINGS } from "@/components/art";
import { FaceFrame, FaceSlot } from "@/components/story/FaceSlot";
import { Panel, Stage } from "@/components/story/Stage";
import "@/components/faces/TicketFace";
import { AfterStage } from "./after/AfterStage";
import { signoff } from "./after/copy";
import { seatState, useSeatState } from "./seat/seatState";
import "./seat/seat.css";

const idx = (b: string) => BEATS.findIndex((x) => x.id === b);
const RINGS = 25;

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

function Rings({ hostRef, claimed, world }: { hostRef: React.RefObject<HTMLUListElement | null>; claimed: number | null; world: boolean }) {
  const { status, at } = useSeatState();
  const fresh = status === "done" && typeof performance !== "undefined" && performance.now() - at < 2500;

  // Each ring is an anchor (seat-ring-1..25): the World flies a firefly into each during dawn and seat.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const offs = Array.from(host.children).map((el, i) => registerAnchor(`seat-ring-${i + 1}` as AnchorId, el as HTMLElement));
    return () => offs.forEach((off) => off());
  }, [hostRef]);

  return (
    <ul ref={hostRef} className="seat-ring-grid" aria-hidden="true">
      {Array.from({ length: RINGS }, (_, i) => {
        const Ring = SEAT_RINGS[i % 3];
        const col = i % 5;
        const row = Math.floor(i / 5);
        // Gather from the centre outward; three hands, each turned, so the grid is not 25 clones.
        const d = Math.hypot(col - 2, row - 2) / Math.hypot(2, 2);
        const taken = claimed === i;
        return (
          <li
            key={i}
            className="seat-ring"
            data-filled={taken ? "" : undefined}
            data-fresh={fresh && taken ? "" : undefined}
            data-world={world && taken ? "" : undefined}
            style={{ "--d": (d * 0.55).toFixed(3), "--turn": `${(i * 37) % 360}deg` } as CSSProperties}
          >
            <Ring taken={taken && !world} idPrefix={`seat-${i}`} className="seat-ring-art" />
          </li>
        );
      })}
    </ul>
  );
}

/** The ring nearest the ticket: that is the seat a successful request claims. */
function nearestRing(rings: HTMLElement | null, ticket: HTMLElement | null): number {
  if (!rings || !ticket) return 0;
  const t = ticket.getBoundingClientRect();
  const tx = t.left + t.width / 2;
  const ty = t.bottom;
  let best = 0;
  let bestD = Infinity;
  Array.from(rings.children).forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const dd = Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  });
  return best;
}

export function ActSeat() {
  const underline = useAnchor("ready-underline");
  const underlineEl = useRef<HTMLSpanElement | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLUListElement>(null);
  const riseRef = useRef<HTMLDivElement>(null);
  const rideRef = useRef<HTMLDivElement>(null);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [worldFill, setWorldFill] = useState(false);

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

  // Scrubbed, every pixel (the "breath"):
  // - dawn: "Walk in / ready." rides up just under the rising line, so the line reveals it bottom-up;
  // - dawn into seat: the 25 rings gather (the World flies a firefly into each).
  useEffect(() => {
    const rings = ringsRef.current?.parentElement;
    const ride = rideRef.current;
    if (!rings || !ride || story.reduced()) return;
    let last = "";
    return story.subscribe((s) => {
      const i = idx(s.beat);
      const p = s.beatProgress;
      let gather = 0;
      let rise = 0;
      if (s.beat === "dawn") {
        gather = 0.4 * clamp01((p - 0.55) / 0.45);
        rise = clamp01((p - 0.15) / 0.85);
      } else if (s.beat === "seat") {
        gather = 0.4 + 0.6 * clamp01(p / 0.6);
        rise = 1;
      } else if (i > idx("seat")) {
        gather = rise = 1;
      }
      const key = `${gather.toFixed(3)}|${rise.toFixed(4)}`;
      if (key === last) return;
      last = key;
      rings.style.setProperty("--gather", gather.toFixed(3));
      ride.style.transform = `translate3d(0, calc(${(1 - rise).toFixed(4)} * var(--ride-d)), 0)`;
    });
  }, []);

  // seat (breath API): the ticket lifts 10px over the whole beat.
  useEffect(() => {
    const tilt = tiltRef.current;
    if (!tilt) return;
    return story.breath(tilt, "seat", { from: 0, name: "--lift", reduced: 0 });
  }, []);

  // A successful request claims the ring nearest the ticket (World: gold fill from the firefly inside it).
  useEffect(() => {
    let was = seatState.get().status;
    return seatState.subscribe(() => {
      const now = seatState.get().status;
      if (now === "done" && was !== "done") {
        const ring = nearestRing(ringsRef.current, wrapRef.current);
        setWorldFill(Boolean((window as unknown as { __world?: unknown }).__world) && new URLSearchParams(location.search).get("world") !== "css");
        setClaimed(ring);
        window.dispatchEvent(new CustomEvent("prepline:seat-claimed", { detail: { ring: ring + 1 } }));
        if (underlineEl.current && !story.reduced()) {
          gsap.fromTo(underlineEl.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: ease.inOutFirm, delay: 0.2, clearProps: "transform" });
        }
      }
      was = now;
    });
  }, []);

  // Timed (on entry): the sign-off, promises and data note rise in, 60ms apart.
  usePerformance("seat", (tl) => {
    const rows = riseRef.current ? Array.from(riseRef.current.querySelectorAll<HTMLElement>("[data-rise]")) : [];
    if (rows.length) tl.fromTo(rows, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: ease.out, stagger: 0.06 }, 0.1);
  });

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
              <div ref={riseRef}>
                <p className="seat-signoff" data-rise="">
                  {signoff.line}
                  <span>
                    <b>{signoff.name}</b>
                    {signoff.role ? `, ${signoff.role}` : ""}
                  </span>
                </p>
                <ul className="seat-promises">
                  {storyCopy.seat.promises.map((p) => (
                    <li key={p.title} className="seat-promise" data-rise="">
                      <span className="seat-promise-t">{p.title}</span>
                      <span className="seat-promise-b">{p.body}</span>
                    </li>
                  ))}
                </ul>
                <p className="seat-note" data-rise="">
                  {storyCopy.seat.dataNote}
                </p>
              </div>
            </div>

            <div className="seat-right">
              <div ref={wrapRef} className="seat-ticket-wrap">
                <FaceSlot anchor="ticket" face="ticket" skin="day" className="seat-ticket-slot">
                  <TicketDock tiltRef={tiltRef} />
                </FaceSlot>
              </div>
              <div className="seat-rings">
                <Rings hostRef={ringsRef} claimed={claimed} world={worldFill} />
                <span className="seat-rings-caption">
                  <span aria-hidden="true">{storyCopy.seat.rings}</span>
                  <span className="sr-only">{storyCopy.seat.ringsLabel}</span>
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </Stage>
      <AfterStage />
    </>
  );
}
