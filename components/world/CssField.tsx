/**
 * CSS FIELD — the field before the world arrives, and for good where it never
 * does (no WebGL, a small low-core device, Save-Data). Storyboard 5.6.
 *
 * Fixed layers of pre-rendered dots, each one inline SVG pattern (about 2KB
 * for the dense one, well under 1KB for the grid), server-rendered so they are
 * on the first frame:
 *   dense   the unread noise (bright), with a dim copy under it as dust
 *   grid    the kept: sparse, loosely scattered lights (bright), and a dim copy (round 5: no
 *           lattice; each light sits a random distance off its 48px cell's centre)
 *   gold    the twelve
 * They are clipped against --line-y by rules on html[data-beat] (index.tsx),
 * so the passes still read as dense noise turning into sparse order, and
 * against --day-top during a wipe. When the world draws its first frame they
 * fade out under it (html.world-on).
 *
 * Theme: the SVG tiles are masks (alpha only); the colour is the layer's own
 * background (--art-speck, --c-dim for the dimmed copies, --c-match for the gold),
 * so a theme recolours the field without re-encoding a tile.
 */

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (svg: string) => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;

/** Zero-length round-capped strokes are the cheapest dots SVG has. */
function denseTile(size: number, count: number, seed: number, opacity = 1) {
  const rand = rng(seed);
  const groups = ["", "", ""];
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const x = Math.round((((i % cols) + 0.1 + rand() * 0.8) / cols) * size);
    const y = Math.round(((Math.floor(i / cols) + 0.1 + rand() * 0.8) / cols) * size);
    const g = rand();
    groups[g < 0.5 ? 0 : g < 0.85 ? 1 : 2] += `M${x} ${y}h0`;
  }
  return esc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="none" stroke="black" stroke-linecap="round" opacity="${opacity}">` +
      `<path d="${groups[0]}" stroke-width="1.6" opacity=".4"/><path d="${groups[1]}" stroke-width="2.6" opacity=".62"/><path d="${groups[2]}" stroke-width="3.8" opacity=".85"/></svg>`,
  );
}

function gridTile(seed: number) {
  const rand = rng(seed);
  let d = "";
  for (let j = 0; j < 10; j++)
    for (let i = 0; i < 10; i++) {
      const on = rand() < 0.46;
      const dx = Math.round((rand() - 0.5) * 36);
      const dy = Math.round((rand() - 0.5) * 36);
      if (on) d += `M${24 + i * 48 + dx} ${24 + j * 48 + dy}h0`;
    }
  return esc(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" fill="none" stroke="black" stroke-linecap="round"><path d="${d}" stroke-width="3.8"/></svg>`);
}

const DENSE_A = denseTile(293, 86, 11);
const DENSE_B = denseTile(367, 118, 29);
const GRID_TILE = gridTile(7);
/** The still dot texture (a mask) of the night panels on the static (reduced-motion) page. */
export const STATIC_DOTS = `${denseTile(293, 44, 11, 0.4)}, ${denseTile(367, 64, 29, 0.4)}`;
/**
 * Round 6: the jobs are flowers, so the stand-in grows in the grass, never in the sky. The ground is
 * a gradient mask layered over the dot tiles and intersected with them (on top, so its composite
 * op is the first in each list).
 */
const GROUND = "linear-gradient(to bottom, transparent 44%, black 54%)";
const ground = (tiles: string, n: number, position = "0 0") => ({
  maskImage: `${GROUND}, ${tiles}`,
  WebkitMaskImage: `${GROUND}, ${tiles}`,
  maskComposite: ["intersect", ...Array(n - 1).fill("add")].join(", "),
  WebkitMaskComposite: ["source-in", ...Array(n - 1).fill("source-over")].join(", "),
  maskRepeat: ["no-repeat", ...Array(n).fill("repeat")].join(", "),
  WebkitMaskRepeat: ["no-repeat", ...Array(n).fill("repeat")].join(", "),
  maskSize: ["100% 100%", ...Array(n).fill("auto")].join(", "),
  WebkitMaskSize: ["100% 100%", ...Array(n).fill("auto")].join(", "),
  maskPosition: ["0 0", ...Array(n).fill(position)].join(", "),
  WebkitMaskPosition: ["0 0", ...Array(n).fill(position)].join(", "),
});
const dense = ground(`${DENSE_A}, ${DENSE_B}`, 2);
const grid = ground(GRID_TILE, 1, "50% 50%");

/** The twelve, in the grass (x %, y %): the round-5 places, folded down onto the ground. */
const GOLD: [number, number][] = (
  [
    [13, 27], [31, 21], [52, 30], [71, 24], [88, 33], [22, 46],
    [44, 52], [63, 44], [82, 55], [17, 70], [38, 76], [58, 68],
  ] as [number, number][]
).map(([x, y]) => [x, Math.round(52 + y * 0.5)]);

export function CssField() {
  return (
    <>
      <div aria-hidden="true" className="cf cf-dust only-motion" style={dense} />
      <div aria-hidden="true" className="cf cf-dense only-motion" style={dense} />
      <div aria-hidden="true" className="cf cf-grid-dim only-motion" style={grid} />
      <div aria-hidden="true" className="cf cf-grid only-motion" style={grid} />
      <svg aria-hidden="true" className="cf cf-gold only-motion" width="100%" height="100%">
        {GOLD.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={`${x}%`} cy={`${y}%`} r="3.4" style={{ fill: "var(--c-match)" }} />
        ))}
      </svg>
    </>
  );
}
