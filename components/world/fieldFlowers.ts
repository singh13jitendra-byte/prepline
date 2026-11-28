/**
 * THE FLOWERS — what a job looks like in the meadow (round 6, with Lumi).
 *
 * Flower type = role type, so shape (not colour) tells roles apart:
 *
 *   0 moonflower  Product Designer       a wide disc that opens at night
 *   1 bellflower  UX Designer            hanging bells
 *   2 poppy       UI / Visual Designer   an open cup
 *   3 allium      Design Systems         small florets making one ball
 *   4 lavender    UX Research            a tall spike
 *
 * One small atlas, painted once on a 2D canvas from the theme's flower tokens (WORLD_COLORS
 * flower*): 5 rows (types) x 4 columns (stages). Stage 0 is a closed bud, 1 half open, 2 full bloom,
 * all on a stem whose base is the cell's bottom centre; stage 3 is the head alone, centred: the
 * blossom that lifts off and flies to its row. The field shader (fieldScene.ts) picks a row by
 * type and blends two neighbouring columns by how open the flower is.
 *
 * No assets, no literals: every colour comes from the live theme.
 */

import type { Vec3 } from "@/lib/theme";

export const FLOWER_TYPES = ["moon", "bell", "poppy", "allium", "lavender"] as const;
export type FlowerType = (typeof FLOWER_TYPES)[number];
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = FLOWER_TYPES.length;
const CELL = 128;

/** Which flower a role is, from its title. Anything not matched is a product role (moonflower). */
export function flowerOf(title: string): number {
  if (/system/i.test(title)) return 3;
  if (/research/i.test(title)) return 4;
  if (/\bUX\b|user experience/i.test(title)) return 1;
  if (/\bUI\b|visual|interaction|motion/i.test(title)) return 2;
  return 0;
}

export type FlowerColors = { moon: Vec3; bell: Vec3; poppy: Vec3; allium: Vec3; lavender: Vec3; stem: Vec3; core: Vec3 };

const css = (c: Vec3, k = 1, a = 1) => `rgb(${Math.round(Math.min(1, c[0] * k) * 255)} ${Math.round(Math.min(1, c[1] * k) * 255)} ${Math.round(Math.min(1, c[2] * k) * 255)} / ${a})`;

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paint the atlas. Returns a canvas ATLAS_COLS*128 x ATLAS_ROWS*128. */
export function paintFlowerAtlas(C: FlowerColors): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * CELL;
  cv.height = ATLAS_ROWS * CELL;
  const g = cv.getContext("2d")!;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let row = 0; row < ATLAS_ROWS; row++)
    for (let col = 0; col < ATLAS_COLS; col++) {
      g.save();
      g.translate(col * CELL, row * CELL);
      g.beginPath();
      g.rect(0, 0, CELL, CELL);
      g.clip();
      drawFlower(g, row, col, C);
      g.restore();
    }
  return cv;
}

/* ── drawing, in a 128 x 128 cell. Stems rise from (64, 126). ── */

type G = CanvasRenderingContext2D;

function stem(g: G, C: FlowerColors, x1: number, y1: number, bend = 0, leaf = true) {
  g.strokeStyle = css(C.stem, 0.9);
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(64, 127);
  g.quadraticCurveTo(64 + bend, (127 + y1) / 2 + 6, x1, y1);
  g.stroke();
  if (leaf) leafAt(g, C, 64);
}

function leafAt(g: G, C: FlowerColors, x: number) {
  g.fillStyle = css(C.stem);
  g.beginPath();
  g.moveTo(x, 108);
  g.bezierCurveTo(x - 12, 98, x - 24, 102, x - 30, 94);
  g.bezierCurveTo(x - 18, 88, x - 6, 94, x, 102);
  g.closePath();
  g.fill();
}

function paint(g: G, fill: string, edge: string, w = 3) {
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = edge;
  g.lineWidth = w;
  g.stroke();
}

function drawFlower(g: G, type: number, stage: number, C: FlowerColors) {
  const head = stage === 3;
  switch (type) {
    case 0:
      return moon(g, stage, head, C);
    case 1:
      return bell(g, stage, head, C);
    case 2:
      return poppy(g, stage, head, C);
    case 3:
      return allium(g, stage, head, C);
    default:
      return lavender(g, stage, head, C);
  }
}

function moon(g: G, stage: number, head: boolean, C: FlowerColors) {
  const fill = css(C.moon);
  const edge = css(C.moon, 0.62);
  if (stage === 0) {
    stem(g, C, 64, 66);
    g.beginPath();
    g.moveTo(64, 30);
    g.bezierCurveTo(50, 46, 50, 64, 64, 68);
    g.bezierCurveTo(78, 64, 78, 46, 64, 30);
    paint(g, fill, edge);
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(64, 34);
    g.quadraticCurveTo(58, 52, 66, 66);
    g.stroke();
    return;
  }
  if (stage === 1) {
    stem(g, C, 64, 76);
    g.beginPath();
    g.moveTo(64, 78);
    g.bezierCurveTo(44, 66, 36, 44, 40, 32);
    g.quadraticCurveTo(64, 46, 88, 32);
    g.bezierCurveTo(92, 44, 84, 66, 64, 78);
    paint(g, fill, edge);
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.beginPath();
    for (const x of [52, 64, 76]) {
      g.moveTo(64, 74);
      g.lineTo(x, 44);
    }
    g.stroke();
    return;
  }
  const [cx, cy, r] = head ? [64, 64, 46] : [64, 46, 36];
  if (!head) stem(g, C, 64, 80);
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  paint(g, fill, edge);
  g.strokeStyle = edge;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
  }
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  paint(g, css(C.core), css(C.core, 0.7), 2);
}

