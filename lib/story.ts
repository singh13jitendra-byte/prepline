"use client";

/**
 * STORY STORE — the one clock of the page ("One role, read.").
 *
 * A framework-free singleton. It is written once per frame from scroll and never
 * causes a React render per frame. React re-renders on beat changes only.
 *
 *   story.get(): StoryState                      live state (same object every call: read, never mutate or keep)
 *   story.subscribe(fn): () => void              fn(state) after compute, on every frame the state changed
 *   story.frame(phase, fn): () => void           fn(time, dt, state) every frame, phase = "actor" | "line" | "world"
 *   story.onBeat(id, { enter, leave }): () => void   beat transitions; direction 1 = scrolling down, -1 = up
 *   story.onBeatChange(fn): () => void           fn(beat, previous, direction) after every change of the current beat
 *   story.useBeat(): BeatId                      React hook, re-renders on beat change only
 *   story.scrollToBeat(id, at = 0, opts?)        scroll (through Lenis when present) to a point inside a beat
 *   story.scrollToAct(id, opts?)                 scroll to an act's landing point (used for #board, #prep, #join links)
 *   story.invalidate()                           mark the state dirty (call after changing something subscribers read)
 *   story.breath(el, beat, opts?): () => void    write a scrubbed 0..1 `--breath` on `el` for the back half of a beat
 *   story.breathOf(beat, from?, to?): number     the same value, for JS
 *   story.useBreath(beat, opts?)                 React ref that does story.breath
 *   story.lineScope(el): () => void              make `el` (not its subtree) receive --line-y / --day-top / --day-side
 *
 *   BEATS, ACTS          the scroll budget (storyboard 2.2). Single source of truth for section heights.
 *   LINE_TRACK           per beat: where the Line goes (storyboard section 2, "Line label" and line moves)
 *   SCENE_TRACK          per beat: which painted scene is on screen, and how it gives way to the next
 *   ACTOR_TRACK          per beat: where the Actor goes, which face it wears, how it is driven
 *
 * Usage:
 *
 *   // scrubbed style, no React:
 *   useEffect(() => story.subscribe((s) => {
 *     if (s.beat !== "pass1") return;
 *     counter.textContent = String(Math.round(2340 - (2340 - 186) * s.beatProgress));
 *   }), []);
 *
 *   // discrete state:
 *   const beat = story.useBeat();
 *
 *   // nav link:
 *   <a href="#join" onClick={(e) => { e.preventDefault(); story.scrollToAct("seat"); }}>Request a seat</a>
 *
 * SCENES — the painted world (round 4). `state.scene` says which painting owns the screen and how
 * far it has given way to the next one:
 *
 *   { id, to, kind, mix, progress }
 *   id        "desk-night" | "meadow-night" | "paper" | "desk-lamp" | "desk-bluehour" | "desk-dawn"
 *   to, kind  the scene arriving and how ("push" through the window, "wipe" by the Line, "fade"),
 *             or null while the scene simply holds
 *   mix       0..1 through that change, linear in scroll. For a "wipe" the split itself is at
 *             state.dayTop (day below the Line): mix only says how far the sweep has run.
 *   progress  0..1 across the scene's whole time on screen: drive parallax and drift with it.
 *
 *   story.subscribe((s) => {
 *     const { id, to, kind, mix, progress } = s.scene;
 *     if (kind === "push") room.style.transform = `scale(${1 + mix * 5})`;   // through the window
 *     meadow.style.transform = `translate3d(0, ${-progress * 40}px, 0)`;     // never still
 *   });
 *
 * The table is SCENE_TRACK (data, like LINE_TRACK); sceneOf(beat) gives the scene a beat opens on.
 * The hero's push runs over hero progress 0.16 to 0.92. During it the Line holds full width at
 * the underline's height (the horizon) and rises to its reading position from 0.5.
 *
 * BREATH — no dead scroll. A timed performance ends after about a second; the
 * rest of the beat must still answer the wheel. `story.breath` gives every beat
 * a second, scrubbed channel: 0 until beat progress reaches `from`, then linear
 * to 1 at `to` (default: the end of the beat), 0 before the beat and 1 after it.
 * It is written as a CSS variable on the element you register, and only when
 * the value changes. No React render, nothing on <html>.
 *
 *   // CSS: .card-dolly { transform: rotateY(calc((var(--breath) - 0.5) * 6deg)); }
 *   const dolly = story.useBreath("reason", { from: 0.45 });
 *   return <div ref={dolly} className="card-dolly">…</div>;
 *
 *   // several beats on one element: one variable each
 *   story.breath(board, "applied", { from: 0.5, name: "--breath-applied" });
 *   story.breath(board, "interview", { from: 0.5, name: "--breath-interview" });
 *
 *   // or one variable that restarts in each listed beat (0→1, 0→1, 0→1)
 *   story.breath(sheet, ["q1", "q2", "q3"], { from: 0.55 });
 *
 * Register the smallest element that needs it: a CSS variable restyles the
 * subtree of the element it is set on. Start the breath where the performance
 * ends (from ≈ performance seconds ÷ the time a visitor spends in the beat;
 * 0.4 to 0.55 suits most beats), or overlap it a little so there is no seam.
 * Under reduced motion the variable is set once, to `opts.reduced` (default 1).
 *
 * Frame order (one gsap.ticker callback chain, never a second rAF):
 *   Lenis → ScrollTrigger → store compute (all layout reads: active + watched anchors)
 *   → subscribers → "actor" → "line" → "world".
 * Everything after compute is a write phase: do not read layout there, use anchorRect().
 *
 * Coordinates: `pos` and beat lengths are in story units. One unit is 1svh on
 * desktop and 0.85svh under 768px (CSS variable --u), so progress fractions are
 * identical on every screen. Viewport values (line, pointer, rects) are CSS px.
 *
 * LINE VARIABLES. --line-y (px), --day-top (px: everything below it is day,
 * above it night; 0 = all day, viewport height = all night) and --day-side
 * ("below" while the line is sweeping a chapter change, else "none") change
 * every frame, so they are NOT written on <html>: that restyled the whole
 * document. They are written on "line scopes": the reader elements themselves,
 * registered with story.lineScope(el) or through <LineScope targets>. The three
 * are registered non-inherited (app/globals.css), so a scope's own rules read
 * var(--day-top) and its subtree is not restyled; anything that is not a scope
 * reads the static first-frame defaults. The act sections are not
 * a scope: stages are clipped by an inline clip-path, and act code that needs
 * the line reads story.get().line / .dayTop in a subscriber.
 *
 * On <html> the store keeps only what changes on beat boundaries:
 * data-chapter ("night" | "day"), data-beat, and data-wipe (the wipe beat id
 * while a wipe beat is current). Day is always below the line: day rises from
 * the bottom, night falls from the top.
 *
 * Reduced motion (html.reduced): the store does not run. `get()` keeps its
 * initial state with flags.reduced = true, useBeat() stays "hero", performances
 * sit in their end state, and scrollToBeat jumps to the beat's panel.
 */

import { useCallback, useSyncExternalStore } from "react";
import { anchorElement, anchorRect, measureAnchorFrame, type AnchorId } from "./anchors";
import { story as copy } from "./content";
import { gsap } from "./gsap";

/* ────────────────────────────────────────────────────────────── types ── */

