import type { Metadata } from "next";
import { Lab } from "./Lab";

/**
 * Lab: the 3D garden on its own, full screen (the scene that takes over the story's "explore" beat
 * from the fireflies). Not linked from the site, not indexed.
 *
 *   /lab/garden-scene            the garden, fading in from black once
 *   ?hud=1                       frame time, pixel ratio, draw calls
 *   ?reduced=1                   the reduced-motion version, whatever the system says
 *   ?dpr=1.5                     pin the pixel ratio (the scene otherwise adapts, capped at 2)
 *   ?intro=match                 as the story mounts it: idle until window.__gardenLab.setActive(true),
 *                                then up from the painted meadow, and back down to it on false
 *
 * Tests: window.__garden_scene (state, flowers(), focus(id), clear()).
 */
export const metadata: Metadata = {
  title: "Prepline lab · the garden",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function GardenSceneLabPage() {
  return <Lab />;
}
