/**
 * A STAND-IN GARDEN FLOWER — the coded moonflower (components/garden/moonflower.ts) wrapped to the
 * GardenFlower contract (components/garden/flowers.ts), for when the Tripo rig is not available.
 *
 * The moonflower is about 3.9 of its own units tall with its stem base 2.6 below its origin; here it
 * is scaled to 1 unit with the base at the origin, its face already toward +Z. Each kind takes its
 * own petal colour from the theme, so the kinds still read apart.
 */

import type * as THREE_NS from "three";
import { readWorld } from "@/lib/theme";
import type { FlowerKind, GardenFlower } from "../flowers";
import { buildMoonflower } from "../moonflower";

type Three = typeof THREE_NS;

const TALL = 3.9;
const BASE = 2.6;

export function createStandinFlower(THREE: Three, kind: FlowerKind): GardenFlower {
  const { colors } = readWorld();
  const petal = { moon: colors.flowerMoon, bell: colors.flowerBell, poppy: colors.flowerPoppy, allium: colors.flowerAllium, lavender: colors.flowerLavender }[kind];
  const rig = buildMoonflower(THREE, { petal, rim: colors.flowerBell, lamp: colors.lampDeep, heart: colors.lampHeart, stem: colors.flowerStem });
  const group = new THREE.Group();
  rig.group.scale.setScalar(1 / TALL);
  rig.group.position.y = BASE / TALL;
  group.add(rig.group);
  return {
    group,
    kind,
    heart: new THREE.Vector3(0, (BASE + 0.62) / TALL, 0.03 / TALL),
    radius: 1.05 / TALL,
    setOpen: rig.setOpen,
    setLit: rig.setLit,
    update: rig.update,
    setLantern: () => {},
    dispose: rig.dispose,
  };
}
