"use client";

/**
 * SHEET FACE — the Role unfolds into the real prep sheet (storyboard 2.6, round-4 brief).
 *
 * Both hosts render the product's own <PrepSheet skin="day" nav={false}> (components/product),
 * laid out at the face's natural size (560 x 720; on phones a 360-wide layout scaled up, so
 * product text stays at ~14px after the face is scaled to the screen).
 *
 * - host "dock": the real sheet. Votes are controlled from prepState (shared with the demo and
 *   the flying copies); PrepSheet keeps its own buttons, live region and "Tell:" column. The
 *   typing of q1..q3 is a visual layer portalled into the sheet's own scroll body, sitting
 *   exactly over each question: the real text is transparent while its question is written,
 *   then shown again. The overlay owns the anchors sheet-q1..3 (the Line's right end is the
 *   caret); sheet-foot is PrepSheet's own "n of 3 asked". The story scrolls the sheet's body
 *   with the reading (a breath channel) and ends on "Before it starts".
 * - host "actor": decorative copies only (the Actor layer is inert and aria-hidden). Three
 *   paper panels on hinges driven by the Actor's fold, flat 6% tints and faint creases for
 *   shading (no blur). Each panel holds a still print of the sheet (SheetPrint: PrepSheet's
 *   classes, only what can be seen, no live parts), not the product tree. The folded cover is
 *   the board tile (TileFace), so nightfall grows the tile into this exact picture.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { registerAnchor, type AnchorId } from "@/lib/anchors";
import { usePerformance } from "@/lib/perform";
import { BEATS, clamp01, story, type BeatId } from "@/lib/story";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { Icon, Illustrative, KeyValue, PrepSheet, ScoreRule, SourceChip, productData } from "@/components/product";
import { prepState, usePrepState, type Vote, type Votes } from "@/components/acts/prep/prepState";
import { TileFace } from "./TileFace";
import "./sheet.css";

const SHEET = productData.kestrelSheet;
const QIDS = SHEET.questions.map((q) => q.id);
const QTEXT = SHEET.questions.map((q) => q.text);
const Q_BEATS: readonly BeatId[] = ["q1", "q2", "q3"];
const order = (b: BeatId) => BEATS.findIndex((x) => x.id === b);

/** The folded sheet's cover is the tile face scaled to the folded panel's height (240 / 92). */
const TILE_H = 92;
const COVER_SCALE = 240 / TILE_H;

function record(v: Votes): Record<string, Vote> {
  return Object.fromEntries(QIDS.map((id, i) => [id, v[i] ?? null]));
}

/** 22ms a character, 180ms after punctuation (storyboard 4). */
function schedule(text: string) {
  const starts: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    starts.push(t);
    t += /[,.?:;!]/.test(text[i]) ? 0.18 : 0.022;
  }
  return { starts, total: t + 0.03 };
}

/** The product sheet at the face's natural size (the same markup in every copy). */
function Sheet({ live, votes }: { live: boolean; votes: Votes }) {
  const rec = useMemo(() => record(votes), [votes]);
  return (
    <div className="shx-inner" data-skin="day">
      <PrepSheet skin="day" nav={false} votes={rec} onVote={live ? (id, v) => prepState.set(QIDS.indexOf(id), v) : undefined} />
    </div>
  );
}

