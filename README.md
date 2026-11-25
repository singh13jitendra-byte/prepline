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
| Waitlist | `components/Waitlist.tsx` + `components/WaitlistForm.tsx` + `app/api/waitlist/route.ts` | Letter-by-letter "Your turn", shake on a bad email, drawn checkmark on success. Saves to the Supabase `waitlist` table (see below). |
| Footer | `components/Footer.tsx` | Wordmark letters rise in; each letter warms to amber on hover. |

All copy and sample data live in `lib/content.ts`. Colours and fonts are tokens in `app/globals.css` (`@theme`), ready to map to Pulse.

## Supabase (waitlist)

1. Create a Supabase project (free tier is fine) and run `supabase/migrations/20261126000000_waitlist.sql` in the SQL editor. It creates the `waitlist` table with row-level security that allows **insert only**.
2. Add two environment variables in Vercel (Production and Preview) and in `.env.local` for local dev, using `.env.example` as the template:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
3. Redeploy. Sign-ups appear in Supabase → Table editor → `waitlist`. Duplicate emails are accepted quietly and stored once.

Without the env vars the form still works but only logs the email, so local dev never breaks.

## Before launch

1. **Self-host the hero video.** It currently streams from the MotionSites CDN. Download it, put it in `public/hero.mp4`, and set `NEXT_PUBLIC_HERO_VIDEO_SRC=/hero.mp4` (or change the default in `lib/content.ts`). Add a `poster` image for slow connections.
2. **Replace the sample companies** (Kestrel Health, Paisa Labs, Northwell Care) and the Ananya story with real, permission-cleared examples. The "Illustrative example" note sits under the story.
4. **Check the privacy line** above the footer matches what the product actually stores.

## Fonts

Geist comes from the official `geist` package and Instrument Serif from `@fontsource/instrument-serif`, so builds don't depend on Google Fonts being reachable.

## Motion and WebGL

| Piece | Where | Tech |
| --- | --- | --- |
| Light rays + drifting pollen over the hero video, reacting to the cursor | `components/gl/HeroLight.tsx` | Three.js shaders |
| "Matching" story: 2,340 roles filtered to 12 gold matches as you scroll | `components/RoleFunnel.tsx`, `components/gl/funnelScene.ts` | Three.js points + GSAP ScrollTrigger |
| Living amber light behind "Your turn" | `components/gl/AmberField.tsx` | Three.js fragment shader |
| Inertial smooth scrolling | `components/SmoothScroll.tsx` | Lenis on GSAP's ticker |
| Headings that brighten word by word | `components/ScrollWords.tsx` | GSAP SplitText |
| Magnetic "Join the beta" buttons | `components/Magnetic.tsx` | GSAP quickTo |

`lib/gl.ts` loads Three.js on demand (it is not in the first page load), pauses scenes that are off screen or in a hidden tab, caps pixel ratio, and cleans up on unmount. Visitors with reduced motion get no smooth scrolling or decorative layers; the matching story still follows the scroll without autonomous motion. Without WebGL the CSS gradients stay in place.
