"use client";

/**
 * The `tile` face: the Role as a card on the board (storyboard 2.5, beats 6 to 9),
 * drawn by the product Board's own `Tile` (components/product). Natural size
 * 154 × 92 (the tile is laid out at 200 × 120 and scaled as one picture, so it
 * matches the board's tiles at any size). Paper in both skins.
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
import { Showcase, Tile, productData } from "@/components/product";
import { storyCopy } from "@/lib/content";
import { story } from "@/lib/story";

const role = productData.roles[0];
const labels = [storyCopy.saved.chip, storyCopy.applied.chip, storyCopy.interview.chip] as const;
const TICK = 14;
/** The tile's layout size before it is scaled to the 154 × 92 face. */
export const TILE_LAYOUT = { w: 200, h: 120 } as const;

export function TileFace({ host }: FaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (story.reduced()) return;
    const root = rootRef.current;
    const tag = root?.querySelector<HTMLElement>(".pp-tag");
    const last = { c: -1, tick: -1 };
    const write = () => {
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
  }, []);

  return (
    <div ref={rootRef} className="pl-tile-face" data-state="2">
      {host === "dock" ? (
        <p className="sr-only">
          {role.title}, {role.company}. {storyCopy.interview.chip}. {role.score} out of 10 fit.
        </p>
      ) : null}
      <Showcase size={TILE_LAYOUT} scale={154 / TILE_LAYOUT.w} decorative>
        <div className="pp" data-skin="day" data-bare="">
          <Tile item={{ role, stage: "saved", date: labels[2] }} />
        </div>
      </Showcase>
      <svg className="pl-tile-tick" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path ref={tickRef} d="M3.5 8.4l3 3 6-6.6" strokeDasharray={TICK} style={{ strokeDashoffset: 0 }} />
      </svg>
    </div>
  );
}

registerFace("tile", TileFace);
