"use client";

import { useEffect, useRef, useState } from "react";
import { fullscreenVert, mountGL, noiseGLSL, prefersReducedMotion } from "@/lib/gl";

const frag = /* glsl */ `
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform float uHover;
  varying vec2 vUv;
  ${noiseGLSL}

  void main() {
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 p = (vUv - 0.5) * asp;
    float t = uTime * 0.07;

    vec2 m = (uMouse - 0.5) * asp;
    vec2 toM = p - m;
    float md = length(toM);
    // The pointer pulls the warm field toward it like a slow lens.
    p -= toM * smoothstep(0.55, 0.0, md) * 0.18 * uHover;

    vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 - t + 4.7));
    float f = fbm(p * 1.7 + q * 1.8 + vec2(t * 0.6, -t * 0.4));

    vec3 light = vec3(1.0, 0.89, 0.62);
    vec3 amber = vec3(1.0, 0.76, 0.38);
    vec3 deep = vec3(0.93, 0.55, 0.22);
    vec3 col = mix(light, amber, smoothstep(0.35, 0.6, f));
    col = mix(col, deep, smoothstep(0.62, 0.85, f));

    vec2 e = (vUv - vec2(0.5, 0.5)) * vec2(1.0, 1.7);
    float mask = smoothstep(0.52, 0.06, length(e));
    float glow = smoothstep(0.4, 0.0, md) * uHover;
    float a = mask * (0.28 + 0.5 * smoothstep(0.3, 0.8, f)) + glow * mask * 0.25;
    gl_FragColor = vec4(col * a, a);
  }
`;

/** Living amber light behind the closing call to action. Falls back to a static CSS glow. */
export function AmberField() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || prefersReducedMotion()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, h: 0, th: 0 };
    const section = el.parentElement ?? el;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
      mouse.th = 1;
    };
    const onLeave = () => {
      mouse.th = 0;
    };

    mountGL(
      el,
      (THREE, { width, height }) => {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const mat = new THREE.ShaderMaterial({
          vertexShader: fullscreenVert,
          fragmentShader: frag,
          uniforms: {
            uTime: { value: 0 },
            uRes: { value: new THREE.Vector2(width, height) },
            uMouse: { value: new THREE.Vector2(0.5, 0.5) },
            uHover: { value: 0 },
          },
          transparent: true,
          premultipliedAlpha: true,
          depthTest: false,
          depthWrite: false,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
        quad.frustumCulled = false;
        scene.add(quad);
        return {
          scene,
          camera,
          update(t) {
            mouse.x += (mouse.tx - mouse.x) * 0.05;
            mouse.y += (mouse.ty - mouse.y) * 0.05;
            mouse.h += (mouse.th - mouse.h) * 0.04;
            mat.uniforms.uTime.value = t;
            mat.uniforms.uMouse.value.set(mouse.x, mouse.y);
            mat.uniforms.uHover.value = mouse.h;
          },
          resize(w, h) {
            mat.uniforms.uRes.value.set(w, h);
          },
        };
      },
      { animate: true, maxDpr: 1.25 },
    ).then((ctrl) => {
      if (!ctrl) return;
      if (disposed) return ctrl.dispose();
      setReady(true);
      section.addEventListener("pointermove", onMove);
      section.addEventListener("pointerleave", onLeave);
      cleanup = () => {
        section.removeEventListener("pointermove", onMove);
        section.removeEventListener("pointerleave", onLeave);
        ctrl.dispose();
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-24 -z-10 h-[360px] w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,215,122,0.45),rgba(246,244,239,0))] blur-2xl transition-opacity duration-700 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        ref={host}
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] transition-opacity duration-1000 md:h-[720px] ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}
