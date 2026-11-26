"use client";

/**
 * THE POINTER'S NOTE — fine pointers only.
 *
 * Over the meadow, during the two reading passes, the fireflies near the cursor light up
 * and a small note names the nearest role and its verdict ("Product Designer · Pune · fits").
 * There is no ring and no glass: this component lends one element for the note, and the
 * canvas loop moves it, because the note has to name the same firefly the shader lights.
 * No WebGL, touch, small screens or reduced motion: no note.
 */

import { useEffect, useRef } from "react";
import { story } from "@/lib/story";
import { worldBus } from "./bus";

export function Lens() {
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (story.reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    worldBus.lensLabel = label.current;
    // The note steps back over anything you can press or type in.
    const onOver = (e: PointerEvent) => {
      worldBus.overControl = Boolean((e.target as Element | null)?.closest?.("a,button,input,textarea,select,label,[role='button']"));
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      worldBus.pointerMoved = true;
      window.removeEventListener("pointermove", onMove);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointermove", onMove);
      worldBus.lensLabel = null;
      worldBus.overControl = false;
    };
  }, []);

  return <div ref={label} aria-hidden="true" data-lens-label className="world-lens-label only-motion" style={{ opacity: 0 }} />;
}
