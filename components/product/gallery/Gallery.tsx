"use client";

/**
 * Dev-only review gallery for components/product. Renders every screen at its
 * showcase size, every state, the mobile variants, the scaled Showcase helper,
 * and the night skin. `theme` applies a throwaway token override to prove the
 * screens read tokens only.
 */

import { useEffect, useState, type ReactNode } from "react";
import { installRowTilt } from "../tilt";
import {
  Board,
  Kbd,
  MatchesList,
  PrepSheet,
  RoleDetail,
  ScoreBadge,
  ScoreRing,
  ScoreRule,
  MatchRow,
  SeatTicket,
  Showcase,
  SHOWCASE_SIZES,
  SourceChip,
  StatusPill,
  Avatar,
  KeyValue,
  Button,
} from "../index";
import { Icon, type IconName } from "../icons";
import { boardItems, detailFor, roles, type Role } from "../data";
import { Tile } from "../Board";
import "@/app/themes/gallery-proof.css";
import "./gallery.css";

type Theme = "night-desk" | "alt" | "dark";

function Frame({
  label,
  w,
  h,
  note,
  children,
  tone,
}: {
  label: string;
  w: number;
  h?: number;
  note?: string;
  children: ReactNode;
  tone?: "night";
}) {
  return (
    <figure className="gx-frame" data-tone={tone} style={{ width: w, maxWidth: "100%" }}>
      <figcaption>
        <b>{label}</b>
        <span className="pp-num">
          {w}
          {h ? ` × ${h}` : " × auto"}
        </span>
        {note ? <span>{note}</span> : null}
      </figcaption>
      <div className="gx-box" style={{ height: h }}>
        {children}
      </div>
    </figure>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="gx-sec" id={id} aria-labelledby={`${id}-h`}>
      <header>
        <h2 id={`${id}-h`}>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </header>
      <div className="gx-row">{children}</div>
    </section>
  );
}

function DemoSeatForm({ done = false }: { done?: boolean }) {
  // Stands in for <WaitlistForm tone="ticket" />. Never submits.
  if (done) {
    return (
      <p className="pp-field-help" role="status" style={{ fontSize: 13, lineHeight: "20px" }}>
        Requested for you@email.com. Wrong address?{" "}
        <button type="button" className="pp-link">
          Edit it
        </button>
      </p>
    );
  }
  return (
    <form className="pp-field" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="gx-email">Your email</label>
      <div className="pp-field-row">
        <input id="gx-email" className="pp-input" type="email" placeholder="you@email.com" autoComplete="off" />
        <Button variant="primary" type="submit">
          Save me a seat
          <Icon name="arrow-right" size={16} />
        </Button>
      </div>
      <p className="pp-field-help">Only used for your beta invite and updates.</p>
    </form>
  );
}

const iconNames: IconName[] = [
  "search", "chevron-down", "chevron-right", "check", "x", "external", "bookmark", "bookmark-filled", "calendar",
  "clock", "pin", "doc", "folder", "people", "person", "compass", "alert", "arrow-right", "board", "list", "lock",
  "sort", "play", "eye", "pen", "box", "chat", "plus", "send", "spark",
];

