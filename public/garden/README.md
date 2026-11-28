# Garden flowers

The garden's job flowers: a closed bud and a full bloom of each of the five flower types. Flower type = role type,
as in `components/world/fieldFlowers.ts`:

| Flower | Role | Colour |
|---|---|---|
| Moonflower | Product Designer | moon-white `#ede6d6` |
| Bellflower | UX Designer | dusk blue `#8fabcf` |
| Poppy | UI / Visual / Interaction | coral `#e58a6e` |
| Allium | Design Systems | violet `#b29ad3` |
| Lavender | UX Research | grey-violet `#b3aed0` |

Generated with Tripo Studio (HD v3.1, 2K texture, ~10k-face limit) from the prompt in `docs/garden-tripo-prompt.md`,
then optimised for the web. The full-size originals (2K JPEG textures, 0.5 to 1.0 MB each) live outside the repo in
`~/prepline-garden/` on Jitendra's Mac.

## Files

| File | Size | Triangles | Bounds x × z | Notes |
|---|---|---|---|---|
| `moon-bloom.glb` | 100,504 B | 9,472 | 0.42 × 0.54 | Wide white trumpet; the face tilts about 45° up from the front |
| `moon-bud.glb` | 109,996 B | 9,454 | 0.20 × 0.40 | Pointed spiral bud in a green cup; same two leaves as the bloom |
| `bell-bloom.glb` | 131,160 B | 9,628 | 0.42 × 0.80 | Two open bells hanging from an arched stem |
| `bell-bud.glb` | 124,360 B | 9,824 | 0.26 × 0.68 | Three small half-closed bells (the brief said two tight buds) |
| `poppy-bloom.glb` | 139,792 B | 9,488 | 0.40 × 0.60 | Open coral cup around a dark seed head, feathery leaves |
| `poppy-bud.glb` | 136,480 B | 9,666 | 0.36 × 0.42 | Upright green bud with a coral seam (not nodding) |
| `allium-bloom.glb` | 194,448 B | 9,698 | 0.48 × 0.44 | Ball of violet star florets on a bare stem, strap leaves |
| `allium-bud.glb` | 105,072 B | 9,928 | 0.30 × 0.24 | Violet teardrop sheath on the same stem |
| `lavender-bloom.glb` | 167,272 B | 9,788 | 0.20 × 0.20 | Spike of open florets in whorls |
| `lavender-bud.glb` | 174,268 B | 9,718 | 0.19 × 0.19 | Slimmer spike of closed buds |

All ten together are 1.38 MB, down from 7.4 MB for the originals. Each texture is one 1024 × 1024 WebP base colour,
about 5.6 MB of GPU memory per flower.

Every file uses `EXT_meshopt_compression`, `KHR_mesh_quantization` and `EXT_texture_webp` (all required), the same as
`public/fireflies`, so load with a meshopt decoder:

```ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const { scene } = await loader.loadAsync("/garden/moon-bloom.glb");
```

Checked in Chromium with three 0.187 (the version in `package.json`): all ten load and render, and they look the same as
the originals side by side.

## Scale and orientation

- Every model is normalised to 1 unit tall: y runs from −0.5 (stem base) to +0.5 (top). The origin is at the centre of
  the bounding box, not at the stem base, so lift a flower by 0.5 to stand it on the ground.
- **The flowers face +X**, not +Z (that's how Tripo produced them). Rotate −90° about Y to face the camera on +Z.
- Bud and bloom are separate meshes, not one mesh in two poses. They're the same height, but each is centred on its
  own bounding box, so stems may not line up exactly in x/z, and their vertices don't match, so the bloom transition has to cross between two meshes (bud folds away, bloom
  grows from its heart), not morph one into the other.

## Materials

One opaque material per file, with a base colour texture only (no normal, roughness or emissive maps), and
`doubleSided: false`. Petals are single-sided thin shells, so set `material.side = THREE.DoubleSide` in code, or the
backs of petals vanish from some angles. The glow at each flower's heart isn't in the texture. It belongs to the
garden's own lighting (Lumi's light, `worldBus.lantern`).

## Rebuilding

From the originals, with the glTF-Transform CLI 4.x:

```sh
npx @gltf-transform/cli@4 optimize ~/prepline-garden/moon-bloom.glb public/garden/moon-bloom.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify false
```

`--simplify false` keeps Tripo's geometry as it is. Every file is already under 10k triangles.
