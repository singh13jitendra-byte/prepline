"use client";

/**
 * The `tile` face: the Role as a card on the board (storyboard 2.5, beats 6 to 9),
 * drawn by the product Board's own `Tile` (components/product). Natural size
 * 154 × 92, laid out at 1/0.77 of its box and scaled by 0.77 as one picture, so
 * it matches the board's tiles. Paper in both skins.
 *
 * Registered `fit: "height"`: the face scales with its box's height and its layout
 * takes the box's width. At the end of nightfall the box is the folded sheet's
 * 560 × 240 panel, and the tile is then laid out exactly like the sheet's cover
 * (this same component in a 214.7 × 92 box), so the cut to the sheet is invisible.
 *
 * A pressed flower of the Role's type (PressedFlower) is taped into the bottom-right margin, left
 * of the tick, clear of the title, the score and the chip. Static and decorative.
 *
 * The chip flips with the story: saved → applied → interview (with a calendar
 * mark and a drawn tick). It reads `tileShow` every frame; the board
 * performances own those values. Server and reduced-motion markup show the end
 * state (the tile rests in Interview).
 *
 * Acts III–IV render this same component as the folded sheet's cover
 * (SheetFace, `TileFace skin="day" host="actor"`), so nightfall's tile → sheet
 * hand-over shows one picture.
 */

import { useEffect, useRef } from "react";
import "@/components/acts/read/faces.css";
import { tileShow } from "@/components/acts/read/runtime";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { Tile, productData } from "@/components/product";
import { storyCopy } from "@/lib/content";
import { story } from "@/lib/story";
import { PressedFlower } from "@/components/art/PressedFlower";
import { flowerOf } from "@/components/world/fieldFlowers";

const role = productData.roles[0];
/** The Role's flower (its type, as in the meadow), pressed into the tile's bottom-right margin. */
const FLOWER = flowerOf(role.title);
const labels = [storyCopy.saved.chip, storyCopy.applied.chip, storyCopy.interview.chip] as const;
const TICK = 14;
/** The tile's layout size before it is scaled to the 154 × 92 face (the layout scale is 0.77). */
export const TILE_LAYOUT = { w: 200, h: 120 } as const;

export function TileFace({ host }: FaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (story.reduced()) return;
    const root = rootRef.current;
    const tag = root?.querySelector<HTMLElement>(".pp-tag");
    const last = { c: -1, tick: -1, cover: -1 };
    // The flying tile's own chrome (the cover inside SheetFace has none: the sheet has no chrome).
    const chrome = host === "actor" ? root?.closest(".face")?.querySelector<HTMLElement>(":scope > .face-chrome") ?? null : null;
    const write = () => {
      // End of nightfall: the tile is about to become the folded sheet, whose cover is bare paper
      // (no keyline, no lamp print). Ease both away over the last quarter of the travel, so the
      // cut to the sheet changes nothing on screen (founder recording, z_26: no white flash).
      if (chrome) {
        const s = story.get();
        const k = s.beat === "nightfall" ? Math.max(0, Math.min(1, (s.actor.travel - 0.75) / 0.25)) : 0;
        if (k !== last.cover) {
          last.cover = k;
          if (k > 0) {
            chrome.setAttribute("data-tile-cover", "");
            chrome.style.setProperty("--tile-cover", k.toFixed(3));
          } else {
            chrome.removeAttribute("data-tile-cover");
            chrome.style.removeProperty("--tile-cover");
          }
        }
      }
      const c = tileShow.applied + tileShow.interview;
      if (c !== last.c && tag) {
        last.c = c;
        const index = Math.min(2, Math.round(c));
        const f = c - Math.floor(c);
        // Flip on the X axis: out to 90° on the old label, in from −90° on the new one.
        const angle = f === 0 ? 0 : f < 0.5 ? f * 180 : -(1 - f) * 180;
        if (tag.textContent !== labels[index]) tag.textContent = labels[index];
        tag.style.transform = angle ? `rotateX(${angle.toFixed(2)}deg)` : "";
        root?.setAttribute("data-state", String(index));
      }
      if (tileShow.tick !== last.tick) {
        last.tick = tileShow.tick;
        tickRef.current?.style.setProperty("stroke-dashoffset", (TICK * (1 - tileShow.tick)).toFixed(2));
      }
    };
    write();
    return story.frame("actor", write);
  }, [host]);

  return (
    <div ref={rootRef} className="pl-tile-face" data-state="2">
      {host === "dock" ? (
        <p className="sr-only">
          {role.title}, {role.company}. {storyCopy.interview.chip}. {role.score} out of 10 fit.
        </p>
      ) : null}
      {/* Follows its box: 1/0.77 of the box, scaled by 0.77 (faces.css). Decorative in every host. */}
      <div className="pl-tile-scale" aria-hidden="true" inert>
        <div className="pp" data-skin="day" data-bare="">
          <Tile item={{ role, stage: "saved", date: labels[2] }} />
        </div>
      </div>
      <PressedFlower type={FLOWER} size={33} tilt={-10} className="pl-tile-pressed" />
      <svg className="pl-tile-tick" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path ref={tickRef} d="M3.5 8.4l3 3 6-6.6" strokeDasharray={TICK} style={{ strokeDashoffset: 0 }} />
      </svg>
    </div>
  );
}

registerFace("tile", TileFace, { fit: "height" });
