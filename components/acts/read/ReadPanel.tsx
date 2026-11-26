"use client";

/**
 * Beats 2 to 5 of Act I (storyboard 2.4): `pass1`, `pass2`, `ranked`, `reason`.
 * One panel, three layers that hand over to each other in place:
 *
 *   pass layer    the counter. Revealed below the rising Line at the end of `hero`
 *                 (the Line swaps the headline for the count). Scrub-exact:
 *                 2,340 → 186 over pass1, 186 → 12 over pass2, gold at 12.
 *                 The statement swaps when the Line reaches the end of each pass.
 *   ranked layer  H2 left; list header, `ranked-rule` and the <ol> of 12 rows right.
 *                 In the first 20% of `ranked` the counter flies into the list
 *                 header ("12 fit your portfolio"). On entry the rows land in rank
 *                 order (40ms apart), each growing from its gold dot to a bar.
 *   reason layer  H2 left; the `card` slot centred over the list. Row 1 (the Actor)
 *                 lifts out and becomes the card in the first 35%; when it lands the
 *                 card counts to 9, the Line fills the meter to 90%, the chips type,
 *                 then the privacy line arrives. The card tilts toward the pointer.
 *
 * Static (reduced motion): the three figures side by side, then the ranked list,
 * then the reason card with its chips. No counting, no typing.
 *
 * World timing contract (for the speck flight): rows land at
 * RANK_LAND_START + i * RANK_STAGGER seconds after `ranked` entry (i = 0 for row 1).
 */

import { useEffect, useRef, type CSSProperties } from "react";
import { FaceSlot } from "@/components/story/FaceSlot";
import { Panel } from "@/components/story/Stage";
import { rankedRoles, storyCopy, type RankedRole } from "@/lib/content";
import { registerAnchor, useAnchor, type AnchorId } from "@/lib/anchors";
import { usePerformance } from "@/lib/perform";
import { ACTOR_TRACK, BEATS, story, type BeatId, type StoryState } from "@/lib/story";
import { getRow1Hover, RowView, setRow1Hover } from "./RowView";
import { cardShow, offsetIn, setMask, softAbove, span, useActorExtra, usePerformanceAt, useScrub } from "./runtime";

/**
 * Flight contract with the World (review P1-W3): gold speck i leaves at 0.05·i s, flies 0.55 s
 * and lands as a full-row bar at 0.55 + 0.05·i s. DOM row i fades in over it at
 * RANK_LAND_START + i * RANK_STAGGER = 0.65 + 0.05·i s, over RANK_FADE.
 */
export const RANK_LAND_START = 0.65;
/** Seconds between rows landing. */
export const RANK_STAGGER = 0.05;
/** Seconds each DOM row takes to fade in over its landed bar. */
export const RANK_FADE = 0.18;
/** Beat progress at which the reason card finishes its travel (ACTOR_TRACK.reason.range[1]). */
const REASON_AT = ACTOR_TRACK.reason?.range?.[1] ?? 0.35;
const BIRTH = ACTOR_TRACK.ranked?.fadeIn ?? [0.22, 0.34];

const fig = storyCopy.common.figures;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const idx = (id: BeatId) => BEATS.findIndex((b) => b.id === id);
const DAYBREAK = idx("daybreak");
const I = { hero: idx("hero"), pass1: idx("pass1"), pass2: idx("pass2"), ranked: idx("ranked"), reason: idx("reason") };
/** Progress through beat `id`: 0 before it, 1 after it. */
function through(s: Readonly<StoryState>, id: keyof typeof I) {
  const i = idx(s.beat);
  return i < I[id] ? 0 : i > I[id] ? 1 : s.beatProgress;
}
const headerMatch = storyCopy.ranked.listHeader.match(/^(\d+)\s+(.*)$/);
const HEADER_N = headerMatch?.[1] ?? "12";
const HEADER_T = headerMatch?.[2] ?? storyCopy.ranked.listHeader;
const passLabels = [storyCopy.pass1.lineLabel, storyCopy.pass2.lineLabel];

/* ─────────────────────────────────────────────────────────── pieces ── */

