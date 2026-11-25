import { ActPrep } from "@/components/acts/ActPrep";
import { ActSeat } from "@/components/acts/ActSeat";
import { BeatRail } from "@/components/BeatRail";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { StoryRoot } from "@/components/story/StoryRoot";
import { StubActs, StubLine } from "@/components/story/stubs";
import { story as copy } from "@/lib/content";

/**
 * "One role, read." Acts I and II are still stubs on this branch.
 * Integration swaps them for <ActRead />, <ActBoard />, and passes <World /> as `world`.
 */
export default function Home() {
  return (
    <>
      <a
        href="#join"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-white"
      >
        {copy.common.skipLink}
      </a>
      <main>
        <StoryRoot
          world={<StubLine />}
          chrome={
            <>
              <Nav />
              <BeatRail />
            </>
          }
        >
          <StubActs />
          <ActPrep />
          <ActSeat />
        </StoryRoot>
      </main>
      <Footer />
    </>
  );
}
