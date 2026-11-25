import type { SceneSetup, Three } from "@/lib/gl";

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uDpr;
  uniform vec3 uRingCenter;
  uniform float uRingRadius;
  attribute vec3 aCloud;
  attribute vec3 aCluster;
  attribute vec4 aRand;
  attribute float aKind;   // 0 = filtered at step 1, 1 = filtered at step 2, 2 = a match
  attribute float aSlot;   // position on the ring for matches (0..11)
  varying vec3 vColor;
  varying float vAlpha;

  mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }

  float stage(float p, float a, float b, float r) {
    float x = clamp((p - a) / (b - a) * 1.35 - r * 0.35, 0.0, 1.0);
    return x * x * (3.0 - 2.0 * x);
  }

  void main() {
    float s1 = stage(uProgress, 0.18, 0.46, aRand.x);
    float s2 = stage(uProgress, 0.54, 0.84, aRand.y);

    vec3 cloud = aCloud;
    cloud.xz = rot(uTime * 0.05 + uProgress * 1.4) * cloud.xz;
    cloud.y += sin(uTime * 0.6 + aRand.z * 6.283) * 0.08;

    vec3 cluster = aCluster;
    cluster.xz = rot(uTime * 0.18) * cluster.xz;
    cluster += uRingCenter;

    float ringA = aSlot / 12.0 * 6.2832 + uTime * 0.12;
    vec3 ring = uRingCenter + vec3(cos(ringA), sin(ringA), 0.0) * uRingRadius;

    // Filtered roles drift back and down, out of focus.
    vec3 away = cloud * 1.3 + vec3(0.0, -1.2, -4.0);

    vec3 p = cloud;
    float alpha = 0.75;
    float size = 1.0;
    vec3 base = vec3(1.0, 0.95, 0.86);
    vec3 dim = vec3(0.36, 0.5, 0.72);
    vec3 gold = vec3(1.0, 0.82, 0.45);
    vec3 col = base;

    if (aKind < 0.5) {
      p = mix(cloud, away, s1);
      alpha = mix(0.75, 0.08, s1);
      col = mix(base, dim, s1);
    } else if (aKind < 1.5) {
      p = mix(mix(cloud, cluster, s1), away * 0.8, s2);
      alpha = mix(mix(0.75, 0.95, s1), 0.1, s2);
      size = mix(1.0, 1.5, s1);
      col = mix(base, dim, s2);
    } else {
      p = mix(mix(cloud, cluster, s1), ring, s2);
      alpha = mix(mix(0.75, 1.0, s1), 1.0, s2);
      size = mix(mix(1.0, 1.7, s1), 7.5 + sin(uTime * 2.0 + aSlot) * 0.8, s2);
      col = mix(base, gold, max(s1 * 0.4, s2));
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (3.2 + aRand.w * 3.6) * size * uDpr * (12.0 / -mv.z);
    vColor = col;
    vAlpha = alpha * (0.75 + 0.25 * sin(uTime * 1.3 + aRand.z * 40.0));
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float a = (pow(core, 2.6) * 0.85 + smoothstep(0.14, 0.0, d) * 0.9) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export type FunnelCounts = { total: number; level: number; matches: number };

/**
 * Thousands of points (open roles) swirl as a galaxy, then get filtered twice:
 * most fall back and fade, a cluster stays, and 12 gold points form a ring.
 * `state.progress` (0..1) is driven by GSAP ScrollTrigger.
 */
export function buildFunnelScene(
  THREE: Three,
  { width, height }: { width: number; height: number },
  counts: FunnelCounts,
  state: { progress: number },
): SceneSetup {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 60);
  camera.position.set(0, 0.6, 11);
  camera.lookAt(0, 0, 0);

  const { total, level, matches } = counts;
  const cloud = new Float32Array(total * 3);
  const cluster = new Float32Array(total * 3);
  const rand = new Float32Array(total * 4);
  const kind = new Float32Array(total);
  const slot = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    // Galaxy disc with three loose arms.
    const arm = i % 3;
    const r = Math.pow(Math.random(), 0.7) * 6.5 + 0.4;
    const a = (arm / 3) * Math.PI * 2 + r * 0.55 + (Math.random() - 0.5) * 0.9;
    cloud[i * 3] = Math.cos(a) * r;
    cloud[i * 3 + 1] = (Math.random() - 0.5) * (1.6 - r * 0.12) * 1.4;
    cloud[i * 3 + 2] = Math.sin(a) * r;

    // Tight sphere for roles that pass the first filter.
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const rr = Math.cbrt(Math.random()) * 1.9;
    const s = Math.sqrt(1 - u * u);
    cluster[i * 3] = s * Math.cos(t) * rr;
    cluster[i * 3 + 1] = u * rr;
    cluster[i * 3 + 2] = s * Math.sin(t) * rr;

    for (let k = 0; k < 4; k++) rand[i * 4 + k] = Math.random();
    kind[i] = i < matches ? 2 : i < level ? 1 : 0;
    slot[i] = i < matches ? i : 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(cloud, 3));
  geo.setAttribute("aCloud", new THREE.BufferAttribute(cloud, 3));
  geo.setAttribute("aCluster", new THREE.BufferAttribute(cluster, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
  geo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  geo.setAttribute("aSlot", new THREE.BufferAttribute(slot, 1));

  const ringCenter = new THREE.Vector3();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uDpr: { value: Math.min(window.devicePixelRatio || 1, 1.75) },
      uRingCenter: { value: ringCenter },
      uRingRadius: { value: 2.3 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // Thin gold circle that draws in under the 12 matches.
  const segs = 128;
  const ringPts: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    ringPts.push(Math.cos(a), Math.sin(a), 0);
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3));
  const ringMat = new THREE.LineBasicMaterial({ color: 0xffd77a, transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Line(ringGeo, ringMat);
  scene.add(ring);

  // Warm glow that fills the ring once the matches arrive.
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(smoothstep(1.0, 0.0, d), 2.2) * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.4) * a, a);
      }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
  glow.renderOrder = -1;
  scene.add(glow);

  const layout = (w: number, h: number) => {
    const wide = w / h > 1.1;
    // Desktop: the story text sits left, so the action happens right of centre.
    ringCenter.set(wide ? 2.6 : 0, wide ? 0 : 1.1, 0);
    mat.uniforms.uRingRadius.value = wide ? 2.3 : 1.75;
    camera.position.z = wide ? 11 : 14;
    points.position.x = wide ? 1.4 : 0;
    points.position.y = wide ? 0 : 0.6;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  layout(width, height);

  return {
    scene,
    camera,
    update(t) {
      const p = state.progress;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uProgress.value = p;
      // Ring follows the points' parent offset.
      ring.position.set(ringCenter.x + points.position.x, ringCenter.y + points.position.y, 0);
      ring.scale.setScalar(mat.uniforms.uRingRadius.value);
      ring.rotation.z = t * 0.12;
      const s2 = Math.min(1, Math.max(0, (p - 0.7) / 0.2));
      ringMat.opacity = s2 * 0.4;
      glow.position.copy(ring.position);
      glow.scale.setScalar(mat.uniforms.uRingRadius.value * 3.4);
      glowMat.uniforms.uOpacity.value = s2 * 0.32;
      ringGeo.setDrawRange(0, Math.floor(s2 * (segs + 1)));
    },
    resize: layout,
  };
}
