"use client";

/**
 * Beats 6 to 8 of Act II (storyboard 2.5): `saved`, `applied`, `interview`.
 * The board stays up (receding) through `hinge` and `nightfall`.
 *
 *   saved      scrub: column headers and rules draw in (first 40%); the Actor
 *              shrinks from the card into the Saved slot; the Line docks under
 *              Saved. On arrival (70%): the tile settles with a small overshoot,
 *              four ghost tiles fade in beneath it, the ledger ticks.
 *   applied    scrub: the tile lifts 6px (first 20%). Then the tile carries to
 *              Applied on a low arc and three ghosts follow 60ms apart; the chip
 *              flips to "Applied Tue"; the ledger reads "4 applied by you" and
 *              "0 sent by Prepline" pulses once. It never shows anything but 0.
 *   interview  the same lift, then the tile carries to Interview; the chip flips
 *              to "Thu 11:40" and a calendar tick draws; the Interview header turns accent.
 *
 * The board is a list of four lists. Its DOM is always the END state (one ghost
 * in Saved, three in Applied, the Role in Interview), which is also what the
 * static page shows; motion moves the ghosts there from where they start.
 *
 * Anchors: `col-saved`, `col-applied`, `col-interview` (the rule under each
 * header), `tile-saved`, `tile-applied`, `tile-interview` (tile face slots).
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FaceSlot } from "@/components/story/FaceSlot";
import { Panel } from "@/components/story/Stage";
import { rankedRoles, storyActs12, storyCopy } from "@/lib/content";
import { productData } from "@/components/product";
import { useAnchor, type AnchorId } from "@/lib/anchors";
import { ACTOR_TRACK, BEATS, story, travelEase, type BeatId, type StoryState } from "@/lib/story";
import { offsetIn, setMask, softBelow, span, tileShow, useActorExtra, usePerformanceAt, useScrub } from "../read/runtime";
import { boardHours, BOOKED_AT, clockLabel, DAYS, Odo, setOdo, SLOT_AT, sunAt } from "./timelapse";
import { ease } from "@/lib/theme";

const copy = storyCopy;
const L = copy.ledger;
const SAVED_AT = ACTOR_TRACK.saved?.range?.[1] ?? 0.7;
const APPLIED_AT = ACTOR_TRACK.applied?.range?.[0] ?? 0.2;
const INTERVIEW_AT = ACTOR_TRACK.interview?.range?.[0] ?? 0.2;
const idx = (id: BeatId) => BEATS.findIndex((b) => b.id === id);
function through(s: Readonly<StoryState>, id: BeatId) {
  const i = idx(s.beat);
  const m = idx(id);
  return i < m ? 0 : i > m ? 1 : s.beatProgress;
}

/** Ghosts: the other roles you saved. 1–3 follow the Role to Applied; 4 stays in Saved. */
const ghosts = rankedRoles.slice(1, 5);
/** The board's own row data for a ghost (the product Tile's date chip), by company. */
const ghostItem = (rank: number, stage: "saved" | "applied") => {
  const role = productData.roles[rank - 1];
  const known = productData.boardItems.find((b) => b.role.company === role.company);
  return { role, stage, date: known?.date ?? (stage === "saved" ? "Saved Mon" : "Applied Tue") };
};
const steps = [copy.saved.step, copy.applied.step, copy.interview.step].map((t) => {
  const cut = t.indexOf(". ");
  return { lead: t.slice(0, cut + 1), rest: t.slice(cut + 2) };
});
const COLS = [
  { key: "saved", name: copy.board.columns[0] },
  { key: "applied", name: copy.board.columns[1] },
  { key: "interview", name: copy.board.columns[2] },
  { key: "offer", name: copy.board.columns[3] },
] as const;

/** Board numbers. Each performance owns its own keys, so jumps never fight. */
const show = {
  savedIn: 0,
  savedOut: 0,
  appliedIn: 0,
  appliedOut: 0,
  interviewIn: 0,
  settle: 0,
};
const END = { ranked: L.interview.ranked, saved: L.interview.saved, applied: L.interview.applied };
const settleCurve = (x: number) => (x <= 0 || x >= 1 ? 0 : 3.2 * Math.sin(3 * Math.PI * x) * (1 - x) * (1 - x));

