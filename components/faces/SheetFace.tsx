"use client";

/**
 * SHEET FACE — the prep sheet the Role unfolds into (storyboard 2.6, 5.3).
 *
 * Two hosts, one look:
 * - host "dock": the real <article> in Act III. Flat (it only ever shows open).
 *   Holds the semantic questions, the real vote buttons, the typing
 *   performances of q1..q3, the vote demo, and the anchors sheet-q1..3 and
 *   sheet-foot that the Line docks on.
 * - host "actor": the flying, aria-hidden copy. Three paper panels on hinges,
 *   driven every frame by the Actor's fold value, with moving fold shadows and a
 *   little physical overshoot. Its content is the same layout as the dock copy,
 *   seen through three 240px windows, so the hand-over is pixel-identical.
 */

import { useEffect, useMemo, useRef, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import { registerAnchor, type AnchorId } from "@/lib/anchors";
import { pkg3Copy, storyCopy, theRole } from "@/lib/content";
import { usePerformance } from "@/lib/perform";
import { BEATS, clamp01, story, type BeatId } from "@/lib/story";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { asked, prepState, usePrepState, type Vote } from "@/components/acts/prep/prepState";
import { TileFace } from "./TileFace";
import "./sheet.css";

/** The folded sheet's cover is the tile face scaled to the folded panel's height (240 / 92). */
const TILE_H = 92;
const COVER_SCALE = 240 / TILE_H;

const QUESTIONS = [storyCopy.q1, storyCopy.q2, storyCopy.q3] as const;
const Q_BEATS: readonly BeatId[] = ["q1", "q2", "q3"];
const order = (b: BeatId) => BEATS.findIndex((x) => x.id === b);
/** Where the lamp's pool rests at the end of `votes` (and in the flying copy during the dawn). */
const LAMP_END = 92;

/* ───────────────────────────────────────────────────────────── icons ── */

function SourceIcon({ index }: { index: number }) {
  const common = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (index === 0)
    // the job description: a page with lines
    return (
      <svg {...common}>
        <path d="M4 1.75h5.5L12.5 4.75v9.5H4z" />
        <path d="M6.25 7.5h4M6.25 10h4M6.25 5h1.5" />
      </svg>
    );
  if (index === 1)
    // your case study: a framed artboard
    return (
      <svg {...common}>
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d="M2 10.5l3.5-3 3 2.5 2-1.5L14 11" />
      </svg>
    );
  // asked here before: people
  return (
    <svg {...common}>
      <circle cx="6" cy="5.5" r="2.25" />
      <path d="M1.75 13.5c.6-2.3 2.2-3.5 4.25-3.5s3.65 1.2 4.25 3.5" />
      <path d="M10.5 3.5a2.1 2.1 0 010 4.1M12 10.3c1.1.5 1.9 1.6 2.25 3.2" />
    </svg>
  );
}

function VoteIcon({ kind }: { kind: "asked" | "not-asked" }) {
  return kind === "asked" ? (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M4 8h8" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────── vote button ── */

const DOTS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return { x: Math.cos(a), y: Math.sin(a) };
});

function VoteButton({ index, kind, pressed, live }: { index: number; kind: "asked" | "not-asked"; pressed: boolean; live: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!live) return;
    return prepState.onBurst((i, source) => {
      const el = ref.current;
      if (!el || i !== index || story.reduced()) return;
      if (source === "demo") {
        // The demo presses the button itself.
        el.animate([{ transform: "scale(1)" }, { transform: "scale(0.92)", offset: 0.35 }, { transform: "scale(1)" }], { duration: 380, easing: "cubic-bezier(0.16,1,0.3,1)" });
      }
      if (kind !== "asked") return;
      const w = el.offsetWidth;
      DOTS.forEach((d) => {
        const dot = document.createElement("span");
        dot.className = "sh-dot";
        dot.setAttribute("aria-hidden", "true");
        el.appendChild(dot);
        const rx = w * 0.62;
        const ry = el.offsetHeight * 0.95;
        dot.animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: `translate(${(d.x * rx).toFixed(1)}px,${(d.y * ry).toFixed(1)}px) scale(0.4)`, opacity: 0 },
          ],
          { duration: 560, easing: "cubic-bezier(0.16,1,0.3,1)" },
        ).onfinish = () => dot.remove();
      });
    });
  }, [index, kind, live]);

  const label = kind === "asked" ? storyCopy.votes.asked : storyCopy.votes.notAsked;
  return (
    <button
      ref={ref}
      type="button"
      className="sh-vote"
      data-kind={kind}
      data-vote={`${index}-${kind}`}
      aria-pressed={pressed}
      tabIndex={live ? undefined : -1}
      onClick={live ? () => prepState.press(index, kind) : undefined}
    >
      <VoteIcon kind={kind} />
      {label}
    </button>
  );
}

