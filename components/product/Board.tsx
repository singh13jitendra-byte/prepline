"use client";

import { useId, useState } from "react";
import { Icon } from "./icons";
import { Avatar, Illustrative, StatusPill, Toolbar, cx, type SurfaceProps } from "./primitives";
import { boardItems as defaultItems, stages as defaultStages, type BoardItem, type Stage } from "./data";

export type BoardProps = SurfaceProps & {
  items?: BoardItem[];
  stages?: { id: Stage; label: string; empty: string }[];
  /** Highlight one tile (role id). */
  selectedId?: string | null;
  onOpen?: (item: BoardItem) => void;
  /** Count of applications Prepline sent. Always 0: it never applies. */
  sentByPrepline?: number;
  defaultView?: "board" | "list";
};

/**
 * The pipeline: Saved → Applied → Interview → Offer. Tiles show the date the
 * role entered its column and the next step. An interview tile carries the
 * date and time and a "Prep sheet ready" badge.
 */
export function Board({
  items = defaultItems,
  stages = defaultStages,
  selectedId,
  onOpen,
  sentByPrepline = 0,
  defaultView = "board",
  skin = "auto",
  bare,
  illustrative = true,
  className,
  style,
}: BoardProps) {
  const hid = useId();
  const [view, setView] = useState<"board" | "list">(defaultView);
  const applied = items.filter((i) => i.stage !== "saved").length;

  return (
    <section
      className={cx("pp pp-board", className)}
      data-skin={skin}
      data-bare={bare ? "" : undefined}
      aria-labelledby={hid}
      style={style}
    >
      <Toolbar className="pp-board-h">
        <h2 id={hid} className="pp-title">
          Your board
        </h2>
        <span className="pp-meta pp-num">{items.length} roles</span>
        <span className="pp-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>
            <Icon name="board" size={14} />
            Board
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
            <Icon name="list" size={14} />
            List
          </button>
        </span>
        <span className="pp-spacer" />
        <span className="pp-ledger">
          <b>{applied}</b> applied by you
          <span className="pp-sep">·</span>
          <Icon name="lock" size={14} />
          <b>{sentByPrepline}</b> sent by Prepline
        </span>
        <Illustrative show={illustrative} />
      </Toolbar>

      {view === "list" ? (
        <div data-lenis-prevent="" className="pp-table-wrap">
          <table className="pp-table">
            <caption className="pp-sr">Your board as a list</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Stage</th>
                <th scope="col">Date</th>
                <th scope="col">Next step</th>
                <th scope="col" className="pp-table-num">
                  Fit
                </th>
              </tr>
            </thead>
            <tbody>
              {stages.flatMap((s) =>
                items
                  .filter((i) => i.stage === s.id)
                  .map((it) => (
                    <tr key={it.role.id} aria-current={selectedId === it.role.id ? "true" : undefined}>
                      <th scope="row">
                        <span className="pp-table-role">
                          <Avatar initials={it.role.initials} name={it.role.company} size="xs" />
                          <span className="pp-trunc">
                            {it.role.title}
                            <span className="pp-table-co"> · {it.role.company}</span>
                          </span>
                        </span>
                      </th>
                      <td>
                        <StatusPill tone={s.id === "interview" ? "accent" : "quiet"}>{s.label}</StatusPill>
                      </td>
                      <td className="pp-num">{it.interview ? it.interview.when : it.date}</td>
                      <td className="pp-trunc">
                        {it.interview ? (it.interview.prepReady ? "Prep sheet ready" : "Writing sheet") : (it.next ?? "None yet")}
                      </td>
                      <td className="pp-table-num">
                        <span className="pp-tile-n">{it.role.score}</span>
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div data-lenis-prevent="" className="pp-cols">
          {stages.map((s) => {
            const col = items.filter((i) => i.stage === s.id);
            return (
              <section key={s.id} className="pp-col" data-stage={s.id} aria-labelledby={`${hid}-${s.id}`}>
                <div className="pp-col-h">
                  <span className="pp-col-dot" aria-hidden="true" />
                  <h3 id={`${hid}-${s.id}`}>{s.label}</h3>
                  <span className="pp-col-n" aria-label={`${col.length} roles`}>
                    {col.length}
                  </span>
                </div>
                {col.length ? (
                  <ol>
                    {col.map((it) => (
                      <li key={it.role.id}>
                        <Tile item={it} current={selectedId === it.role.id} onOpen={onOpen} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="pp-col-empty">{s.empty}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="pp-board-mobile-ledger">
        <Icon name="lock" size={14} />
        {applied} applied by you · {sentByPrepline} sent by Prepline
      </p>
    </section>
  );
}

/**
 * A role on the board: title, company, one chip, and the score numeral.
 * An interview tile adds the date and time and the prep sheet's state.
 */
export function Tile({
  item,
  current,
  onOpen,
}: {
  item: BoardItem;
  current?: boolean;
  onOpen?: (item: BoardItem) => void;
}) {
  const { role, interview } = item;
  return (
    <button
      type="button"
      className="pp-tile"
      data-kind={interview ? "interview" : item.stage}
      aria-current={current ? "true" : undefined}
      onClick={() => onOpen?.(item)}
    >
      <span className="pp-tile-l1">
        <span className="pp-tile-title pp-trunc" title={role.title}>
          {role.title}
        </span>
        <span className="pp-tile-n pp-num" aria-label={`${role.score} out of 10 fit`}>
          {role.score}
        </span>
      </span>
      <span className="pp-tile-co pp-trunc">
        {role.company} · {role.city}
      </span>
      {interview ? (
        <>
          <span className="pp-tile-when">
            <Icon name="calendar" size={16} />
            {interview.when}
          </span>
          <span className="pp-tile-round pp-trunc">{interview.round}</span>
          <span className="pp-tile-cta">
            <span className="pp-tag">{interview.prepReady ? "Prep sheet ready" : "Writing your sheet"}</span>
            <span aria-hidden="true">
              Open
              <Icon name="chevron-right" size={14} />
            </span>
          </span>
        </>
      ) : (
        <span className="pp-tile-foot">
          <span className="pp-tag pp-num">{item.date}</span>
          {item.next ? <span className="pp-next pp-trunc">{item.next}</span> : null}
        </span>
      )}
    </button>
  );
}
