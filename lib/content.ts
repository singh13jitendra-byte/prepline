// All landing-page copy and sample data in one place.
// Company names and the "Ananya" story are invented placeholders: swap them for real,
// permission-cleared examples before launch.

export const HERO_VIDEO_SRC =
  process.env.NEXT_PUBLIC_HERO_VIDEO_SRC ??
  // MotionSites free background "Yellow Flower Skylight". Self-host it in /public for production.
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_202655_a7f5aca0-2f80-4bc9-bcb5-96ac95662003.mp4";

export const BETA_SEATS = 25;

export const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#prep", label: "Prep sheets" },
  { href: "#features", label: "For designers" },
  { href: "#join", label: "Privacy" },
];

export type Match = {
  initials: string;
  title: string;
  company: string;
  city: string;
  mode: string;
  score: number;
  reason: string;
};

export const matches: Match[] = [
  {
    initials: "KH",
    title: "Senior Product Designer",
    company: "Kestrel Health",
    city: "Bengaluru",
    mode: "Hybrid",
    score: 9,
    reason: "Design-system team, HealthTech, matches your case studies",
  },
  {
    initials: "PL",
    title: "Product Designer, Design Systems",
    company: "Paisa Labs",
    city: "Gurugram",
    mode: "On-site",
    score: 8,
    reason: "Owns the component library; your Pulse work fits",
  },
  {
    initials: "NC",
    title: "UX Designer, Patient App",
    company: "Northwell Care",
    city: "Remote",
    mode: "Remote",
    score: 8,
    reason: "Patient-facing booking flows, like your redesign",
  },
];

/** Little notifications that cycle beside the hero card. */
export const heroToasts = [
  { title: "Interview booked", body: "Prep sheet ready for Kestrel Health" },
  { title: "3 new roles ranked", body: "Best fit: 9/10, design systems" },
  { title: "7 of 12 were asked", body: "Your last sheet was on point" },
];

export const marqueeTags = [
  "Product designers",
  "UX designers",
  "Design systems",
  "HealthTech",
  "Fintech",
  "Patient apps",
  "Interaction design",
  "UX research",
  "Content design",
  "Senior IC roles",
];

/** Scroll story for the matching section. Illustrative numbers for one week of public careers pages. */
export const funnelStages = [
  { value: 2340, label: "design roles read this week", detail: "from public careers pages at companies hiring designers" },
  { value: 186, label: "match your level and city", detail: "seniority, location, remote or hybrid, and pay band" },
  { value: 12, label: "fit your portfolio", detail: "scored out of 10, each with a reason you can read" },
] as const;

export const boardColumns = ["Saved", "Applied", "Interview", "Offer"] as const;

export const storySteps = [
  {
    label: "Week 1",
    title: "Roles arrive ranked",
    body: "Twelve roles scored for her portfolio. She saves the five that fit, each with a reason she can read.",
  },
  {
    label: "Week 2",
    title: "One board, no spreadsheet",
    body: "Four applications go out. Every role sits on one board, from saved to closed.",
  },
  {
    label: "Week 3",
    title: "Interview booked, sheet ready",
    body: "She moves the card. The prep sheet appears, built from the JD, her case studies and what this company asked before.",
  },
  {
    label: "Week 4",
    title: "7 of 12 were asked",
    body: "One tap after the interview tells Prepline what came up. The offer lands the week after.",
  },
];

export const prepTabs = ["Likely questions", "Design rounds", "Ask them"] as const;

