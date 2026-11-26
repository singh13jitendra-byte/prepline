import type * as THREE_NS from "three";
import { fullscreenVert, noiseGLSL, type Three } from "@/lib/gl";
import { LENS_RADIUS } from "./bus";

/**
 * THE LIGHT — draw call 2 of 2. One full-screen quad, drawn under the field.
 *
 *   the line        a white-hot core with a tight gold bloom, and a warm wake behind it in its
 *                   direction of travel whose length and strength follow its speed
 *   the lamp        a wide elliptical pool, up and left of the sheet (Act III). It begins on the
 *                   board, as the glow under the Interview column, and travels there at nightfall
 *   the dawn        slow amber light below the line, strongest low (Act IV)
 *   the exposure    a 280ms breath of warm white from the line outward at the two day-breaks
 *   the lens        its glass
 *
 * Output is premultiplied. Only the line's core is added; every other warm light is laid over
 * the backdrop with alpha, because warm light added to navy turns grey. A little noise is
 * added so no gradient bands. The dawn is one 3-octave fbm warped by one noise lookup
 * (4 lookups a pixel, where it used to be 15).
 */

const frag = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uTime;
  uniform float uDayTop;
  uniform vec4 uLine;    // x0, x1, y, weight
  uniform float uBloom;
  uniform float uWakeV;  // the line's vertical speed, px/s, signed (+ moving down)
  uniform float uSweep;
  uniform vec3 uLamp;    // x, y, strength
  uniform vec2 uLampR;   // radii of the pool
  uniform float uLampDay; // strength of the same light on the day side (the board glow)
  uniform float uDawn;
  uniform float uFlash;
  uniform vec3 uLens;
  ${noiseGLSL}

  float fbm3(vec2 p) {
    float v = 0.5 * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    v += 0.25 * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    return v + 0.125 * vnoise(p);
  }
  vec4 lay(vec4 under, vec3 col, float a) {
    return under * (1.0 - a) + vec4(col * a, a);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x / uDpr, uRes.y - gl_FragCoord.y / uDpr);
    float night = 1.0 - step(uDayTop, p.y);
    vec3 add = vec3(0.0);
    vec4 over = vec4(0.0);

    float cx = clamp(p.x, uLine.x, uLine.y);
    float dy = p.y - uLine.z;
    float d = length(vec2(p.x - cx, dy));

    if (uLamp.z > 0.001) {
      vec2 lv = (p - uLamp.xy) / uLampR;
      float ld = length(lv);
      float pool = exp(-pow(ld, 1.6) * 2.6);
      float heart = exp(-ld * ld * 7.0);
      float aN = (pool * 0.27 + heart * 0.13) * uLamp.z;
      vec3 cN = mix(vec3(0.80, 0.42, 0.16), vec3(1.0, 0.74, 0.44), heart);
      float aD = pool * 0.42 * uLampDay;
      over = lay(over, mix(vec3(1.0, 0.68, 0.32), cN, night), mix(aD, aN, night));
    }

    if (uDawn > 0.001 && night < 0.5) {
      vec2 uv = p / uRes;
      vec2 q0 = vec2(uv.x * uRes.x / uRes.y, uv.y);
      float t = uTime * 0.05;
      float w = vnoise(q0 * 1.3 + t);
      float f = fbm3(q0 * 1.7 + vec2(w, 1.0 - w) * 1.9 + vec2(t * 0.6, -t * 0.4));
      vec3 col = mix(vec3(1.0, 0.90, 0.66), vec3(1.0, 0.77, 0.42), smoothstep(0.30, 0.52, f));
      col = mix(col, vec3(0.95, 0.60, 0.28), smoothstep(0.54, 0.76, f));
      float rise = pow(smoothstep(0.08, 1.0, uv.y), 1.5) * (0.8 + 0.2 * smoothstep(0.2, 0.9, uv.x));
      over = lay(over, col, rise * (0.16 + 0.34 * smoothstep(0.26, 0.70, f)) * uDawn);
    }

    // The wake: warm light the line leaves behind it, longer and stronger the faster it travels.
    float speed = clamp(abs(uWakeV) / 1500.0, 0.0, 1.0);
    if (speed > 0.004 && uBloom + uSweep > 0.001) {
      float behind = -dy * sign(uWakeV);
      float inX = step(uLine.x - 1.0, p.x) * step(p.x, uLine.y + 1.0);
      float wk = exp(-max(behind, 0.0) / mix(50.0, 170.0, speed)) * smoothstep(-2.0, 3.0, behind) * speed * inX;
      over = lay(over, mix(vec3(1.0, 0.70, 0.34), vec3(1.0, 0.56, 0.17), night), wk * mix(0.26, 0.34, night) * max(uBloom, uSweep));
    }
    // Day rising: a warm edge just under the line while it sweeps.
    if (uSweep > 0.001) {
      over = lay(over, vec3(1.0, 0.70, 0.34), (1.0 - night) * exp(-max(dy, 0.0) / 46.0) * 0.16 * uSweep);
    }
    // The line's own light: a tight gold bloom laid over the night, and a white-hot core added.
    if (uBloom > 0.001) {
      float tight = exp(-d / 5.5);
      float far = exp(-d / 30.0);
      over = lay(over, vec3(1.0, 0.62, 0.20), (tight * 0.42 + far * 0.07) * uBloom * night);
      float sg = 1.1 + 0.45 * uLine.w;
      add += vec3(1.0, 0.90, 0.66) * exp(-d * d / (2.0 * sg * sg)) * 0.55 * uBloom * night;
    }

    if (uFlash > 0.001) {
      float fl = uFlash * exp(-abs(dy) / (uRes.y * 0.5));
      add += vec3(1.0, 0.95, 0.86) * 0.06 * fl * night;
      over = lay(over, vec3(1.0, 0.99, 0.95), 0.12 * fl * (1.0 - night));
    }

    if (uLens.z > 0.001) {
      float ld = distance(p, uLens.xy);
      float R = ${LENS_RADIUS.toFixed(1)};
      float glass = (1.0 - smoothstep(0.0, R, ld)) * 0.030 + smoothstep(R - 26.0, R, ld) * (1.0 - step(R, ld)) * 0.035;
      add += vec3(0.86, 0.92, 1.0) * glass * uLens.z * night;
    }

    float n = (hash21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
    vec3 rgb = over.rgb + add;
    float lit = step(0.0005, over.a + add.r + add.g + add.b);
    gl_FragColor = vec4(max(rgb + n * 1.6 * lit, 0.0), over.a);
  }
