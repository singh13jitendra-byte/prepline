/**
 * THEME — the JS side of the token layer (contract: research/theme-tokens.md).
 *
 * app/theme.css is the single source of truth. This module
 * - mirrors its defaults (`theme`), for code that has no DOM (SSR, tests) and as a fallback;
 * - reads the live values at runtime (`readTheme`, `readWorldColors`), so the WebGL world and
 *   any canvas drawing follow whichever theme is applied;
 * - switches themes (`applyTheme`): sets html[data-theme] and dispatches `prepline:theme`,
 *   which the World listens for to refresh its uniforms;
 * - holds the motion tokens GSAP needs as names (`ease`).
 *
 * scripts/check-tokens.mjs checks that the mirror below matches app/theme.css.
 */

export type Vec3 = [number, number, number];

/**
 * Default theme mirror (Night Desk). Values are exactly as written in app/theme.css (var() chains
 * resolved), at :root, so they are the DAY values of the roles that swap by chapter: --c-match here
 * is ochre, and lamp inside a night scope. The World reads each role on the side it draws on
 * (WORLD_COLORS below), so it gets lamp for the fireflies.
 */
export const theme = {
  colors: {
    "--c-paper": "#f4eada",
    "--c-paper-2": "#fbf5ea",
    "--c-ink": "#12312c",
    "--c-ink-2": "#56665f",
    "--c-ink-3": "#6f7d76",
    "--c-rule": "#dccfb8",
    "--c-night": "#12312c",
    "--c-night-2": "#1b3f39",
    "--c-on-night": "#f4eada",
    "--c-accent": "#12312c",
    "--c-accent-ink": "#f4eada",
    "--c-line": "#f6c945",
    "--c-line-glow": "transparent",
    "--c-match": "#7a5600",
    "--c-dim": "#3c5650",
    "--c-success": "#1e6b45",
    "--c-danger": "#a8301f",
    "--c-focus": "#12312c",
    "--c-surface": "#fbf5ea",
    "--c-accent-night": "#f6c945",
    "--art-night-glow": "#1b3f39",
    "--art-speck": "#f4eada",
    "--art-speck-warm": "#f4eada",
    "--art-speck-cool": "#a9bdb3",
    "--art-ember": "#f6c945",
    "--art-ember-cool": "#d9622b",
    "--art-seat": "#12312c",
    "--art-dust-day": "#12312c",
    "--art-lamp-dust": "#fbe49a",
    "--art-lamp-deep": "#f6c945",
    "--art-lamp-heart": "#fbe49a",
    "--art-lamp-day": "#f6c945",
    "--art-dawn-1": "#fbf5ea",
    "--art-dawn-2": "#fbe49a",
    "--art-dawn-3": "#f6c945",
    "--art-wake-day": "#f6c945",
    "--art-wake-night": "#f6c945",
    "--art-line-bloom": "transparent",
    "--art-line-heat": "#f6c945",
    "--art-line-core": "transparent",
    "--art-flash-night": "#f4eada",
    "--art-flash-day": "#fbf5ea",
    "--art-lens": "#f4eada",
  },
  ease: {
    "--ease-out": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--ease-in": "cubic-bezier(0.5, 0, 0.75, 0)",
    "--ease-in-out": "cubic-bezier(0.65, 0, 0.15, 1)",
    "--ease-spring": "cubic-bezier(0.34, 1.4, 0.64, 1)",
  },
} as const;

export type ColorToken = keyof typeof theme.colors;
export type ThemeColors = Record<ColorToken, string>;

/**
 * The colours the WebGL world takes as uniforms, by role, and the side of the line each is drawn
 * on. Every vec3 in the shaders that is not pure black or white math comes from one of these.
 * Night-side roles are read inside a [data-skin="night"] scope and day-side roles inside a
 * [data-skin="day"] scope, so a theme that swaps roles per chapter or skin gives the World the
 * value for the side it draws on, whatever chapter is current when it reads.
 */
