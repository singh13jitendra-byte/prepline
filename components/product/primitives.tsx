/**
 * Product primitives. Few on purpose: ScoreBadge, ScoreRing, SourceChip,
 * StatusPill, Avatar, KeyValue, Toolbar, Kbd, Button.
 * All styling lives in product.css and reads theme tokens only.
 */

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import type { Citation, SourceKind } from "./data";

/** Props every product screen shares. */
export type SurfaceProps = {
  /**
   * "auto" follows the theme's roles and any chapter scope. "night" forces the
   * night roles. "day" keeps a paper object paper inside a night chapter (the
   * theme's [data-skin="day"] scope restores the day values locally).
   */
  skin?: "auto" | "night" | "day";
  /** Drop the frame (border, radius, shadow) when the host draws its own. */
  bare?: boolean;
  /** Show the small "Illustrative" tag. Turn off where the stage already captions it. */
  illustrative?: boolean;
  className?: string;
  style?: CSSProperties;
};

export type Tier = "hi" | "mid" | "lo";

/** 8 and up reads as a strong fit, 7 as good, 6 and below as fair. */
export function scoreTier(score: number): Tier {
  return score >= 8 ? "hi" : score >= 7 ? "mid" : "lo";
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/* ── ScoreBadge ── */

export function ScoreBadge({
  score,
  size = "md",
  suffix = true,
  className,
}: {
  score: number;
  size?: "sm" | "md";
  /** Show the small "/10". */
  suffix?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx("pp-score", className)}
      data-tier={scoreTier(score)}
      data-size={size}
      aria-label={`Fit ${fmt(score)} out of 10`}
      role="img"
    >
      <span aria-hidden="true">{fmt(score)}</span>
      {suffix ? <small aria-hidden="true">/10</small> : null}
    </span>
  );
}

/* ── ScoreRule: the one score component (0 to 10 rule + numeral) ── */

/**
 * A 0 to 10 rule: a track with ten ticks, filled to the score in --c-match,
 * and the numeral beside it in the display face. Used in every row, card and
 * sheet header.
 *
 * `progress` (0..1) scales the fill and numeral for a scripted count-up. The
 * fill element carries `data-pp-score-fill`, so a story can anchor the Line to
 * it, and its width is the CSS variable --pp-score-p (0..1) if you would rather
 * drive it without a React render.
 */
export function ScoreRule({
  score,
  size = "md",
  progress = 1,
  suffix = false,
  className,
}: {
  score: number;
  /** sm: 56px rule, 18px numeral (rows). md: 96px, 22px. lg: fills its box, 40px numeral. */
  size?: "sm" | "md" | "lg";
  progress?: number;
  /** Show "/10 fit" after the numeral. */
  suffix?: boolean;
  className?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const shown = Math.round(score * p * 2) / 2;
  return (
    <span
      className={cx("pp-rule", className)}
      data-size={size}
      data-tier={scoreTier(score)}
      role="img"
      aria-label={`${fmt(score)} out of 10 fit`}
      style={{ ["--pp-score-p" as string]: String((score / 10) * p) }}
    >
      <span className="pp-rule-track" aria-hidden="true">
        <span className="pp-rule-fill" data-pp-score-fill="" />
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} style={{ left: `${(i + 1) * 10}%` }} />
        ))}
      </span>
      <span className="pp-rule-n" aria-hidden="true">
        {fmt(shown)}
        {suffix ? <small>/10 fit</small> : null}
      </span>
    </span>
  );
}

/* ── ScoreRing ── */

