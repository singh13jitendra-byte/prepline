"use client";

/**
 * Beats 2 to 5 of Act I (storyboard 2.4): `pass1`, `pass2`, `ranked`, `reason`.
 * One panel, three layers that hand over to each other in place:
 *
 *   pass layer    the counter. Revealed below the rising Line at the end of `hero`
 *                 (the Line swaps the headline for the count). Scrub-exact:
 *                 2,340 → 186 over pass1, 186 → 12 over pass2, lamp at 12.
 *                 The statement and its detail swap together as each pass starts.
 *   ranked layer  H2 left; right, the list header on night, `ranked-rule` under it, and
 *                 the matches panel: cream paper (the product's MatchesList skin) with
 *                 the <ol> of 12 MatchRows. In the first 15% of `ranked` the counter
 *                 flies into the header ("12 fit your portfolio"). Delight 3: the twelve
 *                 kept fireflies fly into the list in rank order (scrubbed), and each row
 *                 prints and ignites as its firefly lands on its score rule (data-lit).
 *   reason layer  H2 left; the `card` slot centred over the list. Row 1 (the Actor)
 *                 lifts out and becomes the RoleDetail card in the first 35%; when it
 *                 lands the numeral counts to 9, the Line fills the rule, the rows of
 *                 working resolve 120ms apart, then the privacy line arrives.
 *
 * Static (reduced motion): the three figures side by side, then the ranked list,
 * then the reason card with its chips. No counting, no typing.
 *
 * Flight contract with the World (components/world/flight.ts): row i ignites at landAt(i - 1)
 * of `ranked` beat progress, the frame its firefly touches down. On phones rows 7 to 12 are
 * folded into the "6 more" pill, which ignites with the seventh.
 */

import { useEffect, useRef, type CSSProperties } from "react";
import { FaceSlot } from "@/components/story/FaceSlot";
import { Panel } from "@/components/story/Stage";
import { rankedRoles, storyCopy } from "@/lib/content";
import { registerAnchor, useAnchor, type AnchorId } from "@/lib/anchors";
import { usePerformance } from "@/lib/perform";
import { ACTOR_TRACK, BEATS, story, type BeatId, type StoryState } from "@/lib/story";
import { MatchRow, productData } from "@/components/product";
import { getRow1Hover, setRow1Hover } from "./RowView";
import { cardShow, offsetIn, setMask, softAbove, span, useActorExtra, usePerformanceAt, useScrub } from "./runtime";
import { ease } from "@/lib/theme";
import { landAt, listDrift } from "@/components/world/flight";

/** Beat progress (`ranked`) at which each row's firefly touches down: the row prints and ignites. */
const LAND = Array.from({ length: 12 }, (_, i) => landAt(i));
/** Beat progress at which the reason card finishes its travel (ACTOR_TRACK.reason.range[1]). */
const REASON_AT = ACTOR_TRACK.reason?.range?.[1] ?? 0.35;
/** The row → card travel (ACTOR_TRACK.reason, scrubbed), 0..1, outside the beat 0 (before) or 1. */
const REASON_RANGE = ACTOR_TRACK.reason?.range ?? [0, 0.35];
function reasonTravel(s: Readonly<StoryState>): number {
  const i = idx(s.beat);
  if (i < I.reason) return 0;
  if (i > I.reason) return 1;
  return span(s.beatProgress, REASON_RANGE[0], REASON_RANGE[1]);
}
/** The flip, in travel: tip to edge-on over [0], [1]; swap faces at [1]; turn face-on by [2]. */
const FLIP = [0.36, 0.5, 0.64] as const;
const easeIn = (x: number) => x * x;
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const BIRTH = ACTOR_TRACK.ranked?.fadeIn ?? [0.46, 0.58];

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

