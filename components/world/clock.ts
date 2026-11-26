/**
 * THE STORY CLOCK (delight 7) — what time it is in the story at a scroll position.
 *
 * One timeline, read from the copy (lib/content.ts) and the board:
 *   Wed 4:05 PM   the interview is booked ("Wed 16:05 · Booked" on the board clock). Night falls
 *                 over the evening: the clock runs to
 *   Wed 11:25 PM  the laptop opens ("Wednesday · 11:25 PM", unfold), and holds there while the
 *                 sheet unfolds. The three questions run past midnight:
 *   Thu 12:10 AM  the last question (q3). Then the night, the interview (Thu 3 Dec, 11:40) and the
 *                 ride home pass in one jump to
 *   Thu 1:10 PM   the votes on the metro home ("Thursday · 1:10 PM"). Then a time-lapse through the
 *                 evening and the night to the next morning:
 *   Fri 6:10 AM   blue hour (desk-bluehour fades in), 6:40 the Line rises with the light (DAWN_WIPE),
 *   Fri 6:58 AM   sunrise (Gurugram, 4 December), and the seat settles at 7:06.
 *
 * Minutes are counted from Wednesday 00:00. A key's `turns` and `ease` belong to the segment that
 * arrives at it. In a jump the minute hand does a few whole turns plus the true remainder (so it
 * lands on the right minute, never strobing through dozens of turns between two frames); the hour
 * hand and the printed time always tell the true time.
 */

import { beatPosition, DAWN_WIPE, type BeatId } from "@/lib/story";

const WED = 0;
const THU = 1440;
const FRI = 2880;
const at = (day: number, h: number, m: number) => day + h * 60 + m;

type Key = { beat: BeatId; at: number; min: number; turns?: number };

export const CLOCK_KEYS: readonly Key[] = [
  { beat: "nightfall", at: 0.1, min: at(WED, 16, 5) },
  { beat: "nightfall", at: 1, min: at(WED, 23, 25), turns: 2 },
  { beat: "unfold", at: 1, min: at(WED, 23, 25) },
  { beat: "q3", at: 1, min: at(THU, 0, 10) },
  { beat: "votes", at: 0.04, min: at(THU, 0, 10) },
  { beat: "votes", at: 0.4, min: at(THU, 13, 10), turns: 3 },
  { beat: "dawn", at: 0, min: at(THU, 13, 10) },
  { beat: "dawn", at: 0.2, min: at(FRI, 6, 10), turns: 4 },
  { beat: "dawn", at: DAWN_WIPE, min: at(FRI, 6, 40) },
  { beat: "dawn", at: 0.92, min: at(FRI, 6, 58) },
  { beat: "seat", at: 0.3, min: at(FRI, 7, 3) },
  { beat: "seat", at: 1, min: at(FRI, 7, 6) },
];

/** Reduced motion: one still time per beat (the panel on screen). */
export const CLOCK_STILLS: Partial<Record<BeatId, number>> = {
  unfold: at(WED, 23, 25),
  q1: at(WED, 23, 35),
  q2: at(WED, 23, 50),
  q3: at(THU, 0, 5),
  votes: at(THU, 13, 10),
  dawn: at(FRI, 6, 40),
  seat: at(FRI, 7, 3),
};

type Seg = { p0: number; p1: number; m0: number; m1: number; a0: number; a1: number; jump: boolean };
let segs: Seg[] | null = null;

function build(): Seg[] {
  const out: Seg[] = [];
  let a = (CLOCK_KEYS[0].min % 60) * 6;
  for (let i = 1; i < CLOCK_KEYS.length; i++) {
    const k0 = CLOCK_KEYS[i - 1];
    const k1 = CLOCK_KEYS[i];
    const dm = k1.min - k0.min;
    const jump = k1.turns !== undefined;
    const da = jump ? (((dm % 60) + 60) % 60) * 6 + 360 * (k1.turns ?? 0) : dm * 6;
    out.push({ p0: beatPosition(k0.beat, k0.at), p1: beatPosition(k1.beat, k1.at), m0: k0.min, m1: k1.min, a0: a, a1: a + da, jump });
    a += da;
  }
  return out;
}

/** ease in-out (quad): a jump gathers speed and settles. */
const io = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export type ClockReading = {
  /** Story minutes since Wednesday 00:00. */
  min: number;
  /** Cumulative hand angles in degrees (0 = twelve o'clock). */
  hour: number;
  minute: number;
  /** True while a jump is running (the minute hand is spinning). */
  jump: boolean;
};

/** The clock at story position `pos` (story units). `out` is reused. */
export function clockAt(pos: number, out: ClockReading): ClockReading {
  if (!segs) segs = build();
  let s = segs[0];
  let u = 0;
  if (pos <= s.p0) u = 0;
  else {
    s = segs[segs.length - 1];
    u = 1;
    for (let i = 0; i < segs.length; i++) {
      const g = segs[i];
      if (pos < g.p1) {
        s = g;
        u = (pos - g.p0) / (g.p1 - g.p0 || 1);
        break;
      }
    }
  }
  const e = s.jump ? io(u) : u;
  out.min = s.m0 + (s.m1 - s.m0) * e;
  out.hour = out.min * 0.5;
  out.minute = s.a0 + (s.a1 - s.a0) * e;
  out.jump = s.jump && u > 0 && u < 1;
  return out;
}

/** Still hands for a time (reduced motion). */
export function stillAt(min: number, out: ClockReading): ClockReading {
  out.min = min;
  out.hour = min * 0.5;
  out.minute = (min % 60) * 6;
  out.jump = false;
  return out;
}

/** Day word and printed time for a minute count: ["Thu", "1:10 PM"]. */
export function printTime(min: number, days: readonly string[], am: string, pm: string): [string, string] {
  const whole = Math.floor(min + 1e-6);
  const day = days[Math.max(0, Math.min(days.length - 1, Math.floor(whole / 1440)))];
  const m = whole % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return [day, `${h12}:${mm < 10 ? "0" : ""}${mm} ${h24 < 12 ? am : pm}`];
}
