"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type FormEvent } from "react";
import { ArrowRight } from "./Icons";
import { Magnetic } from "./Magnetic";

type Status = "idle" | "sending" | "done" | "error";

/** Email sign-up used in the hero (on the video) and at the bottom of the page. */
export function WaitlistForm({ tone = "light" }: { tone?: "light" | "glass" }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const glass = tone === "glass";

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
            You’re on the list. We’ll email your invite when a seat opens.
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
              Email
            </label>
            <input
              id={id}
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
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
              className={`group inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                glass ? "bg-white text-ink focus-visible:outline-white" : "bg-ink text-white focus-visible:outline-ink"
              }`}
            >
              {status === "sending" ? (
                <>
                  <motion.span
                    aria-hidden
                    className="size-3.5 rounded-full border-2 border-current border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  />
                  Joining
                </>
              ) : (
                <>
                  Join the beta
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
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
