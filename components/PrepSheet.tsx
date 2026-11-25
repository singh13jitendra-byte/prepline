"use client";

import { useEffect, useState } from "react";
import { prepQuestions, prepTabs } from "@/lib/content";
import { prefersReducedMotion, Reveal, useInView } from "./Reveal";

type Tab = (typeof prepTabs)[number];
type Vote = "asked" | "not" | undefined;

export function PrepSheetSection() {
  return (
    <section
      id="prep"
      className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 py-24 md:grid-cols-2 md:gap-14 md:px-7 md:py-28"
    >
      <Reveal className="flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-accent">Prep sheets</span>
        <h2 className="text-[34px] font-medium leading-[1.1] tracking-[-0.035em] text-balance md:text-[44px]">
          Your interview, already prepped.
        </h2>
        <p className="max-w-[460px] text-[17px] text-muted">
          Move a card to Interview scheduled and the sheet is waiting. Every question says where it came from.
        </p>
        <p className="mt-3 text-xl leading-relaxed tracking-[-0.01em] md:text-[22px]">
          This week <Chip>5 roles</Chip> scored 8 or higher. <Chip accent>Kestrel Health · Thu 11:40</Chip> is next,
          and afterwards one tap says which questions came up.
        </p>
      </Reveal>
      <Reveal delay={120}>
        <PrepSheet />
      </Reveal>
    </section>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 align-middle text-[0.8em] ${
        accent ? "bg-accent-soft text-accent" : "bg-sunk"
      }`}
    >
      {children}
    </span>
  );
}

function PrepSheet() {
  const [tab, setTab] = useState<Tab>("Likely questions");
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const items = prepQuestions[tab];
  const asked = items.filter((it) => votes[it.q] === "asked").length;

  return (
    <div ref={ref} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_60px_-32px_rgba(27,25,22,0.35)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight">Senior Product Designer</div>
          <div className="text-[13px] text-muted">Kestrel Health · Interview Thu 11:40</div>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent">9/10</span>
      </div>

      <div role="tablist" aria-label="Prep sheet sections" className="flex flex-wrap gap-1.5 text-[13px]">
        {prepTabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            className={`min-h-9 rounded-full px-3.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              t === tab ? "bg-ink text-white" : "bg-sunk text-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ul role="tabpanel" aria-label={tab} className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <li key={it.q} className="rounded-2xl bg-canvas p-3.5">
            <Typed text={it.q} start={inView} delay={i * 650} resetKey={tab} />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">{it.why}</span>
              <span className="flex gap-1.5">
                <VoteButton active={votes[it.q] === "asked"} onClick={() => setVotes((v) => ({ ...v, [it.q]: v[it.q] === "asked" ? undefined : "asked" }))}>
                  Asked
                </VoteButton>
                <VoteButton active={votes[it.q] === "not"} muted onClick={() => setVotes((v) => ({ ...v, [it.q]: v[it.q] === "not" ? undefined : "not" }))}>
                  Not asked
                </VoteButton>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-line pt-3 text-[13px] text-muted" aria-live="polite">
        {asked > 0
          ? `${asked} of ${items.length} marked as asked. That makes the next sheet for this company sharper.`
          : "After the interview, mark which questions came up. Votes stay anonymous."}
      </p>
    </div>
  );
}

function VoteButton({
  active,
  muted,
  onClick,
  children,
}: {
  active: boolean;
  muted?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const on = muted ? "border-ink bg-ink text-white" : "border-accent bg-accent-soft text-accent";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? on : "border-line bg-surface text-ink hover:border-ink/40"
      }`}
    >
      {children}
    </button>
  );
}

/** Types the question out once in view, as if the sheet is being written live. */
function Typed({ text, start, delay, resetKey }: { text: string; start: boolean; delay: number; resetKey: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
  }, [resetKey]);

  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setShown(text.length);
      return;
    }
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
      }, 18);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [start, delay, text, resetKey]);

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
