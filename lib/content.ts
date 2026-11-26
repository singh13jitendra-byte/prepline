/**
 * PREPLINE COPY — every word on the landing page, in one place.
 *
 * Voice: copy deck B, "the desk at night" (brand/copy-deck.md). The designer's
 * desk at 11 PM: laptop, too many tabs, chai going cold. Second person for the
 * product. The founder's "I" appears only where he signs his name: the seat
 * body, the sign-off, and "Why I'm building this".
 *
 *   import { storyCopy as copy } from "@/lib/content";
 *   <h2>{copy.ranked.h2}</h2>
 *
 * (`story` is also the name of the store in lib/story.ts, so import the copy as
 * `storyCopy`.)
 *
 * House rules
 * - Name the moment, not the benefit. Two beats, not three. No em dashes.
 * - Sentence case everywhere, labels included. Night Desk has no uppercase
 *   micro-labels: a string here is rendered as written.
 * - Every company, role, score and figure (2,340 / 186 / 12, "4 designers") is
 *   an invented illustration, and the page says so: `common.illustrative` on
 *   stages I to III, and the footer's last line.
 * - Nothing is presented as proof. `quotes` is a labelled placeholder and stays
 *   hidden unless real quotes exist (or `?slots=1` in development).
 * - Honesty notes from the deck, applied here: the vote buttons on this page
 *   send nothing and say so; the page counts visits with Vercel Analytics and
 *   never claims "no tracking"; the word "copilot" is gone.
 * - `founder` is a DRAFT in Jitendra's voice for him to edit. `founder.confirm`
 *   lists the details he must check before launch.
 */

export const BETA_SEATS = 25;

export type Match = {
  initials: string;
  title: string;
  company: string;
  city: string;
  mode: string;
  score: number;
  reason: string;
};

/** Rows 1 to 3 of the ranked list. Invented placeholders. */
export const matches: Match[] = [
  {
    initials: "KH",
    title: "Senior Product Designer",
    company: "Kestrel Health",
    city: "Bengaluru",
    mode: "Hybrid",
    score: 9,
    reason: "Design-system team, and close to your booking redesign",
  },
  {
    initials: "PL",
    title: "Product Designer, Design Systems",
    company: "Paisa Labs",
    city: "Gurugram",
    mode: "On-site",
    score: 8,
    reason: "Owns the component library, like your Pulse case study",
  },
  {
    initials: "NC",
    title: "UX Designer, Patient App",
    company: "Northwell Care",
    city: "Remote",
    mode: "Remote",
    score: 8,
    reason: "Patient-facing booking flows, like the one you redesigned",
  },
];

