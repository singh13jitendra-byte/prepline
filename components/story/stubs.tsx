"use client";

/**
 * STUB ACTS — placeholders so the whole story scrolls end to end before the
 * real acts and the world land. Delete this file at integration.
 *
 * Each real act replaces one stub and must keep: the same <Stage act>, the same
 * anchor ids, and real DOM faces in <FaceSlot>s. Until <World /> exists the
 * stub stages paint their own night/day background and StubLine draws the line.
 */

import { useEffect, useRef } from "react";
import { useAnchor, type AnchorId } from "@/lib/anchors";
import { story as copy } from "@/lib/content";
import { definePerformance } from "@/lib/perform";
import { BEATS, story } from "@/lib/story";
import { WaitlistForm } from "../WaitlistForm";
import { FaceSlot } from "./FaceSlot";
import { Panel, Stage } from "./Stage";

function Mark({ id, className, children, inline }: { id: AnchorId; className?: string; children?: React.ReactNode; inline?: boolean }) {
  const ref = useAnchor(id);
  const Tag = inline ? "span" : "div";
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** Beat id and progress, written straight to the DOM by the store. */
function Readout({ act }: { act: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      story.subscribe((s) => {
        if (ref.current && s.act === act) ref.current.textContent = `${s.beat} · ${s.beatProgress.toFixed(2)}`;
      }),
    [act],
  );
  return (
    <div ref={ref} data-stub-readout className="only-motion type-mono absolute left-6 top-6 z-10 opacity-70">
      {act}
    </div>
  );
}

const STUB_CSS = `
        html.motion .stub-stage[data-chapter="night"]{background:var(--color-night);color:#fff}
        html.motion .stub-stage[data-chapter="day"]{background:var(--color-canvas);color:var(--color-ink)}
        html:not(.motion) .stub-stage .story-panel{padding-top:48px;padding-bottom:48px}
      `;

const stage = "stub-stage";
const panel = "grid h-full grid-cols-1 items-center gap-8 px-6 py-16 md:grid-cols-12 md:px-16";
const left = "md:col-span-5";
const right = "relative flex flex-col items-center md:col-span-6 md:col-start-7";

export function StubActs() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STUB_CSS }} />

      {/* ── Act III: Prep ── */}
      <Stage act="prep" labelledBy="prep-title" stageClassName={stage}>
        <Readout act="prep" />
        <Panel beats={["unfold", "q1", "q2", "q3", "votes"]} className={panel}>
          <div className={left}>
            <p className="type-mono opacity-70">{copy.unfold.label}</p>
            <h2 id="prep-title" className="type-h2 mt-4">
              {copy.unfold.h2}
            </h2>
          </div>
          <div className={right}>
            <div className="relative" style={{ width: "min(100%, 560px, calc((100svh - 140px) * 560 / 720))" }}>
              <FaceSlot anchor="sheet" face="sheet" skin="night" className="!w-full">
                <article className="absolute inset-0 rounded-[20px] bg-paper p-[6%] text-ink">
                  <p className="type-mono text-muted">stub sheet</p>
                  <ol className="mt-[38%] flex flex-col gap-[14%] text-[14px]">
                    <li>{copy.q1.question}</li>
                    <li>{copy.q2.question}</li>
                    <li>{copy.q3.question}</li>
                  </ol>
                </article>
              </FaceSlot>
              <div className="only-motion absolute inset-x-0 top-0 h-1/3">
                <FaceSlot anchor="sheet-folded" face="sheet" skin="night" fold={0} showWhenStatic={false} className="!aspect-auto !h-full !w-full" />
              </div>
              <Mark id="sheet-q1" className="absolute left-[6%] top-[48%] h-px w-[70%]" />
              <Mark id="sheet-q2" className="absolute left-[6%] top-[64%] h-px w-[70%]" />
              <Mark id="sheet-q3" className="absolute left-[6%] top-[80%] h-px w-[70%]" />
              <Mark id="sheet-foot" className="absolute bottom-[5%] left-[6%] h-px w-[30%]" />
            </div>
          </div>
        </Panel>
      </Stage>

      {/* ── Act IV: Seat ── */}
      <Stage act="seat" labelledBy="join-title" stageClassName={stage}>
        <Readout act="seat" />
        <Panel beats={["seat", "footer"]} focusable className={panel}>
          <div className="md:col-span-6">
            <h2 id="join-title" className="type-display-xl">
              {copy.seat.h2}{" "}
              <span className="relative inline-block font-serif italic text-accent">
                {copy.seat.h2Accent}
                <Mark id="ready-underline" inline className="absolute -bottom-1 left-0 h-[3px] w-full max-w-[220px]" />
              </span>
            </h2>
            <p className="type-body mt-6 max-w-[440px] text-muted">{copy.seat.body}</p>
          </div>
          <div className={right}>
            <FaceSlot anchor="ticket" face="ticket" skin="day">
              <div className="absolute inset-0 flex flex-col justify-between rounded-3xl border border-line bg-paper p-6">
                <p className="type-mono text-muted">{copy.seat.ticketHeader}</p>
                <WaitlistForm />
                <p className="text-[13px] text-muted">{copy.seat.ticketFoot}</p>
              </div>
            </FaceSlot>
          </div>
        </Panel>
      </Stage>
    </>
  );
}

