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
import { rankedRoles, storyCopy } from "@/lib/content";
import { useAnchor, type AnchorId } from "@/lib/anchors";
import { ACTOR_TRACK, BEATS, story, travelEase, type BeatId, type StoryState } from "@/lib/story";
import { offsetIn, span, tileShow, useActorExtra, usePerformanceAt, useScrub } from "../read/runtime";

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
  ranked: 0,
  saved: 0,
  applied: 0,
  savedIn: 0,
  savedOut: 0,
  appliedIn: 0,
  appliedOut: 0,
  interviewIn: 0,
  label: 0,
  settle: 0,
};
const END = { ranked: L.interview.ranked, saved: L.interview.saved, applied: L.interview.applied };
const settleCurve = (x: number) => (x <= 0 || x >= 1 ? 0 : 3.2 * Math.sin(3 * Math.PI * x) * (1 - x) * (1 - x));

function Ghost({ role, k }: { role: (typeof ghosts)[number]; k: number }) {
  return (
    <li className="bd-ghost-li" data-ghost={k}>
      <div className="bd-ghost-shift">
      <div className="bd-ghost">
        <span className="bd-ghost-ini" aria-hidden="true">
          {role.initials}
        </span>
        <span className="bd-ghost-main">
          <span className="bd-ghost-title">{role.title}</span>
          <span className="bd-ghost-co">{role.company}</span>
        </span>
        <span className="bd-ghost-score">
          <span className="sr-only">, scored </span>
          {role.score}
          {copy.ranked.scoreSuffix}
        </span>
      </div>
      </div>
    </li>
  );
}

function Col({ col, children, count }: { col: (typeof COLS)[number]; children: React.ReactNode; count: number }) {
  const rule = useAnchor(`col-${col.key}` as AnchorId);
  return (
    <li className="bd-col" data-col={col.key}>
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

export function BoardPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
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
      ranked: el("[data-l='ranked']"),
      saved: el("[data-l='saved']"),
      applied: el("[data-l='applied']"),
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
      put("ranked", show.ranked);
      put("saved", show.saved);
      put("applied", show.applied);
      put("cSaved", show.savedIn - show.savedOut);
      put("cApplied", show.appliedIn - show.appliedOut);
      put("cInterview", show.interviewIn);
      const lbl = show.label >= 0.5 ? "1" : "0";
      if (last.label !== lbl) {
        last.label = lbl;
        root.setAttribute("data-applied-by-you", lbl);
      }
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
    const rc = span(through(s, "hinge"), 0, 0.3).toFixed(4);
    if (root.style.getPropertyValue("--rc") !== rc) root.style.setProperty("--rc", rc);
  });

  /* ── saved: the tile settles, the ghosts arrive, the ledger ticks ── */
  usePerformanceAt("saved", SAVED_AT, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    // Visual order in Saved: 1, 2, 3 (still at their start), then 4.
    const g = [1, 2, 3, 4].map((k) => root.querySelector<HTMLElement>(`[data-ghost="${k}"] .bd-ghost`)).filter(Boolean);
    tl.fromTo(show, { settle: 0 }, { settle: 1, duration: 0.6, ease: "none" }, 0)
      .fromTo(g, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.06 }, 0.08)
      .fromTo(show, { ranked: 0, saved: 0, savedIn: 0 }, { ranked: END.ranked, saved: END.saved, savedIn: 5, duration: 0.6, ease: "power2.out" }, 0.05);
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
    if (g4) tl.fromTo(g4, { x: 0, y: 0 }, { x: d.g4.x, y: d.g4.y, duration: 0.6, ease: "expo.out" }, 0.4);
    tl.fromTo(tileShow, { applied: 0 }, { applied: 1, duration: 0.36, ease: "power2.inOut" }, 0.42)
      .fromTo(show, { applied: 0, savedOut: 0, appliedIn: 0 }, { applied: END.applied, savedOut: 4, appliedIn: 4, duration: 0.5, ease: "power2.out" }, 0.3)
      .fromTo(show, { label: 0 }, { label: 1, duration: 0.01 }, 0.4);
    if (steps) tl.fromTo(steps, { "--sa": 0 }, { "--sa": 1, duration: 0.5, ease: "power2.inOut" }, 0.1);
    if (zero) tl.fromTo(zero, { "--pulse": 0 }, { "--pulse": 1, duration: 0.18, ease: "power2.out" }, 0.72).to(zero, { "--pulse": 0, duration: 0.5, ease: "power2.in" }, ">");
  }, [layout]);

  /* ── interview: the tile carries, the chip becomes a booking ── */
  usePerformanceAt("interview", INTERVIEW_AT, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const steps = root.querySelector<HTMLElement>(".bd-steps");
    const head = root.querySelector<HTMLElement>(`[data-col="interview"]`);
    tl.fromTo(tileShow, { interview: 0 }, { interview: 1, duration: 0.36, ease: "power2.inOut" }, 0.42)
      .fromTo(tileShow, { tick: 0 }, { tick: 1, duration: 0.4, ease: "power2.out" }, 0.7)
      .fromTo(show, { appliedOut: 0, interviewIn: 0 }, { appliedOut: 1, interviewIn: 1, duration: 0.3, ease: "none" }, 0.5);
    if (head) tl.fromTo(head, { "--hi": 0 }, { "--hi": 1, duration: 0.5, ease: "power2.out" }, 0.62);
    const shifts = [1, 2, 3].map((k) => root.querySelector<HTMLElement>(`[data-ghost="${k}"] .bd-ghost-shift`)).filter(Boolean);
    const up = deltas.current.up;
    tl.fromTo(shifts, { x: 0, y: 0 }, { x: up.x, y: up.y, duration: 0.6, ease: "expo.out", stagger: 0.05 }, 0.35);
    if (steps) tl.fromTo(steps, { "--si": 0 }, { "--si": 1, duration: 0.5, ease: "power2.inOut" }, 0.1);
  }, [layout]);

  /* ── the Actor: anticipation lift, landing settle, pointer tilt ── */
  useActorExtra((s) => {
    const b = s.beat;
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
                  <span className="bd-step-n" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
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
                <span data-l="ranked">{ledgerEnd.ranked}</span> {L.labels.ranked}
              </span>
              <span className="bd-dot" aria-hidden="true">
                ·
              </span>
              <span className="bd-ledger-i">
                <span data-l="saved">{ledgerEnd.saved}</span> {L.labels.saved}
              </span>
              <span className="bd-dot" aria-hidden="true">
                ·
              </span>
              <span className="bd-ledger-i bd-ledger-applied">
                <span data-l="applied">{ledgerEnd.applied}</span>{" "}
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

            <div className="bd-board">
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
                  <li className="bd-empty" aria-hidden="true" />
                </Col>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