function bellShape(g: G, x: number, y: number, w: number, h: number, C: FlowerColors, open: number) {
  // hangs from (x, y); mouth at y + h, flared by `open`
  const f = w * (0.5 + 0.25 * open);
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x - w * 0.5, y + h * 0.15, x - w * 0.45, y + h * 0.7, x - f, y + h);
  g.quadraticCurveTo(x - f * 0.5, y + h * 0.88, x, y + h * (0.98 + 0.06 * open));
  g.quadraticCurveTo(x + f * 0.5, y + h * 0.88, x + f, y + h);
  g.bezierCurveTo(x + w * 0.45, y + h * 0.7, x + w * 0.5, y + h * 0.15, x, y);
  paint(g, css(C.bell), css(C.bell, 0.62));
}

function bell(g: G, stage: number, head: boolean, C: FlowerColors) {
  if (head) {
    g.strokeStyle = css(C.stem, 0.9);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(64, 14);
    g.lineTo(64, 30);
    g.stroke();
    bellShape(g, 64, 28, 56, 72, C, 1);
    return;
  }
  // an arching stem with bells hanging from it
  g.strokeStyle = css(C.stem, 0.9);
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(58, 127);
  g.bezierCurveTo(56, 92, 62, 50, 82, 30);
  g.stroke();
  leafAt(g, C, 58);
  if (stage === 0) {
    bellShape(g, 84, 32, 16, 28, C, 0);
    return;
  }
  if (stage === 1) {
    bellShape(g, 84, 32, 28, 40, C, 0.4);
    bellShape(g, 64, 58, 14, 22, C, 0);
    return;
  }
  bellShape(g, 84, 32, 36, 46, C, 1);
  bellShape(g, 62, 58, 26, 34, C, 0.8);
}

function poppy(g: G, stage: number, head: boolean, C: FlowerColors) {
  const fill = css(C.poppy);
  const edge = css(C.poppy, 0.6);
  if (stage === 0) {
    // a nodding bud: green with a seam of colour
    stem(g, C, 74, 44, -10);
    g.save();
    g.translate(78, 52);
    g.rotate(0.5);
    g.beginPath();
    g.ellipse(0, 0, 11, 16, 0, 0, Math.PI * 2);
    paint(g, css(C.stem, 1.15), css(C.stem, 0.7));
    g.strokeStyle = fill;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(0, 14);
    g.stroke();
    g.restore();
    return;
  }
  const s = head ? 1.35 : stage === 1 ? 0.78 : 1;
  const cy = head ? 70 : 62;
  if (!head) stem(g, C, 64, cy + 4);
  g.save();
  g.translate(64, cy);
  g.scale(s, s);
  const spread = stage === 1 ? 0.6 : 1;
  g.beginPath();
  g.moveTo(0, 6);
  g.bezierCurveTo(-30 * spread - 4, 2, -30 * spread - 6, -30, -16 * spread - 4, -40);
  g.bezierCurveTo(-8, -28, 8, -28, 16 * spread + 4, -40);
  g.bezierCurveTo(30 * spread + 6, -30, 30 * spread + 4, 2, 0, 6);
  paint(g, fill, edge);
  if (stage !== 1) {
    g.beginPath();
    g.ellipse(0, -36, 13, 6, 0, 0, Math.PI * 2);
    paint(g, css(C.poppy, 0.78), edge, 2);
    g.beginPath();
    g.ellipse(0, -36, 7, 3.4, 0, 0, Math.PI * 2);
    g.fillStyle = css(C.stem, 0.45);
    g.fill();
  }
  g.restore();
}

function allium(g: G, stage: number, head: boolean, C: FlowerColors) {
  const r = head ? 44 : [14, 22, 32][stage];
  const cy = head ? 64 : 44;
  if (!head) stem(g, C, 64, cy + r * 0.6, 0, false);
  g.beginPath();
  g.arc(64, cy, r, 0, Math.PI * 2);
  g.fillStyle = css(C.allium, 0.75, 0.55);
  g.fill();
  const rand = mulberry(7 + stage);
  const n = head ? 46 : [10, 22, 38][stage];
  const dot = head ? 5.2 : [3.4, 4.2, 4.8][stage];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * (r - dot * 0.6);
    g.beginPath();
    g.arc(64 + Math.cos(a) * d, cy + Math.sin(a) * d, dot, 0, Math.PI * 2);
    g.fillStyle = css(C.allium, 0.85 + rand() * 0.3);
    g.fill();
  }
}

function lavender(g: G, stage: number, head: boolean, C: FlowerColors) {
  const n = head ? 10 : [4, 7, 10][stage];
  const top = head ? 14 : [56, 40, 22][stage];
  const step = head ? 10 : 8.5;
  if (!head) stem(g, C, 64, top + n * step, 0, true);
  for (let i = 0; i < n; i++) {
    const y = top + i * step;
    const x = i % 2 === 0 ? 58 : 70;
    const w = (head ? 7 : 5.5) * (stage === 0 && !head ? 0.8 : 1);
    g.save();
    g.translate(x, y);
    g.rotate(i % 2 === 0 ? -0.35 : 0.35);
    g.beginPath();
    g.ellipse(0, 0, w, w * 1.5, 0, 0, Math.PI * 2);
    paint(g, css(C.lavender, stage === 0 && !head ? 0.8 : 1), css(C.lavender, 0.6), 2);
    g.restore();
  }
}
