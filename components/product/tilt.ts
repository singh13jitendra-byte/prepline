/**
 * Delight 9: rows tilt like paper under a fine pointer.
 *
 * One delegated listener for the whole page. Only the row under the pointer is touched: on enter
 * it gets `data-tilt` (product.css fades in its print and shortens the transform transition), on
 * each pointer move (one write per animation frame at most) an inline transform tips it 2.5° at
 * most toward the pointer, and on leave the transform is removed, so CSS eases it back flat.
 * Nothing is written while the pointer is still or away from a row.
 *
 * Rows: the ranked list's MatchRows (rows 2 to 12; row 1 is the Actor's face, which lifts on its
 * own), MatchesList rows and the Board's tiles, wherever they are live controls. The hero laptop's
 * list is `inert` (part of the painted room), so it never receives the pointer.
 *
 * Off for coarse pointers and reduced motion. Returns an uninstall function.
 */

const ROWS = ".rd-row .pp-matchrow, button.pp-mrow, button.pp-tile";
const MAX_DEG = 2.5;
const PERSPECTIVE = 700;

export function installRowTilt(): () => void {
  if (typeof window === "undefined") return () => {};
  const fine = window.matchMedia("(pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let row: HTMLElement | null = null;
  let raf = 0;
  let px = 0;
  let py = 0;
  let last = "";

  const release = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (row) {
      row.removeAttribute("data-tilt");
      row.style.removeProperty("transform");
    }
    row = null;
    last = "";
  };

  const write = () => {
    raf = 0;
    if (!row || !row.isConnected) return release();
    const r = row.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const nx = Math.max(-1, Math.min(1, ((px - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((py - r.top) / r.height) * 2 - 1));
    // The near edge dips away from the pointer, like paper pressed by a fingertip.
    const t = `perspective(${PERSPECTIVE}px) rotateX(${(-ny * MAX_DEG).toFixed(2)}deg) rotateY(${(nx * MAX_DEG).toFixed(2)}deg) translateY(-1px)`;
    if (t !== last) row.style.transform = last = t;
  };

  const over = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || !fine.matches || reduce.matches) return;
    const target = e.target instanceof Element ? (e.target.closest(ROWS) as HTMLElement | null) : null;
    if (target === row) return;
    release();
    if (!target) return;
    row = target;
    row.setAttribute("data-tilt", "");
    px = e.clientX;
    py = e.clientY;
    raf = requestAnimationFrame(write);
  };

  const move = (e: PointerEvent) => {
    if (!row) return;
    px = e.clientX;
    py = e.clientY;
    if (!raf) raf = requestAnimationFrame(write);
  };

  const out = (e: PointerEvent) => {
    if (!row) return;
    const to = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    if (to && row.contains(to)) return;
    release();
  };

  document.addEventListener("pointerover", over, { passive: true });
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerout", out, { passive: true });
  window.addEventListener("blur", release);
  return () => {
    release();
    document.removeEventListener("pointerover", over);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerout", out);
    window.removeEventListener("blur", release);
  };
}
