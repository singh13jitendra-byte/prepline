"use client";

/**
 * ACT III — PREP (night, lamp-lit). Storyboard 2.6.
 *
 *   unfold  the folded sheet arrives in the dark; the lamp comes up with scroll and the
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
import { BEATS, clamp01, story, type BeatId } from "@/lib/story";
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
  const stageRef = useRef<HTMLDivElement>(null);

  // Which group and which source line is showing. Before the act, the first group waits below.
  const b = idx(beat);
  const group = b >= idx("votes") ? 1 : b >= idx("nightfall") ? 0 : -1;
  const qi = Q_BEATS.indexOf(beat);
  const source = qi >= 0 ? qi : b > idx("q3") ? 3 : -1;

  // The lamp: rises with scroll through the unfold; its centre follows the pointer at 10%.
  useEffect(() => {
    const host = stageRef.current;
    if (!host || story.reduced()) return;
    let last = "";
    return story.subscribe((s) => {
      const i = idx(s.beat);
      const lamp = i < idx("unfold") ? 0 : s.beat === "unfold" ? clamp01(s.beatProgress / 0.85) : 1;
      let lx = 0;
      let ly = 0;
      if (s.pointer.fine && s.pointer.inside && i >= idx("unfold") && i <= idx("votes")) {
        lx = (s.pointer.x - s.viewport.w * 0.72) * 0.1;
        ly = (s.pointer.y - s.viewport.h * 0.25) * 0.1;
      }
      const key = `${lamp.toFixed(3)}|${lx.toFixed(1)}|${ly.toFixed(1)}`;
      if (key === last) return;
      last = key;
      host.style.setProperty("--lamp", lamp.toFixed(3));
      host.style.setProperty("--lx", `${lx.toFixed(1)}px`);
      host.style.setProperty("--ly", `${ly.toFixed(1)}px`);
    });
  }, []);

  return (
    <Stage act="prep" labelledBy="prep-title">
      <div ref={stageRef} className="prep-lamp-host" style={{ position: "absolute", inset: 0 }}>
        <div className="prep-lamp" aria-hidden="true" />
      </div>
      {/* The focus target of this panel is the votes beat: tabbing to a vote button lands there. */}
      <Panel beats={["votes", "unfold", "q1", "q2", "q3"]} focusable at={0.45} className="prep-panel">
        <div className="prep-grid">
          <div className="prep-copy">
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
              <h3 className="type-h2 prep-h">{storyCopy.votes.h2}</h3>
              <p className="type-body prep-body">{storyCopy.votes.body}</p>
              <p className="prep-hint">
                {storyCopy.votes.hint}
                <Arrow />
              </p>
            </div>
          </div>

          <div className="prep-sheet-col">
            <div className="prep-sheet-wrap">
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
        <p className="type-mono prep-illustrative">{storyCopy.common.illustrative}</p>
      </Panel>
    </Stage>
  );
}