/** The four promises (seat act). Title, then one plain line. */
export const trust = [
  { title: "Your portfolio isn’t kept", body: "It’s read to write your sheet, then thrown away." },
  { title: "Nothing sent in your name", body: "Prepline never applies for you. Not once." },
  { title: "Free during the beta", body: "Founding members get early pricing when it launches." },
  { title: "Votes are anonymous", body: "A vote carries no name and no email." },
];

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
  /** Page metadata (app/layout.tsx). */
  meta: {
    title: "Prepline: design roles ranked by fit, plus prep sheets",
    description:
      "For product and UX designers in India. Design roles scored out of 10 against your portfolio, and a prep sheet when an interview is booked. Private beta.",
    ogTitle: "Close the other tabs. Walk in ready.",
    ogDescription: "Prepline reads careers pages for product and UX designers in India and writes your interview prep. 25 beta seats.",
  },

  /** Shared, not tied to one beat. */
  common: {
    illustrative: "Illustrative data",
    cta: "Save me a seat",
    ctaSending: "Saving your seat…",
    emailPlaceholder: "you@email.com",
    success: "You’re on the list. I’ll email you when your seat is ready.",
    skipLink: "Skip to the sign-up",
    /** Visually hidden sentence that stands in for the three animated counters. */
    figuresForScreenReaders:
      "Illustrative example: 2,340 design roles read this week. 186 match your level and city. 12 fit your portfolio.",
    figures: { read: 2340, level: 186, fit: 12, dropped: 2328, seats: 25 },
  },

  /**
   * NEW (round 4). The waitlist form, every state (deck 3.1). Used by the hero
   * form and the ticket. `{email}` is replaced with what the visitor typed.
   */
  form: {
    label: "Your email",
    placeholder: "you@email.com",
    /** Ticket only, under the field. */
    helper: "Only used for your beta invite and updates.",
    button: "Save me a seat",
    sending: "Saving your seat…",
    /** Live region while the request is in flight. */
    sendingStatus: "Sending your request.",
    empty: "Add your email first.",
    invalid: "That doesn’t look like an email yet. Check the @ and the part after it.",
    success: "You’re on the list. I’ll email you when your seat is ready.",
    /** Ticket, under the stamp. The address is shown back so a typo is caught. */
    successFor: "Requested for {email}.",
    wrongAddress: "Wrong address?",
    edit: "Edit it.",
    /** The API answered { ok: true, duplicate: true }. */
    duplicate: "You’re already on the list. Nothing else to do.",
    error: "That didn’t go through. The problem is on our side, not yours. Try again in a minute.",
    /** navigator.onLine is false before the request. */
    offline: "You seem to be offline. Your email is still here. Try again once you’re back.",
  },

  nav: {
    brand: "Prepline",
    links: [
      { href: "#board", label: "How it works" },
      { href: "#prep", label: "Prep sheets" },
      { href: "#join", label: "Privacy" },
    ],
    cta: "Save me a seat",
    /** The CTA once a seat is saved this session ({seat} is the seat number). */
    ctaSaved: "Seat saved",
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
    pill: "Private beta · 25 seats for designers",
    /** Three lines. The accent word ends line 3 and carries the Line. */
    h1: ["Close the", "other tabs.", "Walk in"],
    h1Accent: "ready.",
    h1Full: "Close the other tabs. Walk in ready.",
    sub: "Prepline reads public careers pages and keeps the design roles that fit your portfolio, each with a reason you can check. When an interview is booked, your prep sheet is already written.",
    formButton: "Save me a seat",
    privacy: "Nothing is sent in your name. Your portfolio isn’t kept.",
    readout: "Reading careers pages",
    readoutCount: 2340,
    scrollCue: "Scroll to read along",
    lineLabels: ["Reading", "2,340 roles"],
    /** NEW. A margin note on the desk scene (Shantell, decorative). */
    timeNote: "11:25 PM",
    /** NEW. Visually hidden description of the laptop screen in the hero scene. */
    screenLabel: "Prepline on the laptop: a short list of design roles, each with a score out of 10.",
  },

  pass1: {
    from: 2340,
    to: 186,
    statementStart: "design roles read this week",
    statementEnd: "at your level, in your city",
    detail: "Too junior, too senior, wrong city or five days on-site: set aside.",
    lineLabel: "Level · city",
  },

  pass2: {
    from: 186,
    to: 12,
    statementStart: "at your level, in your city",
    statementEnd: "fit your portfolio",
    detail: "Each one read against the case studies you’d actually show.",
    lineLabel: "Portfolio fit",
  },

  ranked: {
    h2: "Twelve worth an evening.",
    body: "Scored out of 10 against your portfolio. The other 2,328 never reach your screen.",
    listHeader: "12 fit your portfolio",
    scoreSuffix: "/10",
    rowHoverFallback: "Open it for the reason",
    /** Mobile shows six rows, then this. */
    more: "6 more",
    lineLabel: "Ranked",
  },

  reason: {
    h2: "Every score shows its working.",
    body: "See why a role fits before you spend Sunday reordering your case studies for it.",
    card: {
      title: "Senior Product Designer",
      meta: "Kestrel Health · Bengaluru · Hybrid",
      score: 9,
      scoreLabel: "9/10 fit",
    },
    chipsLabel: "Why it fits",
    chips: ["Design-system team", "HealthTech, like your last role", "Close to your booking redesign"],
    privacy: "Your portfolio is read to score this. It isn’t stored.",
    lineLabel: "Why 9/10",
    /** NEW. Margin note beside the card (Shantell, decorative; twelve words at most). */
    note: "A 6 is worth a look. A 9 is worth an evening.",
  },

  daybreak: { lineLabel: "To your board" },

  board: {
    h2: "One board. The spreadsheet can rest.",
    title: "Your board",
    columns: ["Saved", "Applied", "Interview", "Offer"],
    /** The week strip above the board (the Line rides it; the clock runs along it). */
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    /** Visually hidden name of the strip. */
    daysLabel: "This week, Monday to Friday. The interview is booked on Wednesday for Thursday, 11:40.",
    /** Appended to the board clock at the moment the interview is booked: "Wed 16:05 · Booked". */
    booked: "Booked",
    /** The flag on the strip at the booked slot, where the Line's right end comes to rest. */
    slot: "Thu 11:40",
  },

  saved: {
    step: "Saved. The ones you’d open again tomorrow.",
    chip: "Fits your case studies",
    ledger: "12 ranked · 5 saved · 0 applied · 0 sent by Prepline",
    lineLabel: "Saved",
  },

  applied: {
    step: "Applied. You hit send. Prepline never does.",
    chip: "Applied Tue",
    ledger: "12 ranked · 5 saved · 4 applied by you · 0 sent by Prepline",
    lineLabel: "By you",
  },

  interview: {
    step: "Interview, Thursday 11:40. Move the card and Prepline starts on your prep.",
    chip: "Thu 11:40",
    ledger: "12 ranked · 5 saved · 4 applied by you · 0 sent by Prepline",
    lineLabel: "Booked",
  },

  hinge: {
    sentence: "Book the interview, and your prep sheet is written before you’ve told anyone.",
  },

  nightfall: { lineLabel: "The night before" },

  unfold: {
    label: "Wednesday · 11:25 PM",
    h2: "Open the laptop. It’s already written.",
    sheetHeader: {
      title: "Senior Product Designer",
      meta: "Kestrel Health · Interview Thu 11:40",
      score: "9/10 fit",
    },
    /** The label at the top of the sheet, and the label above the questions. */
    sheetLabel: "Prep sheet",
    questionsLabel: "Likely questions",
    lineLabel: "Writing",
  },

  q1: {
    question: "Walk us through how you scaled one component library across two products.",
    chip: "From the JD: “own the design system”",
    left: "From the JD.",
    leftDetail: "Each question quotes the job post, so you can see why it’s likely.",
    lineLabel: "From the JD",
    /** What the self-running vote demo presses. */
    demoVote: "asked",
  },

  q2: {
    question: "Tell us about a time you pushed back in your family-booking redesign. What happened?",
    chip: "From your case study",
    left: "From your own work.",
    leftDetail: "Your case studies, read the way an interviewer reads them.",
    lineLabel: "Your case study",
    demoVote: "not-asked",
  },

  q3: {
    question: "How would you design for patients who don’t trust lab-results apps?",
    chip: "Asked here before · 4 designers",
    left: "From people who sat in that chair.",
    leftDetail: "What this company asked designers before you.",
    lineLabel: "Asked here before",
    demoVote: "asked",
  },

  votes: {
    label: "Thursday · 1:10 PM",
    h2: "One tap on the metro home.",
    body: "Mark each question asked or not asked. Votes carry no name, and they make the next designer’s sheet for this company better.",
    /** The buttons on this page are a local demo: nothing leaves the browser, and the copy says so. */
    hint: "Go on, press one. Nothing is sent from this page.",
    asked: "Asked",
    notAsked: "Not asked",
    /** Footer count template: replace {n} and {total}. */
    count: "{n} of {total} asked",
    countDemo: "2 of 3 asked",
    /** Shown after the visitor's first real press. */
    thanks: "That’s the whole job. In the beta, it helps the next designer here.",
    lineLabel: "Afterwards",
    /** NEW. Accessible name of each vote group, and what a press announces ({n} = asked so far). */
    groupLabel: "Was this question asked?",
    announceAsked: "Marked as asked. {n} of 3 asked.",
    announceNotAsked: "Marked as not asked. {n} of 3 asked.",
    announceRemoved: "Vote removed. {n} of 3 asked.",
    /** Announced once, on the first real press. */
    announceFirst: "Thanks. This is a demo, so nothing was sent.",
  },

  dawn: { lineLabel: "Ready" },

  seat: {
    h2: "Walk in",
    h2Accent: "ready.",
    h2Full: "Walk in ready.",
    /** The founder speaks here, in the first person. */
    body: "I’m opening 25 seats to product and UX designers in India. Leave your email and I’ll write to you myself when yours is ready.",
    ticketHeader: "Private beta · one seat",
    ticketButton: "Save me a seat",
    ticketFoot: "Free while it’s in beta.",
    /** NEW. The ticket's field label, stub and stamp. */
    ticketEmailLabel: "Your email",
    stubLabel: "Seat",
    stubOf: "One of 25",
    stamp: "Seat requested",
    /**
     * NEW (delight 8). The rubber stamp's ink impression on the ticket after a request, and the
     * seated nav. `{n}` is the seat filled on the stub (the centre ring), `{total}` the 25 seats.
     * The number names the ring on this ticket, never a count of other sign-ups.
     */
    stampSaved: "Seat saved",
    stampSeat: "Private beta",
    /** A gentler stamp when the API says the address is already on the list. */
    stampAlready: "Already saved",
    /** Live region, after the success line: what the stamp says, for screen readers. */
    stampLive: "Stamped: seat saved for the private beta.",
    rings: "25 seats",
    /** NEW. The filled ring is the visitor's own request, never a live count of other sign-ups. */
    ringsLabel: "25 beta seats. The filled ring marks your request.",
    ringCount: 25,
    promises: trust,
    /** The short privacy note under the promises. */
    dataNote:
      "To write a prep sheet, the job description and your portfolio text are sent to an AI model, then discarded. We keep your email, your preferences and your board. Votes carry no name or email.",
  },

  /**
   * NEW (round 4). "Why I'm building this": the founder's story at three
   * lengths. DRAFT for Jitendra to edit, written in his voice from facts he
   * has stated. Do not add an outcome (an offer, a hire) unless it happened.
   * "Four years" is the product design figure; "about eight" is tech overall.
   */
  founder: {
    draft: true,
    /** Details he must confirm or replace before launch. */
    confirm: ["“a dozen tabs” (how many it really was)", "the photo, and the portfolio and LinkedIn links"],
    title: "Why I’m building this",
    /** 1 line: the sign-off under the seat body. Set in body type, never in the hand-written face. */
    line: "I built this for my own job search, then tidied it up for yours.",
    signature: "Jitendra, product designer, Gurugram",
    /** About 60 words: the footer's left column, or under the promises on mobile. */
    short:
      "I’m Jitendra, a product designer in Gurugram. I spent four years in HealthTech, where I led the redesign of the diagnostic test-booking flow in Dr Lal PathLabs’ patient app. When I started looking for my next role, I built two small tools for myself: one ranks job posts against my portfolio, the other writes my interview prep. Prepline joins them.",
    /** About 150 words, as paragraphs: the note after the seat stage (anchor `founder-note`). */
    long: [
      "I’m Jitendra Singh. I’ve been a product designer for four years and in tech for about eight. Most recently I was at Dr Lal PathLabs, where I led the redesign of the patient app’s diagnostic test-booking flow.",
      "When I started looking for my next role, the search turned into a second job. Careers pages open in a dozen tabs. A Notion tracker that grew a row every evening.",
      "So I built two things for myself. A nightly script reads public job listings, scores each role out of 10 for fit, and files it to my tracker. A small web tool takes a company and a role and writes the questions they’ll likely ask, plus a few openers for the small talk before it starts.",
      "Prepline joins the two, for product and UX designers in India. It’s in private beta. Tell me what’s wrong with it.",
    ],
    /** Alt text for the small crop of the desk beside the note. */
    imageAlt: "A desk at night: a lamp, a laptop, a mug.",
    links: { portfolio: "Portfolio", linkedin: "LinkedIn" },
  },

  /**
   * NEW (round 4). The quote slot. A PLACEHOLDER: do not render it unless
   * `items` has been replaced with real beta feedback (set `real: true` then),
   * or the URL has ?slots=1, in which case `label` must be visible on every
   * quote. Never in the hero.
   */
  quotes: {
    real: false,
    label: "Sample quote. Replace with beta feedback.",
    items: [
      {
        quote: "The watch-outs told me the role was five days on-site before I’d spent an evening on the application.",
        name: "Beta designer name",
        role: "Product Designer, City",
      },
      {
        quote: "Two of the questions on my sheet came up almost word for word.",
        name: "Beta designer name",
        role: "UX Designer, City",
      },
    ],
  },

  /**
   * NEW (round 4). The long privacy note (the Privacy link). The page loads
   * Vercel Analytics, so it never says "no tracking". Before launch: name the
   * AI model provider in `notKept`, add a contact address to `remove`, and
   * check the cookieless wording against Vercel's current docs.
   */
  privacy: {
    title: "What Prepline keeps, and what it doesn’t",
    kept: { label: "Kept", body: "Your email, your job preferences (level, city, work mode), and the roles on your board." },
    notKept: {
      label: "Not kept",
      body: "Your portfolio and resume text. They’re sent to an AI model to write one prep sheet and are not stored by Prepline afterwards.",
    },
    votes: { label: "Votes", body: "“Asked” and “not asked” are stored without your name or email. On this page they are a demo: nothing is sent." },
    never: { label: "Never", body: "Prepline doesn’t apply, email or message anyone on your behalf." },
    analytics: "This page counts visits with Vercel Analytics, which doesn’t use cookies.",
    remove: "To have your email removed, reply to your invite email.",
    todo: ["name the AI model provider", "add a contact address for removal requests", "confirm the Vercel Analytics wording"],
  },

  footer: {
    left: "Prepline. Made in Gurugram by a product designer, for product designers.",
    links: [
      { href: "#board", label: "How it works" },
      { href: "#prep", label: "Prep sheets" },
      { href: "#join", label: "Save me a seat" },
      { href: "#join", label: "Privacy" },
    ],
    /** Appended to the visitor's local time, e.g. "11:25 PM. Close the laptop. The sheet will keep." */
    timeSuffix: "Close the laptop. The sheet will keep.",
    timeFallback: "Close the laptop. The sheet will keep.",
    last: "2,340 read · 12 kept · 0 auto-applied · Figures on this page are illustrative.",
    /** Accessible names for the landmarks (not shown). */
    landmark: "Footer",
    sectionsLandmark: "Sections",
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
   * Reading-lens labels over the firefly field (decorative, aria-hidden). Build one per
   * firefly, deterministically from its seed: `${title} · ${city} · ${verdict}`.
   * Before pass 1 every one reads `unread`. After a pass, dropped ones read a reason
   * from that pass's list and kept ones read `kept`.
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
    droppedPass1: ["wrong city", "too junior", "too senior", "five days on-site", "not your level", "below your pay band"],
    droppedPass2: ["no case study fits", "a different craft", "wrong domain", "mostly research", "brand, not product"],
    kept: "fits",
    /** The lens fills the nearest ring in Act IV. */
    ring: "open seat",
  },

  /**
   * The lantern cursor (components/world/Lantern.tsx; decorative, aria-hidden). A resting pointer
   * names the nearest firefly: `${role} · ${score}` over one of these notes. The reasons a role
   * was set aside come from `lens.droppedPass1` / `lens.droppedPass2`.
   */
  lantern: {
    keptFit: "kept · fits your portfolio",
    keptLevel: "kept · at your level, in your city",
    aside: "set aside",
    /** Once per session, after a still moment in the meadow. */
    hint: "hover a firefly",
  },
} as const;