/* ────────────────────────────────────────────────────────── question ── */

type Glyph = { ch: string; word: number };

function glyphs(text: string): Glyph[] {
  const out: Glyph[] = [];
  text.split(" ").forEach((w, wi, all) => {
    for (const ch of w) out.push({ ch, word: wi });
    if (wi < all.length - 1) out.push({ ch: " ", word: -1 });
  });
  return out;
}

/** Start time (s) of every character: 22ms each, 180ms after punctuation (storyboard 4). */
function schedule(text: string) {
  const starts: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    starts.push(t);
    t += /[,.?:;!]/.test(text[i]) ? 0.18 : 0.022;
  }
  return { starts, total: t };
}

/**
 * The dock copy types with one span per glyph, then swaps to a plain run once written
 * (data-done). Flying copies only ever draw the plain run, so nothing per-glyph is
 * re-rastered while the Actor travels, folds or flips.
 */
function QuestionText({ text, live, typed, els }: { text: string; live: boolean; typed: boolean; els: MutableRefObject<HTMLSpanElement[]> }) {
  const gs = useMemo(() => glyphs(text), [text]);
  if (!live) {
    return (
      <>
        {typed ? <span data-plain="">{text}</span> : null}
        <span className="sh-blank" aria-hidden="true" />
      </>
    );
  }

  // Words keep their letters together; spaces sit between words so lines can break.
  const words: ReactNode[] = [];
  let i = 0;
  while (i < gs.length) {
    const g = gs[i];
    if (g.word === -1) {
      const k = i;
      words.push(
        <span key={`s${k}`} className="sh-c" ref={(el) => void (el && (els.current[k] = el))}>
          {" "}
        </span>,
      );
      i++;
      continue;
    }
    const start = i;
    const letters: ReactNode[] = [];
    while (i < gs.length && gs[i].word === g.word) {
      const k = i;
      letters.push(
        <span key={k} className="sh-c" ref={(el) => void (el && (els.current[k] = el))}>
          {gs[k].ch}
        </span>,
      );
      i++;
    }
    words.push(
      <span key={`w${start}`} className="sh-w">
        {letters}
      </span>,
    );
  }
  return (
    <>
      {live ? <span className="sr-only">{text}</span> : null}
      <span aria-hidden="true" data-typed-run="">
        {words}
      </span>
      <span aria-hidden="true" data-plain="">
        {text}
      </span>
      <span className="sh-blank" aria-hidden="true" />
    </>
  );
}

type QuestionProps = {
  index: 0 | 1 | 2;
  live: boolean;
  /** Flying copy only: is this question already written? */
  typed: boolean;
  vote: Vote;
};

