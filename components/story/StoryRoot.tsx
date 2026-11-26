"use client";

/**
 * STORY ROOT — mounted once in app/page.tsx. It owns the fixed layers and wires
 * the page to the story store.
 *
 *   <StoryRoot world={<World />} chrome={<><Nav /><BeatRail /></>}>
 *     <ActRead />
 *     <ActBoard />
 *     <ActPrep />
 *     <ActSeat />
 *   </StoryRoot>
 *
 * DOM order is world, chrome, acts, Actor: chrome comes before the acts so the
 * nav and beat rail are reached by Tab before the story's controls. `world` and
 * `chrome` are each wrapped in a <LineScope> (display: contents), which is where
 * --line-y / --day-top are written. The nav <header> is a page landmark and
 * lives outside <main> in app/page.tsx, in its own <LineScope>.
 *
 * Layer order (storyboard 5.1), by the --z-* variables in globals.css:
 *   world    ChapterBackdrop (--z-backdrop) and WorldCanvas (--z-world), fixed, behind the acts
 *   children the four act sections in document flow (--z-acts)
 *   Actor    fixed, aria-hidden, inert (--z-actor); mounted here
 *   world    the Line (--z-line) is part of <World /> too: give it that z-index
 *   chrome   beat rail, lens label (--z-nav)
 * Fixed layers must not create a wrapper with its own stacking context, or the
 * z-order above breaks: return a fragment of fixed elements.
 *
 * What it does on mount (motion mode)
 * - starts the store's frame loop on gsap.ticker;
 * - creates one ScrollTrigger per act section (`start: "top top"`,
 *   `end: "bottom bottom"`, no pin, no scrub) plus one for the footer tail,
 *   each reporting progress to the store;
 * - on beat change, toggles `data-active` on stages and `data-current` / `inert`
 *   on panels (no React render);
 * - routes same-page hash links to an act (#read, #board, #prep, #join) through
 *   story.scrollToAct, so they land inside a beat instead of on a section top;
 * - scrolls a beat into place when focus lands in a panel that is not current;
 * - loads the debug overlay when the URL has ?debug=1.
 *
 * Under reduced motion none of that runs: the page is static HTML and CSS.
 * `window.__story` exposes the store for the check script and the console.
 */

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { webglAvailable } from "@/lib/gl";
import { ScrollTrigger } from "@/lib/gsap";
import { ACTOR_TRACK, ACTS, BEATS, beatOf, panelIsCurrent, stageIsActive, story, type ActId, type BeatId } from "@/lib/story";
import { Actor } from "./Actor";
import { LineScope } from "./LineScope";

/** World layers that read --day-top (and --day-side) in their own CSS. */
const WORLD_LINE_READERS = ".world-day, .sc-dawnwrap, .cf-dense, .cf-grid, .cf-gold, [data-line-vars]";
/** Of those, the ones that also read --line-y (it changes on almost every scroll frame). */
const WORLD_LINE_Y_READERS = ".cf-dense, .cf-grid, .cf-gold, [data-line-vars~='line-y']";

type Props = {
  children: ReactNode;
  /** Fixed world layers (backdrop, canvas, line). */
  world?: ReactNode;
  /** Fixed chrome above everything (beat rail, lens label). Wrap what splits at the line in its own <LineScope>. */
  chrome?: ReactNode;
};

