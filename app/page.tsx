import { StoryRoot } from "@/components/story/StoryRoot";
import { StubActs, StubFooter, StubLine, StubPerformances } from "@/components/story/stubs";
import { story as copy } from "@/lib/content";

/**
 * "One role, read." Foundation build: the four acts are stubs.
 * Integration swaps them for <ActRead />, <ActBoard />, <ActPrep />, <ActSeat />,
 * passes <World /> as `world` and <Nav /> + <BeatRail /> as `chrome`, and
 * replaces StubFooter with <Footer />.
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
        <StoryRoot world={<StubLine />} chrome={<StubPerformances />}>
          <StubActs />
        </StoryRoot>
      </main>
      <StubFooter />
    </>
  );
}