/** Rows 2 to 12: the product's own MatchRow, laid out at 440 × 44 and scaled with the list. */
function DomRow({ rank }: { rank: number }) {
  return (
    <div className="pl-row-box">
      <div className="pl-row-scale">
        <MatchRow role={productData.roles[rank - 1]} skin="day" />
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
    panel: HTMLElement | null;
    rows: HTMLElement[];
    more: HTMLElement | null;
  } | null>(null);
  /** The beat index of the previous scrub frame: a row ignites only when the wheel carries it there. */
  const lastBeat = useRef(-1);
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
      k: root.querySelectorAll<HTMLElement>(".rd-detail, .rd-stmt-slip"),
      fly: root.querySelectorAll<HTMLElement>(".rd-digits, .rd-stmt-fly"),
      head: root.querySelectorAll<HTMLElement>(".rd-list-head, .rd-rule"),
      digits: root.querySelectorAll<HTMLElement>(".rd-digits"),
      stmt: root.querySelectorAll<HTMLElement>(".rd-stmt-fly"),
      ranked: root.querySelectorAll<HTMLElement>(".rd-copy-ranked"),
      reason: root.querySelectorAll<HTMLElement>(".rd-copy-reason"),
      list: root.querySelector<HTMLElement>(".rd-list-wrap"),
      panel: root.querySelector<HTMLElement>(".rd-panel"),
      rows: Array.from(root.querySelectorAll<HTMLElement>("li.rd-row")).sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row)),
      more: root.querySelector<HTMLElement>("li.rd-more"),
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
    const mask = !revealing ? "none" : h > 0.5 ? `linear-gradient(to bottom, transparent ${(ly + gap).toFixed(1)}px, black ${(ly + gap + 40).toFixed(1)}px)` : "linear-gradient(transparent, transparent)";
    if (pass.dataset.mask !== mask) {
      pass.dataset.mask = mask;
      pass.style.setProperty("-webkit-mask-image", mask);
      pass.style.setProperty("mask-image", mask);
    }
    // 85-unit hero: the headline is gone by 0.46 and the World has handed over to the meadow (about
    // 0.45), so the count inks in onto clear meadow once the Line rises: it starts 12vh low and is
    // scrubbed up to its rest over 0.58–0.92 (review-3 P1-3).
    set(pass, "--reveal-a", revealing ? span(h, 0.55, 0.72).toFixed(4) : "1");
    set(pass, "--reveal-y", `${(revealing ? (1 - span(h, 0.58, 0.92)) * 0.12 * s.viewport.h : 0).toFixed(2)}px`);

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

    // Delight 3: each row prints as its firefly lands on its score rule, and ignites (a quick lamp
    // flash behind the rule, read.css) only when the wheel carried it there: a jump or a load past
    // the moment shows the rows lit, quietly. Written only when a row's state changes.
    const before = lastBeat.current;
    lastBeat.current = i;
    const carried = before >= I.pass2 && before <= I.ranked && i === I.ranked;
    const litAt = (n: number) => i > I.ranked || (i === I.ranked && r >= LAND[n]);
    const light = (el: HTMLElement | null, on: boolean) => {
      if (!el || el.hasAttribute("data-lit") === on) return;
      if (on) el.setAttribute("data-lit", carried ? "ignite" : "");
      else el.removeAttribute("data-lit");
    };
    tg.rows.forEach((el, n) => light(el, litAt(n)));
    light(tg.more, litAt(6));

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
      const y = listDrift();
      const tf = `translate3d(0,${y.toFixed(2)}px,0) scale(${(1 - 0.04 * j).toFixed(4)})`;
      if (tg.list.style.transform !== tf) tg.list.style.transform = tf;
      // The list steps back BEFORE the card lifts: it starts dimming in the last stretch of `ranked`
      // and is down to its floor by 10% of `reason`, ahead of the flip (travel 0.36, reason 0.13).
      // Behind the card it falls well back; on small screens the card covers it, so it goes entirely.
      // It recedes by darkening, not by turning see-through: a pine wash over the opaque paper (a
      // translucent paper panel over the meadow read as grey glass in the founder's recording).
      const pre = idx(s.beat) > I.ranked ? 1 : span(r, 0.92, 1);
      const dim = span(q, 0, 0.1);
      const wash = (0.35 * pre * (1 - dim) + 0.78 * dim).toFixed(4);
      if (tg.panel && tg.panel.style.getPropertyValue("--dim") !== wash) tg.panel.style.setProperty("--dim", wash);
      // On small screens the card covers the list: once it is washed dark it goes, under the card.
      const op = s.flags.small ? (1 - span(q, 0.1, 0.2)).toFixed(4) : "1";
      if (tg.list.style.opacity !== op) tg.list.style.opacity = op;
    }
    // Reason breath: after the card lands, its rows of working are read one by one.
    const nRows = productData.kestrelDetail.why.length + productData.kestrelDetail.watchOuts.length;
    cardShow.focus = i === I.reason && q >= REASON_AT ? span(q, REASON_AT + 0.08, 0.98) * nRows : i > I.reason ? nRows : -1;
    setAll(tg.ranked, "--out", span(q, 0, 0.12).toFixed(4));
    setAll(tg.reason, "--in", span(q, 0.08, 0.22).toFixed(4));
    setAll(tg.reason, "--in2", span(q, 0.13, 0.27).toFixed(4));
  });

  /* ── statement swaps: as each pass starts, the statement and its detail name the filter the count
     is running through (review-3 P2-1). Both swap together, once per pass. ── */
  usePerformanceAt("pass1", 0.06, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const out = root.querySelectorAll("[data-swap-out='1']");
    const inn = root.querySelectorAll("[data-swap-in='1']");
    tl.fromTo(out, { y: 0, opacity: 1 }, { y: -12, opacity: 0, duration: 0.25, ease: ease.in }, 0).fromTo(
      inn,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: ease.out },
      0.18,
    );
  });
  usePerformanceAt("pass2", 0.03, (tl) => {
    const root = rootRef.current;
    if (!root) return;
    const out = root.querySelectorAll("[data-swap-out='2']");
    const inn = root.querySelectorAll("[data-swap-in='2']");
    tl.fromTo(out, { y: 0, opacity: 1 }, { y: -12, opacity: 0, duration: 0.25, ease: ease.in }, 0).fromTo(
      inn,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: ease.out },
      0.18,
    );
  });

  /* ── ranked: the paper panel is laid down first, so the fireflies land on paper. Opacity only: the
     World measures the rows' landing points once, and a moving panel would leave them behind.
     The rows themselves print as their fireflies land (the scrub above). ── */
  usePerformance("ranked", (tl) => {
    const panel = listRef.current?.closest<HTMLElement>(".rd-panel");
    if (panel) tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: ease.out }, 0.05);
  });

  /* ── reason: score, meter, chips, privacy (starts when the card lands) ── */
  usePerformanceAt("reason", REASON_AT, (tl) => {
    const root = rootRef.current;
    const privacy = root?.querySelector("[data-privacy]");
    // The rule fills and the numeral counts; the four rows of working resolve 120ms apart.
    const rows = productData.kestrelDetail.why.length + productData.kestrelDetail.watchOuts.length;
    tl.fromTo(cardShow, { score: 0 }, { score: storyCopy.reason.card.score, duration: 0.9, ease: ease.outSoft }, 0)
      .fromTo(cardShow, { meter: 0 }, { meter: storyCopy.reason.card.score / 10, duration: 0.95, ease: ease.out }, 0.02)
      .fromTo(cardShow, { rows: 0 }, { rows: rows, duration: rows * 0.12, ease: "none" }, 0.24);
    if (privacy) tl.fromTo(privacy, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: ease.out }, 0.9);
  });

  /* ── pointer: card tilt (reason), row-1 lift (ranked) ── */
  useActorExtra((s) => {
    if (s.beat === "ranked") return getRow1Hover() ? { ty: -2 } : null;
    if (s.beat !== "reason" || s.beatProgress < REASON_AT || !s.actor.present) return null;
    // Breath: a slow dolly (rotateY −2.5° → 2.5°). No highlight: this is paper and print, not glass.
    const b = story.breathOf("reason", REASON_AT, 1);
    const dolly = { rx: 0, ry: -2.5 + 5 * b };
    const { x, y, w, h } = s.actor;
    if (!s.pointer.fine || !s.pointer.inside || w < 1) return dolly;
    const nx = (s.pointer.x - (x + w / 2)) / (w / 2);
    const ny = (s.pointer.y - (y + h / 2)) / (h / 2);
    const reach = Math.max(Math.abs(nx), Math.abs(ny));
    const falloff = reach <= 1 ? 1 : Math.max(0, 1 - (reach - 1) / 0.6);
    const cx = Math.max(-1, Math.min(1, nx));
    const cy = Math.max(-1, Math.min(1, ny));
    if (falloff <= 0) return dolly;
    // Pointer tilt, at most 3° (paper is stiffer than glass).
    return { rx: -cy * 3 * falloff, ry: dolly.ry * (1 - falloff) + cx * 3 * falloff };
  });

  /* ── row → card: one deliberate flip, never two translucent faces (founder recording, z_16) ──
     The engine's default face change crossfades two surfaces, which over the list read as grey
     glass blinking cream and dark. Here the travelling Actor turns about X instead: the cream row
     tips edge-on, the faces swap at that frame, and the pine card turns face-on. Both faces stay
     opaque the whole way (faces.css, .actor[data-pl-swap]). */
  useActorExtra((s) => {
    const t = reasonTravel(s);
    if (t <= FLIP[0] || t >= FLIP[2]) return null;
    const flipX = t < FLIP[1] ? 90 * easeIn((t - FLIP[0]) / (FLIP[1] - FLIP[0])) : -90 * (1 - easeOut((t - FLIP[1]) / (FLIP[2] - FLIP[1])));
    return { flipX };
  });
  useEffect(() => {
    if (story.reduced()) return;
    let actor: HTMLElement | null = null;
    let last = "";
    return story.frame("actor", (_t, _dt, s) => {
      if (!actor || !actor.isConnected) {
        actor = document.querySelector<HTMLElement>(".actor");
        last = "";
      }
      if (!actor) return;
      const t = reasonTravel(s);
      const v = t > 0 && t < 1 ? (t < FLIP[1] ? "from" : "to") : "";
      if (v === last) return;
      last = v;
      if (v) actor.setAttribute("data-pl-swap", v);
      else actor.removeAttribute("data-pl-swap");
    });
  }, []);

  const style = { "--reveal-a": 0 } as CSSProperties;
  return (
    <Panel beats={["hero", "pass1", "pass2", "ranked", "reason"]} className="rd-read">
      <div ref={rootRef} className="rd-read-root">
        {/* ── the counter (motion) ── */}
        <div ref={passRef} className="rd-pass only-motion" style={style} data-pass="0">
          <div className="rd-grid rd-pass-grid">
            <div className="rd-pass-col">
              <p className="sr-only">{storyCopy.common.figuresForScreenReaders}</p>
              <p className="rd-counter" aria-hidden="true">
                <span ref={digitsRef} className="rd-digits" data-n={fig.read}>
                  {fmt(fig.read)}
                </span>
              </p>
              {/* The statement and its detail sit on a pine slip over the meadow (review-3 P0-2). The
                  slip fades with the detail as the statement flies to the list header. */}
              <div className="slip-night slip-bleed rd-stmt-slip">
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
              <div className="rd-detail-wrap">
              <p className="rd-detail" aria-hidden="true">
                <span className="rd-swap" data-swap-in="1">
                  <span className="rd-swap-inner" data-swap-out="2">
                    {storyCopy.pass1.detail}
                  </span>
                </span>
                <span className="rd-swap" data-swap-in="2">
                  {storyCopy.pass2.detail}
                </span>
              </p>
              </div>
              </div>
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
              {/* Small copy over the meadow sits on the night slip (type-on-painting rule). */}
              <div className="slip-night slip-bleed rd-body-slip">
                <p className="rd-body">{storyCopy.ranked.body}</p>
              </div>
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
                {/* The list is the product's matches panel: cream paper, keyline, a hard print offset. */}
                <div className="pp rd-panel" data-skin="day">
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
                          <DomRow rank={role.rank} />
                        </div>
                      </li>
                    ),
                  )}
                  <li ref={moreRef} className="rd-more" aria-hidden="true">
                    <div data-row-in>{storyCopy.ranked.more}</div>
                  </li>
                </ol>
                {/* Receding into the night: an opaque pine wash over the paper, never a see-through panel. */}
                <i className="rd-panel-dim" aria-hidden="true" />
                </div>
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
              <div className="slip-night slip-bleed rd-body-slip">
                <p className="rd-body">{storyCopy.reason.body}</p>
                <p className="rd-privacy-line" data-privacy>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M8 1.75 3 3.6v3.9c0 3 2.1 5.6 5 6.75 2.9-1.15 5-3.75 5-6.75V3.6L8 1.75Z" />
                    <path d="m5.8 8 1.5 1.5 2.9-3" />
                  </svg>
                  <span>{storyCopy.reason.privacy}</span>
                </p>
              </div>
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

