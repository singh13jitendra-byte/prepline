import type { Metadata } from "next";
import { Gallery } from "@/components/product/gallery/Gallery";

/**
 * Dev-only gallery of the Prepline product screens: every screen, at its
 * showcase size, in every state, on mobile, and under alternative themes.
 * Not linked from the site, not in any sitemap, and marked noindex.
 *
 *   /product                 Night Desk (the chosen direction)
 *   /product?theme=today     today's tokens (the fallback in components/product/tokens.css)
 *   /product?theme=alt       a throwaway palette, fonts and radii (proves nothing is hard-coded)
 *   /product?theme=dark      an inverted palette
 */
export const metadata: Metadata = {
  title: "Prepline product UI (gallery)",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductGalleryPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const themes = ["night-desk", "today", "alt", "dark"] as const;
  type T = (typeof themes)[number];
  const theme: T = themes.includes(sp.theme as T) ? (sp.theme as T) : "night-desk";
  return <Gallery theme={theme} />;
}
