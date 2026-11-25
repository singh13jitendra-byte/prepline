import { features } from "@/lib/content";
import { FeatureIcon } from "./Icons";
import { Reveal } from "./Reveal";

export function Features() {
  return (
    <section id="features" className="rounded-[var(--radius-panel)] bg-surface py-20 md:py-24">
      <div className="mx-auto max-w-[1180px] px-5 md:px-7">
        <Reveal as="h2" className="mb-12 text-center text-[34px] font-medium leading-[1.1] tracking-[-0.035em] text-balance md:text-[44px]">
          Built for how designers get hired.
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 100} className="flex flex-col gap-2.5 rounded-[var(--radius-card)] bg-canvas p-6">
              <FeatureIcon name={f.icon} />
              <span className="font-semibold">{f.title}</span>
              <span className="text-sm text-muted">{f.body}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
