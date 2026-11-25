"use client";

/**
 * The intro curtain is gone (storyboard 2.1): the page is scrollable and
 * complete from the first frame. What is left here:
 *
 * - `bootScript`: runs inline in <head> before first paint and decides the
 *   motion mode once. It puts `motion` on <html> when animation is allowed and
 *   `reduced` when the visitor prefers reduced motion. Without JS neither class
 *   is set and the CSS falls back to the same static, stacked page as `reduced`.
 * - `onReveal` / `reveal`: kept only so the old hero components still compile
 *   until integration deletes them. Nothing gates on them any more.
 */
type Fn = () => void;

/** @deprecated Runs `fn` straight away. Delete with Hero.tsx at integration. */
export function onReveal(fn: Fn): () => void {
  fn();
  return () => {};
}

/** @deprecated No-op. Delete with HeroIntro.tsx at integration. */
export function reveal() {}

export const bootScript = `(function(){var d=document.documentElement,r=false;try{r=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){r=true}d.classList.add(r?'reduced':'motion')})();`;
