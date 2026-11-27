import type { Metadata } from "next";
import { Lab } from "./Lab";

/**
 * Lab: the 3D firefly meadow on its own, full screen (the scene that becomes the story's "explore"
 * beat). Not linked from the site, not indexed.
 *
 *   /lab/fireflies               the scene, fading in from black once
 *   ?hud=1                       frame time, pixel ratio, draw calls, which model is flying
 *   ?reduced=1                   the reduced-motion version, whatever the system says
 *   ?standin=1                   the procedural stand-in, even when public/fireflies/*.glb exist
 *   ?dpr=1.5                     pin the pixel ratio (the scene otherwise adapts, capped at 2)
 */
export const metadata: Metadata = {
  title: "Prepline lab · the firefly meadow",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function FirefliesLabPage() {
  return <Lab />;
}
