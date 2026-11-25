import type * as THREE_NS from "three";

export type Three = typeof THREE_NS;

export type SceneSetup = {
  scene: THREE_NS.Scene;
  camera: THREE_NS.Camera;
  /** Called before every frame. `t` is seconds since mount (frozen when not animating). */
  update?: (t: number, dt: number) => void;
  resize?: (width: number, height: number) => void;
  dispose?: () => void;
};

export type GLController = {
  /** Ask for one frame (used when the scene changes without the clock, e.g. on scroll). */
  invalidate: () => void;
  dispose: () => void;
};

type Options = {
  /** Run a continuous clock while on screen. False = render only on invalidate/resize. */
  animate: boolean;
  maxDpr?: number;
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isSmallScreen() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Mounts a Three.js scene into `host`. Three is loaded on demand, so it never
 * weighs on the first paint. The loop pauses when the host is off screen or
 * the tab is hidden, and everything is released on dispose.
 * Resolves to null when WebGL isn't available (the CSS fallback stays visible).
 */
export async function mountGL(
  host: HTMLElement,
  build: (THREE: Three, size: { width: number; height: number }, renderer: THREE_NS.WebGLRenderer) => SceneSetup,
  { animate, maxDpr = 1.75 }: Options,
): Promise<GLController | null> {
  if (!webglAvailable()) return null;
  const THREE = await import("three");
  if (!host.isConnected) return null;

  let renderer: THREE_NS.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "default" });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;height:100%;";

  const size = () => ({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
  const first = size();
  renderer.setSize(first.width, first.height, false);
  const setup = build(THREE, first, renderer);
  host.appendChild(canvas);

  let visible = false;
  let pageVisible = document.visibilityState === "visible";
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let lost = false;

  const draw = () => {
    if (lost) return;
    setup.update?.(clock, 0);
    renderer.render(setup.scene, setup.camera);
  };

  const loop = (now: number) => {
    raf = 0;
    if (!visible || !pageVisible || lost) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    setup.update?.(clock, dt);
    renderer.render(setup.scene, setup.camera);
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    if (animate && !raf && visible && pageVisible) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  let pending = 0;
  const invalidate = () => {
    if (animate && raf) return; // the loop will draw anyway
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      draw();
    });
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        start();
        if (!animate) invalidate();
      }
    },
    { rootMargin: "150px" },
  );
  io.observe(host);

  const ro = new ResizeObserver(() => {
    const s = size();
    renderer.setSize(s.width, s.height, false);
    setup.resize?.(s.width, s.height);
    draw();
  });
  ro.observe(host);

  const onVisibility = () => {
    pageVisible = document.visibilityState === "visible";
    start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  setup.resize?.(first.width, first.height);
  draw();

  return {
    invalidate,
    dispose() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      setup.dispose?.();
      setup.scene.traverse((o) => {
        const m = o as THREE_NS.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}

/** Full-screen quad vertex shader: draws straight into clip space. */
export const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Cheap 2D value noise + fbm, shared by the fragment shaders. */
export const noiseGLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;
