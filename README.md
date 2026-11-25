# Prepline landing page

Next.js 15 (App Router) + Tailwind CSS 4 landing page for the Prepline private beta.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production check
```

## What's in it

| Section | File | Notes |
| --- | --- | --- |
| Hero | `components/Hero.tsx` | Looping MotionSites video ("Yellow Flower Skylight") behind a frosted-glass "Your matches" card. Fit scores count up when the card scrolls into view. A sky gradient shows if the video fails to load. The video pauses for people with reduced motion turned on. |
| Intro | `components/Intro.tsx` | Two-line headline with the Instrument Serif "ready." accent, beta seat count and pitch. |
| How it works | `components/Story.tsx` | Ananya's four weeks, cards reveal on scroll. |
| Prep sheet | `components/PrepSheet.tsx` | Working tabs, questions that type in as if written live, and working Asked / Not asked votes with a live tally. |
| Features | `components/Features.tsx` | Four designer-specific features. |
| Waitlist | `components/Waitlist.tsx` + `app/api/waitlist/route.ts` | Validated email form with loading, error and success states. The API route currently logs the email: swap in the Supabase insert noted in the file. |
| Footer | `components/Footer.tsx` | Large faded wordmark. |

All copy and sample data live in `lib/content.ts`. Colours and fonts are tokens in `app/globals.css` (`@theme`), ready to map to Pulse.

## Before launch

1. **Self-host the hero video.** It currently streams from the MotionSites CDN. Download it, put it in `public/hero.mp4`, and set `NEXT_PUBLIC_HERO_VIDEO_SRC=/hero.mp4` (or change the default in `lib/content.ts`). Add a `poster` image for slow connections.
2. **Replace the sample companies** (Kestrel Health, Paisa Labs, Northwell Care) and the Ananya story with real, permission-cleared examples. The "Illustrative example" note sits under the story.
3. **Connect the waitlist** to Supabase in `app/api/waitlist/route.ts`; keep the service-role key in Vercel environment variables only.
4. **Check the privacy line** above the footer matches what the product actually stores.

## Fonts

Geist comes from the official `geist` package and Instrument Serif from `@fontsource/instrument-serif`, so builds don't depend on Google Fonts being reachable.
