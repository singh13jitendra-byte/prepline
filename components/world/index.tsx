/**
 * <World /> — everything fixed that is not an act. Round 4, the painted world:
 *
 *   ChapterBackdrop   pine night and cream day (the day clipped at the Line), and the grain
 *   Scenes            the paintings: the room, the meadow through its window, the dawn
 *   CssField          no-WebGL stand-in for the fireflies, in the meadow beats only
 *   WorldCanvas       the fireflies (WebGL, one draw call, lazy)
 *   Line              the hand-drawn Line and its margin note
 *   Lantern           the cursor's warm pool in the night scenes, and the tag that names a firefly
 *
 * Mounted once by <StoryRoot world={<World />}>. It returns a fragment of fixed elements
 * placed with --z-backdrop, --z-world, --z-line and --z-nav (no wrapper), so the act
 * sections and the Actor interleave with these layers.
 *
 * Reduced motion and no-JS: every layer here is `.only-motion`, so none of it renders. The
 * static page gets the paintings as still panel backgrounds (Scenes.tsx, sceneStillCss) and
 * the line as a still rule under "ready.".
 */

import { ChapterBackdrop } from "./ChapterBackdrop";
import { CssField } from "./CssField";
import { Lantern } from "./Lantern";
import { Line } from "./Line";
import { SCENE_CSS, ScenesDay, ScenesNight, sceneStillCss } from "./Scenes";
import { WorldCanvas } from "./WorldCanvas";

