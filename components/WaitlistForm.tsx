"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { pkg3Copy, storyCopy } from "@/lib/content";
import { ArrowRight } from "./Icons";
import { Magnetic } from "./Magnetic";

type Status = "idle" | "sending" | "done" | "error";
type Tone = "light" | "glass" | "ticket";

/**
 * Email sign-up. Used in the hero (glass, on night) and on the seat ticket (ticket).
 *
 * The request logic and the /api/waitlist contract are unchanged. `onStatusChange`
 * only reports the status out (the ticket uses it to stamp itself and fill a seat
 * ring). In the ticket tone the success message is drawn by the ticket itself.
 */
export function WaitlistForm({ tone = "light", onStatusChange }: { tone?: Tone; onStatusChange?: (status: Status) => void }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const glass = tone === "glass";
  const ticket = tone === "ticket";

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setError("That email doesn’t look right. Check it and try again.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Something went wrong on our side. Please try again in a minute.");
    }
  }

  const buttonInner =
    status === "sending" ? (
      <>
        <motion.span
          aria-hidden
          className="size-3.5 rounded-full border-2 border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
        {storyCopy.common.ctaSending}
      </>
    ) : (
      <>
        {storyCopy.common.cta}
        <ArrowRight className="cta-arrow size-4" />
      </>
    );

  /* ── the ticket: a printed field and a stamped button ── */
  if (ticket) {
    if (status === "done") return null;
    return (
      <form onSubmit={onSubmit} noValidate className="tk-form" data-status={status}>
        <div data-rise="">
          <label htmlFor={id} className="tk-label">
            {pkg3Copy.ticket.emailLabel}
          </label>
        </div>
        <div data-rise="" className="tk-field-wrap">
          <motion.div
            className="tk-field"
            animate={status === "error" ? { x: [0, -7, 6, -4, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.45 }}
          >
            <input
              id={id}
              type="email"
              autoComplete="email"
              placeholder={storyCopy.common.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              aria-invalid={status === "error"}
              aria-describedby={`${id}-msg`}
              className="tk-input"
            />
            <span className="tk-underline" aria-hidden="true" />
            <span className="tk-caret" aria-hidden="true" />
          </motion.div>
          <p id={`${id}-msg`} role={status === "error" ? "alert" : undefined} className="tk-msg">
            {status === "error" ? error : ""}
          </p>
        </div>
        <div data-rise="" className="tk-actions">
          <Magnetic strength={0.3}>
            <button type="submit" disabled={status === "sending"} className="cta cta-ink tk-submit">
              <span className="cta-label">{buttonInner}</span>
              <span className="cta-line" aria-hidden="true" />
            </button>
          </Magnetic>
        </div>
      </form>
    );
  }

  return (
    <div className="w-full max-w-[460px]">
      <AnimatePresence mode="wait" initial={false}>
        {status === "done" ? (
          <motion.div
            key="done"
            role="status"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className={`flex items-center gap-3 rounded-full py-2 pl-2 pr-5 text-sm ${
              glass
                ? "border border-white/30 bg-white/15 text-white backdrop-blur-xl"
                : "border border-accent-line bg-accent-soft text-accent"
            }`}
          >
            <span className={`inline-flex size-9 items-center justify-center rounded-full ${glass ? "bg-white text-accent" : "bg-accent text-white"}`}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                />
              </svg>
            </span>
            {storyCopy.common.success}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={onSubmit}
            noValidate
            exit={{ opacity: 0, scale: 0.97 }}
            animate={status === "error" ? { x: [0, -8, 7, -5, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.45 }}
            className={`flex items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5 transition-colors ${
              glass
                ? "border border-white/35 bg-[rgba(10,30,60,0.35)] backdrop-blur-xl focus-within:border-white/70"
                : "border border-line bg-surface shadow-[0_12px_30px_-20px_rgba(27,25,22,0.4)] focus-within:border-ink/40"
            }`}
          >
            <label htmlFor={id} className="sr-only">
              {pkg3Copy.ticket.emailLabel}
            </label>
            <input
              id={id}
              type="email"
              autoComplete="email"
              placeholder={storyCopy.common.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              aria-invalid={status === "error"}
              aria-describedby={`${id}-msg`}
              className={`h-11 min-w-0 flex-1 bg-transparent text-base outline-none ${
                glass ? "text-white placeholder:text-white/70" : "text-ink placeholder:text-muted/70"
              }`}
            />
            <Magnetic strength={0.25}>
              <motion.button
                type="submit"
                disabled={status === "sending"}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`group relative inline-flex h-11 shrink-0 items-center gap-2 overflow-hidden rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  glass ? "bg-white text-ink focus-visible:outline-white" : "bg-ink text-white focus-visible:outline-accent"
                }`}
              >
                {buttonInner}
                {/* The Line motif in miniature: a gold rule draws along the bottom on hover. */}
                <span
                  aria-hidden
                  className="absolute inset-x-4 bottom-0 h-[2px] origin-left scale-x-0 rounded-full bg-gold transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-hover:duration-[250ms] group-focus-visible:scale-x-100"
                />
              </motion.button>
            </Magnetic>
          </motion.form>
        )}
      </AnimatePresence>
      <p
        id={`${id}-msg`}
        role={status === "error" ? "alert" : undefined}
        className={`mt-2 min-h-5 pl-5 text-left text-sm ${glass ? "text-white" : "text-[#b42318]"}`}
      >
        {status === "error" ? error : ""}
      </p>
    </div>
  );
}
