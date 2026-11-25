"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO_SRC, matches, navLinks, type Match } from "@/lib/content";
import { prefersReducedMotion, useInView } from "./Reveal";
import { ArrowRight, Logo } from "./Icons";

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Keep the background still for people who ask for less motion.
    if (prefersReducedMotion()) videoRef.current?.pause();
  }, []);

  return (
    <section
      aria-label="Prepline"
      className="relative isolate flex min-h-[640px] flex-col overflow-hidden rounded-[var(--radius-panel)] md:min-h-[760px]"
    >
      {/* Fallback sky shows until (or if) the video loads. */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-gradient-to-b from-[#3f7fc4] via-[#8bbbe6] to-[#dceaf4]" />
      <video
        ref={videoRef}
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        src={HERO_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,30,60,0.28)_0%,rgba(10,30,60,0)_30%,rgba(10,30,60,0)_65%,rgba(10,30,60,0.3)_100%)]"
      />

      <header className="flex items-center justify-between gap-4 px-5 py-5 md:px-7">
        <a href="#top" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
          <Logo />
          Prepline
        </a>
        <nav
          aria-label="Sections"
          className="hidden items-center gap-1 rounded-full border border-white/30 bg-[rgba(10,30,60,0.3)] p-1 text-sm text-white backdrop-blur-xl md:flex"
        >
          {navLinks.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 transition hover:bg-white/15 ${i === 0 ? "bg-white/15" : ""}`}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href="#join"
          className="inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-medium text-ink transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Join the beta
        </a>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 px-5 pb-10 pt-6">
        <MatchesCard />
        <a
          href="#join"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-ink shadow-sm transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Join the beta <ArrowRight />
        </a>
      </div>
    </section>
  );
}

function MatchesCard() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div
      ref={ref}
      className="flex w-full max-w-[440px] flex-col gap-1.5 rounded-[22px] border border-white/30 bg-[rgba(10,30,60,0.42)] p-4 text-white shadow-[0_20px_60px_-20px_rgba(10,30,60,0.6)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-1 pb-2 text-[13px]">
        <span className="font-semibold">Your matches</span>
        <span className="text-white/85">This week</span>
      </div>
      {matches.map((m, i) => (
        <MatchRow key={m.company} match={m} first={i === 0} start={inView} delay={i * 180} />
      ))}
      <p className="pt-1.5 text-center text-xs text-white/85">and 9 more ranked for you</p>
    </div>
  );
}

function MatchRow({ match, first, start, delay }: { match: Match; first: boolean; start: boolean; delay: number }) {
  const score = useCountUp(match.score, start, delay);
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-2.5 ${first ? "bg-white/12" : ""}`}>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[13px] font-semibold text-[#7a5121]">
        {match.initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{match.title}</span>
        <span className="truncate text-xs text-white/85">
          {match.company} · {match.city}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-sm font-semibold tabular-nums" aria-label={`Fit ${match.score} out of 10`}>
          {score}/10
        </span>
        <span className="text-xs text-white/85">{match.mode}</span>
      </span>
    </div>
  );
}

/** Counts from 0 to `to` once `start` is true; jumps straight there under reduced motion. */
function useCountUp(to: number, start: boolean, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    let raf = 0;
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to, start, delay]);
  return value;
}
