import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
// Night Desk faces (all SIL OFL 1.1). Young Serif: display, one weight. Hanken Grotesk: text, UI and
// figures (variable, upright and italic). Shantell Sans: margin notes only; first used well below
// the fold, so it loads with font-display: swap and is never preloaded.
import "@fontsource/young-serif/latin-400.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource-variable/hanken-grotesk/wght-italic.css";
import "@fontsource-variable/shantell-sans/wght.css";
import "lenis/dist/lenis.css";
// globals.css imports app/theme.css first: the token layer is in place before any rule uses it.
import "./globals.css";
import { Providers } from "@/components/Providers";
import { bootScript } from "@/lib/intro";
import { storyCopy } from "@/lib/content";
import { theme } from "@/lib/theme";

export const metadata: Metadata = {
  title: storyCopy.meta.title,
  description: storyCopy.meta.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: theme.colors["--c-night"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Decides html.motion / html.reduced before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="font-text text-[length:var(--fs-body)] leading-[var(--leading-text)] antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
