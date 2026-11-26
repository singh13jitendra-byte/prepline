// Fetches each scene in sources.json and writes optimized variants to public/scenes.
// Opaque scenes: <name>-{960,1600,2400}.{avif,webp}; transparent layers keep alpha (webp + png).
import fs from "node:fs/promises";
import sharp from "sharp";

const sources = JSON.parse(await fs.readFile(new URL("./sources.json", import.meta.url), "utf8"));
await fs.mkdir("public/scenes", { recursive: true });
const manifest = {};
for (const s of sources) {
  const res = await fetch(s.url);
  if (!res.ok) throw new Error(`${s.name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf);
  const meta = await img.metadata();
  manifest[s.name] = { width: meta.width, height: meta.height, alpha: !!s.alpha, widths: [] };
  // 960, 1600, 2400 where the source is at least that wide, plus the source's own width
  // (2048, 1280) so nothing is ever upscaled from a smaller export.
  const targets = [...new Set([960, 1600, 2400, meta.width])].sort((a, b) => a - b);
  for (const w of targets) {
    if (w > meta.width * 1.05 && w !== 960) continue;
    const r = sharp(buf).resize({ width: Math.min(w, meta.width) });
    await r.clone().webp({ quality: s.alpha ? 86 : 80, alphaQuality: 90 }).toFile(`public/scenes/${s.name}-${w}.webp`);
    if (s.alpha) await r.clone().png({ compressionLevel: 9 }).toFile(`public/scenes/${s.name}-${w}.png`);
    else await r.clone().avif({ quality: 55 }).toFile(`public/scenes/${s.name}-${w}.avif`);
    manifest[s.name].widths.push(w);
  }
  // tiny blurred placeholder
  const lq = await sharp(buf).resize({ width: 32 }).webp({ quality: 40 }).toBuffer();
  manifest[s.name].placeholder = `data:image/webp;base64,${lq.toString("base64")}`;
  console.log("ok", s.name, meta.width, meta.height);
}
await fs.writeFile("public/scenes/manifest.json", JSON.stringify(manifest, null, 2));
