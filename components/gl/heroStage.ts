import type * as T from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SceneSetup, Three } from "@/lib/gl";

export type CardData = { initials: string; title: string; company: string; city: string; score: number };

/** Shared, mutable inputs from the React side. */
export type StageInput = {
  video: HTMLVideoElement | null;
  /** Card slot in CSS pixels, relative to the canvas (read every frame, so it follows layout and parallax). */
  getSlot: () => { x: number; y: number; w: number; h: number } | null;
  scroll: number; // hero scroll progress 0..1
  zoom: number; // video zoom, animated during the intro
  pointer: { x: number; y: number; inside: boolean; type: string }; // CSS px relative to canvas
  revealedAt: number; // performance.now()/1000 at reveal, -1 until then
};

const CARD_W = 3.4;
const CARD_H = 1.06;
const CARD_D = 0.16;
const GAP = 0.2;
const STACK_H = CARD_H * 3 + GAP * 2;

const bgVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const bgFrag = /* glsl */ `
  uniform sampler2D uVideo;
  uniform float uReady;
  uniform float uPlaneAspect;
  uniform float uVideoAspect;
  uniform float uZoom;
  uniform vec2 uShift;
  uniform float uWide;
  varying vec2 vUv;

  void main() {
    vec2 s = uPlaneAspect > uVideoAspect ? vec2(1.0, uVideoAspect / uPlaneAspect) : vec2(uPlaneAspect / uVideoAspect, 1.0);
    vec2 uv = (vUv - 0.5) * s / uZoom + 0.5 + uShift;
    vec3 video = texture2D(uVideo, uv).rgb;
    vec3 sky = mix(vec3(0.86, 0.92, 0.96), vec3(0.25, 0.5, 0.77), vUv.y);
    vec3 col = mix(sky, video, uReady);

    // Same treatment the CSS overlay gave: darker behind the headline, top and bottom.
    vec3 night = vec3(0.039, 0.118, 0.235);
    vec2 c = uWide > 0.5 ? vec2(0.28, 0.45) : vec2(0.5, 0.62);
    float r = mix(0.6, 0.18, smoothstep(0.0, 0.62, length((vUv - c) * vec2(uPlaneAspect * 0.55, 1.0))));
    col = mix(col, night, r);
    col = mix(col, night, smoothstep(0.7, 1.0, vUv.y) * 0.35);
    col = mix(col, night, smoothstep(0.42, 0.0, vUv.y) * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

/** Draws one card face (badge, title, company, score bar) onto a canvas. */
function drawFace(canvas: HTMLCanvasElement, d: CardData, shown: number, font: string, top: boolean) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 6, 6, W - 12, H - 12, 64);
  ctx.fillStyle = top ? "rgba(10,30,60,0.34)" : "rgba(10,30,60,0.26)";
  ctx.fill();

  roundRect(ctx, 44, 92, 136, 136, 34);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#7a5121";
  ctx.font = `600 50px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(d.initials, 112, 162);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 44px ${font}`;
  ctx.fillText(fit(ctx, d.title, 580), 216, 148);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `400 34px ${font}`;
  ctx.fillText(fit(ctx, `${d.company} · ${d.city}`, 580), 216, 204);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 60px ${font}`;
  ctx.fillText(`${Math.round(shown)}/10`, W - 52, 158);
  roundRect(ctx, W - 212, 190, 160, 12, 6);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
  if (shown > 0.05) {
    roundRect(ctx, W - 212, 190, Math.max(12, 160 * (shown / 10)), 12, 6);
    ctx.fillStyle = "#7ee2a8";
    ctx.fill();
  }
}

