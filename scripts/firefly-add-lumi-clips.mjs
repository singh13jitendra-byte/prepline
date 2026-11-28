/**
 * Adds Lumi's moods to the firefly model as new clips: sleepy, wake, curious, perch.
 * (See public/fireflies/README.md, "Clips".) Run from an empty folder with the glTF tools installed:
 *
 *   npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer
 *   node firefly-add-lumi-clips.mjs firefly.glb firefly.glb
 *
 * Re-running on a file that already has the clips replaces them (each clip is rebuilt from `hover`).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { resample, prune } from '@gltf-transform/functions';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, dst] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const D = Math.PI / 180;

// ── quaternion helpers [x,y,z,w] ──
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qax = (ax, deg) => { const h = (deg * D) / 2, s = Math.sin(h); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(h)]; };
const qX = (d) => qax([1, 0, 0], d), qY = (d) => qax([0, 1, 0], d), qZ = (d) => qax([0, 0, 1], d);
const qnorm = (q) => { const l = Math.hypot(...q); return q.map((v) => v / l); };
const slerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b; if (d < 0) { d = -d; bb = b.map((v) => -v); }
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (bb[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (v * Math.sin((1 - t) * th) + bb[i] * Math.sin(t * th)) / s);
};

const node = (name) => root.listNodes().find((n) => n.getName() === name);
const anim = (name) => root.listAnimations().find((a) => a.getName() === name);
const hover = anim('hover');

/** Sample a channel of a clip at time t (linear). */
function sample(clip, nodeName, path, t) {
  const ch = clip.listChannels().find((c) => c.getTargetNode().getName() === nodeName && c.getTargetPath() === path);
  if (!ch) return null;
  const s = ch.getSampler(), inp = s.getInput().getArray(), out = s.getOutput().getArray(), k = out.length / inp.length;
  const dur = inp[inp.length - 1];
  t = ((t % dur) + dur) % dur;
  let i = 0; while (i < inp.length - 2 && inp[i + 1] < t) i++;
  const f = Math.min(1, Math.max(0, (t - inp[i]) / (inp[i + 1] - inp[i] || 1)));
  const a = Array.from(out.slice(i * k, i * k + k)), b = Array.from(out.slice((i + 1) * k, (i + 1) * k + k));
  return path === 'rotation' ? slerp(a, b, f) : a.map((v, j) => v + (b[j] - v) * f);
}
const restOf = (n, path) => (path === 'rotation' ? node(n).getRotation() : path === 'scale' ? node(n).getScale() : node(n).getTranslation());

/** Build a clip from per-channel functions f(t) -> value, sampled at `fps` over `dur` seconds. */
function makeClip(name, dur, fps, channels) {
  const old = anim(name); if (old) old.dispose();
  const a = doc.createAnimation(name);
  for (const [target, path, fn, rate] of channels) {
    const n = Math.max(2, Math.round(dur * (rate || fps)) + 1);
    const times = new Float32Array(n), vals = [];
    for (let i = 0; i < n; i++) { const t = (dur * i) / (n - 1); times[i] = t; vals.push(...fn(t)); }
    const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
    const type = path === 'rotation' ? 'VEC4' : path === 'weights' ? 'SCALAR' : 'VEC3';
    const output = doc.createAccessor().setType(type).setArray(new Float32Array(vals)).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    const channel = doc.createAnimationChannel().setTargetNode(node(target)).setTargetPath(path).setSampler(sampler);
    a.addSampler(sampler).addChannel(channel);
  }
  return a;
}

const HOVER_CH = hover.listChannels().map((c) => [c.getTargetNode().getName(), c.getTargetPath()]);
const LIDS = { upOpen: -50, loOpen: 66.1 }; // degrees about X, from the rest pose
const lid = (deg) => qX(deg);
const ease = (x) => x * x * (3 - 2 * x);
const seg = (t, a, b) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));

/* ── sleepy: half-closed eyes, a drooping head that nods, slow wings (hover at half speed) ── */
{
  const dur = 4;
  const ch = HOVER_CH.filter(([n]) => !['Head'].includes(n)).map(([n, p]) => [n, p, (t) => sample(hover, n, p, t / 2), n.startsWith('Wing') ? 60 : 30]);
  const nod = (t) => 9 + 5 * Math.sin((t / dur) * Math.PI * 2);
  ch.push(['Head', 'rotation', (t) => qmul(qX(nod(t)), sample(hover, 'Head', 'rotation', t / 2)), 30]);
  for (const s of ['L', 'R']) {
    ch.push([`LidUp${s}`, 'rotation', (t) => lid(-14 - 3 * Math.sin((t / dur) * Math.PI * 2)), 8]);
    ch.push([`LidLo${s}`, 'rotation', () => lid(50), 2]);
    ch.push([`Brow${s}`, 'rotation', () => qX(3), 2]);
  }
  makeClip('sleepy', dur, 30, ch);
}

