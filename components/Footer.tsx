"use client";

/**
 * FOOTER — quiet, Night Desk (deep pine ground, no texture). A static hand-drawn lamp Line
 * across the top. Left: the one-line description. Right, in the evening, the visitor's local time,
 * "11:25 PM. Close the laptop. The sheet will keep." (by day the line alone) beside the closed-laptop drawing, which
 * draws itself once when the footer comes into view. Last line: the figures, as illustrative.
 */

import { useEffect, useRef, useState } from "react";
import { storyCopy } from "@/lib/content";
import { LaptopClosed } from "@/components/art";
import { footerTime, landmarks } from "@/components/acts/after/copy";
import "./chrome.css";

function useLocalTime() {
  const [time, setTime] = useState<{ text: string; iso: string } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const now = new Date();
        // "Close the laptop" is an evening line: the clock is shown only from 6 PM to 4 AM; by
        // day the line stands on its own, time-agnostic (review 3, P2-11).
        const h = now.getHours();
        const evening = h >= 18 || h < 5;
        setTime(evening ? { text: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), iso: now.toISOString() } : null);
      } catch {
        setTime(null);
      }
    };
    read();
    const id = window.setInterval(read, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

export function Footer() {
  const time = useLocalTime();
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const f = storyCopy.footer;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setSeen(true);
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer ref={ref} className="ft" data-seen={seen ? "" : undefined}>
      <svg className="ft-line" viewBox="0 0 1000 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 5.5C90 3.8 170 6.9 260 5.2S430 3.6 520 5.6 690 7 780 4.8 920 3.9 1000 5.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="ft-inner">
        <p className="ft-brand">{f.left}</p>
        <nav aria-label={landmarks.footer}>
          <ul className="ft-links">
            {f.links.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ft-time">
          <LaptopClosed className="ft-laptop" />
          <p>
            {time ? (
              <>
                <time dateTime={time.iso}>{time.text}</time>.{" "}
              </>
            ) : null}
            <span>{footerTime.line}</span>
          </p>
        </div>
      </div>
      <p className="ft-last">{f.last}</p>
    </footer>
  );
}