export type ActId = "read" | "board" | "prep" | "seat";
export type BeatId =
  | "hero"
  | "pass1"
  | "pass2"
  | "ranked"
  | "reason"
  | "daybreak"
  | "saved"
  | "applied"
  | "interview"
  | "hinge"
  | "nightfall"
  | "unfold"
  | "q1"
  | "q2"
  | "q3"
  | "votes"
  | "dawn"
  | "seat"
  | "footer";
export type Chapter = "night" | "day";
export type Skin = Chapter;
export type FaceId = "row" | "card" | "tile" | "sheet" | "ticket";
export type DaySide = "above" | "below" | "none";
export type Direction = 1 | -1;

export type Beat = {
  id: BeatId;
  act: ActId;
  /** Scroll length in story units (vh on desktop). */
  vh: number;
  kind: "beat" | "wipe";
};

export type StoryState = {
  beat: BeatId;
  /** 0..1 inside the current beat. */
  beatProgress: number;
  act: ActId;
  /** 0..1 across the act's own beats and its closing wipe. */
  actProgress: number;
  /** 0..1 across the whole story, footer included. */
  pageProgress: number;
  /** Absolute position in story units (0 at the top, 1270 where the seat stage unpins). */
  pos: number;
  direction: Direction;
  /** Scroll velocity in px/s (signed). */
  velocity: number;
  chapter: Chapter;
  /** Viewport y (px) below which the screen is day. 0 = all day, viewport.h = all night. */
  dayTop: number;
  line: {
    x0: number;
    x1: number;
    /** Viewport y in px. */
    y: number;
    daySide: DaySide;
    label: string;
    /** Stroke thickness in px. */
    weight: number;
    /** True while the line is performing a chapter change. */
    sweep: boolean;
    /** True once the current move has finished and the line sits on an anchor (docked as a rule). */
    rest: boolean;
  };
  /**
   * The painted scene on screen (see SCENE_TRACK). `id` is the scene that owns the screen; while it
   * is giving way, `to` is the scene arriving, `kind` says how, and `mix` runs 0..1 (linear in
   * scroll). Outside a change `to` and `kind` are null and `mix` is 0.
   * `progress` runs 0..1 across the whole time `id` is on screen, from the end of its arrival to
   * the end of its departure: use it for slow parallax and drift, so a scene never sits still.
   */
  scene: {
    id: SceneId;
    to: SceneId | null;
    kind: SceneKind | null;
    mix: number;
    progress: number;
  };
  /** Written by the Actor engine each frame. Viewport px. */
  actor: {
    present: boolean;
    /** True when the real DOM face has taken over (interactive rest). */
    docked: boolean;
    face: FaceId | null;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Travel 0..1 between the beat's from and to anchors. */
    travel: number;
    fold: number;
    flip: number;
  };
  pointer: { x: number; y: number; inside: boolean; fine: boolean };
  /** Stage size in px (100svh tall). */
  viewport: { w: number; h: number };
  flags: { reduced: boolean; small: boolean; coarse: boolean; gl: boolean };
};

/* ───────────────────────────────────────────────────────────── budget ── */

/**
 * The scroll budget. Order is scroll order. Storyboard 2.2, re-cut after review 1
 * so no beat outlasts what is on screen: every timed beat is now about one
 * performance plus one breath long. Pins: read 405, board 210, prep 230, seat 60.
 * With the three wipes (190), the seat stage scrolling away (100) and the footer
 * (its own height) the document is about 12.2 viewports, before the founder note.
 */
export const BEATS: readonly Beat[] = [
  // 85 since round 4: about 14 to stretch the underline, then 70 for the push through the window.
  { id: "hero", act: "read", vh: 85, kind: "beat" },
  { id: "pass1", act: "read", vh: 100, kind: "beat" },
  { id: "pass2", act: "read", vh: 90, kind: "beat" },
  { id: "ranked", act: "read", vh: 60, kind: "beat" },
  { id: "reason", act: "read", vh: 70, kind: "beat" },
  { id: "daybreak", act: "read", vh: 60, kind: "wipe" },
  { id: "saved", act: "board", vh: 50, kind: "beat" },
  { id: "applied", act: "board", vh: 45, kind: "beat" },
  { id: "interview", act: "board", vh: 45, kind: "beat" },
  { id: "hinge", act: "board", vh: 70, kind: "beat" },
  { id: "nightfall", act: "board", vh: 60, kind: "wipe" },
  { id: "unfold", act: "prep", vh: 40, kind: "beat" },
  { id: "q1", act: "prep", vh: 45, kind: "beat" },
  { id: "q2", act: "prep", vh: 45, kind: "beat" },
  { id: "q3", act: "prep", vh: 45, kind: "beat" },
  { id: "votes", act: "prep", vh: 55, kind: "beat" },
  { id: "dawn", act: "prep", vh: 70, kind: "wipe" },
  { id: "seat", act: "seat", vh: 60, kind: "beat" },
  // The seat stage scrolling away (100) plus the footer (about 60). Not pinned.
  { id: "footer", act: "seat", vh: 160, kind: "beat" },
];

/** Beat lengths are multiplied by this under 768px (applied in CSS through --u). */
export const MOBILE_SCALE = 0.85;

/**
 * Extra pinned length after an act's closing wipe. The stage is hidden by then,
 * but stays pinned so its anchors hold still while the Actor leaves them
 * (for example `card` during the `saved` beat). It adds no document height:
 * the next act's negative margin absorbs it, and it is capped at the length of
 * the act that follows (the prep stage's tail is 60, the seat act's pin), so no
 * section ever ends below the last one.
 */
export const STAGE_TAIL = 100;

export type Act = {
  id: ActId;
  /** The section's DOM id (hash target). */
  domId: string;
  chapter: Chapter;
  /** Story position where this act's stage pins (the start of the wipe that brings it in). */
  start: number;
  wipeIn: number;
  pin: number;
  wipeOut: number;
  tail: number;
  /** Pinned scroll length: wipeIn + pin + wipeOut + tail. Section height is 100svh + len. */
  len: number;
  /** How far this section overlaps the previous one, beyond 100svh. */
  overlap: number;
  /** Story position of the act's first beat. */
  firstBeatAt: number;
};

const ACT_META: { id: ActId; domId: string; chapter: Chapter }[] = [
  { id: "read", domId: "read", chapter: "night" },
  { id: "board", domId: "board", chapter: "day" },
  { id: "prep", domId: "prep", chapter: "night" },
  { id: "seat", domId: "join", chapter: "day" },
];

const BEAT_INDEX = {} as Record<BeatId, number>;
const BEAT_START = {} as Record<BeatId, number>;
{
  let at = 0;
  BEATS.forEach((b, i) => {
    BEAT_INDEX[b.id] = i;
    BEAT_START[b.id] = at;
    at += b.vh;
  });
}
const FOOTER_AT = BEAT_START.footer;
const TOTAL = FOOTER_AT + BEATS[BEATS.length - 1].vh;

export const ACTS: readonly Act[] = (() => {
  const out: Act[] = [];
  const sizes = ACT_META.map((m) => {
    const own = BEATS.filter((b) => b.act === m.id && b.id !== "footer");
    return {
      pin: own.filter((b) => b.kind === "beat").reduce((n, b) => n + b.vh, 0),
      wipeOut: own.filter((b) => b.kind === "wipe").reduce((n, b) => n + b.vh, 0),
    };
  });
  // A tail may never outlast the act that follows it, or this section would end below the next
  // one and add height to the page. Worked out from the last act back (the last has no tail).
  const tails: number[] = [];
  for (let i = ACT_META.length - 1; i >= 0; i--) {
    const next = sizes[i + 1];
    tails[i] = next ? Math.min(STAGE_TAIL, next.pin + next.wipeOut + tails[i + 1]) : 0;
  }
  let start = 0;
  ACT_META.forEach((m, i) => {
    const { pin, wipeOut } = sizes[i];
    const prev = out[i - 1];
    const wipeIn = prev ? prev.wipeOut : 0;
    const tail = tails[i];
    out.push({
      ...m,
      start,
      wipeIn,
      pin,
      wipeOut,
      tail,
      len: wipeIn + pin + wipeOut + tail,
      overlap: prev ? prev.wipeOut + prev.tail : 0,
      firstBeatAt: start + wipeIn,
    });
    start += wipeIn + pin;
  });
  return out;
})();

