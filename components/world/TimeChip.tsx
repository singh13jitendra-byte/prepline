"use client";

import { useEffect, useRef } from "react";
import { storyCopy } from "@/lib/content";
import { BEATS, beatOf, beatPosition, clamp01, story, type BeatId, type StoryState } from "@/lib/story";
import { CLOCK_KEYS, CLOCK_STILLS, clockAt, printTime, stillAt, type ClockReading } from "./clock";
import "./time-chip.css";

/**
 * TIME CHIP (delight 7) — scroll moves the clock.
 *
 * A small desk clock on a slip, above the beat rail (desktop) or in the bottom-right corner,
 * opposite "Illustrative data" (phones). It comes in as night falls on the board (Wed 4:05 PM, the
 * minute the interview was booked) and is scrubbed by scroll through the prep, the jump to the
 * votes on the metro home and the time-lapse to Friday's sunrise (components/world/clock.ts).
 *
 * Two skins, one size: a night slip, and over it a paper slip that is shown below the Line while a
 * chapter changes (nightfall, dawn), so the Line wipes the chip from one skin to the other like
 * everything else. The cut is done with transforms only: an overflow box moved down by the cut and
 * its content moved back up by the same amount.
 *
 * Per frame, and only when a value changes: the root's opacity (in and out at the ends), the two
 * hand rotations and the printed time (a text node in a fixed-size, contained box) of the skin on
 * screen (both only while the Line crosses the chip), and the cut's two transforms during a wipe. Decorative: aria-hidden, never focusable; the copy already says
 * "Wednesday · 11:25 PM" and "Thursday · 1:10 PM".
 *
 * Reduced motion: the store does not run. The chip shows a still time for the panel at the middle
 * of the screen (CLOCK_STILLS; a panel holding several beats takes its earliest), changed only when
 * that panel changes: Wed 11:25 PM on the prep, Fri 7:03 AM on the seat.
 */

const C = storyCopy.dawn.clock;
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** From Friday 6:40 AM (the sunrise wipe) the chip is on paper. */
const DAY_FROM = 2880 + 6 * 60 + 40;
// Half-degree steps: 0.1px at the tip of a 13px hand, and about half the writes of 0.1deg.
const deg = (v: number) => `rotate(${(Math.round(v * 2) / 2).toFixed(1)}deg)`;

function Skin({ skin, className }: { skin: "night" | "day"; className: string }) {
  return (
    <div className={`tl-skin ${className}`} data-skin={skin}>
      <span className="tl-face">
        <svg className="tl-dial" viewBox="0 0 40 40" focusable="false" aria-hidden="true">
          <circle cx="20" cy="20" r="18.6" />
          <path d="M20 3.6v3.6M36.4 20h-3.6M20 36.4v-3.6M3.6 20h3.6" />
        </svg>
        <i className="tl-hand tl-hour" />
        <i className="tl-hand tl-min" />
        <i className="tl-pin" />
      </span>
      <span className="tl-text">
        <span className="tl-day">{C.days[0]}</span>
        <span className="tl-time">4:05 PM</span>
      </span>
    </div>
  );
}

