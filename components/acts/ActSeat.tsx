"use client";

/**
 * ACT IV — SEAT (day, dawn light). Storyboard 2.7.
 *
 *   dawn (wipe, prep's)  the sheet folds and flips into the ticket on its way here
 *   dawn (scrubbed)      "Walk in / ready." rides up under the rising line; the rings begin to gather
 *   seat                 the Line docks under "ready." (scrubbed); the rings finish gathering, the
 *                        ticket lifts and its stub tears (scrubbed); it straightens, the promises rise (timed)
 *   footer               the stage scrolls away
 *
 * The ticket is the real <WaitlistForm tone="ticket">, docked in a FaceSlot. On a
 * successful request the ring nearest the ticket is claimed (window event
 * `prepline:seat-claimed`, detail { ring: 1..25 }, for the World's gold fill), a stamp
 * presses onto the ticket and the Line under "ready." draws itself once more.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { anchorElement, registerAnchor, useAnchor, type AnchorId } from "@/lib/anchors";
import { storyCopy } from "@/lib/content";
import { gsap } from "@/lib/gsap";
import { usePerformance } from "@/lib/perform";
import { BEATS, clamp01, story } from "@/lib/story";
import { FaceFrame, FaceSlot } from "@/components/story/FaceSlot";
import { Panel, Stage } from "@/components/story/Stage";
import "@/components/faces/TicketFace";
import { seatState, useSeatState } from "./seat/seatState";
import "./seat/seat.css";

const idx = (b: string) => BEATS.findIndex((x) => x.id === b);
const RINGS = storyCopy.seat.ringCount;

function PromiseIcon({ i }: { i: number }) {
  const p = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (i === 0)
    return (
      <svg {...p}>
        <rect x="3" y="7" width="10" height="7" rx="1.6" />
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
      </svg>
    );
  if (i === 1)
    return (
      <svg {...p}>
        <circle cx="8" cy="8" r="5.75" />
        <path d="M4 12l8-8" />
      </svg>
    );
  if (i === 2)
    return (
      <svg {...p}>
        <path d="M2.5 8.6V3.2c0-.4.3-.7.7-.7h5.4l5 5-6.1 6.1z" />
        <circle cx="5.6" cy="5.6" r="1" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M2.5 6.5c0-1.6 2.5-3 5.5-3s5.5 1.4 5.5 3-2.5 3-5.5 3-5.5-1.4-5.5-3z" />
      <path d="M5 9.2L4 13M11 9.2l1 3.8" />
    </svg>
  );
}

/** The real ticket, inside its FaceSlot: a tilt layer around the shared face. */
function TicketDock({ tiltRef }: { tiltRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={tiltRef} className="seat-tilt" style={{ "--rest": "-2deg" } as CSSProperties}>
      <FaceFrame face="ticket" skin="day" fold={1} progress={1} host="dock" />
    </div>
  );
}

