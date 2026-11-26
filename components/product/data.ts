/**
 * Illustrative product data for the Prepline product screens.
 *
 * Every company, role, person and number here is an invented placeholder. The
 * twelve ranked roles come from `rankedRoles` in lib/content.ts; this file adds
 * what the product screens need (level, found time, a reason for every row,
 * score breakdowns, board state, one prep sheet). Swap for real,
 * permission-cleared examples before launch.
 *
 * The user these screens belong to has two case studies: "Pulse design system"
 * and "Family test booking" (the family-booking redesign the prep sheet cites).
 */

import { rankedRoles, type RankedRole } from "@/lib/content";

export const ILLUSTRATIVE = "Illustrative data";

export type Level = "Senior" | "Mid";
export type WorkMode = RankedRole["mode"];

export type Role = {
  /** Found in the last day: shows "New today". */
  isNew?: boolean;
  id: string;
  rank: number;
  initials: string;
  title: string;
  company: string;
  city: string;
  mode: WorkMode;
  level: Level;
  /** Out of 10. */
  score: number;
  /** One line, plain, no hype. */
  reason: string;
  /** Short relative time the role was found, e.g. "2h". */
  found: string;
};

const extra: Record<number, { reason: string; found: string }> = {
  1: { reason: "Design-system team in HealthTech. Matches both your case studies.", found: "2h" },
  2: { reason: "Owns the component library. Your Pulse work fits.", found: "5h" },
  3: { reason: "Patient-facing booking flows, like your redesign.", found: "9h" },
  4: { reason: "Growth experiments. Onboarding is close, fintech is new.", found: "1d" },
  5: { reason: "Senior and HealthTech. Research-heavy, lighter on systems.", found: "1d" },
  6: { reason: "Remote B2B SaaS. Scope is a step below your level.", found: "1d" },
  7: { reason: "Design-system work like Pulse, in e-commerce.", found: "2d" },
  8: { reason: "Diagnostics domain match. On-site in Hyderabad.", found: "2d" },
  9: { reason: "Onboarding flows fit. Fintech compliance is new.", found: "3d" },
  10: { reason: "Interaction-heavy role. On-site in Chennai.", found: "3d" },
  11: { reason: "Senior B2B dashboards. Fewer patient flows.", found: "4d" },
  12: { reason: "Remote edtech at mid-level scope.", found: "5d" },
};

export const roles: Role[] = rankedRoles.map((r) => ({
  id: `role-${r.rank}`,
  rank: r.rank,
  initials: r.initials,
  title: r.title,
  company: r.company,
  city: r.city,
  mode: r.mode,
  level: /senior/i.test(r.title) ? "Senior" : "Mid",
  score: r.score,
  reason: extra[r.rank]?.reason ?? r.reason ?? "",
  found: extra[r.rank]?.found ?? "",
  isNew: /h$/.test(extra[r.rank]?.found ?? ""),
}));

/** "2,340 read · 186 matched level · 12 fit" */
export const funnel = { read: 2340, level: 186, fit: 12 } as const;

/** The week the list covers, and when it was read. */
export const week = { label: "Week of 23 November", readAt: "Last read: today, 6:10 AM" } as const;

/** Roles that were read and cut, each with its reason (a sample of the 2,328). */
export type CutRole = { id: string; title: string; company: string; city: string; reason: string };
export const cutCount = 2328;
export const cutRoles: CutRole[] = [
  { id: "cut-1", title: "UI Designer", company: "Tallybook", city: "Pune", reason: "Too junior for you" },
  { id: "cut-2", title: "Product Designer", company: "Loomcart", city: "Chennai", reason: "Five days on-site" },
  { id: "cut-3", title: "UX Researcher", company: "Meridian Diagnostics", city: "Mumbai", reason: "No case study fits" },
  { id: "cut-4", title: "Brand Designer", company: "Fernway", city: "Remote", reason: "Brand, not product" },
];

/* ── One role, expanded ────────────────────────────────────────────────── */

export type SourceKind = "jd" | "case" | "history" | "profile" | "general";

export type Citation = { kind: SourceKind; label: string; detail?: string };

/**
 * One line of a score's working: the points it added (or took away), the
 * sentence, and where it came from. `points: null` is an unscored gap.
 */
export type ReasonRow = { label: string; points: number | null; max?: number; text: string; cite: Citation };

export type RoleDetailData = {
  role: Role;
  /** Rows that add up to the score. */
  why: ReasonRow[];
  /** Minuses and unscored gaps. */
  watchOuts: ReasonRow[];
  privacy: string;
  jdHref?: string;
};

