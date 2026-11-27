"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { FIREFLY_JOBS, byFit, type FireflyJob } from "@/components/fireflies/jobs";
import { JobCard, type JobCardHandle } from "@/components/fireflies/card/JobCard";
import { JobsList } from "@/components/fireflies/card/JobsList";
import "./lab.css";

type Pt = { x: number; y: number };
const SORTED = byFit(FIREFLY_JOBS);
const byId = (id: string | null) => FIREFLY_JOBS.find((j) => j.id === id) ?? null;

type LabApi = { open: (id: string) => void; close: () => void; move: (x: number, y: number) => void; job: () => string | null };

/**
 * The card on its own: a draggable dot stands in for the focused firefly, over the painted meadow.
 * `window.__ffLab` drives it for screenshots: open(id), close(), move(x, y) in px.
 */
export function CardLab() {
  const [ready, setReady] = useState(false);
  const [job, setJob] = useState<FireflyJob | null>(null);
  const [pt, setPt] = useState<Pt>({ x: 0, y: 0 });
  const [byRef, setByRef] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [wander, setWander] = useState(false);
  const cardRef = useRef<JobCardHandle>(null);
  const dotRef = useRef<HTMLButtonElement>(null);
  const live = useRef<Pt>({ x: 0, y: 0 });
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const move = useCallback(
    (x: number, y: number) => {
      const p = { x: Math.round(Math.min(Math.max(x, 0), window.innerWidth)), y: Math.round(Math.min(Math.max(y, 0), window.innerHeight)) };
      live.current = p;
      if (byRef) {
        // The imperative path: no React render. The dot is moved by hand too.
        cardRef.current?.setAnchor(p);
        if (dotRef.current) dotRef.current.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
      } else setPt(p);
    },
    [byRef],
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fx = Number(q.get("x") ?? 0.36);
    const fy = Number(q.get("y") ?? 0.46);
    const p = { x: Math.round(window.innerWidth * fx), y: Math.round(window.innerHeight * fy) };
    live.current = p;
    setPt(p);
    setByRef(q.get("drive") === "ref");
    setListOpen(q.get("list") === "1");
    if (q.get("open") !== "0") setJob(byId(q.get("job")) ?? SORTED[0]);
    setReady(true);
  }, []);

  useEffect(() => {
    const api: LabApi = { open: (id) => setJob(byId(id)), close: () => setJob(null), move, job: () => job?.id ?? null };
    (window as unknown as { __ffLab?: LabApi }).__ffLab = api;
  }, [move, job]);

  /* a slow figure of eight, like a firefly that will not sit still */
  useEffect(() => {
    if (!wander) return;
    const c = { ...live.current };
    const t0 = performance.now();
    let raf = requestAnimationFrame(function loop(now) {
      const t = (now - t0) / 1000;
      move(c.x + Math.sin(t * 0.9) * 150 + Math.sin(t * 7) * 4, c.y + Math.sin(t * 1.8) * 60 + Math.cos(t * 6) * 4);
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [wander, move]);

  const step = (d: number) => {
    const i = job ? SORTED.findIndex((j) => j.id === job.id) : -1;
    setJob(SORTED[(i + d + SORTED.length) % SORTED.length]);
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: live.current.x - e.clientX, dy: live.current.y - e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    move(e.clientX + d.dx, e.clientY + d.dy);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && !job) setJob(SORTED[0]);
  };
  const onDotKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = e.shiftKey ? 64 : 16;
    const k: Record<string, Pt> = { ArrowLeft: { x: -s, y: 0 }, ArrowRight: { x: s, y: 0 }, ArrowUp: { x: 0, y: -s }, ArrowDown: { x: 0, y: s } };
    const d = k[e.key];
    if (d) {
      e.preventDefault();
      move(live.current.x + d.x, live.current.y + d.y);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setJob((j) => j ?? SORTED[0]);
    }
  };

  const to = (fx: number, fy: number) => move(window.innerWidth * fx, window.innerHeight * fy);

  return (
    <main className="fflab" data-chapter="night" data-ready={ready ? "" : undefined}>
      <picture>
        <source type="image/avif" srcSet="/scenes/meadow-night-960.avif 960w, /scenes/meadow-night-1280.avif 1280w" sizes="100vw" />
        <source type="image/webp" srcSet="/scenes/meadow-night-960.webp 960w, /scenes/meadow-night-1280.webp 1280w" sizes="100vw" />
        <img className="fflab-bg" src="/scenes/meadow-night-1280.webp" alt="" decoding="async" />
      </picture>

      <button
        ref={dotRef}
        type="button"
        className="fflab-dot"
        aria-label="Firefly. Drag it, or move it with the arrow keys. Enter opens its role."
        style={{ transform: `translate3d(${pt.x}px,${pt.y}px,0)`, visibility: ready ? "visible" : "hidden" } as CSSProperties}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onDotKey}
      />

      <div className="fflab-tools">
        <p>Drag the firefly. The card keeps 16px of screen around it.</p>
        <button type="button" onClick={() => step(-1)}>
          Previous role
        </button>
        <button type="button" onClick={() => step(1)}>
          Next role
        </button>
        <button type="button" onClick={() => setJob((j) => (j ? null : SORTED[0]))}>
          {job ? "Close card" : "Open card"}
        </button>
        <button type="button" onClick={() => to(0.04, 0.5)}>
          Left edge
        </button>
        <button type="button" onClick={() => to(0.5, 0.5)}>
          Centre
        </button>
        <button type="button" onClick={() => to(0.96, 0.5)}>
          Right edge
        </button>
        <button type="button" onClick={() => to(0.9, 0.95)}>
          Corner
        </button>
        <button type="button" aria-pressed={wander} onClick={() => setWander((w) => !w)}>
          {wander ? "Stop wandering" : "Wander"}
        </button>
      </div>

      {ready ? (
        <JobsList key={listOpen ? "open" : "shut"} jobs={FIREFLY_JOBS} onPick={(id) => setJob(byId(id))} activeId={job?.id} defaultOpen={listOpen} />
      ) : null}
      <JobCard ref={cardRef} job={job} anchor={ready ? (byRef ? live.current : pt) : null} onClose={() => setJob(null)} anchorRadius={14} />
      <span className="fflab-cap">Illustrative data</span>
    </main>
  );
}
