# Prepline landing page

Next.js 15 (App Router) + Tailwind CSS 4 landing page for the Prepline private beta.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production check
```

## What's in it

Animations use [Motion](https://motion.dev) (`motion/react`) and all respect the visitor's reduced-motion setting.

| Section | File | What moves |
| --- | --- | --- |
| Nav | `components/Nav.tsx` | Clear over the hero, frosted once you scroll, with a reading-progress line; animated mobile menu. |
| Hero | `components/Hero.tsx` | Headline words rise in, a hand-drawn underline draws under "ready.", glass "Your matches" card tilts toward the pointer, fit scores count up, notifications cycle beside the card, video zooms gently as you scroll. Email sign-up sits right in the hero. |
| Marquee | `components/Marquee.tsx` | Endless strip of who it's for; pauses on hover. |
| How it works | `components/BoardStory.tsx` | Pinned, scroll-driven story: the Kestrel card travels Saved → Applied → Interview → Offer, the prep sheet pops out at the interview, and a small burst celebrates the offer. |
| Prep sheet | `components/PrepSheet.tsx` | Sliding tab indicator, questions type in live, "Asked" votes burst and update a tally. |
| For designers | `components/Bento.tsx` | Portfolio scan that turns case-study lines into questions, design-round cards that fan out on hover, fit bars, and an "asked here" chart. |
| Waitlist | `components/Waitlist.tsx` + `components/WaitlistForm.tsx` + `app/api/waitlist/route.ts` | Letter-by-letter "Your turn", shake on a bad email, drawn checkmark on success. The API route currently logs the email: swap in the Supabase insert noted in the file. |
| Footer | `components/Footer.tsx` | Wordmark letters rise in; each letter warms to amber on hover. |

All copy and sample data live in `lib/content.ts`. Colours and fonts are tokens in `app/globals.css` (`@theme`), ready to map to Pulse.

## Before launch

1. **Self-host the hero video.** It currently streams from the MotionSites CDN. Download it, put it in `public/hero.mp4`, and set `NEXT_PUBLIC_HERO_VIDEO_SRC=/hero.mp4` (or change the default in `lib/content.ts`). Add a `poster` image for slow connections.
2. **Replace the sample companies** (Kestrel Health, Paisa Labs, Northwell Care) and the Ananya story with real, permission-cleared examples. The "Illustrative example" note sits under the story.
3. **Connect the waitlist** to Supabase in `app/api/waitlist/route.ts`; keep the service-role key in Vercel environment variables only.
4. **Check the privacy line** above the footer matches what the product actually stores.

## Fonts

Geist comes from the official `geist` package and Instrument Serif from `@fontsource/instrument-serif`, so builds don't depend on Google Fonts being reachable.
