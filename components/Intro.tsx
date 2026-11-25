import { BETA_SEATS } from "@/lib/content";
import { Reveal } from "./Reveal";

const avatars = [
  { initials: "AK", bg: "bg-[#e9c38a]", fg: "text-ink" },
  { initials: "RS", bg: "bg-[#d9a35c]", fg: "text-ink" },
  { initials: "MP", bg: "bg-[#a96a24]", fg: "text-white" },
];

export function Intro() {
  return (
    <section
      id="top"
      className="mx-auto grid max-w-[1180px] items-end gap-10 px-5 pb-20 pt-12 lg:grid-cols-[2fr_1fr] lg:gap-12 md:px-7 md:pb-24 md:pt-14"
    >
      <Reveal as="h1" className="text-[44px] font-medium leading-none tracking-[-0.04em] sm:text-6xl lg:text-[clamp(52px,4.6vw,68px)]">
        <span className="block lg:whitespace-nowrap">Find the right roles.</span>
        <span className="block lg:whitespace-nowrap">
          Walk in <span className="font-serif font-normal italic tracking-[-0.01em] text-accent">ready.</span>
        </span>
      </Reveal>
      <Reveal delay={120} className="flex flex-col gap-4">
        <div className="flex items-center">
          {avatars.map((a, i) => (
            <span
              key={a.initials}
              aria-hidden
              className={`inline-flex size-9 items-center justify-center rounded-full border-2 border-canvas text-xs font-semibold ${a.bg} ${a.fg} ${i ? "-ml-1.5" : ""}`}
            >
              {a.initials}
            </span>
          ))}
          <span aria-hidden className="-ml-1.5 inline-flex size-9 items-center justify-center rounded-full border-2 border-canvas bg-ink text-[11px] font-semibold text-white">
            +{BETA_SEATS - 3}
          </span>
          <span className="ml-3 text-[13px] text-muted">{BETA_SEATS} designer seats in the beta</span>
        </div>
        <p className="text-[17px] leading-relaxed text-muted">
          A job-search copilot for product designers. Roles ranked by portfolio fit, one board for your pipeline, and a
          prep sheet the moment an interview is booked.
        </p>
      </Reveal>
    </section>
  );
}
