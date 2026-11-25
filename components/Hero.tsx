"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BETA_SEATS, HERO_VIDEO_SRC, heroToasts, matches } from "@/lib/content";
import { CountUp, ease } from "./fx";
import { HeroLight } from "./gl/HeroLight";
import { HeroStage, type StageState } from "./gl/HeroStage";
import { prefersReducedMotion } from "@/lib/gl";
import { gsap, SplitText } from "@/lib/gsap";
import { onReveal } from "@/lib/intro";
import { Sparkle } from "./Icons";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<StageState>("pending");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  useMotionValueEvent(scrollYProgress, "change", (v) => (scrollRef.current = v));

  useEffect(() => {
    if (reduce) videoRef.current?.pause();
  }, [reduce]);

  // Kinetic entrance: letters drop in on their own baselines once the curtain lifts.
  useEffect(() => {
    const root = textRef.current;
    if (!root) return;
    const html = document.documentElement;
    if (prefersReducedMotion()) {
      html.classList.remove("hp");
      return;
    }
    const ctx = gsap.context(() => {
      const splits = gsap.utils.toArray<HTMLElement>("[data-line]").map((el) =>
        SplitText.create(el, { type: "chars", charsClass: "hchar" }),
      );
      const chars = splits.flatMap((s) => s.chars);
      const ready = root.querySelector("[data-ready]");
      const line = root.querySelector<SVGPathElement>("[data-underline]");
      const rest = root.querySelectorAll("[data-rise]");
      gsap.set(chars, { yPercent: 118, rotate: 9, transformOrigin: "0% 100%" });
      gsap.set(ready, { autoAlpha: 0, scale: 0.4, rotate: -14, y: 30 });
      gsap.set(rest, { autoAlpha: 0, y: 22 });
      if (line) gsap.set(line, { strokeDasharray: 240, strokeDashoffset: 240 });
      html.classList.remove("hp");

      onReveal(() => {
        const tl = gsap.timeline({ delay: 0.25 });
        tl.to(chars, {
          yPercent: 0,
          rotate: 0,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.028,
          clearProps: "transform",
        })
          .to(ready, { autoAlpha: 1, scale: 1, rotate: 0, y: 0, duration: 1.3, ease: "elastic.out(1, 0.55)" }, "-=0.55")
          .to(line, { strokeDashoffset: 0, duration: 0.9, ease: "power3.inOut" }, "-=0.8")
          .to(rest, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 }, "-=1.1");
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const glReady = stage === "ready";

  return (
    <section
      ref={ref}
      id="top"
      aria-label="Prepline"
      className="relative isolate overflow-hidden rounded-[var(--radius-panel)] bg-night"
    >
      <div aria-hidden className="absolute inset-0 -z-20 bg-gradient-to-b from-[#3f7fc4] via-[#8bbbe6] to-[#dceaf4]" />
      <motion.video
        ref={videoRef}
        aria-hidden
        style={{ scale: videoScale }}
        className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700 ${glReady ? "opacity-0" : ""}`}
        src={HERO_VIDEO_SRC}
        crossOrigin="anonymous"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div
        aria-hidden
        className={`absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_45%,rgba(10,30,60,0.55),rgba(10,30,60,0.15)_60%),linear-gradient(180deg,rgba(10,30,60,0.35),rgba(10,30,60,0)_35%,rgba(10,30,60,0)_60%,rgba(10,30,60,0.55))] transition-opacity duration-700 ${glReady ? "opacity-0" : ""}`}
      />
      <HeroStage videoRef={videoRef} slotRef={slotRef} scrollRef={scrollRef} onState={setStage} />
      <HeroLight />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="pointer-events-none mx-auto grid min-h-[min(100svh,1000px)] max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-5 pb-16 pt-28 md:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-6 lg:pb-20"
      >
        <div ref={textRef} className="pointer-events-auto flex min-w-0 flex-col items-start gap-6 text-white">
          <a
            href="#join"
            data-rise
            data-hero-hide
            className="inline-flex items-center gap-2.5 rounded-full border border-white/30 bg-white/10 py-1.5 pl-2 pr-4 text-[13px] backdrop-blur-md hover:bg-white/15"
          >
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#7ee2a8] opacity-70 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[#7ee2a8]" />
            </span>
            Private beta · {BETA_SEATS} designer seats
          </a>

          <h1
            data-hero-hide
            className="text-[54px] font-medium leading-[0.9] tracking-[-0.055em] sm:text-[76px] lg:text-[clamp(68px,7.2vw,118px)]"
          >
            <span className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
              <span data-line className="block">
                Find the
              </span>
            </span>
            <span className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
              <span data-line className="block whitespace-nowrap">
                right roles.
              </span>
            </span>
            <span className="block whitespace-nowrap">
              <span className="-mb-[0.1em] inline-block overflow-hidden pb-[0.1em] align-bottom">
                <span data-line className="inline-block">
                  Walk in
                </span>
              </span>{" "}
              <span data-ready className="relative inline-block">
                <span className="inline-block font-serif font-normal italic tracking-[-0.01em] text-[#ffd77a]">ready.</span>
                <svg
                  aria-hidden
                  viewBox="0 0 220 24"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-[0.12em] w-full text-[#ffd77a]"
                >
                  <path
                    data-underline
                    d="M3 15 C 60 4, 130 4, 217 13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={4}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </span>
            </span>
          </h1>

          <p data-rise data-hero-hide className="max-w-[480px] text-[17px] leading-relaxed text-white/90 md:text-lg">
            The job-search copilot for product designers. Roles ranked by portfolio fit, one board for your pipeline, and a
            prep sheet the moment an interview is booked.
          </p>

          <div data-rise data-hero-hide className="w-full max-w-[520px]">
            <WaitlistForm tone="glass" />
            <p className="-mt-1 pl-5 text-[13px] text-white/80">No auto-apply. Your portfolio is never stored.</p>
          </div>
        </div>

        <div ref={slotRef} className="relative mx-auto h-[300px] w-full max-w-[460px] sm:h-[360px] lg:h-[460px] lg:max-w-[520px]">
          {stage === "fallback" && <MatchesCard />}
          {stage === "ready" && <Toasts />}
        </div>
      </motion.div>

      <motion.a
        href="#matching"
        aria-label="Scroll to how matching works"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block"
      >
        <span className="flex h-10 w-6 justify-center rounded-full border border-white/50 pt-2">
          <motion.span
            className="h-2 w-1 rounded-full bg-white"
            animate={reduce ? undefined : { y: [0, 12, 0], opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </span>
      </motion.a>
    </section>
  );
}

/** Glass card of ranked roles that tilts toward the pointer, with notifications cycling beside it. */
function MatchesCard() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 160, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 160, damping: 18 });
  const glareX = useTransform(mx, [-0.5, 0.5], ["20%", "80%"]);
  const glare = useTransform(glareX, (x) => `radial-gradient(circle at ${x} 0%, rgba(255,255,255,0.22), transparent 55%)`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, delay: 0.6, ease }}
      className="relative mx-auto w-full max-w-[460px] [perspective:1200px]"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative flex flex-col gap-1.5 rounded-[26px] border border-white/30 bg-[rgba(10,30,60,0.45)] p-4 text-white shadow-[0_40px_80px_-30px_rgba(5,15,35,0.8)] backdrop-blur-2xl"
      >
        <motion.div aria-hidden style={{ background: glare }} className="pointer-events-none absolute inset-0 rounded-[26px]" />
        <div className="flex items-center justify-between px-1 pb-2 text-[13px]">
          <span className="flex items-center gap-2 font-semibold">
            <Sparkle className="size-4 text-[#ffd77a]" />
            Your matches
          </span>
          <span className="text-white/80">This week</span>
        </div>
        {matches.map((m, i) => (
          <motion.div
            key={m.company}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 1 + i * 0.15, ease }}
            whileHover={{ scale: 1.015, backgroundColor: "rgba(255,255,255,0.14)" }}
            style={{ transform: "translateZ(30px)" }}
            className={`flex items-center gap-3 rounded-2xl p-2.5 ${i === 0 ? "bg-white/12" : ""}`}
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[13px] font-semibold text-[#7a5121]">
              {m.initials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{m.title}</span>
              <span className="truncate text-xs text-white/80">
                {m.company} · {m.city}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums" aria-label={`Fit ${m.score} out of 10`}>
                <CountUp to={m.score} delay={1.1 + i * 0.15} />
                /10
              </span>
              <span className="h-1 w-12 overflow-hidden rounded-full bg-white/20" aria-hidden>
                <motion.span
                  className="block h-full rounded-full bg-[#7ee2a8]"
                  initial={{ width: 0 }}
                  animate={{ width: `${m.score * 10}%` }}
                  transition={{ duration: 1.1, delay: 1.1 + i * 0.15, ease }}
                />
              </span>
            </span>
          </motion.div>
        ))}
        <p className="pt-1.5 text-center text-xs text-white/80">and 9 more ranked for you</p>
      </motion.div>
      <Toasts />
    </motion.div>
  );
}

function Toasts() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % heroToasts.length), 3600);
    return () => window.clearInterval(t);
  }, [reduce]);
  const toast = heroToasts[i];

  return (
    <div className="pointer-events-none absolute -bottom-10 -left-4 sm:-left-10" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={toast.title}
          initial={{ opacity: 0, y: 14, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: i === 0 ? 2 : 0 }}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-3.5 py-3 text-ink shadow-[0_20px_40px_-20px_rgba(10,30,60,0.6)] backdrop-blur-xl"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sparkle className="size-4" />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold">{toast.title}</span>
            <span className="text-xs text-muted">{toast.body}</span>
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
