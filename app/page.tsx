import { ActBoard } from "@/components/acts/ActBoard";
import { ActPrep } from "@/components/acts/ActPrep";
import { ActRead } from "@/components/acts/ActRead";
import { ActSeat } from "@/components/acts/ActSeat";
import { BeatRail } from "@/components/BeatRail";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { LineScope } from "@/components/story/LineScope";
import { StoryRoot } from "@/components/story/StoryRoot";
import { World } from "@/components/world";
import { story as copy } from "@/lib/content";

/** "One role, read." — the page follows one role from 2,340 specks to your seat ticket. */
export default function Home() {
  return (
    <>
      <a
        href="#join"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-white"
      >
        {copy.common.skipLink}
      </a>
      {/* The nav <header> is a landmark of its own: before <main>, so Tab reaches it first.
          It splits at the line during wipes, so it sits in a line scope. */}
      <LineScope>
        <Nav />
      </LineScope>
      <main>
        <StoryRoot world={<World />} chrome={<BeatRail />}>
          <ActRead />
          <ActBoard />
          <ActPrep />
          <ActSeat />
        </StoryRoot>
      </main>
      <Footer />
    </>
  );
}
