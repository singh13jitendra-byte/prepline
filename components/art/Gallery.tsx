"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ART, type ArtId } from "./registry";
import { RisoFilters } from "./RisoFilters";
import type { ArtProps } from "./Art";
import { Desk } from "./Desk";
import { Lamp } from "./Lamp";
import { Mug } from "./Mug";
import { Chair } from "./Chair";
import { LaptopClosed } from "./LaptopClosed";
import { ScoreRing } from "./ScoreRing";
import { SeatRingA, SeatRingB, SeatRingC } from "./SeatRing";
import { Tick } from "./Tick";
import { Calendar } from "./Calendar";
import { Stamp } from "./Stamp";
import { Arrow } from "./Arrow";
import { Frame } from "./Frame";

/*
 * Dev gallery only. Colours, strokes and textures come from app/theme.css (Night Desk, the
 * default theme); only the gallery's own layout is styled here. The drawings never name a colour.
 */
const TOKENS = `
.ndg{background:var(--c-paper);color:var(--c-ink);min-height:100vh;padding:32px 40px 96px;font-family:var(--font-text);font-size:14px;line-height:1.45}
.ndg [data-chapter="night"]{background:var(--tex-night),var(--c-night);color:var(--c-on-night)}
.ndg [data-chapter="day"]{background:var(--tex-paper),var(--c-paper);color:var(--c-ink);box-shadow:inset 0 0 0 1.5px var(--c-rule)}
.ndg h1{font-size:28px;letter-spacing:-.02em;margin:0 0 4px}
.ndg .bar{position:sticky;top:0;z-index:5;display:flex;gap:24px;align-items:center;flex-wrap:wrap;padding:12px 0;background:var(--c-paper);border-bottom:1.5px solid var(--c-rule);margin-bottom:28px}
.ndg .bar label{display:flex;gap:8px;align-items:center}
.ndg .bar input[type=range]{width:280px;accent-color:var(--c-ink)}
.ndg section{margin:0 0 44px}
.ndg h2{font-size:17px;margin:0 0 2px}
.ndg .meta{color:var(--c-ink-2);font-size:12.5px;margin:0 0 10px;max-width:110ch}
.ndg .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ndg .cell{border-radius:18px;padding:36px 28px;display:flex;gap:36px;align-items:flex-end;justify-content:center;flex-wrap:wrap;min-height:120px}
.ndg .marks{display:grid;grid-template-columns:repeat(3,1fr);gap:28px 16px}
.ndg .marks .cell{padding:26px 16px;align-items:center}
.ndg .half{transform-origin:bottom left}
.ndg.only-line [data-art-fills],.ndg.only-line [data-art-interior]{display:none}
.ndg.only-fill [data-art-line],.ndg.only-fill [data-art-interior]{display:none}
.ndg .grid25{display:grid;grid-template-columns:repeat(5,28px);gap:8px}
`;

type C = (p: ArtProps) => ReactNode;
const SCENES: { id: ArtId; C: C; half?: boolean }[] = [
  { id: "desk", C: (p) => <Desk interior {...p} />, half: true },
  { id: "lamp", C: Lamp, half: true },
  { id: "chair", C: Chair, half: true },
  { id: "mug", C: Mug, half: true },
  { id: "laptop-closed", C: LaptopClosed },
];
const MARKS: { id: ArtId; C: C; extra?: (p: ArtProps) => ReactNode }[] = [
  { id: "score-ring", C: ScoreRing, extra: (p) => <ScoreRing {...p} style={{ width: 34, height: 34 }} /> },
  { id: "calendar", C: Calendar },
  { id: "tick", C: Tick },
  { id: "arrow", C: Arrow, extra: (p) => <Arrow {...p} style={{ transform: "scaleX(-1) rotate(-30deg)" }} /> },
  { id: "stamp", C: (p) => <Stamp {...p} style={{ transform: "rotate(-8deg)" }} /> },
  { id: "frame", C: Frame, extra: (p) => <Frame empty {...p} /> },
  { id: "seat-ring-a", C: SeatRingA, extra: (p) => <SeatRingA taken {...p} /> },
  { id: "seat-ring-b", C: SeatRingB, extra: (p) => <SeatRingB taken {...p} /> },
  { id: "seat-ring-c", C: SeatRingC, extra: (p) => <SeatRingC taken {...p} /> },
];
const RINGS = [SeatRingA, SeatRingB, SeatRingC];

