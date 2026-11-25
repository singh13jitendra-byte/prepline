import type * as THREE_NS from "three";
import { fullscreenVert, noiseGLSL, type Three } from "@/lib/gl";
import { LENS_RADIUS } from "./bus";

/**
 * THE LIGHT — draw call 2 of 2. One full-screen quad, drawn under the field.
 *
 * Three soft sources, never more than one doing the talking (storyboard 4):
 *   the line's gold bloom   night side only, with a faint spill on the side it has read
 *   the lamp                Act III, warm, behind and above the sheet
 *   the dawn                Act IV, slow amber fbm below the line, strongest low
 * plus the reading lens' glass. Output is premultiplied; light on the night
 * side is added (alpha 0), the dawn is laid over the cream (alpha > 0).
 * A little ordered noise is added so no gradient ever bands.
 */

const frag = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uTime;
  uniform float uDayTop;
  uniform vec4 uLine;   // x0, x1, y, weight
  uniform float uBloom;
  uniform float uWake;  // +1 the read side is above the line, -1 below
  uniform float uSweep;
  uniform vec3 uLamp;
  uniform float uLampR;
  uniform float uDawn;
  uniform vec3 uLens;
  ${noiseGLSL}

  const vec3 GOLD = vec3(1.0, 0.843, 0.478);

  void main() {
    vec2 p = vec2(gl_FragCoord.x / uDpr, uRes.y - gl_FragCoord.y / uDpr);
    float night = 1.0 - step(uDayTop, p.y);
    vec3 add = vec3(0.0);
    vec4 over = vec4(0.0);

    // Distance to the line segment.
    float cx = clamp(p.x, uLine.x, uLine.y);
    float dy = p.y - uLine.z;
    float d = length(vec2(p.x - cx, dy));

    if (uBloom > 0.001) {
      float core = exp(-d * d / (2.0 * (2.5 + uLine.w) * (2.5 + uLine.w)));
      float mid = exp(-d / 26.0);
      float wide = exp(-d / 120.0);
      float side = clamp(-dy * uWake / 90.0, 0.0, 1.0);
      float b = core * 0.34 + mid * 0.13 + wide * (0.035 + 0.05 * side);
      add += GOLD * b * uBloom * night;
    }
    // Day rising: a warm edge just under the line while it sweeps.
    if (uSweep > 0.001) {
      float under = (1.0 - night) * exp(-max(dy, 0.0) / 70.0);
      over += vec4(vec3(1.0, 0.70, 0.34), 1.0) * under * 0.22 * uSweep;
    }

    // The lamp is laid over the night rather than added to it: warm light added to navy turns grey.
    if (uLamp.z > 0.001) {
      vec2 lv = (p - uLamp.xy) / uLampR;
      lv.y *= 1.1;
      float ld = length(lv);
      float pool = exp(-pow(ld, 1.5) * 3.2);
      float heart = exp(-ld * ld * 11.0);
      float breathe = 0.95 + 0.05 * vnoise(p * 0.004 + vec2(uTime * 0.07, -uTime * 0.05));
      float a = (pool * 0.30 + heart * 0.26) * breathe * uLamp.z * night;
      vec3 lc = mix(vec3(0.82, 0.44, 0.17), vec3(1.0, 0.76, 0.46), heart);
      over = over * (1.0 - a) + vec4(lc * a, a);
      add += vec3(1.0, 0.82, 0.58) * heart * 0.07 * uLamp.z * night;
    }

    if (uLens.z > 0.001) {
      float ld = distance(p, uLens.xy);
      float R = ${LENS_RADIUS.toFixed(1)};
      float glass = (1.0 - smoothstep(0.0, R, ld)) * 0.030 + smoothstep(R - 26.0, R, ld) * (1.0 - step(R, ld)) * 0.035;
      add += vec3(0.86, 0.92, 1.0) * glass * uLens.z * night;
    }

    if (uDawn > 0.001 && night < 0.5) {
      vec2 uv = p / uRes;
      vec2 q0 = vec2(uv.x * uRes.x / uRes.y, uv.y);
      float t = uTime * 0.05;
      vec2 w = vec2(fbm(q0 * 1.3 + t), fbm(q0 * 1.3 - t + 4.7));
      float f = fbm(q0 * 1.7 + w * 1.8 + vec2(t * 0.6, -t * 0.4));
      vec3 light = vec3(1.0, 0.90, 0.66);
      vec3 amber = vec3(1.0, 0.77, 0.42);
      vec3 deep = vec3(0.95, 0.60, 0.28);
      vec3 col = mix(light, amber, smoothstep(0.35, 0.6, f));
      col = mix(col, deep, smoothstep(0.62, 0.88, f));
      // Strongest low, fading upward; a touch stronger toward the right, where the ticket sits.
      float rise = pow(smoothstep(0.08, 1.0, uv.y), 1.5) * (0.8 + 0.2 * smoothstep(0.2, 0.9, uv.x));
      float a = rise * (0.16 + 0.34 * smoothstep(0.3, 0.8, f)) * uDawn;
      over = over * (1.0 - a) + vec4(col * a, a);
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
  uWake: { value: number };
  uSweep: { value: number };
  uLamp: { value: THREE_NS.Vector3 };
  uLampR: { value: number };
  uDawn: { value: number };
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
    uWake: { value: 0 },
    uSweep: { value: 0 },
    uLamp: { value: new THREE.Vector3(0, 0, 0) },
    uLampR: { value: 500 },
    uDawn: { value: 0 },
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
