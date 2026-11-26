"use client";

/**
 * FaceSlot and FaceFrame — the real-DOM half of the docking rule (storyboard 5.3).
 *
 * The Actor is a flying, aria-hidden duplicate. Every anchor it rests on must
 * hold the same face as real, semantic DOM, so screen readers and keyboards
 * always have the content, and so the hand-over is invisible.
 *
 *   <FaceSlot anchor="card" face="card" skin="night" />
 *   <FaceSlot anchor="ticket" face="ticket" skin="day" className="w-full max-w-[520px]" />
 *   <FaceSlot anchor="sheet-folded" face="sheet" skin="night" fold={0} showWhenStatic={false} />
 *
 * What it does for you
 * - Registers the anchor and lays the slot out at the face's natural size
 *   (width = natural width, capped at 100% of the parent, natural aspect ratio).
 *   Override the width with className; the content scales with it.
 * - Renders the registered face with `host="dock"` inside the same chrome the
 *   Actor uses, so both copies are pixel-identical.
 * - Motion mode: the slot is invisible (opacity 0, still in the accessibility
 *   tree and tab order) while the Actor is away, in flight, or covering it. The
 *   Actor engine sets `data-docked` on it when the Actor comes to rest on a
 *   docking beat, which shows the slot and hides the Actor in the same frame.
 * - Static mode (reduced motion or no JS): the slot is simply visible, unless
 *   `showWhenStatic={false}` (use that for stops that would repeat the Role in
 *   the stacked page: tile-saved, tile-applied, hinge-float, sheet-folded).
 * - Pass `children` to render your own DOM instead of the registered face.
 *
 * `FaceFrame` is the shared chrome + scaled content. You rarely need it directly.
 */

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { registerAnchor, type AnchorId } from "@/lib/anchors";
import type { FaceId, Skin } from "@/lib/story";
import { facesVersion, getFace, subscribeFaces, type FaceProps } from "./faces";
import { faceRadius, onThemeChange } from "@/lib/theme";

/**
 * Paper objects stay paper whatever the chapter's light: the tile, the sheet and the ticket in both
 * skins, the row and the card by day. `[data-paper]` is the theme scope for them (app/themes/_template.css);
 * no default style uses it.
 */
const isPaper = (face: FaceId, skin: Skin) => skin === "day" || face === "tile" || face === "sheet" || face === "ticket";

export function FaceFrame({ face, skin, fold, progress, host }: { face: FaceId } & FaceProps) {
  useSyncExternalStore(subscribeFaces, facesVersion, () => 0);
  const { Component, meta } = getFace(face);
  return (
    <div className="face" data-face={face} data-skin={skin} data-paper={isPaper(face, skin) ? "" : undefined} data-chrome={meta.chrome ? "" : undefined}>
      {meta.chrome ? <div className="face-chrome" /> : null}
      <div className="face-clip" data-clip={meta.clip ? "" : undefined}>
        <div className="face-content" style={{ width: meta.width, height: meta.height }}>
          <Component skin={skin} fold={fold} progress={progress} host={host} />
        </div>
      </div>
    </div>
  );
}

type FaceSlotProps = {
  anchor: AnchorId;
  face: FaceId;
  skin: Skin;
  /** Settled fold passed to the face (sheet). Default 1 (open). */
  fold?: number;
  /** Show this slot in the static (reduced-motion) page. Default true. */
  showWhenStatic?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Custom real DOM instead of the registered face. */
  children?: ReactNode;
};

export function FaceSlot({ anchor, face, skin, fold = 1, showWhenStatic = true, className, style, children }: FaceSlotProps) {
  useSyncExternalStore(subscribeFaces, facesVersion, () => 0);
  const ref = useRef<HTMLDivElement>(null);
  const { meta } = getFace(face);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const off = registerAnchor(anchor, el);
    const apply = () => {
      const scale = el.clientWidth / meta.width || 1;
      el.style.setProperty("--face-scale", scale.toFixed(4));
      el.style.setProperty("--face-radius", `${(faceRadius(face, meta.radius) * scale).toFixed(2)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    const offTheme = onThemeChange(apply);
    return () => {
      ro.disconnect();
      offTheme();
      off();
    };
  }, [anchor, face, meta.width, meta.radius]);

  return (
    <div
      ref={ref}
      className={`face-slot${showWhenStatic ? "" : " only-motion"}${className ? ` ${className}` : ""}`}
      data-face-slot={face}
      style={
        {
          "--slot-w": `${meta.width}px`,
          "--face-radius": `var(--r-face-${face}, ${meta.radius}px)`,
          "--fold": fold,
          "--progress": 1,
          "--flip": 0,
          aspectRatio: `${meta.width} / ${meta.height}`,
          ...style,
        } as CSSProperties
      }
    >
      {children ?? <FaceFrame face={face} skin={skin} fold={fold} progress={1} host="dock" />}
    </div>
  );
}
