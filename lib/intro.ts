"use client";

/**
 * One-shot "the hero is revealed" signal. The intro curtain fires it as it lifts
 * (or straight away when the intro is skipped); the headline and the 3D cards
 * start their entrances on it. Late subscribers run immediately.
 */
type Fn = () => void;
let revealed = false;
const subs = new Set<Fn>();

export function onReveal(fn: Fn): () => void {
  if (revealed) {
    fn();
    return () => {};
  }
  subs.add(fn);
  return () => subs.delete(fn);
}

export function reveal() {
  if (revealed) return;
  revealed = true;
  subs.forEach((f) => f());
  subs.clear();
}

/** Runs before first paint (inline in <head>): decides whether to play the intro. */
export const introBootScript = `(function(){var d=document.documentElement;d.classList.add('hp');try{var r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!r&&!sessionStorage.getItem('pl-intro'))d.classList.add('intro');}catch(e){}setTimeout(function(){d.classList.remove('hp','intro')},6000)})();`;
