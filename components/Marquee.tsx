import { marqueeTags } from "@/lib/content";

/** Endless, pausable strip of who Prepline is for. */
export function Marquee() {
  const row = [...marqueeTags, ...marqueeTags];
  return (
    <section aria-label="Built for" className="relative overflow-hidden py-10 md:py-14">
      <p className="mb-5 text-center text-[13px] text-muted">Built for designers who get hired on their portfolio</p>
      <div className="group relative [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <ul className="marquee flex w-max gap-3 group-hover:[animation-play-state:paused]">
          {row.map((t, i) => (
            <li
              key={i}
              aria-hidden={i >= marqueeTags.length}
              className="whitespace-nowrap rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
