// Night Desk art: source of truth for the 14 one-line drawings.
// Run: node components/art/src/build.mjs   (rewrites components/art/registry.ts)
// Rules (brand/night-desk/art-list.md): one M, no Z, absolute L/C only, <= 1 decimal,
// clean geometry (the wobble is a render-time filter), scenes enter and exit on a baseline.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => String(r1(n));

/** Hand-drawn ring: a slightly oval spiral that overlaps its start and ends inside it. */
function ring({ cx, cy, rx, ry, tilt = 0, start, sweep, shrink = 0.14, step = 30, flat = 0 }) {
  // start: clock-face degrees (0 = 12 o'clock, clockwise). Travel is anticlockwise.
  const pts = [];
  const n = Math.ceil(sweep / step);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ((start - sweep * t - 90) * Math.PI) / 180;
    // pen pressure eases in: the last 30% of the lap pulls inward
    const k = 1 - shrink * Math.max(0, (t - 0.7) / 0.3) ** 1.4 + flat * Math.sin(a * 2 + 1);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    const c = Math.cos((tilt * Math.PI) / 180), s = Math.sin((tilt * Math.PI) / 180);
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  // Catmull-Rom through the samples -> cubic segments
  let d = `M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${fmt(c1[0])},${fmt(c1[1])} ${fmt(c2[0])},${fmt(c2[1])} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d;
}

/** Circle as four cubics (fills only). */
function disc(cx, cy, r) {
  const k = r * 0.5523;
  const f = fmt;
  return `M${f(cx - r)},${f(cy)} C${f(cx - r)},${f(cy - k)} ${f(cx - k)},${f(cy - r)} ${f(cx)},${f(cy - r)} C${f(cx + k)},${f(cy - r)} ${f(cx + r)},${f(cy - k)} ${f(cx + r)},${f(cy)} C${f(cx + r)},${f(cy + k)} ${f(cx + k)},${f(cy + r)} ${f(cx)},${f(cy + r)} C${f(cx - k)},${f(cy + r)} ${f(cx - r)},${f(cy + k)} ${f(cx - r)},${f(cy)} Z`;
}

/** Rounded rect (fills only), radii clockwise from top-left. */
function rrect(x, y, w, h, [a, b, c, e]) {
  const f = fmt, K = 0.4477;
  return [
    `M${f(x + a)},${f(y)}`, `L${f(x + w - b)},${f(y)}`,
    `C${f(x + w - b * K)},${f(y)} ${f(x + w)},${f(y + b * K)} ${f(x + w)},${f(y + b)}`,
    `L${f(x + w)},${f(y + h - c)}`,
    `C${f(x + w)},${f(y + h - c * K)} ${f(x + w - c * K)},${f(y + h)} ${f(x + w - c)},${f(y + h)}`,
    `L${f(x + e)},${f(y + h)}`,
    `C${f(x + e * K)},${f(y + h)} ${f(x)},${f(y + h - e * K)} ${f(x)},${f(y + h - e)}`,
    `L${f(x)},${f(y + a)}`,
    `C${f(x)},${f(y + a * K)} ${f(x + a * K)},${f(y)} ${f(x + a)},${f(y)} Z`,
  ].join(" ");
}

const clean = (d) => d.replace(/\s+/g, " ").replace(/\s*([MLCZ])\s*/g, " $1").trim();

// ───────────────────────────── the drawings ─────────────────────────────
const ART = {};

// DESK. Hero. Pen route, left to right: baseline, mug (loop at the rim corner, D handle),
// baseline, laptop (wedge up to the hinge, hinge line, screen anticlockwise, back under as the base slab),
// baseline, lamp (half dome, lower arm, joint loop, upper arm, shade, retrace both arms, half dome), out.
ART.desk = {
  w: 620, h: 380, baseY: 340, weight: "stroke",
  d: `M0,340 L40,340
      L42.6,272 C43,262.5 35.6,260 35.2,265 C34.9,269.2 41,268.9 47,267.4 L87.5,265.2
      L85.6,316 C96.6,318.6 104.4,310 104,298 C103.6,286.4 96.6,280 86.6,283.4 C83,284.8 81.2,287.6 81.2,291.6 L80.4,340
      L150,340
      L163.5,330.4 L372,327.4
      L369.4,196 C369.1,184.5 363.2,178.7 352,178.8 L183.5,181.4 C172.2,181.6 166.3,187.4 166.6,198.8
      L169.4,330.2 L173,336.6 L386,334.4 L396.5,340
      L436,340
      C437,325.2 449.8,315.2 468,314.6
      L528.4,196.6 C530.4,190 535.6,185.6 539,189.6 C542,193.4 537.4,199 532.6,197 C529,195.4 527,191.4 524,187
      L444.5,80.5
      L420,152 C386,143.4 364.6,122 356,88 L427.5,63.5 C432,57 446.5,60.5 450.7,75.4
      L529.4,180.4 C541,184.6 545,193.6 536.4,201.2
      L476.6,317.2 C496.4,316.6 514.6,325.2 516.4,340
      L620,340`,
  fills: [
    // light cone: lips to baseline, mug's right edge to lamp base. Deliberately looser than the shade.
    { id: "cone", d: "M351,97 L96,340 L428,340 L414,161 Z" },
    // bulb at the shade mouth: a light source, solid on night too
    { id: "bulb", d: disc(387, 121, 14), opacity: 1 },
    // lit screen, 196 x 150, a little smaller than the drawn screen
    { id: "screen", d: rrect(170, 183, 196, 150, [12, 9, 3, 4]), k: 0.75 },
  ],
  shadeLip: [[356, 88], [420, 152]],
  screen: [170, 183, 196, 145],
  order: [
    "baseline in (0 to 40)",
    "mug: up the left side, loop at the rim corner, rim, down to the handle, D handle, down to the baseline",
    "baseline (84 to 150)",
    "laptop: wedge up to the hinge, hinge line left to right, up the right side, top right to left, down the left side, back under the hinge as the base slab",
    "baseline (396 to 436)",
    "lamp: left half of the dome, lower arm up, joint loop, upper arm to the shade neck, lower shade edge to lip 2, mouth to lip 1, upper edge back to the neck, retrace both arms 8px to the right, right half of the dome",
    "baseline out (516 to 620)",
  ],
};

// LAMP. Act III. Hangs from the top-right corner; same shade, mouth and joint loop as the desk lamp.
ART.lamp = {
  w: 300, h: 340, weight: "stroke",
  entry: [300, 0], exit: [300, 24],
  d: `M300,0 L193,43
      C186,46 180,43 182,38 C184,33.5 191,36.5 190,43 C189.4,47.4 186.6,53 184.4,59
      L152.6,142.2 C149,140 144,139.5 141.5,141.5
      L70,166 C78.6,200 100,221.4 134,230 L158.5,158.5 C162,155 163,149.5 160.2,145
      L191.8,62.6 C193.4,58 197,54.4 203,52
      L300,24`,
  fills: [{ id: "bulb", d: disc(101, 199, 12), opacity: 1 }],
  shadeLip: [[70, 166], [134, 230]],
  order: [
    "in at the top-right corner, bracket arm down and left",
    "joint loop at the elbow",
    "second arm down to the shade neck",
    "upper shade edge to lip 1, mouth round to lip 2, lower edge back to the neck",
    "retrace up the arm 8px below the first pass; the two lines open to 24px at the wall, which is the clamp",
  ],
};

// MUG. Act III. Short and straight-sided (chai).
ART.mug = {
  w: 96, h: 110, baseY: 104, weight: "stroke",
  d: `M0,104 L11.5,104
      L14.2,39 C14.6,29.8 7.2,27.4 6.8,32.4 C6.5,36.6 12.6,36.4 18.6,34.8 L74.4,32.6
      L72.8,84 C84,86.8 92.4,78.6 92,66.4 C91.6,54.6 84.6,48 74.2,51.4 C70.4,52.8 68.6,55.6 68.6,59.6
      L67.8,104 L96,104`,
  fills: [{ id: "steam", d: "M33,29 C27,23 33,17.4 39,14.6 C45,11.6 43,4.6 49,0.6 C57,5.6 59.4,16 53.4,23 C48.4,28.8 39,32.4 33,29 Z" }],
  order: ["baseline in", "up the left side", "loop at the rim corner", "rim", "down to the handle, D handle out and back", "down to the baseline, out"],
};

// CHAIR. Act IV. Seen almost front-on from slightly above: "your seat".
ART.chair = {
  w: 300, h: 360, baseY: 340, weight: "stroke",
  d: `M0,340 L42,340
      L39.6,246
      L248,251
      L222.4,208
      L226.4,62 C226.8,45.6 218,37 203,35.4 C170,32 132,33.4 98,38.6
      C86,38.9 68,40.6 67.6,33.4 C67.3,27.8 76.6,27.6 76.2,35 C76,39 75.2,44 74.8,50
      L72,205
      L44.6,246.6 L46.6,253.6
      L79.6,255.4 L82,309 L87.6,256
      L209.6,259.4 L213,312 L218.6,260
      L245.4,261.2
      L247.6,340 L300,340`,
  fills: [
    { id: "back", d: rrect(88, 52, 130, 140, [26, 20, 8, 10]) },
    { id: "pad", d: "M70,214 L214,216 L232,243 L54,239 Z" },
  ],
  order: [
    "baseline in, front-left leg up",
    "across the seat front",
    "up the right edge of the seat to the back",
    "up the right post, over the rounded top, loop at the top-left corner",
    "down the left post to the seat, forward along the seat's left edge",
    "under the seat front: far-left leg down and up, far-right leg down and up",
    "front-right leg down, baseline out",
  ],
};

// LAPTOP-CLOSED. Footer. Side profile, hinge on the left, lid edge proud at the front.
ART["laptop-closed"] = {
  w: 160, h: 60, baseY: 52, weight: "stroke",
  d: `M0,52 L18,52
      C13.6,49.6 14.6,41 22,40.4
      L140.6,44.6 L142.2,48.6
      L31,47
      C25,47.2 24.4,51.8 31,52
      L160,52`,
  fills: [],
  order: ["baseline in", "round the hinge", "lid top to the front edge", "front lip", "back along the seam under the lid", "turn at the hinge and out along the base, which is the baseline"],
};

// SCORE-RING. Circling a number in pen.
ART["score-ring"] = {
  w: 72, h: 72, weight: "fine",
  d: ring({ cx: 36, cy: 36.5, rx: 30, ry: 26.5, tilt: -12, start: 32, sweep: 386, shrink: 0.2 }),
  fills: [],
  order: ["start near 1 o'clock, anticlockwise all the way round, overlap the start by about 26 degrees, end inside it"],
};

// SEAT RINGS. Three hands so the 5 x 5 grid is not 25 clones.
ART["seat-ring-a"] = {
  w: 28, h: 28, weight: "fine",
  d: ring({ cx: 14, cy: 14, rx: 11.2, ry: 10.4, tilt: -8, start: 20, sweep: 384, shrink: 0.2 }),
  fills: [{ id: "taken", d: disc(10.6, 11.2, 9), opacity: 1 }],
  order: ["from 1 o'clock, anticlockwise, 24 degree overlap"],
};
ART["seat-ring-b"] = {
  w: 28, h: 28, weight: "fine",
  d: ring({ cx: 14, cy: 14.2, rx: 10.2, ry: 11.4, tilt: 14, start: 200, sweep: 400, shrink: 0.24 }),
  fills: [{ id: "taken", d: disc(11.4, 11, 9), opacity: 1 }],
  order: ["from 7 o'clock, anticlockwise, taller than wide, 40 degree overlap"],
};
ART["seat-ring-c"] = {
  w: 28, h: 28, weight: "fine",
  d: ring({ cx: 14.2, cy: 14, rx: 11.6, ry: 9.8, tilt: 6, start: 300, sweep: 372, shrink: 0.16, flat: 0.03 }),
  fills: [{ id: "taken", d: disc(10.8, 11.6, 9), opacity: 1 }],
  order: ["from 10 o'clock, anticlockwise, wider than tall, barely closes"],
};

// TICK. The up-stroke overshoots by 3px.
ART.tick = {
  w: 22, h: 18, weight: "fine",
  d: "M2.6,8.8 L8,15.4 C11.4,10 15.6,5.4 20.2,1.6",
  fills: [],
  order: ["short down-stroke, long up-stroke"],
};

// CALENDAR. Page outline, header bar, and the stroke ends as a tick.
ART.calendar = {
  w: 72, h: 72, weight: "fine",
  d: `M64.8,27 L65,58
      C65.2,63.6 66.8,65.8 68.6,64.6 C70.2,63.4 69.2,60.6 66.8,60.8 C63.6,61.2 62,66 56,66.2
      L17,66.8 C12,66.9 9.2,64.6 9,60 L8.8,22 C8.8,16.6 12,14 17,14.2 L21,14
      C21,8.4 28,8.4 28,14 L44,13.6 C44,8 51,8 51,13.6 L57.6,13.4
      C62.4,13.4 64.6,16 64.6,21 L64.8,27
      L12.4,29.2 C9.6,29.6 9.8,33.4 13,33.4 L27,33
      C35,32.8 32.6,45.4 40,52.6
      C45,45.4 52,39 61.6,34.4`,
  fills: [{ id: "day", d: "M36,38 L52,37.4 L52.6,51.4 L36.6,52 Z", opacity: 1 }],
  order: [
    "start on the right edge at header height, down the right edge, loop at the bottom-right corner",
    "bottom edge, up the left edge, round the top-left corner",
    "top edge with two binder bumps, round the top-right corner, back down to the start",
    "header bar across to the left, a tight turn, and back to the right 4px lower (the bar's thickness)",
    "the return dives into the page as the tick's down-stroke, then the long up-stroke; the stroke ends there",
  ],
};

// STAMP. Two laps from one stroke, the second 4px inside the first.
ART.stamp = {
  w: 132, h: 64, weight: "fine",
  d: `M18,4.6 L116,4 C124,4 128,8 128,15 L128.4,49 C128.4,56 124,60 117,60
      L15,60.6 C8,60.6 4,56.6 4,50 L4.4,16 C4.4,10.6 8,8.4 14,8.4
      L114,8 C121,8 124.2,11 124.2,17 L124.6,48 C124.6,53.6 121,56 115,56
      L17,56.6 C11,56.6 8.2,53.6 8.2,48 L8.6,19 C8.6,14.4 11.4,12.2 17,12.4 L27,12.2`,
  fills: [{ id: "ink", d: rrect(11.5, 11.5, 109, 41, [6, 8, 6, 7]), opacity: 1 }],
  order: ["start on the top edge, clockwise round the outer lap", "slip 4px inside at the top-left corner", "second lap, ending just past its own start"],
};

// ARROW. Points right and down; the renderer mirrors and rotates.
ART.arrow = {
  w: 48, h: 34, weight: "fine",
  d: "M3,6.4 C17,2.4 33,8.6 42.4,27 L31.6,23.6 L42.8,27.6 L43.4,15.4",
  fills: [],
  order: ["shallow curve to the tip", "out along the lower barb", "back to the tip", "out along the upper barb"],
};

// FRAME. Portrait holder; the stroke overlaps itself by about 14px at the starting corner.
ART.frame = {
  w: 104, h: 104, weight: "fine",
  d: `M13,5.4 L86,4 C95,4 100,9 100,17 L100.6,88 C100.6,96 96,100 89,100
      L16,100.6 C8,100.6 3.6,96 3.6,89 L4,17 C4,8 8.6,3.2 17,3.6 L27.4,5.8`,
  fills: [{ id: "empty", d: rrect(6.5, 6.5, 92, 92, [10, 14, 9, 12]), opacity: 1 }],
  order: ["start on the top edge near the top-left corner, clockwise", "four corners with unequal radii", "overlap the start by 14px"],
};

// ───────────────────────────── measure and check ─────────────────────────────
function parse(d) {
  const out = [];
  const re = /([MLC])([^MLCZ]*)/g;
  let m;
  while ((m = re.exec(d))) out.push([m[1], m[2].trim().split(/[\s,]+/).map(Number)]);
  return out;
}
function measure(d) {
  let len = 0, x = 0, y = 0;
  const first = [], last = [];
  for (const [c, n] of parse(d)) {
    if (c === "M") { x = n[0]; y = n[1]; first.push(x, y); }
    else if (c === "L") { len += Math.hypot(n[0] - x, n[1] - y); x = n[0]; y = n[1]; }
    else {
      let px = x, py = y;
      for (let i = 1; i <= 64; i++) {
        const t = i / 64, u = 1 - t;
        const bx = u * u * u * x + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t * t * t * n[4];
        const by = u * u * u * y + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t * t * t * n[5];
        len += Math.hypot(bx - px, by - py); px = bx; py = by;
      }
      x = n[4]; y = n[5];
    }
    last[0] = x; last[1] = y;
  }
  return { len, first, last };
}

const SCENES = ["desk", "lamp", "mug", "chair", "laptop-closed"];
const errors = [];
const outArt = {};
for (const [id, a] of Object.entries(ART)) {
  const d = clean(a.d);
  if ((d.match(/M/g) || []).length !== 1) errors.push(`${id}: needs exactly one M`);
  if (/[ZzAa]|[a-z]/.test(d)) errors.push(`${id}: only absolute M, L, C allowed`);
  if (/\d\.\d\d/.test(d)) errors.push(`${id}: more than 1 decimal`);
  const { len, first, last } = measure(d);
  const entry = a.entry ?? first, exit = a.exit ?? last;
  if (first[0] !== entry[0] || first[1] !== entry[1] || last[0] !== exit[0] || last[1] !== exit[1]) errors.push(`${id}: entry/exit do not match the path ends`);
  if (SCENES.includes(id) && id !== "lamp") {
    if (entry[0] !== 0 || exit[0] !== a.w || entry[1] !== a.baseY || exit[1] !== a.baseY) errors.push(`${id}: must enter (0, baseY) and exit (w, baseY)`);
  }
  if (len > 6 * (a.w + a.h)) errors.push(`${id}: path length ${len.toFixed(0)} over 6 x (w + h)`);
  if ((a.fills?.length ?? 0) > 3) errors.push(`${id}: more than 3 fills`);
  outArt[id] = {
    id, w: a.w, h: a.h, ...(a.baseY != null ? { baseY: a.baseY } : {}),
    d, length: Math.round(len * 10) / 10, entry, exit,
    fills: (a.fills ?? []).map((f) => ({ id: f.id, d: clean(f.d), ...(f.opacity != null ? { opacity: f.opacity } : {}), ...(f.k != null ? { k: f.k } : {}) })),
    weight: a.weight,
    ...(a.shadeLip ? { shadeLip: a.shadeLip } : {}),
    ...(a.screen ? { screen: a.screen } : {}),
    order: a.order,
  };
}
if (outArt.desk.length > 3400) errors.push(`desk: ${outArt.desk.length} over 3400`);
// calendar: report what share of the path the closing tick takes
{
  const d = outArt.calendar.d;
  const cut = d.lastIndexOf("C", d.lastIndexOf("C") - 1); // the down-stroke of the tick
  const head = measure(d.slice(0, cut)).len;
  outArt.calendar.tickFrom = Math.round((head / outArt.calendar.length) * 1000) / 1000;
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const header = `// GENERATED by components/art/src/build.mjs. Edit the source there, then re-run it.
// Night Desk drawings as data. No React. Shape follows brand/night-desk/scroll-adaptation.md 2.1.
// lib/art.ts can be a one-line re-export of this file.

export type ArtId =
  | "desk" | "lamp" | "mug" | "chair" | "laptop-closed" | "calendar"
  | "score-ring" | "seat-ring-a" | "seat-ring-b" | "seat-ring-c" | "tick" | "stamp" | "arrow" | "frame";

export type ArtFill = {
  /** stable suffix for the element id */
  id: string;
  d: string;
  /** set for light sources (bulb, calendar day, stamp): stays this opaque on night too */
  opacity?: number;
  /** multiplier on --art-fill-opacity (the lit screen is a little dimmer than the cone) */
  k?: number;
};

export type Art = {
  id: ArtId;
  /** natural size, CSS px */
  w: number;
  h: number;
  /** scenes only: the y the Line runs along */
  baseY?: number;
  /** ONE path, one M, absolute L and C only */
  d: string;
  /** path length in px (matches getTotalLength() to within 0.5) */
  length: number;
  /** first and last point; insert mode joins the Line here */
  entry: [number, number];
  exit: [number, number];
  fills: ArtFill[];
  weight: "stroke" | "fine";
  /** desk, lamp: the two lip points of the shade, upper lip first. The World places the cone from these. */
  shadeLip?: [[number, number], [number, number]];
  /** desk: x, y, w, h of the clear area inside the laptop screen, for interior UI */
  screen?: [number, number, number, number];
  /** calendar: fraction of the length where the closing tick begins */
  tickFrom?: number;
  /** pen route in reading order */
  order: string[];
};

`;
const body = `export const ART: Record<ArtId, Art> = ${JSON.stringify(outArt, null, 2)};\n\nexport const ART_IDS = Object.keys(ART) as ArtId[];\n`;
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "..", "registry.ts"), header + body);
for (const a of Object.values(outArt)) console.log(a.id.padEnd(14), String(a.length).padStart(7), "px", `(budget ${6 * (a.w + a.h)})`, a.tickFrom ? `tick from ${a.tickFrom}` : "");
