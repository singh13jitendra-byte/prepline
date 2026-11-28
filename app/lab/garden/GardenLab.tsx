"use client";

import { useEffect, useRef, useState } from "react";
import { FLOWER_KINDS, type GardenFlower } from "@/components/garden/flowers";
import { createFlower, inspectFlower, preloadFlowers } from "@/components/garden/tripoFlower";
import { mountGL, type GLController } from "@/lib/gl";
import { readWorld } from "@/lib/theme";

const NAMES = { moon: "Moonflower", bell: "Bellflower", poppy: "Poppy", allium: "Allium", lavender: "Lavender" } as const;
const SPACING = 1.05;

type GardenWindow = {
  __garden?: { set: (open: number, lit: number) => void; ready: boolean; info?: unknown; frames: number };
};

/**
 * The five Tripo flower pairs side by side over the painted meadow (garden step 2). One "Open" slider
 * drives them all from bud to full bloom; Play bloom; Lumi's light (a lamp in front of the middle
 * flower that follows the pointer). `window.__garden.set(open, lit)` for screenshots, `.ready` once
 * all ten models are loaded.
 */
export function GardenLab() {
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(0);
  const [lit, setLit] = useState(true);
  const [playing, setPlaying] = useState(false);
  const gl = useRef<GLController | null>(null);
  const names = useRef<(HTMLSpanElement | null)[]>([]);
  const state = useRef({ open: 0, lit: 1, pointer: null as null | { x: number; y: number } });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    const w = window as unknown as GardenWindow;
    w.__garden = {
      ready: false,
      frames: 0,
      set: (o: number, l: number) => {
        state.current.open = o;
        state.current.lit = l;
        setOpen(o);
        setLit(l > 0);
      },
    };
    mountGL(
      el,
      (THREE, size) => {
        const { colors } = readWorld();
        const col = (c: readonly [number, number, number], k = 1) => new THREE.Color().setRGB(c[0] * k, c[1] * k, c[2] * k, THREE.SRGBColorSpace);
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(col(colors.speckCool), col(colors.flowerStem, 0.35), 1.6));
        const key = new THREE.DirectionalLight(col(colors.lampHeart), 1.5);
        key.position.set(0.8, 1.6, 2.4);
        scene.add(key);
        const rim = new THREE.DirectionalLight(col(colors.speckCool), 0.8);
        rim.position.set(-1.5, 1.2, -2);
        scene.add(rim);

        // Lumi's light: a small lamp bead (the real Lumi lives in the story)
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: col(colors.lampHeart) }));
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 16, 12),
          new THREE.MeshBasicMaterial({ color: col(colors.lampDeep), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        bead.add(halo);
        scene.add(bead);
        const lantern = new THREE.Vector3(0.2, 0.66, 0.4);

        const flowers: GardenFlower[] = [];
        preloadFlowers(THREE)
          .then(() => Promise.all(FLOWER_KINDS.map((k) => createFlower(THREE, k))))
          .then(async (made) => {
            if (disposed) return made.forEach((f) => f.dispose());
            made.forEach((f, i) => {
              f.group.position.x = (i - (made.length - 1) / 2) * SPACING;
              scene.add(f.group);
              flowers.push(f);
            });
            const info: Record<string, unknown> = {};
            for (const k of FLOWER_KINDS) info[k] = await inspectFlower(THREE, k);
            if (w.__garden) {
              w.__garden.info = info;
              w.__garden.ready = true;
            }
          })
          .catch((e) => console.error("garden lab:", e));

        const cam = new THREE.PerspectiveCamera(30, size.width / size.height, 0.1, 50);
        const frame = (aspect: number) => {
          cam.aspect = aspect;
          // keep the whole row (about 5.3 units wide) in view
          const dist = Math.max(4.2, 2.7 / aspect / Math.tan((15 * Math.PI) / 180));
          cam.position.set(0, 0.85, dist);
          cam.lookAt(0, 0.5, 0);
          cam.updateProjectionMatrix();
        };
        frame(size.width / size.height);
        const ray = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.4);
        const ndc = new THREE.Vector2();

        return {
          scene,
          camera: cam,
          update: (t, dt) => {
            const s = state.current;
            const p = s.pointer;
            if (p) {
              ndc.set(p.x, p.y);
              ray.setFromCamera(ndc, cam);
              ray.ray.intersectPlane(plane, lantern);
            } else lantern.set(0.2 + Math.sin(t * 0.5) * 0.06, 0.66 + Math.sin(t * 0.9) * 0.03, 0.4);
            bead.position.copy(lantern);
            bead.visible = s.lit > 0;
            bead.updateMatrixWorld();
            for (const f of flowers) {
              f.setOpen(s.open);
              f.setLit(s.lit);
              f.setLantern(s.lit > 0 ? lantern : null, s.lit);
              f.update(t, dt);
            }
            flowers.forEach((f, i) => {
              const tag = names.current[i];
              if (!tag) return;
              const v = new THREE.Vector3(f.group.position.x, -0.04, 0).project(cam);
              tag.style.left = `${((v.x + 1) / 2) * 100}%`;
              tag.style.top = `${((1 - v.y) / 2) * 100}%`;
            });
            if (w.__garden) w.__garden.frames++;
          },
          resize: (wd, h) => frame(wd / h),
          dispose: () => flowers.forEach((f) => f.dispose()),
        };
      },
      { animate: true },
    ).then((c) => {
      if (disposed) c?.dispose();
      else gl.current = c;
    });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      state.current.pointer = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
    };
    const onLeave = () => (state.current.pointer = null);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      disposed = true;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gl.current?.dispose();
      gl.current = null;
    };
  }, []);

  useEffect(() => {
    state.current.open = open;
  }, [open]);
  useEffect(() => {
    state.current.lit = lit ? 1 : 0;
  }, [lit]);
  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 3000;
      const o = Math.min(1, t);
      setOpen(o * o * (3 - 2 * o));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    setOpen(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <main className="garden-lab">
      <style>{`
        .garden-lab{position:fixed;inset:0;background:var(--c-night) url(/scenes/meadow-night-1280.webp) center/cover no-repeat}
        .garden-lab::before{content:"";position:absolute;inset:0;background:color-mix(in oklab,var(--c-night) 40%,transparent)}
        .garden-host{position:absolute;inset:0}
        .garden-names{position:absolute;inset:0;margin:0;pointer-events:none}
        .garden-names span{position:absolute;translate:-50% 6px;color:var(--c-on-night);font-family:var(--font-text);font-size:13px;opacity:.8;white-space:nowrap}
        .garden-ui{position:absolute;left:50%;bottom:28px;translate:-50% 0;display:flex;gap:16px;align-items:center;padding:12px 18px;border-radius:var(--r-pill);background:color-mix(in oklab,var(--c-night) 88%,transparent);color:var(--c-on-night);font-family:var(--font-text);font-size:14px;white-space:nowrap}
        .garden-ui input[type=range]{width:220px;accent-color:var(--art-lamp)}
        .garden-ui button{min-height:40px;padding:0 16px;border-radius:var(--r-pill);border:0;background:var(--art-lamp);color:var(--c-ink);font:inherit;font-weight:600;cursor:pointer}
        .garden-ui label{display:flex;gap:8px;align-items:center}
        @media (max-width:640px){.garden-ui{flex-wrap:wrap;justify-content:center;white-space:normal;width:calc(100% - 32px)}.garden-ui input[type=range]{width:160px}}
      `}</style>
      <div ref={host} className="garden-host" aria-hidden="true" />
      <p className="garden-names" aria-hidden="true">
        {FLOWER_KINDS.map((k, i) => (
          <span key={k} ref={(n) => void (names.current[i] = n)} style={{ left: "-100px" }}>
            {NAMES[k]}
          </span>
        ))}
      </p>
      <div className="garden-ui">
        <label>
          Open
          <input type="range" min={0} max={1} step={0.005} value={open} onChange={(e) => setOpen(Number(e.target.value))} aria-valuetext={open < 0.25 ? "bud" : open < 0.75 ? "half open" : "full bloom"} />
        </label>
        <button type="button" onClick={() => setPlaying(true)}>
          Play bloom
        </button>
        <label>
          <input type="checkbox" checked={lit} onChange={(e) => setLit(e.target.checked)} /> Lumi&rsquo;s light
        </label>
      </div>
    </main>
  );
}