const CSS = `
.world-night,.world-day,.world-grain{position:fixed;inset:0;z-index:var(--z-backdrop);pointer-events:none}
.world-night{background-color:var(--c-night);background-image:var(--tex-night);background-size:128px 128px}
.world-day{background-color:var(--c-paper);background-image:var(--tex-paper);background-size:128px 128px;visibility:hidden}
.world-day[data-mode="day"]{visibility:visible}
.world-day[data-mode="split"]{visibility:visible;clip-path:inset(var(--day-top) 0 0 0)}
/* The texture belongs to the flat grounds (pine, paper), under the paintings: never over them. */
.world-grain{display:none}
${SCENE_CSS}
.world-canvas{position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;z-index:var(--z-world);pointer-events:none;opacity:0;transition:opacity .4s linear}
html.world-on .world-canvas{opacity:1}
/* Delight 3: while the twelve fly into the list (ranked), the canvas sits over the acts and under the
   Actor, so they land on the paper. Toggled once at each end of the beat; only the twelve draw then. */
.world-canvas[data-lift]{z-index:var(--z-actor)}

/* No WebGL: the passes still read as many lights becoming few, in the meadow beats only. */
.cf{position:fixed;inset:0;z-index:var(--z-world);pointer-events:none;visibility:hidden;background-color:var(--c-line)}
.cf-dust{display:none}
.cf-dense{opacity:.5}
.cf-grid-dim{opacity:.18}
.cf-gold{background:none}
html[data-beat="pass1"] .cf-dense{visibility:visible;clip-path:inset(var(--line-y) 0 0 0)}
html:is([data-beat="pass1"],[data-beat="pass2"]) .cf-grid{visibility:visible;clip-path:inset(0 0 calc(100% - var(--line-y)) 0)}
html[data-beat="pass2"] .cf-gold{visibility:visible;clip-path:inset(var(--line-y) 0 0 0)}
html.world-on .cf{display:none}

.world-line{position:fixed;top:0;left:0;width:100%;height:100%;z-index:var(--z-line);pointer-events:none;overflow:visible;transition:color .25s linear}
.world-line path{stroke-width:var(--art-stroke,3px)}
.world-line-under{transform:translateY(1.5px);stroke-width:1.5px!important;transition:opacity .2s linear}
.world-line-label{position:fixed;top:0;left:0;z-index:var(--z-line);pointer-events:none;white-space:nowrap;font-family:var(--font-accent);font-size:15px;font-weight:500;line-height:20px;letter-spacing:0;text-transform:none;transform-origin:100% 100%;clip-path:inset(-6px 100% -6px -6px);will-change:transform}
.world-line-label[data-on]{clip-path:inset(-6px -6px -6px -6px);transition:clip-path .3s var(--ease-out,ease-out)}

/* The lantern (Lantern.tsx). The pool: lamp light, screen-blended over the painting, under the copy.
   Moved by transform only; it breathes on the compositor. Nothing else on the page is restyled by it. */
.lantern{position:fixed;top:0;left:0;width:380px;height:380px;z-index:var(--z-world);pointer-events:none;mix-blend-mode:screen;visibility:hidden;opacity:0;will-change:transform,opacity;contain:strict}
.lantern[data-on]{visibility:visible}
.lantern-pool{position:absolute;inset:0;border-radius:var(--r-round);background:radial-gradient(closest-side,color-mix(in oklab,var(--art-lamp-deep) 30%,transparent) 0%,color-mix(in oklab,var(--art-lamp-deep) 15%,transparent) 30%,color-mix(in oklab,var(--art-lamp-deep) 5%,transparent) 62%,transparent 100%);animation:lantern-breathe 5.2s var(--ease-in-out-sym) infinite alternate}
.lantern:not([data-on]) .lantern-pool{animation-play-state:paused}
@keyframes lantern-breathe{from{transform:scale(.95);opacity:.86}to{transform:scale(1.04);opacity:1}}
/* The tag: a 0x0 point on the firefly, a 1px leader drawn out of it, a night slip at its end. */
.lantern-tag{position:fixed;top:0;left:0;width:0;height:0;z-index:var(--z-line);pointer-events:none;visibility:hidden;transition:visibility 0s linear .2s;--lr:-38deg;--lead:var(--c-on-night-2)}
.lantern-tag[data-on]{visibility:visible;transition-delay:0s}
.lantern-tag[data-verdict="kept"]{--lead:var(--art-lamp)}
.lantern-tag:is([data-side="nw"],[data-side="se"]){--lr:38deg}
.lantern-leader{position:absolute;left:4px;top:0;width:20px;height:1px;background:var(--lead);transform-origin:0 50%;transform:rotate(var(--lr)) scaleX(0);transition:transform var(--dur-1) var(--ease-out)}
.lantern-tag:is([data-side="nw"],[data-side="sw"]) .lantern-leader{left:auto;right:4px;transform-origin:100% 50%}
.lantern-tag[data-on] .lantern-leader{transform:rotate(var(--lr)) scaleX(1)}
.lantern-chip{position:absolute;left:20px;bottom:5px;display:flex;flex-direction:column;gap:2px;white-space:nowrap;font-family:var(--font-text);font-size:var(--fs-micro);line-height:var(--leading-micro);letter-spacing:0;font-variant-numeric:tabular-nums lining-nums;opacity:0;transform:scale(.97);transform-origin:0 100%;transition:opacity var(--dur-1) var(--ease-out) 40ms,transform var(--dur-2) var(--ease-out) 40ms}
.lantern-tag:is([data-side="nw"],[data-side="sw"]) .lantern-chip{left:auto;right:20px;transform-origin:100% 100%}
.lantern-tag:is([data-side="se"],[data-side="sw"]) .lantern-chip{bottom:auto;top:5px}
.lantern-tag[data-side="se"] .lantern-chip{transform-origin:0 0}
.lantern-tag[data-side="sw"] .lantern-chip{transform-origin:100% 0}
.lantern-tag[data-on] .lantern-chip{opacity:1;transform:none}
.lantern-role{color:var(--c-on-night);font-weight:var(--weight-label)}
.lantern-score:not(:empty)::before{content:" · ";font-weight:var(--weight-text);color:var(--c-on-night-2)}
.lantern-tag[data-verdict="kept"] .lantern-score{color:var(--c-match)}
.lantern-note{display:flex;align-items:center;gap:6px;color:var(--c-on-night-2)}
.lantern-tag[data-verdict="kept"] .lantern-note{color:var(--c-match)}
.lantern-dot{width:6px;height:6px;flex:none;border-radius:var(--r-round);background:var(--art-speck)}
.lantern-tag[data-verdict="kept"] .lantern-dot{background:var(--art-lamp)}
.lantern-tag[data-verdict="aside"] .lantern-dot{background:none;box-shadow:inset 0 0 0 1.5px var(--c-on-night-2)}
/* The hint: a margin note, once per session. */
.lantern-hint{position:fixed;top:0;left:0;z-index:var(--z-line);pointer-events:none;white-space:nowrap;font-family:var(--font-accent);font-size:var(--fs-small);font-weight:500;line-height:1.25;color:var(--c-on-night-2);rotate:var(--art-note-rotate);opacity:0;visibility:hidden;transition:opacity var(--dur-2) var(--ease-out),visibility 0s linear var(--dur-2)}
.lantern-hint[data-on]{opacity:1;visibility:visible;transition-delay:0s}
.lantern-hint[data-flip]{translate:-100% 0}

/* Chrome stops presenting the canvas once an opaque footer covers about a third of the viewport
   (the seat fireflies vanish above the footer). A footer that is not fully opaque is not
   treated as an occluder; 0.4% is invisible. */
html.world-on footer.ft{background-color:color-mix(in oklab,var(--c-footer) 99.6%,transparent)}
html:not(.motion) [data-anchor="hero-underline"]{background:var(--c-accent-night);min-height:2px;border-radius:var(--r-2xs)}
html:not(.motion) [data-anchor="ready-underline"]{background:var(--c-accent);min-height:2px;border-radius:var(--r-2xs)}
`;

export function World() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS + sceneStillCss() }} />
      <ChapterBackdrop night={<ScenesNight />} day={<ScenesDay />} />
      <CssField />
      {/* Before the canvas: the pool shares its layer (--z-world) and the fireflies draw over it. */}
      <Lantern />
      <WorldCanvas />
      <Line />
    </>
  );
}