export function Gallery({ theme }: { theme: Theme }) {
  const S = SHOWCASE_SIZES;
  const [picked, setPicked] = useState<Role>(roles[0]);
  // Delight 9: the rows' paper tilt, as on the story page (where Nav installs it).
  useEffect(() => installRowTilt(), []);

  return (
    <div className="gx" data-theme={theme === "night-desk" ? undefined : theme}>
      <header className="gx-top">
        <div>
          <p className="gx-kicker">Dev only · not indexed · illustrative data</p>
          <h1>Prepline product UI</h1>
          <p className="gx-lead">
            The real screens the scroll story showcases. Every colour, family, radius and shadow comes from the theme
            tokens. Companies and figures are invented placeholders.
          </p>
        </div>
        <nav aria-label="Theme" className="gx-themes">
          <a href="?theme=night-desk" aria-current={theme === "night-desk" ? "page" : undefined}>
            Night Desk
          </a>
          <a href="?theme=alt" aria-current={theme === "alt" ? "page" : undefined}>
            Alt theme
          </a>
          <a href="?theme=dark" aria-current={theme === "dark" ? "page" : undefined}>
            Dark theme
          </a>
        </nav>
      </header>

      <Section id="showcase" title="Showcase sizes" intro="Each screen at the exact size the scroll story frames it.">
        <Frame label="MatchesList" w={S.matches.w} h={S.matches.h}>
          <MatchesList defaultSelectedId="role-1" />
        </Frame>
        <div className="gx-col">
          <Frame label="RoleDetail" w={S.role.w} h={S.role.h}>
            <RoleDetail />
          </Frame>
          <Frame label="SeatTicket" w={S.ticket.w} h={S.ticket.h}>
            <SeatTicket>
              <DemoSeatForm />
            </SeatTicket>
          </Frame>
        </div>
        <Frame label="Board" w={S.board.w} h={S.board.h}>
          <Board selectedId="role-1" />
        </Frame>
        <Frame label="PrepSheet" w={S.prep.w} h={S.prep.h}>
          <PrepSheet />
        </Frame>
      </Section>

      <Section id="states" title="States" intro="Loading, empty, filtered to nothing, hover and selected, pressed actions, votes cast, stamped.">
        <Frame label="MatchesList" note="loading" w={S.matches.w} h={420}>
          <MatchesList state="loading" />
        </Frame>
        <Frame label="MatchesList" note="empty week" w={S.matches.w} h={420}>
          <MatchesList state="empty" />
        </Frame>
        <Frame label="MatchesList" note="filters match nothing" w={S.matches.w} h={420}>
          <MatchesList defaultFilters={{ city: "Chennai", level: "Senior" }} />
        </Frame>
        <Frame label="MatchesList" note="row 2 selected, row 4 hovered" w={S.matches.w} h={420}>
          <MatchesList defaultSelectedId="role-2" hoveredId="role-4" />
        </Frame>
        <Frame label="RoleDetail" note="saved, applied by you" w={S.role.w} h={S.role.h}>
          <RoleDetail saved applied />
        </Frame>
        <Frame label="PrepSheet" note="votes cast" w={S.prep.w} h={560}>
          <PrepSheet defaultVotes={{ q1: "asked", q2: "not-asked", q3: "asked" }} nav={false} />
        </Frame>
        <Frame label="Board" note="list view" w={S.board.w} h={S.board.h}>
          <Board defaultView="list" selectedId="role-1" />
        </Frame>
        <Frame label="SeatTicket" note="stamped after a request" w={S.ticket.w} h={S.ticket.h}>
          <SeatTicket stamped>
            <DemoSeatForm done />
          </SeatTicket>
        </Frame>
      </Section>

      <Section id="mobile" title="Mobile" intro="The same components in a 360px frame. Layout follows the component’s own width.">
        <Frame label="MatchesList" w={S.matchesMobile.w} h={S.matchesMobile.h}>
          <MatchesList defaultSelectedId="role-1" />
        </Frame>
        <Frame label="RoleDetail" w={S.roleMobile.w} h={S.roleMobile.h}>
          <RoleDetail />
        </Frame>
        <Frame label="Board" w={S.boardMobile.w} h={S.boardMobile.h}>
          <Board />
        </Frame>
        <Frame label="PrepSheet" w={S.prepMobile.w} h={S.prepMobile.h}>
          <PrepSheet />
        </Frame>
        <Frame label="SeatTicket" w={S.ticketMobile.w} h={S.ticketMobile.h}>
          <SeatTicket>
            <DemoSeatForm />
          </SeatTicket>
        </Frame>
      </Section>

      <Section id="live" title="Composed" intro="MatchesList drives RoleDetail. Use ↑ ↓ in the list, Enter to open.">
        <div className="gx-live">
          <MatchesList selectedId={picked.id} onSelect={setPicked} style={{ height: 560 }} />
          <RoleDetail key={picked.id} data={detailFor(picked)} style={{ height: 360 }} />
        </div>
      </Section>

      <Section
        id="scaled"
        title="Scaled showcase"
        intro="How a face renders a product screen inside a smaller or moving frame: laid out at its natural size, scaled as one picture."
      >
        <Frame label="Showcase size=matches" note="contain in 336 × 384" w={336} h={384}>
          <Showcase size="matches" decorative>
            <MatchesList hints={false} defaultSelectedId="role-1" />
          </Showcase>
        </Frame>
        <Frame label="Showcase size=board" note="scale 0.5" w={450} h={210}>
          <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
            <Showcase size="board" scale={0.5} decorative>
              <Board selectedId="role-1" />
            </Showcase>
          </div>
        </Frame>
        <Frame label="Showcase size=role" note="tilted, as on a moving stage" w={420} h={300}>
          <div className="gx-tilt">
            <Showcase size="role" decorative>
              <RoleDetail illustrative={false} />
            </Showcase>
          </div>
        </Frame>
      </Section>

      <Section
        id="night"
        title="Night chapter"
        intro="Inside a night chapter. Screens that live on the night stage take skin=&quot;night&quot;; paper objects (sheet, ticket) take skin=&quot;day&quot; and stay paper."
      >
        <div className="gx-night" data-chapter="night">
          <Frame label="MatchesList" note="skin night" w={S.matches.w} h={460}>
            <MatchesList skin="night" defaultSelectedId="role-1" cut={false} />
          </Frame>
          <div className="gx-col">
            <Frame label="RoleDetail" note="compact, skin night (the card face)" w={520} h={320}>
              <RoleDetail skin="night" variant="compact" illustrative={false} />
            </Frame>
            <Frame label="SeatTicket" note="skin day inside night" w={S.ticket.w} h={S.ticket.h}>
              <SeatTicket skin="day">
                <DemoSeatForm />
              </SeatTicket>
            </Frame>
          </div>
          <Frame label="PrepSheet" note="skin day inside night (the sheet face)" w={S.prep.w} h={S.prep.h}>
            <PrepSheet skin="day" nav={false} defaultVotes={{ q1: "asked" }} />
          </Frame>
        </div>
      </Section>

      <Section id="faces" title="Story faces" intro="The natural sizes the scroll story's faces use (storyboard and Night Desk spec, section 7).">
        <Frame label="row · MatchRow" note="on night" w={440} h={44} tone="night">
          <MatchRow skin="night" selected framed />
        </Frame>
        <Frame label="row · MatchRow" note="on day" w={440} h={44}>
          <MatchRow framed />
        </Frame>
        <Frame label="card · RoleDetail compact" w={520} h={320}>
          <RoleDetail variant="compact" illustrative={false} />
        </Frame>
        <Frame label="tile · Board Tile" w={154} h={92}>
          <div className="pp" data-bare="" style={{ background: "transparent" }}>
            <Tile item={boardItems[5]} />
          </div>
        </Frame>
      </Section>

      <Section id="responsive" title="Fluid" intro="Full container width, content height.">
        <div className="gx-wide">
          <Board style={{ height: 460 }} />
        </div>
      </Section>

      <Section id="primitives" title="Primitives">
        <div className="pp gx-prims" style={{ height: "auto" }}>
          <div className="gx-prim">
            <span className="gx-prim-l">ScoreBadge</span>
            <ScoreBadge score={9} />
            <ScoreBadge score={7} />
            <ScoreBadge score={6} />
            <ScoreBadge score={9.5} size="sm" suffix={false} />
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">ScoreRule (the score, everywhere)</span>
            <ScoreRule score={9} size="lg" suffix />
            <ScoreRule score={7} />
            <ScoreRule score={6} size="sm" />
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">ScoreRing (primitive only)</span>
            <ScoreRing score={9} size="lg" />
            <ScoreRing score={7} />
            <ScoreRing score={6} size="sm" />
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">SourceChip</span>
            <SourceChip kind="jd" label="From the JD" detail="own the design system" />
            <SourceChip kind="case" label="From your case study" detail="Family test booking" />
            <SourceChip kind="history" label="Asked here before" detail="4 designers" />
            <SourceChip kind="general" label="Good for any round" />
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">StatusPill</span>
            <StatusPill>Applied</StatusPill>
            <StatusPill tone="accent">This round</StatusPill>
            <StatusPill tone="success">Prep sheet ready</StatusPill>
            <StatusPill tone="quiet" dot={false}>
              Unlikely
            </StatusPill>
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">Avatar</span>
            {roles.slice(0, 6).map((r) => (
              <Avatar key={r.id} initials={r.initials} name={r.company} />
            ))}
            <Avatar initials="KH" name="Kestrel Health" size="lg" />
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">KeyValue</span>
            <KeyValue
              items={[
                { k: "Interview", v: "Thu 3 Dec · 11:40" },
                { k: "Round", v: "2 of 3 · Design" },
                { k: "Format", v: "Video · 45 min" },
              ]}
            />
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">Button · Kbd</span>
            <Button variant="primary">Save me a seat</Button>
            <Button icon="bookmark" kbd="S">
              Save
            </Button>
            <Button icon="check" aria-pressed>
              Applied by you
            </Button>
            <Button variant="ghost" icon="external">
              Open JD
            </Button>
            <span className="pp-meta" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </div>
          <div className="gx-prim">
            <span className="gx-prim-l">Icons · 20px grid, 1.5 stroke</span>
            <span className="gx-icons">
              {iconNames.map((n) => (
                <span key={n} title={n}>
                  <Icon name={n} size={20} />
                </span>
              ))}
            </span>
          </div>
        </div>
      </Section>

      <footer className="gx-foot">Illustrative data. Companies, roles and figures are invented placeholders.</footer>
    </div>
  );
}