/** Phones (the face's 360-wide layout): the sheet focuses on each beat's subject (review 3, P1-5). */
const SMALL = "(max-width: 767px)";
function useSmall(): boolean {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(SMALL);
    const on = () => setSmall(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return small;
}

/**
 * The sheet as a still print, for the flying copies (review 3, P1-9): PrepSheet's own classes and
 * text for what can be seen in flight, and nothing else — no live region, no hidden sections'
 * content, no handlers, no ids. Laid out identically to the real sheet, so the hand-over at rest
 * shows no seam. `opener`: include "Before it starts" (seen only from the dawn on).
 * `foot`: include the footer (only the bottom panel shows it).
 */
function SheetPrint({ votes, opener, foot, head, body }: { votes: Votes; opener: boolean; foot: boolean; head: boolean; body: boolean }) {
  const { role, interview, questions } = SHEET;
  const asked = questions.filter((_, i) => votes[i] === "asked").length;
  return (
    <div className="shx-inner" data-skin="day">
      <article className="pp pp-prep" data-skin="day">
        {!head && prepState.headPx > 0 ? (
          <div style={{ flex: "none", height: prepState.headPx }} />
        ) : (
          <header className="pp-prep-h">
            <div className="pp-prep-top">
              <span className="pp-meta pp-trunc pp-prep-written">
                Prep sheet<span className="pp-sep">·</span>
                {SHEET.written}
              </span>
              <span className="pp-spacer" />
              <Illustrative />
            </div>
            <div className="pp-prep-title">
              <div>
                <h2>{role.title}</h2>
                <p className="pp-meta">
                  {role.company}
                  <span className="pp-sep">·</span>
                  {role.city}
                </p>
              </div>
              <ScoreRule score={role.score} size="md" suffix className="pp-prep-rule" />
            </div>
            <KeyValue
              items={[
                {
                  k: "Interview",
                  v: (
                    <>
                      {interview.when} <span style={{ fontWeight: 400 }}>{interview.zone}</span>
                    </>
                  ),
                },
                { k: "Round", v: interview.round },
                { k: "Format", v: interview.format },
              ]}
            />
          </header>
        )}
        <div className="pp-prep-body">
          {body ? (
            <>
              <section className="pp-prep-sec">
                <div className="pp-prep-sec-h">
                  <h3>Likely questions</h3>
                </div>
                <p className="pp-prep-sec-p">Each one shows where it came from. Say your answer out loud once.</p>
                <ol className="pp-qs">
                  {questions.map((q, i) => {
                    const vote = votes[i] ?? null;
                    return (
                      <li key={q.id} className="pp-q" data-vote={vote ?? undefined}>
                        <span className="pp-q-n">{i + 1}</span>
                        <p className="pp-q-text">{q.text}</p>
                        <p className="pp-q-tell">
                          <b>Tell:</b> {q.angle}
                          {q.tell ? <span>{q.tell}</span> : null}
                        </p>
                        <div className="pp-q-foot">
                          {q.sources.map((src) => (
                            <SourceChip key={src.label + (src.detail ?? "")} {...src} size="sm" />
                          ))}
                          <span className="pp-vote">
                            <button type="button" tabIndex={-1} data-v="asked" aria-pressed={vote === "asked"}>
                              <Icon name="check" size={14} />
                              Asked
                            </button>
                            <button type="button" tabIndex={-1} data-v="not-asked" aria-pressed={vote === "not-asked"}>
                              <Icon name="x" size={14} />
                              Not asked
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
              {/* Design round and Ask them back are hidden on this sheet: empty boxes keep the order. */}
              <section className="pp-prep-sec" />
              <section className="pp-prep-sec" />
              {opener ? (
                <section className="pp-prep-sec">
                  <div className="pp-prep-sec-h">
                    <h3>Before it starts</h3>
                  </div>
                  <p className="pp-prep-sec-p">A couple of easy things to say while everyone joins the call.</p>
                  <figure className="pp-opener">
                    <blockquote>{SHEET.opener.text}</blockquote>
                    <figcaption>
                      <Icon name="chat" size={16} />
                      <span>{SHEET.opener.why}</span>
                      <SourceChip {...SHEET.opener.source} />
                    </figcaption>
                  </figure>
                  <p className="pp-disclaimer">{SHEET.disclaimer}</p>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
        {foot ? (
          <footer className="pp-prep-f">
            <span className="pp-prog">
              {questions.map((q, i) => (
                <span key={q.id} data-v={votes[i] ?? undefined} />
              ))}
            </span>
            <span className="pp-prep-count">
              {asked} of {questions.length} asked
            </span>
            <span className="pp-prep-note">After the interview, mark each question. Votes are anonymous.</span>
          </footer>
        ) : null}
      </article>
    </div>
  );
}

/* ───────────────────────────────────────────── dock: typing overlay ── */

type Box = { l: number; t: number; w: number; h: number };

/** Offset of `el` inside `host` (unscaled layout px), walking the offsetParent chain. */
function offsetIn(el: HTMLElement, host: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== host) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function TypedQuestion({ index, body, root }: { index: number; body: HTMLElement; root: HTMLElement }) {
  const text = QTEXT[index];
  const boxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const glyphs = useRef<HTMLSpanElement[]>([]);
  const remeasure = useRef<() => void>(() => {});

  useEffect(() => {
    if (!anchorRef.current) return;
    return registerAnchor(`sheet-q${index + 1}` as AnchorId, anchorRef.current);
  }, [index]);

  useEffect(() => {
    const run = () => remeasure.current();
    document.fonts?.ready.then(run).catch(() => {});
    const ro = new ResizeObserver(run);
    ro.observe(body);
    return () => ro.disconnect();
  }, [body]);

  usePerformance(
    Q_BEATS[index],
    (tl) => {
      const box = boxRef.current;
      const anchor = anchorRef.current;
      const caret = caretRef.current;
      if (!box || !anchor || !caret) return;
      const { starts, total: T } = schedule(text);
      const attr = `data-q${index + 1}`;
      let boxes: Box[] = [];
      let row = { x: 0, y: 0, w: 0 };
      let stale = true;
      let shown = -1;
      let cur = 0;

      // Lay the overlay exactly over PrepSheet's question text, in the same type.
      const measure = () => {
        const real = body.querySelectorAll<HTMLElement>(".pp-q-text")[index];
        const li = real?.closest<HTMLElement>(".pp-q");
        if (!real || !li) return;
        const cs = getComputedStyle(real);
        const o = offsetIn(real, body);
        Object.assign(box.style, {
          left: `${o.x}px`,
          top: `${o.y}px`,
          width: `${real.clientWidth}px`,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          fontWeight: cs.fontWeight,
          color: cs.color,
          textWrap: cs.getPropertyValue("text-wrap") || "wrap",
        } as Partial<CSSStyleDeclaration>);
        const lo = offsetIn(li, body);
        row = {
          x: o.x,
          y: lo.y + li.offsetHeight,
          w: lo.x + li.offsetWidth - o.x,
        };
        boxes = glyphs.current.map((g) => ({
          l: o.x + g.offsetLeft,
          t: o.y + g.offsetTop,
          w: g.offsetWidth,
          h: g.offsetHeight,
        }));
        stale = false;
      };

      const render = (t: number) => {
        cur = t;
        const done = t >= T;
        root.setAttribute(attr, done ? "done" : t > 0 ? "typing" : "blank");
        if (done) {
          // At rest the Line thins to the rule under the whole question row.
          if (stale) measure();
          box.style.visibility = "hidden";
          caret.removeAttribute("data-on");
          Object.assign(anchor.style, {
            left: `${row.x}px`,
            top: `${row.y - 1.5}px`,
            width: `${row.w}px`,
            height: "1.5px",
          });
          return;
        }
        if (stale) measure();
        box.style.visibility = "";
        let n = 0;
        while (n < starts.length && starts[n] < t) n++;
        if (n !== shown) {
          glyphs.current.forEach((g, i) => {
            const want = i < n ? "" : "0";
            if (g.style.opacity !== want) g.style.opacity = want;
          });
          shown = n;
        }
        const first = boxes[0];
        const last = boxes[Math.max(0, n - 1)];
        if (!first || !last) return;
        const lineTop = n === 0 ? first.t : last.t;
        const lineH = n === 0 ? first.h : last.h;
        let lineLeft = first.l;
        for (let i = 0; i < n; i++)
          if (Math.abs(boxes[i].t - lineTop) < 2) {
            lineLeft = boxes[i].l;
            break;
          }
        const right = n === 0 ? first.l : last.l + last.w;
        // While typing, the Line's right end is the caret: it underlines the line being written.
        Object.assign(anchor.style, {
          left: `${lineLeft}px`,
          top: `${(lineTop + lineH + 1).toFixed(1)}px`,
          width: `${Math.max(0, right - lineLeft).toFixed(1)}px`,
          height: "2px",
        });
        Object.assign(caret.style, {
          left: `${(right + 1).toFixed(1)}px`,
          top: `${(lineTop + lineH * 0.1).toFixed(1)}px`,
          height: `${(lineH * 0.8).toFixed(1)}px`,
        });
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
      remeasure.current = () => {
        stale = true;
        shown = -1;
        render(cur);
      };
    },
    [index, body, root],
  );

  // Words keep their letters together; spaces sit between words so lines break where the real text does.
  const words = useMemo(() => text.split(" "), [text]);
  let k = 0;
  return (
    <>
      <div ref={boxRef} className="shx-typed" aria-hidden="true">
        {words.map((w, wi) => {
          const letters = [...w].map((ch) => {
            const i = k++;
            return (
              <span key={i} ref={(el) => void (el && (glyphs.current[i] = el))}>
                {ch}
              </span>
            );
          });
          const space =
            wi < words.length - 1
              ? (() => {
                  const i = k++;
                  return (
                    <span key={`s${i}`} ref={(el) => void (el && (glyphs.current[i] = el))}>
                      {" "}
                    </span>
                  );
                })()
              : null;
          return (
            <span key={wi}>
              <span className="shx-word">{letters}</span>
              {space}
            </span>
          );
        })}
      </div>
      <span ref={caretRef} className="shx-caret" aria-hidden="true" />
      <span ref={anchorRef} className="shx-anchor" aria-hidden="true" />
    </>
  );
}

function SheetDock({ skin }: { skin: FaceProps["skin"] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const { votes } = usePrepState();
  const beat = story.useBeat();
  const small = useSmall();
  // Phones, from `votes`: the three questions as a checklist with their vote buttons (sheet.css).
  const focus = small && order(beat) >= order("votes") ? "votes" : undefined;

  useLayoutEffect(() => {
    setBody(rootRef.current?.querySelector<HTMLElement>(".pp-prep-body") ?? null);
  }, []);

  // The Line ends on PrepSheet's own count.
  useEffect(() => {
    const count = rootRef.current?.querySelector<HTMLElement>(".pp-prep-count");
    if (!count) return;
    return registerAnchor("sheet-foot", count);
  }, []);

  // Breath (scrubbed, every pixel from q1 to the end of votes): the sheet's own body scrolls with
  // the reading, question by question, and ends on "Before it starts". The overlay and anchors live
  // inside the body, so they ride along.
  // Phones (review 3, P1-5): the body shows a question at a time, so each q beat first brings its
  // question to the top (12px under the header, in the first fifth of the beat, while it is typed),
  // then eases down just far enough to show its votes. From `votes` the sheet is a checklist at
  // the top (data-focus="votes"), every vote button in view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !body || story.reduced()) return;
    let stops = [0, 0, 0, 0, 0];
    let small = false;
    let rowA = [0, 0, 0];
    let rowB = [0, 0, 0];
    const measure = () => {
      small = window.matchMedia(SMALL).matches;
      const head = root.querySelector<HTMLElement>(".pp-prep-h");
      const sheet = root.querySelector<HTMLElement>(".pp-prep");
      if (head && sheet && sheet.offsetHeight > 0) {
        prepState.headPx = head.offsetHeight;
        prepState.headFace = (head.offsetHeight / sheet.offsetHeight) * 720;
      }
      const rows = Array.from(body.querySelectorAll<HTMLElement>(".pp-q"));
      const opener = body.querySelector<HTMLElement>(".pp-opener");
      const ch = body.clientHeight;
      const max = Math.max(0, body.scrollHeight - ch);
      const clampY = (y: number) => Math.min(max, Math.max(0, y));
      const top = (el: HTMLElement | undefined | null, pad: number) => (el ? clampY(offsetIn(el, body).y - pad) : 0);
      if (small) {
        // Measured in the full layout only (the checklist moves the rows).
        if (root.dataset.focus) return;
        rowA = rows.map((r) => clampY(offsetIn(r, body).y - 12));
        rowB = rows.map((r, i) => {
          const y = offsetIn(r, body).y;
          return Math.max(rowA[i], clampY(Math.min(y - 2, y + r.offsetHeight - ch + 4)));
        });
        prepState.scrollEnd = 0;
      } else {
        const endY = opener ? Math.min(max, offsetIn(opener, body).y + opener.offsetHeight - ch + 16) : max;
        stops = [0, top(rows[1], ch * 0.45), top(rows[2], ch * 0.4), top(rows[2], ch * 0.2), Math.max(endY, top(rows[2], 0))];
        prepState.scrollEnd = stops[4];
      }
      story.invalidate();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    document.fonts?.ready.then(measure).catch(() => {});
    let last = -1;
    let lastBeat = "";
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const off = story.subscribe((s) => {
      const qi = Q_BEATS.indexOf(s.beat);
      const i = order(s.beat);
      if (s.beat !== lastBeat) {
        lastBeat = s.beat;
        if (small && qi >= 0) measure();
      }
      let y = 0;
      if (small) {
        if (qi >= 0) {
          const from = qi === 0 ? 0 : rowB[qi - 1];
          const p = s.beatProgress;
          y = p < 0.2 ? from + (rowA[qi] - from) * smooth(p / 0.2) : rowA[qi] + (rowB[qi] - rowA[qi]) * ((p - 0.2) / 0.8);
        }
      } else if (qi >= 0) y = stops[qi] + (stops[qi + 1] - stops[qi]) * s.beatProgress;
      else if (s.beat === "votes") y = stops[3] + (stops[4] - stops[3]) * clamp01((s.beatProgress - 0.2) / 0.8);
      else if (i > order("votes")) y = stops[4];
      const r = Math.round(y);
      if (r === last) return;
      last = r;
      body.scrollTop = r;
    });
    return () => {
      off();
      ro.disconnect();
    };
  }, [body]);

  // The vote demo (beat `votes`): presses Asked, Not asked, Asked, until the visitor presses one.
  usePerformance("votes", (tl, ctx) => {
    if (ctx.reduced) return;
    const proxy = { d: 0 };
    const marks = [0.18, 0.55, 0.9];
    const demo: Vote[] = ["asked", "not-asked", "asked"];
    let lastD = 0;
    const apply = () => {
      const d = proxy.d;
      const next = marks.map((m, i) => (d >= m ? demo[i] : null)) as unknown as Votes;
      if (!prepState.isCancelled() && !ctx.skipped() && d > lastD) {
        marks.forEach((m, i) => {
          if (lastD < m && d >= m) {
            const btn = rootRef.current
              ?.querySelectorAll<HTMLElement>(".pp-q")
              [i]?.querySelector<HTMLElement>(`.pp-vote button[data-v="${demo[i]}"]`);
            btn?.animate([{ transform: "scale(1)" }, { transform: "scale(0.92)", offset: 0.35 }, { transform: "scale(1)" }], {
              duration: 360,
              easing: "cubic-bezier(0.34,1.4,0.64,1)",
            });
          }
        });
      }
      lastD = d;
      prepState.setDemo(next);
    };
    tl.to(proxy, {
      d: 1.2,
      duration: 1.2,
      ease: "none",
      onUpdate: apply,
      onComplete: apply,
      onReverseComplete: apply,
    });
  });

  return (
    <div
      ref={rootRef}
      className="shx"
      data-host="dock"
      data-skin={skin}
      data-focus={focus}
      data-q1="blank"
      data-q2="blank"
      data-q3="blank"
      suppressHydrationWarning
    >
      <div className="shx-plate" aria-hidden="true" />
      <Sheet live votes={votes} />
      <div className="shx-crease" style={{ top: 240 }} aria-hidden="true" />
      <div className="shx-crease" style={{ top: 480 }} aria-hidden="true" />
      {body && rootRef.current
        ? createPortal(
            <div className="shx-overlay" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <TypedQuestion key={i} index={i} body={body} root={rootRef.current as HTMLDivElement} />
              ))}
            </div>,
            body,
          )
        : null}
    </div>
  );
}

/* ───────────────────────────────────────────── actor: three hinged panels ── */

/**
 * How far open a panel is for a given share of its fold (0..1). Paper falls: slow start,
 * a few degrees past flat, settles back. Reversed, it eases past flat first, then closes.
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
  const { votes } = usePrepState();
  const rootRef = useRef<HTMLDivElement>(null);
  const h2Ref = useRef<HTMLDivElement>(null);
  const h3Ref = useRef<HTMLDivElement>(null);
  const front3Ref = useRef<HTMLDivElement>(null);
  const p1Ref = useRef<HTMLDivElement>(null);
  const back2Ref = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const tints = useRef<Record<string, HTMLDivElement | null>>({});

  const small = useSmall();
  const typed = Q_BEATS.filter((b) => order(b) < order(beat)).length;
  const late = order(beat) > order("votes");
  const focus = small && order(beat) >= order("votes") ? "votes" : undefined;

  // Match the dock's scroll: the top of the sheet in the unfold, "Before it starts" in the dawn
  // (on phones the vote checklist, at the top).
  useLayoutEffect(() => {
    const y = late ? prepState.scrollEnd : 0;
    rootRef.current?.querySelectorAll<HTMLElement>(".pp-prep-body").forEach((b) => (b.scrollTop = y));
  }, [late, focus]);

  useEffect(() => {
    let last = "";
    return story.frame("line", () => {
      const f = story.actorState().fold;
      const key = f.toFixed(4);
      if (key === last) return;
      last = key;
      // Panel 2 swings down over the first 55% of the fold, panel 3 follows from 35% (storyboard 2.6).
      const a2 = 178.5 * (1 - swing(clamp01(f / 0.55)));
      const a3 = 177 * (1 - swing(clamp01((f - 0.35) / 0.65)));
      if (h2Ref.current) h2Ref.current.style.transform = `rotateX(${a2.toFixed(2)}deg)`;
      if (h3Ref.current) h3Ref.current.style.transform = `rotateX(${a3.toFixed(2)}deg)`;
      const r3 = (20 * Math.min(1, a3 / 120)).toFixed(1);
      if (front3Ref.current) front3Ref.current.style.clipPath = `inset(0 round ${r3}px ${r3}px 22px 22px)`;
      const rc = (22 * Math.min(1, a2 / 120)).toFixed(1);
      if (p1Ref.current) p1Ref.current.style.borderRadius = `22px 22px ${rc}px ${rc}px`;
      if (back2Ref.current) back2Ref.current.style.clipPath = `inset(0 round 22px 22px ${rc}px ${rc}px)`;
      // Flat tints, no gradients: the turning panel takes up to 6% pine, its back a little less.
      const s2 = Math.max(0, Math.sin((a2 * Math.PI) / 180));
      const s3 = Math.max(0, Math.sin((a3 * Math.PI) / 180));
      const set = (k: string, v: number) => {
        const el = tints.current[k];
        if (el) el.style.opacity = v.toFixed(3);
      };
      set("f2", a2 < 90 ? s2 : 0);
      set("b2", a2 >= 90 ? 0.6 * s2 : 0);
      set("f3", a3 < 90 ? s3 : 0);
      set("b3", a3 >= 90 ? 0.6 * s3 : 0);
      // The print under the sheet follows its visible extent (a scale: rastered once, never re-laid out).
      const r2 = (a2 * Math.PI) / 180;
      const vis = 240 + Math.max(0, 240 * Math.cos(r2)) + (a2 < 90 ? Math.max(0, 240 * Math.cos(r2 + (a3 * Math.PI) / 180)) : 0);
      if (plateRef.current) plateRef.current.style.transform = `scaleY(${(Math.max(240, Math.min(720, vis)) / 720).toFixed(4)})`;
    });
  }, []);

  const tint = (k: string) => <div ref={(el) => void (tints.current[k] = el)} className="shx-tint" />;
  const slice = (i: number) => (
    <div className="shx-slice" style={{ top: -240 * i }}>
      <SheetPrint
        votes={votes}
        opener={late}
        foot={i === 2}
        head={i === 0 || prepState.headFace > 240 * i}
        body={i > 0 || !(prepState.headFace >= 240)}
      />
    </div>
  );
  const q = (n: number) => (n < typed ? "done" : "blank");

  return (
    <div ref={rootRef} className="shx" data-host="actor" data-skin={skin} data-focus={focus} data-q1={q(0)} data-q2={q(1)} data-q3={q(2)}>
      <div ref={plateRef} className="shx-plate" style={{ transform: "scaleY(0.3333)" }} />
      <div className="shx-3d">
        <div ref={p1Ref} className="shx-panel shx-p1">
          {slice(0)}
        </div>
        <div ref={h2Ref} className="shx-hinge shx-h2" style={{ transform: "rotateX(178.5deg)" }}>
          <div className="shx-front">
            {slice(1)}
            <div className="shx-crease" style={{ top: 0 }} />
            {tint("f2")}
          </div>
          <div ref={back2Ref} className="shx-back">
            {/* The folded sheet's cover is the board tile itself at this size, so nightfall grows
                the tile into this exact picture and the hand-over has nothing to dissolve. */}
            <div className="shx-cover" data-skin="day">
              <div
                style={{
                  width: 560 / COVER_SCALE,
                  height: TILE_H,
                  transform: `scale(${COVER_SCALE})`,
                  transformOrigin: "0 0",
                }}
              >
                <TileFace skin="day" fold={0} progress={1} host="actor" />
              </div>
            </div>
            {tint("b2")}
          </div>
          <div ref={h3Ref} className="shx-hinge shx-h3" style={{ transform: "rotateX(177deg)" }}>
            <div ref={front3Ref} className="shx-front">
              {slice(2)}
              <div className="shx-crease" style={{ top: 0 }} />
              {tint("f3")}
            </div>
            <div className="shx-back shx-back-plain">{tint("b3")}</div>
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