/**
 * One dot per beat, each lit by a 0.8s stub performance. Shows (and lets
 * scripts/check-story.py assert) the runner's rules: play on forward entry, end
 * state when passed or entered backward, reset when left backward.
 */
export function StubPerformances() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const offs = BEATS.map((b) => {
      const dot = host.querySelector<HTMLElement>(`[data-perf-light="${b.id}"]`);
      return dot ? definePerformance(b.id, (tl) => tl.fromTo(dot, { opacity: 0.15, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.8, ease: "expo.out" })) : () => {};
    });
    return () => offs.forEach((off) => off());
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className="only-motion pointer-events-none fixed bottom-4 right-4 flex gap-1.5 rounded-full bg-black/60 px-3 py-2" style={{ zIndex: "var(--z-nav)" }}>
      {BEATS.map((b) => (
        <span key={b.id} data-perf-light={b.id} title={b.id} className="block size-2 rounded-full bg-gold" style={{ opacity: 0.15 }} />
      ))}
    </div>
  );
}

/** A plain gold bar that follows story.line, until the World's <Line /> replaces it. */
export function StubLine() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      story.frame("line", (_t, _dt, s) => {
        const el = ref.current;
        if (!el) return;
        const { x0, x1, y, weight, label } = s.line;
        el.style.transform = `translate3d(${x0.toFixed(1)}px,${(y - weight / 2).toFixed(1)}px,0)`;
        el.style.width = `${Math.max(0, x1 - x0).toFixed(1)}px`;
        el.style.height = `${Math.max(1, weight).toFixed(1)}px`;
        el.style.background = s.chapter === "night" || s.line.sweep ? "var(--color-gold)" : "var(--color-accent)";
        if (labelRef.current && labelRef.current.textContent !== label) labelRef.current.textContent = label;
      }),
    [],
  );
  return (
    <div ref={ref} aria-hidden="true" data-stub-line className="only-motion pointer-events-none fixed left-0 top-0" style={{ zIndex: "var(--z-line)" }}>
      <span ref={labelRef} className="type-mono absolute bottom-1.5 right-3 whitespace-nowrap text-gold mix-blend-difference" />
    </div>
  );
}

export function StubFooter() {
  return (
    <footer className="relative border-t border-gold/60 bg-ink px-6 py-16 text-canvas md:px-16" style={{ minHeight: "60vh", zIndex: "var(--z-acts)" }}>
      <p className="type-body max-w-[420px]">{copy.footer.left}</p>
      <ul className="mt-8 flex flex-wrap gap-6 text-[15px]">
        {copy.footer.links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="underline-offset-4 hover:underline focus-visible:underline">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="type-mono mt-16 opacity-50">{copy.footer.last}</p>
    </footer>
  );
}