export const WORLD_COLORS = {
  speckWarm: ["--art-speck-warm", "night"], // field: an unread speck
  speckCool: ["--art-speck-cool", "night"], // field: the few cool ones
  ember: ["--art-ember", "night"], // field: just read (afterglow)
  emberCool: ["--art-ember-cool", "night"], // field: a set-aside firefly cooling as it sinks
  match: ["--c-match", "night"], // field: the twelve, kept specks in the lens, seats at night
  edge: ["--c-on-night", "night"], // field: a landed row's border, as it hands over to the DOM glass
  lampDust: ["--art-lamp-dust", "night"], // field: dust the lamp catches
  dustDay: ["--art-dust-day", "day"], // field: specks by day
  accent: ["--c-accent", "day"], // field: filings at Interview, a seat being claimed by day
  seat: ["--art-seat", "day"], // field: a claimed seat by day
  lampDeep: ["--art-lamp-deep", "night"], // light: lamp pool edge (night)
  lampHeart: ["--art-lamp-heart", "night"], // light: lamp pool heart (night)
  lampDay: ["--art-lamp-day", "day"], // light: the board's column glow
  dawn1: ["--art-dawn-1", "day"], // light: dawn, three depths
  dawn2: ["--art-dawn-2", "day"],
  dawn3: ["--art-dawn-3", "day"],
  wakeDay: ["--art-wake-day", "day"], // light: the Line's wake by day, and the day rising edge
  wakeNight: ["--art-wake-night", "night"], // light: the Line's wake at night
  lineGlow: ["--c-line-glow", "night"], // alpha only: 0 turns the halo and bloom off
  lineBloom: ["--art-line-bloom", "night"], // light: the Line's tight bloom
  lineHeat: ["--art-line-heat", "night"], // light: the Line's white-hot core (added)
  flashNight: ["--art-flash-night", "night"], // light: the day-break exposure
  flashDay: ["--art-flash-day", "day"],
  lens: ["--art-lens", "night"], // light: the reading lens' glass
} as const satisfies Record<string, readonly [ColorToken, "night" | "day"]>;

export type WorldColorRole = keyof typeof WORLD_COLORS;
export type WorldColors = Record<WorldColorRole, Vec3>;
export type WorldTheme = { colors: WorldColors; alpha: Record<WorldColorRole, number> };

/** GSAP easing names (GSAP takes names, not CSS curves). Change the feel of timed JS motion here. */
export const ease = {
  /** Entrances (CSS --ease-out). */
  out: "expo.out",
  outSoft: "power2.out",
  outFirm: "power3.out",
  outGentle: "power1.out",
  /** Exits (CSS --ease-in). */
  in: "power2.in",
  inOut: "power2.inOut",
  inOutFirm: "power3.inOut",
  springSoft: "back.out(1.6)",
  spring: "back.out(1.8)",
  elastic: "elastic.out(1, 0.4)",
  none: "none",
} as const;

export const THEME_EVENT = "prepline:theme";

const hasDom = () => typeof window !== "undefined" && typeof document !== "undefined";

/** A token's live value (any token: colour, ease, radius ...), or the mirrored default. */
export function cssToken(name: string, fallback?: string): string {
  const def = fallback ?? (theme.colors as Record<string, string>)[name] ?? (theme.ease as Record<string, string>)[name] ?? "";
  if (!hasDom()) return def;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || def;
}

/** Every mirrored colour token, as currently computed (falls back to the default per token). */
export function readTheme(el?: Element): ThemeColors {
  const out = { ...theme.colors } as ThemeColors;
  if (!hasDom()) return out;
  const cs = getComputedStyle(el ?? document.documentElement);
  for (const k of Object.keys(out) as ColorToken[]) {
    const v = cs.getPropertyValue(k).trim();
    if (v) out[k] = v;
  }
  return out;
}

let probes: Partial<Record<"night" | "day", HTMLElement>> = {};
/** A hidden element inside a skin scope, so scoped overrides (chapter / skin) resolve on it. */
function scopeProbe(side: "night" | "day"): Element {
  let el = probes[side];
  if (!el || !el.isConnected) {
    el = document.createElement("div");
    el.dataset.skin = side;
    el.dataset.themeProbe = "";
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    probes = { ...probes, [side]: el };
  }
  return el;
}

/**
 * The world's colours as normalized sRGB vec3s (plus each one's alpha), read from the live theme,
 * each on the side of the line it is drawn on. Unparseable values fall back to the default.
 */
export function readWorld(): WorldTheme {
  const sides = hasDom() && document.body ? { night: readTheme(scopeProbe("night")), day: readTheme(scopeProbe("day")) } : { night: readTheme(), day: readTheme() };
  const colors = {} as WorldColors;
  const alpha = {} as Record<WorldColorRole, number>;
  for (const role of Object.keys(WORLD_COLORS) as WorldColorRole[]) {
    const [token, side] = WORLD_COLORS[role];
    const c = toRGBA(sides[side][token]) ?? (toRGBA(theme.colors[token]) as RGBA);
    colors[role] = [c[0], c[1], c[2]];
    alpha[role] = c[3];
  }
  return { colors, alpha };
}

/** @deprecated use readWorld(); kept for callers that only need the vec3s. */
export function readWorldColors(): WorldColors {
  return readWorld().colors;
}

