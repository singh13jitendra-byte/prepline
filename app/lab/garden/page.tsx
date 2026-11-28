import type { Metadata } from "next";
import { GardenLab } from "./GardenLab";

/**
 * Dev-only bench for the garden's 3D flowers (components/garden). Not linked from the site and not
 * indexed. Step 1: the moonflower, bud to full bloom.
 */
export const metadata: Metadata = {
  title: "Garden flowers (lab)",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function GardenLabPage() {
  return <GardenLab />;
}
