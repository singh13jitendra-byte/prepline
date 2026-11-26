/**
 * <World /> — Package 1. Everything fixed that is not an act: the chapter
 * backdrop and grain, the field (CSS first, then WebGL over it), the Line and
 * the reading lens. Mounted once by <StoryRoot world={<World />}>.
 *
 * It returns a fragment of fixed elements placed with --z-backdrop, --z-world,
 * --z-line and --z-nav; there is no wrapper, so the act sections and the Actor
 * interleave with these layers exactly as storyboard 5.1 stacks them.
 *
 * Reduced motion and no-JS: every layer here is `.only-motion`, so none of it
 * renders. The static page gets two things from the rules below instead: a dot
 * texture in the night panels, and the line as a still rule under "ready.".
 */

import { ChapterBackdrop } from "./ChapterBackdrop";
import { CssField, STATIC_DOTS } from "./CssField";
import { Lens } from "./Lens";
import { Line } from "./Line";
import { WorldCanvas } from "./WorldCanvas";

const CSS = `
.world-night,.world-day,.world-grain{position:fixed;inset:0;z-index:var(--z-backdrop);pointer-events:none}
.world-night{background:radial-gradient(120% 95% at 50% 38%,var(--art-night-glow) 0%,var(--c-night) 42%,var(--c-night-2) 100%)}
.world-day{background:var(--c-paper);visibility:hidden}
.world-day[data-mode="day"]{visibility:visible}
.world-day[data-mode="split"]{visibility:visible;clip-path:inset(var(--day-top) 0 0 0)}
.world-grain{background-size:128px 128px;background-image:var(--tex-night)}
html[data-chapter="day"] .world-grain{background-image:var(--tex-paper)}

.world-canvas{position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;z-index:var(--z-world);pointer-events:none;opacity:0;transition:opacity .4s linear}
html.world-on .world-canvas{opacity:1}

.cf{position:fixed;inset:0;z-index:var(--z-world);pointer-events:none;transition:opacity .9s linear,visibility 0s linear .9s}
.cf{background-color:var(--art-speck)}
.cf-dust{opacity:.17;background-color:var(--c-dim)}
.cf-dense{opacity:.8}
.cf-grid-dim{opacity:.16;background-color:var(--c-dim)}
.cf-gold{background:none}
.cf-grid,.cf-grid-dim,.cf-gold{visibility:hidden}
html[data-beat]:not([data-beat="hero"],[data-beat="pass1"]) .cf-dense{visibility:hidden}
html[data-beat="pass1"] .cf-dense{clip-path:inset(var(--line-y) 0 0 0)}
html:is([data-beat="pass1"],[data-beat="pass2"]) .cf-grid{visibility:visible;clip-path:inset(0 0 calc(100% - var(--line-y)) 0)}
html[data-beat="pass2"] :is(.cf-grid-dim,.cf-gold){visibility:visible;clip-path:inset(var(--line-y) 0 0 0)}
html:is([data-beat="ranked"],[data-beat="reason"],[data-beat="daybreak"]) .cf-grid-dim{visibility:visible}
html[data-wipe] .cf{clip-path:inset(0 0 calc(100% - var(--day-top)) 0)}
html[data-chapter="day"]:not([data-wipe]) .cf{visibility:hidden}
html.world-on .cf{opacity:0;visibility:hidden}

.world-line{position:fixed;top:0;left:0;width:100%;height:100%;z-index:var(--z-line);pointer-events:none;overflow:visible;transition:color .25s linear}
.world-line-glow{mix-blend-mode:plus-lighter}
.world-line-label{position:fixed;top:0;left:0;z-index:var(--z-line);pointer-events:none;white-space:nowrap;line-height:11px;transition:color .25s linear;will-change:transform,opacity}

.world-lens{position:fixed;top:0;left:0;z-index:var(--z-nav);pointer-events:none;border-radius:var(--r-round);border:1px solid var(--c-on-night);will-change:transform,opacity}
.world-lens-label{position:fixed;top:0;left:0;z-index:var(--z-nav);pointer-events:none;white-space:nowrap;font-family:var(--font-mono);font-variant-numeric:var(--mono-numeric);font-size:var(--fs-micro);line-height:1;color:color-mix(in oklab,var(--c-on-night) 88%,transparent);background:color-mix(in oklab,var(--c-night-2) 74%,transparent);border:1px solid var(--c-rule-night);border-radius:calc(var(--r-xs) * 7 / 6);padding:6px 8px;will-change:transform,opacity}

/* Chrome stops presenting the canvas once an opaque footer covers about a third of the viewport
   (seen headless at the page bottom: the seat specks and the dawn vanish above the footer).
   A footer that is not fully opaque is not treated as an occluder; 0.4% is invisible on ink. */
html.world-on footer.ft{background-color:color-mix(in oklab,var(--c-footer) 99.6%,transparent)}
/* No WebGL: the seats still look taken. A CSS pin in each ring, where the world would leave a speck. */
html.motion:not(.world-on) .seat-ring::before{content:"";position:absolute;inset:31%;border-radius:var(--r-round);background:var(--c-accent);opacity:.92}
html:not(.motion) .story-stage[data-chapter="night"]{isolation:isolate}
html:not(.motion) .story-stage[data-chapter="night"]::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-color:var(--art-speck);-webkit-mask-image:${STATIC_DOTS};mask-image:${STATIC_DOTS}}
html:not(.motion) [data-anchor="hero-underline"]{background:var(--c-accent-night);min-height:2px;border-radius:var(--r-2xs)}
html:not(.motion) [data-anchor="ready-underline"]{background:var(--c-accent);min-height:2px;border-radius:var(--r-2xs)}
`;

export function World() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ChapterBackdrop />
      <CssField />
      <WorldCanvas />
      <Line />
      <Lens />
    </>
  );
}
