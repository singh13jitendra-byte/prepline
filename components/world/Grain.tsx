"use client";

/**
 * GRAIN — one fixed layer over the chapter backdrops (storyboard 4).
 * A 128px noise tile, baked once on mount into a data URL and tiled; it never
 * animates and has no blend mode. Each pixel is black or white at a low alpha
 * (a few percent, --tex-grain-alpha of 255), so it reads on night and on cream
 * alike and keeps the big gradients from banding.
 *
 * Theme: the tile is published as --grain on <html>; the layer paints the theme's
 * texture tokens (--tex-night, --tex-paper by chapter), which default to it.
 */

import { useEffect, useRef } from "react";

export function Grain() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const size = 128;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(size, size);
      const alpha = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tex-grain-alpha")) || 10;
      let seed = 1234567;
      const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < size * size; i++) {
        const v = rand() < 0.5 ? 0 : 255;
        const a = rand();
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = Math.round(a * alpha);
      }
      ctx.putImageData(img, 0, 0);
      document.documentElement.style.setProperty("--grain", `url(${c.toDataURL("image/png")})`);
    } catch {
      /* no grain is fine */
    }
  }, []);
  return <div ref={ref} aria-hidden="true" data-grain className="world-grain only-motion" />;
}