const ACT_BY_ID = Object.fromEntries(ACTS.map((a) => [a.id, a])) as Record<ActId, Act>;

/** Where a hash link to an act should land: a beat and a point inside it. */
export const ACT_LANDING: Record<ActId, { beat: BeatId; at: number }> = {
  read: { beat: "hero", at: 0 },
  board: { beat: "saved", at: 0.85 },
  prep: { beat: "unfold", at: 0.6 },
  seat: { beat: "seat", at: 0.6 },
};

export function beatOf(id: BeatId): Beat {
  return BEATS[BEAT_INDEX[id]];
}
export function actOf(id: ActId): Act {
  return ACT_BY_ID[id];
}
/** Story position (units) of a point inside a beat. */
export function beatPosition(id: BeatId, at = 0): number {
  return BEAT_START[id] + beatOf(id).vh * at;
}

/**
 * Is a panel that lists `beats` on screen while `current` is the beat?
 * A panel also stays up through the wipe that follows its last beat (outgoing
 * stage) and through the wipe that precedes its first beat (incoming stage).
 */
export function panelIsCurrent(beats: readonly BeatId[], current: BeatId): boolean {
  if (beats.includes(current)) return true;
  const i = BEAT_INDEX[current];
  if (BEATS[i].kind !== "wipe") return false;
  const before = BEATS[i - 1]?.id;
  const after = BEATS[i + 1]?.id;
  return (before !== undefined && beats.includes(before)) || (after !== undefined && beats.includes(after));
}

/** Should an act's stage be visible while `current` is the beat? */
export function stageIsActive(act: ActId, current: BeatId): boolean {
  const b = beatOf(current);
  if (b.act === act) return true;
  if (b.kind !== "wipe") return false;
  return BEATS[BEAT_INDEX[current] + 1]?.act === act;
}

/* ───────────────────────────────────────────────────────────── tracks ── */

/**
 * Where one end of a line move is.
 * - `{ y }`: full viewport width at a fraction of the stage height (0 top, 1 bottom).
 * - `{ anchor }`: spans the anchor's left to right edge at its `edge` (default "bottom").
 *   `span: "full"` keeps the anchor's y but runs the full viewport width.
 *   `weight` overrides the thickness; by default a thin anchor (6px or less) lends its own height.
 */
export type LineTarget =
  | {
      y: number;
      weight?: number;
      /** Part of the viewport width to span, as fractions. Default [0, 1]. */
      x?: [number, number];
    }
  | {
      anchor: AnchorId;
      edge?: "top" | "center" | "bottom";
      span?: "anchor" | "full";
      weight?: number;
      /**
       * Part of the anchor's width to span, as fractions from its left edge.
       * Default [0, 1]. `[0, 0.4]` on the Mon→Fri strip is "Monday to the end of Tuesday".
       */
      x?: [number, number];
      /** Offset from the edge in px (positive is down). */
      dy?: number;
      /** Take x from the anchor but put the line at this fraction of the stage height instead. */
      atY?: number;
      /** Anchor to use while `anchor` is not on the page. */
      or?: AnchorId;
    };

export type LineMove = {
  /** Sub-range of beat progress this move is scrubbed over. Before it the line holds `from`, after it `to`. */
  range: [number, number];
  from: LineTarget;
  to: LineTarget;
  /** The mono label at the line's right end during this move. "" for none. */
  label: string;
  /** This move is the chapter change: the screen is split at the line while it runs. */
  sweep?: boolean;
  /**
   * The line ends this move as a rule under copy. Its label is blanked once the
   * move completes, so a label never sits on the text the line underlines.
   */
  quiet?: boolean;
};

/** A time on the Mon→Fri strip as a fraction of its width (day 0 = Monday, hours 0..24). */
export const weekX = (day: number, hours: number) => (day * 24 + hours) / 120;
/**
 * The Mon→Fri strip above the board (`board-days`): five equal day cells, one
 * time axis. The line runs along its bottom edge from Monday's left edge and
 * its right end is scrubbed to the time the story has reached:
 *   saved      Monday 18:30     (where the board clock stands when the tile lands)
 *   applied    Tuesday 17:00    ("Applied Tue")
 *   interview  Thursday 11:40   the booked slot. The clock stops at "WED 16:05 · BOOKED":
 *              the line reads ahead of "now" to the interview, and stays there
 *              into the hinge. Nightfall is then, truly, the night before.
 */
export const BOARD_DAY_X = { mon: weekX(0, 18.5), tue: weekX(1, 17), wed: weekX(2, 16 + 5 / 60), thu: weekX(3, 11 + 40 / 60), fri: 1 } as const;
const DAYS = (to: number, or: AnchorId): LineTarget => ({ anchor: "board-days", x: [0, to], weight: LINE_W, or });

/**
 * Line weights, in px. The Line is one hand-drawn stroke: 3 at rest and while it travels
 * (--art-stroke), 1.5 when it docks as a rule under a header or a finished question. Never 1.
 */
const LINE_W = 3;
const RULE_W = 1.5;
const FULL_W = LINE_W;
/** Where the `ranked` stub starts, as a fraction of the viewport width (right of the list header text). */
const RANKED_STUB = 0.82;
const A = (anchor: AnchorId, extra: Partial<Extract<LineTarget, { anchor: AnchorId }>> = {}): LineTarget => ({ anchor, ...extra });
const Y = (y: number): LineTarget => ({ y, weight: FULL_W });

/**
 * Where the dawn's sunrise wipe starts, as dawn beat progress (round 5b). Before it the room is in
 * blue hour and the sheet flies into the ticket (ACTOR_TRACK.dawn); from it the Line rises and the
 * morning comes up under it (LINE_TRACK.dawn, SCENE_TRACK.dawn). One number, so the three agree.
 */
export const DAWN_WIPE = 0.45;

