/**
 * The painted meadow's two pictures, loaded exactly as the firefly scene loads them
 * (components/fireflies/scene/engine.ts keeps these helpers private), so the wide shot matches the
 * page pixel for pixel: the meadow sRGB, the grass premultiplied and uploaded as raw values, both
 * decoded off the main thread with their rows flipped.
 */

import * as THREE from "three";

type Manifest = Record<string, { width: number; height: number; widths: number[] }>;
const MANIFEST_FALLBACK: Manifest = {
  "meadow-night": { width: 1280, height: 720, widths: [960, 1280] },
  "grass-fg": { width: 2048, height: 1152, widths: [960, 1600, 2048] },
};

export async function readManifest(): Promise<Manifest> {
  try {
    const r = await fetch("/scenes/manifest.json");
    if (!r.ok) return MANIFEST_FALLBACK;
    const m = (await r.json()) as Manifest;
    return m["meadow-night"]?.widths?.length && m["grass-fg"]?.widths?.length ? m : MANIFEST_FALLBACK;
  } catch {
    return MANIFEST_FALLBACK;
  }
}

/** The smallest exported width that is at least `need` (or the largest there is). */
export const widthFor = (widths: number[], need: number) => widths.find((w) => w >= need) ?? widths[widths.length - 1];

export async function loadTexture(url: string, opts: { premultiply: boolean; srgb: boolean; maxAniso: number }): Promise<THREE.Texture> {
  let tex: THREE.Texture;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`load-failed:${url}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: opts.premultiply ? "premultiply" : "none", colorSpaceConversion: "none" });
    tex = new THREE.Texture(bitmap as unknown as HTMLImageElement);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.userData.bitmap = bitmap;
  } catch {
    // No ImageBitmap options (older Safari): an <img>, decoded before use. A missing file rejects here.
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    tex = new THREE.Texture(img);
    tex.flipY = true;
    tex.premultiplyAlpha = opts.premultiply;
  }
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(4, opts.maxAniso);
  tex.needsUpdate = true;
  return tex;
}

export function freeTexture(t: THREE.Texture | null | undefined) {
  (t?.userData.bitmap as ImageBitmap | undefined)?.close?.();
  t?.dispose();
}
