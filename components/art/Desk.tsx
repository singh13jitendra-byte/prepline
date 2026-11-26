import { Art, type ArtProps } from "./Art";
import { ART } from "./registry";

/**
 * Desk, 620 x 380, baseline y 340. The hero scene. One path, 2,418px long.
 * Pen route, left to right: baseline in; mug (up the left side, loop at the rim corner, rim,
 * D handle, down); baseline; laptop (wedge up to the hinge, hinge line, up the right side,
 * top, down the left side, back under the hinge as the base slab); baseline; lamp (left half
 * of the dome, lower arm, joint loop, upper arm to the shade neck, lower shade edge, mouth,
 * upper shade edge, retrace both arms 8px to the right, right half of the dome); baseline out.
 * Joins: enters (0,340), exits (620,340). The hero underline runs straight into the entry.
 * Fills: light cone, bulb (solid on night), lit screen.
 *
 * `interior` adds the miniature ranked list inside the screen (five lines, one kept, a "9").
 * It is separate SVG, not part of the path, and follows the screen fill's visibility.
 */
export function Desk({ interior = false, ...props }: ArtProps & { interior?: boolean }) {
  const p = props.draw == null ? "var(--draw, 1)" : String(props.draw);
  return (
    <Art id="desk" {...props}>
      {interior && (
        <g
          data-art-interior=""
          style={{ opacity: `clamp(0, calc((${p} - 0.85) * 8.4), 1)`, strokeLinecap: "round", strokeWidth: 2 }}
        >
          <path d="M190,214 h62 M190,232 h104 M190,268 h84 M190,286 h50 M190,304 h96" style={{ stroke: "currentColor", opacity: 0.5 }} />
          <path d="M190,250 h118" style={{ stroke: "var(--art-stroke-color, var(--c-line))", strokeWidth: 3 }} />
          <text
            x="318"
            y="254.5"
            style={{ fill: "var(--art-stroke-color, var(--c-line))", fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 650 }}
          >
            9
          </text>
        </g>
      )}
    </Art>
  );
}

/** Lip points of the shade in drawing coordinates, upper lip first. The World places the cone from these. */
export const shadeLip = ART.desk.shadeLip!;
/** Clear area inside the laptop screen: x, y, w, h. */
export const screen = ART.desk.screen!;