function Lines({ text, className }: { text: string; className?: string }) {
  // Headings rise from a mask, word group by word group. One mask per word keeps wraps natural.
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={className} style={{ "--wn": text.split(" ").length } as CSSProperties}>
        {text.split(" ").map((w, i) => (
          <span key={i}>
            <span className="rd-wmask" style={{ "--wi": i } as CSSProperties}>
              <span className="rd-w" data-w>
                {w}
              </span>
            </span>{" "}
          </span>
        ))}
      </span>
    </>
  );
}

function DomRow({ role }: { role: RankedRole }) {
  return (
    <div className="pl-row-box" data-skin="night">
      <div className="pl-row-chrome" />
      <div className="pl-row-scale">
        <RowView role={role} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── panel ── */

export function ReadPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const stmtRef = useRef<HTMLSpanElement>(null);
  const headNRef = useRef<HTMLSpanElement>(null);
  const headTRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const row1Ref = useRef<HTMLLIElement>(null);
  const rule = useAnchor("ranked-rule");
  // Breaths (Foundation helper): the list keeps drifting up through ranked and reason.
  const targets = useRef<{
    k: NodeListOf<HTMLElement>;
    fly: NodeListOf<HTMLElement>;
    head: NodeListOf<HTMLElement>;
    digits: NodeListOf<HTMLElement>;
    stmt: NodeListOf<HTMLElement>;
    ranked: NodeListOf<HTMLElement>;
    reason: NodeListOf<HTMLElement>;
    list: HTMLElement | null;
  } | null>(null);
  const morph = useRef({ dn: { x: 0, y: 0, s: 1 }, st: { x: 0, y: 0, s: 1 } });

  /* ── rows 2..12 anchors; on small screens rows 7..12 hide and their specks land on "and 6 more" ── */
  useEffect(() => {
    const list = listRef.current;
    const more = moreRef.current;
    if (!list || !more) return;
    const mq = window.matchMedia("(max-width: 767px)");
    let offs: (() => void)[] = [];
    const bind = () => {
      offs.forEach((off) => off());
      offs = [];
      for (let n = 2; n <= 12; n++) {
        const row = list.querySelector<HTMLElement>(`[data-row="${n}"] .pl-row-box`);
        const el = mq.matches && n > 6 ? more : row;
        if (el) offs.push(registerAnchor(`row-${n}` as AnchorId, el));
      }
    };
    bind();
    mq.addEventListener("change", bind);
    // One scale for every DOM row, so they match the row-1 face slot exactly.
    const ro = new ResizeObserver(() => {
      const w = list.clientWidth;
      list.style.setProperty("--row-s", (Math.min(w, 440) / 440).toFixed(4));
    });
    ro.observe(list);
    return () => {
      mq.removeEventListener("change", bind);
      offs.forEach((off) => off());
      ro.disconnect();
    };
  }, []);

  /* ── measure the counter → list header flight (layout only; transforms ignored) ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const measure = () => {
      const d = digitsRef.current;
      const st = stmtRef.current;
      const hn = headNRef.current;
      const ht = headTRef.current;
      if (!d || !st || !hn || !ht) return;
      const a = offsetIn(d, root);
      const b = offsetIn(hn, root);
      const fa = parseFloat(getComputedStyle(d).fontSize) || 1;
      const fb = parseFloat(getComputedStyle(hn).fontSize) || 1;
      const s1 = fb / fa;
      morph.current.dn = { x: b.x - a.x, y: b.y + b.h / 2 - (a.y + (a.h * s1) / 2), s: s1 };
      const c = offsetIn(st, root);
      const e = offsetIn(ht, root);
      const fc = parseFloat(getComputedStyle(st).fontSize) || 1;
      const fe = parseFloat(getComputedStyle(ht).fontSize) || 1;
      const s2 = fe / fc;
      morph.current.st = { x: e.x - c.x, y: e.y + e.h / 2 - (c.y + (c.h * s2) / 2), s: s2 };
      story.invalidate();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  /* ── scrub ── */
  useScrub((s) => {
    const root = rootRef.current;
    const pass = passRef.current;
    if (!root || !pass) return;
    const set = (el: HTMLElement | null, prop: string, v: string) => {
      if (el && el.style.getPropertyValue(prop) !== v) el.style.setProperty(prop, v);
    };
    // Per-frame custom properties go to the few elements that read them (see read.css), never to
    // the panel root, where every node of the act would inherit and be restyled.
    const tg = (targets.current ??= {
      k: root.querySelectorAll<HTMLElement>(".rd-detail, .rd-pass-marks"),
      fly: root.querySelectorAll<HTMLElement>(".rd-digits, .rd-stmt-fly"),
      head: root.querySelectorAll<HTMLElement>(".rd-list-head, .rd-rule"),
      digits: root.querySelectorAll<HTMLElement>(".rd-digits"),
      stmt: root.querySelectorAll<HTMLElement>(".rd-stmt-fly"),
      ranked: root.querySelectorAll<HTMLElement>(".rd-copy-ranked"),
      reason: root.querySelectorAll<HTMLElement>(".rd-copy-reason"),
      list: root.querySelector<HTMLElement>(".rd-list-wrap"),
    });
    const setAll = (els: NodeListOf<HTMLElement>, prop: string, v: string) => els.forEach((el) => set(el, prop, v));

    // Hero: the counter inks in below the rising Line (a 24px soft edge, not a guillotine),
    // and rises 12vh to its rest while it does, so it never sits under the outgoing headline.
    const h = through(s, "hero");
    const i = idx(s.beat);
    const revealing = i === I.hero;
    const ly = s.line.y;
    // The ink edge trails the Line by a tenth of the screen, so the outgoing "right roles." (erased
    // at the Line) and the incoming 2,340 never touch: there is always clear night between them.
    const gap = 0.1 * s.viewport.h;
    const mask = !revealing ? "none" : h > 0.22 ? `linear-gradient(to bottom, transparent ${(ly + gap).toFixed(1)}px, #000 ${(ly + gap + 40).toFixed(1)}px)` : "linear-gradient(transparent, transparent)";
    if (pass.dataset.mask !== mask) {
      pass.dataset.mask = mask;
      pass.style.setProperty("-webkit-mask-image", mask);
      pass.style.setProperty("mask-image", mask);
    }
    set(pass, "--reveal-a", revealing ? span(h, 0.22, 0.4).toFixed(4) : "1");
    set(pass, "--reveal-y", `${(revealing ? (1 - span(h, 0.3, 1)) * 0.12 * s.viewport.h : 0).toFixed(2)}px`);

    // The count, exact to the Line.
    const p1 = through(s, "pass1");
    const p2 = through(s, "pass2");
    // Clamped for the first 2% so a landing a hair inside the beat still reads 2,340 (review P2-3).
    const value = p2 > 0 ? fig.level - (fig.level - fig.fit) * p2 : fig.read - (fig.read - fig.level) * span(p1, 0.02, 1);
    const n = Math.round(value);
    const d = digitsRef.current;
    if (d && d.dataset.n !== String(n)) {
      d.dataset.n = String(n);
      d.textContent = fmt(n);
      d.toggleAttribute("data-gold", n === fig.fit);
    }
    set(pass, "--p1", p1.toFixed(4));
    const which = i <= I.hero ? "0" : p1 >= 1 ? "2" : "1";
    set(pass, "--marks", span(p1, 0.05, 0.14).toFixed(4));
    if (pass.dataset.pass !== which) pass.dataset.pass = which;
    set(pass, "--p2", p2.toFixed(4));

    // Ranked: the counter flies into the list header; the H2 rises.
    const r = through(s, "ranked");
    // 60vh beat: the counter is in the header by 15%, before the line starts docking (0.40).
    const k = span(r, 0, 0.15);
    const m = morph.current;
    setAll(tg.k, "--k", k.toFixed(4));
    // The flying "12 fit your portfolio" and the list header are the same words: the header takes
    // over only when the flyer has landed and gone, so the phrase is never on screen twice.
    setAll(tg.fly, "--k-fly", (1 - span(k, 0.88, 0.97)).toFixed(4));
    setAll(tg.head, "--k-head", span(k, 0.97, 1).toFixed(4));
    setAll(tg.digits, "--dn-x", `${(m.dn.x * k).toFixed(2)}px`);
    setAll(tg.digits, "--dn-y", `${(m.dn.y * k).toFixed(2)}px`);
    setAll(tg.digits, "--dn-s", (1 + (m.dn.s - 1) * k).toFixed(4));
    setAll(tg.stmt, "--st-x", `${(m.st.x * k).toFixed(2)}px`);
    setAll(tg.stmt, "--st-y", `${(m.st.y * k).toFixed(2)}px`);
    setAll(tg.stmt, "--st-s", (1 + (m.st.s - 1) * k).toFixed(4));
    setAll(tg.ranked, "--h2a", span(r, 0.05, 0.2).toFixed(4));
    setAll(tg.ranked, "--b2a", span(r, 0.1, 0.26).toFixed(4));

    // Row 1 before the Actor is born: the real row shows, then hands over.
    const birth = i === I.ranked ? span(r, BIRTH[0], BIRTH[1]) : i > I.ranked ? 1 : 0;
    const row1 = row1Ref.current;
    if (row1) {
      row1.toggleAttribute("data-prebirth", i <= I.ranked && birth < 1);
      set(row1, "--birth", birth.toFixed(4));
    }

    // Daybreak: the night copy inks out through a 24px soft edge above the rising Line.
    setMask(root, s.line.sweep && s.beat === "daybreak" ? softAbove(s.line.y) : "none");
    // ...and is gone by 30% of the wipe (power2.in), so the line crosses only the night and the card.
    const dk = i === DAYBREAK ? span(s.beatProgress, 0.04, 0.3) : i > DAYBREAK ? 1 : 0;
    const dop = (1 - dk * dk).toFixed(3);
    if (root.style.opacity !== dop) root.style.opacity = dop;

    // Reason: the list falls back, the copy swaps.
    const q = through(s, "reason");
    const j = span(q, 0, REASON_AT);
    // The list: it breathes up through `ranked` and `reason`, and falls back behind the card.
    // One inline transform and opacity on the wrapper (it holds all twelve rows).
    if (tg.list) {
      const y = 10 - 22 * story.breathOf("ranked", 0.15) - 10 * story.breathOf("reason", 0);
      const tf = `translate3d(0,${y.toFixed(2)}px,0) scale(${(1 - 0.04 * j).toFixed(4)})`;
      if (tg.list.style.transform !== tf) tg.list.style.transform = tf;
      // Behind the card the list falls well back; on small screens the card covers it, so it goes entirely.
      const op = (1 - (s.flags.small ? 1 : 0.8) * j).toFixed(4);
      if (tg.list.style.opacity !== op) tg.list.style.opacity = op;
    }
    // Reason breath: after the card lands, its chips are read one by one.
    cardShow.focus = i === I.reason && q >= REASON_AT ? span(q, REASON_AT + 0.08, 0.98) * 3 : i > I.reason ? 3 : -1;
    setAll(tg.ranked, "--out", span(q, 0, 0.12).toFixed(4));
    setAll(tg.reason, "--in", span(q, 0.08, 0.22).toFixed(4));
    setAll(tg.reason, "--in2", span(q, 0.13, 0.27).toFixed(4));
  });

  /* ── statement swaps: when the Line reaches the end of each pass ── */
  usePerformanceAt("pass1", 0.97, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const out = root.querySelectorAll("[data-swap-out='1']");
    const inn = root.querySelectorAll("[data-swap-in='1']");
    tl.fromTo(out, { y: 0, opacity: 1 }, { y: -12, opacity: 0, duration: 0.25, ease: "power2.in" }, 0).fromTo(
      inn,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "expo.out" },
      0.18,
    );
  });
  usePerformanceAt("pass2", 0.97, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const out = root.querySelectorAll("[data-swap-out='2']");
    const inn = root.querySelectorAll("[data-swap-in='2']");
    tl.fromTo(out, { y: 0, opacity: 1 }, { y: -12, opacity: 0, duration: 0.25, ease: "power2.in" }, 0).fromTo(
      inn,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "expo.out" },
      0.18,
    );
  });

  /* ── ranked: the rows land in rank order ── */
  usePerformance("ranked", (tl) => {
    const list = listRef.current;
    if (!list) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-row-in]"));
    rows.forEach((el, n) => {
      const at = RANK_LAND_START + n * RANK_STAGGER;
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: RANK_FADE, ease: "power1.out" }, at);
    });
  });

  /* ── reason: score, meter, chips, privacy (starts when the card lands) ── */
  usePerformanceAt("reason", REASON_AT, (tl) => {
    const root = rootRef.current;
    const privacy = root?.querySelector("[data-privacy]");
    const lens = storyCopy.reason.chips.map((c) => c.length);
    tl.fromTo(cardShow, { score: 0 }, { score: storyCopy.reason.card.score, duration: 0.9, ease: "power2.out" }, 0)
      .fromTo(cardShow, { meter: 0 }, { meter: 0.9, duration: 0.95, ease: "expo.out" }, 0.02)
      .fromTo(cardShow, { c0: 0 }, { c0: lens[0], duration: lens[0] * 0.022, ease: "none" }, 0.2)
      .fromTo(cardShow, { c1: 0 }, { c1: lens[1], duration: lens[1] * 0.022, ease: "none" }, 0.32)
      .fromTo(cardShow, { c2: 0 }, { c2: lens[2], duration: lens[2] * 0.022, ease: "none" }, 0.44);
    if (privacy) tl.fromTo(privacy, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, 0.9);
  });

  /* ── pointer: card tilt (reason), row-1 lift (ranked) ── */
  useActorExtra((s) => {
    if (s.beat === "ranked") return getRow1Hover() ? { ty: -2 } : null;
    if (s.beat !== "reason" || s.beatProgress < REASON_AT || !s.actor.present) return null;
    // Breath: a slow dolly (rotateY −3° → 3°) with a specular band sweeping across the glass.
    const b = story.breathOf("reason", REASON_AT, 1);
    const dolly = { rx: 0, ry: -3 + 6 * b, spec: 0.75, specX: -15 + 130 * b, specY: 20 + 30 * b };
    const { x, y, w, h } = s.actor;
    if (!s.pointer.fine || !s.pointer.inside || w < 1) return dolly;
    const nx = (s.pointer.x - (x + w / 2)) / (w / 2);
    const ny = (s.pointer.y - (y + h / 2)) / (h / 2);
    const reach = Math.max(Math.abs(nx), Math.abs(ny));
    const falloff = reach <= 1 ? 1 : Math.max(0, 1 - (reach - 1) / 0.6);
    const cx = Math.max(-1, Math.min(1, nx));
    const cy = Math.max(-1, Math.min(1, ny));
    if (falloff <= 0) return dolly;
    return {
      rx: -cy * 7 * falloff,
      ry: dolly.ry * (1 - falloff) + cx * 9 * falloff,
      spec: reach <= 1 ? 1 : dolly.spec,
      specX: reach <= 1 ? 50 + cx * 50 : dolly.specX,
      specY: reach <= 1 ? 50 + cy * 50 : dolly.specY,
    };
  });

  const style = { "--reveal-a": 0 } as CSSProperties;
  return (
    <Panel beats={["hero", "pass1", "pass2", "ranked", "reason"]} className="rd-read">
      <div ref={rootRef} className="rd-read-root">
        {/* ── the counter (motion) ── */}
        <div ref={passRef} className="rd-pass only-motion" style={style}>
          <div className="rd-grid rd-pass-grid">
            <div className="rd-pass-col">
              <p className="sr-only">{storyCopy.common.figuresForScreenReaders}</p>
              <div className="rd-pass-marks" aria-hidden="true">
                {passLabels.map((label, n) => (
                  <span key={label} className="rd-mark" data-mark={n + 1}>
                    {label}
                    <i className="rd-mark-track">
                      <i className="rd-mark-fill" />
                    </i>
                  </span>
                ))}
              </div>
              <p className="rd-counter" aria-hidden="true">
                <span ref={digitsRef} className="rd-digits" data-n={fig.read}>
                  {fmt(fig.read)}
                </span>
              </p>
              <p className="rd-stmt" aria-hidden="true">
                <span ref={stmtRef} className="rd-stmt-fly">
                  <span className="rd-swap" data-swap-out="1">
                    {storyCopy.pass1.statementStart}
                  </span>
                  <span className="rd-swap" data-swap-in="1">
                    <span className="rd-swap-inner" data-swap-out="2">
                      {storyCopy.pass1.statementEnd}
                    </span>
                  </span>
                  <span className="rd-swap" data-swap-in="2">
                    {storyCopy.pass2.statementEnd}
                  </span>
                </span>
              </p>
              <p className="rd-detail" aria-hidden="true">
                <span className="rd-swap" data-swap-out="2">
                  {storyCopy.pass1.detail}
                </span>
                <span className="rd-swap" data-swap-in="2">
                  {storyCopy.pass2.detail}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* ── the figures (static) ── */}
        <div className="rd-figures only-static">
          <div className="rd-grid">
            <ul className="rd-figures-list">
              {[
                [fig.read, storyCopy.pass1.statementStart, ""],
                [fig.level, storyCopy.pass1.statementEnd, storyCopy.pass1.detail],
                [fig.fit, storyCopy.pass2.statementEnd, storyCopy.pass2.detail],
              ].map(([n, label, detail], k) => (
                <li key={k} className="rd-figure" data-gold={k === 2 ? "" : undefined}>
                  <span className="rd-figure-n">{fmt(Number(n))}</span>
                  <span className="rd-figure-l">{label}</span>
                  {detail ? <span className="rd-figure-d">{detail}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── ranked ── */}
        <div className="rd-ranked">
          <div className="rd-grid rd-split">
            <div className="rd-copy rd-copy-ranked">
              <h2 className="rd-h2">
                <Lines text={storyCopy.ranked.h2} className="rd-h2-vis" />
              </h2>
              <p className="rd-body">{storyCopy.ranked.body}</p>
            </div>
            <div className="rd-obj">
              <div className="rd-list-wrap">
                <p className="rd-list-head">
                  <span ref={headNRef} className="rd-list-n">
                    {HEADER_N}
                  </span>{" "}
                  <span ref={headTRef}>{HEADER_T}</span>
                </p>
                <div ref={rule} className="rd-rule" />
                <ol ref={listRef} className="rd-list">
                  {rankedRoles.map((role) =>
                    role.rank === 1 ? (
                      <li
                        key={role.rank}
                        ref={row1Ref}
                        className="rd-row rd-row1"
                        data-row={1}
                        onPointerEnter={(e) => e.pointerType === "mouse" && setRow1Hover(true)}
                        onPointerLeave={() => setRow1Hover(false)}
                      >
                        <div data-row-in>
                          <FaceSlot anchor="row-1" face="row" skin="night" />
                        </div>
                      </li>
                    ) : (
                      <li key={role.rank} className="rd-row" data-row={role.rank}>
                        <div data-row-in>
                          <DomRow role={role} />
                        </div>
                      </li>
                    ),
                  )}
                  <li ref={moreRef} className="rd-more" aria-hidden="true">
                    <div data-row-in>{storyCopy.ranked.more}</div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* ── reason ── */}
        <div className="rd-reason">
          <div className="rd-grid rd-split">
            <div className="rd-copy rd-copy-reason">
              <h2 className="rd-h2">
                <Lines text={storyCopy.reason.h2} className="rd-h2-vis" />
              </h2>
              <p className="rd-body">{storyCopy.reason.body}</p>
              <p className="rd-privacy-line" data-privacy>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M8 1.75 3 3.6v3.9c0 3 2.1 5.6 5 6.75 2.9-1.15 5-3.75 5-6.75V3.6L8 1.75Z" />
                  <path d="m5.8 8 1.5 1.5 2.9-3" />
                </svg>
                <span>{storyCopy.reason.privacy}</span>
              </p>
            </div>
            <div className="rd-obj rd-card-obj">
              <div className="rd-card-at">
                <FaceSlot anchor="card" face="card" skin="night" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

