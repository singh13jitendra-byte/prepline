import type { CSSProperties, ReactNode } from "react";
import { ART, type ArtId } from "./registry";

export type ArtProps = {
  /** 0..1 dash progress. Omit to let CSS drive it through `--draw` (default 1, fully drawn). */
  draw?: number;
  className?: string;
  /** Accessible name. Without it the drawing is aria-hidden. */
  title?: string;
  /** Force the fills on or off instead of letting them follow `draw` (seat taken, empty frame). */
  fills?: boolean;
  /** Prefix for element ids when the same drawing is on the page more than once. */
  idPrefix?: string;
  style?: CSSProperties;
};

type Props = ArtProps & { id: ArtId; children?: ReactNode };

/**
 * Renders one registry drawing: fills first (off register, grain-broken), then the single stroke.
 *
 * Every colour, weight, offset and filter is a theme token:
 *   --art-stroke-color, --art-stroke, --art-stroke-fine, --art-fill, --art-fill-opacity,
 *   --art-register-x/y, --art-wobble, --art-wobble-small, --art-ink.
 *
 * Draw-on: the path carries `stroke-dasharray: calc(var(--draw) * L) L`. Pass `draw`, or write
 * `--draw` on the <svg> (or any ancestor) from scroll without a React render. Fills fade in
 * over the last stretch (85% to 97%), so reversing `--draw` takes them away first.
 */
export function Art({ id, draw, className, title, fills, idPrefix, style, children }: Props) {
  const a = ART[id];
  const fine = a.weight === "fine";
  const L = a.length;
  const base = `${idPrefix ? `${idPrefix}-` : ""}art-${id}`;
  const p = draw == null ? "var(--draw, 1)" : String(Math.min(1, Math.max(0, draw)));
  const fillGate =
    fills == null ? `clamp(0, calc((${p} - 0.85) * 8.4), 1)` : fills ? "1" : "0";

  return (
    <svg
      className={className}
      width={a.w}
      height={a.h}
      viewBox={`0 0 ${a.w} ${a.h}`}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-art={id}
      style={{ overflow: "visible", ...style }}
    >
      {title ? <title>{title}</title> : null}
      {a.fills.length > 0 && (
        <g
          data-art-fills=""
          style={{
            transform: "translate(var(--art-register-x, 6px), var(--art-register-y, 5px))",
            filter: "var(--art-ink, url(#nd-riso))",
          }}
        >
          {a.fills.map((f) => (
            <path
              key={f.id}
              id={`${base}-fill-${f.id}`}
              d={f.d}
              style={{
                fill: "var(--art-fill, var(--c-line))",
                opacity: `calc(${fillGate} * ${f.opacity ?? `var(--art-fill-opacity, 1)`} * ${f.k ?? 1})`,
              }}
            />
          ))}
        </g>
      )}
      {children}
      <g data-art-line="" style={{ filter: fine ? "var(--art-wobble-small, url(#nd-hand-s))" : "var(--art-wobble, url(#nd-hand))" }}>
        <path
          id={`${base}-line`}
          d={a.d}
          data-length={L}
          style={{
            fill: "none",
            stroke: "var(--art-stroke-color, var(--c-line))",
            strokeWidth: fine ? "var(--art-stroke-fine, 1.8px)" : "var(--art-stroke, 3px)",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeDasharray: `calc(${p} * ${L}px) ${Math.ceil(L) + 4}px`,
            // a zero-length dash still paints its round cap: hide the pen until it moves
            strokeOpacity: `clamp(0, calc(${p} * 400), 1)`,
          }}
        />
      </g>
    </svg>
  );
}
