/**
 * THE FIREFLIES' JOBS: every hero firefly in the explore stop is one role in the market.
 *
 * Every company, role and number here is an invented placeholder, in the voice of
 * components/product/data.ts. Nothing is a real posting.
 *
 *   kept (12)       the ranked roles of components/product/data.ts: same ids (`role-1` … `role-12`),
 *                   titles, companies, cities, modes and scores, read from `roles` so they cannot
 *                   drift. Posted age is the product's "found" time.
 *   set aside (36)  roles the two reading passes dropped. Every one scores 5 or lower, so
 *                   "12 fit your portfolio" stays true (FIT_LINE), and every one says why in `gap`.
 *                   The first four are the product's own `cutRoles`.
 *
 * The scoring model is the product's: portfolio fit (4) + domain (2) + level and city (4) = 10.
 * The person these are scored for has two case studies, "Pulse" (a design system) and
 * "Family booking" (a test-booking redesign), is senior, works in HealthTech and asked for hybrid.
 *
 * Copy rules (lib/content.ts): sentence case, no em dashes, plain reasons that can be checked
 * against the posting. Interface strings for the card and the list are in `fireflyCardCopy`;
 * move them into lib/content.ts when the explore stop joins the story.
 */

import { roles } from "@/components/product/data";

export type FireflyJob = {
  id: string;
  title: string;
  company: string;
  /** A real Indian city, or "Remote" when the posting names none. */
  city: string;
  mode: "On-site" | "Hybrid" | "Remote";
  /** "Senior" | "Mid" | "Junior" | "Lead". Say it with `levelLine`. */
  level: string;
  /** Relative age of the posting: "2h", "3d", "1w". Say it with `postedLine`. */
  posted: string;
  /** Annual band in lakh rupees, when the posting lists one. */
  salary?: string;
  /** 0–10. */
  fit: number;
  /** 2–3 lines, each under the part of the score it explains. */
  reasons: { label: string; text: string }[];
  /** The honest catch. For a role that was set aside, the reason it was. */
  gap?: string;
  /** Where the posting was read, e.g. "Careers page". */
  source: string;
};

/** A role fits at 6 and up: the twelve that are ranked. Everything below was set aside. */
export const FIT_LINE = 6;
export const jobFits = (job: FireflyJob) => job.fit >= FIT_LINE;

const band = (lo: number, hi: number) => `₹${lo}–${hi} LPA`;

const P = "Portfolio fit";
const D = "Domain";
const L = "Level and city";

const CAREERS = "Careers page";
const HIRING = "Team hiring page";
const ATS = "Public ATS listing";

/* ── the twelve that fit ───────────────────────────────────────────────── */

type KeptCopy = { salary?: string; portfolio: string; domain: string; levelCity: string; gap: string; source: string };

