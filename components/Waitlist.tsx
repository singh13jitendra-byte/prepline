"use client";

import { useState, type FormEvent } from "react";
import { BETA_SEATS, trust } from "@/lib/content";

type Status = "idle" | "sending" | "done" | "error";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setMessage("That email doesn’t look right. Check it and try again.");
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
      setMessage("You’re on the list. We’ll email your invite when a seat opens.");
    } catch {
      setStatus("error");
      setMessage("Something went wrong on our side. Please try again in a minute.");
    }
  }

  return (
    <section id="join" className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 px-5 pb-24 pt-28 text-center md:px-7 md:pt-32">
      <h2 className="text-[72px] font-medium leading-none tracking-[-0.05em] sm:text-[104px] lg:text-[136px]">Your turn</h2>
      <p className="max-w-[520px] text-[17px] text-muted">
        The private beta is open to {BETA_SEATS} product and UX designers. Leave your email and we’ll send you an invite.
      </p>

      {status === "done" ? (
        <p role="status" className="rounded-full border border-accent-line bg-accent-soft px-5 py-3 text-sm text-accent">
          {message}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex w-full max-w-[440px] items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-5 pr-1.5 focus-within:border-ink/40"
        >
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            aria-invalid={status === "error"}
            aria-describedby="email-msg"
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {status === "sending" ? "Joining…" : "Join the beta"}
          </button>
        </form>
      )}
      <p id="email-msg" role={status === "error" ? "alert" : undefined} className="min-h-5 text-sm text-[#b42318]">
        {status === "error" ? message : ""}
      </p>

      <div className="mt-6 grid w-full gap-8 text-left sm:grid-cols-2 lg:grid-cols-4">
        {trust.map((t) => (
          <div key={t.title} className="flex flex-col gap-1.5">
            <span className="font-semibold">{t.title}</span>
            <span className="text-sm text-muted">{t.body}</span>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-[620px] text-[13px] text-muted">
        To write a prep sheet, the job description and your portfolio text are sent to an AI model. Your email,
        preferences and board are the only things we keep.
      </p>
    </section>
  );
}
