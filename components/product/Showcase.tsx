"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cx } from "./primitives";

/**
 * Natural sizes the scroll story places the product screens at. A screen is
 * laid out at exactly this size, then scaled as one picture, so text wraps and
 * truncates the same way in every frame.
 */
export const SHOWCASE_SIZES = {
  matches: { w: 560, h: 640 },
  role: { w: 520, h: 360 },
  board: { w: 900, h: 420 },
  prep: { w: 560, h: 720 },
  ticket: { w: 520, h: 300 },
  matchesMobile: { w: 360, h: 640 },
  roleMobile: { w: 360, h: 600 },
  boardMobile: { w: 360, h: 520 },
  prepMobile: { w: 360, h: 720 },
  ticketMobile: { w: 360, h: 360 },
} as const;

export type ShowcaseSize = keyof typeof SHOWCASE_SIZES | { w: number; h: number };

/**
 * Renders a product screen at a fixed natural size and scales it to its box.
 *
 *   <div style={{ width: 400, height: 460 }}>
 *     <Showcase size="matches" decorative><MatchesList /></Showcase>
 *   </div>
 *
 * - `fit="contain"` (default) scales to fit the parent box, centred.
 *   `fit="width"` scales to the parent's width and lets height follow.
 * - `scale` fixes the factor and skips measuring (cheapest inside a moving frame).
 * - `decorative` makes the copy inert and hidden from assistive tech, for the
 *   flying copies of a face. Leave it off for the one copy people interact with.
 * - The scale is written to a CSS variable, never through React state, so a
 *   resizing frame costs no re-render.
 */
export function Showcase({
  size,
  scale,
  fit = "contain",
  decorative = false,
  children,
  className,
  style,
}: {
  size: ShowcaseSize;
  scale?: number;
  fit?: "contain" | "width";
  decorative?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { w, h } = typeof size === "string" ? SHOWCASE_SIZES[size] : size;
  const outer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el || scale !== undefined) return;
    const apply = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const s = fit === "width" || !H ? W / w : Math.min(W / w, H / h);
      el.style.setProperty("--pp-s", String(s > 0 ? s : 1));
      if (fit === "width") el.style.height = `${h * s}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, scale, fit]);

  return (
    <div
      ref={outer}
      className={cx("pp-showcase", className)}
      style={{ ...(scale !== undefined ? ({ "--pp-s": scale } as CSSProperties) : null), ...style }}
      aria-hidden={decorative || undefined}
      inert={decorative || undefined}
    >
      <div
        className="pp-showcase-inner"
        style={{
          width: w,
          height: h,
          transform: `scale(var(--pp-s, 1)) translate(-50%, -50%)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
