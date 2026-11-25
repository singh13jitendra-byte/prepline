import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Intro } from "@/components/Intro";
import { PrepSheetSection } from "@/components/PrepSheet";
import { Story } from "@/components/Story";
import { Waitlist } from "@/components/Waitlist";

export default function Home() {
  return (
    <main className="px-3 pt-3">
      <Hero />
      <Intro />
      <Story />
      <PrepSheetSection />
      <Features />
      <Waitlist />
      <Footer />
    </main>
  );
}
