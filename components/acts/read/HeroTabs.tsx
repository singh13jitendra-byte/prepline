"use client";

/**
 * DELIGHT 1 — "the tabs actually close" (hero only, decorative).
 *
 * The headline says "Close the other tabs." So, on load, a crowded row of browser tabs pops in
 * under the nav pill (40ms apart, after the hero intro), the Prepline tab active in paper, the rest
 * muted night, a tiny "12 tabs" count on the right. The first scroll closes them, right to left:
 * each × takes a micro press, the tab collapses while the ones left of it widen to take the room
 * (Chrome's reflow, with a soft settle), the count rolls down, and each closed tab lets one firefly
 * and a puff of dust go. The Prepline tab, alone, widens, then tucks up into the nav logo by hero
 * 0.156, before the headline starts to fade at 0.16.
 *
 * Mechanics
 *   - Scrubbed and reversible: every value is a pure function of hero progress `h`, written by one
 *     story subscriber. Transforms and opacity only. Writes are cached (only changed strings land)
 *     and stop entirely once h passes the end: the strip is then `visibility: hidden`.
 *   - A tab's visual width is a clip: `.tb-clip` (natural width Wmax) is scaled to the width and
 *     `.tb-inner` is counter-scaled, so the title stays at its size and is cut at the tab's edge.
 *     The right cap (fade, "…", ×, the right corner and foot) rides that edge by translateX. The
 *     ellipsis is shown only when the title does not fit (title widths are measured once).
 *   - Layout is read only in measure() (mount, resize, fonts ready), never in the subscriber.
 *   - aria-hidden, pointer-events none, never focusable. Phones (<768px) show five tabs with
 *     shorter titles. Reduced motion and no-JS: nothing is shown (`.only-motion`).
 */

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { BEATS, story } from "@/lib/story";
import { ease } from "@/lib/theme";
import { span } from "./runtime";
import "./tabs.css";

type Fav = "mark" | "dot" | "sq" | "ring" | "dia" | "bars" | "doc" | "tri" | "half" | "grid" | "note" | "blank" | "gap";
type Tab = { title: string; short?: string; fav: Fav; phone?: boolean };

/** Generic job-hunt titles: no real product names or marks. Index 0 is the active Prepline tab. */
const TABS: readonly Tab[] = [
  { title: "Prepline · Walk in ready", short: "Prepline", fav: "mark", phone: true },
  { title: "Careers · Senior Product Designer", short: "Sr PD", fav: "sq", phone: true },
  { title: "Jobs at a fintech", fav: "dot" },
  { title: "Design Systems Lead – apply", fav: "dia" },
  { title: "Job tracker – applications", fav: "bars" },
  { title: "Portfolio v7 final FINAL", short: "v7 FINAL", fav: "doc", phone: true },
  { title: "Feed · 14 new posts", fav: "ring" },
  { title: "Company reviews – worth it?", fav: "half" },
  { title: "Spreadsheet – roles.xlsx", short: "roles.xlsx", fav: "grid", phone: true },
  { title: "Interview prep notes", short: "Notes", fav: "note", phone: true },
  { title: "Untitled", fav: "blank" },
  { title: "Careers page (3)", fav: "gap" },
];
const COUNTS = TABS.map((_, i) => TABS.length - i);
const HERO_INDEX = BEATS.findIndex((b) => b.id === "hero");

/** Hero progress windows. The headline's fade starts at 0.16 and must not be touched. */
const CLOSE: [number, number] = [0.006, 0.112];
const TUCK: [number, number] = [0.112, 0.152];
const END = 0.156;
/** Each tab's close lasts this many "slots"; one slot is the stagger between two tabs. */
const SLOT_LEN = 2.2;

const smooth = (x: number) => x * x * (3 - 2 * x);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** back.out(1.5): passes 1 and returns, for the neighbours' settle. */
const backOut = (x: number) => {
  const c = 1.5;
  const t = x - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
const bell = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));

