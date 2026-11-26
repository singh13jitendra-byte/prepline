import type { Metadata } from "next";
import { Gallery } from "@/components/art/Gallery";

// Dev gallery for the Night Desk drawings. Not linked from the site and not indexed.
export const metadata: Metadata = {
  title: "Night Desk art · dev gallery",
  robots: { index: false, follow: false },
};

export default function ArtGalleryPage() {
  return <Gallery />;
}
