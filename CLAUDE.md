# Prepline landing page — working notes for Claude Code

Prepline is Jitendra's product: a job-search copilot for product and UX designers in India. It reads
public careers pages every night, keeps the roles that fit your portfolio (each with a reason), and when
an interview is booked it writes a prep sheet. This repo is the landing page for the closed beta.

## Working with Jitendra

- Ask questions one at a time, not several at once.
- When you deploy subagents, set their effort to high (not max, not extra-high).
- Plain language in replies. He is a product designer: show screenshots of visual work, not just diffs.
- Work on the `redesign` branch. `main` auto-deploys to production (https://preplinetool.vercel.app):
  merge `redesign` into `main` only when he says so.
- Preview of `redesign` (behind Vercel login): https://preplinetool-git-redesign-jitendra-singh-s-projects2.vercel.app

## Run and check

```sh
npm ci
npm run dev                                  # http://localhost:3000
NEXT_TELEMETRY_DISABLED=1 npx next build && npx next start -p 3100
python3 scripts/check-story.py http://localhost:3100   # end-to-end story check (287 checks must pass)
node scripts/check-tokens.mjs                # no colour/font literals outside app/theme.css + lib/theme.ts
python3 scripts/shots.py http://localhost:3100 /tmp/shots [small]   # screenshot every beat (desktop / phone)
```

Headless browsers report few CPU cores, so phone-size runs get the no-WebGL fallback: add `?world=gl`
to see WebGL at phone size (shots.py does this for `small`).

## How the page works (read before changing motion)

- **One scroll story, "One role, read."**: `lib/story.ts` is the single clock. Beats (hero, pass1, pass2,
  ranked, reason, daybreak, saved, applied, interview, hinge, nightfall, unfold, q1–q3, votes, dawn, seat,
  footer) with per-beat tracks for the Line, the painted scenes and the Actor (the role card that travels).
  Everything moving subscribes to the store (`story.frame("world", ...)`); never add a second rAF loop.
- **Anchors** (`lib/anchors.ts`): named layout slots everything aims at. Add an id there, register it with
  `useAnchor`, read it with `anchorRect`.
- **Brand: "The Night Desk"**: pine night, cream paper, lamp yellow; Young Serif + Hanken Grotesk, Shantell
  Sans for handwritten margin notes; painted storybook scenes (`public/scenes`). Colours are tokens only
  (`app/theme.css`, mirrored in `lib/theme.ts`). Lamp yellow is never text on cream.
- **Never show invented proof**: no fake testimonials, no fake counts, no seat numbers.

## Lumi, the companion firefly (built)

- Lumi is the existing 3D firefly model `public/fireflies/firefly.glb` (same character as the explore stop).
  Four clips were added to that file for Lumi: `sleepy`, `wake`, `curious`, `perch`
  (`scripts/firefly-add-lumi-clips.mjs`, documented in `public/fireflies/README.md`).
- Code: `components/lumi/` — `rig.ts` (small transparent Three canvas, driven by the story frame loop),
  `track.ts` (per-beat spots, mood, glow, note), `Lumi.tsx` (engine). Mounted in `components/world/index.tsx`.
- Behaviour: dozes above the desk lamp, wakes, says hello, follows a fine pointer; from the first scroll it
  walks the story (through the window, over the meadow, onto the role card, beside the prep sheet as a
  reading light, sleepy at dawn, onto the ticket); after a seat is claimed it says "See you tonight." and
  hangs under the nav CTA. One handwritten note per scene (`lib/content.ts` → `story.lumi.notes`).
- Its light is `worldBus.lantern`: the meadow answers it. The old cursor lantern and nav orbit dot are retired.

## Flowers: the jobs (built)

- Flower type = role type: **Product = moonflower, UX = bellflower, UI/Visual/Interaction = poppy,
  Design Systems = allium, UX Research = lavender** (`components/world/fieldFlowers.ts` → `flowerOf(title)`).
- The meadow's 2,340 jobs are 2D flower sprites from an atlas painted at load (5 types × bud / half / full /
  loose head) in `components/world/fieldScene.ts`. Same reading story as before: unread buds, set-aside stay
  buds and dim, kept open as the Line reads them, the twelve bloom fully as their rows' roles, and in
  `ranked` each blossom flies into its row. No-WebGL fallback (`CssField.tsx`) keeps dots in the grass.