export const prepQuestions: Record<(typeof prepTabs)[number], { q: string; why: string }[]> = {
  "Likely questions": [
    { q: "Walk us through how you scaled components across two products.", why: "From the JD: “own the design system”" },
    { q: "In your family-booking redesign, what did you push back on, and why?", why: "From your case study" },
    { q: "How would you design for patients who distrust lab-results apps?", why: "Asked here before · 4 designers" },
  ],
  "Design rounds": [
    { q: "Portfolio walkthrough: pick one project and show a decision you'd make differently now.", why: "Common in senior IC rounds" },
    { q: "App critique: review the onboarding of a health app you use.", why: "Asked here before · 2 designers" },
    { q: "Whiteboard: design a reminder flow for a repeat blood test.", why: "From the JD: “patient-facing flows”" },
  ],
  "Ask them": [
    { q: "How does design work with engineering on the component library today?", why: "Shows you care about systems" },
    { q: "What would make this hire a success in the first 90 days?", why: "Good for any round" },
    { q: "Which product metric does the design team own?", why: "From the JD: “measure impact”" },
  ],
};

export const trust = [
  { title: "Your portfolio isn’t stored", body: "Read once to write your sheet, then discarded." },
  { title: "No auto-apply, ever", body: "You choose where to apply. We never send anything for you." },
  { title: "Free during the beta", body: "Founding members get early pricing when it launches." },
  { title: "Votes stay anonymous", body: "Question votes carry no name or email." },
];

/* ──────────────────────────────────────────────────────────────────────────
 * STORY COPY — "One role, read."
 *
 * Every string on the scroll story, keyed by beat (storyboard section 2), plus
 * the nav, the footer and the shared labels. Acts, faces and the world read
 * from here and never write copy of their own.
 *
 *   import { story as copy } from "@/lib/content";   // or: import { storyCopy }
 *   <h2>{copy.ranked.h2}</h2>
 *
 * (`story` is also the name of the store in lib/story.ts. Alias one of them.)
 *
 * All companies, roles and figures are invented placeholders and the page says
 * so ("Illustrative data"). Swap for real, permission-cleared examples before launch.
 * ────────────────────────────────────────────────────────────────────────── */

export type RankedRole = {
  rank: number;
  initials: string;
  title: string;
  company: string;
  city: string;
  mode: "Hybrid" | "On-site" | "Remote";
  score: number;
  /** One-line reason. Rows 1 to 3 have one; the rest show `story.ranked.rowHoverFallback`. */
  reason?: string;
};

/** The 12 that fit. Scores descend 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6. Rows 1 to 3 are `matches`. */
export const rankedRoles: RankedRole[] = [
  ...matches.map((m, i) => ({
    rank: i + 1,
    initials: m.initials,
    title: m.title,
    company: m.company,
    city: m.city,
    mode: m.mode as RankedRole["mode"],
    score: m.score,
    reason: m.reason,
  })),
  { rank: 4, initials: "TP", title: "Product Designer, Growth", company: "Tarang Pay", city: "Mumbai", mode: "Hybrid", score: 7 },
  { rank: 5, initials: "AL", title: "Senior UX Designer", company: "Aarogya Loop", city: "Pune", mode: "Hybrid", score: 7 },
  { rank: 6, initials: "CS", title: "Product Designer II", company: "Chai Stack", city: "Bengaluru", mode: "Remote", score: 7 },
  { rank: 7, initials: "LK", title: "Design Systems Designer", company: "Lumen Kart", city: "Gurugram", mode: "Hybrid", score: 7 },
  { rank: 8, initials: "ND", title: "UX Designer, Diagnostics", company: "Nabz Diagnostics", city: "Hyderabad", mode: "On-site", score: 6 },
  { rank: 9, initials: "LL", title: "Product Designer, Onboarding", company: "Ledgerleaf", city: "Mumbai", mode: "Hybrid", score: 6 },
  { rank: 10, initials: "MM", title: "Interaction Designer", company: "Monsoon Mobility", city: "Chennai", mode: "On-site", score: 6 },
  { rank: 11, initials: "SD", title: "Senior Product Designer, B2B", company: "Saffron Desk", city: "Noida", mode: "Hybrid", score: 6 },
  { rank: 12, initials: "PL", title: "Product Designer", company: "Peepal Learn", city: "Remote", mode: "Remote", score: 6 },
];

/** The role the page follows. */
export const theRole = {
  title: "Senior Product Designer",
  company: "Kestrel Health",
  city: "Bengaluru",
  mode: "Hybrid",
  score: 9,
  interview: "Thu 11:40",
} as const;

