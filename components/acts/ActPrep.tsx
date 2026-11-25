"use client";

/**
 * ACT III — PREP (night, lamp-lit). Storyboard 2.6.
 *
 *   unfold  the folded sheet arrives in the dark; the World's lamp comes up and the
 *           sheet unfolds (the Actor's timed fold, drawn by SheetFace), then docks here
 *   q1..q3  one question typed per beat, the Line under the caret; the source on the left swaps
 *   votes   the day after: the buttons are real; a short demo presses them unless you already did
 *   dawn    (wipe) the sheet folds back and flips into the ticket (Actor + SheetFace + TicketFace)
 *
 * The real sheet (FaceSlot "sheet") is the semantic, interactive copy. The Actor flies a
 * duplicate and hands over to it at the end of the unfold.
 */

import { useEffect, useRef } from "react";
import { storyCopy } from "@/lib/content";
import { BEATS, story, type BeatId } from "@/lib/story";
import { FaceSlot } from "@/components/story/FaceSlot";
import { Panel, Stage } from "@/components/story/Stage";
import "@/components/faces/SheetFace";
import "./prep/prep.css";

const SOURCES = [storyCopy.q1, storyCopy.q2, storyCopy.q3] as const;
const Q_BEATS: readonly BeatId[] = ["q1", "q2", "q3"];
const idx = (b: BeatId) => BEATS.findIndex((x) => x.id === b);

function stateOf(i: number, current: number): "before" | "on" | "after" {
  return i === current ? "on" : i < current ? "before" : "after";
}

function Arrow() {
  return (
    <svg viewBox="0 0 34 12" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 6c8-3.5 18-3.5 31 0" />
      <path d="M27.5 2.2L32 6l-4.8 3.2" />
    </svg>
  );
}

export function ActPrep() {
  const beat = story.useBeat();
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  // Which group and which source line is showing. Before the act, the first group waits below.
  const b = idx(beat);
  const group = b >= idx("votes") ? 1 : b >= idx("nightfall") ? 0 : -1;
  const qi = Q_BEATS.indexOf(beat);
  const source = qi >= 0 ? qi : b > idx("q3") ? 3 : -1;

  // Breath (scrubbed, every pixel of unfold's back half to votes): the sheet slides up under the lamp
  // as the Line reads down it: 4px as the unfold settles, 8px per question, 8px through the votes. The wrapper holds both sheet anchors, so the Line and
  // the dawn's take-off follow it. One breath per beat (they restart per beat), summed in CSS.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const offs = [
      story.breath(wrap, "unfold", { from: 0.4, name: "--slide-unfold" }),
      ...Q_BEATS.map((b) => story.breath(wrap, b, { from: 0, name: `--slide-${b}` })),
      story.breath(wrap, "votes", { from: 0, name: "--slide-votes" }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Dawn (scrubbed): the left copy steps back before the rising line reaches it, so the outgoing
  // copy never meets the incoming "Walk in ready." at the line.
  useEffect(() => {
    const copy = copyRef.current;
    if (!copy || story.reduced()) return;
    let last = "";
    return story.subscribe((s) => {
      const o = s.beat === "dawn" ? 1 - Math.min(1, Math.max(0, (s.beatProgress - 0.18) / 0.3)) : idx(s.beat) > idx("dawn") ? 0 : 1;
      const key = o.toFixed(3);
      if (key === last) return;
      last = key;
      copy.style.opacity = key;
    });
  }, []);

  return (
    <Stage act="prep" labelledBy="prep-title">
      {/* The focus target of this panel is the votes beat: tabbing to a vote button lands there. */}
      <Panel beats={["votes", "unfold", "q1", "q2", "q3"]} focusable at={0.45} className="prep-panel">
        <div className="prep-grid">
          <div ref={copyRef} className="prep-copy">
            <div className="prep-group" data-state={stateOf(0, group)}>
              <p className="type-mono prep-label">{storyCopy.unfold.label}</p>
              <h2 id="prep-title" className="type-h2 prep-h">
                {storyCopy.unfold.h2}
              </h2>
              <div className="prep-sources">
                {SOURCES.map((s, i) => (
                  <div key={s.left} className="prep-src" data-state={stateOf(i, source)}>
                    <p className="type-lead prep-src-lead">{s.left}</p>
                    <p className="type-body prep-src-detail">{s.leftDetail}</p>
                  </div>
                ))}
              </div>
              <ol className="prep-steps" aria-hidden="true">
                {SOURCES.map((s, i) => (
                  <li key={s.lineLabel} className="prep-step type-mono" data-state={stateOf(i, source)}>
                    {String(i + 1).padStart(2, "0")} · {s.lineLabel}
                  </li>
                ))}
              </ol>
            </div>

            <div className="prep-group" data-state={stateOf(1, group)}>
              <p className="type-mono prep-label">{storyCopy.votes.label}</p>
              <h2 className="type-h2 prep-h">{storyCopy.votes.h2}</h2>
              <p className="type-body prep-body">{storyCopy.votes.body}</p>
              <p className="prep-hint">
                {storyCopy.votes.hint}
                <Arrow />
              </p>
            </div>
          </div>

          <div className="prep-sheet-col">
            <div ref={wrapRef} className="prep-sheet-wrap">
              <FaceSlot anchor="sheet" face="sheet" skin="night" className="prep-sheet-slot" />
              {/* Where the folded sheet arrives: the top third of the open sheet, same left and width. */}
              <div className="prep-folded only-motion">
                <FaceSlot anchor="sheet-folded" face="sheet" skin="night" fold={0} showWhenStatic={false} className="!aspect-auto !h-full !w-full">
                  <div aria-hidden="true" />
                </FaceSlot>
              </div>
            </div>
          </div>
        </div>
      </Panel>
      <p className="story-caption">{storyCopy.common.illustrative}</p>
    </Stage>
  );
}
