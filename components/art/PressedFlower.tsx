import type { CSSProperties } from "react";
import { FLOWER_TYPES, type FlowerType } from "@/components/world/fieldFlowers";
import "./pressed.css";

/**
 * PRESSED FLOWER — the role's flower, dried flat between two pages and taped into a corner of a
 * paper object (the board tile, the beta ticket). Same mapping as the meadow (fieldFlowers.ts,
 * `flowerOf(title)`): moonflower = Product, bellflower = UX, poppy = UI / Visual / Interaction,
 * allium = Design Systems, lavender = UX Research.
 *
 * Drawn on a 40 x 56 sheet: the head near the top, the stem running down and off a little to one
 * side, a strip of lamp washi tape across the stem. Pressed means flat: no shading, no depth, petals
 * splayed into one plane, colours a step faded toward the paper and a step aged toward moss, the
 * whole thing a touch translucent (pressed.css). Depth is print in this theme, so the only lift is
 * the tape. Colours are the --art-flower-* tokens, mixed in CSS; no ids, so it can mount any
 * number of times.
 *
 * Static and decorative: aria-hidden, nothing animates, nothing for reduced motion to stop.
 */

const W = 40;
const H = 56;

const f = (n: number) => +n.toFixed(2);

/** A closed disc with `n` shallow lobes (a moonflower pressed face-on), as one path. */
function lobed(cx: number, cy: number, r: number, n: number, dip: number, sy = 1) {
  const pts: string[] = [];
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * step;
    const a1 = a0 + step / 2;
    const a2 = a0 + step;
    const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r * sy];
    const c = [cx + Math.cos(a1) * r * (1 + dip * 0.9), cy + Math.sin(a1) * r * (1 + dip * 0.9) * sy];
    const m = [cx + Math.cos(a2) * r, cy + Math.sin(a2) * r * sy];
    if (i === 0) pts.push(`M${f(p0[0])} ${f(p0[1])}`);
    pts.push(`Q${f(c[0])} ${f(c[1])} ${f(m[0])} ${f(m[1])}`);
  }
  return pts.join("") + "Z";
}

/** A bell pressed flat and turned by `rot` degrees: hangs from (x, y), mouth at y + h. */
function bellPath(w: number, h: number) {
  const fw = w * 0.62;
  return `M0 0C${f(-w * 0.5)} ${f(h * 0.14)} ${f(-w * 0.46)} ${f(h * 0.7)} ${f(-fw)} ${f(h)}Q${f(-fw * 0.5)} ${f(h * 0.86)} 0 ${f(h * 1.02)}Q${f(fw * 0.5)} ${f(h * 0.86)} ${f(fw)} ${f(h)}C${f(w * 0.46)} ${f(h * 0.7)} ${f(w * 0.5)} ${f(h * 0.14)} 0 0Z`;
}

