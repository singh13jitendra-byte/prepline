import { BoardStory } from "@/components/BoardStory";
import { Bento } from "@/components/Bento";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Nav } from "@/components/Nav";
import { PrepSheetSection } from "@/components/PrepSheet";
import { RoleFunnel } from "@/components/RoleFunnel";
import { Waitlist } from "@/components/Waitlist";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="px-3 pt-3">
        <Hero />
        <Marquee />
        <RoleFunnel />
        <BoardStory />
        <PrepSheetSection />
        <Bento />
        <Waitlist />
        <Footer />
      </main>
    </>
  );
}
