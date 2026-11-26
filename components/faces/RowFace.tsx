"use client";

/**
 * The `row` face: the Role as rank 1 of the twelve (storyboard 2.4, beat 4),
 * drawn by the product's own `MatchRow` (components/product). Natural size
 * 440 × 44. The row is paper in both skins (it belongs to the cream list panel),
 * selected: a 2px keyline on the highlight tint (the engine paints that box).
 * Flying copies are decorative; the docked copy is the real, labelled row.
 */

import "@/components/acts/read/faces.css";
import { useRow1Hover } from "@/components/acts/read/RowView";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { MatchRow, Showcase, productData } from "@/components/product";

export function RowFace({ host }: FaceProps) {
  const hover = useRow1Hover();
  return (
    <div className="pl-row-face" data-hover={host === "actor" && hover ? "" : undefined}>
      <Showcase size={{ w: 440, h: 44 }} scale={1} decorative={host === "actor"}>
        <MatchRow role={productData.roles[0]} skin="day" />
      </Showcase>
    </div>
  );
}

registerFace("row", RowFace);