function Rings({ hostRef, claimed, world }: { hostRef: React.RefObject<HTMLUListElement | null>; claimed: number | null; world: boolean }) {
  const { status, at } = useSeatState();
  const fresh = status === "done" && typeof performance !== "undefined" && performance.now() - at < 2500;
  const near = useRef(-1);

  // Each ring is an anchor (seat-ring-1..25): the World flies one speck into each during the dawn and the seat.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const offs = Array.from(host.children).map((el, i) => registerAnchor(`seat-ring-${i + 1}` as AnchorId, el as HTMLElement));
    return () => offs.forEach((off) => off());
  }, [hostRef]);

  // Fine pointers: the ring nearest the cursor lights up (an open seat).
  const onMove = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || story.reduced()) return;
    const host = e.currentTarget;
    let best = -1;
    let bestD = 30 * 30;
    host.querySelectorAll<HTMLElement>(".seat-ring").forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best === near.current) return;
    host.children[near.current]?.removeAttribute("data-near");
    if (best >= 0) host.children[best]?.setAttribute("data-near", "");
    near.current = best;
  };
  const onLeave = (e: React.PointerEvent<HTMLUListElement>) => {
    e.currentTarget.children[near.current]?.removeAttribute("data-near");
    near.current = -1;
  };

  return (
    <ul ref={hostRef} className="seat-ring-grid" aria-hidden="true" onPointerMove={onMove} onPointerLeave={onLeave}>
      {Array.from({ length: RINGS }, (_, i) => {
        // Gather from the centre outward.
        const col = i % 5;
        const row = Math.floor(i / 5);
        const d = Math.hypot(col - 2, row - 2) / Math.hypot(2, 2);
        return (
          <li
            key={i}
            className="seat-ring"
            data-filled={claimed === i ? "" : undefined}
            data-fresh={fresh && claimed === i ? "" : undefined}
            data-world={world && claimed === i ? "" : undefined}
            style={{ "--d": (d * 0.55).toFixed(3) } as CSSProperties}
          />
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
    const d = Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
    if (d < bestD) {
      bestD = d;
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
  const promisesRef = useRef<HTMLUListElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const rideRef = useRef<HTMLDivElement>(null);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [worldFill, setWorldFill] = useState(false);

  // The bookend: the Line ends the page under "ready." at the hero underline's own size, not the
  // (larger) closing word's. Measured from the hero's anchor, so it holds at every breakpoint.
  useEffect(() => {
    const el = underlineEl.current;
    if (!el) return;
    const fit = () => {
      const hero = anchorElement("hero-underline");
      const w = hero?.offsetWidth ?? 0;
      el.style.right = w > 0 ? "auto" : "";
      el.style.width = w > 0 ? `${w}px` : "";
      el.style.height = hero && hero.offsetHeight > 0 ? `${hero.offsetHeight}px` : "";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, []);

  // Scrubbed, every pixel (the "breath"):
  // - dawn: "Walk in / ready." rides up just under the rising line, so the line reveals it bottom-up;
  // - dawn into seat: the 25 rings gather (hollow outlines; the World flies a speck into each);
  // - seat: the ticket lifts 10px and its stub tears along the perforation.
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
      ride.style.setProperty("--rise", rise.toFixed(4));
    });
  }, []);

  // seat (breath API): the ticket lifts 10px over the whole beat, its stub tears from 20% on.
  useEffect(() => {
    const tilt = tiltRef.current;
    if (!tilt) return;
    const offs = [story.breath(tilt, "seat", { from: 0, name: "--lift", reduced: 0 }), story.breath(tilt, "seat", { from: 0.2, name: "--tear", reduced: 0 })];
    return () => offs.forEach((off) => off());
  }, []);

  // A successful request claims the ring nearest the ticket. The World fills it gold from the speck
  // inside it: `prepline:seat-claimed` { ring } (1-based). The DOM fill stays subtle so they don't double up.
  useEffect(() => {
    let was = seatState.get().status;
    return seatState.subscribe(() => {
      const now = seatState.get().status;
      if (now === "done" && was !== "done") {
        const ring = nearestRing(ringsRef.current, wrapRef.current);
        // The WebGL World (window.__world) fills the ring gold; the CSS fallback does not.
        setWorldFill(Boolean((window as unknown as { __world?: unknown }).__world) && new URLSearchParams(location.search).get("world") !== "css");
        setClaimed(ring);
        window.dispatchEvent(new CustomEvent("prepline:seat-claimed", { detail: { ring: ring + 1 } }));
      }
      was = now;
    });
  }, []);

  // Timed (0.9s on entry): the ticket straightens, the promises rise, the field comes alive.
  usePerformance("seat", (tl, ctx) => {
    const tilt = tiltRef.current;
    const root = tilt?.querySelector<HTMLElement>(".tk-root");
    if (!tilt || !root) return;
    const rows = promisesRef.current ? [...Array.from(promisesRef.current.children), ...(noteRef.current ? [noteRef.current] : [])] : [];
    const rest = { r: -2 };
    tl.to(rest, {
      r: 0,
      duration: 0.75,
      ease: "back.out(1.6)",
      onUpdate: () => tilt.style.setProperty("--rest", `${rest.r.toFixed(3)}deg`),
    });
    if (rows.length) tl.fromTo(rows, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06 }, 0.16);
    // The field invites typing once everything has landed (visual only, never a programmatic focus).
    const invite = { k: 0 };
    tl.to(invite, {
      k: 1,
      duration: 0.01,
      onUpdate: () => root.toggleAttribute("data-invite", invite.k >= 1 && !ctx.reduced),
    }, 0.85);
  });

  // Fine pointer: the ticket tilts toward the cursor, with a moving highlight.
  useEffect(() => {
    const wrap = wrapRef.current;
    const tilt = tiltRef.current;
    if (!wrap || !tilt || story.reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const v = { tx: 0, ty: 0, hl: 0, hx: 50, hy: 30 };
    const write = () => {
      tilt.style.setProperty("--tx", `${v.tx.toFixed(2)}deg`);
      tilt.style.setProperty("--ty", `${v.ty.toFixed(2)}deg`);
      tilt.style.setProperty("--hl", v.hl.toFixed(3));
      tilt.style.setProperty("--hx", `${v.hx.toFixed(1)}%`);
      tilt.style.setProperty("--hy", `${v.hy.toFixed(1)}%`);
    };
    const to = (vars: Partial<typeof v>, duration: number) => gsap.to(v, { ...vars, duration, ease: "power3.out", overwrite: "auto", onUpdate: write });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      to({ tx: -py * 7, ty: px * 9, hl: 1, hx: (px + 0.5) * 100, hy: (py + 0.5) * 100 }, 0.5);
    };
    const leave = () => to({ tx: 0, ty: 0, hl: 0 }, 0.9);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerleave", leave);
    return () => {
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(v);
    };
  }, []);

  // A successful request: the Line under "ready." draws itself once more.
  useEffect(() => {
    let was = seatState.get().status;
    return seatState.subscribe(() => {
      const now = seatState.get().status;
      if (now === "done" && was !== "done" && underlineEl.current && !story.reduced()) {
        gsap.fromTo(underlineEl.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power3.inOut", delay: 0.2, clearProps: "transform" });
      }
      was = now;
    });
  }, []);

  return (
    <Stage act="seat" labelledBy="join-title">
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
            <p className="type-body seat-body">{storyCopy.seat.body}</p>
            </div>
            <ul ref={promisesRef} className="seat-promises">
              {storyCopy.seat.promises.map((p, i) => (
                <li key={p.title} className="seat-promise">
                  <PromiseIcon i={i} />
                  <span className="seat-promise-t">{p.title}</span>
                  <span className="seat-promise-b">{p.body}</span>
                </li>
              ))}
            </ul>
            <p ref={noteRef} className="seat-note">{storyCopy.seat.dataNote}</p>
          </div>

          <div className="seat-right">
            <div ref={wrapRef} className="seat-ticket-wrap">
              <FaceSlot anchor="ticket" face="ticket" skin="day" className="seat-ticket-slot">
                <TicketDock tiltRef={tiltRef} />
              </FaceSlot>
            </div>
            <div className="seat-rings">
              <Rings hostRef={ringsRef} claimed={claimed} world={worldFill} />
              <span className="type-mono seat-rings-caption">{storyCopy.seat.rings}</span>
            </div>
          </div>
        </div>
      </Panel>
    </Stage>
  );
}