function Question({ index, live, typed, vote }: QuestionProps) {
  const q = QUESTIONS[index];
  const liRef = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const glyphEls = useRef<HTMLSpanElement[]>([]);
  const remeasure = useRef<() => void>(() => {});
  const textId = `sheet-q${index + 1}-text`;

  // Fonts and breakpoints can move the letters: measure again and redraw where the typing is.
  useEffect(() => {
    if (!live) return;
    const run = () => remeasure.current();
    document.fonts?.ready.then(run).catch(() => {});
    window.addEventListener("resize", run);
    return () => window.removeEventListener("resize", run);
  }, [live]);

  // The Line docks on this anchor (dock copy only, never the flying one).
  useEffect(() => {
    if (!live || !anchorRef.current) return;
    return registerAnchor(`sheet-q${index + 1}` as AnchorId, anchorRef.current);
  }, [live, index]);

  // Typing: scroll selects the question, time types it (storyboard 2.6).
  usePerformance(
    Q_BEATS[index],
    (tl) => {
      if (!live) return;
      const li = liRef.current;
      const text = textRef.current;
      const anchor = anchorRef.current;
      const caret = caretRef.current;
      const chip = chipRef.current;
      if (!li || !text || !anchor || !caret || !chip) return;
      const { starts, total } = schedule(q.question);
      const T = total + 0.03;
      type Box = { l: number; t: number; w: number; h: number };
      let boxes: Box[] = [];
      let stale = true;
      let shown = -1;
      let cur = 0;

      const measure = () => {
        const ox = text.offsetLeft;
        const oy = text.offsetTop;
        boxes = glyphEls.current.map((el) => ({ l: ox + el.offsetLeft, t: oy + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
        stale = false;
      };

      const render = (t: number) => {
        cur = t;
        // Written: a plain run (no per-glyph layers). Typing: the glyph run, measured when needed.
        text.toggleAttribute("data-done", t >= T);
        if (t < T && stale) measure();
        const els = glyphEls.current;
        let n = 0;
        while (n < starts.length && starts[n] < t) n++;
        if (t >= T) n = starts.length;
        if (n !== shown) {
          for (let i = 0; i < els.length; i++) {
            const want = i < n ? "" : "0";
            if (els[i].style.opacity !== want) els[i].style.opacity = want;
          }
          shown = n;
        }
        text.toggleAttribute("data-blank", t <= 0);
        li.toggleAttribute("data-unwritten", t < T);
        if (t >= T) {
          // At rest: the Line thins to the hairline rule under the question.
          anchor.removeAttribute("style");
          caret.removeAttribute("data-on");
          return;
        }
        // While typing, the Line's right end is the caret: it underlines the line being written.
        const last = boxes[Math.max(0, n - 1)];
        const first = boxes[0];
        if (!last || !first) return;
        const lineTop = n === 0 ? first.t : last.t;
        const lineH = n === 0 ? first.h : last.h;
        let lineLeft = first.l;
        for (let i = 0; i < n; i++) if (Math.abs(boxes[i].t - lineTop) < 2) { lineLeft = boxes[i].l; break; }
        const right = n === 0 ? first.l : last.l + last.w;
        const y = lineTop + lineH + 2;
        anchor.style.left = `${lineLeft}px`;
        anchor.style.right = "auto";
        anchor.style.bottom = "auto";
        anchor.style.top = `${y.toFixed(1)}px`;
        anchor.style.width = `${Math.max(0, right - lineLeft).toFixed(1)}px`;
        anchor.style.height = "2px";
        caret.style.left = `${(right + 1).toFixed(1)}px`;
        caret.style.top = `${(lineTop + lineH * 0.08).toFixed(1)}px`;
        caret.style.height = `${(lineH * 0.84).toFixed(1)}px`;
        caret.toggleAttribute("data-on", t > 0);
      };

      const proxy = { t: 0 };
      render(0);
      tl.to(proxy, {
        t: T,
        duration: T,
        ease: "none",
        onUpdate: () => render(proxy.t),
        onComplete: () => render(T),
        onReverseComplete: () => render(0),
      });
      tl.fromTo(chip, { autoAlpha: 0, y: 5, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.8)", clearProps: "transform" }, ">-0.02");

      remeasure.current = () => {
        stale = true;
        shown = -1;
        render(cur);
      };
    },
    [live, index],
  );

  const chipText = q.chip;
  return (
    <li ref={liRef} className="sh-q" data-q={index} data-unwritten={!live && !typed ? "" : undefined}>
      <span className="sh-num" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="sh-body">
        <p ref={textRef} id={live ? textId : undefined} className="sh-text" data-typed={live ? undefined : typed ? "true" : "false"}>
          <QuestionText text={q.question} live={live} typed={typed} els={glyphEls} />
        </p>
        <div className="sh-row">
          <span ref={chipRef} className="sh-chip" style={!live && !typed ? { opacity: 0 } : undefined}>
            <SourceIcon index={index} />
            <span>{chipText}</span>
          </span>
          <span className="sh-votes" role={live ? "group" : undefined} aria-labelledby={live ? textId : undefined}>
            <VoteButton index={index} kind="asked" pressed={vote === "asked"} live={live} />
            <VoteButton index={index} kind="not-asked" pressed={vote === "not-asked"} live={live} />
          </span>
        </div>
      </div>
      <span ref={caretRef} className="sh-caret" aria-hidden="true" />
      <span ref={anchorRef} className="sh-anchor" aria-hidden="true" />
    </li>
  );
}

/* ───────────────────────────────────────────────────────── the sheet ── */

function Header({ live, writing }: { live: boolean; writing: boolean }) {
  const h = storyCopy.unfold.sheetHeader;
  return (
    <div className="sh-header" data-actor-var={writing ? "progress" : undefined}>
      <div className="sh-top sh-w" style={{ "--i": 0 } as CSSProperties}>
        <span className="sh-label sh-brand">
          <i aria-hidden="true" />
          {pkg3Copy.sheet.label}
        </span>
        <span className="sh-score">{h.score}</span>
      </div>
      {live ? (
        <h3 className="sh-title sh-w" id="sheet-title" style={{ "--i": 1 } as CSSProperties}>
          {h.title}
        </h3>
      ) : (
        <div className="sh-title sh-w" style={{ "--i": 1 } as CSSProperties}>
          {h.title}
        </div>
      )}
      <p className="sh-meta sh-w" style={{ "--i": 2 } as CSSProperties}>
        {h.meta}
      </p>
      <div className="sh-qhead sh-w" style={{ "--i": 3 } as CSSProperties}>
        <span className="sh-label">{pkg3Copy.sheet.questions}</span>
        <span className="sh-label" aria-hidden="true">
          03
        </span>
      </div>
    </div>
  );
}

function Footer({ live }: { live: boolean }) {
  const { votes, thanks } = usePrepState();
  const n = asked(votes);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!live || !anchorRef.current) return;
    return registerAnchor("sheet-foot", anchorRef.current);
  }, [live]);
  const [before, after] = storyCopy.votes.count.split("{n}");
  const countText = storyCopy.votes.count.replace("{n}", String(n)).replace("{total}", "3");
  // Announce real presses only, never the demo.
  useEffect(() => {
    if (!live || !liveRef.current) return;
    liveRef.current.textContent = thanks ? `${countText}. ${storyCopy.votes.thanks}` : "";
  }, [live, thanks, countText]);
  return (
    <div className="sh-foot">
      <div>
        <span className="sh-label">{storyCopy.votes.label}</span>
        <div className="sh-count" style={{ "--n-frac": (n / 3).toFixed(4) } as CSSProperties}>
          <svg className="sh-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15" pathLength={100} className="sh-ring-track" />
            <circle cx="18" cy="18" r="15" pathLength={100} className="sh-ring-fill" />
          </svg>
          <span className="sr-only">{countText}</span>
          <span aria-hidden="true" style={{ display: "contents" }}>
            {before}
            <span className="sh-count-n">
              <span key={n}>{n}</span>
            </span>
            {after.replace("{total}", "3")}
          </span>
          <span ref={anchorRef} className="sh-foot-anchor" aria-hidden="true" />
        </div>
      </div>
      {thanks ? (
        <p className="sh-thanks" aria-hidden={live ? "true" : undefined}>
          {storyCopy.votes.thanks}
        </p>
      ) : null}
      {live ? <p ref={liveRef} className="sr-only" aria-live="polite" /> : null}
    </div>
  );
}

function SheetContent({ live, typedCount, writing = false }: { live: boolean; typedCount: number; writing?: boolean }) {
  const { votes } = usePrepState();
  return (
    <div className="sh-paper">
      <div className="sh-lampwash" aria-hidden="true" />
      <div className="sh-crease" style={{ top: 240 }} aria-hidden="true" />
      <div className="sh-crease" style={{ top: 480 }} aria-hidden="true" />
      <div className="sh-content">
        <Header live={live} writing={writing} />
        <ol className="sh-list" aria-label={live ? pkg3Copy.sheet.questions : undefined}>
          {([0, 1, 2] as const).map((i) => (
            <Question key={i} index={i} live={live} typed={i < typedCount} vote={votes[i]} />
          ))}
        </ol>
        <Footer live={live} />
      </div>
    </div>
  );
}

/* ── dock: the real, flat, interactive sheet ── */

function SheetDock({ skin }: { skin: FaceProps["skin"] }) {
  const rootRef = useRef<HTMLElement>(null);

  // Scrubbed, every pixel of the prep beats (the "breath"):
  // - the previous question dims to 60% as the next one is selected;
  // - the lamp's pool on the paper travels down with the reading, question to question, then to the count;
  // - in `votes`, the ring around "n of 3" fills.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const texts = [0, 1, 2].map((i) => root.querySelector<HTMLElement>(`[data-q="${i}"] .sh-text`));
    const lis = [0, 1, 2].map((i) => root.querySelector<HTMLElement>(`[data-q="${i}"]`));
    // Question centres as a share of the sheet's height, measured outside the frame loop.
    let qy = [40, 57, 74];
    const measure = () => {
      qy = lis.map((li, i) => (li ? ((li.offsetTop + li.offsetHeight * 0.5) / 720) * 100 : qy[i]));
      story.invalidate();
    };
    measure();
    const ro = new ResizeObserver(measure);
    lis.forEach((li) => li && ro.observe(li));
    // votes: the ring around "n of 3" fills with scroll (breath API).
    // Per-frame values go on the leaves that read them (the ring's arc, the lamp wash), not on the article.
    const ringFill = root.querySelector<HTMLElement>(".sh-ring-fill");
    const wash = root.querySelector<HTMLElement>(".sh-lampwash");
    const offFill = ringFill ? story.breath(ringFill, "votes", { from: 0.06, name: "--vote-fill" }) : () => {};
    let last = "";
    const off = story.subscribe((s) => {
      const qi = Q_BEATS.indexOf(s.beat);
      const p = s.beatProgress;
      const k = clamp01(p / 0.2);
      const dims = [1, 1, 1];
      if (qi > 0) {
        for (let i = 0; i < qi; i++) dims[i] = i === qi - 1 ? 1 - 0.4 * k : 0.6;
      } else if (s.beat === "votes") {
        dims[0] = dims[1] = 0.6 + 0.4 * k;
      }
      // One continuous path for the lamp's pool: down through each question, then to the count.
      const stops = [qy[0] - 9, qy[1] - 9, qy[2] - 9, qy[2] + 4, LAMP_END];
      const i = order(s.beat);
      let lampY = stops[0];
      let lampK = 0;
      if (qi >= 0) {
        lampY = stops[qi] + (stops[qi + 1] - stops[qi]) * p;
        lampK = qi === 0 ? clamp01(p / 0.3) : 1;
      } else if (s.beat === "votes") {
        lampY = stops[3] + (stops[4] - stops[3]) * p;
        lampK = 1;
      } else if (i > order("votes")) {
        lampY = LAMP_END;
        lampK = 1;
      }
      const key = `${dims.map((d) => d.toFixed(3)).join()}|${lampY.toFixed(2)}|${lampK.toFixed(3)}`;
      if (key === last) return;
      last = key;
      texts.forEach((el, n) => el?.style.setProperty("--q-dim", dims[n].toFixed(3)));
      wash?.style.setProperty("--lamp-y", `${lampY.toFixed(2)}%`);
      wash?.style.setProperty("--lamp-k", lampK.toFixed(3));
    });
    return () => {
      off();
      offFill();
      ro.disconnect();
    };
  }, []);

  // The vote demo (storyboard 2.6, beat 14): runs only until the visitor presses a button.
  usePerformance("votes", (tl, ctx) => {
    if (ctx.reduced) return;
    const proxy = { d: 0 };
    const marks = [0.18, 0.55, 0.9];
    const demoVotes = [storyCopy.q1.demoVote, storyCopy.q2.demoVote, storyCopy.q3.demoVote] as const;
    let lastD = 0;
    const apply = () => {
      const d = proxy.d;
      const next = marks.map((m, i) => (d >= m ? demoVotes[i] : null)) as unknown as readonly [Vote, Vote, Vote];
      if (!prepState.isCancelled() && !ctx.skipped() && d > lastD) {
        marks.forEach((m, i) => {
          if (lastD < m && d >= m) prepState.burst(i);
        });
      }
      lastD = d;
      prepState.setDemo(next);
    };
    tl.to(proxy, { d: 1.2, duration: 1.2, ease: "none", onUpdate: apply, onComplete: apply, onReverseComplete: apply });
  });

  return (
    <article ref={rootRef} className="sh-root" data-skin={skin} data-host="dock" aria-labelledby="sheet-title">
      <div className="sh-glow" style={{ height: 720 }} aria-hidden="true" />
      <SheetContent live typedCount={3} />
    </article>
  );
}

