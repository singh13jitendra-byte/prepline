"use client";

/**
 * The `tile` face: the Role as a card on the board (storyboard 2.5, beats 6 to 9).
 * Natural size 154 x 92. Day skin is paper on the board; night skin is glass
 * (worn while nightfall cuts it in two on its way to becoming the sheet).
 *
 * The chip at the foot flips with the story: "Fits your case studies" (saved),
 * "Applied Tue" (applied), "Thu 11:40" with a drawn calendar tick (interview).
 * It reads `tileShow` (components/acts/read/runtime.ts) every frame; the board
 * performances own those values. Server and reduced-motion markup show the end
 * state (the tile rests in Interview).
 */

import { useEffect, useRef } from "react";
import "@/components/acts/read/faces.css";
import { tileShow } from "@/components/acts/read/runtime";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { rankedRoles, storyCopy } from "@/lib/content";
import { story } from "@/lib/story";

const role = rankedRoles[0];
const labels = [storyCopy.saved.chip, storyCopy.applied.chip, storyCopy.interview.chip] as const;
const TICK = 14;

function ChipBody({ index }: { index: number }) {
  return (
    <>
      {index === 2 ? (
        <svg className="tf-cal" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <rect x="1.25" y="2.25" width="9.5" height="8.5" rx="2" />
          <path d="M1.25 5h9.5M4 1v2.4M8 1v2.4" />
        </svg>
      ) : index === 0 ? (
        <span className="tf-spark" aria-hidden="true" />
      ) : null}
      <span className="tf-chip-t">{labels[index]}</span>
    </>
  );
}

export function TileFace(_props: FaceProps) {
  const chipRef = useRef<HTMLDivElement>(null);
  const bodyRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tickRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (story.reduced()) return;
    const last = { c: -1, tick: -1 };
    const write = () => {
      const c = tileShow.applied + tileShow.interview;
      if (c !== last.c) {
        last.c = c;
        const index = Math.min(2, Math.round(c));
        const f = c - Math.floor(c);
        // Flip on the X axis: out to 90deg on the old label, in from -90deg on the new one.
        const angle = f === 0 ? 0 : f < 0.5 ? f * 180 : -(1 - f) * 180;
        bodyRefs.current.forEach((el, i) => {
          if (el) el.style.display = i === index ? "" : "none";
        });
        if (chipRef.current) {
          chipRef.current.style.transform = angle ? `rotateX(${angle.toFixed(2)}deg)` : "";
          chipRef.current.dataset.state = String(index);
        }
      }
      if (tileShow.tick !== last.tick) {
        last.tick = tileShow.tick;
        tickRef.current?.style.setProperty("stroke-dashoffset", (TICK * (1 - tileShow.tick)).toFixed(2));
      }
    };
    write();
    return story.frame("actor", write);
  }, []);

  return (
    <div className="tf">
      <div className="tf-top">
        <span className="tf-ini" aria-hidden="true">
          {role.initials}
        </span>
        <span className="tf-score">
          <span className="sr-only">Scored </span>
          <b>{role.score}</b>
          <span className="tf-of">{storyCopy.ranked.scoreSuffix}</span>
        </span>
      </div>
      <p className="tf-title">{role.title}</p>
      <p className="tf-meta">{role.company}</p>
      <div className="tf-foot">
        <div ref={chipRef} className="tf-chip" data-state="2">
          {labels.map((_, i) => (
            <span
              key={i}
              className="tf-chip-b"
              style={i === 2 ? undefined : { display: "none" }}
              ref={(el) => {
                bodyRefs.current[i] = el;
              }}
            >
              <ChipBody index={i} />
            </span>
          ))}
        </div>
        <svg className="tf-tick" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path ref={tickRef} d="M3.5 8.4l3 3 6-6.6" strokeDasharray={TICK} style={{ strokeDashoffset: 0 }} />
        </svg>
      </div>
    </div>
  );
}

registerFace("tile", TileFace);