/** A six-point floret (allium), centred on its origin. */
function floret(r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const k = i % 2 ? r * 0.42 : r;
    pts.push(`${f(Math.cos(a) * k)} ${f(Math.sin(a) * k)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** The washi strip: a flat band with torn (zigzag) short ends, centred on its origin. */
const TAPE = "M-9 -3.1L9 -3.1L8.2 -2L9.1 -0.9L8.3 0.2L9.2 1.3L8.4 2.3L9 3.1L-9 3.1L-8.3 2.1L-9.2 1L-8.4 -0.1L-9.1 -1.1L-8.2 -2.1Z";

function Leaf({ d }: { d: string }) {
  return (
    <>
      <path className="pfl-leaf" d={d} />
    </>
  );
}

function Moon() {
  const cx = 19;
  const cy = 17;
  const r = 12.5;
  return (
    <>
      <path className="pfl-stem" d="M19.5 29C19 37 21.5 45 23.5 54" />
      <Leaf d="M20.6 41C16.5 38.2 12.2 38.6 9.6 36.4C12.6 35.4 17.6 36.4 20.8 39.6Z" />
      {/* the calyx, flattened under the disc */}
      <path className="pfl-leaf" d="M15.6 27.6L19.4 31.6L23.4 27.4Z" />
      <path className="pfl-petal" d={lobed(cx, cy, r, 5, 0.16, 0.94)} />
      <path
        className="pfl-vein"
        d={Array.from({ length: 5 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5 + Math.PI / 5;
          return `M${cx} ${cy}L${f(cx + Math.cos(a) * r * 0.95)} ${f(cy + Math.sin(a) * r * 0.9)}`;
        }).join("")}
      />
      <path className="pfl-crease" d={lobed(cx, cy, r * 0.56, 5, 0.1, 0.94)} />
      <circle className="pfl-core" cx={cx} cy={cy} r="2.6" />
    </>
  );
}

function Bell() {
  return (
    <>
      <path className="pfl-stem" d="M15 54C13.5 40 15 23 23 11C25 8 27.5 6.5 30 6" />
      <path className="pfl-stem pfl-thin" d="M17.4 26C15 26.5 12.8 27.6 11.4 29.2" />
      <Leaf d="M14.6 44C10.4 42 7.4 42.8 5.4 40.4C8.6 39.6 12.8 40.6 14.8 42.6Z" />
      <g transform="translate(29.6 6.4) rotate(-14)">
        <path className="pfl-petal" d={bellPath(11, 15)} />
        <path className="pfl-vein" d="M0 2.4L-3.6 14.2M0 2.4L0 15.2M0 2.4L3.6 14.2" />
      </g>
      <g transform="translate(11.4 29) rotate(18)">
        <path className="pfl-petal" d={bellPath(8, 11)} />
        <path className="pfl-vein" d="M0 2L-2.6 10.4M0 2L2.6 10.4" />
      </g>
      <path className="pfl-leaf" d="M27.6 6.6L30 4.2L32.2 6.8Z" />
    </>
  );
}

function Poppy() {
  const cx = 20;
  const cy = 17;
  return (
    <>
      <path className="pfl-stem" d="M20 26C21.5 33 18.6 40 20.4 47C21 50 22.4 52.4 23.6 54.6" />
      <Leaf d="M20.2 40.6C16.4 39.6 15 36.4 11.6 36.4C12.6 34.6 14.6 35.8 15.4 34.2C17 36.2 18.8 37 20.6 38.8Z" />
      {/* four papery petals splayed flat, overlapping */}
      <path className="pfl-petal" d={`M${cx} ${cy}m-1 -1c-2-6.5-10-8.5-12.6-3.2c-2.4 4.8 2.2 9.6 12.6 4.2Z`} />
      <path className="pfl-petal" d={`M${cx} ${cy}m1 -1c2-6.5 10-8.5 12.6-3.2c2.4 4.8-2.2 9.6-12.6 4.2Z`} />
      <path className="pfl-petal" d={`M${cx} ${cy}m-0.6 0.8c-6.4 1.4-9.4 8.2-5 10.6c4 2.2 7.4-2.2 5-10.6Z`} />
      <path className="pfl-petal" d={`M${cx} ${cy}m0.6 0.8c6.4 1.4 9.4 8.2 5 10.6c-4 2.2-7.4-2.2-5-10.6Z`} />
      <path className="pfl-crease" d={`M${cx - 2} ${cy - 2}l-6.4-4.6M${cx + 2} ${cy - 2}l6.4-4.6M${cx - 1.4} ${cy + 1.6}l-3.2 6.6M${cx + 1.4} ${cy + 1.6}l3.2 6.6`} />
      <circle className="pfl-heart" cx={cx} cy={cy} r="3.1" />
      <path className="pfl-stamen" d={`M${cx} ${cy}m-4.4 0h8.8M${cx} ${cy}m0 -4.2v8.4M${cx} ${cy}m-3.2 -3.2l6.4 6.4M${cx} ${cy}m3.2 -3.2l-6.4 6.4`} />
    </>
  );
}

const ALLIUM_FLORETS: readonly [number, number, number, number][] = [
  [20, 6.6, 2.4, 10],
  [14.4, 8.6, 2.3, 30],
  [25.6, 8.6, 2.3, 5],
  [11.2, 13.6, 2.2, 20],
  [17.4, 11.6, 2.5, 0],
  [23, 11.8, 2.4, 25],
  [28.8, 13.8, 2.2, 15],
  [14.4, 16.4, 2.4, 35],
  [20.2, 16.6, 2.6, 12],
  [26, 17, 2.3, 40],
  [11.8, 19.6, 2.1, 5],
  [17.4, 21.4, 2.3, 22],
  [23.2, 21.6, 2.3, 8],
  [28.2, 20, 2, 30],
  [20.2, 25.4, 2.1, 18],
];

function Allium() {
  const d = floret(1);
  return (
    <>
      <path className="pfl-stem" d="M20.2 26C20.6 34 19.4 44 21.6 54.6" />
      <Leaf d="M21.4 54C17 50 14.6 44.6 13.4 40.2C16.4 43.6 19.4 47.6 21.6 51Z" />
      <circle className="pfl-ball" cx="20" cy="16" r="11.4" />
      {ALLIUM_FLORETS.map(([x, y, r, a], i) => (
        <path key={i} className="pfl-petal pfl-floret" d={d} transform={`translate(${x} ${y}) rotate(${a}) scale(${r})`} />
      ))}
    </>
  );
}

const LAVENDER_FLORETS: readonly [number, number, number][] = [
  [5.4, 1.5, -1],
  [8.4, 1.7, 1],
  [11.6, 1.9, -1],
  [14.6, 2.1, 1],
  [17.8, 2.2, -1],
  [20.8, 2.4, 1],
  [24, 2.4, -1],
  [27, 2.5, 1],
  [30.2, 2.4, -1],
];

function Lavender() {
  return (
    <>
      <path className="pfl-stem" d="M20.6 4C20 18 19.2 34 18.6 44C18.4 48 18.8 52 19.6 55" />
      <Leaf d="M18.8 50C14.4 47 11.6 42.4 10.8 38.6C13.6 41.6 16.6 45.4 18.8 47.6Z" />
      <Leaf d="M19 46.4C22.8 43.6 25 39.4 25.4 35.8C23 38.6 20.6 42 18.9 44.4Z" />
      {LAVENDER_FLORETS.map(([y, r, s], i) => {
        const x = 20.6 - (y - 4) * 0.035;
        return (
          <g key={i}>
            <ellipse className="pfl-petal" cx={f(x + s * r * 0.7)} cy={y} rx={f(r * 0.9)} ry={f(r * 1.2)} transform={`rotate(${s * 28} ${f(x + s * r * 0.7)} ${y})`} />
            <ellipse className="pfl-petal" cx={f(x - s * r * 0.55)} cy={y + 1.2} rx={f(r * 0.75)} ry={f(r)} transform={`rotate(${-s * 24} ${f(x - s * r * 0.55)} ${y + 1.2})`} />
          </g>
        );
      })}
    </>
  );
}

const DRAW: Record<FlowerType, () => React.JSX.Element> = { moon: Moon, bell: Bell, poppy: Poppy, allium: Allium, lavender: Lavender };
/** Where the tape crosses the stem, per drawing (x, y, turn in degrees). */
const TAPE_AT: Record<FlowerType, [number, number, number]> = {
  moon: [22, 46, -16],
  bell: [14.4, 46, 12],
  poppy: [21, 46.6, -10],
  allium: [20.6, 44, 14],
  lavender: [19, 41, -12],
};

export type PressedFlowerProps = {
  /** The flower, by index (what `flowerOf(title)` returns) or by name. */
  type: number | FlowerType;
  /** Height in px; the width follows (40 : 56). */
  size?: number;
  /** A small turn, in degrees, so it reads as placed by hand. */
  tilt?: number;
  className?: string;
  style?: CSSProperties;
};

export function PressedFlower({ type, size = 56, tilt = 0, className, style }: PressedFlowerProps) {
  const name: FlowerType = typeof type === "number" ? (FLOWER_TYPES[type] ?? "moon") : type;
  const Drawing = DRAW[name];
  const [tx, ty, tr] = TAPE_AT[name];
  return (
    <svg
      className={className ? `pfl ${className}` : "pfl"}
      data-flower={name}
      width={f((size * W) / H)}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      focusable="false"
      style={tilt ? { ...style, transform: `rotate(${tilt}deg)` } : style}
    >
      <g className="pfl-dried">
        <Drawing />
      </g>
      <path className="pfl-tape" d={TAPE} transform={`translate(${tx} ${ty}) rotate(${tr})`} />
    </svg>
  );
}
