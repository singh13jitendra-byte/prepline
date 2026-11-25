"use client";

import { useEffect, useRef } from "react";
import { funnelStages } from "@/lib/content";
import { gsap } from "@/lib/gsap";
import { reveal } from "@/lib/intro";
import { getLenis } from "./SmoothScroll";

const fmt = new Intl.NumberFormat("en-IN");
const [total, , matched] = funnelStages.map((s) => s.value);

/**
 * First-visit opening (once per session): the week's roles count up, collapse
 * to the 12 that fit, and a curtain lifts onto the hero. Click or press any key to skip.
 * Hidden by CSS unless the boot script set html.intro (so no-JS and repeat visits never see it).
 */
export function HeroIntro() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const el = root.current;
    if (!el || !html.classList.contains("intro")) {
      reveal();
      return;
    }

    const num = el.querySelector<HTMLElement>("[data-n]")!;
    const labels = el.querySelectorAll<HTMLElement>("[data-l]");
    const bar = el.querySelector<HTMLElement>("[data-bar]")!;
    const state = { n: 0 };
    const render = () => (num.textContent = fmt.format(Math.round(state.n)));

    const finish = () => {
      html.classList.remove("intro");
      try {
        sessionStorage.setItem("pl-intro", "1");
      } catch {}
      getLenis()?.start();
    };

    const tl = gsap.timeline({ onComplete: finish });
    tl.set(el, { clipPath: "inset(0% 0% 0% 0%)" })
      .from(el.querySelector("[data-wrap]"), { autoAlpha: 0, y: 20, duration: 0.5, ease: "power3.out" })
      .to(state, { n: total, duration: 1.15, ease: "power3.inOut", onUpdate: render }, 0.1)
      .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.15, ease: "power3.inOut" }, 0.1)
      .to(labels[0], { yPercent: -100, autoAlpha: 0, duration: 0.35, ease: "power2.in" }, 1.3)
      .fromTo(labels[1], { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" }, 1.5)
      .to(state, { n: matched, duration: 0.5, ease: "expo.in", onUpdate: render }, 1.3)
      .to(num, { color: "#ffd77a", duration: 0.3 }, 1.65)
      .addLabel("lift", 2.15)
      .call(reveal, [], "lift")
      .to(el.querySelector("[data-wrap]"), { yPercent: -30, autoAlpha: 0, duration: 0.6, ease: "power3.in" }, "lift")
      .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 1, ease: "expo.inOut" }, "lift");

    const skip = () => {
      if (tl.time() < tl.labels.lift) tl.seek("lift");
    };
    el.addEventListener("click", skip);
    window.addEventListener("keydown", skip);
    return () => {
      el.removeEventListener("click", skip);
      window.removeEventListener("keydown", skip);
      tl.kill();
      finish();
    };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden
      className="intro-overlay fixed inset-0 z-[100] cursor-pointer flex-col items-center justify-center bg-night text-white"
    >
      <div data-wrap className="flex flex-col items-center">
        <div className="relative h-6 overflow-hidden text-center text-sm text-white/65 md:text-base">
          <span data-l className="block">
            Reading this week’s design roles
          </span>
          <span data-l className="absolute inset-x-0 top-0 block text-[#ffd77a] opacity-0">
            Kept the ones that fit you
          </span>
        </div>
        <span
          data-n
          className="mt-3 block text-[26vw] font-medium leading-none tracking-[-0.06em] tabular-nums md:text-[200px]"
        >
          0
        </span>
        <span className="mt-8 block h-px w-56 overflow-hidden bg-white/15">
          <span data-bar className="block h-full origin-left scale-x-0 bg-[#ffd77a]" />
        </span>
      </div>
      <span className="absolute bottom-8 text-xs text-white/40">Click to skip</span>
    </div>
  );
}