/** Scrubbed line moves per beat, transcribed from storyboard section 2. Tuned at integration against real anchors. */
export const LINE_TRACK: Record<BeatId, readonly LineMove[]> = {
  hero: [
    // The Line is the underline of "ready.". In the first 14 units it stretches to full width in
    // place. It then holds as a horizon while the room pushes past and the window opens
    // (SCENE_TRACK.hero), and rises to its reading position as the meadow arrives.
    { range: [0, 0.16], from: A("hero-underline", { edge: "center" }), to: A("hero-underline", { edge: "center", span: "full", weight: FULL_W }), label: copy.hero.lineLabels[0] },
    { range: [0.5, 1], from: A("hero-underline", { edge: "center", span: "full", weight: FULL_W }), to: Y(0.14), label: copy.hero.lineLabels[1] },
  ],
  pass1: [{ range: [0, 1], from: Y(0.14), to: Y(0.9), label: copy.pass1.lineLabel }],
  pass2: [{ range: [0, 1], from: Y(0.9), to: Y(0.14), label: copy.pass2.lineLabel }],
  // Docks from below. It first pulls in to a short stub at the right end of the list, clear of the
  // "12 fit your portfolio" header, drops just under the rule, then rises onto it while drawing leftward.
  ranked: [
    { range: [0.04, 0.22], from: Y(0.14), to: { y: 0.14, x: [RANKED_STUB, 1], weight: FULL_W }, label: copy.ranked.lineLabel },
    { range: [0.22, 0.4], from: { y: 0.14, x: [RANKED_STUB, 1], weight: FULL_W }, to: A("ranked-rule", { x: [0.86, 1], dy: 16, weight: RULE_W }), label: copy.ranked.lineLabel },
    { range: [0.4, 0.62], from: A("ranked-rule", { x: [0.86, 1], dy: 16, weight: RULE_W }), to: A("ranked-rule", { weight: RULE_W }), label: copy.ranked.lineLabel, quiet: true },
  ],
  // The Line becomes the fill of the card's 0-to-10 rule and stops at 9. No label: the card says it.
  reason: [{ range: [0, 0.35], from: A("ranked-rule", { weight: RULE_W }), to: A("card-meter", { edge: "center" }), label: "", quiet: true }],
  daybreak: [
    { range: [0, 0.2], from: A("card-meter", { edge: "center" }), to: Y(1), label: copy.daybreak.lineLabel },
    { range: [0.2, 1], from: Y(1), to: Y(0), label: copy.daybreak.lineLabel, sweep: true },
  ],
  // The board is read along time: the line rides the Mon→Fri strip and reaches the day of each step.
  saved: [{ range: [0, 0.6], from: Y(0), to: DAYS(BOARD_DAY_X.mon, "col-saved"), label: copy.saved.lineLabel }],
  applied: [{ range: [0.05, 0.6], from: DAYS(BOARD_DAY_X.mon, "col-saved"), to: DAYS(BOARD_DAY_X.tue, "col-applied"), label: copy.applied.lineLabel }],
  interview: [{ range: [0.05, 0.6], from: DAYS(BOARD_DAY_X.tue, "col-applied"), to: DAYS(BOARD_DAY_X.thu, "col-interview"), label: copy.interview.lineLabel }],
  hinge: [{ range: [0, 0.25], from: DAYS(BOARD_DAY_X.thu, "col-interview"), to: A("hinge-text", { weight: LINE_W }), label: "", quiet: true }],
  nightfall: [
    { range: [0, 0.15], from: A("hinge-text", { weight: LINE_W }), to: Y(0), label: copy.nightfall.lineLabel },
    { range: [0.15, 1], from: Y(0), to: Y(1), label: copy.nightfall.lineLabel, sweep: true },
  ],
  // The line first pulls in to the sheet's width along the bottom edge, then rises inside the sheet's
  // column to the fold: it never pokes out of the sheet's side into the night.
  unfold: [
    { range: [0, 0.3], from: Y(1), to: A("sheet-folded", { atY: 1, weight: FULL_W }), label: copy.unfold.lineLabel },
    { range: [0.3, 0.75], from: A("sheet-folded", { atY: 1, weight: FULL_W }), to: A("sheet-folded", { weight: RULE_W }), label: copy.unfold.lineLabel, quiet: true },
  ],
  q1: [{ range: [0, 0.2], from: A("sheet-folded", { weight: RULE_W }), to: A("sheet-q1"), label: copy.q1.lineLabel, quiet: true }],
  q2: [{ range: [0, 0.2], from: A("sheet-q1"), to: A("sheet-q2"), label: copy.q2.lineLabel, quiet: true }],
  q3: [{ range: [0, 0.2], from: A("sheet-q2"), to: A("sheet-q3"), label: copy.q3.lineLabel, quiet: true }],
  votes: [{ range: [0, 0.4], from: A("sheet-q3"), to: A("sheet-foot"), label: copy.votes.lineLabel, quiet: true }],
  // Round 5b: the Line drops to the floor and waits there through blue hour while the sheet flies
  // into the ticket; only then does it rise and bring the morning (DAWN_WIPE).
  dawn: [
    { range: [0, 0.15], from: A("sheet-foot"), to: Y(1), label: copy.dawn.lineLabel },
    { range: [DAWN_WIPE, 1], from: Y(1), to: Y(0), label: copy.dawn.lineLabel, sweep: true },
  ],
  seat: [{ range: [0, 0.3], from: Y(0), to: A("ready-underline", { edge: "center" }), label: "", quiet: true }],
  footer: [{ range: [0, 1], from: A("ready-underline", { edge: "center" }), to: A("ready-underline", { edge: "center" }), label: "", quiet: true }],
};

/* ───────────────────────────────────────────────────────────── scenes ── */

/**
 * The painted scenes (research/reskin-brief.md). One room and one meadow, at four times of day,
 * plus the plain paper of the day chapters.
 *   desk-night     11:25 PM. The desk by the open window, lamp on, the laptop showing matches.
 *   meadow-night   Outside: the firefly meadow. The 2,340 roles are the fireflies.
 *   paper          Day: cream paper with grain. The board lives here.
 *   desk-lamp      The same desk, framed close under the lamp. The sheet unfolds here.
 *   desk-bluehour  The same room just before dawn, lamp still on.
 *   desk-dawn      The same room in golden morning light. The seat ticket lives here.
 */
export type SceneId = "desk-night" | "meadow-night" | "paper" | "desk-lamp" | "desk-bluehour" | "desk-dawn";

/**
 * How one scene gives way to the next.
 *   push   the camera pushes through the window (hero): scrubbed 0..1, the World owns the look
 *   wipe   the Line performs it: the split is at state.dayTop, and `mix` is how far the sweep has run
 *   fade   a plain crossfade of two paintings of the same room
 */
export type SceneKind = "push" | "wipe" | "fade";

export type SceneMove = {
  /** Sub-range of beat progress this change is scrubbed over (linear). */
  range: [number, number];
  to: SceneId;
  kind: SceneKind;
};

/**
 * The scene on screen per beat, and the changes inside a beat. A beat's `scene` is what it opens
 * on; each move hands over to its `to`, in order. Wipe ranges match the sweep in LINE_TRACK.
 */
export const SCENE_TRACK: Record<BeatId, { scene: SceneId; moves?: readonly SceneMove[] }> = {
  // Signature move 1: through the window. The room scales past and we arrive in the meadow.
  hero: { scene: "desk-night", moves: [{ range: [0.16, 0.92], to: "meadow-night", kind: "push" }] },
  pass1: { scene: "meadow-night" },
  pass2: { scene: "meadow-night" },
  ranked: { scene: "meadow-night" },
  reason: { scene: "meadow-night" },
  daybreak: { scene: "meadow-night", moves: [{ range: [0.2, 1], to: "paper", kind: "wipe" }] },
  saved: { scene: "paper" },
  applied: { scene: "paper" },
  interview: { scene: "paper" },
  hinge: { scene: "paper" },
  nightfall: { scene: "paper", moves: [{ range: [0.15, 1], to: "desk-lamp", kind: "wipe" }] },
  unfold: { scene: "desk-lamp" },
  q1: { scene: "desk-lamp" },
  q2: { scene: "desk-lamp" },
  q3: { scene: "desk-lamp" },
  votes: { scene: "desk-lamp" },
  // Signature move 2: sunrise in the room. The lamp-lit night cools to blue hour while the Line
  // drops to the floor, then the Line rises and golden morning comes up under it.
  dawn: {
    scene: "desk-lamp",
    moves: [
      { range: [0, 0.15], to: "desk-bluehour", kind: "fade" },
      { range: [DAWN_WIPE, 1], to: "desk-dawn", kind: "wipe" },
    ],
  },
  seat: { scene: "desk-dawn" },
  footer: { scene: "desk-dawn" },
};


