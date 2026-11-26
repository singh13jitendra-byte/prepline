import fs from "node:fs";
import path from "node:path";
import type { CSSProperties } from "react";
import { LaptopScreen } from "./LaptopScreen";
import { SceneDirector } from "./SceneDirector";
import { DESK, FOCUS, HOTSPOTS, WINDOW_FILES, WINDOW_LAYERS, WINDOW_SKY, SCENE_FALLBACK, SCENE_GROUND, SCENE_NAMES, type HotspotId, type Rect, type SceneEntry, type SceneManifest, type SceneName } from "./sceneGeometry";

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
 *    pushes through it, and a second, differently painted frame on top of it read as a prop.
 *    Delight 4 cuts that painted window into layers instead: see WindowRig.)
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

/** The formats a scene was encoded in (manifest `formats`; older manifests: AVIF + WebP, or WebP only with alpha). */
const formatsOf = (m: SceneEntry) => m.formats ?? (m.alpha ? ["webp"] : ["avif", "webp"]);

function Picture({ name, manifest, eager, sizes }: { name: SceneName; manifest: SceneManifest; eager?: boolean; sizes: string }) {
  const m = manifest[name];
  if (!m.widths.length) return null;
  const largest = m.widths[m.widths.length - 1];
  const formats = formatsOf(m);
  // Held-back pictures carry their sources as data: SceneDirector hands them over once the hero has painted.
  const set = (value: string) => (eager ? { srcSet: value } : { "data-srcset": value });
  return (
    <picture>
      {formats.includes("avif") ? <source type="image/avif" sizes={sizes} {...set(srcset(name, m.widths, "avif"))} /> : null}
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

/**
 * `sizes` per layer: the width the layer is drawn at, at its largest scale on screen, so the
 * browser picks the native 2048 export wherever a screen can use it. A cover box is
 * max(100vw, 100vh × 16/9). The room is pushed to 2.4× in the hero (SceneDirector, ROOM_MAX),
 * so it asks for 1.6× cover (on a 1x screen that is already the 2048); the meadow starts the
 * hand-off at 1.16×.
 */
const SIZES: Record<SceneName, string> = {
  "desk-night": "max(160vw, 284vh)",
  "meadow-night": "max(116vw, 207vh)",
  "desk-bluehour": "max(136vw, 242vh)",
  "desk-dawn": "max(136vw, 242vh)",
  "grass-fg": "max(100vw, 178vh)",
  "window-frame": "max(100vw, 178vh)",
};

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
      <Picture name={name} manifest={manifest} eager={eager} sizes={SIZES[name]} />
      {children}
    </div>
  );
}

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
/** A rect of desk-night (source px) as a box inside its layer, in percentages. */
const rectStyle = (r: Rect): CSSProperties => ({ left: pct(r.x0, DESK.w), top: pct(r.y0, DESK.h), width: pct(r.x1 - r.x0, DESK.w), height: pct(r.y1 - r.y0, DESK.h) });

function Hotspot({ id, children }: { id: HotspotId; children?: React.ReactNode }) {
  return (
    <div className={`sc-hot sc-hot-${id}`} data-hot={id} style={rectStyle(HOTSPOTS[id])}>
      {children}
    </div>
  );
}

/** A held-back alpha layer cut from desk-night (scenes/derive-window.py), drawn 1:1 over its own pixels. */
function Cut({ src, rect, className, fill }: { src: string; rect: Rect; className: string; fill?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`sc-wimg ${className}`} alt="" width={rect.x1 - rect.x0} height={rect.y1 - rect.y0} decoding="async" draggable={false} data-src={src} loading="lazy" style={fill ? undefined : rectStyle(rect)} />
  );
}

/**
 * THROUGH THE WINDOW (delight 4): the room's own painted window, in layers, inside the room layer
 * (so the room's push carries all of it with no per-frame work of its own):
 *   .sc-view    what is seen through the window (a static alpha mask in the painting's pixels),
 *               holding a second meadow-night that SceneDirector keeps exactly where the meadow
 *               layer is on screen: the meadow is revealed through the opening first, and when the
 *               room dissolves under it the two coincide, so nothing in the window changes.
 *   .sc-pane    the two casements, swinging a few degrees wider on their hinges as we pass; a soft
 *               lamp glint slides once across their glass. Not on phones (the view mask there keeps
 *               the painted casements and replaces only their glass).
 *   .sc-front   the lamp, in front of the casements and of the meadow beyond.
 * Hidden (visibility) until SceneDirector has every picture and mask decoded, and at rest.
 */
