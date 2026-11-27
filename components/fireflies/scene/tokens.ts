/**
 * The 3D meadow's colours, read from the live theme (app/theme.css). Nothing in the scene holds a
 * colour literal: shaders take these as uniforms, the stand-in character takes them as material
 * colours. A token that will not parse falls back to a palette role that always exists.
 */

import { theme, toVec3, type ColorToken, type Vec3 } from "@/lib/theme";

/** role → [token, fallback role from the mirrored palette] */
const ROLES = {
  veil: ["--ff-veil", "--c-night"],
  sky: ["--ff-sky", "--c-night"],
  fog: ["--ff-fog", "--c-night-2"],
  mist: ["--ff-mist", "--art-speck-cool"],
  moon: ["--ff-moon", "--c-on-night"],
  rim: ["--ff-rim", "--art-speck-cool"],
  night: ["--c-night", "--c-night"],
  /** A kept firefly's lantern, and its core. */
  lantern: ["--art-ember", "--art-ember"],
  lanternHot: ["--art-lamp-heart", "--art-lamp-heart"],
  /** A set-aside firefly's lantern. */
  lanternAside: ["--art-speck-cool", "--art-speck-cool"],
  dust: ["--art-lamp-dust", "--art-lamp-dust"],
  skin: ["--ff-skin", "--art-lamp-heart"],
  shell: ["--ff-shell", "--c-ink-2"],
  limb: ["--ff-limb", "--c-ink"],
  cheek: ["--ff-cheek", "--art-ember-cool"],
  wing: ["--ff-wing", "--c-on-night"],
  eye: ["--ff-eye", "--c-ink"],
  eyeWhite: ["--ff-eye-white", "--c-on-night"],
} as const satisfies Record<string, readonly [string, ColorToken]>;

export type FfRole = keyof typeof ROLES;
/** sRGB components, 0..1. */
export type FfColors = Record<FfRole, Vec3>;

export function readFfColors(el?: Element): FfColors {
  const cs = typeof window === "undefined" ? null : getComputedStyle(el ?? document.documentElement);
  const out = {} as FfColors;
  for (const role of Object.keys(ROLES) as FfRole[]) {
    const [token, fallback] = ROLES[role];
    const live = cs?.getPropertyValue(token).trim();
    out[role] = (live && toVec3(live)) || (toVec3(theme.colors[fallback]) as Vec3);
  }
  return out;
}
