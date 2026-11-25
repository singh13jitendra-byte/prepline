"use client";

import { useEffect, useRef } from "react";
import { fullscreenVert, isSmallScreen, mountGL, prefersReducedMotion } from "@/lib/gl";

const raysFrag = /* glsl */ `
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uSun;
  varying vec2 vUv;

  float h(float n) { return fract(sin(n) * 43758.5453); }
  float n1(float x) { float i = floor(x); float f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }

  void main() {
    vec2 d = (vUv - uSun) * vec2(uRes.x / uRes.y, 1.0);
    float ang = atan(d.y, d.x);
    float dist = length(d);
    float rays = n1(ang * 13.0 + uTime * 0.12) * 0.6 + n1(ang * 29.0 - uTime * 0.18) * 0.4;
    rays = pow(rays, 2.4);
    float fall = smoothstep(1.7, 0.05, dist);
    float glow = exp(-dist * 2.6) * 0.5;
    float a = clamp(rays * fall * 0.42 + glow, 0.0, 1.0) * 0.55;
    vec3 col = mix(vec3(1.0, 0.85, 0.52), vec3(1.0, 0.97, 0.88), glow * 1.6);
    gl_FragColor = vec4(col * a, a);
  }
`;

const pollenVert = /* glsl */ `
  uniform float uTime;
  uniform float uDpr;
  uniform float uAspect;
  uniform vec2 uMouse;
  attribute vec4 aSeed;
  varying float vAlpha;
  varying float vWarm;

  void main() {
    vec3 p = position;
    float t = uTime;
    p.y = mod(p.y + t * (0.1 + aSeed.x * 0.22) + 5.5, 11.0) - 5.5;
    p.x += sin(t * 0.45 * (0.5 + aSeed.y) + aSeed.z * 6.283) * 0.4;
    p.z += cos(t * 0.35 * (0.5 + aSeed.x) + aSeed.w * 6.283) * 0.3;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;

    // Pollen drifts out of the cursor's way.
    vec2 ndc = clip.xy / clip.w;
    vec2 diff = (ndc - uMouse) * vec2(uAspect, 1.0);
    float dd = length(diff);
    float push = smoothstep(0.38, 0.0, dd) * 0.16;
    ndc += (diff / max(dd, 1e-4)) / vec2(uAspect, 1.0) * push;
    clip.xy = ndc * clip.w;
    gl_Position = clip;

    gl_PointSize = (3.0 + aSeed.w * 9.0) * uDpr * (6.0 / -mv.z);
    float edge = smoothstep(5.5, 4.0, abs(p.y));
    vAlpha = (0.3 + 0.7 * (0.5 + 0.5 * sin(t * 1.4 + aSeed.z * 31.0))) * edge * (0.55 + push * 2.5);
    vWarm = aSeed.y;
  }
`;

const pollenFrag = /* glsl */ `
  varying float vAlpha;
  varying float vWarm;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.7) * vAlpha;
    vec3 col = mix(vec3(1.0, 0.98, 0.9), vec3(1.0, 0.8, 0.42), vWarm);
    gl_FragColor = vec4(col * a, a);
  }
`;

/** Decorative WebGL layer over the hero video: soft light rays and drifting pollen. */
export function HeroLight() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || prefersReducedMotion()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onLeave = () => {
      mouse.tx = 0;
      mouse.ty = 0;
    };

    mountGL(
      el,
      (THREE, { width, height }) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
        camera.position.set(0, 0, 6);

        const rays = new THREE.ShaderMaterial({
          vertexShader: fullscreenVert,
          fragmentShader: raysFrag,
          uniforms: {
            uTime: { value: 0 },
            uRes: { value: new THREE.Vector2(width, height) },
            uSun: { value: new THREE.Vector2(0.72, 1.12) },
          },
          transparent: true,
          premultipliedAlpha: true,
          depthTest: false,
          depthWrite: false,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rays);
        quad.frustumCulled = false;
        quad.renderOrder = -1;
        scene.add(quad);

        const count = isSmallScreen() ? 220 : 560;
        const pos = new Float32Array(count * 3);
        const seed = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() * 2 - 1) * 9;
          pos[i * 3 + 1] = (Math.random() * 2 - 1) * 5.5;
          pos[i * 3 + 2] = -6 + Math.random() * 8;
          for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
        const pollen = new THREE.ShaderMaterial({
          vertexShader: pollenVert,
          fragmentShader: pollenFrag,
          uniforms: {
            uTime: { value: 0 },
            uDpr: { value: Math.min(window.devicePixelRatio || 1, 1.75) },
            uAspect: { value: width / height },
            uMouse: { value: new THREE.Vector2(9, 9) },
          },
          transparent: true,
          premultipliedAlpha: true,
          depthWrite: false,
        });
        const points = new THREE.Points(geo, pollen);
        points.frustumCulled = false;
        scene.add(points);

        return {
          scene,
          camera,
          update(t) {
            mouse.x += (mouse.tx - mouse.x) * 0.06;
            mouse.y += (mouse.ty - mouse.y) * 0.06;
            rays.uniforms.uTime.value = t;
            rays.uniforms.uSun.value.set(0.72 + mouse.x * 0.06, 1.12 + mouse.y * 0.03);
            pollen.uniforms.uTime.value = t;
            const active = mouse.tx !== 0 || mouse.ty !== 0;
            pollen.uniforms.uMouse.value.set(active ? mouse.x : 9, active ? mouse.y : 9);
            camera.position.x = mouse.x * 0.35;
            camera.position.y = mouse.y * 0.2;
            camera.lookAt(0, 0, -2);
          },
          resize(w, h) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            rays.uniforms.uRes.value.set(w, h);
            pollen.uniforms.uAspect.value = w / h;
          },
        };
      },
      { animate: true },
    ).then((ctrl) => {
      if (!ctrl) return;
      if (disposed) return ctrl.dispose();
      const section = el.parentElement ?? el;
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

  return <div ref={host} aria-hidden className="pointer-events-none absolute inset-0 -z-10" />;
}
