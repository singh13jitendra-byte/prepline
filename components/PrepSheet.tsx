"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { prepQuestions, prepTabs } from "@/lib/content";
import { ease, Rise } from "./fx";
import { ScrollWords } from "./ScrollWords";

type Tab = (typeof prepTabs)[number];
type Vote = "asked" | "not" | undefined;

export function PrepSheetSection() {
  return (
    <section
      id="prep"
      className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16"
    >
      <Rise className="flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-accent">Prep sheets</span>
        <ScrollWords
          text="Your interview, already prepped."
          className="text-[34px] font-medium leading-[1.05] tracking-[-0.04em] text-balance md:text-[48px]"
        />
        <p className="max-w-[460px] text-[17px] leading-relaxed text-muted">
          Every question says where it came from: the job description, your own case studies, or what this company asked
          designers before. Try it: switch tabs, then tell us what came up.
        </p>
        <div className="mt-2 grid max-w-[440px] grid-cols-3 gap-3">
          {[
            ["12", "questions per sheet"],
            ["4", "design-round types"],
            ["1 tap", "to log what was asked"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-line bg-surface p-3">
              <div className="text-xl font-semibold tracking-tight">{n}</div>
              <div className="text-xs text-muted">{l}</div>
            </div>
          ))}
        </div>
      </Rise>
      <Rise delay={0.15}>
        <PrepSheet />
      </Rise>
    </section>
  );
}

function PrepSheet() {
  const [tab, setTab] = useState<Tab>("Likely questions");
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const items = prepQuestions[tab];
  const asked = items.filter((it) => votes[it.q] === "asked").length;

  return (
    <div
      ref={ref}
      className="relative flex flex-col gap-4 rounded-[28px] border border-line bg-surface p-5 shadow-[0_40px_80px_-50px_rgba(27,25,22,0.5)] md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight">Senior Product Designer</div>
          <div className="text-[13px] text-muted">Kestrel Health · Interview Thu 11:40</div>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent">9/10 fit</span>
      </div>

      <div role="tablist" aria-label="Prep sheet sections" className="flex flex-wrap gap-1 rounded-full bg-sunk p-1 text-[13px]">
        {prepTabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            className={`relative min-h-9 flex-1 rounded-full px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              t === tab ? "text-white" : "text-muted hover:text-ink"
            }`}
          >
            {t === tab && (
              <motion.span
                layoutId="prep-tab"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab} className="min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.ul
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease }}
            className="flex flex-col gap-2.5"
          >
            {items.map((it, i) => (
              <li key={it.q} className="rounded-2xl bg-canvas p-3.5">
                <Typed text={it.q} start={inView} delay={i * 650} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">{it.why}</span>
                  <span className="flex gap-1.5">
                    <VoteButton
                      kind="asked"
                      active={votes[it.q] === "asked"}
                      onClick={() => setVotes((v) => ({ ...v, [it.q]: v[it.q] === "asked" ? undefined : "asked" }))}
                    />
                    <VoteButton
                      kind="not"
                      active={votes[it.q] === "not"}
                      onClick={() => setVotes((v) => ({ ...v, [it.q]: v[it.q] === "not" ? undefined : "not" }))}
                    />
                  </span>
                </div>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px] text-muted" aria-live="polite">
        <span>
          {asked > 0 ? "Thanks. That makes the next sheet for this company sharper." : "After the interview, mark what came up. Votes stay anonymous."}
        </span>
        <motion.span
          key={asked}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 font-semibold tabular-nums text-accent"
        >
          {asked}/{items.length} asked
        </motion.span>
      </div>
    </div>
  );
}

const dots = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { x: Math.cos(a) * 22, y: Math.sin(a) * 18 };
});

function VoteButton({ kind, active, onClick }: { kind: "asked" | "not"; active: boolean; onClick: () => void }) {
  const [burst, setBurst] = useState(0);
  const on = kind === "asked" ? "border-accent bg-accent-soft text-accent" : "border-ink bg-ink text-white";
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        if (!active && kind === "asked") setBurst((b) => b + 1);
        onClick();
      }}
      className={`relative h-8 rounded-full border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? on : "border-line bg-surface text-ink hover:border-ink/40"
      }`}
    >
      {kind === "asked" ? "Asked" : "Not asked"}
      <AnimatePresence>
        {burst > 0 && active && (
          <span key={burst} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
            {dots.map((d, i) => (
              <motion.span
                key={i}
                className="absolute size-1 rounded-full bg-accent"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: d.x, y: d.y, opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            ))}
          </span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Types the question out once in view, as if the sheet is being written live. */
function Typed({ text, start, delay }: { text: string; start: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let interval = 0;
    const timer = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setShown((n) => {
          if (n >= text.length) {
            window.clearInterval(interval);
            return n;
          }
          return n + 2;
        });
      }, 16);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [start, delay, text, reduce]);

  const done = shown >= text.length;
  return (
    <p className="text-[15px] leading-snug">
      <span className="sr-only">{text}</span>
      <span aria-hidden className={done || !start ? "" : "caret"}>
        {start ? text.slice(0, shown) : " "}
      </span>
    </p>
  );
}