/** By rank. Two postings list no band, and say so in the gap. */
const KEPT: Record<number, KeptCopy> = {
  1: {
    salary: band(30, 42),
    portfolio: "Design-system team: matches your Pulse case study.",
    domain: "Patient-facing flows: close to your booking redesign.",
    levelCity: "Senior, hybrid in Bengaluru. One more office day than you asked for.",
    gap: "Mentions motion design, and none of your case studies show it.",
    source: CAREERS,
  },
  2: {
    salary: band(22, 30),
    portfolio: "Owns the component library: your Pulse work fits.",
    domain: "Fintech. A domain you haven’t shipped in yet.",
    levelCity: "Mid-level title with senior scope, in Gurugram.",
    gap: "Five days on-site. You asked for hybrid.",
    source: CAREERS,
  },
  3: {
    salary: band(20, 28),
    portfolio: "Patient booking flows, like your Family booking redesign.",
    domain: "HealthTech, like your last role.",
    levelCity: "Fully remote. The title is a level below yours.",
    gap: "No design-system work in the posting.",
    source: HIRING,
  },
  4: {
    salary: band(18, 26),
    portfolio: "Onboarding experiments: close to your booking funnel.",
    domain: "Payments. A domain you haven’t shipped in yet.",
    levelCity: "Mid-level, hybrid in Mumbai.",
    gap: "Asks for A/B test ownership. Your case studies show one test.",
    source: CAREERS,
  },
  5: {
    salary: band(28, 38),
    portfolio: "Research-led flows. Family booking shows your research.",
    domain: "HealthTech, like your last role.",
    levelCity: "Senior, hybrid in Pune.",
    gap: "Lighter on systems work than Pulse.",
    source: CAREERS,
  },
  6: {
    portfolio: "Settings and tables for B2B: Pulse components apply.",
    domain: "Developer tools. A domain you haven’t shipped in yet.",
    levelCity: "Fully remote. Scope is a step below your level.",
    gap: "The posting lists no pay band.",
    source: ATS,
  },
  7: {
    salary: band(24, 32),
    portfolio: "Design-system work like Pulse, for a shopping app.",
    domain: "E-commerce. A domain you haven’t shipped in yet.",
    levelCity: "Mid-level, hybrid in Gurugram.",
    gap: "No patient-facing flows, which are your strongest work.",
    source: CAREERS,
  },
  8: {
    salary: band(16, 22),
    portfolio: "Test booking and reports: the flows in Family booking.",
    domain: "Diagnostics, the domain you know best.",
    levelCity: "Mid-level, on-site in Hyderabad.",
    gap: "Five days on-site, and a level below yours.",
    source: CAREERS,
  },
  9: {
    salary: band(18, 24),
    portfolio: "Onboarding flows fit your booking redesign.",
    domain: "Fintech. A domain you haven’t shipped in yet.",
    levelCity: "Mid-level, hybrid in Mumbai.",
    gap: "KYC and compliance steps are new to you.",
    source: ATS,
  },
  10: {
    portfolio: "Interaction-heavy: your booking prototypes are relevant.",
    domain: "Mobility. A domain you haven’t shipped in yet.",
    levelCity: "Mid-level, on-site in Chennai.",
    gap: "Five days on-site, and no pay band listed.",
    source: CAREERS,
  },
  11: {
    salary: band(28, 36),
    portfolio: "Dashboards and tables: Pulse components carry over.",
    domain: "B2B support tools. Fewer patient flows.",
    levelCity: "Senior, hybrid in Noida.",
    gap: "No consumer flows, which are your strongest work.",
    source: HIRING,
  },
  12: {
    salary: band(14, 20),
    portfolio: "Lesson booking overlaps with Family booking.",
    domain: "Edtech. A domain you haven’t shipped in yet.",
    levelCity: "Fully remote, at mid-level scope.",
    gap: "The band stops below your current pay.",
    source: CAREERS,
  },
};

const kept: FireflyJob[] = roles.map((role) => {
  const c = KEPT[role.rank];
  return {
    id: role.id,
    title: role.title,
    company: role.company,
    city: role.city,
    mode: role.mode,
    level: role.level,
    posted: role.found,
    salary: c.salary,
    fit: role.score,
    reasons: [
      { label: P, text: c.portfolio },
      { label: D, text: c.domain },
      { label: L, text: c.levelCity },
    ],
    gap: c.gap,
    source: c.source,
  };
});

/* ── set aside ─────────────────────────────────────────────────────────── */

type Aside = [
  title: string,
  company: string,
  city: string,
  mode: FireflyJob["mode"],
  level: "Senior" | "Mid" | "Junior" | "Lead",
  fit: number,
  posted: string,
  salary: string | undefined,
  portfolio: string,
  domain: string,
  levelCity: string,
  /** Why it was set aside. */
  gap: string,
  source: string,
];