export function TimeChip() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const night = el.querySelector<HTMLElement>('.tl-skin[data-skin="night"]');
    const cut = el.querySelector<HTMLElement>(".tl-cut");
    const cutIn = el.querySelector<HTMLElement>(".tl-cutin");
    // Each skin keeps its own last-written values, and only a skin that is on screen is written:
    // a skin coming back is brought up to date in the frame it reappears.
    const skins = [...el.querySelectorAll<HTMLElement>(".tl-skin")].map((k) => ({
      hour: k.querySelector<HTMLElement>(".tl-hour"),
      min: k.querySelector<HTMLElement>(".tl-min"),
      day: k.querySelector(".tl-day")?.firstChild as Text | null,
      time: k.querySelector(".tl-time")?.firstChild as Text | null,
      last: { h: "", m: "", day: "", time: "" },
    }));
    const reading: ClockReading = { min: 0, hour: 0, minute: 0, jump: false };
    const hands = (r: ClockReading, nightOn = true, dayOn = true) => {
      const h = deg(r.hour);
      const m = deg(r.minute);
      const [d, t] = printTime(r.min, C.days, C.am, C.pm);
      skins.forEach((k, i) => {
        if (!(i === 0 ? nightOn : dayOn)) return;
        const L = k.last;
        if (h !== L.h && k.hour) k.hour.style.transform = L.h = h;
        if (m !== L.m && k.min) k.min.style.transform = L.m = m;
        if (d !== L.day && k.day) k.day.data = L.day = d;
        if (t !== L.time && k.time) k.time.data = L.time = t;
      });
    };

    /* ── reduced motion: a still time per panel ── */
    if (story.reduced()) {
      const panels = [...document.querySelectorAll<HTMLElement>(".story-panel[data-beats]")];
      // A static panel can hold several beats (the prep is one panel): its time is its earliest beat's.
      const order = (b: string) => BEATS.findIndex((x) => x.id === b);
      const timeOf = (p: Element) => {
        const beats = (p.getAttribute("data-beats") ?? "").split(" ").filter((b) => CLOCK_STILLS[b as BeatId] !== undefined);
        beats.sort((x, y) => order(x) - order(y));
        return beats.length ? CLOCK_STILLS[beats[0] as BeatId] : undefined;
      };
      // The static prep panel has two dated groups ("Wednesday · 11:25 PM", "Thursday · 1:10 PM"):
      // while one of them is at the middle of the screen, the chip agrees with it.
      const groups = new Map<Element, number | undefined>();
      document.querySelectorAll(".prep-panel .prep-group").forEach((g, i) => groups.set(g, CLOCK_STILLS[i === 0 ? "unfold" : "votes"]));
      const on = new Set<Element>();
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => (e.isIntersecting ? on.add(e.target) : on.delete(e.target)));
          let min: number | undefined;
          on.forEach((p) => groups.has(p) && (min = min ?? groups.get(p)));
          on.forEach((p) => !groups.has(p) && (min = min ?? timeOf(p)));
          if (min === undefined) {
            el.removeAttribute("data-still");
            if (cut) cut.style.visibility = "";
          }
          else {
            hands(stillAt(min, reading));
            // Friday morning is day: the paper skin, uncut.
            const day = min >= DAY_FROM;
            if (night) night.style.visibility = day ? "hidden" : "";
            if (cut) cut.style.visibility = day ? "visible" : "";
            el.setAttribute("data-still", "");
          }
        },
        { rootMargin: "-50% 0px -50% 0px" },
      );
      panels.forEach((p) => timeOf(p) !== undefined && io.observe(p));
      groups.forEach((_, g) => io.observe(g));
      return () => io.disconnect();
    }

    /* ── motion ── */
    const first = CLOCK_KEYS[0];
    const inFrom = beatPosition(first.beat, 0);
    const inTo = beatPosition(first.beat, first.at + 0.02);
    const outFrom = beatPosition("footer", 0);
    const outTo = outFrom + beatOf("footer").vh * 0.05;
    // The chip's box on screen, read on resize only (never in the frame loop).
    let top = 0;
    let height = 0;
    // In the corner (phones, narrower desktops) the Line's margin note ("Ready") would sit under the
    // chip while the Line rests on the floor: the chip steps up by `lift` px then, and back down as
    // the Line leaves the floor.
    let lift = 0;
    let lifted = "";
    const measure = () => {
      const r = el.getBoundingClientRect();
      const cur = parseFloat(lifted) || 0;
      top = r.top + cur;
      height = r.height;
      const vh = story.get().viewport.h || window.innerHeight;
      lift = r.bottom + cur > vh * 0.75 ? Math.max(0, Math.ceil(r.bottom + cur - (vh - 30))) : 0;
      story.invalidate();
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    // Fonts change nothing (fixed box), but the first measure can precede the stylesheet on a cold load.
    const late = window.setTimeout(measure, 1200);

    let vis = "";
    let op = "";
    let nightVis = "";
    let cutVis = "";
    let cutY = "";
    const off = story.subscribe((s: Readonly<StoryState>) => {
      const o = ss(inFrom, inTo, s.pos) * (1 - ss(outFrom, outTo, s.pos));
      const v = o > 0.002 ? "visible" : "hidden";
      if (v !== vis) el.style.visibility = vis = v;
      if (v === "hidden") {
        // A child's own visibility:visible outvotes a hidden parent: hide the skins themselves too.
        if (nightVis !== "hidden" && night) night.style.visibility = nightVis = "hidden";
        if (cutVis !== "hidden" && cut) cut.style.visibility = cutVis = "hidden";
        return;
      }
      const ot = o >= 0.998 ? "1" : o.toFixed(3);
      if (ot !== op) el.style.opacity = op = ot;
      const up = lift ? Math.round(lift * ss(s.viewport.h - 70, s.viewport.h - 4, s.line.y)) : 0;
      const lt = String(up);
      if (lt !== lifted) {
        lifted = lt;
        el.style.transform = up ? `translate3d(0,${-up}px,0)` : "none";
      }
      // Day is below the Line: the paper skin shows from the cut down.
      const full = height + 10;
      const c = Math.round(Math.min(full, Math.max(0, s.dayTop - (top - up))));
      const nv = c > 0 ? "visible" : "hidden";
      const cv = c < full ? "visible" : "hidden";
      hands(clockAt(s.pos, reading), nv === "visible", cv === "visible");
      if (nv !== nightVis && night) night.style.visibility = nightVis = nv;
      if (cv !== cutVis && cut) cut.style.visibility = cutVis = cv;
      const y = cv === "visible" ? String(c) : cutY;
      if (y !== cutY && cut && cutIn) {
        cutY = y;
        cut.style.transform = c ? `translate3d(0,${c}px,0)` : "none";
        cutIn.style.transform = c ? `translate3d(0,${-c}px,0)` : "none";
      }
    });
    return () => {
      off();
      window.clearTimeout(late);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={root} className="tl" aria-hidden="true">
      <Skin skin="night" className="slip-night" />
      <div className="tl-cut">
        <div className="tl-cutin">
          <Skin skin="day" className="slip" />
        </div>
      </div>
    </div>
  );
}
