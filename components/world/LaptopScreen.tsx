"use client";

import { MatchesList, Showcase } from "@/components/product";

/**
 * The hero laptop's screen: a live MatchesList (the real component, real data module),
 * laid out at its natural width and scaled as one picture into the `laptop-screen` hotspot.
 * Decorative: inert and hidden from assistive tech. The real, usable list is in Act I.
 */
const SCREEN = { w: 580, h: 352 }; // the painted screen's proportions (267 : 162)

export function LaptopScreen() {
  return (
    <Showcase size={SCREEN} fit="width" decorative>
      <div style={{ width: SCREEN.w, height: SCREEN.h, overflow: "hidden" }}>
        <MatchesList skin="day" bare illustrative={false} hints={false} cut={false} defaultSelectedId={null} />
      </div>
    </Showcase>
  );
}
