// Fetches each scene in sources.json and writes optimized variants to public/scenes.
// Opaque scenes: <name>-<w>.{avif,webp}. Transparent layers: <name>-<w>.webp only (WebP keeps the
// alpha; the PNG copies were 15MB of files nothing loaded). Encoded for quality, not size
// (review 3, P0-1): AVIF q70, WebP q86. Widths: 960, 1600, 2400 where the source is that wide,
// plus the source's own width (2048, 1280), so nothing is ever upscaled.
// The manifest records the widths and `formats` of every scene; components/world/Scenes.tsx reads it.
// Variants this run does not write (an old PNG, a width the new source no longer has) are removed.
import fs from "node:fs/promises";
import sharp from "sharp";

const AVIF = { quality: 70, effort: 6, chromaSubsampling: "4:4:4" };
const WEBP = { quality: 86, alphaQuality: 95, effort: 6, smartSubsample: true };

const sources = JSON.parse(await fs.readFile(new URL("./sources.json", import.meta.url), "utf8"));
const dir = "public/scenes";
await fs.mkdir(dir, { recursive: true });
const manifest = {};
const written = new Set(["manifest.json"]);
for (const s of sources) {
  const res = await fetch(s.url);
  if (!res.ok) throw new Error(`${s.name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const formats = s.alpha ? ["webp"] : ["avif", "webp"];
  manifest[s.name] = { width: meta.width, height: meta.height, alpha: !!s.alpha, formats, widths: [] };
  const targets = [...new Set([960, 1600, 2400, meta.width])].sort((a, b) => a - b);
  for (const w of targets) {
    if (w > meta.width * 1.05 && w !== 960) continue;
    const r = sharp(buf).resize({ width: Math.min(w, meta.width) });
    for (const f of formats) {
      const file = `${s.name}-${w}.${f}`;
      if (f === "webp") await r.clone().webp(WEBP).toFile(`${dir}/${file}`);
      else await r.clone().avif(AVIF).toFile(`${dir}/${file}`);
      written.add(file);
    }
    manifest[s.name].widths.push(w);
  }
  // tiny blurred placeholder
  const lq = await sharp(buf).resize({ width: 32 }).webp({ quality: 40 }).toBuffer();
  manifest[s.name].placeholder = `data:image/webp;base64,${lq.toString("base64")}`;
  console.log("ok", s.name, meta.width, meta.height, formats.join("+"), manifest[s.name].widths.join(","));
}
// Remove stale variants of the scenes listed (never anything else in the folder).
const names = sources.map((s) => s.name);
for (const file of await fs.readdir(dir)) {
  const ours = names.some((n) => new RegExp(`^${n}-\\d+\\.(avif|webp|png)$`).test(file));
  if (ours && !written.has(file)) {
    await fs.unlink(`${dir}/${file}`);
    console.log("removed stale", file);
  }
}
await fs.writeFile(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