export const story = {
  /** Shared, not tied to one beat. */
  common: {
    illustrative: "Illustrative data",
    cta: "Request a seat",
    ctaSending: "Requesting",
    emailPlaceholder: "you@email.com",
    success: "You’re on the list. We’ll email your invite when a seat opens.",
    skipLink: "Skip to request a seat",
    /** Visually hidden sentence that stands in for the three animated counters. */
    figuresForScreenReaders:
      "Illustrative example: 2,340 design roles read this week, 186 match your level and city, 12 fit your portfolio.",
    figures: { read: 2340, level: 186, fit: 12, dropped: 2328, seats: 25 },
  },

  nav: {
    brand: "Prepline",
    links: [
      { href: "#board", label: "How it works" },
      { href: "#prep", label: "Prep sheets" },
      { href: "#join", label: "Privacy" },
    ],
    cta: "Request a seat",
    menu: "Menu",
    railLabel: "Story",
    /** Beat rail ticks: label and the beat each one scrolls to. */
    rail: [
      { label: "Read", beat: "hero" },
      { label: "Rank", beat: "ranked" },
      { label: "Board", beat: "saved" },
      { label: "Prep", beat: "unfold" },
      { label: "Seat", beat: "seat" },
    ],
  },

  hero: {
    pill: "Private beta · 25 designer seats",
    /** Three lines. The last word of line 3 is the serif accent and carries the Line. */
    h1: ["Find the", "right roles.", "Walk in"],
    h1Accent: "ready.",
    h1Full: "Find the right roles. Walk in ready.",
    sub: "Prepline reads every design role on public careers pages, keeps the few that fit your portfolio, and writes your prep sheet the moment an interview is booked.",
    formButton: "Request a seat",
    privacy: "No auto-apply. Your portfolio is never stored.",
    readout: "READING THIS WEEK'S DESIGN ROLES",
    readoutCount: 2340,
    scrollCue: "Scroll to read them",
    lineLabels: ["READING", "2,340 DESIGN ROLES"],
  },

  pass1: {
    from: 2340,
    to: 186,
    statementStart: "design roles read this week",
    statementEnd: "match your level and city",
    detail: "Seniority, location, remote or hybrid, and pay band.",
    lineLabel: "PASS 1 · LEVEL AND CITY",
  },

  pass2: {
    from: 186,
    to: 12,
    statementStart: "match your level and city",
    statementEnd: "fit your portfolio",
    detail: "Each one read against your case studies.",
    lineLabel: "PASS 2 · PORTFOLIO FIT",
  },

  ranked: {
    h2: "Twelve worth your time.",
    body: "Ranked out of 10 by how well each fits your portfolio. The other 2,328 stay out of your way.",
    listHeader: "12 fit your portfolio",
    scoreSuffix: "/10",
    rowHoverFallback: "Reason on the card",
    /** Mobile shows six rows, then this. */
    more: "and 6 more",
    lineLabel: "RANKED",
  },

  reason: {
    h2: "Every score comes with a reason.",
    body: "Read why a role fits before you spend an evening on it.",
    card: {
      title: "Senior Product Designer",
      meta: "Kestrel Health · Bengaluru · Hybrid",
      score: 9,
      scoreLabel: "9/10 fit",
    },
    chips: ["Design-system team", "HealthTech", "Matches your case studies"],
    privacy: "Your portfolio is read to score the role. It is never stored.",
    lineLabel: "9 OUT OF 10",
  },

  daybreak: { lineLabel: "SAVED TO YOUR BOARD" },

  board: {
    h2: "One board. No spreadsheet.",
    title: "Your board",
    columns: ["Saved", "Applied", "Interview", "Offer"],
  },

  saved: {
    step: "Saved. Keep the ones worth a closer look.",
    chip: "Fits your case studies",
    ledger: "12 ranked · 5 saved · 0 applied · 0 sent by Prepline",
    lineLabel: "SAVED",
  },

  applied: {
    step: "Applied. You send it yourself. Prepline never applies for you.",
    chip: "Applied Tue",
    ledger: "12 ranked · 5 saved · 4 applied by you · 0 sent by Prepline",
    lineLabel: "APPLIED BY YOU",
  },

  interview: {
    step: "Interview. Thursday, 11:40. Move the card and the next part starts.",
    chip: "Thu 11:40",
    ledger: "12 ranked · 5 saved · 4 applied by you · 0 sent by Prepline",
    lineLabel: "INTERVIEW BOOKED",
  },

  hinge: {
    sentence: "The moment an interview is booked, your prep sheet is written.",
  },

  nightfall: { lineLabel: "THE NIGHT BEFORE" },

  unfold: {
    label: "THE NIGHT BEFORE",
    h2: "Your interview, already prepped.",
    sheetHeader: {
      title: "Senior Product Designer",
      meta: "Kestrel Health · Interview Thu 11:40",
      score: "9/10 fit",
    },
    lineLabel: "WRITING YOUR PREP SHEET",
  },

  q1: {
    question: "Walk us through how you scaled components across two products.",
    chip: "From the JD: “own the design system”",
    left: "From the job description.",
    leftDetail: "Questions quote the JD, so you know why they are likely.",
    lineLabel: "FROM THE JD",
    /** What the self-running vote demo presses. */
    demoVote: "asked",
  },

  q2: {
    question: "In your family-booking redesign, what did you push back on, and why?",
    chip: "From your case study",
    left: "From your own work.",
    leftDetail: "Your case studies, turned into the questions they invite.",
    lineLabel: "FROM YOUR CASE STUDY",
    demoVote: "not-asked",
  },

  q3: {
    question: "How would you design for patients who distrust lab-results apps?",
    chip: "Asked here before · 4 designers",
    left: "From designers who sat there before.",
    leftDetail: "What this company asked in earlier interviews.",
    lineLabel: "ASKED HERE BEFORE",
    demoVote: "asked",
  },

  votes: {
    label: "THE DAY AFTER",
    h2: "One tap tells us what came up.",
    body: "Asked or not asked. Votes are anonymous, and they make the next designer's sheet sharper.",
    hint: "Try it. The buttons work.",
    asked: "Asked",
    notAsked: "Not asked",
    /** Footer count template: replace {n} and {total}. */
    count: "{n} of {total} asked",
    countDemo: "2 of 3 asked",
    thanks: "Thanks. That makes the next sheet for this company sharper.",
    lineLabel: "THE DAY AFTER",
  },

  dawn: { lineLabel: "READY" },

  seat: {
    h2: "Walk in",
    h2Accent: "ready.",
    h2Full: "Walk in ready.",
    body: "The private beta is open to 25 product and UX designers. Leave your email and we’ll send you an invite.",
    ticketHeader: "PRIVATE BETA · ONE DESIGNER SEAT",
    ticketButton: "Request a seat",
    ticketFoot: "Free during the beta.",
    rings: "25 seats",
    ringCount: 25,
    promises: trust,
    dataNote:
      "To write a prep sheet, the job description and your portfolio text are sent to an AI model. Your email, preferences and board are the only things we keep.",
  },

  footer: {
    left: "Prepline. The job-search copilot for product designers.",
    links: [
      { href: "#board", label: "How it works" },
      { href: "#prep", label: "Prep sheets" },
      { href: "#join", label: "Request a seat" },
      { href: "#join", label: "Privacy" },
    ],
    /** Appended to the visitor's local time, e.g. "11:25 PM. Interview tomorrow?" */
    timeSuffix: "Interview tomorrow?",
    timeFallback: "Interview tomorrow?",
    last: "2,340 read · 12 kept · 0 auto-applied · Figures on this page are illustrative.",
  },

  /** The 12 ranked rows (also exported as `rankedRoles`). */
  roles: rankedRoles,
  role: theRole,

  /**
   * Board ledger, one state per board beat. The last item never shows anything but 0.
   * Rendered as: "{ranked} ranked · {saved} saved · {applied} {appliedLabel} · 0 sent by Prepline".
   */
  ledger: {
    saved: { ranked: 12, saved: 5, applied: 0, appliedLabel: "applied", sentByPrepline: 0 },
    applied: { ranked: 12, saved: 5, applied: 4, appliedLabel: "applied by you", sentByPrepline: 0 },
    interview: { ranked: 12, saved: 5, applied: 4, appliedLabel: "applied by you", sentByPrepline: 0 },
    labels: { ranked: "ranked", saved: "saved", sent: "sent by Prepline" },
    /** Ghost tiles under the Actor: four in Saved, three of them follow it to Applied. */
    ghosts: { saved: 4, applied: 3 },
  },

  /**
   * Reading-lens micro-labels (decorative, aria-hidden). Build one per speck,
   * deterministically from its seed: `${title} · ${city} · ${verdict}`.
   * Before pass 1 every speck reads `unread`. After a pass, dropped specks read
   * a reason from that pass's list and kept specks read `kept`.
   */
  lens: {
    titles: [
      "UX Designer",
      "Product Designer",
      "Senior Product Designer",
      "Visual Designer",
      "Interaction Designer",
      "UX Researcher",
      "Design Lead",
      "Junior UI Designer",
      "Content Designer",
      "Service Designer",
      "Design Systems Designer",
      "Motion Designer",
    ],
    cities: ["Bengaluru", "Gurugram", "Mumbai", "Pune", "Hyderabad", "Chennai", "Noida", "Delhi", "Kochi", "Jaipur", "Remote"],
    unread: "not read yet",
    droppedPass1: ["wrong city", "too junior", "on-site only", "not your level", "below your pay band", "too senior"],
    droppedPass2: ["no case study fits", "different craft", "wrong domain", "research-heavy", "brand, not product"],
    kept: "fits",
    /** The lens fills the nearest ring in Act IV. */
    ring: "open seat",
  },
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * PACKAGE 3 ADDITIONS (Acts III and IV, nav, footer) — strings the storyboard
 * did not spell out. Kept in one marked block so the integrator can review them.
 * ────────────────────────────────────────────────────────────────────────── */
export const pkg3Copy = {
  /** Accessible names for the landmarks (not shown). */
  landmarks: { sections: "Sections", footer: "Footer" },
  sheet: {
    /** Mono label at the top of the prep sheet, and on the outside of the folded sheet. */
    label: "Prep sheet",
    /** Mono label above the three questions. */
    questions: "Likely questions",
  },
  ticket: {
    /** Visible label above the ticket's email field (the hero form keeps it visually hidden). */
    emailLabel: "Email",
    /** The ticket stub. */
    stubLabel: "Seat",
    stubOf: "One of 25",
    /** The stamp pressed onto the ticket after a successful request. */
    stamp: "Seat requested",
  },
} as const;

/** Alias for files that also import the `story` store. */
export { story as storyCopy };

/* ──────────────────────────────────────────────────────────────────────────
 * PACKAGE 2 ADDITIONS (Acts I and II). Strings the storyboard implies but
 * section 2 does not spell out. Added by the Acts I–II builder; review at
 * integration.
 * ────────────────────────────────────────────────────────────────────────── */
export const storyActs12 = {
  reason: {
    /** Mono label above the three reason chips on the card. */
    chipsLabel: "Why it fits",
  },
  board: {
    /** The week strip above the board (the Line rides it; the clock runs along it). */
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    /** Visually hidden name of the strip. */
    daysLabel: "This week, Monday to Friday. The interview is booked on Wednesday for Thursday, 11:40.",
    /** Appended to the board clock at the moment the interview is booked: "WED 16:05 · BOOKED". */
    booked: "Booked",
    /** The flag on the strip at the booked slot, where the Line's right end comes to rest. */
    slot: "Thu 11:40",
  },
} as const;