type Card = {
  group: T.Group;
  face: T.Mesh;
  canvas: HTMLCanvasElement;
  tex: T.CanvasTexture;
  data: CardData;
  slot: number; // where it sits in the ranked list (0 = top)
  pos: T.Vector3;
  vel: T.Vector3;
  rot: T.Vector3;
  rotVel: T.Vector3;
  target: T.Vector3;
  shown: number;
  drawn: number;
  lift: number;
  hover: number;
  enteredAt: number;
};

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/**
 * The cinematic hero: the hero video drawn in WebGL, and three thick glass job
 * cards that refract it. Cards fly in out of order, re-rank themselves, tilt
 * toward the pointer, and can be dragged and flung (they spring back to rank).
 */
export function buildHeroStage(
  THREE: Three,
  { width, height }: { width: number; height: number },
  renderer: T.WebGLRenderer,
  cards: CardData[],
  input: StageInput,
  host: HTMLElement,
): SceneSetup {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.transmissionResolutionScale = width < 768 ? 0.5 : 0.75;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0, 0, 10);
  const BG_Z = -6;

  // Video background plane.
  const videoTex = input.video ? new THREE.VideoTexture(input.video) : null;
  if (videoTex) videoTex.colorSpace = THREE.SRGBColorSpace;
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: bgVert,
    fragmentShader: bgFrag,
    uniforms: {
      uVideo: { value: videoTex },
      uReady: { value: 0 },
      uPlaneAspect: { value: width / height },
      uVideoAspect: { value: 16 / 9 },
      uZoom: { value: 1 },
      uShift: { value: new THREE.Vector2() },
      uWide: { value: 1 },
    },
    toneMapped: false,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.position.z = BG_Z;
  bg.renderOrder = -10;
  scene.add(bg);

  // Lights for the glass edges (environment does most of the work).
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4);
  key.position.set(4, 6, 6);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: 0.55,
    roughness: 0.16,
    ior: 1.45,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    attenuationColor: new THREE.Color(0xcfe0f5),
    attenuationDistance: 1.6,
    specularIntensity: 1,
    envMapIntensity: 1.1,
    iridescence: 0.25,
    iridescenceIOR: 1.3,
  });
  const slab = new RoundedBoxGeometry(CARD_W, CARD_H, CARD_D, 6, 0.2);
  const faceGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  const stack = new THREE.Group();
  scene.add(stack);

  const list: Card[] = cards.map((data, i) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(slab, glass);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round((1024 * CARD_H) / CARD_W);
    drawFace(canvas, data, 0, font, i === 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new THREE.Mesh(
      faceGeo,
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }),
    );
    face.position.z = CARD_D / 2 + 0.004;
    group.add(body, face);
    stack.add(group);
    // Start far behind, scattered.
    const start = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, -14 - i * 2);
    group.position.copy(start);
    group.visible = false;
    return {
      group,
      face,
      canvas,
      tex,
      data,
      slot: [1, 2, 0][i] ?? i, // arrive out of order, then re-rank
      pos: start.clone(),
      vel: new THREE.Vector3(),
      rot: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.5),
      rotVel: new THREE.Vector3(),
      target: new THREE.Vector3(),
      shown: 0,
      drawn: 0,
      lift: 0,
      hover: 0,
      enteredAt: -1,
    };
  });

  const slotPos = (slot: number, out: T.Vector3) =>
    out.set(slot * 0.08, STACK_H / 2 - CARD_H / 2 - slot * (CARD_H + GAP), -slot * 0.12);

  // Layout: map the HTML slot rectangle onto the z=0 plane.
  let visH = 1;
  let visW = 1;
  let W = width;
  let H = height;
  let wide = true;
  const layout = (w: number, h: number) => {
    W = w;
    H = h;
    wide = w / h > 1.05 && w >= 900;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    visW = visH * camera.aspect;
    const d = camera.position.z - BG_Z;
    const bh = 2 * d * Math.tan((camera.fov * Math.PI) / 360) * 1.08;
    bg.scale.set(bh * camera.aspect, bh, 1);
    bgMat.uniforms.uPlaneAspect.value = camera.aspect;
    bgMat.uniforms.uWide.value = wide ? 1 : 0;
    placeStack();
  };
  const placeStack = () => {
    const s = input.getSlot();
    if (!s) return;
    const cx = ((s.x + s.w / 2) / W - 0.5) * visW;
    const cy = -((s.y + s.h / 2) / H - 0.5) * visH;
    const sw = (s.w / W) * visW;
    const sh = (s.h / H) * visH;
    const scale = Math.min(sw / (CARD_W + 0.3), sh / (STACK_H + 0.2));
    stack.position.set(cx, cy, 0);
    stack.scale.setScalar(scale);
  };
  layout(width, height);

  // Pointer → hover / drag.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let hovered: Card | null = null;
  let dragging: Card | null = null;
  const dragOffset = new THREE.Vector3();
  const lastDrag = new THREE.Vector3();
  const throwVel = new THREE.Vector3();

  const pick = (): Card | null => {
    ndc.set((input.pointer.x / W) * 2 - 1, -(input.pointer.y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const bodies = list.filter((c) => c.group.visible).map((c) => c.group.children[0]);
    const hits = ray.intersectObjects(bodies, false);
    if (!hits.length) return null;
    return list.find((c) => c.group.children[0] === hits[0].object) ?? null;
  };
  const pointerOnPlane = (z: number, out: T.Vector3) => {
    ndc.set((input.pointer.x / W) * 2 - 1, -(input.pointer.y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -z;
    ray.ray.intersectPlane(plane, out);
    return stack.worldToLocal(out);
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      const c = pick();
      if (c) c.rotVel.y += 9; // a tap spins the card
      return;
    }
    const c = pick();
    if (!c) return;
    dragging = c;
    host.setPointerCapture(e.pointerId);
    pointerOnPlane(stack.position.z + c.pos.z * stack.scale.x, hit);
    dragOffset.copy(c.pos).sub(hit);
    lastDrag.copy(hit);
    throwVel.set(0, 0, 0);
    host.style.cursor = "grabbing";
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging.vel.copy(throwVel);
    dragging = null;
    if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    host.style.cursor = hovered ? "grab" : "";
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);

  const updateFaces = () => {
    const now = performance.now() / 1000;
    for (const c of list) {
      if (c.enteredAt < 0) continue;
      const k = ease((now - c.enteredAt - 0.5) / 1.2);
      c.shown = c.data.score * k;
      if (Math.abs(c.shown - c.drawn) > 0.04 || (k >= 1 && c.drawn !== c.data.score)) {
        c.drawn = k >= 1 ? c.data.score : c.shown;
        drawFace(c.canvas, c.data, c.drawn, font, c.slot === 0);
        c.tex.needsUpdate = true;
      }
    }
  };

  let lastNow = performance.now() / 1000;
  const K = 70;
  const DAMP = 2 * Math.sqrt(K) * 0.62;

  return {
    scene,
    camera,
    update(t, frameDt) {
      // Physics runs on real time (sub-stepped), so slow devices settle on schedule too.
      const now = performance.now() / 1000;
      const realDt = frameDt === 0 ? 0 : Math.min(0.12, now - lastNow);
      lastNow = now;
      const steps = realDt > 1 / 50 ? 3 : 1;
      const dt = realDt / steps;
      const v = input.video;
      if (videoTex && v && v.readyState >= 2) {
        const r = bgMat.uniforms.uReady;
        r.value = Math.min(1, r.value + realDt * 2);
        if (v.videoWidth) bgMat.uniforms.uVideoAspect.value = v.videoWidth / v.videoHeight;
      }
      if (frameDt === 0 && v?.readyState && v.readyState >= 2) bgMat.uniforms.uReady.value = 1;

      // Pointer: soft parallax on the video and the whole stack.
      const px = input.pointer.inside ? input.pointer.x / W - 0.5 : 0;
      const py = input.pointer.inside ? input.pointer.y / H - 0.5 : 0;
      const sh = bgMat.uniforms.uShift.value as T.Vector2;
      sh.x += (px * 0.012 - sh.x) * 0.05;
      sh.y += (-py * 0.01 - sh.y) * 0.05;
      bgMat.uniforms.uZoom.value = input.zoom * (1 + input.scroll * 0.12);

      placeStack();
      const sc = input.scroll;
      stack.rotation.y += ((wide ? -0.2 : -0.08) + px * 0.25 - stack.rotation.y) * 0.06;
      stack.rotation.x += (0.08 + py * 0.15 + sc * 0.5 - stack.rotation.x) * 0.06;

      // Entrance timeline (seconds after reveal).
      const since = input.revealedAt < 0 ? -1 : performance.now() / 1000 - input.revealedAt;
      list.forEach((c, i) => {
        if (since >= 0.25 + i * 0.14 && c.enteredAt < 0) {
          c.enteredAt = performance.now() / 1000;
          c.group.visible = true;
        }
      });
      if (since > 1.45) {
        list.forEach((c, i) => {
          if (c.slot !== i) {
            c.slot = i; // re-rank: best fit to the top
            c.vel.z += 9; // hop forward while swapping
          }
        });
      }

      // Hover detection (mouse only).
      const canHover = input.pointer.inside && input.pointer.type !== "touch" && !dragging;
      const h = canHover ? pick() : null;
      if (h !== hovered) {
        hovered = h;
        if (!dragging) host.style.cursor = h ? "grab" : "";
      }

      for (const c of list) {
        if (!c.group.visible) continue;
        const isDrag = dragging === c;
        if (isDrag) {
          pointerOnPlane(stack.position.z + c.pos.z * stack.scale.x, hit);
          tmp.copy(hit).sub(lastDrag);
          throwVel.copy(tmp).divideScalar(Math.max(realDt, 1 / 120)).multiplyScalar(0.6);
          lastDrag.copy(hit);
          c.target.copy(hit).add(dragOffset);
          c.target.z = 1.2;
        } else {
          slotPos(c.slot, c.target);
          c.target.y += Math.sin(t * 0.9 + c.slot * 1.3) * 0.05;
          c.target.z += sc * c.slot * 1.4;
        }
        c.hover += ((hovered === c ? 1 : 0) - c.hover) * 0.12;
        c.target.z += c.hover * 0.45;

        // Spring position.
        for (let k = 0; k < steps; k++) {
          tmp.copy(c.target).sub(c.pos).multiplyScalar(isDrag ? K * 3 : K).addScaledVector(c.vel, -DAMP);
          c.vel.addScaledVector(tmp, dt);
          c.pos.addScaledVector(c.vel, dt);
        }

        // Spring rotation: tilt toward the pointer when hovered, lean with velocity.
        let rx = 0;
        let ry = 0;
        if (hovered === c) {
          pointerOnPlane(stack.position.z + c.pos.z * stack.scale.x, hit);
          ry = THREE.MathUtils.clamp((hit.x - c.pos.x) / (CARD_W / 2), -1, 1) * 0.35;
          rx = -THREE.MathUtils.clamp((hit.y - c.pos.y) / (CARD_H / 2), -1, 1) * 0.3;
        }
        rx += -c.vel.y * 0.04;
        ry += c.vel.x * 0.04;
        const rz = -c.vel.x * 0.02;
        for (let k = 0; k < steps; k++) {
          tmp.set(rx - c.rot.x, ry - c.rot.y, rz - c.rot.z).multiplyScalar(K).addScaledVector(c.rotVel, -DAMP);
          c.rotVel.addScaledVector(tmp, dt);
          c.rot.addScaledVector(c.rotVel, dt);
        }

        c.group.position.copy(c.pos);
        c.group.rotation.set(c.rot.x, c.rot.y, c.rot.z);
      }
      updateFaces();
    },
    resize: layout,
    dispose() {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      list.forEach((c) => c.tex.dispose());
      videoTex?.dispose();
      envRT.dispose();
      slab.dispose();
    },
  };
}