/** A value that either follows the Actor's travel or plays on its own clock. */
export type ActorChannel =
  | {
      from: number;
      to: number;
      drive: "travel";
      /**
       * Part of the travel (0..1) this channel runs over: before it the channel holds `from`, after
       * it `to`. Default [0, 1]. Scroll-bound like the travel, so it can never be left half-played.
       */
      range?: [number, number];
    }
  | {
      from: number;
      to: number;
      drive: "timed";
      /** Beat progress at which it starts (it reverses when scrolled back above this point). */
      at: number;
      /** Seconds. */
      duration: number;
      /** Seconds to wait after `at`. */
      delay?: number;
    };

export type ActorMove = {
  from: AnchorId;
  to: AnchorId;
  /** The face worn at `to`. */
  face: FaceId;
  /** The face worn at `from`, when it differs. Crossfades at travel midpoint, or flips when `flip` is set. */
  faceFrom?: FaceId;
  /**
   * "scrub": travel is bound to beat progress over `range` (linear).
   * "timed": travel plays over `duration` seconds once beat progress passes range[0].
   */
  mode: "scrub" | "timed";
  /** Default [0, 1]. */
  range?: [number, number];
  /** Seconds, timed mode only. Default 0.8. */
  duration?: number;
  /** Arc peak as a fraction of the distance, perpendicular to travel. Default 0.06. */
  arc?: number;
  /** Peak lean into the direction of travel, degrees. Default 4. Always 0 while the line splits the Actor. */
  lean?: number;
  /** Rest rotation at from and to, degrees. */
  rotate?: [number, number];
  /** Sheet fold: 0 folded, 1 open. Default: constant 1. */
  fold?: ActorChannel;
  /** 0 front (faceFrom), 1 back (face): one rotateY(180deg). */
  flip?: ActorChannel;
  /** When travel completes, hand over to the real DOM face in the `to` anchor and hide the Actor. */
  dock?: boolean;
  /** Beat-progress range over which the Actor fades in (its birth). */
  fadeIn?: [number, number];
  /**
   * false: no face change mid-travel. The from-face is worn all the way and the to-face takes
   * over at travel 1. Use it when the two faces are drawn identically at the `to` anchor.
   */
  crossfade?: boolean;
};

/** The Actor's journey per beat, transcribed from storyboard section 2. Beats without an entry have no Actor. */
export const ACTOR_TRACK: Partial<Record<BeatId, ActorMove>> = {
  // Born as row 1, as the gold speck lands on it.
  ranked: { from: "row-1", to: "row-1", face: "row", mode: "scrub", fadeIn: [0.22, 0.34] },
  reason: { from: "row-1", to: "card", faceFrom: "row", face: "card", mode: "scrub", range: [0, 0.35] },
  // Does not move: the line cuts it into two skins.
  daybreak: { from: "card", to: "card", face: "card", mode: "scrub" },
  saved: { from: "card", to: "tile-saved", faceFrom: "card", face: "tile", mode: "scrub", range: [0.05, 0.7] },
  applied: { from: "tile-saved", to: "tile-applied", face: "tile", mode: "timed", range: [0.2, 1], duration: 0.8 },
  interview: { from: "tile-applied", to: "tile-interview", face: "tile", mode: "timed", range: [0.2, 1], duration: 0.8 },
  hinge: { from: "tile-interview", to: "hinge-float", face: "tile", mode: "scrub", range: [0, 0.3], rotate: [0, 6] },
  nightfall: {
    from: "hinge-float",
    to: "sheet-folded",
    faceFrom: "tile",
    face: "sheet",
    mode: "scrub",
    range: [0.15, 1],
    rotate: [6, 0],
    fold: { from: 0, to: 0, drive: "travel" },
    // The tile IS the folded sheet's cover: it grows into place and the sheet takes over unseen.
    crossfade: false,
  },
  // Scrubbed (round 5b): the sheet opens with the wheel, so a fast scroll can never skip the unfold
  // and land on an open sheet in one frame. Done by 0.7, while the Line is still rising to the fold.
  unfold: {
    from: "sheet-folded",
    to: "sheet",
    face: "sheet",
    mode: "scrub",
    range: [0.04, 0.7],
    arc: 0,
    lean: 0,
    fold: { from: 0, to: 1, drive: "travel" },
    dock: true,
  },
  q1: { from: "sheet", to: "sheet", face: "sheet", mode: "scrub", dock: true },
  q2: { from: "sheet", to: "sheet", face: "sheet", mode: "scrub", dock: true },
  q3: { from: "sheet", to: "sheet", face: "sheet", mode: "scrub", dock: true },
  votes: { from: "sheet", to: "sheet", face: "sheet", mode: "scrub", dock: true },
  // The open sheet's top panel is `sheet-folded`, so travel starts from there while the fold closes.
  // Round 5b: every channel is scroll-bound and the whole flight happens in blue hour, before the
  // sunrise wipe (SCENE_TRACK.dawn from DAWN_WIPE): it folds as it lifts, turns over into the
  // ticket mid-flight and rests on the ticket's place before "Walk in / ready." comes up.
  dawn: {
    from: "sheet-folded",
    to: "ticket",
    faceFrom: "sheet",
    face: "ticket",
    mode: "scrub",
    range: [0.04, DAWN_WIPE - 0.03],
    rotate: [0, -2],
    fold: { from: 1, to: 0, drive: "travel", range: [0, 0.4] },
    flip: { from: 0, to: 1, drive: "travel", range: [0.38, 0.8] },
  },
  seat: { from: "ticket", to: "ticket", face: "ticket", mode: "scrub", dock: true },
  footer: { from: "ticket", to: "ticket", face: "ticket", mode: "scrub", dock: true },
};

/** Travel easing for timed moves: cubic-bezier(0.65, 0, 0.15, 1). */
export const travelEase = cubicBezier(0.65, 0, 0.15, 1);

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const fx = ((ax * t + bx) * t + cx) * t - x;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(fx) < 1e-5 || d === 0) break;
      t -= fx / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ────────────────────────────────────────────────────────────── store ── */

type BeatHandlers = { enter?: (direction: Direction) => void; leave?: (direction: Direction) => void };
type BeatChangeFn = (beat: BeatId, previous: BeatId, direction: Direction) => void;
type FramePhase = "actor" | "line" | "world";
type FrameFn = (time: number, dt: number, state: StoryState) => void;
type ScrollOpts = { immediate?: boolean; duration?: number };

/** The slice of Lenis the store uses. */
export type LenisLike = {
  scrollTo: (target: number, options?: { immediate?: boolean; duration?: number; easing?: (t: number) => number; force?: boolean }) => void;
};

type Feed = { p: number; start: number; end: number; live: boolean };

const state: StoryState = {
  beat: "hero",
  beatProgress: 0,
  act: "read",
  actProgress: 0,
  pageProgress: 0,
  pos: 0,
  direction: 1,
  velocity: 0,
  chapter: "night",
  dayTop: 100000,
  line: { x0: 0, x1: 0, y: 0, daySide: "none", label: copy.hero.lineLabels[0], weight: FULL_W, sweep: false, rest: false },
  scene: { id: "desk-night", to: null, kind: null, mix: 0, progress: 0 },
  actor: { present: false, docked: false, face: null, x: 0, y: 0, w: 0, h: 0, travel: 0, fold: 1, flip: 0 },
  pointer: { x: 0, y: 0, inside: false, fine: false },
  viewport: { w: 0, h: 0 },
  flags: { reduced: false, small: false, coarse: false, gl: false },
};

