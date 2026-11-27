"use client";

/**
 * PLACEHOLDER — the card and data builder owns the real one (components/fireflies/card/JobCard.tsx,
 * same props: { job, anchor, onClose }). This stands in for it in the lab only, so the scene can be
 * seen whole: it sits beside the anchor, clear of the firefly (anchor.r), stays on screen, unfolds
 * like a sheet of paper with one pass of lamp light, and folds away. Product primitives and tokens;
 * the buttons do nothing on purpose.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button, ScoreRule } from "@/components/product";
import type { FireflyAnchor, FireflyJob } from "@/components/fireflies/scene/types";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function PlaceholderCard({ job, anchor, onClose }: { job: FireflyJob | null; anchor: FireflyAnchor | null; onClose: () => void }) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  // The last job stays drawn while the card folds away.
  const [shown, setShown] = useState<FireflyJob | null>(job);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (job) setShown(job);
  }, [job]);
  const open = !!job && !!anchor && shown?.id === job.id;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el || !anchor) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = (anchor.r ?? 110) * 0.86;
    let x: number;
    let y: number;
    let side: "left" | "right" | "below";
    if (vw < 720) {
      side = "below";
      x = (vw - w) / 2;
      y = Math.min(vh - h - 12, anchor.y + r + 14);
    } else {
      // Keep the side it is on unless the firefly has clearly crossed the middle.
      const was = el.dataset.side;
      side = was === "left" ? (anchor.x < vw * 0.44 ? "right" : "left") : was === "right" ? (anchor.x > vw * 0.56 ? "left" : "right") : anchor.x < vw * 0.5 ? "right" : "left";
      x = side === "right" ? anchor.x + r + 22 : anchor.x - r - 22 - w;
      y = anchor.y - h * 0.46;
    }
    x = Math.max(12, Math.min(vw - w - 12, x));
    y = Math.max(12, Math.min(vh - h - 12, y));
    el.dataset.side = side;
    el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }, [anchor, shown]);

  const j = shown;
  return (
    <div ref={wrap} className="ffc" data-open={open ? "" : undefined} inert={!open}>
      {j ? (
        <article
          className="pp pp-role ffc-paper"
          data-skin="day"
          data-paper=""
          aria-labelledby={id}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        >
          <span className="ffc-sweep" aria-hidden="true" />
          <header className="pp-role-h">
            <div className="pp-role-id">
              <div className="pp-role-t">
                <h2 id={id} className="pp-title" title={j.title}>
                  {j.title}
                </h2>
              </div>
              <p className="pp-meta">
                {j.company}
                <span className="pp-sep">·</span>
                {j.mode === "Remote" ? "Remote" : `${j.city} · ${j.mode}`}
              </p>
            </div>
            <ScoreRule score={j.fit} size="lg" suffix className="pp-role-rule" />
          </header>
          <dl className="ffc-facts">
            <div>
              <dt>Posted</dt>
              <dd className="pp-num">{j.posted} ago</dd>
            </div>
            <div>
              <dt>Pay</dt>
              <dd className="pp-num">{j.salary ?? "Not listed"}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{j.level}</dd>
            </div>
          </dl>
          <ul className="ffc-why" aria-label={`Why it scores ${fmt(j.fit)} out of 10`}>
            {j.reasons.map((r) => (
              <li key={r.label}>
                <b>{r.label}</b>
                <span>{r.text}</span>
              </li>
            ))}
            {j.gap ? (
              <li data-gap="">
                <b>Gap</b>
                <span>{j.gap}</span>
              </li>
            ) : null}
          </ul>
          <footer className="pp-role-f">
            <Button size="sm" variant="primary" icon="external">
              View posting
            </Button>
            <Button size="sm" icon={saved[j.id] ? "bookmark-filled" : "bookmark"} aria-pressed={!!saved[j.id]} onClick={() => setSaved((s) => ({ ...s, [j.id]: !s[j.id] }))}>
              {saved[j.id] ? "Saved" : "Save"}
            </Button>
            <p className="pp-quiet">Illustrative. Found on: {j.source.toLowerCase()}.</p>
          </footer>
        </article>
      ) : null}
    </div>
  );
}