/** Hand-written, so each one reads like a real decision. Rows 1 to 4 are the product's `cutRoles`. */
const ASIDE: Aside[] = [
  ["UI Designer", "Tallybook", "Pune", "Hybrid", "Junior", 3, "3h", band(7, 10),
    "Visual polish on set screens. Your case studies are flows and systems.", "Accounts for small shops. New to you.", "Junior, hybrid in Pune.",
    "Too junior: two levels below yours.", CAREERS],
  ["Product Designer", "Loomcart", "Chennai", "On-site", "Mid", 4, "6h", band(16, 22),
    "Checkout flows: some overlap with Family booking.", "E-commerce. A domain you haven’t shipped in yet.", "Mid-level, in Chennai.",
    "Five days on-site. You asked for hybrid.", CAREERS],
  ["UX Researcher", "Meridian Diagnostics", "Mumbai", "Hybrid", "Senior", 4.5, "1d", band(24, 32),
    "A research role. You would ship no screens.", "Diagnostics, the domain you know best.", "Senior, hybrid in Mumbai.",
    "No case study fits: neither one is research only.", CAREERS],
  ["Brand Designer", "Fernway", "Remote", "Remote", "Mid", 2, "1d", undefined,
    "Identity and campaign work. No product flows.", "Outdoor gear. A long way from patient-facing work.", "Mid-level and remote.",
    "Brand, not product design.", HIRING],
  ["Design Lead", "Kulhad Labs", "Bengaluru", "Hybrid", "Lead", 4, "2d", band(44, 58),
    "Systems thinking fits Pulse. The job is leading eight designers.", "Restaurant tools. New to you.", "Lead, hybrid in Bengaluru.",
    "Too senior: two levels up, and mostly managing.", CAREERS],
  ["Motion Designer", "Lattu Games", "Hyderabad", "On-site", "Mid", 2, "2d", band(12, 18),
    "Motion and game feel. None of your case studies show it.", "Mobile games. A long way from health.", "Mid-level, on-site in Hyderabad.",
    "A different craft from product design.", ATS],
  ["Product Designer, Payments", "Rangoli Pay", "Mumbai", "On-site", "Senior", 5, "5h", band(28, 36),
    "Onboarding flows are close to your booking redesign.", "Payments. Compliance is new to you.", "Senior, in Mumbai.",
    "Five days on-site. You asked for hybrid.", CAREERS],
  ["Visual Designer", "Zari Retail", "Delhi", "Hybrid", "Mid", 3, "3d", band(12, 16),
    "Campaign pages and lookbooks, not product flows.", "Fashion retail. New to you.", "Mid-level, hybrid in Delhi.",
    "Brand and marketing work, not product.", CAREERS],
  ["Service Designer", "Baithak Works", "Pune", "Hybrid", "Senior", 4, "4d", undefined,
    "Workshops and service blueprints. Few shipped screens.", "Consulting across sectors, with some health clients.", "Senior, hybrid in Pune.",
    "No case study fits: neither shows service design.", HIRING],
  ["Content Designer", "Kolam Docs", "Remote", "Remote", "Mid", 3, "2d", band(14, 20),
    "A writing role. Your case studies are interaction work.", "Document tools. New to you.", "Mid-level and remote.",
    "A different craft: content, not flows.", CAREERS],
  ["Junior UI Designer", "Kanche Kids", "Bengaluru", "On-site", "Junior", 2, "9h", band(6, 9),
    "Production UI for a kids’ app. Little room for flows.", "Learning games. A long way from health.", "Junior, on-site in Bengaluru.",
    "Too junior: two levels below yours.", ATS],
  ["Product Designer, Games", "Gilli Play", "Hyderabad", "Hybrid", "Mid", 3, "5d", band(16, 22),
    "Game economy screens. Far from your case studies.", "Gaming. A long way from patient-facing work.", "Mid-level, hybrid in Hyderabad.",
    "Wrong domain: no case study comes close.", CAREERS],
  ["UX Designer, Logistics", "Thoni Freight", "Kochi", "On-site", "Mid", 4, "1w", band(14, 18),
    "Dispatch dashboards: some overlap with Pulse tables.", "Freight. A domain you haven’t shipped in yet.", "Mid-level, on-site in Kochi.",
    "Kochi isn’t on your list of cities.", CAREERS],
  ["Senior UX Designer", "Nimbu Ledger", "Jaipur", "On-site", "Senior", 4, "3d", band(22, 28),
    "Ledger flows for small shops. Onboarding is close.", "Bookkeeping. New to you.", "Senior, on-site in Jaipur.",
    "Jaipur isn’t on your list of cities.", CAREERS],
  ["Product Designer", "Imli Cloud", "Remote", "Remote", "Senior", 5, "1d", band(16, 20),
    "Component work like Pulse, for a developer tool.", "Cloud tooling. New to you.", "Senior and remote.",
    "The band stops below your current pay.", ATS],
  ["Interaction Designer", "Bansuri Audio", "Kochi", "On-site", "Mid", 3, "6d", undefined,
    "A hardware companion app. Interaction heavy, small scope.", "Consumer audio. A long way from health.", "Mid-level, on-site in Kochi.",
    "Kochi isn’t on your list, and no band is listed.", CAREERS],
  ["Design Systems Designer", "Gully Grid", "Ahmedabad", "On-site", "Senior", 5, "8h", band(26, 34),
    "Owns a component library. Your Pulse work fits well.", "City mapping tools. New to you.", "Senior, in Ahmedabad.",
    "Five days on-site, in a city you didn’t list.", CAREERS],
  ["UX Designer", "Tiffin Loop", "Kolkata", "Hybrid", "Mid", 4, "4d", band(12, 18),
    "Meal subscriptions. The booking logic is loosely related.", "Food delivery. New to you.", "Mid-level, hybrid in Kolkata.",
    "A level below yours, in a city you didn’t list.", ATS],
  ["Product Design Manager", "Chajja Homes", "Gurugram", "Hybrid", "Lead", 4, "2d", band(42, 55),
    "People management first. Little hands-on design.", "Home rentals. New to you.", "Manager, hybrid in Gurugram.",
    "Too senior: you would manage, not design.", CAREERS],
  ["Associate Product Designer", "Ginti Learn", "Noida", "Hybrid", "Junior", 3, "1d", band(8, 12),
    "Lesson screens built from set templates.", "Edtech. New to you.", "Associate, hybrid in Noida.",
    "Too junior: two levels below yours.", CAREERS],
  ["UX Designer, Wellness", "Mogra Wellness", "Remote", "Remote", "Mid", 5, "3d", band(12, 16),
    "Habit tracking flows, near patient-facing work.", "Wellness. Close to health, not clinical.", "Mid-level and remote.",
    "The band stops below your current pay.", HIRING],
  ["Product Designer, Agritech", "Sarson Agri", "Indore", "On-site", "Mid", 3, "1w", undefined,
    "Field tools for crop buyers. Offline-first is new to you.", "Agritech. A domain you haven’t shipped in yet.", "Mid-level, on-site in Indore.",
    "Indore isn’t on your list of cities.", CAREERS],
  ["UX Writer", "Takhti Notes", "Remote", "Remote", "Mid", 2, "5d", band(10, 14),
    "Microcopy and help centre articles.", "Note-taking. New to you.", "Mid-level and remote.",
    "A different craft: writing, not product design.", CAREERS],
  ["Senior Visual Designer", "Anaar Analytics", "Bengaluru", "Hybrid", "Senior", 4, "2d", band(24, 30),
    "Chart styling and data visualisation. No flows to own.", "Analytics. New to you.", "Senior, hybrid in Bengaluru.",
    "No case study fits: neither is visual-led.", ATS],
  ["Product Designer, Lending", "Elaichi Credit", "Mumbai", "On-site", "Senior", 5, "11h", band(28, 38),
    "Loan application flows, close to your booking work.", "Lending. Compliance is new to you.", "Senior, in Mumbai.",
    "Five days on-site. You asked for hybrid.", CAREERS],
  ["UX Researcher, Clinics", "Ajwain Care", "Pune", "Hybrid", "Senior", 5, "1d", band(22, 30),
    "Field research in clinics. You would ship no screens.", "HealthTech, like your last role.", "Senior, hybrid in Pune.",
    "Mostly research. Your case studies are shipped flows.", CAREERS],
  ["Product Designer, Travel", "Dhurrie Trips", "Delhi", "Hybrid", "Mid", 4, "6d", band(16, 22),
    "Trip planning. Booking is close to your redesign.", "Travel. A domain you haven’t shipped in yet.", "Mid-level, hybrid in Delhi.",
    "A level below yours, in a new domain.", CAREERS],
  ["Head of Design", "Genda Rx", "Hyderabad", "Hybrid", "Lead", 3, "2w", undefined,
    "Sets hiring and budget. Almost no hands-on design.", "Online pharmacy. Close to health.", "Head of design, hybrid in Hyderabad.",
    "Too senior: three levels above yours.", HIRING],
  ["UI Designer, Kiosks", "Surahi Water", "Chandigarh", "On-site", "Junior", 2, "1w", band(6, 9),
    "Kiosk screens from a fixed template.", "Water vending. A long way from health.", "Junior, on-site in Chandigarh.",
    "Too junior, in a city you didn’t list.", CAREERS],
  ["Product Designer, EV", "Phirki Mobility", "Chennai", "On-site", "Mid", 4, "3d", band(18, 24),
    "Charging and trip flows. New ground for you.", "Electric mobility. New to you.", "Mid-level, in Chennai.",
    "Five days on-site. You asked for hybrid.", ATS],
  ["UX Designer, Stays", "Chabutra Stays", "Jaipur", "Remote", "Mid", 5, "4d", band(14, 20),
    "Host tools and listings. Booking is the only overlap.", "Travel stays. New to you.", "Mid-level and remote. The team sits in Jaipur.",
    "No case study fits host tools closely.", CAREERS],
  ["Design Technologist", "Sandook Storage", "Bengaluru", "Hybrid", "Senior", 4, "5d", band(26, 34),
    "Mostly front-end code. Prototypes, not flows.", "Storage rentals. New to you.", "Senior, hybrid in Bengaluru.",
    "A different craft: building, not designing.", CAREERS],
  ["Product Designer, Energy", "Angeethi Energy", "Ahmedabad", "Hybrid", "Mid", 3, "1w", undefined,
    "Solar monitoring dashboards for installers.", "Energy. A long way from patient-facing work.", "Mid-level, hybrid in Ahmedabad.",
    "Wrong domain, in a city you didn’t list.", CAREERS],
  ["Illustrator, Product", "Karonda Foods", "Remote", "Remote", "Mid", 2, "2w", band(8, 12),
    "Spot illustrations and packaging.", "Packaged foods. A long way from health.", "Mid-level and remote.",
    "A different craft: illustration, not product design.", HIRING],
  ["Senior Product Designer", "Saunf Health", "Kochi", "On-site", "Senior", 5, "7h", band(26, 34),
    "Clinic booking, close to your Family booking redesign.", "HealthTech, like your last role.", "Senior, in Kochi.",
    "Five days on-site, in a city you didn’t list.", CAREERS],
  ["UX Designer", "Neem Street Health", "Kolkata", "On-site", "Mid", 5, "2d", band(14, 18),
    "Patient records screens. A good domain match.", "HealthTech, like your last role.", "Mid-level, in Kolkata.",
    "Five days on-site, and a level below yours.", CAREERS],
];

