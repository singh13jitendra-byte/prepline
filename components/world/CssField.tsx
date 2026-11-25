/**
 * CSS FIELD — the field before the world arrives, and for good where it never
 * does (no WebGL, a small low-core device, Save-Data). Storyboard 5.6.
 *
 * Fixed layers of pre-rendered dots, each one inline SVG pattern (about 2KB
 * for the dense one, well under 1KB for the grid), server-rendered so they are
 * on the first frame:
 *   dense   the unread noise (bright), with a dim copy under it as dust
 *   grid    the kept: a sparse, strict 48px lattice (bright), and a dim copy
 *   gold    the twelve
 * They are clipped against --line-y by rules on html[data-beat] (index.tsx),
 * so the passes still read as dense noise turning into sparse order, and
 * against --day-top during a wipe. When the world draws its first frame they
 * fade out under it (html.world-on).
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
function denseTile(size: number, count: number, seed: number) {
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="none" stroke="#fff6e3" stroke-linecap="round">` +
      `<path d="${groups[0]}" stroke-width="1.6" opacity=".4"/><path d="${groups[1]}" stroke-width="2.6" opacity=".62"/><path d="${groups[2]}" stroke-width="3.8" opacity=".85"/></svg>`,
  );
}

function gridTile(seed: number) {
  const rand = rng(seed);
  let d = "";
  for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) if (rand() < 0.46) d += `M${24 + i * 48} ${24 + j * 48}h0`;
  return esc(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" fill="none" stroke="#fff6e3" stroke-linecap="round"><path d="${d}" stroke-width="3.8"/></svg>`);
}

export const DENSE_A = denseTile(293, 86, 11);
export const DENSE_B = denseTile(367, 118, 29);
export const GRID_TILE = gridTile(7);
const dense = { backgroundImage: `${DENSE_A}, ${DENSE_B}` };
const grid = { backgroundImage: GRID_TILE, backgroundPosition: "50% 50%" };

const GOLD: [number, number][] = [
  [13, 27], [31, 21], [52, 30], [71, 24], [88, 33], [22, 46],
  [44, 52], [63, 44], [82, 55], [17, 70], [38, 76], [58, 68],
];

export function CssField() {
  return (
    <>
      <div aria-hidden="true" className="cf cf-dust only-motion" style={dense} />
      <div aria-hidden="true" className="cf cf-dense only-motion" style={dense} />
      <div aria-hidden="true" className="cf cf-grid-dim only-motion" style={grid} />
      <div aria-hidden="true" className="cf cf-grid only-motion" style={grid} />
      <svg aria-hidden="true" className="cf cf-gold only-motion" width="100%" height="100%">
        {GOLD.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={`${x}%`} cy={`${y}%`} r="3.4" fill="#ffd77a" />
        ))}
      </svg>
    </>
  );
}
