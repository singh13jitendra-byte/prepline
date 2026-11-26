import fs from "node:fs";
import path from "node:path";
import type { CSSProperties } from "react";
import { LaptopScreen } from "./LaptopScreen";
import { SceneDirector } from "./SceneDirector";
import { DESK, FOCUS, HOTSPOTS, SCENE_FALLBACK, SCENE_GROUND, SCENE_NAMES, type HotspotId, type SceneManifest, type SceneName } from "./sceneGeometry";

/**
 * SCENES — the painted world: the World's backdrop (round 4).
 *
 * One room and one meadow, painted, on fixed layers behind everything. This file is the
 * server-rendered markup: responsive <picture> layers built from public/scenes/manifest.json
 * (AVIF and WebP srcsets, explicit width and height, a blur-up placeholder, the hero eager
 * with fetchpriority="high", the rest held back until the hero has painted).
 * SceneDirector.tsx moves them: transforms and opacity only, from the story store.
 *
 *   desk-night     the hero, and (framed close on the lamp-lit desk) the prep act
 *   meadow-night   through the window: the two reading passes, ranked, reason
 *   (window-frame is not drawn: the room's own painted window flies past as the camera
 *    pushes through it, and a second, differently painted frame on top of it read as a prop.)
 *   grass-fg       foreground grass: parallax in the meadow, and the bottom of the seat act
 *   desk-bluehour  the same room before dawn (above the Line during the dawn wipe)
 *   desk-dawn      the same room at dawn (below the Line, then the whole seat act)
 *
 * The manifest is read from disk when the page is rendered (it is static, so: at build).
 * No manifest, or a scene with no files: that layer paints a flat theme-colour ground and the
 * page still builds, scrolls and reads. Nothing is fetched that is not listed.
 *
 * Hotspots (`laptop-screen`, `window-view`, `desk-lamp`) are empty boxes inside the room
 * layer, placed in percentages of the painting, so they track resize, the cover crop and
 * the push-through. SceneDirector registers them as anchors. The laptop's screen holds a
 * live, decorative MatchesList.
 */

function readManifest(): SceneManifest {
  const out: SceneManifest = { ...SCENE_FALLBACK };
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "scenes", "manifest.json"), "utf8")) as Partial<SceneManifest>;
    for (const name of SCENE_NAMES) {
      const e = raw[name];
      if (e && e.width > 0 && e.height > 0 && Array.isArray(e.widths)) out[name] = { ...SCENE_FALLBACK[name], ...e };
    }
  } catch {
    /* not fetched yet: the fallback grounds stand in */
  }
  return out;
}

const srcset = (name: SceneName, widths: number[], ext: string) => widths.map((w) => `/scenes/${name}-${w}.${ext} ${w}w`).join(", ");

function Picture({ name, manifest, eager, sizes }: { name: SceneName; manifest: SceneManifest; eager?: boolean; sizes: string }) {
  const m = manifest[name];
  if (!m.widths.length) return null;
  const largest = m.widths[m.widths.length - 1];
  // Held-back pictures carry their sources as data: SceneDirector hands them over once the hero has painted.
  const set = (value: string) => (eager ? { srcSet: value } : { "data-srcset": value });
  return (
    <picture>
      {!m.alpha ? <source type="image/avif" sizes={sizes} {...set(srcset(name, m.widths, "avif"))} /> : null}
      <source type="image/webp" sizes={sizes} {...set(srcset(name, m.widths, "webp"))} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="sc-img"
        alt=""
        width={m.width}
        height={m.height}
        decoding="async"
        draggable={false}
        {...(eager ? { src: `/scenes/${name}-${largest}.webp`, fetchPriority: "high" as const } : { "data-src": `/scenes/${name}-${largest}.webp`, loading: "lazy" as const })}
      />
    </picture>
  );
}