const feeds: Record<ActId | "tail", Feed> = {
  read: { p: 0, start: 0, end: 0, live: false },
  board: { p: 0, start: 0, end: 0, live: false },
  prep: { p: 0, start: 0, end: 0, live: false },
  seat: { p: 0, start: 0, end: 0, live: false },
  tail: { p: 0, start: 0, end: 0, live: false },
};

const subscribers = new Set<(s: StoryState) => void>();
const beatHandlers = new Map<BeatId, Set<BeatHandlers>>();
const beatChangeFns = new Set<BeatChangeFn>();
const phases: Record<FramePhase, Set<FrameFn>> = { actor: new Set(), line: new Set(), world: new Set() };

/** Line scopes: element → does it take --line-y too (true), or only --day-top / --day-side (false). */
const scopes = new Map<HTMLElement, boolean>();
let lenis: LenisLike | null = null;
let running = false;
let dirty = true;
let fedVelocity = 0;
let fedThisFrame = false;
let needsViewport = true;
let lineReady = false;
let lastCss = { lineY: "", dayTop: "", daySide: "", chapter: "", beat: "", wipe: "" };
const activeIds: (AnchorId | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined];
const resolved = { a: { x0: 0, x1: 0, y: 0, w: FULL_W, ok: false }, b: { x0: 0, x1: 0, y: 0, w: FULL_W, ok: false } };

function readFlags() {
  const d = document.documentElement;
  state.flags.reduced = d.classList.contains("reduced") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  state.flags.small = window.matchMedia("(max-width: 767px)").matches;
  state.flags.coarse = window.matchMedia("(pointer: coarse)").matches;
  state.pointer.fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function readViewport() {
  const stage = document.querySelector<HTMLElement>(".story-stage");
  state.viewport.w = document.documentElement.clientWidth;
  // Stages are 100svh: on mobile that can be shorter than innerHeight.
  state.viewport.h = (stage && stage.offsetHeight) || window.innerHeight;
  needsViewport = false;
}

function computePos(): number {
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i];
    const f = feeds[a.id];
    if (f.live && f.p > 0 && f.p < 1) return a.start + f.p * a.len;
  }
  const seat = feeds.seat;
  if (seat.live && seat.p >= 1) return FOOTER_AT + (feeds.tail.live ? feeds.tail.p : 0) * beatOf("footer").vh;
  // Between ranges (exact boundaries): take the furthest completed act.
  for (let i = ACTS.length - 1; i >= 0; i--) {
    const a = ACTS[i];
    if (feeds[a.id].live && feeds[a.id].p >= 1) return a.start + a.len;
  }
  return 0;
}

/** One stretch of the story where a scene owns the screen, in story units. */
type SceneRun = { id: SceneId; start: number; end: number };
/** Every scene change in scroll order, with absolute positions. */
const SCENE_MOVES: { at: number; until: number; from: SceneId; to: SceneId; kind: SceneKind }[] = [];
const SCENE_RUNS: SceneRun[] = [];
{
  let current: SceneId = SCENE_TRACK[BEATS[0].id].scene;
  let runStart = 0;
  BEATS.forEach((b) => {
    const base = BEAT_START[b.id];
    (SCENE_TRACK[b.id].moves ?? []).forEach((m) => {
      const at = base + m.range[0] * b.vh;
      const until = base + m.range[1] * b.vh;
      SCENE_MOVES.push({ at, until, from: current, to: m.to, kind: m.kind });
      // A scene's run ends when it has fully given way.
      SCENE_RUNS.push({ id: current, start: runStart, end: until });
      current = m.to;
      runStart = until;
    });
  });
  SCENE_RUNS.push({ id: current, start: runStart, end: TOTAL });
}

function computeScene(pos: number) {
  const sc = state.scene;
  let run = 0;
  while (run < SCENE_RUNS.length - 1 && pos >= SCENE_RUNS[run].end) run++;
  const r = SCENE_RUNS[run];
  const move = SCENE_MOVES[run];
  let to: SceneId | null = null;
  let kind: SceneKind | null = null;
  let mix = 0;
  if (move && pos > move.at) {
    to = move.to;
    kind = move.kind;
    mix = clamp01((pos - move.at) / (move.until - move.at || 1));
  }
  const progress = clamp01((pos - r.start) / (r.end - r.start || 1));
  if (sc.id !== r.id || sc.to !== to || sc.mix !== mix || sc.progress !== progress) dirty = true;
  sc.id = r.id;
  sc.to = to;
  sc.kind = kind;
  sc.mix = mix;
  sc.progress = progress;
}

/** The scene a beat opens on. */
export function sceneOf(beat: BeatId): SceneId {
  return SCENE_TRACK[beat].scene;
}

function resolveTarget(t: LineTarget, out: { x0: number; x1: number; y: number; w: number; ok: boolean }) {
  const { w: vw, h: vh } = state.viewport;
  if ("y" in t) {
    out.x0 = t.x ? t.x[0] * vw : 0;
    out.x1 = t.x ? t.x[1] * vw : vw;
    out.y = t.y * vh;
    out.w = t.weight ?? FULL_W;
    out.ok = true;
    return;
  }
  let r = anchorRect(t.anchor);
  let fallback = false;
  if (!r && t.or) {
    r = anchorRect(t.or);
    fallback = true;
  }
  if (!r) {
    out.ok = false;
    return;
  }
  const edge = t.edge ?? "bottom";
  out.y = t.atY !== undefined ? t.atY * vh : (edge === "top" ? r.y : edge === "center" ? r.y + r.h / 2 : r.y + r.h) + (t.dy ?? 0);
  if (t.span === "full") {
    out.x0 = 0;
    out.x1 = vw;
  } else if (t.x && !fallback) {
    out.x0 = r.x + r.w * t.x[0];
    out.x1 = r.x + r.w * t.x[1];
  } else {
    out.x0 = r.x;
    out.x1 = r.x + r.w;
  }
  out.w = t.weight ?? (r.h > 0 && r.h <= 6 ? r.h : 1);
  out.ok = true;
}

function currentMove(moves: readonly LineMove[], p: number): LineMove {
  let move = moves[0];
  for (let i = 0; i < moves.length; i++) {
    if (p >= moves[i].range[0]) move = moves[i];
  }
  return move;
}

function setBeat(index: number, direction: Direction) {
  const from = BEAT_INDEX[state.beat];
  if (index === from) return;
  const step = index > from ? 1 : -1;
  const dir: Direction = step === 1 ? 1 : -1;
  // Walk every beat that was crossed, so skipped performances still reach their end (or reset) state.
  for (let i = from; i !== index; i += step) {
    beatHandlers.get(BEATS[i].id)?.forEach((h) => h.leave?.(dir));
    beatHandlers.get(BEATS[i + step].id)?.forEach((h) => h.enter?.(dir));
  }
  const previous = state.beat;
  state.beat = BEATS[index].id;
  state.act = BEATS[index].act;
  beatChangeFns.forEach((fn) => fn(state.beat, previous, direction));
}

function writeScope(el: HTMLElement, lineY: boolean) {
  if (lineY && lastCss.lineY) el.style.setProperty("--line-y", `${lastCss.lineY}px`);
  if (lastCss.dayTop) el.style.setProperty("--day-top", `${lastCss.dayTop}px`);
  if (lastCss.daySide) el.style.setProperty("--day-side", lastCss.daySide);
}

