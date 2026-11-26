"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { form as copy } from "@/components/acts/after/copy";
import { Icon } from "@/components/product";
import { Magnetic } from "./Magnetic";
import "./waitlist.css";

export type WaitlistStatus = "idle" | "sending" | "done" | "duplicate" | "error";
type Tone = "light" | "glass" | "night" | "ticket";

/**
 * Email sign-up (Night Desk). Used in the hero (night pill) and on the seat ticket.
 *
 * States, from the copy deck: empty, invalid, sending, success ("Requested for {email}.
 * Wrong address? Edit it."), duplicate (the API answers { ok: true, duplicate: true }),
 * server error (the typed email stays), offline. Only /api/waitlist is ever called.
 * `onStatusChange` reports the status out: the ticket stamps itself and claims a seat ring.
 * Tone "glass" is kept as an alias of "night" for callers that still pass it.
 */
export function WaitlistForm({ tone = "night", onStatusChange }: { tone?: Tone; onStatusChange?: (status: WaitlistStatus) => void }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");
  const [error, setError] = useState("");
  const [live, setLive] = useState("");
  const doneRef = useRef<HTMLParagraphElement>(null);
  const ticket = tone === "ticket";

  useEffect(() => {
    onStatusChange?.(status);
    // Keyboard focus was on the button that just went away: hand it to the message, once.
    if (status === "done" || status === "duplicate") doneRef.current?.focus({ preventScroll: true });
  }, [status, onStatusChange]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setStatus("error");
      setError(copy.empty);
      inputRef.current?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setError(copy.invalid);
      inputRef.current?.focus();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("error");
      setError(copy.offline);
      return;
    }
    setStatus("sending");
    setLive(copy.sendingLive);
    let res: Response;
    try {
      res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
    } catch {
      // The request never reached a server (no network, or it dropped): say so, keep the email.
      setLive("");
      setStatus("error");
      setError(copy.offline);
      return;
    }
    try {
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as { duplicate?: boolean };
      setLive("");
      setStatus(data.duplicate ? "duplicate" : "done");
    } catch {
      setLive("");
      setStatus("error");
      setError(copy.error);
    }
  }

  const edit = () => {
    setStatus("idle");
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const sending = status === "sending";
  const invalid = status === "error";

  /* ── finished states ── */
  if (status === "done" || status === "duplicate") {
    const text =
      status === "duplicate" ? (
        copy.duplicate
      ) : ticket ? (
        <>
          {copy.requestedFor.replace("{email}", email.trim())} {copy.wrongAddress}{" "}
          <button type="button" className="wl-link" onClick={edit}>
            {copy.edit}
          </button>
        </>
      ) : (
        copy.heroSuccess
      );
    return (
      <div className="wl" data-tone={ticket ? "ticket" : "night"} data-status={status}>
        <p className="wl-done" role="status" tabIndex={-1} ref={doneRef}>
          <span className="wl-done-mark" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
          <span>{text}</span>
        </p>
      </div>
    );
  }

  const button = (
    <button type="submit" disabled={sending} className="wl-btn" data-sending={sending ? "" : undefined}>
      <span className="wl-btn-label">{sending ? copy.sending : copy.cta}</span>
      {sending ? <span className="wl-spin" aria-hidden="true" /> : <Icon name="arrow-right" size={16} />}
    </button>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="wl" data-tone={ticket ? "ticket" : "night"} data-status={status}>
      <label htmlFor={id} className={ticket ? "wl-label" : "sr-only"}>
        {copy.label}
      </label>
      <div className="wl-row">
        <input
          ref={inputRef}
          id={id}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (invalid) setStatus("idle");
          }}
          aria-invalid={invalid}
          aria-describedby={`${id}-msg`}
          className="wl-input"
        />
        {ticket ? button : <Magnetic strength={0.25}>{button}</Magnetic>}
      </div>
      <p id={`${id}-msg`} role={invalid ? "alert" : undefined} className="wl-msg" data-error={invalid ? "" : undefined}>
        {invalid ? error : ticket ? copy.helper : ""}
      </p>
      <span className="sr-only" aria-live="polite">
        {live}
      </span>
    </form>
  );
}

/**
 * The ticket-tone form as a still print: the same classes and text, no input, no state.
 * For decorative copies (the Actor's flying ticket), so a flight carries no live form.
 */
export function WaitlistPrint() {
  return (
    <div className="wl" data-tone="ticket" data-status="idle" aria-hidden="true">
      <span className="wl-label">{copy.label}</span>
      <div className="wl-row">
        <span className="wl-input wl-input-print">{copy.placeholder}</span>
        <span className="wl-btn">
          <span className="wl-btn-label">{copy.cta}</span>
          <Icon name="arrow-right" size={16} />
        </span>
      </div>
      <p className="wl-msg">{copy.helper}</p>
    </div>
  );
}