function Layer({
  name,
  manifest,
  className,
  focus,
  eager,
  children,
}: {
  name: SceneName;
  manifest: SceneManifest;
  className: string;
  focus: keyof typeof FOCUS;
  eager?: boolean;
  children?: React.ReactNode;
}) {
  const m = manifest[name];
  const ground = m.placeholder ? `url(${m.placeholder})` : SCENE_GROUND[name];
  const f = FOCUS[focus];
  const style = {
    "--ar": (m.width / m.height).toFixed(5),
    "--fx": f.wide[0],
    "--fy": f.wide[1],
    "--fxs": f.small[0],
    "--fys": f.small[1],
    backgroundImage: ground,
  } as CSSProperties;
  return (
    <div className={`sc-layer ${className}`} data-scene={name} data-files={m.widths.length ? "" : undefined} style={style}>
      <Picture name={name} manifest={manifest} eager={eager} sizes="max(100vw, 178vh)" />
      {children}
    </div>
  );
}

function Hotspot({ id, children }: { id: HotspotId; children?: React.ReactNode }) {
  const r = HOTSPOTS[id];
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  return (
    <div className={`sc-hot sc-hot-${id}`} data-hot={id} style={{ left: pct(r.x0, DESK.w), top: pct(r.y0, DESK.h), width: pct(r.x1 - r.x0, DESK.w), height: pct(r.y1 - r.y0, DESK.h) }}>
      {children}
    </div>
  );
}

/** Static-page stills (reduced motion, no JS): the same paintings as plain panel backgrounds. */
export function sceneStillCss(): string {
  const manifest = readManifest();
  const still = (name: SceneName) => {
    const m = manifest[name];
    if (!m.widths.length) return null;
    const w = m.widths.includes(1600) ? 1600 : m.widths[m.widths.length - 1];
    return m.alpha ? `url(/scenes/${name}-${w}.webp)` : `image-set(url(/scenes/${name}-${w}.avif) type("image/avif"),url(/scenes/${name}-${w}.webp) type("image/webp"))`;
  };
  const night = still("desk-night");
  const dawn = still("desk-dawn");
  const meadow = still("meadow-night");
  const veilN = "linear-gradient(100deg,var(--c-night) 0%,color-mix(in oklab,var(--c-night) 86%,transparent) 38%,color-mix(in oklab,var(--c-night) 20%,transparent) 78%)";
  const veilD = "linear-gradient(100deg,var(--c-paper) 0%,color-mix(in oklab,var(--c-paper) 82%,transparent) 40%,color-mix(in oklab,var(--c-paper) 12%,transparent) 80%)";
  let css = "";
  const rule = (sel: string, veil: string, img: string | null, pos: string) => {
    if (img) css += `html:not(.motion) ${sel}{background-image:${veil},${img};background-size:cover;background-position:${pos};background-repeat:no-repeat}\n`;
  };
  rule('.story-stage[data-stage="read"] .story-panel[data-beats~="hero"]', veilN, night, "62% 50%");
  rule('.story-stage[data-stage="read"] .story-panel[data-beats~="pass1"]', veilN, meadow, "50% 50%");
  rule('.story-stage[data-stage="prep"]', veilN, night, "70% 70%");
  rule('.story-stage[data-stage="seat"]', veilD, dawn, "62% 50%");
  return css;
}

/** The night paintings: they sit on the pine backdrop, under the cream day sheet. */
export function ScenesNight() {
  const manifest = readManifest();
  return (
    <div aria-hidden="true" className="sc sc-night only-motion" data-scenes>
      <Layer name="meadow-night" manifest={manifest} className="sc-meadow" focus="meadow" />
      <Layer name="desk-night" manifest={manifest} className="sc-room" focus="room" eager>
        <Hotspot id="window-view" />
        <Hotspot id="desk-lamp" />
        <Hotspot id="laptop-screen">
          <LaptopScreen />
        </Hotspot>
      </Layer>
      <Layer name="desk-bluehour" manifest={manifest} className="sc-blue" focus="room" />
      <div className="sc-wash sc-wash-night" />
    </div>
  );
}

/** The dawn painting and the foreground grass: over the day sheet, under the grain. */
export function ScenesDay() {
  const manifest = readManifest();
  return (
    <>
      <div aria-hidden="true" className="sc sc-dawnwrap only-motion" data-mode="off">
        <Layer name="desk-dawn" manifest={manifest} className="sc-dawn" focus="dawn" />
        <div className="sc-sun" />
        <div className="sc-wash sc-wash-day" />
      </div>
      <div aria-hidden="true" className="sc sc-grasswrap only-motion">
        <Layer name="grass-fg" manifest={manifest} className="sc-grass" focus="meadow" />
      </div>
      <SceneDirector />
    </>
  );
}

