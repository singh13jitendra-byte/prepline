"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, useContext } from "react";
import { FaceBoxContext } from "@/components/story/faces";
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
 * - Minimum scale: inside a story face (which sets `--pp-min: 0.85` and its own scale as
 *   `--face-k`), a screen is never drawn smaller than that. If `scale × face scale` falls below
 *   it, the screen is laid out in a proportionally narrower box at the minimum scale, so its
 *   narrow layout takes over where the desktop layout would have been shrunk to 7px type. The
 *   footprint does not change. Outside a face (the gallery, the hero laptop) nothing changes.
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
  // Inside a story face: is this the face's own screen (its drawn size is the face's registered
  // size)? Then it follows the face's size on this screen (smaller on a phone) and obeys the
  // minimum scale. Any other showcase inside a face is left exactly as sized by its author.
  const box = useContext(FaceBoxContext);
  const own = box !== null && scale !== undefined && Math.abs(w * scale - box.registered.width) < 1.5 && Math.abs(h * scale - box.registered.height) < 1.5;
  const lw = own && scale ? box.now.width / scale : w;
  const lh = own && scale ? box.now.height / scale : h;

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
      style={{
        ...(scale !== undefined ? ({ "--pp-s": scale } as CSSProperties) : null),
        // Not the face's own screen: no minimum scale here.
        ...(box !== null && !own ? ({ "--pp-min": 0.001 } as CSSProperties) : null),
        ...style,
      }}
      aria-hidden={decorative || undefined}
      inert={decorative || undefined}
    >
      <div
        className="pp-showcase-inner"
        style={{
          // --pp-fit (product.css) is 1 unless the copy would be drawn below the minimum scale of
          // its context (a story face sets --pp-min). Then the layout box shrinks by that factor and
          // the scale grows by it: the footprint is unchanged, the screen re-lays out narrower (its
          // container queries pick the narrow layout) and its type is never below the minimum.
          // With a fixed `scale` inside a story face, the layout box follows the face's natural
          // size (--face-w / --face-h, which change on small screens) rather than the size prop.
          width: `calc(${lw}px * var(--pp-fit, 1))`,
          height: `calc(${lh}px * var(--pp-fit, 1))`,
          transform: `scale(calc(var(--pp-s, 1) / var(--pp-fit, 1))) translate(-50%, -50%)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
