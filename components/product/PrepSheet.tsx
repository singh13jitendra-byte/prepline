"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Icon, type IconName } from "./icons";
import { Button, Illustrative, KeyValue, ScoreRule, SourceChip, StatusPill, cx, type SurfaceProps } from "./primitives";
import { kestrelSheet, type DesignRound, type PrepSheetData, type Vote } from "./data";

export type PrepSheetProps = SurfaceProps & {
  data?: PrepSheetData;
  /** Controlled votes by question id. Leave undefined for internal state. */
  votes?: Record<string, Vote>;
  defaultVotes?: Record<string, Vote>;
  onVote?: (questionId: string, vote: Vote) => void;
  /** Hide the section jump bar (e.g. in a short showcase frame). */
  nav?: boolean;
};

const roundIcon: Record<DesignRound["kind"], IconName> = {
  walkthrough: "play",
  critique: "eye",
  whiteboard: "pen",
  takehome: "box",
};
const roundStatus: Record<DesignRound["status"], { label: string; tone: "accent" | "neutral" | "quiet" }> = {
  this: { label: "This round", tone: "accent" },
  later: { label: "Later round", tone: "neutral" },
  unlikely: { label: "Unlikely", tone: "quiet" },
};

/**
 * The prep sheet written the moment an interview is booked: likely questions
 * (each with its source), design-round guidance, questions to ask them, and an
 * opener. After the interview, Asked / Not asked votes (anonymous) sharpen the
 * next designer's sheet.
 */
