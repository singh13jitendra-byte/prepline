"use client";

// STUB — replace with the card and data builder's file (branch `fireflies-card`) at merge.
//
// A box with the contract's exact interface (research/fireflies-contract.md):
//
//   { job: FireflyJob | null; anchor: { x: number; y: number } | null; onClose: () => void }
//
// It sits beside the anchor (viewport CSS px), flips to the other side when there is no room,
// stays 16px inside the screen, and opens in the middle when there is no anchor. Where the real
// card docks (under 840px wide or 520px tall) it is a bottom sheet. It exists so the explore stop
// (components/acts/explore) can be built and checked before the real card is.
//
// What it honours, and the real card must too:
//   portal      drawn in document.body, fixed, above the story: the stage's fades never reach it
//   job = null  closed, and nothing of it takes the pointer
//   scroll      no wheel or touch handler, no data-lenis-prevent, no overscroll containment:
//               a wheel over the card moves the page
//   onClose     the "×" and Esc

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FireflyJob } from "../jobs";

export type JobCardAnchor = { x: number; y: number };
export type JobCardProps = {
  job: FireflyJob | null;
  anchor: JobCardAnchor | null;
  onClose: () => void;
};

/** Where the card stops floating and docks as a bottom sheet (the real card's query). */
export const JOBCARD_DOCK_QUERY = "(max-width: 839px), (max-height: 519px)";

const W = 320;
const GAP = 28;
const EDGE = 16;

const STUB_CSS = `
.ffc-stub{position:fixed;top:0;left:0;z-index:var(--z-nav,5);width:${W}px;max-width:calc(100vw - ${EDGE * 2}px);padding:16px 44px 16px 18px;border-radius:var(--r-md);background:var(--c-night-2);color:var(--c-on-night);box-shadow:inset 0 0 0 var(--hairline) var(--c-rule-night),var(--shadow-1);font-family:var(--font-text);font-size:var(--fs-small);line-height:var(--leading-small)}
.ffc-stub[data-dock]{top:auto;bottom:0;width:100%;max-width:none;border-radius:var(--r-md) var(--r-md) 0 0;padding-bottom:28px;transform:none!important}
.ffc-stub h3{margin:0 0 2px;font-size:var(--fs-body);font-weight:var(--weight-strong)}
.ffc-stub p{margin:0;color:var(--c-on-night-2)}
.ffc-stub b{color:var(--c-match);font-weight:var(--weight-label)}
.ffc-stub ul{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px}
.ffc-stub li>span{display:block;color:var(--c-on-night);font-weight:var(--weight-label)}
.ffc-stub-x{position:absolute;top:8px;right:8px;width:32px;height:32px;border:0;border-radius:var(--r-sm);background:none;color:var(--c-on-night);font:inherit;font-size:var(--fs-lead);line-height:1;cursor:pointer}
.ffc-stub-x:hover{background:var(--c-night)}
`;

export function JobCard({ job, anchor, onClose }: JobCardProps) {
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [dock, setDock] = useState(false);
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(JOBCARD_DOCK_QUERY);
    const on = () => setDock(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Beside the anchor, inside the screen. One transform, written when the anchor or the job changes.
  const ax = anchor?.x;
  const ay = anchor?.y;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !job || dock) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = (vw - w) / 2;
    let y = (vh - h) / 2;
    if (ax !== undefined && ay !== undefined) {
      x = ax + GAP + w + EDGE <= vw ? ax + GAP : ax - GAP - w;
      y = ay - h / 2;
    }
    x = Math.min(vw - w - EDGE, Math.max(EDGE, x));
    y = Math.min(vh - h - EDGE, Math.max(EDGE, y));
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
  }, [job, ax, ay, dock]);

  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!mounted || !job) return null;
  return createPortal(
    <div ref={box} className="ffc-stub" data-ff-stub="card" data-chapter="night" data-dock={dock ? "" : undefined} role="dialog" aria-label={`${job.title}, ${job.company}`}>
      <style dangerouslySetInnerHTML={{ __html: STUB_CSS }} />
      <button type="button" className="ffc-stub-x" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h3>{job.title}</h3>
      <p>
        {job.company} · {job.city} · {job.mode}
      </p>
      <p>
        <b>{job.fit} / 10</b> · {job.level} · {job.posted} · {job.source}
      </p>
      <ul>
        {job.reasons.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <p>{r.text}</p>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
