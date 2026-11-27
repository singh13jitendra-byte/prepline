"use client";

/**
 * The lab page around <FireflyScene />: what the story's explore beat will put around it, in
 * placeholder form. The scene is the real thing; the card and the list here are stand-ins for
 * components/fireflies/card (JobCard, JobsList), which another builder owns.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import FireflyScene, { type FireflyAnchor, type FireflyJob, type FireflySceneHandle } from "@/components/fireflies/scene/FireflyScene";
import "@/components/product/product.css";
import { LAB_JOBS } from "./lab-jobs";
import { PlaceholderCard } from "./PlaceholderCard";
import "./lab.css";

type Flags = { reduced: boolean | undefined; hud: boolean; coarse: boolean };
type Stats = { fps: number; frameMs: number; cpuMs: number; dpr: number; calls: number; heroes: number; lod: number; sprites: number; source: string; triangles: number };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const label = (j: FireflyJob) => `${j.title}, ${j.company}. ${j.mode === "Remote" ? "Remote" : `${j.city}, ${j.mode}`}. ${fmt(j.fit)} out of 10 fit.`;

export function Lab() {
  const scene = useRef<FireflySceneHandle>(null);
  const hud = useRef<HTMLPreElement>(null);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [focus, setFocus] = useState<{ job: FireflyJob; anchor: FireflyAnchor } | null>(null);
  const [met, setMet] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const dpr = parseFloat(q.get("dpr") ?? "");
    const w = window as unknown as { __ffDebug?: Record<string, unknown> };
    w.__ffDebug = { ...w.__ffDebug, ...(dpr > 0 ? { dpr } : null), ...(q.get("standin") === "1" ? { standin: true } : null) };
    setFlags({ reduced: q.get("reduced") === "1" ? true : undefined, hud: q.get("hud") === "1", coarse: window.matchMedia("(hover: none)").matches });
  }, []);

  useEffect(() => {
    if (!flags?.hud) return;
    const id = window.setInterval(() => {
      const s = (window as unknown as { __ff?: { stats: Stats } }).__ff?.stats;
      if (s && hud.current) hud.current.textContent = `${s.fps.toFixed(0)} fps · frame ${s.frameMs.toFixed(1)} ms · cpu ${s.cpuMs.toFixed(1)} ms\ndpr ${s.dpr} · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k tris\n${s.heroes} heroes · ${s.lod} far · ${s.sprites} sprites · ${s.source}`;
    }, 500);
    return () => window.clearInterval(id);
  }, [flags?.hud]);

  const onFocus = useCallback((job: FireflyJob | null, anchor: { x: number; y: number } | null) => {
    setFocus(job && anchor ? { job, anchor } : null);
    if (job) setMet(true);
  }, []);
  const close = useCallback(() => {
    scene.current?.clearFocus();
    setPicked(null);
  }, []);

  const reduced = flags?.reduced ?? false;
  return (
    <main className="ffl" data-chapter="night" data-skin="night" data-state={state} data-reduced={reduced ? "" : undefined}>
      <h1 className="ffl-sr">Design roles in the meadow</h1>
      <p className="ffl-sr">Each firefly is one role. The brighter ones fit your portfolio. The same roles are in the list that follows.</p>

      {flags ? <FireflyScene ref={scene} active jobs={LAB_JOBS} onFocus={onFocus} onReady={() => setState("ready")} onError={() => setState("failed")} reducedMotion={flags.reduced} intro="veil" /> : null}

      {state === "loading" ? (
        <p className="ffl-loading" role="status">
          Lighting the meadow
        </p>
      ) : null}
      {state === "failed" ? (
        <p className="ffl-loading" role="status">
          This scene needs WebGL. The roles are in the list: press Tab.
        </p>
      ) : null}

      <p className="ffl-hint slip-night" data-size="s" data-on={state === "ready" && !met ? "" : undefined} aria-hidden={met}>
        {flags?.coarse ? "Tap a firefly to read the role" : "Hover a firefly to read the role"}
      </p>

      {/* PLACEHOLDER for components/fireflies/card/JobsList: the same roles as a list. Tab walks it, and each stop moves the camera. */}
      <nav
        className="ffl-list"
        aria-label="All roles"
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null;
          if (!to || (!e.currentTarget.contains(to) && !(to instanceof Element && to.closest(".ffc")))) close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            close();
            (document.activeElement as HTMLElement | null)?.blur();
          }
          if (e.key === "Enter" || e.key === " ") document.querySelector<HTMLElement>(".ffc[data-open] .ffc-paper")?.focus();
        }}
      >
        <p className="ffl-list-h">All roles · Tab moves through them</p>
        <ol>
          {LAB_JOBS.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                aria-current={picked === j.id ? "true" : undefined}
                aria-label={label(j)}
                onFocus={() => {
                  setPicked(j.id);
                  scene.current?.focusJob(j.id);
                }}
              >
                <b>{j.title}</b>
                <span>
                  {j.company} · {j.mode === "Remote" ? "Remote" : j.city}
                </span>
                <i className="pp-num">{fmt(j.fit)}</i>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <PlaceholderCard job={focus?.job ?? null} anchor={focus?.anchor ?? null} onClose={close} />

      {flags?.hud ? <pre ref={hud} className="ffl-hud" aria-hidden="true" /> : null}
    </main>
  );
}