function writeCss() {
  const d = document.documentElement;
  const lineY = state.line.y.toFixed(1);
  const dayTop = state.dayTop.toFixed(1);
  // Per-frame values go to the line scopes only (small subtrees), never to <html>.
  if (lineY !== lastCss.lineY) {
    lastCss.lineY = lineY;
    scopes.forEach((wantsLineY, el) => {
      if (wantsLineY) el.style.setProperty("--line-y", `${lineY}px`);
    });
  }
  if (dayTop !== lastCss.dayTop) {
    lastCss.dayTop = dayTop;
    scopes.forEach((_, el) => el.style.setProperty("--day-top", `${dayTop}px`));
  }
  if (state.line.daySide !== lastCss.daySide) {
    lastCss.daySide = state.line.daySide;
    scopes.forEach((_, el) => el.style.setProperty("--day-side", lastCss.daySide));
  }
  // Beat-boundary values stay on <html>.
  if (state.chapter !== lastCss.chapter) d.setAttribute("data-chapter", (lastCss.chapter = state.chapter));
  if (state.beat !== lastCss.beat) d.setAttribute("data-beat", (lastCss.beat = state.beat));
  const wipe = beatOf(state.beat).kind === "wipe" ? state.beat : "";
  if (wipe !== lastCss.wipe) {
    lastCss.wipe = wipe;
    if (wipe) d.setAttribute("data-wipe", wipe);
    else d.removeAttribute("data-wipe");
  }
}

/* ── breath ── */

export type BreathOptions = {
  /** Beat progress where the breath starts. Default 0.5. */
  from?: number;
  /** Beat progress where it reaches 1. Default 1 (the end of the beat). */
  to?: number;
  /** CSS variable to write. Default "--breath". */
  name?: string;
  /** Value under reduced motion (written once). Default 1. */
  reduced?: number;
};

type Breath = { el: HTMLElement; beats: number[]; from: number; to: number; name: string; last: string };
const breaths = new Set<Breath>();

function breathValue(beats: readonly number[], from: number, to: number): number {
  const here = BEAT_INDEX[state.beat];
  let passed = false;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i] === here) return clamp01((state.beatProgress - from) / (to - from || 1));
    if (beats[i] < here) passed = true;
  }
  return passed ? 1 : 0;
}

function writeBreaths() {
  breaths.forEach((b) => {
    const v = breathValue(b.beats, b.from, b.to).toFixed(4);
    if (v !== b.last) b.el.style.setProperty(b.name, (b.last = v));
  });
}

function compute() {
  /* ── read phase ── */
  if (needsViewport) {
    readFlags();
    readViewport();
    dirty = true;
  }

  const pos = computePos();
  if (pos !== state.pos) {
    state.direction = pos > state.pos ? 1 : -1;
    dirty = true;
  }
  state.pos = pos;
  state.velocity = fedThisFrame ? fedVelocity : 0;
  fedThisFrame = false;

  let index = BEATS.length - 1;
  for (let i = 0; i < BEATS.length; i++) {
    if (pos < BEAT_START[BEATS[i].id] + BEATS[i].vh) {
      index = i;
      break;
    }
  }
  setBeat(index, state.direction);
  const beat = BEATS[index];
  state.beatProgress = clamp01((pos - BEAT_START[beat.id]) / beat.vh);
  const act = ACT_BY_ID[beat.act];
  state.actProgress = clamp01((pos - act.firstBeatAt) / (act.pin + act.wipeOut || 1));
  state.pageProgress = clamp01(pos / TOTAL);
  computeScene(pos);

  const move = currentMove(LINE_TRACK[beat.id], state.beatProgress);
  const actorMove = ACTOR_TRACK[beat.id];
  activeIds[0] = "anchor" in move.from ? move.from.anchor : undefined;
  activeIds[1] = "anchor" in move.to ? move.to.anchor : undefined;
  activeIds[2] = actorMove?.from;
  activeIds[3] = actorMove?.to;
  activeIds[4] = "anchor" in move.from ? move.from.or : undefined;
  activeIds[5] = "anchor" in move.to ? move.to.or : undefined;
  measureAnchorFrame(activeIds);

  /* ── derive ── */
  const line = state.line;
  const { a, b } = resolved;
  resolveTarget(move.from, a);
  resolveTarget(move.to, b);
  const t = clamp01((state.beatProgress - move.range[0]) / (move.range[1] - move.range[0] || 1));
  let x0 = line.x0;
  let x1 = line.x1;
  let y = line.y;
  let weight = line.weight;
  if (a.ok && b.ok) {
    x0 = lerp(a.x0, b.x0, t);
    x1 = lerp(a.x1, b.x1, t);
    y = lerp(a.y, b.y, t);
    weight = lerp(a.w, b.w, t);
  } else if (a.ok || b.ok) {
    const one = a.ok ? a : b;
    x0 = one.x0;
    x1 = one.x1;
    y = one.y;
    weight = one.w;
  } else if (!lineReady) {
    x0 = 0;
    x1 = state.viewport.w;
    y = state.viewport.h * 0.58;
  }
  lineReady = true;
  const rest = state.beatProgress >= move.range[1] && "anchor" in move.to;
  const label = move.quiet && rest ? "" : move.label;
  const sweeping = Boolean(move.sweep);
  const vh = state.viewport.h;
  let dayTop: number;
  let chapter: Chapter;
  if (beat.kind === "wipe") {
    if (sweeping) {
      dayTop = Math.min(vh, Math.max(0, y));
    } else {
      // Before the sweep starts the screen is still the outgoing chapter.
      dayTop = act.chapter === "night" ? vh : 0;
    }
    chapter = dayTop < vh / 2 ? "day" : "night";
  } else {
    chapter = act.chapter;
    dayTop = chapter === "night" ? vh : 0;
  }
  const daySide: DaySide = sweeping && dayTop > 0 && dayTop < vh ? "below" : "none";
  if (
    x0 !== line.x0 ||
    x1 !== line.x1 ||
    y !== line.y ||
    weight !== line.weight ||
    label !== line.label ||
    daySide !== line.daySide ||
    dayTop !== state.dayTop
  ) {
    dirty = true;
  }
  line.x0 = x0;
  line.x1 = x1;
  line.y = y;
  line.weight = weight;
  line.label = label;
  line.rest = rest;
  line.daySide = daySide;
  line.sweep = sweeping;
  state.dayTop = dayTop;
  state.chapter = chapter;

  /* ── write phase starts here ── */
  writeCss();
  if (dirty) writeBreaths();
}

function tick(time: number, deltaMs: number) {
  if (!running) return;
  const dt = Math.min(0.1, deltaMs / 1000);
  compute();
  if (dirty) {
    dirty = false;
    subscribers.forEach((fn) => fn(state));
  }
  phases.actor.forEach((fn) => fn(time, dt, state));
  phases.line.forEach((fn) => fn(time, dt, state));
  phases.world.forEach((fn) => fn(time, dt, state));
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === "touch") return;
  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.inside = true;
  dirty = true;
}
function onPointerLeave() {
  state.pointer.inside = false;
  dirty = true;
}
function onResize() {
  needsViewport = true;
}

