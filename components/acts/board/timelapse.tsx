"use client";

/**
 * The board as a lit time-lapse (review wow upgrade 4).
 *
 * One scrubbed clock runs across Act II, Monday morning to Wednesday night:
 *   saved      Mon 08:30 → Mon 18:30
 *   applied    Mon 18:30 → Tue 17:00
 *   interview  Tue 17:00 → Wed 13:00   (the slot booked is Thu 11:40)
 *   hinge      Wed 13:00 → Wed 21:40   (then nightfall: the night before)
 * It drives the "now" dot and clock on the week strip, and the light that
 * crosses the board with the time of day. Also: the ledger odometer.
 */

import type { CSSProperties } from "react";
import { storyActs12 } from "@/lib/content";
import { BEATS, type BeatId, type StoryState } from "@/lib/story";

export const DAYS = storyActs12.board.days;

const KEYS: [BeatId, number, number][] = [
  ["saved", 8.5, 18.5],
  ["applied", 18.5, 41],
  ["interview", 41, 61],
  ["hinge", 61, 69 + 2 / 3],
];
const idx = (id: BeatId) => BEATS.findIndex((b) => b.id === id);

/** Like a real time-lapse, the clock races through the night: night hours cost a fifth of the scroll. */
const isDay = (h: number) => {
  const hd = h % 24;
  return hd >= 6.5 && hd <= 19.5;
};
const STEP = 0.1;
/** Scroll weight from a to b (day hours weigh 1, night hours 0.2). */
function weight(a: number, b: number): number {
  let w = 0;
  for (let h = a; h < b; h += STEP) w += (isDay(h + STEP / 2) ? 1 : 0.2) * Math.min(STEP, b - h);
  return w;
}
/** The hour reached after spending `w` of weight from a. */
function hourAt(a: number, b: number, w: number): number {
  let h = a;
  while (h < b) {
    const d = Math.min(STEP, b - h);
    const k = (isDay(h + d / 2) ? 1 : 0.2) * d;
    if (w <= k) return h + (d * w) / k;
    w -= k;
    h += d;
  }
  return b;
}
const TOTALS = KEYS.map(([, a, b]) => weight(a, b));

/** Hours since Monday 00:00 at the current scroll position. `null` gives the start. */
export function boardHours(s: Readonly<StoryState> | null): number {
  if (!s) return KEYS[0][1];
  const i = idx(s.beat);
  if (i < idx("saved")) return KEYS[0][1];
  for (let k = 0; k < KEYS.length; k++) {
    const [id, a, b] = KEYS[k];
    if (s.beat === id) return hourAt(a, b, TOTALS[k] * s.beatProgress);
  }
  return KEYS[KEYS.length - 1][2];
}

/** "TUE 14:20" (ten-minute steps, so the digits tick like a clock). */
export function clockLabel(hours: number): string {
  const day = Math.min(DAYS.length - 1, Math.floor(hours / 24));
  const mins = Math.floor(((hours % 24) * 60) / 10) * 10;
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${DAYS[day]} ${hh}:${mm}`;
}

/** Where the light sits on the board at this time of day (x, y in %), how strong, and how much night. */
export function sunAt(hours: number) {
  const hd = hours % 24;
  const t = (hd - 6.5) / 13;
  const day = t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0;
  return { x: -10 + 120 * Math.min(1, Math.max(0, t)), y: 105 - 75 * day, a: 0.15 + 0.85 * day, night: 1 - day };
}

/* ── odometer ── */

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** Digits that roll. The markup shows `end` (static page and screen readers get the final value). */
export function Odo({ id, end, digits }: { id: string; end: number; digits: number }) {
  const cols = Array.from({ length: digits }, (_, k) => digits - 1 - k);
  return (
    <span className="bd-odo-wrap">
      <span className="sr-only">{end}</span>
      <span className="bd-odo" data-odo={id} aria-hidden="true">
        {cols.map((place) => {
          const d = Math.floor(end / 10 ** place) % 10;
          return (
            <span key={place} className="bd-odo-d" data-place={place} style={{ "--pos": d, "--lead": place > 0 && end < 10 ** place ? 1 : 0 } as CSSProperties}>
              <span className="bd-odo-s">
                {STRIP.map((n, j) => (
                  <span key={j}>{n}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Roll an odometer to a fractional value (write-only). */
export function setOdo(root: HTMLElement, id: string, value: number) {
  const odo = root.querySelector<HTMLElement>(`[data-odo="${id}"]`);
  if (!odo) return;
  const key = value.toFixed(3);
  if (odo.dataset.v === key) return;
  odo.dataset.v = key;
  odo.querySelectorAll<HTMLElement>(".bd-odo-d").forEach((el) => {
    const place = Number(el.dataset.place);
    const unit = 10 ** place;
    let pos: number;
    if (place === 0) pos = value % 10;
    else {
      const below = value % unit;
      const carry = Math.max(0, below - (unit - 1));
      pos = (Math.floor(value / unit) % 10) + carry;
    }
    el.style.setProperty("--pos", pos.toFixed(3));
    el.style.setProperty("--lead", place > 0 && value < unit - 1 + 1e-6 && pos < 1 ? (1 - pos).toFixed(3) : "0");
  });
}