## The garden (built behind `?explore=1`)

Plan agreed with Jitendra: turn the explore stop (`?explore=1`, `components/acts/explore`, a pinned pause
between `pass2` and `ranked`) into **the garden**: ~15 real 3D job flowers in front of the painted meadow.

- **Stage = fit**: full bloom 8–10, half open 6–7, bud ≤5 (its tooltip says why it was set aside).
- **Scroll tour first** (everyone sees it): Lumi flies to the top match → tooltip slip (role · company · city
  · fit) → the flower blooms fully, the tooltip grows into the role card, Lumi perches on it → card folds
  back, flower returns to its real stage → Lumi moves to a bellflower, then a bud → hint "Go on, peek inside
  one", a short hold, then on into the list.
- **Then free explore**: hover (desktop) or tap (phone; second tap opens the card). Lumi flies to the flower,
  tooltip on arrival, click blooms it and opens the card; close/Esc folds it back. Every flower is a real
  button in an accessible list; reduced motion = list + cards, no flight or bloom.
- **Step 1 done**: `components/garden/moonflower.ts`, a coded 3D moonflower driven by one `open` value
  (twisted bud → trumpet → star disc), glassy veined petals, lit heart, pollen; lab at `/lab/garden`.
- **Step 2 done**: the ten Tripo flowers (a bud and a full bloom per type) are in `public/garden/`, optimised
  (meshopt + quantised + 1K WebP, 1.38 MB for all ten); originals in `~/prepline-garden/`. Read
  `public/garden/README.md` first: the models face +X, are 1 unit tall centred on the origin, and need
  `DoubleSide`. Tripo models are static, so the bloom is a shader transition between the two meshes (bud folds
  away, bloom grows open from its heart); "half open" is a point in that transition.
- **Built since (all behind `?explore=1`)**:
  - `components/garden/tripoFlower.ts` + `flowerShape.ts`: `createFlower(THREE, kind)`. Each bud/bloom pair
    is turned to face +Z and pinned at the stem base. Petals and flower heads are found from the texture at
    load. One `open` value drives the bud tightening, a dithered swap, then the bloom growing from its
    heart. Half open is the bloom at about 0.7 size, one mesh. Contract: `components/garden/flowers.ts`.
    Lab: `/lab/garden`.
  - `components/garden/scene/`: `GardenScene`, a drop-in for FireflyScene (same props and handle, plus
    `anchorOf`, `setOpen`, `setChosen`). Fifteen roles stand as flowers over the painted meadow (scenery,
    rig and post are imported from the firefly scene). List picks for roles not on stage fly to the nearest
    flower of the same kind. Lab: `/lab/garden-scene`.
  - `components/garden/tour/`: `tour.ts` is a pure schedule of the beat's progress (scrubbed, reversible;
    `node scripts/check-garden-tour.mjs`). `GardenSlip` grows into a twin of JobCard. Lab: `/lab/garden-tour`.
  - The top match already rests at full bloom, so its "bloom" beat is light (`setChosen`). Lumi perches on
    the card's top edge. On phones the sheet grows only to the card's head, so the flower stays in view.
  - Lumi follows `worldBus.garden` during the stop (`components/lumi`). ExploreStage writes it.
  - `scripts/check-explore.py` checks the garden (run it with the venv Python; its frame check needs Pillow).
- Next: turn the stop on by default (its own commit: it changes the beat list for everyone), then hover
  hints on phones and an accessibility pass of the flowers.

## Open items

- Does the pressed flower also belong on the folded prep sheet's cover at nightfall? It rides there today,
  because the cover is the board card (TileFace).
- Votes beat says "Thursday · 1:10 PM" over a night painting.
- Founder decisions pending: early pricing promise, AI provider in the privacy note, deletion contact email,
  real nightly run time and source count, naming Dr Lal PathLabs, founder note photo.
- Replace invented sample companies (Kestrel Health, Paisa Labs, Northwell Care…) before launch.
- Supabase: delete the test row `claude-connection-check@example.com` from `waitlist`.

Design references (claude.ai, sign-in needed): Lumi storyboard https://claude.ai/artifact/K57f7EL4rGkVXDQMLchvut ·
Beta spec https://claude.ai/artifact/4dsuAnBSQ5YD4i5DYJrX9N
