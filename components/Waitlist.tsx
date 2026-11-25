"use client";

import { motion } from "motion/react";
import { BETA_SEATS, trust } from "@/lib/content";
import { ease, Rise } from "./fx";
import { Check } from "./Icons";
import { WaitlistForm } from "./WaitlistForm";

const letters = "Your turn".split("");

export function Waitlist() {
  return (
    <section id="join" className="relative mx-auto flex max-w-[1240px] flex-col items-center px-5 pb-24 pt-28 text-center md:px-8 md:pt-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[360px] w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,215,122,0.45),rgba(246,244,239,0))] blur-2xl"
      />
      <motion.h2
        className="text-[72px] font-medium leading-none tracking-[-0.055em] sm:text-[112px] lg:text-[150px]"
        aria-label="Your turn"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ staggerChildren: 0.04 }}
      >
        {letters.map((l, i) => (
          <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.06em] align-bottom">
            <motion.span
              className="inline-block"
              variants={{ hidden: { y: "100%" }, show: { y: "0%" } }}
              transition={{ duration: 0.8, ease }}
            >
              {l === " " ? "\u00a0" : l}
            </motion.span>
          </span>
        ))}
      </motion.h2>
      <Rise delay={0.2} className="mt-6 flex w-full flex-col items-center gap-6">
        <p className="max-w-[520px] text-[17px] text-muted">
          The private beta is open to {BETA_SEATS} product and UX designers. Leave your email and we’ll send you an invite.
        </p>
        <WaitlistForm />
      </Rise>

      <div className="mt-14 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
        {trust.map((t, i) => (
          <Rise key={t.title} delay={0.1 * i}>
            <div className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Check className="size-3.5" />
              </span>
              <span className="font-semibold">{t.title}</span>
              <span className="text-sm text-muted">{t.body}</span>
            </div>
          </Rise>
        ))}
      </div>
      <p className="mt-8 max-w-[620px] text-[13px] text-muted">
        To write a prep sheet, the job description and your portfolio text are sent to an AI model. Your email, preferences
        and board are the only things we keep.
      </p>
    </section>
  );
}
