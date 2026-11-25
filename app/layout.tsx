import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { introBootScript } from "@/lib/intro";

export const metadata: Metadata = {
  title: "Prepline: find the right roles, walk in ready",
  description:
    "A job-search copilot for product designers. Roles ranked by portfolio fit, one board for your pipeline, and a prep sheet the moment an interview is booked.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f4ef",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introBootScript }} />
      </head>
      <body className="font-sans text-[15px] leading-relaxed antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
