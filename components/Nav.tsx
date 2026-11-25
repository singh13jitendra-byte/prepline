"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { useState } from "react";
import { navLinks } from "@/lib/content";
import { Logo } from "./Icons";
import { Magnetic } from "./Magnetic";

/** Floating nav: clear over the hero, frosted once you scroll, with a reading-progress line. */
export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 60));

  const light = !solid && !open;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className={`pointer-events-auto relative mx-auto flex max-w-[1240px] items-center justify-between gap-4 overflow-hidden rounded-full px-3 py-2 transition-[background-color,box-shadow,border-color] duration-500 md:px-4 ${
          light
            ? "border border-transparent"
            : "border border-line/80 bg-canvas/80 shadow-[0_10px_30px_-18px_rgba(27,25,22,0.35)] backdrop-blur-xl"
        }`}
      >
        <a
          href="#top"
          className={`flex items-center gap-2.5 pl-2 text-lg font-semibold tracking-tight transition-colors duration-500 ${
            light ? "text-white" : "text-ink"
          }`}
        >
          <Logo dark={!light} />
          Prepline
        </a>

        <nav
          aria-label="Sections"
          className={`hidden items-center gap-1 text-sm transition-colors duration-500 md:flex ${
            light ? "text-white/90" : "text-muted"
          }`}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 transition ${light ? "hover:bg-white/15" : "hover:bg-sunk hover:text-ink"}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Magnetic strength={0.3}>
          <a
            href="#join"
            className={`inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors duration-500 ${
              light ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/90"
            }`}
          >
            Join the beta
          </a>
          </Magnetic>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex size-10 items-center justify-center rounded-full md:hidden ${
              light ? "text-white hover:bg-white/15" : "text-ink hover:bg-sunk"
            }`}
          >
            <span className="relative block h-3 w-4" aria-hidden>
              <motion.span
                className="absolute left-0 top-0 h-[1.5px] w-4 rounded bg-current"
                animate={open ? { y: 5.5, rotate: 45 } : { y: 0, rotate: 0 }}
              />
              <motion.span
                className="absolute bottom-0 left-0 h-[1.5px] w-4 rounded bg-current"
                animate={open ? { y: -5.5, rotate: -45 } : { y: 0, rotate: 0 }}
              />
            </span>
          </button>
        </div>

        <motion.span
          aria-hidden
          style={{ scaleX: progress }}
          className={`absolute inset-x-6 bottom-0 h-px origin-left bg-accent transition-opacity duration-500 ${
            solid ? "opacity-100" : "opacity-0"
          }`}
        />
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Sections"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto mx-auto mt-2 flex max-w-[1240px] flex-col rounded-3xl border border-line bg-canvas/95 p-2 shadow-xl backdrop-blur-xl md:hidden"
          >
            {navLinks.map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="rounded-2xl px-4 py-3 text-base text-ink hover:bg-sunk"
              >
                {l.label}
              </motion.a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
