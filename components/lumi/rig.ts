/**
 * LUMI'S RIG — the existing firefly (public/fireflies/firefly.glb, the same character as the
 * explore stop) in a small transparent canvas of its own.
 *
 * The model carries every clip Lumi needs. The artist's four (fly, hover, notice, blink) plus four
 * added for Lumi in the same file: sleepy (half-closed eyes, nodding head, slow wings), wake (a
 * stretch, eyes pop open, settles on hover's first frame), curious (head tilt, one brow up) and
 * perch (wings folded back, legs down, a slow breath).
 *
 *   rig.mood(m)          cross-fade to a mood; "cheer" plays notice once, "wake" plays wake once, then hover
 *   rig.set({ glow, yaw, pitch, speed })   per frame: the lantern, the turn toward where it flies, how fast
 *   rig.render(t, dt)    draw (called from the story frame loop, never its own rAF)
 *
 * Drawing is driven by the story store (external: true): one draw per page frame, paused off screen
 * and in hidden tabs by mountGL. About 35 draw calls in a canvas of 132 CSS px.
 */

import type * as THREE_NS from "three";
import { mountGL } from "@/lib/gl";
import { FIREFLY_FILES } from "@/components/fireflies/scene/model";
import type { Mood } from "./track";

export type RigMood = Mood | "wake" | "fly";
export type LumiRig = {
  mood: (m: RigMood) => void;
  current: () => RigMood;
  set: (v: { glow: number; yaw: number; pitch: number; roll: number }) => void;
  render: (t: number, dt: number) => void;
  dispose: () => void;
};

const FADE = 0.28;
const LOOPS: Record<Exclude<RigMood, "cheer" | "wake">, string> = { perch: "perch", hover: "hover", curious: "curious", sleepy: "sleepy", fly: "fly" };

export async function mountLumi(host: HTMLElement): Promise<LumiRig | null> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]);
  let gltf: { scene: THREE_NS.Group; animations: THREE_NS.AnimationClip[] };
  try {
    gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(FIREFLY_FILES.hero);
  } catch {
    return null;
  }
  if (!host.isConnected) return null;

  let mixer: THREE_NS.AnimationMixer;
  let actions: Record<string, THREE_NS.AnimationAction> = {};
  let pivot: THREE_NS.Group;
  let glowMat: THREE_NS.MeshStandardMaterial | null = null;
  let bodyMat: THREE_NS.MeshStandardMaterial | null = null;
  let wingMat: THREE_NS.MeshStandardMaterial | null = null;
  let halo: THREE_NS.Sprite | null = null;
  let haloMat: THREE_NS.SpriteMaterial | null = null;
  let mood: RigMood = "perch";
  let active: THREE_NS.AnimationAction | null = null;
  let blinkIn = 2.5;
  const look = { glow: 1, yaw: 0.3, pitch: 0, roll: 0 };

  const gl = await mountGL(
    host,
    (THREE, size, renderer) => {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0x9fc4bd, 0x12312c, 0.9));
      const key = new THREE.DirectionalLight(0xfff1dc, 1.5);
      key.position.set(0.6, 1.2, 2.0);
      scene.add(key);
      const camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.1, 50);
      camera.position.set(0, 0.12, 3.6);
      camera.lookAt(0, 0.06, 0);

      pivot = new THREE.Group();
      const model = gltf.scene;
      pivot.add(model);
      scene.add(pivot);

      // Materials are shared with nothing else on the page (this file is loaded once, here), but clone anyway.
      model.traverse((o) => {
        const m = o as THREE_NS.Mesh;
        if (!m.isMesh) return;
        const mat = (m.material as THREE_NS.MeshStandardMaterial).clone();
        m.material = mat;
        m.frustumCulled = false;
        if (mat.name === "glow") glowMat = mat;
        else if (mat.name === "body") bodyMat = mat;
        else if (mat.name === "wing") wingMat = mat;
      });

      // The halo: an additive sprite behind the character, at the lantern (README: "Driving the glow").
      const anchor = model.getObjectByName("GlowAnchor");
      const tex = new THREE.TextureLoader().load("/fireflies/halo.png");
      haloMat = new THREE.SpriteMaterial({ map: tex, color: 0xf6c945, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 });
      halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(1.6);
      halo.renderOrder = -1;
      scene.add(halo);
      const anchorPos = new THREE.Vector3();
      const toCam = new THREE.Vector3();

      mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
      for (const name of ["notice", "wake", "blink"]) {
        const a = actions[name];
        if (!a) continue;
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      mixer.addEventListener("finished", (e) => {
        const a = (e as unknown as { action: THREE_NS.AnimationAction }).action;
        if (a === actions.blink) return;
        if (a === actions.notice || a === actions.wake) {
          mood = "hover";
          play("hover");
        }
      });
      play("perch", 0);

      return {
        scene,
        camera,
        update: (_t, dt) => {
          mixer.update(dt);
          // a blink now and then, on top of anything that does not move the lids itself
          blinkIn -= dt;
          if (blinkIn <= 0) {
            blinkIn = 2.4 + Math.random() * 3.6;
            if (actions.blink && (mood === "hover" || mood === "perch" || mood === "fly" || mood === "curious")) actions.blink.reset().setEffectiveWeight(1).play();
          }
          pivot.rotation.set(look.pitch, look.yaw, look.roll);
          const g = look.glow;
          if (glowMat) glowMat.emissiveIntensity = 1.15 * g;
          if (bodyMat) bodyMat.emissiveIntensity = 0.55 + 0.45 * Math.min(1, g);
          if (wingMat) {
            wingMat.emissiveIntensity = 0.5 + 0.5 * Math.min(1, g);
            wingMat.opacity = mood === "fly" ? 0.65 : 1;
          }
          if (halo && haloMat && anchor) {
            anchor.getWorldPosition(anchorPos);
            toCam.copy(camera.position).sub(anchorPos).normalize();
            halo.position.copy(anchorPos).addScaledVector(toCam, -0.9);
            haloMat.opacity = 0.45 * g;
          }
        },
        resize: (w, h) => {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        },
        dispose: () => {
          mixer.stopAllAction();
          tex.dispose();
        },
      };
    },
    { animate: false, external: true, maxDpr: 2 },
  );
  if (!gl) return null;

  function play(name: string, fade = FADE) {
    const next = actions[name];
    if (!next || next === active) return;
    next.reset().setEffectiveWeight(1).play();
    if (active && fade > 0) active.crossFadeTo(next, fade, false);
    else if (active) active.stop();
    active = next;
  }

  return {
    mood(m) {
      if (m === mood) return;
      mood = m;
      if (m === "cheer") play("notice", 0.1);
      else if (m === "wake") play("wake", 0.15);
      else play(LOOPS[m]);
    },
    current: () => mood,
    set(v) {
      look.glow = v.glow;
      look.yaw = v.yaw;
      look.pitch = v.pitch;
      look.roll = v.roll;
    },
    render: (t, dt) => gl.render(t, dt),
    dispose: () => {
      gl.dispose();
      actions = {};
    },
  };
}