export const kestrel = roles[0];

export const kestrelDetail: RoleDetailData = {
  role: kestrel,
  why: [
    {
      label: "Portfolio fit",
      points: 3.5,
      max: 4,
      text: "Design-system team: matches your Pulse case study.",
      cite: { kind: "case", label: "From your case study", detail: "Pulse" },
    },
    {
      label: "Domain",
      points: 2,
      max: 2,
      text: "Patient-facing flows: close to your booking redesign.",
      cite: { kind: "case", label: "From your case study", detail: "Family booking" },
    },
    {
      label: "Level and city",
      points: 3.5,
      max: 4,
      text: "Senior, hybrid in Bengaluru. One more office day than you asked for.",
      cite: { kind: "profile", label: "From your preferences" },
    },
  ],
  watchOuts: [
    {
      label: "Gap",
      points: null,
      text: "Mentions motion design, and none of your case studies show it.",
      cite: { kind: "jd", label: "From the JD · not scored" },
    },
  ],
  privacy: "Your portfolio is read to score this. It isn’t stored.",
  jdHref: "#",
};

/* ── The board ─────────────────────────────────────────────────────────── */

export type Stage = "saved" | "applied" | "interview" | "offer";

export type BoardItem = {
  role: Role;
  stage: Stage;
  /** When it entered this stage, e.g. "Applied Tue". */
  date: string;
  /** The next thing to do, e.g. "Follow up Fri". */
  next?: string;
  interview?: { when: string; round: string; prepReady: boolean };
};

const byCompany = (c: string) => roles.find((r) => r.company === c) ?? roles[0];

export const boardItems: BoardItem[] = [
  { role: byCompany("Chai Stack"), stage: "saved", date: "Saved Mon", next: "Closes in 6 days" },
  { role: byCompany("Lumen Kart"), stage: "saved", date: "Saved Tue", next: "Referral possible" },
  { role: byCompany("Nabz Diagnostics"), stage: "saved", date: "Saved Tue", next: "Check on-site days" },
  { role: byCompany("Ledgerleaf"), stage: "saved", date: "Saved Wed" },
  { role: byCompany("Saffron Desk"), stage: "saved", date: "Saved Wed" },
  { role: byCompany("Paisa Labs"), stage: "applied", date: "Applied Tue", next: "Follow up Fri" },
  { role: byCompany("Northwell Care"), stage: "applied", date: "Applied Mon", next: "Recruiter replied" },
  { role: byCompany("Tarang Pay"), stage: "applied", date: "Applied 12 Nov", next: "No reply in 10 days" },
  {
    role: kestrel,
    stage: "interview",
    date: "Booked Wed",
    interview: { when: "Thu 3 Dec · 11:40", round: "Round 2 · Portfolio walkthrough", prepReady: true },
  },
];

export const stages: { id: Stage; label: string; empty: string }[] = [
  { id: "saved", label: "Saved", empty: "Nothing saved yet. Your matches are one tab over." },
  { id: "applied", label: "Applied", empty: "Roles you’ve applied to land here. You apply on the company’s site. Prepline never does." },
  { id: "interview", label: "Interview", empty: "Book an interview and drag the card here. The prep sheet starts then." },
  { id: "offer", label: "Offer", empty: "Empty for now. That’s normal." },
];

/* ── The prep sheet ────────────────────────────────────────────────────── */

export type Vote = "asked" | "not-asked" | null;

export type PrepQuestion = { id: string; text: string; angle: string; tell?: string; sources: Citation[] };

export type DesignRound = {
  kind: "walkthrough" | "critique" | "whiteboard" | "takehome";
  name: string;
  status: "this" | "later" | "unlikely";
  length: string;
  guidance: string;
};

export type PrepSheetData = {
  role: Role;
  interview: { when: string; zone: string; round: string; format: string };
  written: string;
  questions: PrepQuestion[];
  rounds: DesignRound[];
  ask: { text: string; source: Citation }[];
  opener: { text: string; why: string; source: Citation };
  disclaimer: string;
};