function Meta({ id }: { id: ArtId }) {
  const a = ART[id];
  return (
    <>
      <h2>{id}</h2>
      <p className="meta">
        {a.w} × {a.h} · {a.length}px · entry ({a.entry.join(", ")}) → exit ({a.exit.join(", ")}) · {a.fills.length} fill
        {a.fills.length === 1 ? "" : "s"}
        <br />
        {a.order.join(" → ")}
      </p>
    </>
  );
}

export function Gallery() {
  const [draw, setDraw] = useState(1);
  const [view, setView] = useState<"both" | "line" | "fill">("both");
  const [live, setLive] = useState(true);
  const d = live ? draw : undefined;
  const cls = `ndg${view === "line" ? " only-line" : view === "fill" ? " only-fill" : ""}`;
  const both = (render: (prefix: string) => ReactNode) => (
    <div className="pair">
      <div className="cell" data-chapter="night">{render("n")}</div>
      <div className="cell" data-chapter="day">{render("d")}</div>
    </div>
  );

  return (
    <main className={cls} data-lenis-prevent>
      <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      <RisoFilters />
      <h1>Night Desk art</h1>
      <p className="meta">Fourteen one-line drawings. Dev gallery, not indexed. Pine is night (lamp line, fills at 0.2); cream is day (pine line, solid fills).</p>
      <div className="bar">
        <label>
          draw
          <input type="range" min={0} max={1} step={0.005} value={draw} onChange={(e) => setDraw(+e.target.value)} aria-label="draw progress" />
          <output style={{ width: 44, fontVariantNumeric: "tabular-nums" }}>{draw.toFixed(2)}</output>
        </label>
        <label>
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> pass as prop (off: CSS --draw default)
        </label>
        {(["both", "line", "fill"] as const).map((v) => (
          <label key={v}>
            <input type="radio" name="view" checked={view === v} onChange={() => setView(v)} /> {v === "both" ? "line + fills" : v === "line" ? "line only" : "fills only"}
          </label>
        ))}
      </div>

      {SCENES.map(({ id, C, half }) => (
        <section key={id} data-shot={id}>
          <Meta id={id} />
          {both((px) => (
            <>
              <C draw={d} idPrefix={px} />
              {half && (
                <div style={{ width: ART[id].w / 2, height: ART[id].h / 2 } as CSSProperties}>
                  <div className="half" style={{ transform: "scale(.5)", width: ART[id].w, height: ART[id].h, transformOrigin: "top left" }}>
                    <C draw={d} idPrefix={`${px}h`} />
                  </div>
                </div>
              )}
            </>
          ))}
        </section>
      ))}

      <div className="marks">
        {MARKS.map(({ id, C, extra }) => (
          <section key={id} data-shot={id} style={{ margin: 0 }}>
            <Meta id={id} />
            {both((px) => (
              <>
                <C draw={d} idPrefix={px} />
                {extra?.({ draw: d, idPrefix: `${px}x` })}
              </>
            ))}
          </section>
        ))}
      </div>

      <section data-shot="seat-grid" style={{ marginTop: 44 }}>
        <h2>seat rings as the 5 × 5 grid</h2>
        <p className="meta">index % 3 picks the ring, index × 37° rotates it. Seats 3 and 17 shown taken.</p>
        {both((px) => (
          <div className="grid25">
            {Array.from({ length: 25 }, (_, i) => {
              const R = RINGS[i % 3];
              return <R key={i} draw={d} idPrefix={`${px}g${i}`} taken={i === 3 || i === 17} style={{ transform: `rotate(${i * 37}deg)` }} />;
            })}
          </div>
        ))}
      </section>
    </main>
  );
}
