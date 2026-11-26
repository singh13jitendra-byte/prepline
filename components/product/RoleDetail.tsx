"use client";

import { useId, useState } from "react";
import { Icon } from "./icons";
import { Button, Illustrative, LinkButton, ScoreRule, SourceChip, cx, type SurfaceProps } from "./primitives";
import { kestrelDetail, type ReasonRow, type RoleDetailData } from "./data";

export type RoleDetailProps = SurfaceProps & {
  data?: RoleDetailData;
  /**
   * "compact" is the story's card (520 × 320): no buttons, the privacy line in
   * their place. "full" adds Save, Mark applied and Open JD.
   */
  variant?: "full" | "compact";
  /** Controlled saved / applied. Leave undefined for internal state. */
  saved?: boolean;
  applied?: boolean;
  onSavedChange?: (v: boolean) => void;
  onAppliedChange?: (v: boolean) => void;
  /** 0..1: fills the rule and counts the numeral for a scripted showcase. */
  scoreProgress?: number;
  /** How many reason rows are resolved (for a scripted reveal). Defaults to all. */
  rowsShown?: number;
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const minus = "−";
const points = (r: ReasonRow) => (r.points === null ? minus : r.points < 0 ? `${minus}${fmt(-r.points)}` : fmt(r.points));

/**
 * One role, expanded. The score shows its working as rows: points, sentence,
 * source. Watch-outs carry their minus (or a bare minus when unscored).
 * "Mark applied" records what the user sent themselves: Prepline never applies.
 */
export function RoleDetail({
  data = kestrelDetail,
  variant = "full",
  saved,
  applied,
  onSavedChange,
  onAppliedChange,
  scoreProgress = 1,
  rowsShown,
  skin = "auto",
  bare,
  illustrative = true,
  className,
  style,
}: RoleDetailProps) {
  const hid = useId();
  const { role, why, watchOuts, jdHref } = data;
  const [innerSaved, setInnerSaved] = useState(false);
  const [innerApplied, setInnerApplied] = useState(false);
  const isSaved = saved ?? innerSaved;
  const isApplied = applied ?? innerApplied;
  const limit = rowsShown ?? why.length + watchOuts.length;

  return (
    <article
      className={cx("pp pp-role", className)}
      data-skin={skin}
      data-variant={variant}
      data-bare={bare ? "" : undefined}
      aria-labelledby={hid}
      style={style}
    >
      <header className="pp-role-h">
        <div className="pp-role-id">
          <div className="pp-role-t">
            <h2 id={hid} className="pp-title" title={role.title}>
              {role.title}
            </h2>
            <Illustrative show={illustrative} />
          </div>
          <p className="pp-meta">
            {role.company}
            <span className="pp-sep">·</span>
            {role.city}
            <span className="pp-sep">·</span>
            {role.mode}
            <span className="pp-sep">·</span>
            <span className="pp-num">Found {role.found} ago</span>
          </p>
        </div>
        <ScoreRule score={role.score} size="lg" progress={scoreProgress} suffix className="pp-role-rule" />
      </header>

      <div className="pp-claims" data-lenis-prevent="">
        <Rows id={`${hid}-why`} title="Why it fits" rows={why} shown={limit} />
        {watchOuts.length ? (
          <Rows id={`${hid}-watch`} title="Watch-outs" rows={watchOuts} shown={limit - why.length} watch />
        ) : null}
      </div>

      {variant === "full" ? (
        <footer className="pp-role-f">
          <Button
            size="sm"
            icon={isSaved ? "bookmark-filled" : "bookmark"}
            kbd="S"
            aria-pressed={isSaved}
            onClick={() => {
              if (saved === undefined) setInnerSaved(!isSaved);
              onSavedChange?.(!isSaved);
            }}
          >
            {isSaved ? "Saved" : "Save"}
          </Button>
          <Button
            size="sm"
            icon={isApplied ? "check" : "send"}
            kbd="A"
            aria-pressed={isApplied}
            onClick={() => {
              if (applied === undefined) setInnerApplied(!isApplied);
              onAppliedChange?.(!isApplied);
            }}
          >
            {isApplied ? "Applied by you" : "Mark applied"}
          </Button>
          <LinkButton size="sm" variant="ghost" icon="external" href={jdHref ?? "#"} target="_blank" rel="noreferrer">
            Open JD<span className="pp-sr"> (opens in a new tab)</span>
          </LinkButton>
          <p className="pp-quiet">
            <Icon name="lock" size={14} />
            Prepline never applies for you.
          </p>
        </footer>
      ) : (
        <footer className="pp-role-f" data-compact="">
          <p className="pp-quiet">
            <Icon name="lock" size={14} />
            {data.privacy}
          </p>
        </footer>
      )}
    </article>
  );
}

function Rows({ id, title, rows, shown, watch }: { id: string; title: string; rows: ReasonRow[]; shown: number; watch?: boolean }) {
  return (
    <section className="pp-reasons" data-kind={watch ? "watch" : "why"} aria-labelledby={id}>
      <h3 id={id} className="pp-h3">
        {title}
      </h3>
      <ul>
        {rows.map((r, i) => (
          <li key={r.label + r.text} className="pp-reason" data-hidden={i >= shown ? "" : undefined}>
            <span className="pp-reason-pts pp-num" data-neg={r.points === null || r.points < 0 ? "" : undefined}>
              <span className="pp-sr">{r.label}: </span>
              {points(r)}
              {r.max ? <small>/{r.max}</small> : null}
              {r.points === null ? <span className="pp-sr"> not scored</span> : null}
            </span>
            <span className="pp-reason-body">
              <span className="pp-reason-t">{r.text}</span>
              <span className="pp-reason-src">
                <span className="pp-reason-l">{r.label}</span>
                <span aria-hidden="true">·</span>
                <SourceChip {...r.cite} size="sm" plain />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