export const SCENE_CSS = `
.sc{position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;z-index:var(--z-backdrop);pointer-events:none;overflow:hidden;contain:strict}
.sc-layer{position:absolute;--w:max(100vw,calc(100lvh * var(--ar)));width:var(--w);height:calc(var(--w) / var(--ar));left:calc((100vw - var(--w)) * var(--fx));top:calc((100lvh - var(--w) / var(--ar)) * var(--fy));background-size:cover;background-position:center;transform-origin:0 0;will-change:transform,opacity;backface-visibility:hidden}
@media (max-width:767px){.sc-layer{left:calc((100vw - var(--w)) * var(--fxs));top:calc((100lvh - var(--w) / var(--ar)) * var(--fys))}}
.sc-img{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .5s linear;user-select:none}
.sc-img[data-on]{opacity:1}
.sc-meadow,.sc-blue,.sc-grass{visibility:hidden}
.sc-grass{background-image:none!important}
/* The grass is painted in daylight: at night it is in shadow. */
.sc-grasswrap[data-night] .sc-grass{filter:brightness(.42) saturate(.7) hue-rotate(28deg)}
.sc-dawnwrap{visibility:hidden}
.sc-grasswrap{display:none}
.sc-dawnwrap[data-mode="day"]{visibility:visible}
.sc-dawnwrap[data-mode="split"]{visibility:visible;clip-path:inset(var(--day-top) 0 0 0)}
.sc-grasswrap{overflow:visible;contain:layout style}
.sc-grass{top:auto;bottom:0}
.sc-hot{position:absolute}
.sc-hot-laptop-screen{overflow:hidden;border-radius:calc(var(--r-2xs,2px) * 1.5);background:var(--c-paper-2);opacity:0;transition:opacity .6s linear}
.sc-night[data-lit] .sc-hot-laptop-screen{opacity:1}
/* The screen is a painted object: its UI sits a touch under the paint, and lights the desk a little. */
.sc-hot-laptop-screen::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(160deg,color-mix(in oklab,var(--c-on-night) 10%,transparent),transparent 45%,color-mix(in oklab,var(--c-night) 16%,transparent));box-shadow:0 0 calc(var(--w) * .012) color-mix(in oklab,var(--c-paper-2) 30%,transparent)}
.sc-wash{position:absolute;inset:0;will-change:opacity}
.sc-wash-night{background:linear-gradient(94deg,var(--c-night) 0%,color-mix(in oklab,var(--c-night) 92%,transparent) 18%,color-mix(in oklab,var(--c-night) 55%,transparent) 34%,transparent 47%)}
.sc-wash-day{background:linear-gradient(94deg,color-mix(in oklab,var(--c-paper) 70%,transparent) 0%,color-mix(in oklab,var(--c-paper) 45%,transparent) 30%,transparent 48%)}
@media (max-width:767px){
.sc-wash-night{background:linear-gradient(180deg,var(--c-night) 0%,var(--c-night) 40%,color-mix(in oklab,var(--c-night) 70%,transparent) 56%,transparent 72%)}
.sc-wash-day{background:linear-gradient(180deg,var(--c-paper) 0%,color-mix(in oklab,var(--c-paper) 88%,transparent) 36%,color-mix(in oklab,var(--c-paper) 24%,transparent) 60%,transparent 76%)}
}
/* Sunrise: a flat rectangle of light that crosses the wall. A shape, not a glow. */
.sc-sun{position:absolute;left:0;top:0;width:34vw;height:120%;transform-origin:0 0;opacity:0;will-change:transform,opacity;background:linear-gradient(90deg,transparent,color-mix(in oklab,var(--c-paper-2) 55%,transparent) 18%,color-mix(in oklab,var(--c-paper-2) 55%,transparent) 82%,transparent)}
html[data-scenes-debug] .sc-hot{outline:2px solid #f0f;background:rgba(255,0,255,.12)}
html[data-scenes-debug] .sc-hot::before{content:attr(data-hot);position:absolute;left:0;top:-18px;font:12px/1 monospace;color:#f0f;background:#000}
html[data-scenes-debug] .sc-hot-laptop-screen>*{opacity:.35}
`;
