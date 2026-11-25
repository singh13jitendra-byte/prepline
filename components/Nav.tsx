"use client";

/**
 * NAV — floating pill with two skins, split at the line (storyboard 3 "Nav").
 *
 * - Clear over the hero, frosted from the first reading pass on.
 * - Night glass on night chapters, day paper on day chapters. During a wipe both
 *   skins are drawn and each is clipped at the line (--day-top), like the stages.
 *   The base copy is the real one (keyboard, screen readers); the second copy is
 *   aria-hidden and only there for the split.
 * - Hides upward while you scroll down through the hinge and the prep beats;
 *   comes back on any upward scroll, on keyboard focus, and near the top edge.
 * - Links to #board, #prep and #join are routed by StoryRoot into the right beat.
 * - Under 768px: logo, CTA and a menu button.
 */

import { useEffect, useRef, useState } from "react";
import { pkg3Copy, storyCopy } from "@/lib/content";
import { BEATS, story, type ActId, type BeatId } from "@/lib/story";
import { Magnetic } from "./Magnetic";
import "./cta.css";
import "./chrome.css";

const HIDE_IN: readonly BeatId[] = ["hinge", "nightfall", "unfold", "q1", "q2", "q3", "votes"];
const LINK_ACT: Record<string, ActId> = { "#board": "board", "#prep": "prep", "#join": "seat" };
const idx = (b: BeatId) => BEATS.findIndex((x) => x.id === b);

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="cta-arrow" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PillContent({ live, open, onMenu }: { live: boolean; open?: boolean; onMenu?: () => void }) {
  const t = live ? undefined : -1;
  return (
    <>
      <a href="#read" className="nav-brand" tabIndex={t} onClick={(e) => {
        e.preventDefault();
        story.scrollToBeat("hero", 0);
      }}>
        <span className="nav-logo" aria-hidden="true" />
        {storyCopy.nav.brand}
      </a>
      <nav aria-label={live ? pkg3Copy.landmarks.sections : undefined}>
        <ul className="nav-links">
          {storyCopy.nav.links.map((l) => (
            <li key={l.label}>
              <a href={l.href} className="nav-link" data-act={LINK_ACT[l.href]} tabIndex={t}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav-right">
        {live ? (
          <Magnetic strength={0.3}>
            <a href="#join" className="cta cta-ink">
              <span className="cta-label">
                {storyCopy.nav.cta}
                <Arrow />
              </span>
              <span className="cta-line" aria-hidden="true" />
            </a>
          </Magnetic>
        ) : (
          <span className="inline-flex">
            <a href="#join" className="cta cta-ink" tabIndex={-1}>
              <span className="cta-label">
                {storyCopy.nav.cta}
                <Arrow />
              </span>
              <span className="cta-line" aria-hidden="true" />
            </a>
          </span>
        )}
        <button
          type="button"
          className="nav-menu-btn"
          tabIndex={t}
          aria-label={live ? storyCopy.nav.menu : undefined}
          aria-expanded={live ? Boolean(open) : undefined}
          aria-controls={live ? "nav-menu" : undefined}
          onClick={onMenu}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

export function Nav() {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || story.reduced()) return;
    let hidden = false;
    let act = "";
    let travelled = 0;
    let lastPos = 0;
    const links = () => el.querySelectorAll<HTMLElement>(".nav-link[data-act]");
    return story.subscribe((s) => {
      // Hide on a real downward scroll inside the quiet beats; return on any upward scroll.
      const dPos = s.pos - lastPos;
      lastPos = s.pos;
      travelled = dPos > 0 ? travelled + dPos : 0;
      const nearTop = s.pointer.fine && s.pointer.inside && s.pointer.y < 72;
      let want = hidden;
      if (!HIDE_IN.includes(s.beat) || nearTop || dPos < -0.05) want = false;
      else if (travelled > 2.5) want = true;
      if (want !== hidden) {
        hidden = want;
        el.toggleAttribute("data-hidden", hidden);
      }
      // The current act's link carries a short line.
      const i = idx(s.beat);
      const current = i >= idx("seat") || s.beat === "dawn" ? "seat" : i >= idx("unfold") || s.beat === "nightfall" ? "prep" : i >= idx("saved") ? "board" : "read";
      if (current !== act) {
        act = current;
        links().forEach((a) => {
          if (a.dataset.act === act) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      }
    });
  }, []);

  // Close the menu on Escape or after following a link.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header ref={ref} className="nav" data-open={open ? "" : undefined}>
      <div className="nav-stack">
        <div className="nav-pill nav-base">
          <PillContent live open={open} onMenu={() => setOpen((o) => !o)} />
        </div>
        <div className="nav-pill nav-overlay" data-skin-overlay="" aria-hidden="true">
          <PillContent live={false} onMenu={() => setOpen((o) => !o)} />
        </div>
      </div>
      {open ? (
        <nav id="nav-menu" className="nav-menu" aria-label={storyCopy.nav.menu}>
          {[...storyCopy.nav.links, { href: "#join", label: storyCopy.nav.cta }].map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
