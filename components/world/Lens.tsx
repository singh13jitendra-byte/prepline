"use client";

/**
 * THE READING LENS — fine pointers only (storyboard 3).
 *
 * A 140px-radius ring that follows the cursor over the field in Act I, with a
 * mono micro-label for the nearest role and its verdict. This component only
 * lends its two elements: the canvas loop moves them, because the lens is part
 * of the shader (specks inside it sharpen, grow, and the twelve glint) and the
 * label has to name the same speck the shader lifts. No WebGL, touch, small
 * screens or reduced motion: the lens stays dark.
 */

import { useEffect, useRef } from "react";
import { story } from "@/lib/story";
import { LENS_RADIUS, worldBus } from "./bus";

export function Lens() {
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (story.reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    worldBus.lensRing = ring.current;
    worldBus.lensLabel = label.current;
    // The lens steps back over anything you can press or type in.
    const onOver = (e: PointerEvent) => {
      worldBus.overControl = Boolean((e.target as Element | null)?.closest?.("a,button,input,textarea,select,label,[role='button']"));
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onOver);
      worldBus.lensRing = worldBus.lensLabel = null;
      worldBus.overControl = false;
    };
  }, []);

  return (
    <>
      <div
        ref={ring}
        aria-hidden="true"
        data-lens
        className="world-lens only-motion"
        style={{ width: LENS_RADIUS * 2, height: LENS_RADIUS * 2, opacity: 0 }}
      />
      <div ref={label} aria-hidden="true" data-lens-label className="world-lens-label only-motion" style={{ opacity: 0 }} />
    </>
  );
}
