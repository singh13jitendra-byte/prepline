"use client";

/**
 * THE STAMP (Delight 8) — the rubber stamp that seals a seat request on the ticket.
 *
 * - <StampImpression>: the ink left on the ticket. A rounded double border, "SEAT SAVED" in Young
 *   Serif capitals and "Nº 13 of 25" under it, in pine (a duplicate request: "ALREADY SAVED" in
 *   moss, one line). The ink is a little uneven: an SVG filter knocks fine specks out of it and
 *   nudges its edges, the way a real stamp never inks perfectly. Drawn once; never animated
 *   except its first 90ms (TicketFace).
 * - <StampHead>: the stamp itself, seen from above: the pine block, its turned handle in the
 *   middle with the lamp cap, and the handle's shadow on the block. Under it, <StampPrint>: the
 *   head's lamp silhouette, printed off register, which is how this theme draws depth. The head
 *   only exists while it falls and lifts (TicketFace mounts it for a fresh request).
 *
 * All of it is decorative (aria-hidden): the live region says what the stamp printed.
 */

import { storyCopy } from "@/lib/content";
import { SEATS, SEAT_NO } from "./seatState";

const fill = (s: string) => s.replace("{n}", String(SEAT_NO)).replace("{total}", String(SEATS));
export const stampCopy = {
  saved: storyCopy.seat.stampSaved,
  seat: fill(storyCopy.seat.stampSeat),
  already: storyCopy.seat.stampAlready,
  live: fill(storyCopy.seat.stampLive),
};

/** The impression's box (px). The head is this plus a 6px rim. */
export const STAMP_W = 184;
export const STAMP_H = 70;

export function StampImpression({ kind, idp }: { kind: "saved" | "already"; idp: string }) {
  const f = `${idp}-ink`;
  const saved = kind === "saved";
  return (
    <svg className="tkx-stamp-ink" data-kind={kind} width={STAMP_W} height={STAMP_H} viewBox={`0 0 ${STAMP_W} ${STAMP_H}`} aria-hidden="true" focusable="false">
      <defs>
        <filter id={f} x="-4%" y="-6%" width="108%" height="112%" colorInterpolationFilters="sRGB">
          {/* fine specks where the rubber missed */}
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="11" result="speck" />
          <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -15 9.6" result="holes" />
          {/* broad patches pressed a little lighter */}
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="4" result="patch" />
          <feColorMatrix in="patch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.5" result="press" />
          <feComposite in="holes" in2="press" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" result="ink" />
          {/* ragged edges */}
          <feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="1" seed="2" result="warp" />
          <feDisplacementMap in="ink" in2="warp" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* the small line stays legible: a few specks, no warp */}
        <filter id={`${f}-s`} x="-4%" y="-10%" width="108%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="5" result="speck" />
          <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -20 13.4" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${f})`}>
        <rect className="tkx-ink-line" x="2" y="2" width={STAMP_W - 4} height={STAMP_H - 4} rx="13" strokeWidth="2.6" />
        <rect className="tkx-ink-line" x="7.5" y="7.5" width={STAMP_W - 15} height={STAMP_H - 15} rx="8.5" strokeWidth="1.1" />
        {saved ? (
          <>
            <text className="tkx-ink-big" x={STAMP_W / 2} y="36.5" textAnchor="middle">
              {stampCopy.saved.toUpperCase()}
            </text>
          </>
        ) : (
          <>
            <text className="tkx-ink-big tkx-ink-big-s" x={STAMP_W / 2} y="41.5" textAnchor="middle">
              {stampCopy.already.toUpperCase()}
            </text>
          </>
        )}
      </g>
      {saved ? (
        <g filter={`url(#${f}-s)`}>
          <path className="tkx-ink-line" d="M26 50.5H50M134 50.5H158" strokeWidth="1.2" strokeLinecap="round" />
          <text className="tkx-ink-small" x={STAMP_W / 2} y="55" textAnchor="middle">
            {stampCopy.seat}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/** The head's footprint: the impression plus a rim. */
const HW = STAMP_W + 12;
const HH = STAMP_H + 12;

export function StampPrint() {
  return (
    <svg className="tkx-stamp-print" width={HW} height={HH} viewBox={`0 0 ${HW} ${HH}`} aria-hidden="true" focusable="false">
      <rect x="0" y="0" width={HW} height={HH} rx="16" />
    </svg>
  );
}

export function StampHead() {
  const cx = HW / 2;
  const cy = HH / 2;
  return (
    <svg className="tkx-stamp-head" width={HW} height={HH} viewBox={`0 0 ${HW} ${HH}`} aria-hidden="true" focusable="false">
      {/* the block, its bevel, and the rubber's rim showing at the edge */}
      <rect className="tkx-head-block" x="0" y="0" width={HW} height={HH} rx="16" />
      <rect className="tkx-head-bevel" x="6" y="6" width={HW - 12} height={HH - 12} rx="11" />
      {/* the handle: its shadow on the block, the turned knob, the lamp cap */}
      <ellipse className="tkx-head-shadow" cx={cx + 7} cy={cy + 8} rx="27" ry="24" />
      <circle className="tkx-head-knob" cx={cx} cy={cy} r="25" />
      <path className="tkx-head-turn" d={`M${cx - 17} ${cy - 9}a19 19 0 0 1 22-11`} />
      <circle className="tkx-head-cap" cx={cx} cy={cy} r="10" />
    </svg>
  );
}