export function StoryRoot({ children, world, chrome }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [DebugOverlay, setDebugOverlay] = useState<ComponentType | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = story.start({ gl: webglAvailable() });
    (window as unknown as { __story?: typeof story }).__story = story;

    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      import("./Debug").then((m) => setDebugOverlay(() => m.Debug)).catch(() => {});
    }

    if (!story.isRunning()) return stop;

    /* ── scroll → store ── */
    const triggers: ScrollTrigger[] = [];
    const sections = new Map<ActId, HTMLElement>();
    ACTS.forEach((act) => {
      const el = root.querySelector<HTMLElement>(`section[data-act="${act.id}"]`);
      if (!el) return;
      sections.set(act.id, el);
      const report = (self: ScrollTrigger) => story.feed(act.id, self.progress || 0, self.start, self.end, self.getVelocity());
      triggers.push(ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom bottom", onUpdate: report, onRefresh: report }));
    });
    const last = sections.get("seat");
    if (last) {
      const report = (self: ScrollTrigger) => story.feed("tail", self.progress || 0, self.start, self.end, self.getVelocity());
      triggers.push(ScrollTrigger.create({ trigger: last, start: "bottom bottom", end: "max", onUpdate: report, onRefresh: report }));
    }
    ScrollTrigger.refresh();

    /* ── beat → stages and panels ── */
    const apply = (beat: BeatId) => {
      root.querySelectorAll<HTMLElement>(".story-stage").forEach((el) => {
        el.toggleAttribute("data-active", stageIsActive(el.dataset.stage as ActId, beat));
      });
      root.querySelectorAll<HTMLElement>(".story-panel").forEach((el) => {
        const beats = (el.dataset.beats ?? "").split(" ") as BeatId[];
        const current = panelIsCurrent(beats, beat);
        el.toggleAttribute("data-current", current);
        el.inert = !current && !el.hasAttribute("data-focusable");
      });
    };
    apply(story.get().beat);
    const offBeat = story.onBeatChange(apply);

    /* ── wipes: clip each stage to its side of the line (inline, so no CSS variable restyles the acts) ── */
    const stages = [...root.querySelectorAll<HTMLElement>(".story-stage")].map((el) => ({ el, night: el.dataset.chapter === "night", last: "" }));
    const offClip = story.subscribe((s) => {
      const wipe = beatOf(s.beat).kind === "wipe";
      for (let i = 0; i < stages.length; i++) {
        const st = stages[i];
        // Only the two stages on screen are clipped: a hidden stage needs no write.
        const clip = !wipe || !st.el.hasAttribute("data-active") ? "" : st.night ? `inset(0 0 ${Math.max(0, s.viewport.h - s.dayTop).toFixed(1)}px 0)` : `inset(${s.dayTop.toFixed(1)}px 0 0 0)`;
        if (clip !== st.last) st.el.style.clipPath = st.last = clip;
      }
    });

    /* ── focus → scroll its beat into place ── */
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      const panel = target?.closest<HTMLElement>(".story-panel");
      if (!panel || panel.hasAttribute("data-current")) return;
      const beats = (panel.dataset.beats ?? "").split(" ").filter(Boolean) as BeatId[];
      // Land where the focused thing is actually on screen. A control inside a docked face (the
      // prep sheet's vote buttons, the ticket's form) is only visible on the beats where the
      // Actor rests on that face: go to the first of those, not to the panel's first beat,
      // which may be a wipe or a beat where the face has not arrived yet.
      const slot = target?.closest<HTMLElement>(".face-slot")?.dataset.anchor;
      const rest = slot ? BEATS.find((b) => ACTOR_TRACK[b.id]?.dock && ACTOR_TRACK[b.id]?.from === slot && ACTOR_TRACK[b.id]?.to === slot)?.id : undefined;
      const beat = rest ?? beats.find((b) => beatOf(b).kind !== "wipe") ?? beats[0];
      if (beat) story.scrollToBeat(beat, Number(panel.dataset.at ?? 0.6), { duration: 0.9 });
    };
    root.addEventListener("focusin", onFocusIn);

    /* ── hash links → acts ── */
    const actForHash = (hash: string) => ACTS.find((a) => `#${a.domId}` === hash);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href^='#']");
      const act = link && actForHash(link.getAttribute("href") ?? "");
      if (!act) return;
      e.preventDefault();
      story.scrollToAct(act.id);
      history.replaceState(null, "", `#${act.domId}`);
      // Move keyboard focus with the scroll (skip link).
      const section = sections.get(act.id);
      if (section) {
        section.tabIndex = -1;
        section.focus({ preventScroll: true });
      }
    };
    document.addEventListener("click", onClick);

    // A deep link (/#join) lands inside the beat too.
    const initial = actForHash(window.location.hash);
    const raf = initial ? requestAnimationFrame(() => story.scrollToAct(initial.id, { immediate: true })) : 0;

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      root.removeEventListener("focusin", onFocusIn);
      offBeat();
      offClip();
      stages.forEach((st) => (st.el.style.clipPath = ""));
      triggers.forEach((t) => t.kill());
      stop();
    };
  }, []);

  return (
    <div ref={rootRef} className="story-root">
      {/* The world is hundreds of nodes (painted scenes, the laptop's live list). The line variables go
          only to the few layers whose own rules read them: the day backdrop and the dawn scene split at
          --day-top; the no-WebGL field layers clip at --line-y. A new reader must be added here. */}
      <LineScope targets={WORLD_LINE_READERS} lineY={WORLD_LINE_Y_READERS}>
        {world}
      </LineScope>
      {/* Before the acts in the DOM, so chrome comes first in the tab order. Painting order is by z-index. */}
      {chrome}
      {children}
      <Actor />
      {DebugOverlay ? <DebugOverlay /> : null}
    </div>
  );
}
