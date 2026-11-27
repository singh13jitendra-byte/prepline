/**
 * THE CAMERA — a small crane, not a lerp.
 *
 * A shot is a Pose: where the camera is, what it looks at, its field of view, a touch of roll, and
 * the lens (focus distance and aperture). Two shots exist: the wide one, locked off, where the
 * scene is laid out exactly as the page's painting; and a close-up composed on one firefly.
 *
 * A move is one GSAP tween of a single 0..1 playhead on the engine's own timeline. Everything
 * about the shot is read off that playhead with its own curve, so the move has an order to it:
 *
 *   the heading leads (power3.out): the camera turns toward the firefly at once, which is what
 *   makes a hover feel answered; the body follows on a gentle in-out along a shallow arc (a quadratic
 *   Bezier whose control point is lifted and swung out); the lens tightens with the body; focus
 *   is pulled last, so the background softens as the camera arrives.
 *
 * The move's start is whatever the goal is at that instant, and the close-up it ends on is
 * recomputed every frame from the firefly's (smoothed) position, so re-targeting mid-move and
 * following a hovering firefly are the same code. What is drawn is the goal passed through a
 * first-order follow, which removes the one thing a re-target can leave: a corner in velocity.
 */

import * as THREE from "three";
import { gsap } from "@/lib/gsap";

export type Pose = {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  roll: number;
  /** Focus distance (world units) and aperture radius (world units; 0 = everything sharp). */
  focus: number;
  aperture: number;
};

/**
 * Every pose looks at a point this far down its own axis. What is interpolated in a move is the
 * direction, never the point: a point can end up behind a camera that is still travelling, and the
 * shot would turn round to face it.
 */
const LOOK = 10;
const pose = (): Pose => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(0, 0, -LOOK), fov: 38, roll: 0, focus: 20, aperture: 0 });
function copyPose(to: Pose, from: Pose) {
  to.pos.copy(from.pos);
  to.look.copy(from.look);
  to.fov = from.fov;
  to.roll = from.roll;
  to.focus = from.focus;
  to.aperture = from.aperture;
}

export const WIDE_FOV = 38;
export const CLOSE_FOV = 30;
/** Aperture of the close-up, as a world-space radius for a subject one unit tall: a macro lens, opened up. */
export const CLOSE_APERTURE = 0.115;

