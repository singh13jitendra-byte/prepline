"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Button, Illustrative, Kbd, ScoreRule, cx, type SurfaceProps } from "./primitives";
import {
  cutCount as defaultCutCount,
  cutRoles as defaultCut,
  funnel as defaultFunnel,
  roles as defaultRoles,
  week as defaultWeek,
  type CutRole,
  type Level,
  type Role,
  type WorkMode,
} from "./data";

export type MatchFilters = { level: Level | "Any"; city: string; mode: WorkMode | "Any" };

export type MatchesListProps = SurfaceProps & {
  roles?: Role[];
  funnel?: { read: number; level: number; fit: number };
  week?: { label: string; readAt: string };
  /** "first-day": nothing read yet. "empty": read, nothing fit. */
  state?: "ready" | "loading" | "empty" | "first-day";
  /** Controlled selection. Leave undefined for internal state. */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (role: Role) => void;
  /** Paint a row as hovered (for a scripted showcase). */
  hoveredId?: string | null;
  filters?: MatchFilters;
  defaultFilters?: Partial<MatchFilters>;
  onFiltersChange?: (f: MatchFilters) => void;
  /** Saved role ids (controlled) and the S key / Save action. */
  savedIds?: string[];
  defaultSavedIds?: string[];
  onSave?: (role: Role, saved: boolean) => void;
  /** "Not for me" (X key). Hidden rows collapse to an Undo line. */
  onHide?: (role: Role) => void;
  /** The cut rows with their reasons, under the kept ones. */
  cut?: CutRole[] | false;
  cutCount?: number;
  /** Show the keyboard hints in the footer. */
  hints?: boolean;
};

const nf = new Intl.NumberFormat("en-IN");
const ANY = "Any";
const where = (r: { city: string; mode?: string }) =>
  r.city === "Remote" ? "Remote, India" : r.mode ? `${r.city} · ${r.mode.toLowerCase()}` : r.city;

/**
 * This week's matches, best fit first: a dense, keyboard-first ranked table.
 * Each row: rank, role and company, a one-line reason, where, and the score
 * as a 10-part bar with its numeral. Under the kept roles, a sample of the cut
 * ones with the reason each was cut.
 *
 * Keys (while a row has focus): ↑ ↓ or J K move, Enter opens, S saves, X hides.
 */