/** One tab's left and right outline pieces, `r` the foot radius and `R` the top corner radius. */
function pathsFor(H: number, r: number, R: number) {
  const W = r + R + 1;
  const cy = H - r - 1;
  const foot = r + 0.5;
  return {
    leftFill: `M0 ${H}V${H - 0.5}A${foot} ${foot} 0 0 0 ${foot} ${cy}V${R + 0.5}A${R} ${R} 0 0 1 ${r + R + 0.5} 0.5H${W}V${H}Z`,
    leftKey: `M0 ${H - 0.5}A${foot} ${foot} 0 0 0 ${foot} ${cy}V${R + 0.5}A${R} ${R} 0 0 1 ${r + R + 0.5} 0.5H${W}`,
    rightFill: `M${W} ${H}V${H - 0.5}A${foot} ${foot} 0 0 1 ${W - foot} ${cy}V${R + 0.5}A${R} ${R} 0 0 0 ${W - r - R - 0.5} 0.5H0V${H}Z`,
    rightKey: `M${W} ${H - 0.5}A${foot} ${foot} 0 0 1 ${W - foot} ${cy}V${R + 0.5}A${R} ${R} 0 0 0 ${W - r - R - 0.5} 0.5H0`,
  };
}

function Favicon({ kind }: { kind: Fav }) {
  if (kind === "mark") {
    return (
      <svg className="tb-fav tb-fav-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M19 37C41 37 50 33 50 25.5C50 17 41 13 30 13L24.5 13C20.5 13 19 15 19 18.5L19 53C19 57 22 59 27 59L60 59" />
      </svg>
    );
  }
  return <span className={`tb-fav tb-f-${kind}`} aria-hidden="true" />;
}

function Cross() {
  return (
    <svg className="tb-x-glyph" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <path d="M1 1L7 7M7 1L1 7" />
    </svg>
  );
}

type Geo = {
  ok: boolean;
  small: boolean;
  list: number[];
  H: number;
  r: number;
  R: number;
  E: number;
  X: number;
  gap: number;
  wmax: number;
  titleX: number;
  /** Width left for the tabs (and the + button) in the row. */
  avail: number;
  plusW: number;
  baseW: number;
  activeMin: number;
  titleW: number[];
  /** The tuck: offset from the Prepline tab's resting box to the nav wordmark. */
  tuckX: number;
  tuckY: number;
};

type Els = {
  tab: HTMLElement;
  clip: HTMLElement;
  inner: HTMLElement;
  cap: HTMLElement;
  fade: HTMLElement;
  x: HTMLElement;
  xs: HTMLElement;
  press: HTMLElement;
  spark: HTMLElement;
  dust: HTMLElement[];
};

