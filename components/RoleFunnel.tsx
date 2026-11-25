"use client";

import { useEffect, useRef } from "react";
import { funnelStages } from "@/lib/content";
import { isSmallScreen, mountGL, prefersReducedMotion, type GLController } from "@/lib/gl";
import { gsap } from "@/lib/gsap";
import { buildFunnelScene } from "./gl/funnelScene";

const fmt = new Intl.NumberFormat("en-IN");
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
/** Count shown for a scroll progress, timed to match the particle filters. */
function countAt(p: number) {
  const [a, b, c] = funnelStages.map((s) => s.value);
  if (p < 0.54) return Math.round(a + (b - a) * smooth((p - 0.2) / 0.28));
  return Math.round(b + (c - b) * smooth((p - 0.56) / 0.28));
}

/**
 * Pinned scroll story: 2,340 roles swirl as a galaxy, get filtered by level,
 * then by portfolio fit, until 12 gold matches form a ring.
 */
export function RoleFunnel() {
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sec = section.current;
    const el = host.current;
    if (!sec || !el) return;
    const reduce = prefersReducedMotion();
    const small = isSmallScreen();
    const state = { progress: 0 };
    let ctrl: GLController | null = null;
    let disposed = false;

    mountGL(
      el,
      (THREE, size) =>
        buildFunnelScene(THREE, size, { total: small ? 1200 : 2340, level: small ? 96 : 186, matches: 12 }, state),
      { animate: !reduce },
    ).then((c) => {
      if (disposed) c?.dispose();
      else {
        ctrl = c;
        if (c) el.dataset.ready = "true";
      }
    });

    const ctx = gsap.context(() => {
      const labels = gsap.utils.toArray<HTMLElement>("[data-stage]");
      const pips = gsap.utils.toArray<HTMLElement>("[data-pip]");
      const shift = reduce ? 0 : 18;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: sec, start: "top top", end: "bottom bottom", scrub: reduce ? true : 0.8 },
      });

      tl.to(
        state,
        {
          progress: 1,
          duration: 1,
          onUpdate() {
            if (num.current) num.current.textContent = fmt.format(countAt(state.progress));
            ctrl?.invalidate();
          },
        },
        0,
      );

      tl.fromTo(pips[0], { scaleX: 0 }, { scaleX: 1, duration: 0.32 }, 0)
        .fromTo(pips[1], { scaleX: 0 }, { scaleX: 1, duration: 0.32 }, 0.32)
        .fromTo(pips[2], { scaleX: 0 }, { scaleX: 1, duration: 0.3 }, 0.64);

      tl.to(labels[0], { autoAlpha: 0, y: -shift, duration: 0.05, ease: "power1.in" }, 0.3)
        .fromTo(labels[1], { autoAlpha: 0, y: shift }, { autoAlpha: 1, y: 0, duration: 0.06, ease: "power2.out" }, 0.34)
        .to(labels[1], { autoAlpha: 0, y: -shift, duration: 0.05, ease: "power1.in" }, 0.62)
        .fromTo(labels[2], { autoAlpha: 0, y: shift }, { autoAlpha: 1, y: 0, duration: 0.06, ease: "power2.out" }, 0.66);
    }, sec);

    return () => {
      disposed = true;
      ctx.revert();
      ctrl?.dispose();
    };
  }, []);

  return (
    <section ref={section} id="matching" aria-label="How matching works" className="relative h-[320vh]">
      <div className="sticky top-3 h-[calc(100svh-24px)] overflow-hidden rounded-[var(--radius-panel)] bg-night text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_45%,rgba(255,215,122,0.16),rgba(10,30,60,0)_55%)]"
        />
        <div ref={host} aria-hidden className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night via-night/70 to-transparent lg:hidden" />

        <div className="relative mx-auto flex h-full max-w-[1240px] flex-col justify-end px-6 pb-8 md:px-10 md:pb-12 lg:justify-center lg:pb-0">
          <div className="max-w-[460px]">
            <span className="text-[13px] font-semibold text-[#ffd77a]">Matching</span>
            <h2 className="mt-1 text-[28px] font-medium leading-[1.05] tracking-[-0.04em] text-balance md:mt-2 md:text-[48px]">
              Every role, read. Only the right ones, kept.
            </h2>

            <div className="mt-5 md:mt-10">
              <span
                ref={num}
                className="block text-[60px] font-medium leading-none tracking-[-0.05em] tabular-nums md:text-[96px]"
                aria-hidden
              >
                {fmt.format(funnelStages[0].value)}
              </span>
              <div className="relative mt-3 h-[64px] md:h-[72px]">
                {funnelStages.map((s, i) => (
                  <p
                    key={s.label}
                    data-stage
                    className="absolute inset-x-0 top-0"
                    style={i === 0 ? undefined : { opacity: 0, visibility: "hidden" }}
                  >
                    <span className="sr-only">{fmt.format(s.value)} </span>
                    <span className="block text-lg font-medium md:text-xl">{s.label}</span>
                    <span className="mt-0.5 block text-sm text-white/65">{s.detail}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-1.5" aria-hidden>
              {funnelStages.map((s) => (
                <span key={s.label} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                  <span data-pip className="block h-full origin-left scale-x-0 rounded-full bg-[#ffd77a]" />
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/50">Illustrative example.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