/** The copy, under a name that does not collide with the `story` store. */
export { story as storyCopy };

/**
 * @deprecated Round-2 block, kept so existing imports compile. The strings now
 * live in `story` (seat.ticketEmailLabel / stubLabel / stubOf / stamp,
 * unfold.sheetLabel / questionsLabel, footer.landmark / sectionsLandmark).
 */
export const pkg3Copy = {
  landmarks: { sections: story.footer.sectionsLandmark, footer: story.footer.landmark },
  sheet: { label: story.unfold.sheetLabel, questions: story.unfold.questionsLabel },
  ticket: {
    emailLabel: story.seat.ticketEmailLabel,
    stubLabel: story.seat.stubLabel,
    stubOf: story.seat.stubOf,
    stamp: story.seat.stamp,
  },
} as const;

/**
 * @deprecated Round-2 block, kept so existing imports compile. The strings now
 * live in `story` (reason.chipsLabel, board.days / daysLabel / booked / slot).
 */
export const storyActs12 = {
  reason: { chipsLabel: story.reason.chipsLabel },
  board: {
    days: story.board.days,
    daysLabel: story.board.daysLabel,
    booked: story.board.booked,
    slot: story.board.slot,
    /**
     * PACKAGE 2 (Acts I–II): short role names for the small tiles on the board (rank → title), so a
     * tile never cuts a word. Product content, not voice copy; review at integration.
     */
    ghostTitles: { 2: "Design Systems Designer", 3: "UX Designer, Patient App", 4: "Growth Designer", 5: "Senior UX Designer" } as Record<number, string>,
  },
} as const;
