"use client";

/**
 * The `card` face: the Role scored, with its reason (storyboard 2.4, beat 5).
 * Natural size 520 x 320. Night skin is glass, day skin is paper; the layout is
 * identical so the daybreak split meets at the line with no offset.
 *
 * What it shows is driven by `cardShow` (components/acts/read/runtime.ts),
 * which the `reason` performance fills: the ring and numeral count to 9, the
 * meter fills to 90%, the three chips type in. Every mounted copy (two skins in
 * the Actor, one in the dock) reads it every frame, so a copy mounted halfway
 * through is never out of step. Server and reduced-motion markup show the end state.
 *
 * The dock copy's meter fill is the `card-meter` anchor: the Line docks on it
 * and follows its width, so the Line itself is the score filling up.
 */

import { useEffect, useRef } from "react";
import "@/components/acts/read/faces.css";
import { cardShow, CARD_FULL, titleHandOver } from "@/components/acts/read/runtime";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { rankedRoles, storyActs12, storyCopy } from "@/lib/content";
import { useAnchor } from "@/lib/anchors";
import { story } from "@/lib/story";

const R = 26;
const C = 2 * Math.PI * R;
const chips = storyCopy.reason.chips;
/** "/10 fit": the score label without its number, which counts. */
const scoreSuffix = storyCopy.reason.card.scoreLabel.replace(/^\d+/, "");
const ticksAt = Array.from({ length: 10 }, (_, i) => i);

export function CardFace({ host }: FaceProps) {
  const anchor = useAnchor("card-meter");
  const idRef = useRef<HTMLDivElement>(null);
  const lastId = useRef("");
  const ringRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typedRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (story.reduced()) return;
    const last = { score: -1, meter: -1, c: [-1, -1, -1], caret: -1, f: ["", "", ""] };
    const write = () => {
      // Leaving for the tile: the title block slides toward where the tile's title will be.
      if (host === "actor" && idRef.current) {
        const tf = titleHandOver(story.get(), "card");
        if (tf !== lastId.current) idRef.current.style.transform = lastId.current = tf;
      }
      const score = Math.round(cardShow.score * 10) / 10;
      if (score !== last.score) {
        last.score = score;
        const n = String(Math.round(cardShow.score));
        if (numRef.current) numRef.current.textContent = n;
        if (scoreRef.current) scoreRef.current.textContent = n;
        ringRef.current?.style.setProperty("stroke-dashoffset", (C * (1 - cardShow.score / 10)).toFixed(2));
      }
      if (cardShow.meter !== last.meter) {
        last.meter = cardShow.meter;
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${cardShow.meter.toFixed(4)})`;
      }
      // Breath: each reason is read in turn (an underline runs under the chip being read).
      for (let i = 0; i < 3; i++) {
        const f = cardShow.focus < 0 ? "0" : Math.max(0, Math.min(1, cardShow.focus - i)).toFixed(3);
        if (f === last.f[i]) continue;
        last.f[i] = f;
        const chip = chipRefs.current[i];
        if (chip) {
          chip.style.setProperty("--read", f);
          chip.toggleAttribute("data-reading", cardShow.focus >= i && cardShow.focus < i + 1);
        }
      }
      const typed = [cardShow.c0, cardShow.c1, cardShow.c2];
      for (let i = 0; i < 3; i++) {
        const n = Math.floor(typed[i]);
        if (n === last.c[i]) continue;
        last.c[i] = n;
        const chip = chipRefs.current[i];
        const t = typedRefs.current[i];
        if (t) t.textContent = chips[i].slice(0, n);
        if (chip) {
          chip.toggleAttribute("data-on", n > 0);
          chip.toggleAttribute("data-typing", n > 0 && n < chips[i].length);
        }
      }
    };
    write();
    return story.frame("actor", write);
  }, []);

  return (
    <div className="pl-card">
      <div className="pl-card-spec" aria-hidden="true" />
      <div className="pl-card-top">
        <span className="pl-card-ini" aria-hidden="true">
          {rankedRoles[0].initials}
        </span>
        <div ref={idRef} className="pl-card-id">
          <p className="pl-card-title">{storyCopy.reason.card.title}</p>
          <p className="pl-card-meta">{storyCopy.reason.card.meta}</p>
        </div>
        <div className="pl-card-ring" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <circle className="pl-card-ring-track" cx="32" cy="32" r={R} />
            {ticksAt.map((i) => (
              <line
                key={i}
                className="pl-card-ring-tick"
                x1="32"
                y1={32 - R - 5}
                x2="32"
                y2={32 - R - 3}
                transform={`rotate(${i * 36} 32 32)`}
              />
            ))}
            <circle
              ref={ringRef}
              className="pl-card-ring-prog"
              cx="32"
              cy="32"
              r={R}
              strokeDasharray={C.toFixed(2)}
              style={{ strokeDashoffset: (C * (1 - CARD_FULL.score / 10)).toFixed(2) }}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <span ref={numRef} className="pl-card-num">
            {CARD_FULL.score}
          </span>
        </div>
      </div>

      <div className="pl-card-why">
        <p className="pl-card-label">{storyActs12.reason.chipsLabel}</p>
        <ul className="pl-card-chips">
          {chips.map((c, i) => (
            <li
              key={c}
              className="pl-card-chip"
              data-on=""
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
            >
              <span className="sr-only">{c}</span>
              <span
                aria-hidden="true"
                ref={(el) => {
                  typedRefs.current[i] = el;
                }}
              >
                {c}
              </span>
              <i className="pl-card-caret" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>

      <div className="pl-card-meter">
        <p className="pl-card-score">
          <span className="sr-only">{storyCopy.reason.card.scoreLabel}</span>
          <span aria-hidden="true">
            <span ref={scoreRef} className="pl-card-score-n">
              {CARD_FULL.score}
            </span>
            {scoreSuffix}
          </span>
        </p>
        <div className="pl-card-track" aria-hidden="true">
          <div
            ref={(el) => {
              fillRef.current = el;
              if (host === "dock") return anchor(el);
            }}
            className="pl-card-fill"
            style={{ transform: `scaleX(${CARD_FULL.meter})` }}
          />
        </div>
      </div>
    </div>
  );
}

registerFace("card", CardFace);
