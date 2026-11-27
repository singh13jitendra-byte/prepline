"use client";

// STUB — replace with the card and data builder's file (branch `fireflies-card`) at merge.
//
// A list with the contract's exact interface (research/fireflies-contract.md):
//
//   { jobs: FireflyJob[]; onPick: (id: string) => void; activeId?: string | null }
//
// plus `className`, as the real one has. Like the real one it is a small "All roles (n)" button,
// fixed at the bottom left, that opens a fixed panel of rows; each row is a button that calls
// onPick(id), and the row for `activeId` is aria-current. It is placed with the same CSS variables
// on `className` (--ffl-inset, --ffl-top, --ffl-w, --ffl-z). It exists so the explore stop
// (components/acts/explore) can be built and checked before the real list is.
//
// What it honours, and the real list must too:
//   fixed       button and panel are position: fixed, so a transformed ancestor places them
//               (ExploreStage boxes them clear of the nav and the "Illustrative data" caption)
//   scroll      closed, nothing of it takes the wheel; no data-lenis-prevent anywhere

import { useId, useState } from "react";
import type { FireflyJob } from "../jobs";

export type JobsListProps = {
  jobs: FireflyJob[];
  onPick: (id: string) => void;
  activeId?: string | null;
  className?: string;
};

const STUB_CSS = `
.ffl-stub{--ffl-w:348px;--ffl-inset:16px;--ffl-top:16px;font-family:var(--font-text);font-size:var(--fs-small);line-height:var(--leading-small)}
.ffl-stub-toggle{position:fixed;left:var(--ffl-inset);bottom:var(--ffl-inset);z-index:var(--ffl-z,var(--z-nav,5));height:36px;padding:0 14px;border:0;border-radius:var(--r-sm);background:var(--c-night-2);color:var(--c-on-night);box-shadow:inset 0 0 0 var(--hairline) var(--c-rule-night);font:inherit;font-weight:var(--weight-label);cursor:pointer}
.ffl-stub-panel{position:fixed;left:var(--ffl-inset);top:var(--ffl-top);bottom:calc(var(--ffl-inset) + 46px);z-index:var(--ffl-z,var(--z-nav,5));width:min(var(--ffl-w),calc(100vw - 2 * var(--ffl-inset)));margin:0;padding:8px;list-style:none;overflow-y:auto;border-radius:var(--r-md);background:var(--c-night-2);color:var(--c-on-night);box-shadow:inset 0 0 0 var(--hairline) var(--c-rule-night);visibility:hidden}
.ffl-stub[data-open] .ffl-stub-panel{visibility:visible}
.ffl-stub-panel button{display:block;width:100%;padding:8px 10px;border:0;border-radius:var(--r-sm);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ffl-stub-panel button:hover,.ffl-stub-panel button[aria-current="true"]{background:var(--c-night)}
.ffl-stub-panel span{display:block;color:var(--c-on-night-2)}
`;

export function JobsList({ jobs, onPick, activeId, className }: JobsListProps) {
  const pid = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className={`ffl-stub${className ? ` ${className}` : ""}`} data-ff-stub="list" data-chapter="night" data-open={open ? "" : undefined}>
      <style dangerouslySetInnerHTML={{ __html: STUB_CSS }} />
      <button type="button" className="ffl-stub-toggle" aria-expanded={open} aria-controls={pid} onClick={() => setOpen((v) => !v)}>
        All roles ({jobs.length})
      </button>
      <ul id={pid} className="ffl-stub-panel" inert={!open}>
        {jobs.map((job) => (
          <li key={job.id}>
            <button type="button" data-id={job.id} aria-current={activeId === job.id ? "true" : undefined} onClick={() => onPick(job.id)}>
              {job.title}
              <span>
                {job.company} · {job.city} · {job.fit} / 10
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