function pxFor(pos: number): number | null {
  if (pos >= FOOTER_AT) {
    const f = feeds.tail;
    if (!f.live) return null;
    return f.start + ((pos - FOOTER_AT) / beatOf("footer").vh) * (f.end - f.start);
  }
  // The last act whose pinned range contains the position owns it.
  for (let i = ACTS.length - 1; i >= 0; i--) {
    const a = ACTS[i];
    const f = feeds[a.id];
    if (f.live && pos >= a.start) return f.start + ((pos - a.start) / a.len) * (f.end - f.start);
  }
  return null;
}

export const story = {
  /** The live state. Same object on every call: read it, never mutate or keep it. */
  get(): Readonly<StoryState> {
    return state;
  },

  /** Called after compute on every frame the state changed. Write only: no layout reads. */
  subscribe(fn: (s: Readonly<StoryState>) => void): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  /** Run `fn` every frame in a fixed slot of the frame loop: "actor", then "line", then "world". */
  frame(phase: FramePhase, fn: (time: number, dt: number, s: Readonly<StoryState>) => void): () => void {
    phases[phase].add(fn);
    return () => phases[phase].delete(fn);
  },

  /** Beat transitions. Every crossed beat fires, in scroll order, even when several are skipped in one frame. */
  onBeat(id: BeatId, handlers: BeatHandlers): () => void {
    let set = beatHandlers.get(id);
    if (!set) beatHandlers.set(id, (set = new Set()));
    set.add(handlers);
    return () => set.delete(handlers);
  },

  /** Called once after the current beat changes (after the per-beat enter/leave handlers). */
  onBeatChange(fn: BeatChangeFn): () => void {
    beatChangeFns.add(fn);
    return () => beatChangeFns.delete(fn);
  },

  /** React hook: the current beat. Re-renders on beat change only. */
  useBeat(): BeatId {
    return useSyncExternalStore(
      story.onBeatChange,
      () => state.beat,
      () => "hero" as BeatId,
    );
  },

  /** Scroll to a point inside a beat (`at` 0..1). Uses Lenis when present; jumps under reduced motion. */
  scrollToBeat(id: BeatId, at = 0, opts: ScrollOpts = {}) {
    if (typeof window === "undefined") return;
    if (!running || state.flags.reduced) {
      const el = document.querySelector<HTMLElement>(`[data-beats~="${id}"]`) ?? document.getElementById(ACT_BY_ID[beatOf(id).act].domId);
      el?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    const px = pxFor(beatPosition(id, at));
    if (px === null) return;
    // Land just inside the beat, never on the boundary.
    const top = Math.round(px) + (at <= 0 ? 2 : 0);
    if (lenis) {
      lenis.scrollTo(top, opts.immediate ? { immediate: true, force: true } : { duration: opts.duration ?? 1.6, easing: scrollEase, force: true });
    } else {
      window.scrollTo({ top, behavior: opts.immediate ? "instant" : "smooth" });
    }
  },

  /** Scroll to an act's landing point (see ACT_LANDING). */
  scrollToAct(id: ActId, opts: ScrollOpts = {}) {
    const { beat, at } = ACT_LANDING[id];
    story.scrollToBeat(beat, at, opts);
  },

  /** Mark the state dirty so subscribers run next frame. */
  invalidate() {
    dirty = true;
  },

  /**
   * Write a scrubbed 0..1 CSS variable (default `--breath`) on `el`: 0 until beat
   * progress reaches `from`, linear to 1 at `to`, 0 before the beat, 1 after it.
   * With several beats the value restarts in each. Written only when it changes.
   */
  breath(el: HTMLElement, beat: BeatId | readonly BeatId[], opts: BreathOptions = {}): () => void {
    const name = opts.name ?? "--breath";
    if (story.reduced()) {
      el.style.setProperty(name, String(opts.reduced ?? 1));
      return () => {};
    }
    const beats = (typeof beat === "string" ? [beat] : beat).map((b) => BEAT_INDEX[b]).sort((x, y) => x - y);
    const entry: Breath = { el, beats, from: opts.from ?? 0.5, to: opts.to ?? 1, name, last: "" };
    entry.last = breathValue(beats, entry.from, entry.to).toFixed(4);
    el.style.setProperty(name, entry.last);
    breaths.add(entry);
    return () => {
      breaths.delete(entry);
    };
  },

  /** The breath value for a beat right now, for JS that cannot use the CSS variable. */
  breathOf(beat: BeatId | readonly BeatId[], from = 0.5, to = 1): number {
    const beats = (typeof beat === "string" ? [beat] : beat).map((b) => BEAT_INDEX[b]);
    return breathValue(beats, from, to);
  },

  /** React ref callback for `story.breath`. Keep `opts` values primitive: they are the hook's dependencies. */
  useBreath(beat: BeatId | readonly BeatId[], opts: BreathOptions = {}): (el: HTMLElement | null) => void | (() => void) {
    const key = typeof beat === "string" ? beat : beat.join(" ");
    const { from, to, name, reduced } = opts;
    return useCallback(
      (el: HTMLElement | null) => {
        if (!el) return;
        return story.breath(el, key.split(" ") as BeatId[], { from, to, name, reduced });
      },
      [key, from, to, name, reduced],
    );
  },

  /**
   * Make `el` a line scope: it receives --line-y, --day-top and --day-side every
   * frame they change. They do not inherit: `el` is the element whose rule reads them.
   * `lineY: false` leaves --line-y out: --day-top only moves during a wipe, while
   * --line-y moves on almost every scroll frame, so a scope that only splits at
   * the wipe (nav, rail) should not take it.
   */
  lineScope(el: HTMLElement, opts: { lineY?: boolean } = {}): () => void {
    const lineY = opts.lineY ?? true;
    scopes.set(el, lineY);
    writeScope(el, lineY);
    return () => {
      scopes.delete(el);
    };
  },

  /* ── wiring: used by StoryRoot, SmoothScroll and Actor only ── */

  /** One ScrollTrigger per act section (and one for the tail) reports here. */
  feed(id: ActId | "tail", progress: number, start: number, end: number, velocity = 0) {
    const f = feeds[id];
    f.p = progress;
    f.start = start;
    f.end = end;
    f.live = true;
    fedVelocity = velocity;
    fedThisFrame = true;
  },

  attachLenis(instance: LenisLike | null) {
    lenis = instance;
  },

  /** Start the frame loop. Returns stop. Client only. */
  start(flags: { gl: boolean }): () => void {
    // The boot script set html.motion / html.reduced before first paint. If React had to re-create
    // <html> (a hydration error does that), the class is gone: put it back rather than fall to static.
    const cl = document.documentElement.classList;
    if (!cl.contains("motion") && !cl.contains("reduced")) {
      cl.add(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "motion");
    }
    readFlags();
    state.flags.gl = flags.gl;
    if (state.flags.reduced) return () => {};
    running = true;
    needsViewport = true;
    dirty = true;
    gsap.ticker.add(tick);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      running = false;
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      (Object.keys(feeds) as (ActId | "tail")[]).forEach((k) => (feeds[k].live = false));
      lastCss = { lineY: "", dayTop: "", daySide: "", chapter: "", beat: "", wipe: "" };
    };
  },

  /** Client: has the visitor asked for reduced motion (decided at first paint by the boot script)? */
  reduced(): boolean {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("reduced") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  /** True once start() has run and motion is allowed. */
  isRunning() {
    return running;
  },

  /** Actor engine only. */
  actorState() {
    return state.actor;
  },

  /** The element registered for an anchor (convenience re-export for write-phase code). */
  anchorElement,
};

function scrollEase(t: number) {
  // expo.inOut-ish: quick to leave, long to settle.
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

export type Story = typeof story;
