"use client";

/**
 * ACT I — READ (night). Storyboard 2.3 and 2.4: beats `hero`, `pass1`, `pass2`,
 * `ranked`, `reason`, and the outgoing half of `daybreak`.
 *
 * Exposes the anchors `hero-underline`, `row-1` … `row-12`, `ranked-rule`,
 * `card` and `card-meter`, and registers the `row` and `card` faces.
 */

import "@/components/faces/CardFace";
import "@/components/faces/RowFace";
import { Stage } from "@/components/story/Stage";
import { storyCopy } from "@/lib/content";
import { HeroPanel } from "./read/HeroPanel";
import { ReadPanel } from "./read/ReadPanel";
import "./read/read.css";

/**
 * Until the World's ChapterBackdrop is merged, the stub CSS (components/story/stubs.tsx)
 * paints this class night or day. It does nothing once stubs.tsx is deleted at integration.
 */
export const DEV_BACKDROP = "";

export function Illustrative() {
  return (
    <p className="story-caption">
      {storyCopy.common.illustrative}
    </p>
  );
}

export function ActRead() {
  return (
    <Stage act="read" labelledBy="read-title" stageClassName={`${DEV_BACKDROP} rd-stage`}>
      <HeroPanel />
      <ReadPanel />
      <Illustrative />
    </Stage>
  );
}