function Ghost({ role, k }: { role: (typeof ghosts)[number]; k: number }) {
  const item = ghostItem(role.rank, k === 4 ? "saved" : "applied");
  const title = storyActs12.board.ghostTitles[role.rank] ?? item.role.title;
  return (
    <li className="bd-ghost-li" data-ghost={k}>
      <div className="bd-ghost-shift">
        <div className="bd-ghost">
          <span className="sr-only">
            {item.role.title}, {item.role.company}. {item.date}. {item.role.score} out of 10 fit.
          </span>
          {/* The board's Tile at its small size, in the product's own classes: short title, company,
              numeral. A picture here: the list item carries the full text above. */}
          <div className="pp" data-skin="day" data-bare="" aria-hidden="true">
            <span className="pp-tile" data-kind={item.stage}>
              <span className="pp-tile-l1">
                <span className="pp-tile-title">{title}</span>
                <span className="pp-tile-n pp-num">{item.role.score}</span>
              </span>
              <span className="pp-tile-co">{item.role.company}</span>
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function Col({ col, children, count }: { col: (typeof COLS)[number]; children: React.ReactNode; count: number }) {
  const rule = useAnchor(`col-${col.key}` as AnchorId);
  return (
    <li className="bd-col" data-col={col.key}>
      {/* Leaves for the per-frame floor light, so a scroll frame restyles two empty elements, not the column. */}
      <i className="bd-col-warm" aria-hidden="true" />
      <i className="bd-col-breath" aria-hidden="true" />
      <h3 className="bd-col-h">
        <span className="bd-col-name">{col.name}</span>
        <span className="bd-count" data-count={col.key}>
          {count}
        </span>
      </h3>
      <span className="bd-col-hair" aria-hidden="true" />
      {col.key === "offer" ? <span className="bd-col-rule" aria-hidden="true" /> : <span ref={rule} className="bd-col-rule" aria-hidden="true" />}
      <ul className="bd-tiles">{children}</ul>
    </li>
  );
}

function WeekStrip() {
  const axis = useAnchor("board-days");
  return (
    <div className="bd-days" role="img" aria-label={storyActs12.board.daysLabel}>
      <div className="bd-days-now" aria-hidden="true">
        {/* Server and reduced-motion markup show the end of the week's story: booked on Wednesday. */}
        <span className="bd-days-clock" data-clock>
          {clockLabel(BOOKED_AT)}
        </span>
        {/* The booked slot. The Line's right end comes to rest under it. */}
        <span className="bd-days-slot" data-slot style={{ left: `${((SLOT_AT / (24 * DAYS.length)) * 100).toFixed(3)}%` }}>
          {storyActs12.board.slot}
        </span>
      </div>
      {/* `board-days`: five equal day cells; day i spans [i/5, (i+1)/5]. Its bottom edge is the time axis the Line rides. */}
      <ol ref={axis} className="bd-days-list" aria-hidden="true">
        {DAYS.map((d, i) => (
          <li key={d} className="bd-day" data-day={i}>
            {d}
          </li>
        ))}
        <li className="bd-days-dot" />
      </ol>
    </div>
  );
}

export function BoardPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const odo = useRef({ ranked: 0, saved: 0, applied: 0, pos: -1, movedAt: 0 });
  const targets = useRef<{
    copy: NodeListOf<HTMLElement>;
    obj: HTMLElement | null;
    fade: NodeListOf<HTMLElement>;
    now: NodeListOf<HTMLElement>;
    slot: HTMLElement | null;
    surface: HTMLElement | null;
    sun: NodeListOf<HTMLElement>;
    glow: NodeListOf<HTMLElement>;
  } | null>(null);
  const [layout, setLayout] = useState(0);
  const deltas = useRef({ g: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], g4: { x: 0, y: 0 }, up: { x: 0, y: 0 } });

  /* ── measure where the ghosts start (layout only) and rebuild on resize ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    let key = "";
    const measure = () => {
      const pos = (sel: string) => {
        const el = root.querySelector<HTMLElement>(sel);
        return el ? offsetIn(el, root) : null;
      };
      const small = window.matchMedia("(max-width: 767px)").matches;
      const g = [1, 2, 3].map((k) => {
        const a = pos(`[data-ph="${k}"]`);
        const b = pos(`[data-ghost="${k}"]`);
        return a && b ? { x: a.x - b.x, y: a.y - b.y } : { x: 0, y: 0 };
      });
      const g4 = pos(`[data-ghost="4"]`);
      const top = small ? pos(`[data-ph="1"]`) : pos(`[data-col="saved"] .bd-tile-li`);
      const d4 = g4 && top ? { x: top.x - g4.x, y: top.y - g4.y } : { x: 0, y: 0 };
      // When the Role leaves Applied, its three ghosts close the gap it leaves.
      const tileA = pos(`[data-col="applied"] .bd-tile-li`);
      const g1 = pos(`[data-ghost="1"]`);
      // On small screens the ghosts are bars beside the lane's tile: they stay put.
      const up = tileA && g1 && !small ? { x: 0, y: tileA.y - g1.y } : { x: 0, y: 0 };
      deltas.current = { g, g4: d4, up };
      // The Interview glow sits on the Interview column (from its `col-interview` rule down),
      // outside the board's fade so it survives the hinge and hands over to the Act III lamp.
      const obj = root.querySelector<HTMLElement>(".bd-obj");
      const col = root.querySelector<HTMLElement>('[data-col="interview"]');
      const glow = root.querySelector<HTMLElement>(".bd-glow");
      if (obj && col && glow) {
        const r = offsetIn(col, obj);
        Object.assign(glow.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      }
      // Where the surface's window sits: the Interview column, inside the board.
      const board = root.querySelector<HTMLElement>(".bd-board");
      const surface = root.querySelector<HTMLElement>(".bd-surface");
      if (board && col && surface) {
        const r = offsetIn(col, board);
        surface.style.setProperty("--wx", `${(r.x + 1).toFixed(1)}px`);
        surface.style.setProperty("--wy", `${(r.y + 1).toFixed(1)}px`);
        surface.style.setProperty("--ww", `${Math.max(0, r.w - 2).toFixed(1)}px`);
        surface.style.setProperty("--wh", `${Math.max(0, r.h - 2).toFixed(1)}px`);
      }
      const next = JSON.stringify(deltas.current);
      if (next !== key) {
        key = next;
        setLayout((n) => n + 1);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  /* ── numbers: one writer for every count on the board ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const el = (sel: string) => root.querySelector<HTMLElement>(sel);
    const targets = {
      cSaved: el("[data-count='saved']"),
      cApplied: el("[data-count='applied']"),
      cInterview: el("[data-count='interview']"),
    };
    const last: Record<string, string> = {};
    const put = (k: keyof typeof targets, v: number) => {
      const t = String(Math.round(v));
      if (last[k] === t) return;
      last[k] = t;
      const node = targets[k];
      if (node) node.textContent = t;
    };
    return story.frame("actor", () => {
      put("cSaved", show.savedIn - show.savedOut);
      put("cApplied", show.appliedIn - show.appliedOut);
      put("cInterview", show.interviewIn);
    });
  }, []);

  /* ── scrub: headers draw in, the board recedes at the hinge ── */
  useScrub((s) => {
    const root = rootRef.current;
    if (!root) return;
    const p = through(s, "saved");
    COLS.forEach((c, n) => {
      const v = span(p, 0.04 + n * 0.07, 0.26 + n * 0.07).toFixed(4);
      const col = root.querySelector<HTMLElement>(`[data-col="${c.key}"]`);
      if (col && col.style.getPropertyValue("--draw") !== v) col.style.setProperty("--draw", v);
    });
    // Per-frame custom properties go to the elements that read them (see board.css), never to the
    // panel root: a variable there is inherited by all 250 nodes and every one is restyled.
    const tg = (targets.current ??= {
      copy: root.querySelectorAll<HTMLElement>(".bd-copy"),
      obj: root.querySelector<HTMLElement>(".bd-obj"),
      fade: root.querySelectorAll<HTMLElement>(".bd-obj > :not(.bd-glow)"),
      now: root.querySelectorAll<HTMLElement>(".bd-days-clock, .bd-days-dot"),
      slot: root.querySelector<HTMLElement>("[data-slot]"),
      surface: root.querySelector<HTMLElement>(".bd-surface"),
      sun: root.querySelectorAll<HTMLElement>(".bd-sun"),
      glow: root.querySelectorAll<HTMLElement>(".bd-glow"),
    });
    const set = (els: NodeListOf<HTMLElement>, prop: string, v: string) => {
      els.forEach((el) => {
        if (el.style.getPropertyValue(prop) !== v) el.style.setProperty(prop, v);
      });
    };
    // Hinge, sequenced (review P1-A5): the board copy is gone by 12% (power2.in, faster than
    // any entry), the board itself steps back by 25%, then the sentence starts reading.
    const hp = through(s, "hinge");
    const out = span(hp, 0, 0.12);
    set(tg.copy, "--copy-out", (out * out).toFixed(4));
    // The board steps back and is gone by 20% of the hinge: the rest is the sentence and the tile.
    const rc = span(hp, 0, 0.14);
    const gone = span(hp, 0.02, 0.2);
    if (tg.obj) {
      const tf = `scale(${(1 - 0.08 * rc - 0.03 * hp).toFixed(4)})`;
      if (tg.obj.style.transform !== tf) tg.obj.style.transform = tf;
    }
    const op = (1 - gone * gone * (3 - 2 * gone)).toFixed(4);
    const vis = gone >= 1 ? "hidden" : "";
    tg.fade.forEach((el) => {
      if (el.style.opacity !== op) el.style.opacity = op;
      if (el.style.visibility !== vis) el.style.visibility = vis;
    });

    // While a wipe sweeps (day rises at daybreak, night falls at nightfall), the board inks in or
    // out through a 24px soft edge below the Line rather than being cut at it.
    setMask(root, s.line.sweep && (s.beat === "daybreak" || s.beat === "nightfall") ? softBelow(s.line.y) : "none");

    // The week, as a time-lapse: a clock and a "now" dot run along the strip, and the light
    // crosses the board with the time of day. Every pixel of scroll moves it.
    const hours = boardHours(s);
    const sun = sunAt(hours);
    set(tg.now, "--now", (hours / (24 * DAYS.length)).toFixed(5));
    set(tg.sun, "--sun-x", `${sun.x.toFixed(2)}%`);
    set(tg.sun, "--sun-y", `${sun.y.toFixed(2)}%`);
    set(tg.sun, "--sun-a", sun.a.toFixed(4));
    set(tg.sun, "--night", sun.night.toFixed(4));
    const clock = root.querySelector<HTMLElement>("[data-clock]");
    const label = clockLabel(hours);
    if (clock && clock.textContent !== label) {
      clock.textContent = label;
      clock.toggleAttribute("data-booked", hours >= BOOKED_AT - 1e-6);
    }
    const today = String(Math.min(DAYS.length - 1, Math.floor(hours / 24)));
    if (root.dataset.today !== today) root.dataset.today = today;

    // Ledger odometer: the digits roll with the scroll (and settle on whole digits at rest: see below).
    const sp = through(s, "saved");
    const ap = through(s, "applied");
    const applied = END.applied * span(ap, 0.25, 0.85);
    odo.current.ranked = END.ranked * span(sp, 0.08, 0.7);
    odo.current.saved = END.saved * span(sp, 0.2, 0.78);
    odo.current.applied = applied;
    if (s.pos !== odo.current.pos) {
      odo.current.pos = s.pos;
      odo.current.movedAt = performance.now();
    }
    const byYou = applied >= 0.5 ? "1" : "0";
    if (root.dataset.appliedByYou !== byYou) root.setAttribute("data-applied-by-you", byYou);

    // The Interview floor glows amber through `interview` and is out by 15% of the hinge. From there
    // the World carries the warmth as a small pool under the floating tile (review 2, P1-4).
    const ip = through(s, "interview");
    // The Interview floor turns translucent while the tile lands (p 0.2 to 0.7), so the World's
    // "iron filings" (day dust pulled into amber lanes in this column) read through it.
    if (tg.surface) {
      const w = (0.72 * span(ip, 0.2, 0.3) * (1 - span(ip, 0.6, 0.72))).toFixed(3);
      if (tg.surface.style.getPropertyValue("--win") !== w) tg.surface.style.setProperty("--win", w);
    }
    // The slot flag appears at the booking moment (60% of the beat), as the Line's right end arrives
    // at Thursday 11:40. Not earlier: until then the moving clock label would run into it on a
    // narrow strip. Once booked, the clock's text ends at the "now" dot and leaves the flag clear.
    if (tg.slot) {
      const v = span(ip, 0.6, 0.68).toFixed(3);
      if (tg.slot.style.opacity !== v) tg.slot.style.opacity = v;
    }
    set(tg.glow, "--glow", (span(ip, 0.25, 1) * 0.85 * (1 - span(hp, 0, 0.15))).toFixed(4));
  });

  /* ── odometer: rolls with the wheel, rests on whole digits ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const shown = { ranked: -1, saved: -1, applied: -1 };
    const ids = ["ranked", "saved", "applied"] as const;
    return story.frame("actor", (_t, dt) => {
      const o = odo.current;
      // 140ms without scroll counts as rest: each wheel then eases to the nearest whole digit.
      const still = performance.now() - o.movedAt > 140;
      for (const id of ids) {
        const goal = still ? Math.round(o[id]) : o[id];
        let v = shown[id];
        if (v < 0 || !still) v = goal;
        else {
          v += (goal - v) * Math.min(1, dt * 14);
          if (Math.abs(goal - v) < 0.004) v = goal;
        }
        if (v !== shown[id]) {
          shown[id] = v;
          setOdo(root, id, v);
        }
      }
    });
  }, []);

  /* ── breaths (Foundation helper): the arrival column keeps warming after the tile lands ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Registered on each column's empty breath leaf (the smallest element that reads them).
    const leaf = (col: string) => root.querySelector<HTMLElement>(`[data-col="${col}"] > .bd-col-breath`);
    const offs: (() => void)[] = [];
    const add = (col: string, beat: BeatId, from: number) => {
      const el = leaf(col);
      if (el) offs.push(story.breath(el, beat, { from, name: `--breath-${beat}` }));
    };
    add("saved", "saved", 0.7);
    add("saved", "applied", 0.45);
    add("applied", "applied", 0.45);
    add("applied", "interview", 0.45);
    add("interview", "interview", 0.45);
    return () => offs.forEach((off) => off());
  }, []);

  /* ── frame: column floors warm as the tile passes over them; ghosts spring aside ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const cols = Array.from(root.querySelectorAll<HTMLElement>(".bd-col"));
    const warmEls = cols.map((c) => c.querySelector<HTMLElement>(":scope > .bd-col-warm"));
    const ghosts = Array.from(root.querySelectorAll<HTMLElement>(".bd-ghost-shift"));
    const warm = cols.map(() => 0);
    const spring = ghosts.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    const last: string[] = [];
    const lastG: string[] = [];
    const visitedAt = { saved: idx("saved"), applied: idx("applied"), interview: idx("interview") } as const;
    return story.frame("actor", (_t, dt, s) => {
      const b = idx(s.beat);
      const a = s.actor;
      const onBoard = a.present && a.face === "tile" && b >= visitedAt.saved && b <= visitedAt.interview;
      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;
      const moving = onBoard && a.travel > 0 && a.travel < 1;
      // Reading layout here is limited to the travel windows (a few ghost rects, 0.8s at a time).
      const rects = moving || onBoard ? cols.map((c) => c.getBoundingClientRect()) : null;
      cols.forEach((c, n) => {
        const key = c.dataset.col as keyof typeof visitedAt | "offer";
        const visited = key !== "offer" && b > visitedAt[key] ? 0.3 : 0;
        let prox = 0;
        if (rects && onBoard) {
          const r = rects[n];
          const dx = Math.abs(ax - (r.left + r.width / 2)) / (r.width * 0.9);
          prox = ay > r.top - 40 && ay < r.bottom ? Math.max(0, 1 - dx) : 0;
        }
        const target = Math.max(visited, prox);
        warm[n] += (target - warm[n]) * Math.min(1, dt * 6);
        const v = warm[n].toFixed(3);
        if (last[n] !== v) {
          last[n] = v;
          const w = warmEls[n];
          if (w) w.style.opacity = v;
        }
      });
      ghosts.forEach((g, n) => {
        const sp = spring[n];
        let tx = 0;
        let ty = 0;
        if (moving) {
          const r = g.getBoundingClientRect();
          const dx = r.left + r.width / 2 - sp.x - ax;
          const dy = r.top + r.height / 2 - sp.y - ay;
          const d = Math.hypot(dx, dy) || 1;
          const reach = 150;
          if (d < reach) {
            const k = (1 - d / reach) * 6;
            tx = (dx / d) * k;
            ty = (dy / d) * k;
          }
        }
        const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          sp.vx += (-220 * (sp.x - tx) - 20 * sp.vx) * h;
          sp.vy += (-220 * (sp.y - ty) - 20 * sp.vy) * h;
          sp.x += sp.vx * h;
          sp.y += sp.vy * h;
        }
        const v = Math.abs(sp.x) < 0.02 && Math.abs(sp.y) < 0.02 ? "" : `${sp.x.toFixed(2)}px ${sp.y.toFixed(2)}px`;
        if (lastG[n] !== v) {
          lastG[n] = v;
          g.style.translate = v;
        }
      });
    });
  }, []);

  /* ── saved: the tile settles, the ghosts arrive, the ledger ticks ── */
  usePerformanceAt("saved", SAVED_AT, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    // Visual order in Saved: 1, 2, 3 (still at their start), then 4.
    const g = [1, 2, 3, 4].map((k) => root.querySelector<HTMLElement>(`[data-ghost="${k}"] .bd-ghost`)).filter(Boolean);
    tl.fromTo(show, { settle: 0 }, { settle: 1, duration: 0.6, ease: "none" }, 0)
      .fromTo(g, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: ease.out, stagger: 0.06 }, 0.08)
      .fromTo(show, { savedIn: 0 }, { savedIn: 5, duration: 0.6, ease: ease.outSoft }, 0.05);
  }, [layout]);

  /* ── applied: the tile carries, three ghosts follow, the chip flips ── */
  usePerformanceAt("applied", APPLIED_AT, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const steps = root.querySelector<HTMLElement>(".bd-steps");
    const zero = root.querySelector<HTMLElement>(".bd-zero");
    const d = deltas.current;
    [1, 2, 3].forEach((k, n) => {
      const li = root.querySelector<HTMLElement>(`[data-ghost="${k}"]`);
      if (!li) return;
      const { x: dx, y: dy } = d.g[n];
      const dist = Math.hypot(dx, dy);
      let nx = 0;
      let ny = 0;
      if (dist > 1) {
        nx = -dy / dist;
        ny = dx / dist;
        if (ny > 0) {
          nx = -nx;
          ny = -ny;
        }
      }
      const arc = 0.06 * dist;
      const t = { v: 0 };
      tl.fromTo(
        t,
        { v: 0 },
        {
          v: 1,
          duration: 0.8,
          ease: travelEase,
          onUpdate: () => {
            const e = t.v;
            const b = Math.sin(Math.PI * e) * arc;
            li.style.transform = `translate3d(${(dx * (1 - e) + nx * b).toFixed(2)}px, ${(dy * (1 - e) + ny * b).toFixed(2)}px, 0)`;
          },
        },
        0.06 + n * 0.06,
      );
    });
    const g4 = root.querySelector<HTMLElement>(`[data-ghost="4"]`);
    if (g4) tl.fromTo(g4, { x: 0, y: 0 }, { x: d.g4.x, y: d.g4.y, duration: 0.6, ease: ease.out }, 0.4);
    tl.fromTo(tileShow, { applied: 0 }, { applied: 1, duration: 0.36, ease: ease.inOut }, 0.42)
      .fromTo(show, { savedOut: 0, appliedIn: 0 }, { savedOut: 4, appliedIn: 4, duration: 0.5, ease: ease.outSoft }, 0.3);
    if (steps) tl.fromTo(steps, { "--sa": 0 }, { "--sa": 1, duration: 0.5, ease: ease.inOut }, 0.1);
    // "0 sent by Prepline": a pine underline is drawn under it once, and stays.
    if (zero) tl.fromTo(zero, { "--pulse": 0 }, { "--pulse": 1, duration: 0.35, ease: ease.inOut }, 0.72);
  }, [layout]);

  /* ── interview: the tile carries, the chip becomes a booking ── */
  usePerformanceAt("interview", INTERVIEW_AT, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const steps = root.querySelector<HTMLElement>(".bd-steps");
    const head = root.querySelector<HTMLElement>(`[data-col="interview"]`);
    tl.fromTo(tileShow, { interview: 0 }, { interview: 1, duration: 0.36, ease: ease.inOut }, 0.42)
      .fromTo(tileShow, { tick: 0 }, { tick: 1, duration: 0.4, ease: ease.outSoft }, 0.7)
      .fromTo(show, { appliedOut: 0, interviewIn: 0 }, { appliedOut: 1, interviewIn: 1, duration: 0.3, ease: "none" }, 0.5);
    if (head) tl.fromTo(head, { "--hi": 0 }, { "--hi": 1, duration: 0.5, ease: ease.outSoft }, 0.62);
    const shifts = [1, 2, 3].map((k) => root.querySelector<HTMLElement>(`[data-ghost="${k}"] .bd-ghost-shift`)).filter(Boolean);
    const up = deltas.current.up;
    tl.fromTo(shifts, { x: 0, y: 0 }, { x: up.x, y: up.y, duration: 0.6, ease: ease.out, stagger: 0.05 }, 0.35);
    if (steps) tl.fromTo(steps, { "--si": 0 }, { "--si": 1, duration: 0.5, ease: ease.inOut }, 0.1);
  }, [layout]);

  /* ── the Actor: anticipation lift, landing settle, pointer tilt ── */
  useActorExtra((s) => {
    const b = s.beat;
    if (b === "hinge") {
      // Breath: once lifted off the board, the tile turns slowly toward the sentence and rises.
      const d = span(s.beatProgress, 0.3, 1);
      return { ry: -8 * d, rx: 3 * d, ty: -14 * d, lift: 0.6 + 0.4 * d };
    }
    if (b !== "saved" && b !== "applied" && b !== "interview") return null;
    let ty = 0;
    let lift = 0;
    if (b === "saved") ty = settleCurve(show.settle);
    else {
      const antic = span(s.beatProgress, 0, b === "applied" ? APPLIED_AT : INTERVIEW_AT);
      const travel = s.actor.travel;
      ty = -6 * antic * (1 - travel);
      lift = antic * (1 - travel);
    }
    let rx = 0;
    let ry = 0;
    const a = s.actor;
    if (s.pointer.fine && s.pointer.inside && a.present && (a.travel >= 1 || b === "saved")) {
      const nx = (s.pointer.x - (a.x + a.w / 2)) / (a.w / 2);
      const ny = (s.pointer.y - (a.y + a.h / 2)) / (a.h / 2);
      if (Math.abs(nx) <= 1.15 && Math.abs(ny) <= 1.15) {
        rx = -Math.max(-1, Math.min(1, ny)) * 3;
        ry = Math.max(-1, Math.min(1, nx)) * 3;
      }
    }
    return { ty, lift, rx, ry };
  });

  /* ── pointer: ghosts ease away from the cursor ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const board = root.querySelector<HTMLElement>(".bd-board");
    if (!board) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".bd-ghost"));
    let raf = 0;
    let px = -1e4;
    let py = -1e4;
    const cur = els.map(() => ({ x: 0, y: 0 }));
    const step = () => {
      raf = 0;
      let moving = false;
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - cur[i].x;
        const cy = r.top + r.height / 2 - cur[i].y;
        const dx = cx - px;
        const dy = cy - py;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = 130;
        const k = dist < reach ? (1 - dist / reach) * 4 : 0;
        const tx = (dx / dist) * k;
        const ty = (dy / dist) * k;
        cur[i].x += (tx - cur[i].x) * 0.18;
        cur[i].y += (ty - cur[i].y) * 0.18;
        if (Math.abs(tx - cur[i].x) > 0.02 || Math.abs(ty - cur[i].y) > 0.02) moving = true;
        el.style.translate = `${cur[i].x.toFixed(2)}px ${cur[i].y.toFixed(2)}px`;
      });
      if (moving) raf = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => {
      px = py = -1e4;
      if (!raf) raf = requestAnimationFrame(step);
    };
    board.addEventListener("pointermove", onMove);
    board.addEventListener("pointerleave", onLeave);
    return () => {
      board.removeEventListener("pointermove", onMove);
      board.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const ledgerEnd = L.interview;
  return (
    <Panel beats={["saved", "applied", "interview", "hinge"]} className="bd-panel">
      <div ref={rootRef} className="bd-root" data-applied-by-you="1">
        <div className="bd-grid bd-split">
          <div className="bd-copy">
            <h2 id="board-title" className="bd-h2">
              {copy.board.h2}
            </h2>
            <ol className="bd-steps" style={{ "--sa": 1, "--si": 1 } as CSSProperties}>
              {steps.map((st, i) => (
                <li key={i} className="bd-step" data-step={i + 1}>
                  <span className="bd-step-n" aria-hidden="true" />
                  <p className="bd-step-t">
                    <b>{st.lead}</b> {st.rest}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="bd-obj">
            <p className="bd-ledger">
              <span className="bd-ledger-i">
                <Odo id="ranked" end={ledgerEnd.ranked} digits={2} /> {L.labels.ranked}
              </span>
              <span className="bd-dot" aria-hidden="true">
                ·
              </span>
              <span className="bd-ledger-i">
                <Odo id="saved" end={ledgerEnd.saved} digits={1} /> {L.labels.saved}
              </span>
              <span className="bd-dot" aria-hidden="true">
                ·
              </span>
              <span className="bd-ledger-i bd-ledger-applied">
                <Odo id="applied" end={ledgerEnd.applied} digits={1} />{" "}
                <span className="bd-lbl">
                  {L.saved.appliedLabel}
                  <span className="bd-lbl-b">{L.applied.appliedLabel.slice(L.saved.appliedLabel.length)}</span>
                </span>
              </span>
              <span className="bd-dot bd-dot-last" aria-hidden="true">
                ·
              </span>
              <span className="bd-br" aria-hidden="true" />
              <span className="bd-ledger-i bd-zero">
                {ledgerEnd.sentByPrepline} {L.labels.sent}
              </span>
            </p>

            <WeekStrip />
            <div className="bd-glow" aria-hidden="true" />

            <div className="bd-board">
              {/* The board's white surface, as a leaf: it opens a translucent window over the Interview
                  column while the tile lands, so the World's amber lanes read through the floor. */}
              <div className="bd-surface" aria-hidden="true" />
              <div className="bd-sun" aria-hidden="true" />
              <p className="bd-board-title">{copy.board.title}</p>
              <ul className="bd-cols" aria-label={copy.board.title}>
                <Col col={COLS[0]} count={1}>
                  <li className="bd-tile-li only-motion">
                    <FaceSlot anchor="tile-saved" face="tile" skin="day" showWhenStatic={false} />
                  </li>
                  {[1, 2, 3].map((k) => (
                    <li key={k} className="bd-ph only-motion" data-ph={k} aria-hidden="true" />
                  ))}
                  <Ghost role={ghosts[3]} k={4} />
                </Col>
                <Col col={COLS[1]} count={3}>
                  <li className="bd-tile-li only-motion">
                    <FaceSlot anchor="tile-applied" face="tile" skin="day" showWhenStatic={false} />
                  </li>
                  {ghosts.slice(0, 3).map((g, n) => (
                    <Ghost key={g.rank} role={g} k={n + 1} />
                  ))}
                </Col>
                <Col col={COLS[2]} count={1}>
                  <li className="bd-tile-li">
                    <FaceSlot anchor="tile-interview" face="tile" skin="day" />
                  </li>
                </Col>
                <Col col={COLS[3]} count={0}>
                  <li className="bd-empty">{productData.stages[3].empty}</li>
                </Col>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
