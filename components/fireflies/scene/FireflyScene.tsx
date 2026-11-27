"use client";

// STUB — replace with the 3D scene builder's file (branch `fireflies-3d`) at merge.
//
// A flat stand-in with the contract's exact interface (research/fireflies-contract.md): one glowing
// dot per job, drifting over whatever is behind the host (it is transparent). Hovering or tapping
// a dot focuses it and reports its centre as the anchor; a click on empty meadow lets go. It exists
// so the explore stop (components/acts/explore) can be built and checked before the real scene is.
//
// What it honours, and the real scene must too:
//   active        renders (animates) and takes pointer input only while true
//   onFocus       (job, anchor) on focus, with the anchor in viewport CSS px; (null, null) on leaving
//   onReady       once, after the first frame (`?ffdelay=<ms>` delays it here, to rehearse a slow load)
//   reducedMotion nothing drifts
//   ref           focusJob(id) / clearFocus()
//   scroll        no wheel or touch handler, no data-lenis-prevent, touch-action: pan-y

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FireflyJob } from "../jobs";

export type FireflySceneProps = {
  /** render and accept pointer input only while true */
  active: boolean;
  /** from components/fireflies/jobs.ts */
  jobs: FireflyJob[];
  /** anchor: CSS px, viewport coords of the focused firefly, updated while focused */
  onFocus: (job: FireflyJob | null, anchor: { x: number; y: number } | null) => void;
  /** assets loaded and decoded, first frame drawn */
  onReady?: () => void;
  reducedMotion?: boolean;
  className?: string;
};

export type FireflySceneHandle = {
  focusJob: (id: string) => void;
  clearFocus: () => void;
};

const STUB_CSS = `
.ffs{touch-action:pan-y;pointer-events:none;overflow:hidden}
.ffs[data-active]{pointer-events:auto}
.ffs-dot{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;display:grid;place-items:center;cursor:pointer;animation:ffs-drift var(--ffs-t,9s) var(--ease-in-out-sym) var(--ffs-d,0s) infinite alternate;animation-play-state:paused}
.ffs[data-active]:not([data-still]) .ffs-dot:not([data-on]){animation-play-state:running}
.ffs-glow{width:9px;height:9px;border-radius:var(--r-round);background:var(--art-speck);opacity:.72;transition:transform var(--dur-2) var(--ease-out),opacity var(--dur-2) var(--ease-out)}
.ffs-dot[data-kept] .ffs-glow{width:14px;height:14px;background:var(--art-lamp);opacity:1;box-shadow:0 0 0 6px color-mix(in oklab,var(--art-lamp) 22%,transparent),0 0 0 14px color-mix(in oklab,var(--art-lamp) 9%,transparent)}
.ffs-dot[data-on] .ffs-glow{transform:scale(1.9);opacity:1}
@keyframes ffs-drift{from{transform:translate3d(var(--ffs-x0,-10px),var(--ffs-y0,6px),0)}to{transform:translate3d(var(--ffs-x1,12px),var(--ffs-y1,-8px),0)}}
`;

/** A deterministic 0..1 from an index and a salt. */
const hash = (i: number, salt: number) => {
  const x = Math.sin((i + 1) * salt) * 43758.5453;
  return x - Math.floor(x);
};

const FireflyScene = forwardRef<FireflySceneHandle, FireflySceneProps>(function FireflyScene({ active, jobs, onFocus, onReady, reducedMotion, className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  const cb = useRef({ onFocus, onReady });
  cb.current = { onFocus, onReady };

  // Where each dot lives: spread over the middle of the host, clear of the nav and the bottom cue.
  const dots = useMemo(
    () =>
      jobs.map((job, i) => ({
        job,
        left: 8 + hash(i, 12.9898) * 84,
        top: 20 + hash(i, 78.233) * 58,
        style: {
          "--ffs-t": `${(7 + hash(i, 3.71) * 6).toFixed(1)}s`,
          "--ffs-d": `${(-hash(i, 9.13) * 8).toFixed(1)}s`,
          "--ffs-x0": `${(-8 - hash(i, 5.3) * 14).toFixed(0)}px`,
          "--ffs-y0": `${(4 + hash(i, 6.1) * 10).toFixed(0)}px`,
          "--ffs-x1": `${(8 + hash(i, 7.7) * 14).toFixed(0)}px`,
          "--ffs-y1": `${(-4 - hash(i, 8.9) * 12).toFixed(0)}px`,
        } as CSSProperties,
      })),
    [jobs],
  );

  const report = useCallback(
    (id: string | null) => {
      if (id === null) {
        cb.current.onFocus(null, null);
        return;
      }
      const el = host.current?.querySelector<HTMLElement>(`[data-job="${CSS.escape(id)}"]`);
      const job = jobs.find((j) => j.id === id);
      if (!el || !job) return;
      const r = el.getBoundingClientRect();
      cb.current.onFocus(job, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    [jobs],
  );

  const focus = useCallback(
    (id: string | null) => {
      if (focusedRef.current === id) return;
      focusedRef.current = id;
      setFocused(id);
      // Measured a frame later: the dot has stopped drifting by then (data-on pauses it).
      requestAnimationFrame(() => {
        if (focusedRef.current === id) report(id);
      });
    },
    [report],
  );

  useImperativeHandle(ref, () => ({ focusJob: (id) => focus(jobs.some((j) => j.id === id) ? id : null), clearFocus: () => focus(null) }), [focus, jobs]);

  // Inactive: it lets go of whatever it held.
  useEffect(() => {
    if (!active) focus(null);
  }, [active, focus]);

  // The anchor follows the dot when the window changes size.
  useEffect(() => {
    if (!focused) return;
    const onResize = () => report(focused);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [focused, report]);

  // Ready after the first frame. `?ffdelay=1500` holds it back, to rehearse a slow load.
  useEffect(() => {
    const delay = Number(new URLSearchParams(window.location.search).get("ffdelay")) || 0;
    let raf = 0;
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => cb.current.onReady?.());
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={host}
      className={`ffs${className ? ` ${className}` : ""}`}
      data-ff-stub=""
      data-active={active ? "" : undefined}
      data-still={reducedMotion ? "" : undefined}
      onPointerDown={(e) => {
        if (active && e.target === e.currentTarget) focus(null);
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: STUB_CSS }} />
      {dots.map(({ job, left, top, style }) => (
        <i
          key={job.id}
          className="ffs-dot"
          data-job={job.id}
          data-kept={job.fit >= 6 ? "" : undefined}
          data-on={focused === job.id ? "" : undefined}
          style={{ left: `${left.toFixed(2)}%`, top: `${top.toFixed(2)}%`, ...style }}
          onPointerEnter={(e) => {
            if (active && e.pointerType === "mouse") focus(job.id);
          }}
          onPointerDown={() => {
            if (active) focus(job.id);
          }}
        >
          <span className="ffs-glow" />
        </i>
      ))}
    </div>
  );
});

export default FireflyScene;