const aside: FireflyJob[] = ASIDE.map(
  ([title, company, city, mode, level, fit, posted, salary, portfolio, domain, levelCity, gap, source], i) => ({
    id: `job-a${i + 1}`,
    title,
    company,
    city,
    mode,
    level,
    posted,
    salary,
    fit,
    reasons: [
      { label: P, text: portfolio },
      { label: D, text: domain },
      { label: L, text: levelCity },
    ],
    gap,
    source,
  }),
);

/** All 48: the twelve that fit in rank order, then the ones set aside in the order they were read. */
export const FIREFLY_JOBS: FireflyJob[] = [...kept, ...aside];

/** Highest fit first. Stable, so the twelve keep their rank order and ties keep reading order. */
export function byFit(jobs: readonly FireflyJob[]): FireflyJob[] {
  return jobs.map((job, i) => ({ job, i })).sort((a, b) => b.job.fit - a.job.fit || a.i - b.i).map((x) => x.job);
}

/* ── how a job is said ─────────────────────────────────────────────────── */

export const fmtFit = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "Kestrel Health · Bengaluru · Hybrid" as parts. A remote role with no city says "Remote" once. */
export function whereParts(job: FireflyJob): string[] {
  return job.city === job.mode ? [job.company, job.mode] : [job.company, job.city, job.mode];
}