export function MatchesList({
  roles = defaultRoles,
  funnel = defaultFunnel,
  week = defaultWeek,
  state = "ready",
  selectedId,
  defaultSelectedId = null,
  onSelect,
  hoveredId,
  filters,
  defaultFilters,
  onFiltersChange,
  savedIds,
  defaultSavedIds = [],
  onSave,
  onHide,
  cut = defaultCut,
  cutCount = defaultCutCount,
  hints = true,
  skin = "auto",
  bare,
  illustrative = true,
  className,
  style,
}: MatchesListProps) {
  const hid = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const [innerSel, setInnerSel] = useState<string | null>(defaultSelectedId);
  const sel = selectedId !== undefined ? selectedId : innerSel;
  const [innerF, setInnerF] = useState<MatchFilters>({ level: ANY, city: ANY, mode: ANY, ...defaultFilters });
  const f = filters ?? innerF;
  const [innerSaved, setInnerSaved] = useState<string[]>(defaultSavedIds);
  const saved = savedIds ?? innerSaved;
  const [hidden, setHidden] = useState<string[]>([]);
  const [said, setSaid] = useState("");

  const setF = (patch: Partial<MatchFilters>) => {
    const next = { ...f, ...patch };
    if (!filters) setInnerF(next);
    onFiltersChange?.(next);
  };

  const cities = useMemo(() => [...new Set(roles.map((r) => r.city).filter((c) => c !== "Remote"))].sort(), [roles]);
  const shown = useMemo(
    () =>
      roles.filter(
        (r) =>
          (f.level === ANY || r.level === f.level) &&
          (f.city === ANY || r.city === f.city) &&
          (f.mode === ANY || r.mode === f.mode),
      ),
    [roles, f],
  );
  const filtered = f.level !== ANY || f.city !== ANY || f.mode !== ANY;
  const noData = state === "empty" || state === "first-day";
  const isEmpty = noData || (state === "ready" && shown.length === 0);

  const select = (r: Role) => {
    if (selectedId === undefined) setInnerSel(r.id);
    onSelect?.(r);
  };
  const toggleSave = (r: Role) => {
    const on = !saved.includes(r.id);
    if (!savedIds) setInnerSaved(on ? [...saved, r.id] : saved.filter((id) => id !== r.id));
    setSaid(on ? `Saved ${r.title} at ${r.company} to your board.` : `Removed ${r.title} from your board.`);
    onSave?.(r, on);
  };
  const hide = (r: Role) => {
    setHidden((h) => [...h, r.id]);
    setSaid(`Hidden ${r.title} at ${r.company}. Future scores will lean away from roles like this.`);
    onHide?.(r);
  };

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-row]") ?? []);
  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const all = rows();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const key = e.key.toLowerCase();
    if (["arrowdown", "arrowup", "home", "end", "j", "k"].includes(key)) {
      e.preventDefault();
      let next = at;
      if (key === "arrowdown" || key === "j") next = Math.min(all.length - 1, at + 1);
      if (key === "arrowup" || key === "k") next = Math.max(0, at - 1);
      if (key === "home") next = 0;
      if (key === "end") next = all.length - 1;
      all[next]?.focus();
      return;
    }
    if (at < 0) return;
    const r = shown.find((x) => x.id === all[at].dataset.row);
    if (!r) return;
    if (key === "s") {
      e.preventDefault();
      toggleSave(r);
    } else if (key === "x") {
      e.preventDefault();
      hide(r);
      requestAnimationFrame(() => rows()[Math.min(at, rows().length - 1)]?.focus());
    }
  };

  return (
    <section
      className={cx("pp pp-matches", className)}
      data-skin={skin}
      data-bare={bare ? "" : undefined}
      aria-labelledby={hid}
      aria-busy={state === "loading" || undefined}
      style={style}
    >
      <header className="pp-mh">
        <div className="pp-mh-top">
          <h2 id={hid} className="pp-title">
            Matches
          </h2>
          <span className="pp-meta pp-mh-week">{week.label}</span>
          <span className="pp-spacer" />
          <Illustrative show={illustrative} />
        </div>

        {state === "loading" ? (
          <p className="pp-funnel" role="status">
            Reading careers pages. Your matches land by morning.
          </p>
        ) : state === "first-day" ? (
          <p className="pp-funnel">Nothing read yet.</p>
        ) : (
          <p className="pp-funnel">
            <b>{nf.format(funnel.read)}</b>read
            <span className="pp-sep">·</span>
            <b>{nf.format(funnel.level)}</b>matched level
            <span className="pp-sep">·</span>
            <b data-fit="">{nf.format(state === "empty" ? 0 : funnel.fit)}</b>fit
            <span className="pp-funnel-fresh">{week.readAt}</span>
          </p>
        )}

        <div className="pp-filters" role="group" aria-label="Filters">
          <label className="pp-chip" data-active={f.level !== ANY ? "" : undefined}>
            Level <b>{f.level}</b>
            <Icon name="chevron-down" size={14} />
            <select value={f.level} onChange={(e) => setF({ level: e.target.value as MatchFilters["level"] })} aria-label="Level">
              <option value={ANY}>Any level</option>
              <option value="Senior">Senior</option>
              <option value="Mid">Mid</option>
            </select>
          </label>
          <label className="pp-chip" data-active={f.city !== ANY ? "" : undefined}>
            City <b>{f.city}</b>
            <Icon name="chevron-down" size={14} />
            <select value={f.city} onChange={(e) => setF({ city: e.target.value })} aria-label="City">
              <option value={ANY}>Any city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="pp-chip" data-active={f.mode !== ANY ? "" : undefined}>
            Work mode <b>{f.mode}</b>
            <Icon name="chevron-down" size={14} />
            <select value={f.mode} onChange={(e) => setF({ mode: e.target.value as MatchFilters["mode"] })} aria-label="Work mode">
              <option value={ANY}>Any mode</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </label>
          <span className="pp-spacer" />
          <span className="pp-meta pp-sort">
            <Icon name="sort" size={14} />
            Best fit first
          </span>
        </div>
      </header>

      <div className="pp-mcols" aria-hidden="true">
        <span>Rank</span>
        <span>Role</span>
        <span className="pp-mcol-where">Where</span>
        <span className="pp-mcol-fit">Fit, 0 to 10</span>
      </div>

      {state === "loading" ? (
        <div className="pp-mlist" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="pp-mrow pp-mrow-skel" key={i}>
              <span className="pp-skel" style={{ width: 14 }} />
              <span style={{ display: "grid", gap: 8 }}>
                <span className="pp-skel" style={{ width: `${62 - ((i * 13) % 24)}%` }} />
                <span className="pp-skel" style={{ width: `${82 - ((i * 7) % 30)}%`, height: 8 }} />
              </span>
              <span className="pp-skel pp-mcol-where" style={{ width: 72 }} />
              <span className="pp-skel pp-mcol-fit" style={{ width: 80 }} />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="pp-empty">
          <span className="pp-empty-icon">
            <Icon name="search" size={20} />
          </span>
          {state === "first-day" ? (
            <>
              <h3>Your first matches arrive tomorrow morning</h3>
              <p>Prepline reads careers pages overnight.</p>
            </>
          ) : filtered && !noData ? (
            <>
              <h3>Nothing fits these filters</h3>
              <p>{roles.length} roles fit this week, none with these filters. Widen the city or level to see them.</p>
              <Button size="sm" onClick={() => setF({ level: ANY, city: ANY, mode: ANY })}>
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <h3>Nothing new fit this week</h3>
              <p>That’s the filter doing its job. {nf.format(funnel.read)} roles read, none above 6 for your portfolio.</p>
              <Button size="sm" icon="pen">
                Adjust preferences
              </Button>
            </>
          )}
        </div>
      ) : (
        <ol ref={listRef} data-lenis-prevent="" className="pp-mlist" aria-label="Ranked roles, best fit first" onKeyDown={onKeyDown}>
          {shown.map((r) => {
            if (hidden.includes(r.id)) {
              return (
                <li key={r.id} className="pp-mhidden">
                  <span className="pp-trunc">Hidden. Future scores will lean away from roles like this.</span>
                  <button type="button" className="pp-link" onClick={() => setHidden((h) => h.filter((id) => id !== r.id))}>
                    Undo
                  </button>
                </li>
              );
            }
            const on = sel === r.id;
            const isSaved = saved.includes(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="pp-mrow"
                  data-row={r.id}
                  aria-current={on ? "true" : undefined}
                  data-hover={hoveredId === r.id ? "" : undefined}
                  onClick={() => select(r)}
                  aria-keyshortcuts="S X"
                >
                  <span className="pp-mrow-rank pp-num" aria-hidden="true">
                    {String(r.rank).padStart(2, "0")}
                  </span>
                  <span className="pp-mrow-main">
                    <span className="pp-mrow-l1">
                      <span className="pp-mrow-title pp-trunc" title={r.title}>
                        {r.title}
                      </span>
                      <span className="pp-mrow-co pp-trunc">{r.company}</span>
                      {isSaved ? (
                        <span className="pp-mrow-saved">
                          <Icon name="bookmark-filled" size={14} />
                          <span className="pp-sr">Saved</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="pp-mrow-reason pp-trunc" title={r.reason}>
                      <span className="pp-mrow-mob">
                        {r.company} · {where(r)}
                        <br />
                      </span>
                      {r.reason}
                    </span>
                  </span>
                  <span className="pp-mrow-where pp-mcol-where">
                    <span className="pp-trunc">{where(r)}</span>
                    {r.isNew ? <span className="pp-new">New today</span> : <span className="pp-num">{r.found} ago</span>}
                  </span>
                  <ScoreRule score={r.score} size="sm" className="pp-mcol-fit" />
                </button>
              </li>
            );
          })}
          {cut && cut.length ? (
            <li className="pp-mcut">
              <p className="pp-mcut-h">
                <span>Cut, with reasons</span>
                <span className="pp-num">{nf.format(cutCount)}</span>
              </p>
              <ul aria-label={`A sample of the ${nf.format(cutCount)} roles cut, with reasons`}>
                {cut.map((c) => (
                  <li key={c.id} className="pp-mcut-row">
                    <span className="pp-mrow-rank" aria-hidden="true">
                      ·
                    </span>
                    <span className="pp-trunc">
                      <span className="pp-mcut-title">{c.title}</span> {c.company} · {c.city}
                    </span>
                    <span className="pp-mcut-why">{c.reason}</span>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ol>
      )}

      <footer className="pp-mfoot">
        <span className="pp-num">
          {state === "loading" ? "Reading…" : `${isEmpty ? 0 : shown.length - hidden.length} of ${roles.length} shown`}
        </span>
        <span className="pp-spacer" />
        {hints ? (
          <span className="pp-keys" aria-hidden="true">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
            <span>move</span>
            <Kbd>S</Kbd>
            <span>save</span>
            <Kbd>X</Kbd>
            <span>not for me</span>
          </span>
        ) : null}
        <span className="pp-sr" aria-live="polite">
          {said}
        </span>
      </footer>
    </section>
  );
}
