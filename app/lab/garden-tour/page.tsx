import type { Metadata } from "next";
import { TourLab } from "./TourLab";

/**
 * Lab: the garden's scroll tour (components/garden/tour) without the 3D scene, so its timing can be
 * judged on its own. Not linked from the site, not indexed.
 *
 *   /lab/garden-tour             scrub with the slider, the arrow keys on it, or the wheel anywhere
 *   ?bp=0.3                      start at this explore beat progress (deterministic screenshots)
 *   ?ui=0                        hide the bench's bar (screenshots)
 *   ?card=1                      also open the real JobCard at the target, to compare footprints
 *
 * Flowers are stand-in rings at the scene's own slots (components/garden/scene/stage.ts), sized by
 * how open they are; the lamp dot is where Lumi is told to go (filled: perched; ring: hovering).
 * Tests: window.__tourLab (set(bp), state()).
 */
export const metadata: Metadata = {
  title: "Prepline lab · the garden tour",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function GardenTourLabPage() {
  return <TourLab />;
}
