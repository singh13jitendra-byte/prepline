"use client";

/**
 * The lab page around <GardenScene />, wired exactly as app/lab/fireflies/Lab.tsx wires
 * <FireflyScene /> (and as the story's explore stop will): the same card, the same list.
 *
 *   scene → card   onFocus(job, anchor): the job into React state, the anchor straight to the card.
 *   list → scene   onPick(id) → focusJob(id). A role with no flower on stage borrows a stand-in.
 *   card → scene   onClose → clearFocus().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import GardenScene, { type FireflyAnchor, type FireflyJob, type FireflySceneHandle } from "@/components/garden/scene/GardenScene";
import { JobCard, type JobCardHandle } from "@/components/fireflies/card/JobCard";
import { JobsList } from "@/components/fireflies/card/JobsList";
import { FIREFLY_JOBS } from "@/components/fireflies/jobs";
import "../fireflies/lab.css";

type Flags = { reduced: boolean | undefined; hud: boolean; coarse: boolean; match: boolean };
type Stats = { fps: number; frameMs: number; cpuMs: number; dpr: number; calls: number; triangles: number; flowers: number };

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
    const w = window as unknown as { __gardenDebug?: Record<string, unknown> };
    w.__gardenDebug = { ...w.__gardenDebug, ...(dpr > 0 ? { dpr } : null) };
    setFlags({ reduced: q.get("reduced") === "1" ? true : undefined, hud: q.get("hud") === "1", coarse: window.matchMedia("(hover: none)").matches, match: q.get("intro") === "match" });
    if (q.get("intro") === "match") setActive(false);
    (window as unknown as { __gardenLab?: { setActive: (on: boolean) => void } }).__gardenLab = { setActive };
  }, []);

  useEffect(() => {
    if (!flags?.hud) return;
    const id = window.setInterval(() => {
      const s = (window as unknown as { __garden_scene?: { stats: Stats } }).__garden_scene?.stats;
      if (s && hud.current) hud.current.textContent = `${s.fps.toFixed(0)} fps · frame ${s.frameMs.toFixed(1)} ms · cpu ${s.cpuMs.toFixed(1)} ms\ndpr ${s.dpr} · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k tris · ${s.flowers} flowers`;
    }, 500);
    return () => window.clearInterval(id);
  }, [flags?.hud]);

  const onFocus = useCallback((next: FireflyJob | null, anchor: FireflyAnchor | null) => {
    card.current?.setAnchor(anchor);
    setJob(next);
    if (next) setMet(true);
    if (anchor?.r) setGap(Math.round(anchor.r * 0.75 + 16));
  }, []);
  const close = useCallback(() => scene.current?.clearFocus(), []);
  const pick = useCallback((id: string) => scene.current?.focusJob(id), []);

  return (
    <main className="ffm" data-chapter="night" data-skin="night" data-state={state}>
      <h1 className="ffm-sr">Design roles in the garden</h1>
      <p className="ffm-sr">Each flower is one role. Open flowers fit your portfolio; buds were set aside. The same roles are in the list of all roles.</p>

      {flags ? <GardenScene ref={scene} active={active} jobs={FIREFLY_JOBS} onFocus={onFocus} onReady={() => setState("ready")} onError={() => setState("failed")} reducedMotion={flags.reduced} intro={flags.match ? "match" : "veil"} /> : null}

      {state === "loading" ? (
        <p className="ffm-loading" role="status">
          Opening the garden
        </p>
      ) : null}
      {state === "failed" ? (
        <p className="ffm-loading" role="status">
          This scene needs WebGL. Every role is in the list.
        </p>
      ) : null}

      <p className="ffm-hint slip-night" data-size="s" data-on={state === "ready" && !met ? "" : undefined} aria-hidden={met}>
        {flags?.coarse ? "Tap a flower, then tap again to read the role" : "Hover a flower to read the role"}
      </p>

      {state !== "loading" ? <JobsList jobs={FIREFLY_JOBS} onPick={pick} activeId={job?.id} defaultOpen={state === "failed"} /> : null}
      <JobCard ref={card} job={job} anchor={null} onClose={close} gap={gap} anchorRadius={34} />

      {flags?.hud ? <pre ref={hud} className="ffm-hud" aria-hidden="true" /> : null}
    </main>
  );
}
