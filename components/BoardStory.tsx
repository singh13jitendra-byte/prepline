"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState } from "react";
import { boardColumns, storySteps } from "@/lib/content";
import { ease } from "./fx";
import { Check, Sparkle } from "./Icons";

const ghosts: Record<(typeof boardColumns)[number], string[]> = {
  Saved: ["Paisa Labs", "Lumen Studio"],
  Applied: ["Northwell Care", "Orbit Bank"],
  Interview: ["Fable Learning"],
  Offer: [],
};

/** Pinned, scroll-driven story: one card travels across the board while the steps advance. */
export function BoardStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setStep(Math.min(storySteps.length - 1, Math.max(0, Math.floor(v * storySteps.length * 0.999))));
  });

  return (
    <section ref={ref} id="how" aria-label="How it works" className="relative h-[360vh]">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden pt-16 lg:pt-0">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-5 px-5 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-14">
          <div className="order-2 lg:order-1">
            <span className="text-[13px] font-semibold text-accent">How it works</span>
            <h2 className="mt-1 text-[28px] font-medium leading-[1.05] tracking-[-0.04em] text-balance md:mt-2 md:text-[48px]">
              From match to offer, on one board.
            </h2>
            <ol className="mt-3 flex flex-col md:mt-8 md:gap-1">
              {storySteps.map((s, i) => (
                <StepRow key={s.label} index={i} active={i === step} done={i < step} progress={scrollYProgress} step={s} />
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted md:mt-4">Illustrative example.</p>
          </div>

          <div className="order-1 lg:order-2">
            <Board step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StepRow({
  index,
  active,
  done,
  progress,
  step,
}: {
  index: number;
  active: boolean;
  done: boolean;
  progress: MotionValue<number>;
  step: (typeof storySteps)[number];
}) {
  const n = storySteps.length;
  const fill = useTransform(progress, [index / n, (index + 1) / n], ["0%", "100%"]);
  return (
    <li className="relative pl-5">
      <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[2px] overflow-hidden rounded-full bg-line">
        <motion.span style={{ height: fill }} className="block w-full bg-accent" />
      </span>
      <motion.div animate={{ opacity: active ? 1 : done ? 0.55 : 0.4 }} transition={{ duration: 0.4 }} className="py-1.5 md:py-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold text-muted">{step.label}</span>
          <span className="text-base font-medium tracking-tight md:text-lg">{step.title}</span>
        </div>
        <AnimatePresence initial={false}>
          {active && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease }}
              className="overflow-hidden text-sm leading-relaxed text-muted md:text-[15px]"
            >
              <span className="block pt-1">{step.body}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  );
}

function Board({ step }: { step: number }) {
  return (
    <div className="relative">
      <div className="rounded-[28px] border border-line bg-surface p-3 shadow-[0_40px_80px_-50px_rgba(27,25,22,0.45)] md:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm font-semibold">Ananya’s board</span>
          <span className="rounded-full bg-sunk px-2.5 py-1 text-xs text-muted">Week {step + 1} of 4</span>
        </div>
        <LayoutGroup>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {boardColumns.map((col, ci) => (
              <div key={col} className="flex min-h-[104px] flex-col gap-2 rounded-2xl bg-canvas p-2 md:min-h-[260px]">
                <div className="flex items-center justify-between px-1 pt-0.5 text-xs font-medium text-muted">
                  <span>{col}</span>
                  <span className="hidden md:inline">{ghosts[col].length + (ci === step ? 1 : 0)}</span>
                </div>
                {ci === step && <HeroCard step={step} />}
                {ghosts[col].map((g) => (
                  <div key={g} className="hidden rounded-xl border border-line bg-surface px-2.5 py-2 text-xs text-muted md:block">
                    <div className="h-1.5 w-12 rounded-full bg-sunk" />
                    <div className="mt-1.5 truncate">{g}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <AnimatePresence>
        {step >= 2 && (
          <motion.div
            key="prep"
            initial={{ opacity: 0, y: 30, scale: 0.94, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: -1.5 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="absolute -bottom-10 right-2 hidden w-[300px] rounded-2xl border border-line bg-surface p-4 shadow-[0_30px_60px_-30px_rgba(27,25,22,0.55)] sm:block md:-right-6"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Sparkle className="size-4 text-accent" />
              Prep sheet ready
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {["Scaling components across two products", "What you pushed back on, and why", "Designing for distrustful patients"].map(
                (q, i) => (
                  <motion.li
                    key={q}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.12 }}
                    className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-2 text-xs"
                  >
                    <span className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${step >= 3 ? "bg-accent text-white" : "bg-sunk"}`}>
                      {step >= 3 && <Check className="size-3" />}
                    </span>
                    {q}
                  </motion.li>
                )
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroCard({ step }: { step: number }) {
  const offer = step === 3;
  return (
    <motion.div
      layoutId="kestrel"
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className={`relative rounded-xl border p-2.5 text-xs shadow-[0_14px_30px_-16px_rgba(180,83,9,0.55)] ${
        offer ? "border-[#7ee2a8] bg-[#ecfbf2]" : "border-accent-line bg-accent-soft"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">Kestrel Health</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${offer ? "bg-[#1f7a4d] text-white" : "bg-accent text-white"}`}>
          9/10
        </span>
      </div>
      <div className="mt-1 text-muted">Senior Product Designer</div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${offer ? "bg-[#1f7a4d] text-white" : "bg-surface text-accent"}`}
        >
          {["Fits your case studies", "Applied Tue", "Thu 11:40 · sheet ready", "Offer received"][step]}
        </motion.div>
      </AnimatePresence>
      {offer && <Burst />}
    </motion.div>
  );
}

const sparks = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const d = 34 + (i % 3) * 12;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, c: ["#b45309", "#7ee2a8", "#ffd77a", "#3f7fc4"][i % 4] };
});

/** A small celebratory burst when the offer lands. */
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute size-1.5 rounded-full"
          style={{ background: s.c }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        />
      ))}
    </span>
  );
}
