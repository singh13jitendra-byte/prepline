#!/usr/bin/env node
/**
 * Token lint: no raw colour or font-family literal outside the token layer.
 *
 *   node scripts/check-tokens.mjs            # exit 1 on any violation
 *
 * Allowed homes: app/theme.css, app/themes/*, lib/theme.ts.
 * Flags, in every other .css / .ts / .tsx under app/, components/ and lib/:
 *   - hex colours (#rgb, #rgba, #rrggbb, #rrggbbaa)
 *   - rgb() / rgba() / hsl() / hsla() literals
 *   - font-family (or fontFamily, or the font shorthand) with a literal family, not var(--font-*)
 *   - Tailwind palette colours in class names (text-white, bg-black, bg-amber-500 ...)
 *   - arbitrary Tailwind colour values (bg-[#...], shadow-[...rgba(...)])
 * Escape hatch for the rare legitimate case: put `token-ok` in a comment on the same line,
 * with the reason (e.g. `/* token-ok: debug overlay *\/`).
 *
 * It also checks that the default mirror in lib/theme.ts matches app/theme.css.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCAN = ["app", "components", "lib"];
const ALLOW = [/^app\/theme\.css$/, /^app\/themes\//, /^lib\/theme\.ts$/];
const EXT = /\.(css|ts|tsx|mjs|js)$/;

const RULES = [
  { name: "hex colour", re: /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
  { name: "rgb()/hsl() literal", re: /\b(?:rgba?|hsla?)\(\s*[\d.]/g },
  { name: "font-family literal", re: /font-family\s*:\s*(?!\s*(?:var\(--font-|inherit|initial|unset|revert)\b)[^;}"'`]+/g },
  { name: "fontFamily literal", re: /fontFamily\s*:\s*(?!\s*["'`]var\(--font-)["'`]/g },
  { name: "font shorthand with a literal family", re: /(?<![\w-])font\s*:\s*[^;}"'`]*?(?:serif|sans-serif|monospace|cursive|system-ui)\b/g },
  {
    name: "Tailwind palette colour",
    re: /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|outline|ring|fill|stroke|from|via|to|shadow|decoration|divide|placeholder|caret|accent)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?![\w-])/g,
  },
  { name: "Tailwind arbitrary colour", re: /(?:bg|text|border|outline|ring|fill|stroke|shadow|from|via|to)-\[[^\]]*(?:#|rgba?\(|hsla?\()[^\]]*\]/g },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

/** Blank out comments (keeping newlines and `token-ok` markers) so documentation never trips the lint. */
function stripComments(src, isCss) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => (m.includes("token-ok") ? m : m.replace(/[^\n]/g, " ")));
  if (!isCss) out = out.replace(/(^|[^:\\])\/\/.*$/gm, (m, pre) => pre + (m.includes("token-ok") ? " token-ok" : ""));
  return out;
}

const violations = [];
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (ALLOW.some((r) => r.test(rel))) continue;
    const raw = readFileSync(file, "utf8");
    const src = stripComments(raw, rel.endsWith(".css"));
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (line.includes("token-ok")) return;
      for (const { name, re } of RULES) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) violations.push(`${rel}:${i + 1}  ${name}: ${m[0].trim().slice(0, 60)}`);
      }
    });
  }
}

/* ── the JS mirror must match app/theme.css ── */
const css = readFileSync(join(ROOT, "app/theme.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rootBlock = css.slice(css.indexOf(":root {"));
const decl = new Map();
for (const m of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (!decl.has(m[1])) decl.set(m[1], m[2].replace(/\s+/g, " ").trim());
const resolve = (v, depth = 0) => {
  const m = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(v);
  if (!m || depth > 8) return v;
  return decl.has(m[1]) ? resolve(decl.get(m[1]), depth + 1) : (m[2] ?? v);
};
const ts = readFileSync(join(ROOT, "lib/theme.ts"), "utf8");
const mirror = ts.slice(ts.indexOf("export const theme = {"), ts.indexOf("} as const;"));
let mirrored = 0;
for (const m of mirror.matchAll(/"(--[\w-]+)":\s*"([^"]+)"/g)) {
  mirrored++;
  const want = decl.has(m[1]) ? resolve(decl.get(m[1])) : undefined;
  if (want === undefined) violations.push(`lib/theme.ts  mirror: ${m[1]} is not defined in app/theme.css`);
  else if (want.toLowerCase() !== m[2].toLowerCase()) violations.push(`lib/theme.ts  mirror: ${m[1]} is "${m[2]}", app/theme.css says "${want}"`);
}

if (violations.length) {
  console.error(violations.join("\n"));
  console.error(`\ncheck-tokens: ${violations.length} literal(s) outside the token layer. Use a role token (app/theme.css),`);
  console.error("or mark a legitimate exception with a `token-ok: <reason>` comment on the same line.");
  process.exit(1);
}
console.log(`check-tokens: OK (no literals outside the token layer; ${mirrored} mirrored tokens match app/theme.css)`);
