"use client";

/**
 * The bench for the garden's scroll tour: a slider stands in for the scroll (explore beat progress),
 * the tour's state is read out, the slip is drawn at stand-in anchors, and a lamp dot marks Lumi's target.
 * Bench chrome is inline, as in the other labs; the page's own copy comes from lib/content.ts.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type WheelEvent } from "react";
import { FIREFLY_JOBS } from "@/components/fireflies/jobs";
import { JobCard } from "@/components/fireflies/card/JobCard";
import { kindOf, pickGardenJobs, slotsFor } from "@/components/garden/scene/stage";
import { openForFit } from "@/components/garden/flowers";
import { DEFAULT_HOLD, planTour, stepMarks, tourAt, openOf, type TourState } from "@/components/garden/tour/tour";
import { GardenSlip, gapFor, slipPerch, type GardenSlipHandle, type SlipAnchor } from "@/components/garden/tour/GardenSlip";
import { storyCopy } from "@/lib/content";
import "./lab.css";

const GARDEN = pickGardenJobs(FIREFLY_JOBS).map((i) => ({ job: FIREFLY_JOBS[i] }));
// The hold is lib/story.ts EXPLORE_IN[1]..EXPLORE_OUT[0] (scripts/check-garden-tour.mjs keeps them equal).
const [H0, H1] = DEFAULT_HOLD;
const PLAN = planTour(GARDEN);
const MARKS = stepMarks(PLAN);
const INSET = { top: 88 };

type Flower = { id: string; title: string; kind: string; stage: number; a: SlipAnchor };

const fmt = (n: number) => n.toFixed(3);

export function TourLab() {
  const [bp, setBp] = useState(0);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [ui, setUi] = useState(true);
  const [compare, setCompare] = useState(false);
  const live = useRef(0);
  live.current = bp;
  const slipRef = useRef<GardenSlipHandle>(null);
  const [onCard, setOnCard] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const b = Number(q.get("bp"));
    if (Number.isFinite(b) && q.has("bp")) setBp(Math.min(1, Math.max(0, b)));
    setUi(q.get("ui") !== "0");
    setCompare(q.get("card") === "1");
    const size = () => setVp({ w: document.documentElement.clientWidth, h: window.innerHeight });
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);

  const s: TourState = useMemo(() => tourAt(PLAN, bp), [bp]);

  useEffect(() => {
    const api = { set: (v: number) => setBp(Math.min(1, Math.max(0, v))), state: () => tourAt(PLAN, live.current) };
    (window as unknown as { __tourLab?: typeof api }).__tourLab = api;
  }, []);

  /* stand-in flowers: the scene's own slots, in its own order (slot i is rank i) */
  const flowers: Flower[] = useMemo(() => {
    if (!vp.w) return [];
    const slots = slotsFor(vp.w / vp.h);
    return GARDEN.map(({ job }, i) => {
      const sl = slots[i % slots.length];
      return { id: job.id, title: job.title, kind: kindOf(job), stage: openForFit(job.fit), a: { x: sl.x * vp.w, y: sl.y * vp.h, r: sl.s * vp.h * 0.2 } };
    });
  }, [vp]);
  const byId = (id: string | null | undefined) => flowers.find((f) => f.id === id) ?? null;
  const target = byId(s.target?.id);
  const lumiAt = byId(s.lumi?.id);
  // Perched: on the heart. Hovering: up and to the side of it.
  const lumi = lumiAt ? (s.lumi?.perch ? { x: lumiAt.a.x, y: lumiAt.a.y - (lumiAt.a.r ?? 20) * 0.35 } : { x: lumiAt.a.x - (lumiAt.a.r ?? 20) * 0.9, y: lumiAt.a.y - (lumiAt.a.r ?? 20) * 0.9 }) : null;

  // Perched means on the card (its top edge, GardenSlip slipPerch): read where the slip laid it out.
  useLayoutEffect(() => {
    const l = s.lumi?.perch ? slipRef.current?.layout() : null;
    const p = l ? slipPerch(l) : null;
    setOnCard((o) => (o?.x === p?.x && o?.y === p?.y ? o : p));
  }, [s, vp]);
  const lumiDot = onCard ?? lumi;

  const onWheel = useCallback((e: WheelEvent) => {
    setBp((b) => Math.min(1, Math.max(0, b + e.deltaY * 0.00022)));
  }, []);

  return (
    <main className="gtl" data-chapter="night" onWheel={onWheel}>
      <picture>
        <source type="image/avif" srcSet="/scenes/meadow-night-960.avif 960w, /scenes/meadow-night-1280.avif 1280w" sizes="100vw" />
        <source type="image/webp" srcSet="/scenes/meadow-night-960.webp 960w, /scenes/meadow-night-1280.webp 1280w" sizes="100vw" />
        <img className="gtl-bg" src="/scenes/meadow-night-1280.webp" alt="" decoding="async" />
      </picture>

      {flowers.map((f) => {
        const open = openOf(s, f.id, f.stage);
        const d = (f.a.r ?? 20) * (0.7 + open * 1.1);
        return (
          <span
            key={f.id}
            className="gtl-flower"
            title={`${f.title} · ${f.kind} · fit ${GARDEN.find((g) => g.job.id === f.id)?.job.fit}`}
            data-kind={f.kind}
            data-target={target?.id === f.id ? "" : undefined}
            data-open={open >= 0.999 ? "full" : open > 0.001 ? "half" : "bud"}
            style={{ transform: `translate3d(${f.a.x}px,${f.a.y}px,0)`, width: d, height: d, ["--lit" as string]: target?.id === f.id ? s.lit : 0 } as CSSProperties}
          >
            <i>{f.kind.slice(0, 1).toUpperCase()}</i>
          </span>
        );
      })}

      {lumiDot ? <span className="gtl-lumi" data-perch={s.lumi?.perch ? "" : undefined} style={{ transform: `translate3d(${lumiDot.x}px,${lumiDot.y}px,0)` }} /> : null}
      {lumi && s.hint > 0 ? (
        <p className="slip-night gtl-note" style={{ transform: `translate3d(${lumi.x + 18}px,${lumi.y - 54}px,0)`, clipPath: `inset(0 ${((1 - s.hint) * 100).toFixed(1)}% 0 0 round var(--r-md))` }}>
          {storyCopy.lumi.notes.explore}
        </p>
      ) : null}

      <GardenSlip ref={slipRef} job={s.target} anchor={target?.a ?? null} show={s.slip} grow={s.card} inset={INSET} />
      {compare ? <JobCard job={s.card >= 1 && target ? s.target : null} anchor={target ? { x: target.a.x, y: target.a.y } : null} onClose={() => setCompare(false)} gap={gapFor(target?.a.r)} anchorRadius={34} inset={INSET} className="gtl-compare" /> : null}

      {ui ? (
        <div className="gtl-bar">
          <div className="gtl-track">
            <span className="gtl-hold" style={{ left: `${H0 * 100}%`, width: `${(H1 - H0) * 100}%` }} />
            <span className="gtl-tour" style={{ left: `${PLAN.t0 * 100}%`, width: `${(PLAN.t1 - PLAN.t0) * 100}%` }} />
            {MARKS.map((m) => (
              <i key={`${m.step}${m.stop}`} style={{ left: `${m.bp * 100}%` }} title={`${m.step}${m.stop >= 0 ? " " + m.stop : ""} · ${fmt(m.bp)}`} />
            ))}
            <input type="range" min={0} max={1} step={0.0005} value={bp} onChange={(e) => setBp(Number(e.target.value))} aria-label="Explore beat progress" />
          </div>
          <p className="gtl-read">
            <b>bp {fmt(bp)}</b> · <b>{s.step}</b>
            {s.stop >= 0 ? ` ${s.stop}` : ""} {s.step !== "rest" && s.step !== "free" ? `(${Math.round(s.stepP * 100)}%)` : ""} · target {s.target?.id ?? "none"} · open {s.open === null ? "stage" : s.open.toFixed(2)} · slip {s.slip.toFixed(2)} · card {s.card.toFixed(2)} · lumi {s.lumi ? `${s.lumi.id}${s.lumi.perch ? " perched on the card" : ""}` : "its own"} · hint {s.hint.toFixed(2)} · {s.free ? "free explore" : "tour"}
          </p>
          <button type="button" aria-pressed={compare} onClick={() => setCompare((c) => !c)}>
            {compare ? "Hide JobCard" : "Compare JobCard"}
          </button>
        </div>
      ) : null}
      <span className="gtl-cap">Illustrative data</span>
    </main>
  );
}
