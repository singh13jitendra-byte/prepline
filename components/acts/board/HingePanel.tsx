"use client";

/**
 * Beat 9, `hinge` (storyboard 2.5): the page's one rest. Pure scrub.
 *
 * The board recedes (BoardPanel). One sentence in display type is read word by
 * word: each word goes from 25% to 100% ink as the scroll passes it. The Line is
 * its underline: the `hinge-text` anchor spans from the start of the current
 * line of text to the end of the last read word, and carries over to the next
 * line of text during that line's first word (a carriage return, not a jump).
 * The Actor lifts off the board to `hinge-float`, right of the sentence, tilted 6°.
 *
 * Nightfall then erases the sentence from the top (the stage clip does that).
 */

import { useEffect, useRef } from "react";
import { FaceSlot } from "@/components/story/FaceSlot";
import { Panel } from "@/components/story/Stage";
import { storyCopy } from "@/lib/content";
import { useAnchor } from "@/lib/anchors";
import { BEATS, story } from "@/lib/story";
import { offsetIn, span, useScrub } from "../read/runtime";

const sentence = storyCopy.hinge.sentence;
const words = sentence.split(" ");
/** Beat progress over which the words are read (the Line arrives by 25%). */
const READ: [number, number] = [0.26, 0.9];
const HINGE = BEATS.findIndex((b) => b.id === "hinge");

type Box = { x: number; y: number; w: number; h: number; line: number };

export function HingePanel() {
  const textRef = useRef<HTMLParagraphElement>(null);
  const underRef = useRef<HTMLSpanElement>(null);
  const anchor = useAnchor("hinge-text");
  const boxes = useRef<Box[]>([]);

  useEffect(() => {
    const text = textRef.current;
    if (!text || story.reduced()) return;
    const measure = () => {
      let line = -1;
      let lastY = -1e9;
      boxes.current = Array.from(text.querySelectorAll<HTMLElement>("[data-word]")).map((el) => {
        const b = offsetIn(el, text);
        if (Math.abs(b.y - lastY) > b.h * 0.5) {
          line++;
          lastY = b.y;
        }
        return { ...b, line };
      });
      story.invalidate();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(text);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  useScrub((s) => {
    const text = textRef.current;
    const under = underRef.current;
    const b = boxes.current;
    if (!text || !under || b.length === 0) return;
    const i = BEATS.findIndex((x) => x.id === s.beat);
    const p = i < HINGE ? 0 : i > HINGE ? 1 : s.beatProgress;
    text.style.setProperty("--in", span(p, 0, 0.2).toFixed(4));

    const r = span(p, READ[0], READ[1]) * b.length;
    text.querySelectorAll<HTMLElement>("[data-word]").forEach((el, k) => {
      const v = (0.25 + 0.75 * span(r - k, 0, 1)).toFixed(3);
      if (el.style.opacity !== v) el.style.opacity = v;
    });

    // Underline: from the start of the current text line to the reading point.
    const k = Math.min(b.length - 1, Math.floor(r));
    const f = r >= b.length ? 1 : r - k;
    const w = b[k];
    const lineStart = (n: number) => b.find((x) => x.line === n) ?? w;
    const lineEnd = (n: number) => {
      const on = b.filter((x) => x.line === n);
      const last = on[on.length - 1] ?? w;
      return last.x + last.w;
    };
    const base = (bx: Box) => bx.y + bx.h * 0.94;
    let x0 = lineStart(w.line).x;
    let x1 = w.x + w.w * f;
    let y = base(w);
    const first = lineStart(w.line) === w;
    if (first && w.line > 0) {
      // Carriage return: glide from the end of the previous line to this word.
      const prev = lineStart(w.line - 1);
      x0 = prev.x + (x0 - prev.x) * f;
      x1 = lineEnd(w.line - 1) + (x1 - lineEnd(w.line - 1)) * f;
      y = base(prev) + (y - base(prev)) * f;
    }
    if (r <= 0) x1 = x0;
    under.style.transform = `translate3d(${x0.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    under.style.width = `${Math.max(0, x1 - x0).toFixed(2)}px`;
  });

  return (
    <Panel beats="hinge" className="bd-hinge">
      <div className="bd-hinge-root">
        <div className="bd-hinge-inner">
          <p ref={textRef} className="bd-sentence">
            <span className="sr-only">{sentence}</span>
            <span className="bd-sentence-vis" aria-hidden="true">
              {words.map((w, k) => (
                <span key={k}>
                  <span className="bd-word" data-word>
                    {w}
                  </span>
                  {k < words.length - 1 ? " " : null}
                </span>
              ))}
            </span>
            <span
              ref={(el) => {
                underRef.current = el;
                return anchor(el);
              }}
              className="bd-under only-motion"
              aria-hidden="true"
            />
          </p>
          <div className="bd-float">
            <FaceSlot anchor="hinge-float" face="tile" skin="day" showWhenStatic={false} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
