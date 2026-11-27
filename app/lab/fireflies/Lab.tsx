"use client";

/**
 * The lab page around <FireflyScene />: the three parts of the explore stop, wired the way the
 * story beat wires them (components/acts/explore), with nothing else on the page.
 *
 *   scene → card   onFocus(job, anchor). The job goes into React state (it changes on a focus, a
 *                  re-target and a leave). The anchor goes straight to the card through its ref, so
 *                  a firefly that bobs under the camera never renders React.
 *   list → scene   onPick(id) → focusJob(id). The list is the keyboard's and the screen reader's way in.
 *   card → scene   onClose → clearFocus().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import FireflyScene, { type FireflyAnchor, type FireflyJob, type FireflySceneHandle } from "@/components/fireflies/scene/FireflyScene";
import { JobCard, type JobCardHandle } from "@/components/fireflies/card/JobCard";
import { JobsList } from "@/components/fireflies/card/JobsList";
import { FIREFLY_JOBS } from "@/components/fireflies/jobs";
import "./lab.css";

type Flags = { reduced: boolean | undefined; hud: boolean; coarse: boolean; match: boolean };
type Stats = { fps: number; frameMs: number; cpuMs: number; dpr: number; calls: number; heroes: number; lod: number; sprites: number; source: string; triangles: number };

export function Lab() {
  const scene = useRef<FireflySceneHandle>(null);
  const card = useRef<JobCardHandle>(null);
  const hud = useRef<HTMLPreElement>(null);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [job, setJob] = useState<FireflyJob | null>(null);
  const [met, setMet] = useState(false);
  const [gap, setGap] = useState(140);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const dpr = parseFloat(q.get("dpr") ?? "");
    const w = window as unknown as { __ffDebug?: Record<string, unknown> };
    w.__ffDebug = { ...w.__ffDebug, ...(dpr > 0 ? { dpr } : null), ...(q.get("standin") === "1" ? { standin: true } : null) };
    setFlags({ reduced: q.get("reduced") === "1" ? true : undefined, hud: q.get("hud") === "1", coarse: window.matchMedia("(hover: none)").matches, match: q.get("intro") === "match" });
    // ?intro=match: the scene as the story mounts it. It starts idle; __ffLab.setActive(true) brings it up from the painting.
    if (q.get("intro") === "match") setActive(false);
    (window as unknown as { __ffLab?: { setActive: (on: boolean) => void } }).__ffLab = { setActive };
  }, []);

  useEffect(() => {
    if (!flags?.hud) return;
    const id = window.setInterval(() => {
      const s = (window as unknown as { __ff?: { stats: Stats } }).__ff?.stats;
      if (s && hud.current) hud.current.textContent = `${s.fps.toFixed(0)} fps · frame ${s.frameMs.toFixed(1)} ms · cpu ${s.cpuMs.toFixed(1)} ms\ndpr ${s.dpr} · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k tris\n${s.heroes} heroes · ${s.lod} far · ${s.sprites} sprites · ${s.source}`;
    }, 500);
    return () => window.clearInterval(id);
  }, [flags?.hud]);

  const onFocus = useCallback((next: FireflyJob | null, anchor: FireflyAnchor | null) => {
    // The anchor first, and not through React: the card must know where to open before it has a job.
    card.current?.setAnchor(anchor);
    setJob(next);
    if (next) setMet(true);
    // The card stands clear of the wings. The radius is the same for every close-up, so this settles once.
    if (anchor?.r) setGap(Math.round(anchor.r * 0.75 + 16));
  }, []);
  const close = useCallback(() => scene.current?.clearFocus(), []);
  const pick = useCallback((id: string) => scene.current?.focusJob(id), []);

  return (
    <main className="ffm" data-chapter="night" data-skin="night" data-state={state}>
      <h1 className="ffm-sr">Design roles in the meadow</h1>
      <p className="ffm-sr">Each firefly is one role. The brighter ones fit your portfolio. The same roles are in the list of all roles.</p>

      {flags ? <FireflyScene ref={scene} active={active} jobs={FIREFLY_JOBS} onFocus={onFocus} onReady={() => setState("ready")} onError={() => setState("failed")} reducedMotion={flags.reduced} intro={flags.match ? "match" : "veil"} /> : null}

      {state === "loading" ? (
        <p className="ffm-loading" role="status">
          Lighting the meadow
        </p>
      ) : null}
      {state === "failed" ? (
        <p className="ffm-loading" role="status">
          This scene needs WebGL. Every role is in the list.
        </p>
      ) : null}

      <p className="ffm-hint slip-night" data-size="s" data-on={state === "ready" && !met ? "" : undefined} aria-hidden={met}>
        {flags?.coarse ? "Tap a firefly to read the role" : "Hover a firefly to read the role"}
      </p>

      {state !== "loading" ? <JobsList jobs={FIREFLY_JOBS} onPick={pick} activeId={job?.id} defaultOpen={state === "failed"} /> : null}
      <JobCard ref={card} job={job} anchor={null} onClose={close} gap={gap} anchorRadius={34} />

      {flags?.hud ? <pre ref={hud} className="ffm-hud" aria-hidden="true" /> : null}
    </main>
  );
}