`;

export type LightUniforms = {
  uRes: { value: THREE_NS.Vector2 };
  uDpr: { value: number };
  uTime: { value: number };
  uDayTop: { value: number };
  uLine: { value: THREE_NS.Vector4 };
  uBloom: { value: number };
  uWakeV: { value: number };
  uSweep: { value: number };
  uLamp: { value: THREE_NS.Vector3 };
  uLampR: { value: THREE_NS.Vector2 };
  uLampDay: { value: number };
  uDawn: { value: number };
  uFlash: { value: number };
  uLens: { value: THREE_NS.Vector3 };
};

export function createLight(THREE: Three, width: number, height: number) {
  const uniforms: LightUniforms = {
    uRes: { value: new THREE.Vector2(width, height) },
    uDpr: { value: 1 },
    uTime: { value: 0 },
    uDayTop: { value: 1e6 },
    uLine: { value: new THREE.Vector4(0, 0, -100, 2) },
    uBloom: { value: 0 },
    uWakeV: { value: 0 },
    uSweep: { value: 0 },
    uLamp: { value: new THREE.Vector3(0, 0, 0) },
    uLampR: { value: new THREE.Vector2(500, 500) },
    uLampDay: { value: 0 },
    uDawn: { value: 0 },
    uFlash: { value: 0 },
    uLens: { value: new THREE.Vector3(0, 0, 0) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return { mesh, uniforms };
}