export function PrepSheet({
  data = kestrelSheet,
  votes,
  defaultVotes = {},
  onVote,
  nav = true,
  skin = "auto",
  bare,
  illustrative = true,
  className,
  style,
}: PrepSheetProps) {
  const hid = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState<Record<string, Vote>>(defaultVotes);
  const [touched, setTouched] = useState(false);
  const [said, setSaid] = useState("");
  const v = votes ?? inner;
  const { role, interview, questions } = data;
  const asked = questions.filter((q) => v[q.id] === "asked").length;

  const sections = [
    { id: `${hid}-q`, label: "Likely questions", n: questions.length },
    { id: `${hid}-round`, label: "Design round" },
    { id: `${hid}-ask`, label: "Ask them back", n: data.ask.length },
    { id: `${hid}-open`, label: "Before it starts" },
  ];
  const [active, setActive] = useState(sections[0].id);

  // The jump bar follows the sheet's own scroll.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = () => {
      const top = body.scrollTop + 24;
      let cur = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop - body.offsetTop <= top) cur = s.id;
      }
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) cur = sections[sections.length - 1].id;
      setActive(cur);
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid]);

  // Scroll only the sheet, never the page around it.
  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const body = bodyRef.current;
    const el = document.getElementById(id);
    if (!body || !el) return;
    body.scrollTo({ top: el.offsetTop - body.offsetTop });
    setActive(id);
  };

  const cast = (id: string, choice: Exclude<Vote, null>) => {
    const next: Vote = v[id] === choice ? null : choice;
    const nextVotes = { ...v, [id]: next };
    if (!votes) setInner(nextVotes);
    setTouched(true);
    const n = questions.filter((q) => nextVotes[q.id] === "asked").length;
    const what = next === null ? "Vote removed." : next === "asked" ? "Marked as asked." : "Marked as not asked.";
    setSaid(`${what} ${n} of ${questions.length} asked.`);
    onVote?.(id, next);
  };

  return (
    <article
      className={cx("pp pp-prep", className)}
      data-skin={skin}
      data-bare={bare ? "" : undefined}
      aria-labelledby={hid}
      style={style}
    >
      <header className="pp-prep-h">
        <div className="pp-prep-top">
          <span className="pp-meta pp-trunc pp-prep-written">
            Prep sheet<span className="pp-sep">·</span>
            {data.written}
          </span>
          <span className="pp-spacer" />
          <Illustrative show={illustrative} />
          <span className="pp-prep-actions">
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              Print
            </Button>
            <Button size="sm" variant="ghost" icon="doc">
              Copy sheet
            </Button>
          </span>
        </div>
        <div className="pp-prep-title">
          <div>
            <h2 id={hid} title={`${role.title}, ${role.company}`}>
              {role.title}
            </h2>
            <p className="pp-meta">
              {role.company}
              <span className="pp-sep">·</span>
              {role.city}
            </p>
          </div>
          <ScoreRule score={role.score} size="md" suffix className="pp-prep-rule" />
        </div>
        <KeyValue
          items={[
            {
              k: "Interview",
              v: (
                <>
                  {interview.when} <span style={{ fontWeight: 400 }}>{interview.zone}</span>
                </>
              ),
            },
            { k: "Round", v: interview.round },
            { k: "Format", v: interview.format },
          ]}
        />
      </header>

      {nav ? (
        <nav className="pp-prep-nav" aria-label="Sheet sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined} onClick={(e) => jump(e, s.id)}>
              {s.label}
              {s.n ? <span className="pp-col-n">{s.n}</span> : null}
            </a>
          ))}
        </nav>
      ) : null}

      <div data-lenis-prevent="" className="pp-prep-body" ref={bodyRef} role="region" aria-label="Prep sheet contents">
        <section className="pp-prep-sec" id={sections[0].id} aria-labelledby={`${sections[0].id}-h`}>
          <div className="pp-prep-sec-h">
            <h3 id={`${sections[0].id}-h`}>Likely questions</h3>
          </div>
          <p className="pp-prep-sec-p">Each one shows where it came from. Say your answer out loud once.</p>
          <ol className="pp-qs">
            {questions.map((q, i) => {
              const vote = v[q.id] ?? null;
              return (
                <li key={q.id} className="pp-q" data-vote={vote ?? undefined}>
                  <span className="pp-q-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <p className="pp-q-text" id={`${hid}-${q.id}`}>
                    {q.text}
                  </p>
                  <p className="pp-q-tell">
                    <b>Tell:</b> {q.angle}
                    {q.tell ? <span>{q.tell}</span> : null}
                  </p>
                  <div className="pp-q-foot">
                    {q.sources.map((s) => (
                      <SourceChip key={s.label + (s.detail ?? "")} {...s} size="sm" />
                    ))}
                    <span className="pp-vote" role="group" aria-label="Was this question asked?" aria-describedby={`${hid}-${q.id}`}>
                      <button type="button" data-v="asked" aria-pressed={vote === "asked"} onClick={() => cast(q.id, "asked")}>
                        <Icon name="check" size={14} />
                        Asked
                      </button>
                      <button
                        type="button"
                        data-v="not-asked"
                        aria-pressed={vote === "not-asked"}
                        onClick={() => cast(q.id, "not-asked")}
                      >
                        <Icon name="x" size={14} />
                        Not asked
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="pp-prep-sec" id={sections[1].id} aria-labelledby={`${sections[1].id}-h`}>
          <div className="pp-prep-sec-h">
            <h3 id={`${sections[1].id}-h`}>Design round</h3>
          </div>
          <p className="pp-prep-sec-p">
            This round is a {(data.rounds.find((r) => r.status === "this")?.name ?? "design round").toLowerCase()}. How each
            format runs at {role.company}, from designers who sat there.
          </p>
          <ul className="pp-rounds">
            {data.rounds.map((r) => (
              <li key={r.kind} className="pp-round" data-status={r.status}>
                <span className="pp-round-h">
                  <Icon name={roundIcon[r.kind]} size={16} />
                  <b className="pp-trunc">{r.name}</b>
                  <StatusPill tone={roundStatus[r.status].tone} dot={r.status === "this"}>
                    {roundStatus[r.status].label}
                  </StatusPill>
                </span>
                <p>{r.guidance}</p>
                {r.length ? <p className="pp-num">{r.length}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="pp-prep-sec" id={sections[2].id} aria-labelledby={`${sections[2].id}-h`}>
          <div className="pp-prep-sec-h">
            <h3 id={`${sections[2].id}-h`}>Ask them back</h3>
          </div>
          <ol className="pp-asks">
            {data.ask.map((a, i) => (
              <li key={a.text}>
                <span className="pp-q-n" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <p>{a.text}</p>
                  <SourceChip {...a.source} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="pp-prep-sec" id={sections[3].id} aria-labelledby={`${sections[3].id}-h`}>
          <div className="pp-prep-sec-h">
            <h3 id={`${sections[3].id}-h`}>Before it starts</h3>
          </div>
          <p className="pp-prep-sec-p">A couple of easy things to say while everyone joins the call.</p>
          <figure className="pp-opener">
            <blockquote>{data.opener.text}</blockquote>
            <figcaption>
              <Icon name="chat" size={16} />
              <span>{data.opener.why}</span>
              <SourceChip {...data.opener.source} />
            </figcaption>
          </figure>
          <p className="pp-disclaimer">{data.disclaimer}</p>
        </section>
      </div>

      <footer className="pp-prep-f">
        <span className="pp-prog" aria-hidden="true">
          {questions.map((q) => (
            <span key={q.id} data-v={v[q.id] ?? undefined} />
          ))}
        </span>
        <span className="pp-prep-count">
          {asked} of {questions.length} asked
        </span>
        <span className="pp-prep-note">
          {touched ? "Thanks. Your vote is anonymous." : "After the interview, mark each question. Votes are anonymous."}
        </span>
        <span className="pp-sr" aria-live="polite">
          {said}
        </span>
      </footer>
    </article>
  );
}