export function HeroTabs() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || story.reduced()) return;
    const row = root.querySelector<HTMLElement>(".tb-row")!;
    const base = root.querySelector<HTMLElement>(".tb-base")!;
    const plus = root.querySelector<HTMLElement>(".tb-plus")!;
    const count = root.querySelector<HTMLElement>(".tb-count")!;
    const odo = root.querySelector<HTMLElement>(".tb-odo")!;
    const els: Els[] = Array.from(root.querySelectorAll<HTMLElement>(".tb-tab")).map((tab) => ({
      tab,
      clip: tab.querySelector<HTMLElement>(".tb-clip")!,
      inner: tab.querySelector<HTMLElement>(".tb-inner")!,
      cap: tab.querySelector<HTMLElement>(".tb-cap")!,
      fade: tab.querySelector<HTMLElement>(".tb-cut")!,
      x: tab.querySelector<HTMLElement>(".tb-x")!,
      xs: tab.querySelector<HTMLElement>(".tb-xs")!,
      press: tab.querySelector<HTMLElement>(".tb-press")!,
      spark: tab.querySelector<HTMLElement>(".tb-spark")!,
      dust: Array.from(tab.querySelectorAll<HTMLElement>(".tb-dust")),
    }));

    const g: Geo = { ok: false, small: false, list: [], H: 30, r: 6, R: 8, E: 14, X: 20, gap: 8, wmax: 232, titleX: 30, avail: 0, plusW: 0, baseW: 0, activeMin: 0, titleW: [], tuckX: 0, tuckY: 0 };

    /* ── cached writes: a value lands only when its string changes ── */
    const last = new Map<HTMLElement, Record<string, string>>();
    const put = (el: HTMLElement, prop: "transform" | "opacity" | "visibility", v: string) => {
      let rec = last.get(el);
      if (!rec) last.set(el, (rec = {}));
      if (rec[prop] === v) return;
      rec[prop] = v;
      el.style[prop] = v;
    };

    /* ── read phase: only here, never in the subscriber ── */
    const measure = () => {
      const cs = getComputedStyle(root);
      const n = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
      g.small = window.matchMedia("(max-width: 767px)").matches;
      g.list = els.map((_, i) => i).filter((i) => !g.small || TABS[i].phone);
      g.H = n("--tb-h");
      g.r = n("--tb-foot");
      g.R = n("--tb-corner");
      g.E = n("--tb-ell");
      g.X = n("--tb-xzone");
      g.gap = n("--tb-gap");
      g.wmax = n("--tb-wmax");
      g.titleX = n("--tb-title-x");
      g.plusW = plus.offsetWidth;
      g.baseW = base.offsetWidth;
      const rowW = row.clientWidth;
      g.avail = rowW - count.offsetWidth - n("--tb-count-gap") - g.plusW - g.r;
      g.titleW = els.map((e) => {
        const t = e.tab.querySelector<HTMLElement>(g.small ? ".tb-t-short" : ".tb-t-long");
        return t ? t.offsetWidth : 0;
      });
      // The active tab never drops below "Prepline" (the word) and its ×.
      const word0 = els[0].tab.querySelector<HTMLElement>(".tb-t-word");
      g.activeMin = g.titleX + (word0 ? word0.offsetWidth : 0) + (g.small ? 0 : g.E) + g.X + g.R + 2;
      // The tuck target: the nav wordmark (the nav is fixed and the hero is pinned, so this holds).
      const word = document.querySelector<HTMLElement>(".nav-base .nav-word");
      const rr = row.getBoundingClientRect();
      if (word) {
        const wr = word.getBoundingClientRect();
        const tabTitleLeft = rr.left + g.r + g.titleX;
        g.tuckX = wr.left - tabTitleLeft;
        g.tuckY = wr.top + wr.height / 2 - (rr.bottom - g.H / 2);
      }
      // The tab outlines (rounded tops, flared feet, 1px keylines on half pixels). Written here only.
      els.forEach((e) => {
        // The active tab is one pixel taller: it stands on the page edge.
        const d = pathsFor(e.tab.hasAttribute("data-active") ? g.H + 1 : g.H, g.r, g.R);
        const [lf, lk] = Array.from(e.tab.querySelectorAll<SVGPathElement>(".tb-l path"));
        const [rf, rk] = Array.from(e.tab.querySelectorAll<SVGPathElement>(".tb-r path"));
        lf.setAttribute("d", d.leftFill);
        lk.setAttribute("d", d.leftKey);
        rf.setAttribute("d", d.rightFill);
        rk.setAttribute("d", d.rightKey);
      });
      g.ok = rowW > 0;
      last.clear();
      els.forEach((e, i) => e.tab.toggleAttribute("data-off", !g.list.includes(i)));
      story.invalidate();
    };

    /**
     * Widths when `n` tabs (fractional while one closes) share the row: the active tab keeps a minimum
     * (Chrome's active tab never drops below its title), the others split the rest; both stop at wmax.
     */
    const widths = (n: number) => {
      const room = g.avail - n * g.gap;
      const even = Math.min(g.wmax, room / Math.max(1, n));
      if (even >= g.activeMin || n <= 1) return { active: Math.min(g.wmax, Math.max(even, n <= 1 ? g.wmax : even)), other: even };
      return { active: g.activeMin, other: Math.max(0, Math.min(g.wmax, (room - g.activeMin) / (n - 1))) };
    };

    let finished = false;

    const render = (h: number) => {
      if (!g.ok) return;
      const list = g.list;
      const N = list.length;
      // Slot clock: the k-th tab from the right (j = 0 first) closes over slots [j, j + SLOT_LEN].
      const u = span(h, CLOSE[0], CLOSE[1]) * (N - 2 + SLOT_LEN);
      const f: number[] = new Array(N).fill(0);
      const cv: number[] = new Array(N).fill(0);
      let nEff = 1;
      let nCount = 1;
      for (let k = 1; k < N; k++) {
        const j = N - 1 - k;
        f[k] = span(u, j, j + SLOT_LEN);
        const c = span(f[k], 0.26, 1);
        cv[k] = easeInOut(c);
        // A closing tab gives its share back as it narrows; near the end the neighbours take a
        // little more than its share and hand it back (the soft settle).
        nEff += 1 - cv[k] - 0.07 * bell(span(c, 0.62, 1));
        nCount += 1 - smooth(span(c, 0.3, 0.75));
      }
      const W = widths(Math.max(1, nEff));
      const tuck = easeInOut(span(h, TUCK[0], TUCK[1]));

      let x = 0;
      for (let k = 0; k < N; k++) {
        const i = list[k];
        const e = els[i];
        const fk = f[k];
        const c = cv[k];
        const wk = Math.max(0, (k === 0 ? W.active : W.other) * (1 - c));
        // The clip: natural width wmax (+ the left foot), scaled to end where the right corner starts
        // (the cap draws the corner), never to zero (the inner takes the inverse).
        const s = Math.max(0.02, (wk - g.R + g.r + 0.5) / (g.wmax + g.r));
        put(e.clip, "transform", `scaleX(${s.toFixed(4)})`);
        put(e.inner, "transform", `scaleX(${(1 / s).toFixed(4)})`);
        // The cap rides the right edge: its side line sits on wk.
        put(e.cap, "transform", `translate3d(${(wk - g.E - g.X - g.R).toFixed(2)}px,0,0)`);
        // The press: × dips and a pressed disc shows, then the tab goes. On a phone an inactive tab
        // shows no × until it is pressed (Chrome hides it on narrow tabs).
        const p = bell(span(fk, 0, 0.3));
        const xv = k === 0 || !g.small ? 1 : span(fk, 0, 0.04);
        put(e.xs, "transform", p > 0 ? `scale(${(1 - 0.22 * p).toFixed(3)})` : "none");
        put(e.x, "opacity", xv.toFixed(3));
        put(e.press, "opacity", p.toFixed(3));
        // The title is cut with a fade and "…" only when it does not fit before the ×.
        // Without its × the title may run on to the corner, and the cut moves over with it.
        const room = wk - g.titleX - g.R - g.X * xv;
        const cut = g.titleW[i] > room;
        put(e.fade, "opacity", cut ? "1" : "0");
        put(e.fade, "transform", xv < 1 ? `translate3d(${(g.X * (1 - xv)).toFixed(2)}px,0,0)` : "none");
        if (k === 0) {
          const tx = x + g.tuckX * tuck;
          const ty = g.tuckY * tuck;
          put(e.tab, "transform", `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${(1 - 0.32 * tuck).toFixed(4)})`);
          put(e.tab, "opacity", (1 - span(tuck, 0.4, 1)).toFixed(3));
        } else {
          put(e.tab, "transform", `translate3d(${x.toFixed(2)}px,0,0)`);
          put(e.tab, "opacity", (1 - span(c, 0.62, 1)).toFixed(3));
        }
        // The firefly and the dust puff, from the × as the tab goes.
        const sp = span(fk, 0.3, 1);
        if (k > 0 && sp > 0 && sp < 1) {
          const ox = wk - g.R - g.X / 2;
          const a = bell(sp);
          put(e.spark, "transform", `translate3d(${(ox + sp * 16 + Math.sin(sp * 7 + k) * 3).toFixed(2)}px,${(-sp * 34).toFixed(2)}px,0) scale(${(0.6 + a * 0.6).toFixed(3)})`);
          put(e.spark, "opacity", a.toFixed(3));
          e.dust.forEach((d, n) => {
            const ang = -Math.PI * (0.18 + n * 0.32) + (k % 2 ? 0.2 : -0.1);
            const dist = 4 + smooth(span(sp, 0, 0.7)) * (10 + n * 3);
            put(d, "transform", `translate3d(${(ox - 6 + Math.cos(ang) * dist).toFixed(2)}px,${(Math.sin(ang) * dist).toFixed(2)}px,0)`);
            put(d, "opacity", (bell(span(sp, 0, 0.75)) * 0.8).toFixed(3));
          });
        } else if (k > 0) {
          put(e.spark, "opacity", "0");
          e.dust.forEach((d) => put(d, "opacity", "0"));
        }
        x += wk + g.gap * (1 - c);
      }
      // The + follows the last open tab (Chrome's new-tab button); the page edge runs under the row.
      const end = x - g.gap + 6;
      const tail = 1 - span(tuck, 0, 0.6);
      put(plus, "transform", `translate3d(${end.toFixed(2)}px,0,0)`);
      put(plus, "opacity", tail.toFixed(3));
      put(base, "transform", `scaleX(${Math.min(1, (end + g.plusW + g.r) / Math.max(1, g.baseW)).toFixed(4)})`);
      put(base, "opacity", tail.toFixed(3));
      // The count rolls down, one figure per closed tab.
      put(odo, "transform", `translate3d(0,${((-(TABS.length - nCount) * 100) / TABS.length).toFixed(3)}%,0)`);
      put(count, "opacity", tail.toFixed(3));
    };

    const off = story.subscribe((s) => {
      const i = BEATS.findIndex((b) => b.id === s.beat);
      const h = i < HERO_INDEX ? 0 : i > HERO_INDEX ? 1 : s.beatProgress;
      if (h > 0) settlePop();
      const done = h >= END;
      // Past the end: write the hidden state once, then nothing per frame.
      if (done && finished) return;
      if (done) {
        render(1);
        put(root, "visibility", "hidden");
        finished = true;
        return;
      }
      if (finished) {
        finished = false;
        put(root, "visibility", "visible");
      }
      render(h);
    });

    /* ── load: pop in, 40ms apart, after the hero intro ── */
    const pops = () => g.list.map((i) => els[i].tab.querySelector<HTMLElement>(".tb-pop")!);
    let tl: gsap.core.Timeline | null = null;
    const startPop = () => {
      root.setAttribute("data-loaded", "");
      tl = gsap.timeline({ delay: 1.3 });
      tl.fromTo(pops(), { opacity: 0, y: 7, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: ease.springSoft, stagger: 0.04 }, 0)
        .fromTo([root.querySelector(".tb-plus-pop"), root.querySelector(".tb-count-pop")], { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.4, ease: ease.outSoft, stagger: 0.04 }, g.list.length * 0.04)
        .fromTo(root.querySelector(".tb-base-pop"), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: ease.outSoft }, 0);
    };
    const settlePop = () => {
      if (tl && tl.progress() < 1) tl.progress(1);
    };

    let ro: ResizeObserver | null = null;
    let alive = true;
    measure();
    startPop();
    document.fonts?.ready.then(() => alive && measure());
    ro = new ResizeObserver(() => measure());
    ro.observe(row);

    return () => {
      alive = false;
      off();
      ro?.disconnect();
      tl?.kill();
    };
  }, []);

  return (
    <div ref={rootRef} className="tb only-motion" aria-hidden="true">
      <div className="tb-row">
        <span className="tb-base-pop">
          <span className="tb-base" />
        </span>
        {TABS.map((t, i) => (
          <div key={t.title} className="tb-tab" data-active={i === 0 ? "" : undefined} data-phone={t.phone ? "" : undefined} data-paper={i === 0 ? "" : undefined} style={{ zIndex: i === 0 ? 40 : TABS.length - i }}>
            <div className="tb-pop">
              <div className="tb-clip">
                <div className="tb-inner">
                  <svg className="tb-l" aria-hidden="true" focusable="false">
                    <path className="tb-fill" />
                    <path className="tb-key" />
                  </svg>
                  <span className="tb-mid" />
                  <Favicon kind={t.fav} />
                  <span className="tb-title">
                    <span className="tb-t-long">{t.title}</span>
                    <span className="tb-t-short">{t.short ?? t.title}</span>
                    {i === 0 ? <span className="tb-t-word">Prepline</span> : null}
                  </span>
                </div>
              </div>
              <div className="tb-cap">
                <span className="tb-cut">
                  <span className="tb-fade" />
                  <span className="tb-ell">…</span>
                </span>
                <span className="tb-x">
                  <span className="tb-xs">
                    <span className="tb-press" />
                    <Cross />
                  </span>
                </span>
                <svg className="tb-r" aria-hidden="true" focusable="false">
                  <path className="tb-fill" />
                  <path className="tb-key" />
                </svg>
              </div>
            </div>
            <span className="tb-spark" />
            <span className="tb-dust" />
            <span className="tb-dust" />
            <span className="tb-dust" />
          </div>
        ))}
        <span className="tb-plus">
          <span className="tb-plus-pop">
            <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
              <path d="M5 1V9M1 5H9" />
            </svg>
          </span>
        </span>
        <span className="tb-count">
          <span className="tb-count-pop">
            <span className="tb-odo-win">
              <span className="tb-odo">
                {COUNTS.map((n) => (
                  <span key={n}>{n === 1 ? "1 tab" : `${n} tabs`}</span>
                ))}
              </span>
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
