"use client";

/**
 * Beat 1, `hero` (storyboard 2.3 load, 2.4 beat 1).
 *
 * Night Desk (round 4). The copy sits over the painted room's left wall and
 * leaves the window and the laptop (the World's scene) clear.
 *
 * Load (time only, never blocks scroll): headline lines rise from their masks
 * (expo.out 0.9s, 60ms apart); "ready." arrives in lamp ink; the underline (the
 * `hero-underline` anchor, drawn by the hand-drawn Line) grows left to right;
 * then the rest rises (subline, form, privacy note), and the scroll cue fades in.
 * Any scroll during the load snaps it to its end state.
 *
 * Scroll (scrubbed, linear): 0 → 22% the copy around the headline drops 24px and
 * fades while the Line stretches to full width; 22 → 100% the Line rises and the
 * hero copy is clipped at it, so the headline is erased from the bottom up.
 * (The counter below the Line is revealed by ReadPanel at the same moment.)
 */

import { useLayoutEffect, useRef } from "react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Panel } from "@/components/story/Stage";
import { storyCopy } from "@/lib/content";
import { useAnchor } from "@/lib/anchors";
import { gsap } from "@/lib/gsap";
import { BEATS, story } from "@/lib/story";
import { span, useScrub } from "./runtime";
import { ease } from "@/lib/theme";

const copy = storyCopy.hero;
const HERO_INDEX = BEATS.findIndex((b) => b.id === "hero");

export function HeroPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const underline = useAnchor("hero-underline");

  /* ── load sequence ── */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
    const lines = q("[data-line]");
    const ready = q("[data-ready]");
    const under = q("[data-underline]");
    const rises = q("[data-rise]");
    const chrome = q("[data-fade-in]");
    // Hand over from the CSS initial state before GSAP reads any transform.
    root.setAttribute("data-loaded", "");
    gsap.set(lines, { y: 0 });

    const tl = gsap.timeline({ defaults: { ease: ease.out } });
    tl.fromTo(rises[0], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.04)
      .fromTo(lines, { yPercent: 108 }, { yPercent: 0, duration: 0.9, stagger: 0.06 }, 0.1)
      // "ready." arrives in lamp ink (no blur in this theme), then the pen draws the Line under it.
      .fromTo(ready, { opacity: 0, yPercent: 14 }, { opacity: 1, yPercent: 0, duration: 0.7, ease: ease.outSoft }, 0.36)
      .fromTo(under, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: ease.inOutFirm }, 0.62)
      // Then the rest: subline, form, privacy note, scroll cue.
      .fromTo(rises.slice(1), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08 }, 0.9)
      .fromTo(chrome, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: ease.outSoft }, 1.2);

    // Scrolling during the load snaps it to the end.
    const off = story.subscribe((s) => {
      if (s.pos > 0.2 || BEATS.findIndex((b) => b.id === s.beat) > HERO_INDEX) {
        tl.progress(1);
        off();
      }
    });
    tl.eventCallback("onComplete", () => off());
    return () => {
      off();
      tl.kill();
    };
  }, []);

  /* ── scrub: the drop, the erase ── */
  useScrub((s) => {
    const root = rootRef.current;
    if (!root) return;
    const i = BEATS.findIndex((b) => b.id === s.beat);
    const h = i < HERO_INDEX ? 0 : i > HERO_INDEX ? 1 : s.beatProgress;
    // The 85-unit hero (Foundation round 4): the Line stretches over 0–0.16 while the copy around
    // the headline drops; it holds on the underline through the push (0.16–0.5), so the headline
    // stays exactly still; then it rises over 0.5–1 and erases the headline.
    const k = span(h, 0, 0.16);
    // Only when a value changes: an unchanged write still marks the whole hero for restyle.
    const set = (prop: string, v: string) => {
      if (root.style.getPropertyValue(prop) !== v) root.style.setProperty(prop, v);
    };
    set("--drop", k.toFixed(4));
    set("--cue", (1 - span(h, 0, 0.1)).toFixed(4));
    // The hold (0.16–0.5): the headline stays exactly still (the Line rests on its underline), but
    // "Close the / other tabs." quietly dims, so the scroll is never dead and "Walk in ready." is left lit.
    set("--hold", span(h, 0.16, 0.5).toFixed(4));
    // The Line erases the headline from the bottom up through a 24px soft edge (it inks out,
    // it is not guillotined), while the headline steps back: scale 1 → 0.96, 40% dimmer.
    const e = span(h, 0.5, 1);
    set("--recede", e.toFixed(4));
    const y = s.line.y;
    // Past the hero the headline is fully erased: one constant mask, so the line moving through the
    // rest of the page never touches (and restyles) the hero again.
    const mask = i > HERO_INDEX ? "linear-gradient(transparent, transparent)" : h > 0.5 ? `linear-gradient(to bottom, black ${(y - 24).toFixed(1)}px, transparent ${y.toFixed(1)}px)` : "none";
    if (root.dataset.mask !== mask) {
      root.dataset.mask = mask;
      root.style.setProperty("--hero-mask", mask);
    }
  });

  const [l1, l2, l3] = copy.h1;
  return (
    <Panel beats="hero" focusable at={0} className="rd-hero">
      <div ref={rootRef} className="rd-hero-root">
        <div className="rd-hero-layer">
          <div className="rd-grid rd-hero-grid">
            <div className="rd-hero-copy">
              <div className="rd-drop">
                <p className="rd-pill" data-rise>
                  <span className="rd-pill-dot" aria-hidden="true" />
                  {copy.pill}
                </p>
              </div>
              <h1 id="read-title" className="rd-h1">
                <span className="sr-only">{copy.h1Full}</span>
                <span className="rd-h1-vis" aria-hidden="true">
                  <span className="rd-mask">
                    <span className="rd-line" data-line>
                      {l1}
                    </span>
                  </span>
                  <span className="rd-mask">
                    <span className="rd-line" data-line>
                      {l2}
                    </span>
                  </span>
                  <span className="rd-line3">
                    <span className="rd-mask rd-mask-inline">
                      <span className="rd-line" data-line>
                        {l3}
                      </span>
                    </span>{" "}
                    <span className="rd-ready" data-ready>
                      {copy.h1Accent}
                      <span ref={underline} className="rd-underline" data-underline />
                    </span>
                  </span>
                </span>
              </h1>
              <div className="rd-drop">
                <p className="rd-sub" data-rise>
                  {copy.sub}
                </p>
                <div className="rd-form" data-rise>
                  {/* No glass: read.css restyles this tone to the Night Desk field (deep well, sage keyline, lamp button). */}
                  <WaitlistForm tone="glass" />
                </div>
                <p className="rd-privacy" data-rise>
                  {copy.privacy}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="rd-cue only-motion" aria-hidden="true">
          <span className="rd-cue-in" data-fade-in>
            {copy.scrollCue}
          </span>
        </p>
      </div>
    </Panel>
  );
}
