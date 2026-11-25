"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { matches } from "@/lib/content";
import { ease, Rise } from "./fx";

export function Bento() {
  return (
    <section id="features" className="rounded-[var(--radius-panel)] bg-surface py-24 md:py-32">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Rise className="mx-auto mb-14 max-w-[720px] text-center">
          <span className="text-[13px] font-semibold text-accent">For designers</span>
          <h2 className="mt-2 text-[34px] font-medium leading-[1.05] tracking-[-0.04em] text-balance md:text-[48px]">
            Built for how designers actually get hired.
          </h2>
        </Rise>
        <div className="grid gap-4 lg:grid-cols-6">
          <Card className="lg:col-span-4" title="Reads your portfolio" body="Questions cite your case studies, not a generic list." delay={0}>
            <PortfolioScan />
          </Card>
          <Card className="lg:col-span-2" title="Design rounds included" body="Walkthrough, critique, whiteboard and take-home." delay={0.08}>
            <RoundsFan />
          </Card>
          <Card className="lg:col-span-2" title="Fit you can read" body="Every score out of 10 comes with a reason." delay={0.12}>
            <FitBars />
          </Card>
          <Card className="lg:col-span-4" title="Learns from real interviews" body="Anonymous votes show what each company actually asks." delay={0.16}>
            <VoteChart />
          </Card>
        </div>
      </div>
    </section>
  );
}

function Card({
  title,
  body,
  children,
  className = "",
  delay,
}: {
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease }}
      whileHover={{ y: -4 }}
      className={`group flex flex-col overflow-hidden rounded-[24px] bg-canvas ${className}`}
    >
      <div className="relative h-[220px] overflow-hidden">{children}</div>
      <div className="flex flex-col gap-1 px-6 pb-6 pt-2">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </motion.article>
  );
}

function PortfolioScan() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const lines = ["Problem: family bookings failed at checkout", "Pushed back on single-coupon architecture", "Chose compliance over saved payments"];
  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center gap-4 px-6">
      <div className="relative w-[46%] max-w-[260px] rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 h-2 w-20 rounded-full bg-sunk" />
        {lines.map((l, i) => (
          <motion.div
            key={l}
            className="mb-2 rounded-md px-1.5 py-1 text-[11px] text-muted"
            animate={inView ? { backgroundColor: ["rgba(253,240,220,0)", "rgba(253,240,220,1)"] } : undefined}
            transition={{ delay: 0.6 + i * 0.5, duration: 0.3 }}
          >
            {l}
          </motion.div>
        ))}
        <motion.div
          aria-hidden
          className="absolute inset-x-2 h-8 rounded-lg bg-gradient-to-b from-transparent via-accent/15 to-transparent"
          initial={{ top: 8 }}
          animate={inView ? { top: [8, 120, 8] } : undefined}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="flex w-[46%] max-w-[260px] flex-col gap-2">
        {["What did you push back on, and why?", "Walk us through the coupon decision.", "Why not auto-save payments?"].map((q, i) => (
          <motion.div
            key={q}
            initial={{ opacity: 0, x: -16 }}
            animate={inView ? { opacity: 1, x: 0 } : undefined}
            transition={{ delay: 0.9 + i * 0.5, duration: 0.6, ease }}
            className="rounded-xl bg-ink px-3 py-2 text-[11px] text-white shadow-sm"
          >
            {q}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RoundsFan() {
  const [hover, setHover] = useState(false);
  const rounds = ["Take-home", "Whiteboard", "App critique", "Portfolio walkthrough"];
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {rounds.map((r, i) => {
        const offset = i - (rounds.length - 1) / 2;
        return (
          <motion.div
            key={r}
            initial={{ rotate: 0, x: 0, y: 30, opacity: 0 }}
            whileInView={{ rotate: offset * 6, x: offset * 10, y: 0, opacity: 1 }}
            animate={hover ? { rotate: offset * 12, x: offset * 34, y: Math.abs(offset) * 6 } : undefined}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: hover ? 0 : 0.2 + i * 0.08 }}
            className={`absolute flex h-[130px] w-[140px] flex-col justify-between rounded-2xl border p-3 text-xs shadow-[0_14px_30px_-18px_rgba(27,25,22,0.5)] ${
              i === rounds.length - 1 ? "border-accent-line bg-accent-soft text-accent" : "border-line bg-surface text-ink"
            }`}
            style={{ zIndex: i }}
          >
            <span className="h-1.5 w-8 rounded-full bg-current opacity-30" />
            <span className="font-semibold">{r}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function FitBars() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3 px-6">
      {matches.map((m, i) => (
        <div key={m.company} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium">{m.company}</span>
            <span className="tabular-nums text-muted">{m.score}/10</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunk">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              whileInView={{ width: `${m.score * 10}%` }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.1, delay: 0.2 + i * 0.15, ease }}
            />
          </div>
          {i === 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.2 }}
              className="text-[11px] text-muted"
            >
              {m.reason}
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

function VoteChart() {
  const bars = [
    { q: "Scaling a design system", v: 82 },
    { q: "A decision you pushed back on", v: 64 },
    { q: "Designing for trust", v: 48 },
    { q: "Metrics you moved", v: 36 },
    { q: "Working with engineering", v: 30 },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5 px-6 md:px-8">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="font-medium text-ink">Most asked at Kestrel Health</span>
        <span>Sample data</span>
      </div>
      {bars.map((b, i) => (
        <div key={b.q} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs">
          <div className="relative h-7 overflow-hidden rounded-lg bg-surface">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-lg bg-accent-soft"
              initial={{ width: 0 }}
              whileInView={{ width: `${b.v}%` }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1, delay: 0.15 + i * 0.1, ease }}
            />
            <span className="relative flex h-full items-center px-2.5 text-ink">{b.q}</span>
          </div>
          <span className="w-9 text-right tabular-nums text-muted">{b.v}%</span>
        </div>
      ))}
    </div>
  );
}
