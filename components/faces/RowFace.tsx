"use client";

/**
 * The `row` face: the Role as rank 1 of the twelve (storyboard 2.4, beat 4).
 * Natural size 440 x 44. Chrome (fill, border, radius) is painted by the engine.
 * Both skins share one layout; only the --face-* colours differ.
 */

import "@/components/acts/read/faces.css";
import { RowView, useRow1Hover } from "@/components/acts/read/RowView";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { rankedRoles } from "@/lib/content";

export function RowFace({ host }: FaceProps) {
  const hover = useRow1Hover();
  return <RowView role={rankedRoles[0]} hover={host === "actor" && hover} />;
}

registerFace("row", RowFace);
