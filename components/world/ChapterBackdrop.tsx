"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { story } from "@/lib/story";
import { Grain } from "./Grain";

/**
 * CHAPTER BACKDROP — the bottom of the layer stack (storyboard 5.1).
 *
 * Two fixed full-viewport sheets, night under day, and the grain over both.
 * Day is always below the line. While the line sweeps, the day sheet is
 * clipped with `inset(var(--day-top) 0 0 0)`; the store writes --day-top every
 * frame, this component only switches the sheet between three modes (hidden,
 * split, whole) when the mode changes. Outside a sweep the sheet is whole or
 * gone, so a mobile URL bar resizing the viewport can never leave a sliver.
 * Server-rendered: the night is there on the first frame, before any script.
 *
 * The painted scenes are passed in as two slots so the stack reads bottom to top:
 * pine, the night paintings (`night`), the cream day sheet, the dawn painting and the
 * grass (`day`), the grain.
 */
export function ChapterBackdrop({ night, day: over }: { night?: ReactNode; day?: ReactNode }) {
  const day = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (story.reduced()) return;
    let mode = "";
    return story.subscribe((s) => {
      const next = s.line.daySide === "below" ? "split" : s.chapter;
      if (next === mode || !day.current) return;
      mode = next;
      day.current.dataset.mode = next;
    });
  }, []);
  return (
    <>
      <div aria-hidden="true" data-backdrop="night" className="world-night only-motion" />
      {night}
      <div ref={day} aria-hidden="true" data-backdrop="day" data-mode="night" className="world-day only-motion" />
      {over}
      <Grain />
    </>
  );
}