export type Composition = {
  /** Where the firefly sits in the frame, in NDC (-1..1). */
  x: number;
  y: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const FWD0 = new THREE.Vector3(0, 0, -1);
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const mA = new THREE.Matrix4();

const eLook = gsap.parseEase("power3.out");
const eBody = gsap.parseEase("power2.inOut");
const eLens = gsap.parseEase("sine.inOut");
const eFocus = gsap.parseEase("power2.inOut");

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly wide = pose();
  /** The shot being asked for this frame. */
  readonly goal = pose();
  /** The shot being drawn. */
  readonly now = pose();
  /** 0 in the wide shot, 1 in a close-up: for everything that follows the camera (dimming, blur). */
  focusAmount = 0;
  /** True while a move is still running. */
  moving = false;

  private from = pose();
  private to = pose();
  private close = pose();
  private play = { p: 1 };
  private tween: gsap.core.Tween | null = null;
  private target: THREE.Vector3 | null = null;
  private comp: Composition = { x: 0, y: 0 };
  private side = 1;
  private arc = new THREE.Vector3();
  private breath = 0;
  private aspect = 1;
  private reduced = false;
  private settled = true;
  /** Height of what a close-up is composed on, in world units (a firefly). */
  private subject = 1;

  constructor(private timeline: gsap.core.Timeline) {
    this.camera = new THREE.PerspectiveCamera(WIDE_FOV, 1, 0.1, 400);
    copyPose(this.goal, this.wide);
    copyPose(this.now, this.wide);
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.wide.fov = WIDE_FOV;
    this.wide.focus = 24;
    this.wide.aperture = 0;
    if (!this.target) {
      copyPose(this.goal, this.wide);
      copyPose(this.now, this.wide);
    }
    this.apply();
  }

  setReduced(on: boolean) {
    this.reduced = on;
    if (on) {
      this.tween?.kill();
      this.target = null;
      this.play.p = 1;
      copyPose(this.from, this.wide);
      copyPose(this.goal, this.wide);
      copyPose(this.now, this.wide);
      this.focusAmount = 0;
      this.moving = false;
      this.apply();
    }
  }

  setSubject(height: number) {
    this.subject = height;
  }

  /** How far the camera stands from a firefly in a close-up. */
  closeDistance(): number {
    const t = Math.tan(THREE.MathUtils.degToRad(CLOSE_FOV) / 2);
    // About a quarter of the frame's height; on a narrow screen, no more than 46% of its width.
    return this.subject * Math.max(1 / (0.52 * t), 0.92 / (0.46 * 2 * t * this.aspect));
  }

  /** Aperture of the close-up for this subject. */
  closeAperture(): number {
    return CLOSE_APERTURE * this.subject;
  }

  /** True while the shot asked for is a close-up. */
  get closeUp(): boolean {
    return this.target !== null;
  }

  /** 0..1 through the current move (1 when none is running). */
  get progress(): number {
    return this.play.p;
  }

  /** Where the close-up's camera will stand (valid while `closeUp`). */
  get closePos(): THREE.Vector3 {
    return this.close.pos;
  }

  /** The close-up on `target`, composed so it lands at `comp` in the frame. Written into `out`. */
  private compose(target: THREE.Vector3, comp: Composition, out: Pose) {
    const d = this.closeDistance();
    // Face the firefly from where the wide camera stands, but only part of the way round: the
    // painting stays roughly square to the lens. Then step a little to the open side for a 3/4 view.
    const dir = vA.copy(target).sub(this.wide.pos).normalize();
    const fwd = vB.copy(FWD0).lerp(dir, 0.5).normalize();
    fwd.applyAxisAngle(UP, -comp.x * 0.16).normalize();
    const right = vC.crossVectors(fwd, UP).normalize();
    const up = vA.crossVectors(right, fwd).normalize();
    const hh = d * Math.tan(THREE.MathUtils.degToRad(CLOSE_FOV) / 2);
    const hw = hh * this.aspect;
    // The point on the optical axis that puts the firefly at (comp.x, comp.y).
    out.look.copy(target).addScaledVector(right, -comp.x * hw).addScaledVector(up, -comp.y * hh);
    out.pos.copy(out.look).addScaledVector(fwd, -d);
    out.look.copy(out.pos).addScaledVector(fwd, LOOK);
    out.fov = CLOSE_FOV;
    out.roll = 0;
    out.focus = d;
    out.aperture = this.closeAperture();
  }

  private start(duration: number) {
    copyPose(this.from, this.goal);
    this.play.p = 0;
    this.settled = false;
    this.moving = true;
    this.tween?.kill();
    this.tween = gsap.to(this.play, { p: 1, duration, ease: "none" });
    this.timeline.add(this.tween, this.timeline.time());
  }

  /**
   * Move onto a firefly. `target` is a live vector (the engine keeps it on the firefly, smoothed);
   * `comp` is where in the frame it should land. Safe to call mid-move: the new move starts from
   * wherever the camera is being asked to be right now.
   */
  focusOn(target: THREE.Vector3, comp: Composition, duration = 1.05) {
    if (this.reduced) return;
    const wasClose = this.target !== null;
    this.target = target;
    this.comp = comp;
    this.side = comp.x >= 0 ? 1 : -1;
    this.compose(target, comp, this.close);
    // The arc: lifted, and swung out to the side the firefly is not on. A re-target between two
    // close-ups also breathes out a little in the middle, so it reads as a move and not a slide.
    const travel = this.close.pos.distanceTo(this.goal.pos);
    this.arc.set(this.side * 0.11 * travel, 0.07 * travel, 0);
    this.breath = wasClose ? Math.min(1, travel / 10) : 0;
    this.start(wasClose ? Math.min(1.2, 0.85 + travel * 0.02) : duration);
  }

  /** Ease back to the wide shot. */
  release(duration = 1.1) {
    if (this.reduced || !this.target) return;
    this.target = null;
    const travel = this.wide.pos.distanceTo(this.goal.pos);
    this.arc.set(-this.side * 0.08 * travel, 0.05 * travel, 0);
    this.breath = 0;
    this.start(duration);
  }

  /** Call once per frame, after the timeline has advanced. */
  update(dt: number) {
    const closeUp = this.target !== null;
    if (closeUp && this.target) this.compose(this.target, this.comp, this.close);
    copyPose(this.to, closeUp ? this.close : this.wide);

    const p = this.play.p;
    if (p >= 1) {
      copyPose(this.goal, this.to);
      this.moving = false;
    } else {
      const body = eBody(p);
      const look = eLook(p);
      const lens = eLens(p);
      // Position on a quadratic Bezier: from → (midpoint + arc) → to.
      const ctrl = vA.copy(this.from.pos).add(this.to.pos).multiplyScalar(0.5).add(this.arc);
      const a = (1 - body) * (1 - body);
      const b = 2 * (1 - body) * body;
      const c = body * body;
      this.goal.pos.set(a * this.from.pos.x + b * ctrl.x + c * this.to.pos.x, a * this.from.pos.y + b * ctrl.y + c * this.to.pos.y, a * this.from.pos.z + b * ctrl.z + c * this.to.pos.z);
      const dir = vB.copy(this.from.look).sub(this.from.pos).normalize();
      dir.lerp(vC.copy(this.to.look).sub(this.to.pos).normalize(), look).normalize();
      this.goal.look.copy(this.goal.pos).addScaledVector(dir, LOOK);
      const out = Math.sin(Math.PI * p) * this.breath;
      this.goal.fov = this.from.fov + (this.to.fov - this.from.fov) * lens + out * 3.2;
      // Bank into the move, level out on arrival.
      this.goal.roll = Math.sin(Math.PI * body) * this.side * (closeUp ? 0.022 : -0.014);
      const pull = eFocus(Math.min(1, Math.max(0, (p - 0.12) / 0.88)));
      this.goal.focus = this.from.focus + (this.to.focus - this.from.focus) * eFocus(p);
      this.goal.aperture = this.from.aperture + (this.to.aperture - this.from.aperture) * pull;
    }

    // First-order follow: quick enough to keep the tween's shape, slow enough to round a re-target.
    const k = this.settled ? 1 : 1 - Math.exp(-13 * dt);
    this.now.pos.lerp(this.goal.pos, k);
    this.now.look.lerp(this.goal.look, k);
    this.now.fov += (this.goal.fov - this.now.fov) * k;
    this.now.roll += (this.goal.roll - this.now.roll) * k;
    this.now.focus += (this.goal.focus - this.now.focus) * k;
    this.now.aperture += (this.goal.aperture - this.now.aperture) * k;
    if (!this.moving && !closeUp && this.now.pos.distanceToSquared(this.wide.pos) < 1e-7 && Math.abs(this.now.fov - this.wide.fov) < 1e-3 && this.now.aperture < 1e-4) {
      // Home: lock off exactly, so the painting is pixel-still in the wide shot.
      copyPose(this.now, this.wide);
      this.settled = true;
    }
    this.focusAmount = Math.min(1, Math.max(0, this.now.aperture / this.closeAperture()));
    this.apply();
  }

  private apply() {
    const cam = this.camera;
    cam.position.copy(this.now.pos);
    mA.lookAt(this.now.pos, this.now.look, UP);
    qA.setFromRotationMatrix(mA);
    qB.setFromAxisAngle(FWD0, this.now.roll);
    cam.quaternion.copy(qA).multiply(qB);
    if (cam.fov !== this.now.fov) {
      cam.fov = this.now.fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld(true);
  }

  /** Thin-lens blur radius (world units) of a point `dist` from the camera, for the shot being drawn. */
  blurAt(dist: number): number {
    return (this.now.aperture * Math.abs(dist - this.now.focus)) / Math.max(this.now.focus, 0.1);
  }

  dispose() {
    this.tween?.kill();
  }
}
