/**
 * Where the garden's flowers come from: the one switch between the Tripo rig and the stand-in.
 *
 * `makeFlower` always resolves to a GardenFlower (components/garden/flowers.ts), whatever the
 * factory behind it returns (a flower, or a promise of one).
 */

import type * as THREE_NS from "three";
import type { FlowerKind, GardenFlower } from "../flowers";
import { createFlower } from "../tripoFlower";
// The stand-in (the coded moonflower, wrapped), for when the Tripo rig is unavailable:
// import { createStandinFlower as createFlower } from "./standin";

export async function makeFlower(THREE: typeof THREE_NS, kind: FlowerKind): Promise<GardenFlower> {
  return await createFlower(THREE, kind);
}