export function ScoreRing({
  score,
  size = "md",
  /** 0..1, for a counting-up animation driven from outside. Defaults to the score. */
  progress,
  label,
  className,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  progress?: number;
  label?: string;
  className?: string;
}) {
  const r = 15.25;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress ?? score / 10));
  return (
    <span
      className={cx("pp-ring", className)}
      data-size={size}
      data-tier={scoreTier(score)}
      role="img"
      aria-label={label ?? `Fit ${fmt(score)} out of 10`}
    >
      <svg viewBox="0 0 34 34" aria-hidden="true">
        <circle className="pp-ring-track" cx="17" cy="17" r={r} fill="none" strokeWidth="2.5" />
        <circle
          className="pp-ring-fill"
          cx="17"
          cy="17"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(3)}
          style={{ strokeDashoffset: (c * (1 - p)).toFixed(3) }}
        />
      </svg>
      <span className="pp-ring-n" aria-hidden="true">
        {fmt(score)}
        {size !== "sm" ? <small>/10</small> : null}
      </span>
    </span>
  );
}

/* ── SourceChip ── */

const sourceIcon: Record<SourceKind, IconName> = {
  jd: "doc",
  case: "folder",
  history: "people",
  profile: "person",
  general: "compass",
};

/**
 * Where a question or reason comes from. `label` is the short source
 * ("From the JD"), `detail` the quoted or named part ("own the design system").
 */
export function SourceChip({
  kind,
  label,
  detail,
  size = "md",
  plain = false,
  className,
}: Citation & { size?: "sm" | "md"; /** Text only, no box (inside reason rows). */ plain?: boolean; className?: string }) {
  const quoted = kind === "jd" && detail ? `“${detail}”` : detail;
  return (
    <span
      className={cx("pp-src", className)}
      data-kind={kind}
      data-size={size}
      data-plain={plain ? "" : undefined}
      title={detail ? `${label}: ${detail}` : label}
    >
      {plain ? null : <Icon name={sourceIcon[kind]} size={size === "sm" ? 12 : 14} />}
      <span className="pp-src-l">{label}</span>
      {quoted ? (
        <span className="pp-src-d">
          <span className="pp-sr">: </span>
          {kind === "history" ? `· ${quoted}` : quoted}
        </span>
      ) : null}
    </span>
  );
}

/* ── StatusPill ── */

export function StatusPill({
  tone = "neutral",
  dot = true,
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "success" | "quiet";
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("pp-pill", className)} data-tone={tone}>
      {dot ? <span className="pp-pill-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ── Avatar (company initials) ── */

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return String((Math.abs(h) % 4) + 1);
}

export function Avatar({
  initials,
  name,
  size = "md",
  className,
}: {
  initials: string;
  /** Used for a stable tint and as the accessible name when not decorative. */
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cx("pp-avatar", className)} data-size={size} data-tone={toneFor(name ?? initials)} aria-hidden="true">
      {initials}
    </span>
  );
}

/* ── KeyValue ── */

export function KeyValue({
  items,
  layout = "inline",
  className,
}: {
  items: { k: ReactNode; v: ReactNode }[];
  layout?: "inline" | "rows";
  className?: string;
}) {
  return (
    <dl className={cx("pp-kv", className)} data-layout={layout}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Toolbar ── */

export function Toolbar({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("pp-toolbar", className)} role={label ? "group" : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/* ── Kbd ── */

export function Kbd({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <kbd className="pp-kbd" aria-label={label}>
      {children}
    </kbd>
  );
}

/* ── Button ── */

type BtnBase = { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md"; icon?: IconName; kbd?: string };

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  kbd,
  children,
  className,
  type = "button",
  ...rest
}: BtnBase & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx("pp-btn", className)} data-variant={variant} data-size={size} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {kbd ? <kbd className="pp-kbd" aria-hidden="true">{kbd}</kbd> : null}
    </button>
  );
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  icon,
  kbd,
  children,
  className,
  ...rest
}: BtnBase & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cx("pp-btn", className)} data-variant={variant} data-size={size} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {kbd ? <kbd className="pp-kbd" aria-hidden="true">{kbd}</kbd> : null}
    </a>
  );
}

/* ── the "Illustrative" tag ── */

export function Illustrative({ show = true }: { show?: boolean }) {
  return show ? <span className="pp-illus">Illustrative</span> : null;
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
