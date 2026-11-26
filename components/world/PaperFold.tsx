"use client";

import { useEffect, useRef } from "react";
import { story, type StoryState } from "@/lib/story";
import "./paper-fold.css";

/**
 * PAPER FOLD (delight 5) — daybreak: the night is a sheet of paper, and the Line peels it up.
 *
 * The night meadow is the front of a sheet lying over the cream board. As the Line rises from the
 * bottom (LINE_TRACK.daybreak, the sweep), it is the crease: below it the board is uncovered (the
 * stages are still clipped at --day-top by StoryRoot, exactly as before), and the part of the
 * night that was below it is folded back up over the rest, so what is seen above the crease is the
 * sheet's back, plain cream paper, up to its free edge. A real peel: the free edge travels at
 * about twice the speed of the crease, so the meadow is covered by the time the Line is half way
 * up, and the flap's edge leaves the top of the screen while the crease finishes the sweep.
 *
 * Nothing heavy is touched. The painting, the WebGL canvas and the acts are not redrawn or
 * duplicated: the flap is a cheap paper element laid over them, on its own layers, and per frame
 * only three transforms (and, at the two ends, two opacities) are written, each only when it
 * changes. The paper cues, all theme tokens (pine at low alpha for shade, paper for light):
 *   .pf-sheet   the flap's back: the stock's grain, a catch-light along its free edge, which sags
 *               a few px at the corners (it is held at the middle), and light falling off toward
 *               the crease.
 *   .pf-crease  the roll at the crease: the paper turning away darkens, a thin highlight where it
 *               faces the light, and the dark underside of the roll right on the Line.
 *   .pf-cast    the soft shadow the roll casts on the cream underneath, just below the Line.
 * Stack: z-index --z-actor but before the Actor layer in the DOM, so it is over both stages and
 * under the travelling RoleDetail card (still cut into its two skins by the Line) and the Line.
 *
 * Scroll-scrubbed, so it reverses exactly. Hidden (visibility, never display) outside the sweep.
 * Reduced motion: never runs (.only-motion), the straight wipe stands. Phones: the same fold,
 * with a smaller roll (CSS).
 */

/** How much of the flap's length is seen: it is not pressed flat, it stands a little off the sheet. */
const FLAP = 0.9;
/** The crease band's height (px, paper-fold.css .pf-crease): its opacity ramps in over the first stretch of flap. */
const ROLL = 64;

/**
 * Where the flap's free edge is on screen (px) while the fold shows, else null. The Line reads it
 * so its margin note, which sits just above the crease, is inked for paper there, not for night.
 */
export function foldEdge(s: Readonly<StoryState>): number | null {
  const vh = s.viewport.h;
  const C = s.dayTop;
  if (s.beat !== "daybreak" || s.line.daySide !== "below" || C <= 0 || C >= vh) return null;
  return C - FLAP * (vh - C);
}

const q = (v: number) => (v <= 0.005 ? "0" : v >= 0.995 ? "1" : v.toFixed(2));

export function PaperFold() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || story.reduced()) return;
    const clip = el.querySelector<HTMLElement>(".pf-clip");
    const sheet = el.querySelector<HTMLElement>(".pf-sheet");
    const crease = el.querySelector<HTMLElement>(".pf-crease");
    const cast = el.querySelector<HTMLElement>(".pf-cast");
    if (!clip || !sheet || !crease || !cast) return;
    const last = { v: "", clip: "", sheet: "", crease: "", cast: "", castO: "" };
    const put = (node: HTMLElement, key: "clip" | "sheet" | "cast", v: string) => {
      if (last[key] === v) return;
      last[key] = v;
      node.style.transform = v;
    };
    return story.subscribe((s) => {
      const F = foldEdge(s);
      const v = F === null ? "hidden" : "visible";
      if (v !== last.v) el.style.visibility = last.v = v;
      if (F === null) return;
      // The crease is the Line; the flap above it is FLAP x the length of night it has taken up.
      const C = s.dayTop;
      const L = C - F;
      put(clip, "clip", `translate3d(0,${C.toFixed(1)}px,0)`);
      put(sheet, "sheet", `translate3d(0,${(-L).toFixed(1)}px,0)`);
      put(cast, "cast", `translate3d(0,${C.toFixed(1)}px,0)`);
      // The roll only exists once there is a flap to roll; its shadow fades as the crease reaches the top.
      const co = q(Math.min(1, L / ROLL));
      if (co !== last.crease) crease.style.opacity = last.crease = co;
      const so = q(Math.min(1, L / 40) * Math.min(1, C / 90));
      if (so !== last.castO) cast.style.opacity = last.castO = so;
    });
  }, []);
  return (
    <div ref={root} aria-hidden="true" className="pf only-motion">
      <div className="pf-cast" />
      <div className="pf-clip">
        <div className="pf-sheet" />
        <div className="pf-crease" />
      </div>
    </div>
  );
}