/* ── actor: three hinged panels ── */

/**
 * How far open a panel is for a given share of its fold (0..1).
 * Paper falls: it starts slowly, gathers speed, swings a few degrees past flat
 * and settles back. Folding (the reverse) gets the same curve, so it first
 * eases past flat (anticipation), then closes and slows as it lands.
 */
function swing(p: number): number {
  const x = clamp01(p);
  const k = 0.62;
  if (x < k) {
    const u = x / k;
    return u * u * (1.15 - 0.15 * u);
  }
  const u = (x - k) / (1 - k);
  return 1 + 0.045 * Math.sin(Math.PI * u) * Math.pow(1 - u, 0.6);
}

function SheetFlying({ skin }: { skin: FaceProps["skin"] }) {
  const beat = story.useBeat();
  const rootRef = useRef<HTMLDivElement>(null);
  const h2Ref = useRef<HTMLDivElement>(null);
  const h3Ref = useRef<HTMLDivElement>(null);
  const front3Ref = useRef<HTMLDivElement>(null);
  const p1Ref = useRef<HTMLDivElement>(null);
  const back2Ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shades = useRef<Record<string, HTMLDivElement | null>>({});

  const typedCount = Q_BEATS.filter((b) => order(b) < order(beat)).length;

  useEffect(() => {
    let last = "";
    return story.frame("line", () => {
      const f = story.actorState().fold;
      const key = f.toFixed(4);
      if (key === last) return;
      last = key;
      // Panel 2 swings down over the first 55% of the fold, panel 3 follows from 35% (storyboard 2.6).
      const p2 = clamp01(f / 0.55);
      const p3 = clamp01((f - 0.35) / 0.65);
      // 178.5 / 177 rather than 180: a sliver of air keeps the layers from fighting.
      const a2 = 178.5 * (1 - swing(p2));
      const a3 = 177 * (1 - swing(p3));
      const r2 = (a2 * Math.PI) / 180;
      const r3 = (a3 * Math.PI) / 180;
      if (h2Ref.current) h2Ref.current.style.transform = `rotateX(${a2.toFixed(2)}deg)`;
      if (h3Ref.current) h3Ref.current.style.transform = `rotateX(${a3.toFixed(2)}deg)`;
      // Folded, panel 3's hinge edge sits at the sheet's top corners: round it as it closes.
      const r = (20 * Math.min(1, a3 / 120)).toFixed(1);
      if (front3Ref.current) front3Ref.current.style.clipPath = `inset(0 round ${r}px ${r}px 20px 20px)`;
      // Folded, the cover is a card with four round corners (it is the tile); they square off as it opens.
      const rc = (20 * Math.min(1, a2 / 120)).toFixed(1);
      if (p1Ref.current) p1Ref.current.style.borderRadius = `20px 20px ${rc}px ${rc}px`;
      if (back2Ref.current) back2Ref.current.style.clipPath = `inset(0 round 20px 20px ${rc}px ${rc}px)`;
      const s2 = Math.max(0, Math.sin(r2));
      const s3 = Math.max(0, Math.sin(r3));
      const set = (k: string, v: number) => {
        const el = shades.current[k];
        if (el) el.style.opacity = v.toFixed(3);
      };
      // A flap swinging toward you faces the floor (darker); its back faces the lamp (lighter).
      set("f2", a2 < 90 ? 0.42 * s2 : 0);
      set("b2", a2 >= 90 ? 0.32 * s2 : 0);
      set("f3", a3 < 90 ? 0.42 * s3 : 0);
      set("b3", a3 >= 90 ? 0.28 * s3 : 0);
      // Shadow in the crease: the panel above darkens as the flap closes over it.
      set("p1", 0.5 * Math.min(1, a2 / 120) * (a2 > 2 ? 1 : 0));
      set("p2top", 0.35 * s2);
      set("p2bot", 0.5 * Math.min(1, a3 / 120) * (a3 > 2 ? 1 : 0));
      set("p3top", 0.35 * s3);
      // The glow behind follows the visible extent of the sheet.
      const visible = 240 + Math.max(0, 240 * Math.cos(r2)) + Math.max(0, 240 * Math.cos(r2 + r3) * (a2 < 90 ? 1 : 0));
      // A scale, not a height: the blurred glow is rastered once and never re-laid out.
      if (glowRef.current) glowRef.current.style.transform = `scaleY(${(Math.max(240, Math.min(720, visible)) / 720).toFixed(4)})`;
    });
  }, []);

  const shade = (k: string, cls: string) => <div ref={(el) => void (shades.current[k] = el)} className={`sh-shade ${cls}`} />;
  const slice = (i: number) => (
    <div className="sh-slice" style={{ top: -240 * i }}>
      {/* Only the first slice shows the header, and it only reads --progress while it writes in. */}
      <SheetContent live={false} typedCount={typedCount} writing={i === 0 && beat === "unfold"} />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="sh-root"
      data-skin={skin}
      data-host="actor"
      data-writing={beat === "unfold" ? "" : undefined}
      data-lamp={order(beat) > order("votes") ? "end" : undefined}
    >
      <div ref={glowRef} className="sh-glow" data-actor-var="lift" style={{ transform: "scaleY(0.3333)" }} />
      <div className="sh-3d">
        <div ref={p1Ref} className="sh-panel sh-p1">
          {slice(0)}
          {shade("p1", "sh-shade-hinge-bottom")}
        </div>
        <div ref={h2Ref} className="sh-hinge sh-h2" style={{ transform: "rotateX(178.5deg)" }}>
          <div className="sh-face-front">
            {slice(1)}
            {shade("p2top", "sh-shade-hinge-top")}
            {shade("p2bot", "sh-shade-hinge-bottom")}
            {shade("f2", "sh-shade-dark")}
          </div>
          <div ref={back2Ref} className="sh-face-back">
            {/* The cover of the folded sheet is the board tile itself, at this size: same component,
                same layout rule as the flying tile (natural height, width from the box). Nightfall
                grows the tile into this exact picture, so the hand-over has nothing to dissolve. */}
            <div className="sh-env" data-skin="day">
              <div className="sh-env-tile" style={{ width: 560 / COVER_SCALE, height: TILE_H, transform: `scale(${COVER_SCALE})` }}>
                <TileFace skin="day" fold={0} progress={1} host="actor" />
              </div>
            </div>
            {shade("b2", "sh-shade-light")}
          </div>
          <div ref={h3Ref} className="sh-hinge sh-h3" style={{ transform: "rotateX(177deg)" }}>
            <div ref={front3Ref} className="sh-face-front">
              {slice(2)}
              {shade("p3top", "sh-shade-hinge-top")}
              {shade("f3", "sh-shade-dark")}
            </div>
            <div className="sh-face-back">{shade("b3", "sh-shade-light")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetFace({ skin, host }: FaceProps) {
  return host === "dock" ? <SheetDock skin={skin} /> : <SheetFlying skin={skin} />;
}

registerFace("sheet", SheetFace, { chrome: false, clip: false });

export { SheetFace };