export type RGBA = [number, number, number, number];

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?`;
const comp = (s: string, scale: number) => (s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s) / scale);

const alphaOf = (m: string | undefined) => (m === undefined ? 1 : Math.min(1, Math.max(0, comp(m, 1))));

/**
 * Any CSS colour → [r, g, b, a], r g b in 0..1 sRGB. Exact for hex (3, 4, 6, 8 digits),
 * rgb()/rgba() (comma or space syntax, numbers or percentages, optional alpha), color(srgb ...)
 * and `transparent`; anything else (oklch, hsl, color-mix, a named colour) is resolved through a
 * 1px canvas, to 8 bits. Returns null for something that is not a colour.
 */
export function toRGBA(css: string): RGBA | null {
  const s = css.trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent") return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, a];
  }
  m = new RegExp(String.raw`^rgba?\(\s*(${NUM})[\s,]+(${NUM})[\s,]+(${NUM})\s*(?:[,/]\s*(${NUM})\s*)?\)$`).exec(s);
  if (m) return [comp(m[1], 255), comp(m[2], 255), comp(m[3], 255), alphaOf(m[4])];
  m = new RegExp(String.raw`^color\(\s*srgb\s+(${NUM})\s+(${NUM})\s+(${NUM})\s*(?:/\s*(${NUM})\s*)?\)$`).exec(s);
  if (m) return [comp(m[1], 1), comp(m[2], 1), comp(m[3], 1), alphaOf(m[4])];
  return probe(s);
}

/** Any CSS colour → [r, g, b] in 0..1 (alpha dropped). */
export function toVec3(css: string): Vec3 | null {
  const c = toRGBA(css);
  return c ? [c[0], c[1], c[2]] : null;
}

let probeCtx: CanvasRenderingContext2D | null | undefined;
function canvasCtx(): CanvasRenderingContext2D | null {
  if (probeCtx === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    probeCtx = c.getContext("2d", { willReadFrequently: true });
  }
  return probeCtx;
}
function probe(css: string): RGBA | null {
  if (!hasDom()) return null;
  const ctx = canvasCtx();
  if (!ctx) return null;
  // An invalid colour leaves fillStyle untouched: set two different sentinels, and if the value
  // sticks after both, it parsed.
  const SENTINELS = ["#010203", "#040506"]; // token-ok: parse sentinels, never drawn
  for (const sentinel of SENTINELS) {
    ctx.fillStyle = sentinel;
    ctx.fillStyle = css;
    if (ctx.fillStyle === sentinel) return null;
  }
  ctx.globalCompositeOperation = "copy";
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
}

const monoCache = new Map<string, boolean>();
/**
 * Width of `text` set in `el`'s font, for code that places labels without a layout read.
 * Nothing may assume --font-mono is monospaced: a monospaced face keeps the caller's per-character
 * estimate (today's numbers, unchanged), a proportional one is measured, letter-spacing included.
 */
export function labelWidth(el: Element, text: string, perChar: number): number {
  if (!hasDom()) return text.length * perChar;
  const cs = getComputedStyle(el);
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const ctx = canvasCtx();
  if (!ctx) return text.length * perChar;
  ctx.font = font;
  let mono = monoCache.get(font);
  if (mono === undefined) {
    mono = Math.abs(ctx.measureText("iiiiiiiiii").width - ctx.measureText("MMMMMMMMMM").width) < 0.5;
    monoCache.set(font, mono);
  }
  if (mono) return text.length * perChar;
  const ls = parseFloat(cs.letterSpacing) || 0;
  const t = cs.textTransform === "uppercase" ? text.toUpperCase() : text;
  return ctx.measureText(t).width + ls * t.length;
}

const faceRadii = new Map<string, number>();
/**
 * Corner radius of a story face at natural size, from --r-face-<face> (px), or the given default.
 * Cached (the Actor asks every frame in flight); applyTheme clears the cache.
 */
export function faceRadius(face: string, fallback: number): number {
  if (!hasDom()) return fallback;
  let v = faceRadii.get(face);
  if (v === undefined) {
    v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--r-face-${face}`));
    if (!Number.isFinite(v)) v = fallback;
    faceRadii.set(face, v);
  }
  return v;
}

/** The applied theme's name ("default" when none). */
export function currentTheme(): string {
  return (hasDom() && document.documentElement.dataset.theme) || "default";
}

/**
 * Apply a theme: `applyTheme("x")` turns on `:root[data-theme="x"]` (app/themes/x.css, e.g.
 * "legacy"), `applyTheme("default")` returns to app/theme.css (Night Desk). Dispatches `prepline:theme` on window.
 */
export function applyTheme(name: string | null | undefined) {
  if (!hasDom()) return;
  const html = document.documentElement;
  if (!name || name === "default") delete html.dataset.theme;
  else html.dataset.theme = name;
  faceRadii.clear();
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { name: currentTheme() } }));
}

/** Run `fn` whenever a theme is applied. Returns the unsubscribe. */
export function onThemeChange(fn: (name: string) => void): () => void {
  if (!hasDom()) return () => {};
  const h = (e: Event) => fn((e as CustomEvent<{ name: string }>).detail?.name ?? currentTheme());
  window.addEventListener(THEME_EVENT, h);
  return () => window.removeEventListener(THEME_EVENT, h);
}