/** "Posted 2h ago". */
export const postedLine = (job: FireflyJob) => `Posted ${job.posted} ago`;

/** "Senior", "Mid-level", "Junior", "Lead". */
export const levelLine = (job: FireflyJob) => (job.level === "Mid" ? "Mid-level" : job.level);

/** One sentence for a screen reader: the card's first lines. */
export function jobLabel(job: FireflyJob): string {
  return `${job.title}, ${whereParts(job).join(", ")}. ${fmtFit(job.fit)} out of 10 fit.`;
}

/** Interface copy for the card and the list. Sentence case, no em dashes. */
export const fireflyCardCopy = {
  card: {
    close: "Close",
    kept: "Kept",
    aside: "Set aside",
    why: (fit: number) => `Why it scored ${fmtFit(fit)}`,
    gap: "Gap",
    facts: { level: "Level", posted: "Posted", pay: "Pay" },
    ago: (posted: string) => `${posted} ago`,
    noBand: "Not listed",
    view: "View posting",
    save: "Save",
    saved: "Saved",
    source: "Source",
    /** Beside the buttons: they do nothing on purpose. */
    note: "Illustrative role. Nothing opens.",
  },
  list: {
    open: (n: number) => `All roles (${n})`,
    title: "All roles",
    sorted: "Sorted by fit",
    kept: (n: number) => `${n} fit your portfolio`,
    aside: (n: number) => `Set aside (${n})`,
    close: "Close the list",
  },
} as const;