function WindowRig({ manifest }: { manifest: SceneManifest }) {
  const meadow = manifest["meadow-night"];
  if (!manifest["desk-night"].widths.length || !meadow.widths.length) return null;
  if (!Object.values(WINDOW_FILES).every((f) => fs.existsSync(path.join(process.cwd(), "public", f)))) return null;
  const style = { "--mar": (meadow.width / meadow.height).toFixed(5) } as CSSProperties;
  return (
    <div className="sc-win" data-win>
      <div className="sc-view" style={rectStyle(WINDOW_LAYERS.view)}>
        <div className="sc-view-meadow" style={style}>
          <Picture name="meadow-night" manifest={manifest} sizes={SIZES["meadow-night"]} />
          <div className="sc-hush sc-hush-meadow" />
        </div>
      </div>
      <div className="sc-pane sc-pane-l" style={rectStyle(WINDOW_LAYERS.paneL)}>
        <Cut src={WINDOW_FILES.paneL} rect={WINDOW_LAYERS.paneL} className="sc-pane-img" fill />
        <div className="sc-glass sc-glass-l">
          <div className="sc-glint" />
        </div>
      </div>
      <div className="sc-pane sc-pane-r" style={rectStyle(WINDOW_LAYERS.paneR)}>
        <Cut src={WINDOW_FILES.paneR} rect={WINDOW_LAYERS.paneR} className="sc-pane-img" fill />
        <div className="sc-glass sc-glass-r">
          <div className="sc-glint" />
        </div>
      </div>
      <Cut src={WINDOW_FILES.front} rect={WINDOW_LAYERS.front} className="sc-front" />
    </div>
  );
}

/**
 * THE HUSH (round 5, review P1-2): the paintings came with fireflies painted in, and those must
 * not compete with the 2,340 that are the roles. The plates cannot be repainted, so the painted
 * lights are quieted where the roles fly:
 *   - a highlight knee on the meadow (an SVG transfer filter, sRGB): every channel above 0.5 is
 *     compressed, so the painted dots lose their glare while grass, hills and sky are untouched.
 *     It is a paint-time effect inside the layer, rastered once: no per-frame cost.
 *   - a soft local darkening (.sc-hush) over the sky/grass band of the meadow and over the
 *     window's sky in the room, under the canvas.
 * Only the WebGL fireflies reach full brightness, so going out and staying lit both read.
 */
