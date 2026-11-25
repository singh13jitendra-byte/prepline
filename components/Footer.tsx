"use client";

/**
 * FOOTER — small and quiet, on ink (storyboard 2.7). A static gold hairline on
 * top, no giant wordmark. Right: the visitor's local time, "11:25 PM. Interview
 * tomorrow?" (the suffix alone when the time cannot be read). Last line: the
 * page's figures, stated as illustrative.
 */

import { useEffect, useState } from "react";
import { pkg3Copy, storyCopy } from "@/lib/content";
import "./chrome.css";

function useLocalTime() {
  const [time, setTime] = useState<{ text: string; iso: string } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const now = new Date();
        setTime({ text: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), iso: now.toISOString() });
      } catch {
        setTime(null);
      }
    };
    read();
    // Keep the minute honest while the footer is open; nothing moves.
    const id = window.setInterval(read, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

export function Footer() {
  const time = useLocalTime();
  const f = storyCopy.footer;
  return (
    <footer className="ft">
      <div className="ft-inner">
        <p className="ft-brand">
          <span className="nav-logo" aria-hidden="true" />
          <span>{f.left}</span>
        </p>
        <nav aria-label={pkg3Copy.landmarks.footer}>
          <ul className="ft-links">
            {f.links.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="ft-time">
          {time ? (
            <>
              <time dateTime={time.iso}>{time.text}</time>.{" "}
            </>
          ) : null}
          <span>{time ? f.timeSuffix : f.timeFallback}</span>
        </p>
      </div>
      <p className="type-mono ft-last">{f.last}</p>
    </footer>
  );
}