export const kestrelSheet: PrepSheetData = {
  role: kestrel,
  interview: { when: "Thu 3 Dec · 11:40", zone: "IST", round: "Round 2 of 3 · Portfolio", format: "Video call · 45 min" },
  written: "Written 2 min after booking",
  questions: [
    {
      id: "q1",
      text: "Walk us through how you scaled one component library across two products.",
      angle: "the button audit, then the token migration.",
      tell: "Pulse, case study 01",
      sources: [{ kind: "jd", label: "From the JD", detail: "own the design system" }],
    },
    {
      id: "q2",
      text: "Tell us about a time you pushed back in your family-booking redesign. What happened?",
      angle: "the request you declined, and the number behind it.",
      tell: "Family booking, case study 02",
      sources: [{ kind: "case", label: "From your case study", detail: "Family booking" }],
    },
    {
      id: "q3",
      text: "How would you design for patients who don’t trust lab-results apps?",
      angle: "plain-language results, and when a doctor steps in.",
      tell: "No case study yet. Prepare one honest answer.",
      sources: [{ kind: "history", label: "Asked here before", detail: "4 designers" }],
    },
  ],
  rounds: [
    {
      kind: "walkthrough",
      name: "Portfolio walkthrough",
      status: "this",
      length: "45 min",
      guidance: "Pick one project and show a decision you’d make differently now.",
    },
    {
      kind: "critique",
      name: "App critique",
      status: "later",
      length: "30 min",
      guidance: "Asked here before. Practise on the onboarding of a health app you use.",
    },
    {
      kind: "whiteboard",
      name: "Whiteboard",
      status: "later",
      length: "45 min",
      guidance: "Likely a reminder flow for a repeat blood test. Say the constraints first.",
    },
    {
      kind: "takehome",
      name: "Take-home",
      status: "unlikely",
      length: "",
      guidance: "No designer reported one at Kestrel Health.",
    },
  ],
  ask: [
    { text: "How does design work with engineering on the component library today?", source: { kind: "jd", label: "From the JD", detail: "partner with engineering" } },
    { text: "What would make this hire a success in the first 90 days?", source: { kind: "general", label: "Good for any round" } },
    { text: "Which product metric does the design team own?", source: { kind: "jd", label: "From the JD", detail: "measure impact" } },
  ],
  opener: {
    text: "I saw the new booking flow went live last month. Was that your team?",
    why: "A recent launch that ties straight to your family-booking redesign.",
    source: { kind: "general", label: "From their product updates" },
  },
  disclaimer: "Written by an AI model from the JD and your work. Treat it as preparation, not prediction.",
};

/* ── The seat ticket ───────────────────────────────────────────────────── */

export const ticket = {
  header: "Private beta · one seat",
  cohort: "Beta 01",
  seats: 25,
  stubLabel: "Seat",
  stubOf: "of 25",
  ringsCaption: "25 seats",
  ringsLabel: "25 beta seats. The filled ring marks your request.",
  foot: "Free while it’s in beta.",
  promise: "Nothing is sent in your name. Your portfolio isn’t kept.",
  stamp: "Seat requested",
  field: { label: "Your email", placeholder: "you@email.com", help: "Only used for your beta invite and updates.", button: "Save me a seat" },
} as const;

/** A plausible expanded view for any ranked role (the gallery's live demo uses it). */
export function detailFor(role: Role): RoleDetailData {
  if (role.id === kestrel.id) return kestrelDetail;
  const remote = role.mode === "Remote";
  const levelCity = (role.level === "Senior" ? 2 : 1.5) + (remote ? 2 : role.mode === "Hybrid" ? 1.5 : 1);
  const domain = /health|care|diagnos|aarogya/i.test(role.company + role.title) ? 2 : 1;
  const portfolio = Math.max(1, Math.min(4, role.score - levelCity - domain));
  const [first, second] = role.reason.split(". ");
  const caseStudy = /system|library|component|Pulse/i.test(role.reason + role.title) ? "Pulse" : "Family booking";
  const where = remote ? "fully remote" : `${role.mode.toLowerCase()} in ${role.city}`;
  return {
    role,
    why: [
      { label: "Portfolio fit", points: portfolio, max: 4, text: first.replace(/\.$/, "") + ".", cite: { kind: "case", label: "From your case study", detail: caseStudy } },
      { label: "Domain", points: domain, max: 2, text: domain === 2 ? "HealthTech, like your last role." : "A domain you haven’t shipped in yet.", cite: { kind: "profile", label: "From your profile" } },
      { label: "Level and city", points: levelCity, max: 4, text: `${role.level === "Senior" ? "Senior" : "Mid-level"}, ${where}.`, cite: { kind: "profile", label: "From your preferences" } },
    ],
    watchOuts: second
      ? [{ label: "Gap", points: null, text: second.replace(/\.$/, "") + ".", cite: { kind: "jd", label: "From the JD · not scored" } }]
      : [],
    privacy: kestrelDetail.privacy,
    jdHref: "#",
  };
}
