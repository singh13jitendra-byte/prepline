"use client";

/**
 * ALL ROLES: every firefly as a list, for the keyboard, for screen readers, and for anyone who
 * would rather read than chase.
 *
 *   <JobsList jobs={FIREFLY_JOBS} onPick={(id) => scene.focusJob(id)} activeId={job?.id} />
 *
 * A small "All roles (48)" button opens a drawer (a bottom sheet where the card docks). The roles
 * are sorted by fit, in two groups: the ones that fit, then the ones set aside. Each row is a
 * button: picking it calls onPick(id). The row for `activeId` is marked aria-current.
 *
 * Keyboard: Tab reaches the button and then one row (the active one, or the first). Up and Down
 * move between rows, Home and End jump, Enter or Space picks, Esc closes and returns to the button.
 * Closed, the drawer is inert.
 *
 * Place it with CSS variables on `className`: --ffl-inset (16px), --ffl-top (16px; raise it to
 * clear a nav), --ffl-w (348px), --ffl-z.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import "@/components/product/product.css";
import "./card.css";
import { Icon } from "@/components/product/icons";
import { ScoreRule, cx } from "@/components/product/primitives";
import { byFit, fireflyCardCopy, jobFits, whereParts, type FireflyJob } from "../jobs";
import { JOBCARD_DOCK_QUERY } from "./JobCard";

export type JobsListProps = {
  jobs: FireflyJob[];
  onPick: (id: string) => void;
  activeId?: string | null;
  /** Start open. */
  defaultOpen?: boolean;
  /** Close after a pick. Default: only where the card docks as a sheet (it would cover the list). */
  closeOnPick?: boolean;
  className?: string;
};

export function JobsList({ jobs, onPick, activeId, defaultOpen = false, closeOnPick, className }: JobsListProps) {
  const pid = useId();
  const c = fireflyCardCopy.list;
  const [open, setOpen] = useState(defaultOpen);
  const [cursor, setCursor] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => byFit(jobs), [jobs]);
  const kept = useMemo(() => sorted.filter(jobFits), [sorted]);
  const aside = useMemo(() => sorted.filter((j) => !jobFits(j)), [sorted]);

  /** The one row Tab lands on. */
  const tabId = (cursor && sorted.some((j) => j.id === cursor) ? cursor : null) ?? (activeId && sorted.some((j) => j.id === activeId) ? activeId : sorted[0]?.id);

  const rows = () => Array.from(scrollRef.current?.querySelectorAll<HTMLButtonElement>("button[data-id]") ?? []);

  /* opening puts focus on the active row (or the first) */
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const all = rows();
      (all.find((b) => b.dataset.id === (activeId ?? "")) ?? all[0])?.focus({ preventScroll: false });
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* the active role changed somewhere else (a firefly was hovered): keep its row in view */
  useEffect(() => {
    if (!open || !activeId) return;
    const scroller = scrollRef.current;
    if (!scroller || scroller.contains(document.activeElement)) return;
    const row = rows().find((b) => b.dataset.id === activeId);
    if (!row) return;
    const r = row.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    if (r.top < s.top + 30) scroller.scrollTop -= s.top + 30 - r.top;
    else if (r.bottom > s.bottom) scroller.scrollTop += r.bottom - s.bottom;
  }, [activeId, open]);

  const shut = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) toggleRef.current?.focus({ preventScroll: true });
  }, []);

  const pick = (id: string) => {
    setCursor(id);
    onPick(id);
    const close = closeOnPick ?? (typeof window !== "undefined" && window.matchMedia(JOBCARD_DOCK_QUERY).matches);
    if (close) shut(true); // focus goes back to the button, so the card can hand it back there
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      shut(true);
      return;
    }
    const all = rows();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    let to = -1;
    if (e.key === "ArrowDown") to = Math.min(all.length - 1, at + 1);
    else if (e.key === "ArrowUp") to = Math.max(0, at - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = all.length - 1;
    else if (e.key === "PageDown") to = Math.min(all.length - 1, at + 6);
    else if (e.key === "PageUp") to = Math.max(0, at - 6);
    if (to < 0) return;
    e.preventDefault();
    all[to].focus();
    setCursor(all[to].dataset.id ?? null);
  };

  const row = (job: FireflyJob) => {
    const fits = jobFits(job);
    return (
      <li key={job.id}>
        <button
          type="button"
          className="pp-mrow"
          data-id={job.id}
          data-aside={fits ? undefined : ""}
          aria-current={job.id === activeId ? "true" : undefined}
          tabIndex={job.id === tabId ? 0 : -1}
          onClick={() => pick(job.id)}
          onFocus={() => setCursor(job.id)}
        >
          <span className="ffl-dot" data-aside={fits ? undefined : ""} aria-hidden="true" />
          <span className="pp-mrow-main">
            <span className="pp-mrow-title pp-trunc">{job.title}</span>
            <span className="pp-mrow-reason">{whereParts(job).slice(0, 2).join(" · ")}</span>
          </span>
          <ScoreRule score={job.fit} size="sm" />
        </button>
      </li>
    );
  };

  return (
    <div className={cx("ffl", className)} data-open={open ? "" : undefined}>
      <div className="pp ffl-toggle" data-skin="night" data-bare="">
        <button ref={toggleRef} type="button" className="pp-btn" aria-expanded={open} aria-controls={pid} onClick={() => (open ? shut(false) : setOpen(true))}>
          <Icon name="list" size={16} />
          {c.open(sorted.length)}
        </button>
      </div>
      <section id={pid} className="pp ffl-panel" data-skin="night" aria-label={`${c.title}, ${c.sorted.toLowerCase()}`} inert={!open} onKeyDown={onKeyDown}>
        <header className="pp-mh">
          <h2 className="pp-title">
            {c.title} <span className="pp-num">({sorted.length})</span>
          </h2>
          <p className="pp-meta">
            {c.sorted}
            <span className="pp-sep">·</span>
            <b className="pp-num">{c.kept(kept.length)}</b>
          </p>
          <button type="button" className="ffc-x" aria-label={c.close} onClick={() => shut(true)}>
            <Icon name="x" size={16} />
          </button>
        </header>
        <div ref={scrollRef} className="ffl-scroll" data-lenis-prevent="">
          <ul className="ffl-list" aria-label={c.kept(kept.length)}>
            {kept.map(row)}
          </ul>
          {aside.length ? (
            <>
              <h3 className="ffl-sub">{c.aside(aside.length)}</h3>
              <ul className="ffl-list" aria-label={c.aside(aside.length)}>
                {aside.map(row)}
              </ul>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