/* ── wake: from sleepy, a stretch (arms up, body long), eyes pop open, settle into hover ── */
{
  const dur = 1.5; // 18 wing beats at 12/s, so the wings end where hover starts
  const sleepyAt = (n, p) => sample(anim('sleepy'), n, p, 0) ?? restOf(n, p);
  const hov0 = (n, p) => sample(hover, n, p, 0) ?? restOf(n, p);
  const blendTo = (n, p, mid, a, b) => (t) => {
    const from = sleepyAt(n, p), to = hov0(n, p);
    const x = t < a ? 0 : t > b ? 1 : (t - a) / (b - a);
    if (!mid) return p === 'rotation' ? slerp(from, to, ease(x)) : from.map((v, i) => v + (to[i] - v) * ease(x));
    // through a middle pose at 45%
    const m = mid;
    if (x < 0.45) { const y = ease(x / 0.45); return p === 'rotation' ? slerp(from, m, y) : from.map((v, i) => v + (m[i] - v) * y); }
    const y = ease((x - 0.45) / 0.55); return p === 'rotation' ? slerp(m, to, y) : m.map((v, i) => v + (to[i] - v) * y);
  };
  const ch = [];
  for (const [n, p] of HOVER_CH) {
    if (n.startsWith('Wing')) { ch.push([n, p, (t) => sample(hover, n, p, t), 60]); continue; }
    if (n.startsWith('Arm') || n.startsWith('Forearm')) continue;
    if (n === 'Body' && p === 'translation') { ch.push([n, p, blendTo(n, p, [0, 0.07, 0.044], 0, 1.3), 30]); continue; }
    ch.push([n, p, blendTo(n, p, null, 0.2, 1.3), 30]);
  }
  // the stretch: arms reach up and out, then come back to hover's
  const armUp = { ArmL: qmul(qZ(78), qX(-20)), ArmR: qmul(qZ(-78), qX(-20)), ForearmL: qZ(-10), ForearmR: qZ(10) };
  for (const n of Object.keys(armUp)) ch.push([n, 'rotation', blendTo(n, 'rotation', armUp[n], 0.05, 1.35), 30]);
  ch.push(['Body', 'scale', (t) => { const k = Math.sin(Math.PI * seg(t, 0.1, 1.0)); return [1 - 0.03 * k, 1 + 0.06 * k, 1 - 0.03 * k]; }, 30]);
  for (const s of ['L', 'R']) {
    ch.push([`LidUp${s}`, 'rotation', (t) => slerp(lid(-14), lid(-58), seg(t, 0.45, 0.62)), 30]);
    ch.push([`LidLo${s}`, 'rotation', (t) => slerp(lid(50), lid(LIDS.loOpen), seg(t, 0.45, 0.62)), 30]);
    ch.push([`Eye${s}`, 'scale', (t) => { const k = 1 + 0.08 * Math.sin(Math.PI * seg(t, 0.5, 1.2)); return [k, k, k]; }, 30]);
    ch.push([`Brow${s}`, 'rotation', (t) => slerp(qX(3), qX(-6), Math.sin(Math.PI * seg(t, 0.45, 1.3))), 30]);
  }
  ch.push(['Mouth_mesh', 'weights', (t) => [0.55 * Math.sin(Math.PI * seg(t, 0.55, 1.4))], 30]);
  makeClip('wake', dur, 30, ch);
}

/* ── curious: head tilted, one brow up, one eye a little wider; wings as hover ── */
{
  const dur = 2;
  const ch = HOVER_CH.filter(([n]) => n !== 'Head').map(([n, p]) => [n, p, (t) => sample(hover, n, p, t), n.startsWith('Wing') ? 120 : 30]);
  ch.push(['Head', 'rotation', (t) => qmul(qmul(qZ(-20 + 2 * Math.sin((t / dur) * Math.PI * 2)), qY(-9)), sample(hover, 'Head', 'rotation', t)), 30]);
  ch.push(['BrowR', 'rotation', () => qX(-8), 2]);
  ch.push(['BrowL', 'rotation', () => qX(1.5), 2]);
  ch.push(['EyeR', 'scale', () => [1.08, 1.08, 1.08], 2]);
  ch.push(['LidUpR', 'rotation', () => lid(-58), 2]);
  ch.push(['LidUpL', 'rotation', () => lid(-44), 2]);
  makeClip('curious', dur, 30, ch);
}

/* ── perch: landed. Wings folded back along the body and still, legs down, a slow breath ── */
{
  const dur = 3;
  const breath = (t) => Math.sin((t / dur) * Math.PI * 2);
  const fold = {
    WingFL: qmul(qY(70), qmul(qZ(-38), qX(-10))),
    WingFR: qmul(qY(-70), qmul(qZ(38), qX(-10))),
    WingHL: qmul(qY(78), qmul(qZ(-52), qX(-6))),
    WingHR: qmul(qY(-78), qmul(qZ(52), qX(-6))),
  };
  const ch = [];
  for (const [n, p] of HOVER_CH) {
    if (fold[n]) { ch.push([n, p, (t) => qmul(qZ((n.endsWith('L') ? -1 : 1) * 1.5 * breath(t)), fold[n]), 30]); continue; }
    if (n === 'Body' && p === 'translation') { ch.push([n, p, (t) => [0, 0.034 + 0.004 * breath(t), 0.044], 30]); continue; }
    if (n === 'Body' && p === 'rotation') { ch.push([n, p, () => qX(-4), 2]); continue; }
    if (n.startsWith('Leg')) { ch.push([n, p, () => qmul(qX(-22), restOf(n, p)), 2]); continue; }
    if (n.startsWith('Shin')) { ch.push([n, p, () => qmul(qX(-25), restOf(n, p)), 2]); continue; }
    // head, abdomen, antennae, arms: hover's, slowed to the breath
    ch.push([n, p, (t) => sample(hover, n, p, (t / dur) * 2), 30]);
  }
  ch.push(['Body', 'scale', (t) => [1 + 0.012 * breath(t), 1 - 0.008 * breath(t), 1 + 0.012 * breath(t)], 30]);
  makeClip('perch', dur, 30, ch);
}

// drop keys a linear blend reproduces (only on the new clips' accessors: the old clips are already lean)
await doc.transform(resample({ tolerance: 1e-4 }), prune({ propertyTypes: ['Accessor'] }));
await io.write(dst, doc);
console.log('clips:', root.listAnimations().map((a) => a.getName()).join(', '));
