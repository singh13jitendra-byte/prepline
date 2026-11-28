# Garden flowers with Tripo Studio MCP

Paste the block below into Claude Code (Tripo Studio MCP connected). Reference cost from Tripo's own
credit rules: about 25 credits per model (HD 15 + 2K texture 10), about 250 for all ten. An estimate, not
an account charge; the prompt stops after the first flower for approval.

```text
Use the Tripo Studio MCP (and the tripo-studio-mcp skill) to make 3D flowers for my Prepline landing page.

Context: job roles appear as flowers in a painted night meadow. Flower type = role type:
- Moonflower = Product Designer
- Bellflower = UX Designer
- Poppy = UI / Visual Designer
- Allium = Design Systems
- Lavender = UX Research

Art direction for every model: stylized storybook, hand-painted look, soft slightly translucent petals that read well at night, a faint warm glow at the flower's heart. Muted palette: moonflower moon-white #ede6d6, bellflower dusk blue #8fabcf, poppy coral #e58a6e, allium violet #b29ad3, lavender grey-violet #b3aed0, stems and leaves sage green #5e7d63. One flower on its own stem with one or two leaves. No pot, no ground, no base. Upright and centred.

Make 10 models: a closed bud and a full bloom of each flower. Keep each pair matching (same stem, leaves and colours) so they can swap.
1. moon-bloom: a single moonflower (Ipomoea alba) in full bloom: a wide, flat, five-lobed disc of fused moon-white petals with a faint five-pointed star of creases, a soft glowing pale-yellow heart, a thin curving stem, one heart-shaped leaf.
2. moon-bud: the same moonflower as a closed bud: a tight, twisted, spiral-wrapped spindle of moon-white petals with a pointed tip and small green sepals at its base, same stem and leaf.
3. bell-bloom: a bellflower (Campanula) with two open dusk-blue bells hanging from an arching stem, flared five-pointed mouths.
4. bell-bud: the same arching stem with two small closed dusk-blue bell buds hanging.
5. poppy-bloom: a single poppy in full bloom: four broad, soft coral petals forming an open cup around a dark seed head.
6. poppy-bud: the same poppy as a nodding green bud on a curved stem, a seam of coral showing.
7. allium-bloom: a single allium: a sphere of many small star-shaped violet florets on a tall, straight, bare stem.
8. allium-bud: the same allium as a closed teardrop papery sheath with a violet tint, on the same tall stem.
9. lavender-bloom: a lavender stem with a tall spike of grey-violet florets in whorls, a couple of narrow leaves.
10. lavender-bud: the same stem with a slim spike of tight closed grey-violet buds.

Settings for every model: tripo_text_to_model, family hd, the current HD version the schema advertises, texture true, texture_quality standard (2K), face_limit 10000, quad false, its own stable idempotency_key (e.g. prepline-garden-moon-bloom-v1).

Before generating anything, tell me the reference credit estimate from the skill's credit rules (per model and total for 10).
Then generate moon-bloom first, give me its model link and a short description of how it looks, and stop for my OK before making the other 9.
For each finished model, download its GLB to ~/prepline-garden/<name>.glb (moon-bud.glb, moon-bloom.glb, and so on).
At the end, list the 10 files with their sizes and the Tripo task IDs.
```

After the files exist: optimise them for the web, copy to `public/garden/`, and continue with the garden
plan in `CLAUDE.md`.
