# Firefly character

An original firefly for the explore beat: round peach head with a brown cap, big amber-brown eyes with two highlights, small smile and blush, curved antennae with glowing bulbs, two pairs of veined wings, a small thorax with arms and legs, and a lamp-yellow lantern abdomen (`--art-lamp`, `#f6c945`, rising to `#fbe49a` at its heart).

## Files

| File | Size | Triangles | Draw calls | Nodes | Use |
|---|---|---|---|---|---|
| `firefly.glb` | 270,408 B (264 KB) | 9,844 | 35 | 74 | The focused firefly and any that are close to the camera |
| `firefly-lod.glb` | 103,136 B (101 KB) | 1,310 | 10 | 23 | The flock |
| `halo.png` | 3,632 B | n/a | n/a | n/a | Optional soft halo sprite for the lantern (white with alpha, 128 px) |

Both GLBs use `EXT_meshopt_compression`, `KHR_mesh_quantization` and `EXT_texture_webp` (all three required), so the loader needs a meshopt decoder:

```ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const { scene, animations } = await loader.loadAsync("/fireflies/firefly.glb");
```

Checked in headless Chromium with three 0.187 (the version in `package.json`): both files load, and all four clips play through `AnimationMixer`.

## Scale and orientation

- Y up, facing +Z, right-handed (glTF default). The pivot (root node `Firefly`, at the origin) is at the body centre, in the waist.
- Rest-pose bounds of `firefly.glb`: x −0.69 to 0.69 (wingspan 1.39), y −0.60 to 0.78, z −0.47 to 0.42.
- Head top to lantern tip is about 1.1 units. The antennae add about 0.25 above the head.
- The character hangs upright, with the lantern tilted back (−Z) and down.

## Clips

Each file carries its own four clips; use the `animations` array of the file you loaded.

| Clip | Length | Loop | What it does |
|---|---|---|---|
| `fly` | 0.5 s | Seamless | 24 wing beats a second, body leaning forward 11°, a 2 Hz bob, legs trailing |
| `hover` | 2.0 s | Seamless | 12 beats a second, upright, gentle bob, head and lantern drift, antennae sway |
| `notice` | 1.2 s | One-shot | Quick duck and squint, then a bounce up with wide eyes, raised brows, open smile and lifted arms; settles by 1.1 s |
| `blink` | 0.26 s | One-shot | Lids close and open |

- `notice` ends on exactly the first frame of `hover` (measured difference 0), so `notice` → `hover` needs no blend. Set `clampWhenFinished = true` and `LoopOnce`, then start `hover` at time 0 on the `finished` event.
- Going into `notice` from `fly` or `hover`, cross-fade over about 0.1 s.
- `notice` is authored facing +Z, with only a small head turn (about 7° each way). Yaw the root toward the camera while it plays; the `Head` node can also be aimed in code.
- `blink` only keys the four eyelids, which `fly` and `hover` never touch, so it can play on top of either at full weight. Don't play it during `notice`, which keys the lids itself.
- In `firefly-lod.glb`, `blink` is a no-op (the far version has no lids) and `notice` keeps the body, head and wing motion but not the face.

Animation is rigid node animation plus one morph target (`open`, on the `Mouth` mesh, hero only). There is no skinning, so `scene.clone(true)` is enough for instances.

## Materials

| Name | Used by | Notes |
|---|---|---|
| `body` | Head, cap, thorax, limbs, lids, brows, mouth, antenna stalks | Painted base colour (1024×640) plus an emissive map |
| `glow` | Lantern abdomen and the two antenna bulbs | Emissive; this is the light |
| `wing` | The four wings | `alphaMode: BLEND`, double-sided, veins and alpha painted in the texture |
| `eye` | Eyeballs | Roughness 0.12, painted iris |
| `eye_highlight` | The two highlights in each eye | Unlit white (`KHR_materials_unlit`), so they stay bright in any light |

All five names exist in both files. Shading is painted into the textures (soft occlusion, warm shadow tint, brush variation), and the materials are rough, so the character reads as painted and not as plastic.

Materials are shared between clones. Clone the materials you drive per firefly.

### Driving the glow

```ts
glow.emissiveIntensity = g;                 // 1 = full lamp. Useful range 0.15 to 1.2
body.emissiveIntensity = 0.55 + 0.45 * g;   // keeps the baked lantern bounce in step
wing.emissiveIntensity = 0.5 + 0.5 * g;     // optional: wings catch less light
```

- The `body` emissive map holds two things baked together: a low night ambient (so the character still reads with no lights at all) and the lantern's warm bounce on the body. Don't take `body.emissiveIntensity` to 0, or the body goes nearly black.
- Above about 1.2 the lantern clips towards pale yellow unless the renderer tone-maps.
- For the halo, add an additive sprite at the `GlowAnchor` node (centre of the lantern, in both files), tinted `#f6c945`, about 2.5 units wide at opacity `0.5 * g`, with `depthWrite: false`. Push it about 0.9 units away from the camera along the view ray so it sits behind the whole character; left at the anchor's own depth, it cuts a visible circle on the back of the head when seen from behind.
- `AntennaTipL` and `AntennaTipR` mark the bulbs, if you want sparkles there.

### Driving the wings

- Motion comes from the clips. To drive them yourself, rotate `WingFL`, `WingFR` (fore) and `WingHL`, `WingHR` (hind); each pivots at its root on the thorax.
- `wing.opacity` fades all four (the texture alpha is multiplied by it). GLTFLoader already sets `depthWrite: false` on this material.
- At the `fly` rate the wings alias at 60 fps, which reads as a flutter. For a motion-blur look, lower `wing.opacity` to about 0.6 while flying.

## Lighting used in the review renders

`HemisphereLight(0x9fc4bd, 0x12312c, 0.9)` plus `DirectionalLight(0xfff1dc, 1.5)` from (0.6, 1.2, 2.0); no tone mapping, sRGB output, no environment map. The eyes are glossy, so an environment map or a key light gives them an extra specular glint on top of the built-in highlights.

## Limits

- 35 draw calls for the hero and 10 for the far version, because each moving part is its own node. Use the far version for the flock and the hero for the one or two nearest.
- The far version has no eyelids, brows, mouth or separate limbs; its face is painted into the texture.
- Textures are WebP only, with no PNG fallback.
- The wings are flat cards with no thickness.

## How it was made

Built procedurally (Python and numpy: geometry, painted textures and clips), then packed with glTF-Transform (meshopt, WebP). Nothing was traced or taken from an existing character. Review renders are in `/home/claude/research/firefly-renders/`.
