"use client";

/**
 * STAGE and PANEL — the sticky structure of an act (storyboard 5.4).
 *
 *   <Stage act="board" labelledBy="board-title">
 *     <Panel beats={["saved", "applied", "interview"]}>
 *       <h2 id="board-title">…</h2>
 *     </Panel>
 *     <Panel beats="hinge">…</Panel>
 *   </Stage>
 *
 * Stage renders `<section id data-act aria-labelledby>` holding one sticky
 * 100svh stage. Heights, overlaps and wipe lengths come from BEATS through CSS
 * custom properties: there are no pin-spacers and no GSAP `pin`.
 *   act "read" → #read (night)   "board" → #board (day)
 *   act "prep" → #prep (night)   "seat"  → #join  (day)
 *
 * How acts overlap: the next act's stage pins exactly when the wipe that
 * brings it in starts, so for the length of the wipe both stages are pinned on
 * screen together. Each is clipped to its own side of the line by CSS
 * (`html[data-wipe]` + `--day-top`). The outgoing stage then gets
 * `visibility: hidden` but stays pinned for STAGE_TAIL more units, so its
 * anchors hold still while the Actor leaves them.
 *
 * Panel is an absolutely positioned layer (inset 0) shown while any of its
 * `beats` is current. It also stays up through the wipe after its last beat and
 * the wipe before its first beat. Panels that are not current are
 * `visibility: hidden` and `inert`. Give several beats to one panel when the
 * same layout serves them all (the board, the sheet): scrub or perform inside it.
 *
 *   focusable   keep the panel's controls in the tab order while it is not
 *               current (it is then transparent instead of hidden). Focusing one
 *               scrolls its beat into place. Use it for the hero form, the vote
 *               buttons and the ticket form.
 *   at          where in the panel's first beat a focus should land (default 0.6).
 *
 * Stages are transparent: the night and day backgrounds are the World's
 * ChapterBackdrop. Visibility, `data-current` and `inert` are toggled by
 * StoryRoot on beat change, never by a React render.
 *
 * Static mode (reduced motion or no JS): no sticky, no clip. Every panel is an
 * ordinary block, stacked in order; night stages become night panels with a
 * 28px radius on the cream page. Use `.only-motion` / `.only-static` for
 * content that belongs to one mode.
 */

import type { CSSProperties, ReactNode } from "react";
import { actOf, panelIsCurrent, stageIsActive, type ActId, type BeatId } from "@/lib/story";

type StageProps = {
  act: ActId;
  /** id of the act's <h2> (or the <h1> for "read"). */
  labelledBy: string;
  className?: string;
  /** Class for the sticky stage element. */
  stageClassName?: string;
  children: ReactNode;
};

export function Stage({ act, labelledBy, className, stageClassName, children }: StageProps) {
  const a = actOf(act);
  return (
    <section
      id={a.domId}
      data-act={act}
      aria-labelledby={labelledBy}
      className={`story-act${className ? ` ${className}` : ""}`}
      style={{ "--act-len": a.len, "--act-overlap": a.overlap, "--act-pull": a.start === 0 ? 0 : 1 } as CSSProperties}
    >
      <div
        className={`story-stage${stageClassName ? ` ${stageClassName}` : ""}`}
        data-stage={act}
        data-chapter={a.chapter}
        // Server markup shows the first act. StoryRoot takes over on mount.
        data-active={stageIsActive(act, "hero") ? "" : undefined}
        suppressHydrationWarning
      >
        {children}
      </div>
    </section>
  );
}

type PanelProps = {
  beats: BeatId | readonly BeatId[];
  focusable?: boolean;
  at?: number;
  className?: string;
  children: ReactNode;
};

export function Panel({ beats, focusable, at, className, children }: PanelProps) {
  const list = typeof beats === "string" ? [beats] : beats;
  return (
    <div
      className={`story-panel${className ? ` ${className}` : ""}`}
      data-beats={list.join(" ")}
      data-focusable={focusable ? "" : undefined}
      data-at={at}
      data-current={panelIsCurrent(list, "hero") ? "" : undefined}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