function Hush() {
  return (
    <svg className="sc-defs" width="0" height="0" focusable="false">
      <filter id="sc-knee" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0 0.25 0.5 0.6 0.64" />
          <feFuncG type="table" tableValues="0 0.25 0.5 0.6 0.64" />
          <feFuncB type="table" tableValues="0 0.25 0.5 0.6 0.64" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}

/** Static-page stills (reduced motion, no JS): the same paintings as plain panel backgrounds. */
export function sceneStillCss(): string {
  const manifest = readManifest();
  const still = (name: SceneName) => {
    const m = manifest[name];
    if (!m.widths.length) return null;
    const w = m.widths[m.widths.length - 1];
    return !formatsOf(m).includes("avif") ? `url(/scenes/${name}-${w}.webp)` : `image-set(url(/scenes/${name}-${w}.avif) type("image/avif"),url(/scenes/${name}-${w}.webp) type("image/webp"))`;
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
      <Hush />
      <Layer name="meadow-night" manifest={manifest} className="sc-meadow" focus="meadow">
        <div className="sc-hush sc-hush-meadow" />
      </Layer>
      <Layer name="desk-night" manifest={manifest} className="sc-room" focus="room" eager>
        <div className="sc-hush sc-hush-window" style={rectStyle(WINDOW_SKY)} />
        <WindowRig manifest={manifest} />
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
.sc-defs{position:absolute;width:0;height:0;overflow:hidden}
.sc-meadow .sc-img{filter:url(#sc-knee)}
.sc-hush{position:absolute;pointer-events:none}
.sc-hush-meadow{inset:0;background:radial-gradient(ellipse 70% 42% at 50% 62%,color-mix(in oklab,var(--c-night) 34%,transparent),color-mix(in oklab,var(--c-night) 18%,transparent) 70%,transparent)}
.sc-hush-window{background:radial-gradient(ellipse 60% 60% at 50% 50%,color-mix(in oklab,var(--c-night) 30%,transparent),color-mix(in oklab,var(--c-night) 12%,transparent) 80%,transparent)}
.sc-laptop{position:absolute;inset:0;overflow:hidden}
.sc-laptop-list{position:absolute;left:0;top:0;transform-origin:0 0}
.sc-grass{background-image:none!important}
/* The grass is painted in daylight: at night it is in shadow. */
.sc-grasswrap[data-night] .sc-grass{filter:brightness(.42) saturate(.7) hue-rotate(28deg)}
.sc-dawnwrap{visibility:hidden}
/* Off: its layers keep the inline visibility:visible SceneDirector gave them in the seat, which beat
   the wrapper's hidden and left desk-dawn over blue hour and the votes when scrolling back up. */
.sc-dawnwrap[data-mode="off"]>*{visibility:hidden!important}
.sc-grasswrap{display:none}
.sc-dawnwrap[data-mode="day"]{visibility:visible}
.sc-dawnwrap[data-mode="split"]{visibility:visible;clip-path:inset(var(--day-top) 0 0 0)}
.sc-grasswrap{overflow:visible;contain:layout style}
.sc-grass{top:auto;bottom:0}
.sc-hot{position:absolute}
/* Through the window (delight 4): every rect is in the painting's own pixels, so it rides the room's transform. */
.sc-win{position:absolute;inset:0;visibility:hidden;pointer-events:none}
.sc-view{position:absolute;overflow:hidden;opacity:0;will-change:opacity;-webkit-mask:url(/scenes/window-view.webp) 0 0/100% 100% no-repeat;mask:url(/scenes/window-view.webp) 0 0/100% 100% no-repeat}
.sc-view-meadow{position:absolute;left:0;top:0;--mw:max(100vw,calc(100lvh * var(--mar)));width:var(--mw);height:calc(var(--mw) / var(--mar));transform-origin:0 0;will-change:transform}
.sc-view-meadow .sc-img{filter:url(#sc-knee)}
.sc-wimg{position:absolute;display:block;user-select:none}
.sc-pane{position:absolute;will-change:transform;backface-visibility:hidden}
.sc-pane-l{transform-origin:0 50%}
.sc-pane-r{transform-origin:100% 50%}
.sc-pane-img{inset:0;width:100%;height:100%}
/* The glint: lamp light caught on the glass as the casement turns. Feathered on both sides, never a slab. */
.sc-glass{position:absolute;inset:0;overflow:hidden;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}
.sc-glass-l{-webkit-mask-image:url(/scenes/window-glass-l.webp);mask-image:url(/scenes/window-glass-l.webp)}
.sc-glass-r{-webkit-mask-image:url(/scenes/window-glass-r.webp);mask-image:url(/scenes/window-glass-r.webp)}
.sc-glint{position:absolute;top:-10%;left:-150%;width:400%;height:120%;opacity:0;will-change:transform,opacity;background:linear-gradient(58deg,transparent 43%,color-mix(in oklab,var(--art-glow) 6%,transparent) 47%,color-mix(in oklab,var(--art-glow) 34%,transparent) 49.6%,color-mix(in oklab,var(--art-glow) 34%,transparent) 50.4%,color-mix(in oklab,var(--art-glow) 6%,transparent) 53%,transparent 57%)}
@media (max-width:767px){
/* Phones: the room is smaller than the screen at rest, so its top edge shows as the push lifts it; feathered, never a hard line. */
.sc-room{-webkit-mask-image:linear-gradient(transparent,var(--c-night) 7%);mask-image:linear-gradient(transparent,var(--c-night) 7%)}
.sc-view{-webkit-mask-image:url(/scenes/window-view-glass.webp);mask-image:url(/scenes/window-view-glass.webp)}
.sc-pane{display:none}
}
.sc-hot-laptop-screen{overflow:hidden;contain:strict;border-radius:calc(var(--r-2xs,2px) * 1.5);background:var(--c-paper-2);opacity:0;transition:opacity .6s linear}
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
html[data-scenes-debug] .sc-hot{outline:2px solid #f0f;background:rgba(255,0,255,.12)} /* token-ok: ?scenes=debug overlay only */
html[data-scenes-debug] .sc-hot::before{content:attr(data-hot);position:absolute;left:0;top:-18px;font:12px/1 monospace;color:#f0f;background:#000} /* token-ok: ?scenes=debug overlay only */
html[data-scenes-debug] .sc-hot-laptop-screen>*{opacity:.35}
`;
