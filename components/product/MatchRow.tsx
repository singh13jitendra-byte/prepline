import { ScoreRule, cx, type SurfaceProps } from "./primitives";
import { roles, type Role } from "./data";

/**
 * One ranked role on a single line, for the story's `row` face (440 × 44):
 * rank, title, company · city, the 0 to 10 rule and its numeral. No reason,
 * no avatar, no chips. Bare by default (the face draws any keyline).
 */
export function MatchRow({
  role = roles[0],
  selected = false,
  framed = false,
  skin = "auto",
  className,
  style,
}: Omit<SurfaceProps, "bare" | "illustrative"> & { role?: Role; selected?: boolean; framed?: boolean }) {
  return (
    <div
      className={cx("pp pp-matchrow", className)}
      data-skin={skin}
      data-bare={framed ? undefined : ""}
      data-selected={selected ? "" : undefined}
      role="group"
      aria-label={`Rank ${role.rank}: ${role.title}, ${role.company}, ${role.city}. ${role.score} out of 10 fit.`}
      style={style}
    >
      <span className="pp-mrow-rank pp-num" aria-hidden="true">
        {String(role.rank).padStart(2, "0")}
      </span>
      <span className="pp-matchrow-id pp-trunc" aria-hidden="true">
        <b>{role.title}</b> {role.company}
        <span className="pp-matchrow-city"> · {role.city}</span>
      </span>
      <ScoreRule score={role.score} size="sm" />
    </div>
  );
}
