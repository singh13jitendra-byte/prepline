/**
 * <World /> — everything fixed that is not an act. Round 4, the painted world:
 *
 *   ChapterBackdrop   pine night and cream day (the day clipped at the Line), and the grain
 *   Scenes            the paintings: the room, the meadow through its window, the dawn
 *   CssField          no-WebGL stand-in for the fireflies, in the meadow beats only
 *   WorldCanvas       the fireflies (WebGL, one draw call, lazy)
 *   Line              the hand-drawn Line and its margin note
 *   PaperFold         daybreak: the night peels up along the rising Line like a sheet of paper (delight 5)
 *   Lumi              the companion firefly (components/lumi): it walks the story, and its light is the
 *                     lantern the fireflies answer (the cursor lantern is retired)
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
import { Lumi } from "@/components/lumi/Lumi";
import { Line } from "./Line";
import { PaperFold } from "./PaperFold";
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
/* The explore stop (?explore=1): the twelve hold as at the end of pass 2 until the 3D meadow takes over (ExploreStage fades them). */
html[data-beat="explore"] .cf-gold{visibility:visible}
html.world-on .cf{display:none}

.world-line{position:fixed;top:0;left:0;width:100%;height:100%;z-index:var(--z-line);pointer-events:none;overflow:visible;transition:color .25s linear}
.world-line path{stroke-width:var(--art-stroke,3px)}
.world-line-under{transform:translateY(1.5px);stroke-width:1.5px!important;transition:opacity .2s linear}
.world-line-label{position:fixed;top:0;left:0;z-index:var(--z-line);pointer-events:none;white-space:nowrap;font-family:var(--font-accent);font-size:15px;font-weight:500;line-height:20px;letter-spacing:0;text-transform:none;transform-origin:100% 100%;clip-path:inset(-6px 100% -6px -6px);will-change:transform}
.world-line-label[data-on]{clip-path:inset(-6px -6px -6px -6px);transition:clip-path .3s var(--ease-out,ease-out)}

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
      {/* Before the canvas: Lumi's pool shares its layer (--z-world) and the fireflies draw over it. */}
      <Lumi />
      <WorldCanvas />
      <Line />
      {/* Over the acts, under the Actor (same z-index, later in the DOM) and the Line. */}
      <PaperFold />
    </>
  );
}
