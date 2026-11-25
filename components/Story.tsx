import { weeks } from "@/lib/content";
import { Reveal } from "./Reveal";

export function Story() {
  return (
    <section id="how" className="rounded-[var(--radius-panel)] bg-surface py-20 md:py-24">
      <Reveal className="mx-auto flex max-w-[760px] flex-col items-center gap-3.5 px-5 text-center">
        <span className="text-[13px] font-semibold text-accent">How it works</span>
        <h2 className="text-[34px] font-medium leading-[1.1] tracking-[-0.035em] text-balance md:text-[44px]">
          Ananya’s search, in four weeks.
        </h2>
        <p className="text-[17px] text-muted">
          Roles come to her ranked, prep arrives on its own, and every interview teaches the next sheet something.
        </p>
      </Reveal>

      <ol className="mx-auto mt-14 grid max-w-[1180px] gap-4 px-5 sm:grid-cols-2 md:px-7 lg:grid-cols-4">
        {weeks.map((w, i) => (
          <Reveal
            as="li"
            key={w.label}
            delay={i * 110}
            className={`flex flex-col gap-2.5 rounded-[var(--radius-card)] p-6 ${
              w.highlight ? "border border-accent-line bg-accent-soft" : "bg-canvas"
            }`}
          >
            <span className={`text-xs font-semibold ${w.highlight ? "text-accent" : "text-muted"}`}>{w.label}</span>
            <span className="text-lg font-medium leading-snug">{w.title}</span>
            <span className="text-sm text-muted">{w.body}</span>
          </Reveal>
        ))}
      </ol>
      <p className="mx-auto mt-6 max-w-[1180px] px-5 text-xs text-muted md:px-7">Illustrative example.</p>
    </section>
  );
}
