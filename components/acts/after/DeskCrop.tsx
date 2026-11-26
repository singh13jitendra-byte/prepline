/**
 * A small crop of the painted desk (desk-night: lamp, laptop, mug) for the founder note.
 * Responsive <picture> from public/scenes (AVIF, then WebP), lazy, with explicit size and the
 * manifest's tiny placeholder as a blur-up background, so a missing file never breaks layout.
 */
import manifest from "@/public/scenes/manifest.json";

type Entry = { width: number; height: number; widths: number[]; placeholder?: string };

export function DeskCrop({ className, alt }: { className?: string; alt: string }) {
  const m = (manifest as Record<string, Entry>)["desk-night"];
  const widths = m?.widths ?? [960];
  const set = (ext: string) => widths.map((w) => `/scenes/desk-night-${w}.${ext} ${w}w`).join(", ");
  return (
    <div className={className} style={m?.placeholder ? { backgroundImage: `url(${m.placeholder})` } : undefined}>
      <picture>
        <source type="image/avif" srcSet={set("avif")} sizes="(max-width: 767px) 90vw, 320px" />
        <source type="image/webp" srcSet={set("webp")} sizes="(max-width: 767px) 90vw, 320px" />
        <img
          src={`/scenes/desk-night-${widths[0]}.webp`}
          width={m?.width ?? 2048}
          height={m?.height ?? 1152}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      </picture>
    </div>
  );
}
