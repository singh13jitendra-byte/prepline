"use client";

import { motion } from "motion/react";
import { ease } from "./fx";

const word = "Prepline".split("");

export function Footer() {
  return (
    <footer className="mt-2 overflow-hidden rounded-t-[var(--radius-panel)] bg-ink pb-7 pt-14 text-canvas">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-8 px-5 md:px-8">
        <p className="text-xl tracking-tight">
          11:25 PM. <span className="text-[#a8a097]">Interview tomorrow?</span>
        </p>
        <nav aria-label="Footer" className="flex gap-14 text-sm">
          <div className="flex flex-col gap-2">
            <span className="text-[#a8a097]">Prepline</span>
            <a href="#how" className="hover:underline">How it works</a>
            <a href="#prep" className="hover:underline">Prep sheets</a>
            <a href="#features" className="hover:underline">For designers</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[#a8a097]">Company</span>
            <a href="#join" className="hover:underline">Join the beta</a>
            <a href="#join" className="hover:underline">Privacy</a>
          </div>
        </nav>
      </div>
      <div
        aria-hidden
        className="mx-auto mt-12 flex max-w-[1240px] px-5 text-[clamp(72px,18vw,260px)] font-semibold leading-[0.85] tracking-[-0.06em] md:px-8"
      >
        {word.map((l, i) => (
          <motion.span
            key={i}
            className="inline-block text-[#2b2722] transition-colors duration-300 hover:text-accent"
            initial={{ y: "60%", opacity: 0 }}
            whileInView={{ y: "0%", opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, delay: i * 0.05, ease }}
          >
            {l}
          </motion.span>
        ))}
      </div>
      <div className="mx-auto mt-5 flex max-w-[1240px] flex-wrap justify-between gap-4 px-5 text-[13px] text-[#a8a097] md:px-8">
        <span>© 2026 Prepline</span>
        <span>Made by Jitendra Singh</span>
      </div>
    </footer>
  );
}
