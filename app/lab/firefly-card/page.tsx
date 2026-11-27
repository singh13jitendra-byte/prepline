import type { Metadata } from "next";
import { CardLab } from "./CardLab";

/**
 * Dev-only bench for the firefly job card and the "All roles" list (components/fireflies/card).
 * Not linked from the site and not indexed.
 *
 *   /lab/firefly-card                         drag the dot; the card follows it
 *   ?job=role-1&x=0.9&y=0.5                   start on a job, with the dot at a fraction of the screen
 *   ?open=0                                   start closed
 *   ?list=1                                   start with the list open
 *   ?drive=ref                                push the anchor through the ref instead of the prop
 */
export const metadata: Metadata = {
  title: "Firefly card (lab)",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function FireflyCardLabPage() {
  return <CardLab />;
}
