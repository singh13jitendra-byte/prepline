"use client";

/**
 * DEBUG OVERLAY — add ?debug=1 to the URL.
 *
 * Shows the current beat and progress, act, story position, chapter, the line
 * (magenta) and its label, the day/night split (cyan dashes at --day-top), the
 * Actor box (lime), every registered anchor (orange outlines with ids) and the
 * frame time (average and worst of the last 60 frames).
 *
 * It measures every anchor every frame, which the real page never does, so
 * frame times with the overlay open are pessimistic. Loaded on demand; it adds
 * nothing to the normal bundle.
 */

import { useEffect, useRef } from "react";
import { anchorElement, registeredAnchors } from "@/lib/anchors";
import { story } from "@/lib/story";

const DEBUG_CSS = `
        .story-debug{position:fixed;inset:0;z-index:var(--z-debug);pointer-events:none;font:11px/1.45 var(--font-mono),monospace}
        .story-debug pre{position:absolute;left:12px;bottom:12px;margin:0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.82);color:#d7ffd9;white-space:pre}
        .story-debug-line{position:absolute;top:0;left:0;height:2px;background:#ff2bd6}
        .story-debug-split{position:absolute;top:0;left:0;width:100%;border-top:1px dashed #19e3ff}
        .story-debug-actor{position:absolute;top:0;left:0;outline:1px solid #9dff00}
        .story-debug-anchor{position:absolute;top:0;left:0;outline:1px solid rgba(255,140,0,.9);color:#ff8c00;font-size:9px;line-height:1;white-space:nowrap;text-shadow:0 0 2px #000}
      `;

export function Debug() {
  const hudRef = useRef<HTMLPreElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hud = hudRef.current;
    const line = lineRef.current;
    const split = splitRef.current;
    const actorBox = actorRef.current;
    const boxes = boxesRef.current;
    if (!hud || !line || !split || !actorBox || !boxes) return;

    const times: number[] = [];
    let lastNow = performance.now();
    const pool = new Map<string, HTMLDivElement>();

    return story.frame("world", () => {
      const now = performance.now();
      times.push(now - lastNow);
      lastNow = now;
      if (times.length > 60) times.shift();
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const worst = Math.max(...times);

      // Reads first (debug only: the page itself never measures all anchors).
      const ids = registeredAnchors();
      const rects = ids.map((id) => anchorElement(id)?.getBoundingClientRect());

      const s = story.get();
      hud.textContent =
        `beat     ${s.beat}  ${s.beatProgress.toFixed(3)}\n` +
        `act      ${s.act}  ${s.actProgress.toFixed(3)}\n` +
        `pos      ${s.pos.toFixed(1)}  page ${s.pageProgress.toFixed(3)}  dir ${s.direction}\n` +
        `chapter  ${s.chapter}  dayTop ${s.dayTop.toFixed(0)}  side ${s.line.daySide}\n` +
        `line     y ${s.line.y.toFixed(0)}  x ${s.line.x0.toFixed(0)}..${s.line.x1.toFixed(0)}  w ${s.line.weight.toFixed(1)}\n` +
        `label    ${s.line.label || "(none)"}\n` +
        `actor    ${s.actor.present ? (s.actor.docked ? "docked" : "flying") : "absent"}  ${s.actor.face ?? "-"}  t ${s.actor.travel.toFixed(2)}  fold ${s.actor.fold.toFixed(2)}  flip ${s.actor.flip.toFixed(2)}\n` +
        `frame    ${avg.toFixed(1)}ms avg  ${worst.toFixed(1)}ms worst  (${(1000 / avg).toFixed(0)}fps)\n` +
        `flags    ${Object.entries(s.flags).filter(([, v]) => v).map(([k]) => k).join(" ") || "-"}`;

      line.style.transform = `translate3d(${s.line.x0}px,${s.line.y - 1}px,0)`;
      line.style.width = `${Math.max(0, s.line.x1 - s.line.x0)}px`;
      split.style.transform = `translate3d(0,${s.dayTop}px,0)`;
      actorBox.style.display = s.actor.present ? "block" : "none";
      actorBox.style.transform = `translate3d(${s.actor.x}px,${s.actor.y}px,0)`;
      actorBox.style.width = `${s.actor.w}px`;
      actorBox.style.height = `${s.actor.h}px`;

      const live = new Set<string>(ids);
      pool.forEach((el, id) => {
        if (!live.has(id)) {
          el.remove();
          pool.delete(id);
        }
      });
      ids.forEach((id, i) => {
        const r = rects[i];
        let el = pool.get(id);
        if (!el) {
          el = document.createElement("div");
          el.className = "story-debug-anchor";
          el.textContent = id;
          boxes.appendChild(el);
          pool.set(id, el);
        }
        if (!r) return;
        el.style.transform = `translate3d(${r.left}px,${r.top}px,0)`;
        el.style.width = `${r.width}px`;
        el.style.height = `${r.height}px`;
      });
    });
  }, []);

  return (
    <div className="story-debug" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: DEBUG_CSS }} />
      <div ref={boxesRef} />
      <div ref={splitRef} className="story-debug-split" />
      <div ref={lineRef} className="story-debug-line" />
      <div ref={actorRef} className="story-debug-actor" />
      <pre ref={hudRef} />
    </div>
  );
}
