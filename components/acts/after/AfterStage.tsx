"use client";

/**
 * AFTER THE STAGE — the natural-scroll column between the seat stage and the footer
 * (round-4 brief; copy deck section 2). Day skin, not pinned, no scroll-scrub: it should
 * read as a note from a person, not another set piece.
 *
 *   1. QuoteSlot  renders nothing until real beta quotes exist (content `quotes`). With
 *                 ?slots=1 it shows a clearly labelled placeholder for layout work.
 *   2. PromiseSlip the four promises and the data note on a paper slip (the ticket's own
 *                 material): small copy never sits on the painting (review 3, P0-2 / P1-8).
 *   3. FounderNote "Why I'm building this": the deck's 150-word draft beside a crop of the
 *                 painted desk (desk-night), signed in the margin-note hand. Registers `founder-note`.
 */

import { useEffect, useRef, useState } from "react";
import { useAnchor } from "@/lib/anchors";
import { Frame } from "@/components/art";
import { founder, promises, quotes } from "./copy";
import { DeskCrop } from "./DeskCrop";
import "./after.css";

function useSlotsFlag(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(new URLSearchParams(window.location.search).get("slots") === "1"), []);
  return on;
}

function QuoteSlot() {
  const forced = useSlotsFlag();
  // A placeholder until real beta feedback exists: never rendered unless `real`, or ?slots=1.
  if (!quotes.real && !forced) return null;
  const q = quotes.items[0];
  if (!q) return null;
  return (
    <figure className="af-quote" data-sample={quotes.real ? undefined : ""}>
      {quotes.real ? null : <p className="af-quote-label">{quotes.label}</p>}
      <div className="af-quote-row">
        <Frame empty className="af-quote-frame" />
        <div>
          <blockquote>{q.quote}</blockquote>
          <figcaption>
            <b>{q.name}</b>, {q.role}
          </figcaption>
        </div>
      </div>
    </figure>
  );
}

function PromiseSlip() {
  return (
    <section className="slip af-promises" data-size="l" aria-labelledby="promises-title">
      <h2 id="promises-title" className="af-promises-h">
        {promises.title}
      </h2>
      <ul className="af-promises-list">
        {promises.items.map((p) => (
          <li key={p.title}>
            <b>{p.title}</b>
            <span>{p.body}</span>
          </li>
        ))}
      </ul>
      <p className="af-promises-note">{promises.note}</p>
    </section>
  );
}

function FounderNote() {
  const anchor = useAnchor("founder-note");
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  // A plain fade, once, when it comes into view (none under reduced motion).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={(el) => {
        ref.current = el;
        return anchor(el) ?? undefined;
      }}
      className="af-founder"
      aria-labelledby="founder-title"
      data-seen={seen ? "" : undefined}
    >
      <DeskCrop className="af-crop" alt={founder.imageAlt} />
      <div className="af-founder-text">
        <h2 id="founder-title" className="af-h">
          {founder.title}
        </h2>
        {founder.paragraphs.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <p className="af-sign">
          <b>{founder.name}</b>
          {founder.role ? <span>{founder.role}</span> : null}
        </p>
        {founder.links.length ? (
          <p className="af-links">
            {founder.links.map((l) => (
              <a key={l.href} href={l.href} rel="noopener">
                {l.label}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function AfterStage() {
  return (
    <div className="af" data-skin="day">
      <QuoteSlot />
      <PromiseSlip />
      <FounderNote />
    </div>
  );
}
