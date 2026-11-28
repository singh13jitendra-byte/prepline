"use client";

import { useEffect, useRef, useState } from "react";
import { buildMoonflower, type FlowerRig } from "@/components/garden/moonflower";
import { mountGL, type GLController } from "@/lib/gl";
import { readWorld } from "@/lib/theme";

/**
 * The moonflower on its own over the painted meadow (garden step 1). Drag "Open" from bud to full
 * bloom, play the bloom, and toggle Lumi's light. `window.__garden.set(open, lit)` for screenshots.
 */
export function GardenLab() {
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(0);
  const [lit, setLit] = useState(true);
  const [playing, setPlaying] = useState(false);
  const rig = useRef<FlowerRig | null>(null);
  const gl = useRef<GLController | null>(null);
  const state = useRef({ open: 0, lit: 1 });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let raf = 0;
    mountGL(
      el,
      (THREE, size) => {
        const { colors } = readWorld();
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0x9fc4bd, 0x12312c, 0.9));
        const key = new THREE.DirectionalLight(0xfff1dc, 1.2);
        key.position.set(0.6, 1.2, 2);
        scene.add(key);
        const f = buildMoonflower(THREE, { petal: colors.flowerMoon, rim: colors.flowerBell, lamp: colors.lampDeep, heart: colors.lampHeart, stem: colors.flowerStem });
        f.group.position.y = -0.2;
        scene.add(f.group);
        rig.current = f;
        const cam = new THREE.PerspectiveCamera(32, size.width / size.height, 0.1, 50);
        cam.position.set(0, 0.7, 5.8);
        cam.lookAt(0, 0.15, 0);
        return {
          scene,
          camera: cam,
          update: (t, dt) => {
            f.setOpen(state.current.open);
            f.setLit(state.current.lit);
            f.update(t, dt);
          },
          resize: (w, h) => {
            cam.aspect = w / h;
            cam.updateProjectionMatrix();
          },
          dispose: () => f.dispose(),
        };
      },
      { animate: true },
    ).then((c) => {
      if (disposed) c?.dispose();
      else gl.current = c;
    });
    (window as unknown as { __garden?: unknown }).__garden = {
      set: (o: number, l: number) => {
        state.current = { open: o, lit: l };
        setOpen(o);
      },
    };
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      gl.current?.dispose();
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
        .garden-ui{position:absolute;left:50%;bottom:28px;translate:-50% 0;display:flex;gap:16px;align-items:center;padding:12px 18px;border-radius:var(--r-pill);background:color-mix(in oklab,var(--c-night) 88%,transparent);color:var(--c-on-night);font-family:var(--font-text);font-size:14px}
        .garden-ui input[type=range]{width:220px;accent-color:var(--art-lamp)}
        .garden-ui button{min-height:40px;padding:0 16px;border-radius:var(--r-pill);border:0;background:var(--art-lamp);color:var(--c-ink);font:inherit;font-weight:600;cursor:pointer}
        .garden-ui label{display:flex;gap:8px;align-items:center}
      `}</style>
      <div ref={host} className="garden-host" aria-hidden="true" />
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
