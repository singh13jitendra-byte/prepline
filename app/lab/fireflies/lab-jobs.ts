/**
 * PLACEHOLDER JOBS FOR THE LAB — not the product's data.
 *
 * components/fireflies/jobs.ts (FIREFLY_JOBS) belongs to the card and data builder. Until it is
 * merged, the lab flies these: the twelve ranked roles of components/product/data.ts, and
 * thirty-six set-aside ones in the same style, in the contract's shape (FireflyJob). After the
 * merge: delete this file and pass FIREFLY_JOBS to the lab instead.
 *
 * Every company, role and number is invented. Nothing is a real posting.
 */

import { detailFor, roles, type WorkMode } from "@/components/product/data";
import type { FireflyJob } from "@/components/fireflies/scene/types";

const band = (lo: number, hi: number) => `₹${lo}–${hi} LPA`;
const SOURCES = ["Careers page", "Job board", "Company blog", "Referral post"];

const KEPT_SALARY: (string | undefined)[] = [band(30, 42), band(22, 30), band(20, 28), band(18, 26), band(28, 38), undefined, band(24, 32), band(16, 22), band(18, 24), undefined, band(28, 36), band(14, 20)];

const kept: FireflyJob[] = roles.map((role, i) => {
  const d = detailFor(role);
  return {
    id: `lab-${role.rank}`,
    title: role.title,
    company: role.company,
    city: role.city,
    mode: role.mode,
    level: role.level,
    posted: role.found,
    salary: KEPT_SALARY[i],
    fit: role.score,
    reasons: d.why.map((r) => ({ label: r.label, text: r.text })),
    gap: d.watchOuts[0]?.text,
    source: SOURCES[i % SOURCES.length],
  };
});

/** title, company, city, mode, level, [portfolio /4, domain /2, level and city /4], why it was set aside, portfolio line, level line, posted, salary */
type Aside = [string, string, string, WorkMode, string, [number, number, number], string, string, string, string, string?];

const DOMAIN_TEXT: Record<string, string> = {
  "2": "HealthTech, like your last role.",
  "1.5": "Close to health. Not a domain you have shipped in.",
  "1": "A domain you haven’t shipped in yet.",
  "0.5": "A long way from patient-facing work.",
};

const ASIDE: Aside[] = [
  ["UI Designer", "Tallybook", "Pune", "Hybrid", "Junior", [1.5, 1, 0.5], "too junior", "Visual polish on set screens. Your case studies are flows and systems.", "Junior, hybrid in Pune. Two levels below yours.", "3h", band(7, 10)],
  ["Product Designer", "Loomcart", "Chennai", "On-site", "Mid", [2, 1, 1], "five days on-site", "Checkout flows. Some overlap with your booking redesign.", "Mid-level, five days on-site in Chennai.", "6h", band(16, 22)],
  ["UX Researcher", "Meridian Diagnostics", "Mumbai", "Hybrid", "Senior", [1, 2, 1.5], "mostly research", "A research role. You would ship no screens.", "Senior, hybrid in Mumbai.", "1d", band(24, 32)],
  ["Brand Designer", "Fernway", "Remote", "Remote", "Mid", [0.5, 0.5, 1], "brand, not product", "Identity and campaign work. No product flows.", "Mid-level and remote.", "1d"],
  ["Design Lead", "Kulhad Labs", "Bengaluru", "Hybrid", "Lead", [2, 1, 1], "too senior", "Systems thinking fits. The job is leading eight designers.", "Lead, hybrid in Bengaluru. Two levels above yours.", "2d", band(44, 58)],
  ["Motion Designer", "Lattu Games", "Hyderabad", "On-site", "Mid", [0.5, 0.5, 1], "a different craft", "Motion and game feel. None of your case studies show it.", "Mid-level, on-site in Hyderabad.", "2d", band(12, 18)],
  ["Product Designer, Payments", "Rangoli Pay", "Mumbai", "On-site", "Senior", [2.5, 1, 1.5], "five days on-site", "Onboarding flows are close to yours. Compliance is new.", "Senior, five days on-site in Mumbai.", "5h", band(28, 36)],
  ["Visual Designer", "Zari Retail", "Delhi", "Hybrid", "Mid", [1, 1, 1], "brand, not product", "Campaign pages and lookbooks, not product flows.", "Mid-level, hybrid in Delhi.", "3d", band(12, 16)],
  ["Service Designer", "Baithak Works", "Pune", "Hybrid", "Senior", [1.5, 1, 1.5], "no case study fits", "Workshops and service blueprints. Few shipped screens.", "Senior, hybrid in Pune.", "4d"],
  ["Content Designer", "Kolam Docs", "Remote", "Remote", "Mid", [1, 1, 1], "a different craft", "A writing role. Your case studies are interaction work.", "Mid-level and remote.", "2d", band(14, 20)],
  ["Junior UI Designer", "Kanche Kids", "Bengaluru", "On-site", "Junior", [1, 0.5, 0.5], "too junior", "Production UI for a kids’ app. Little room for flows.", "Junior, on-site in Bengaluru.", "9h", band(6, 9)],
  ["Product Designer, Games", "Gilli Play", "Hyderabad", "Hybrid", "Mid", [1, 0.5, 1.5], "wrong domain", "Game economy screens. Far from your case studies.", "Mid-level, hybrid in Hyderabad.", "5d", band(16, 22)],
  ["UX Designer, Logistics", "Thoni Freight", "Kochi", "On-site", "Mid", [2, 1, 1], "wrong city", "Dispatch dashboards. Some overlap with your systems work.", "Mid-level, on-site in Kochi.", "1w", band(14, 18)],
  ["Senior UX Designer", "Nimbu Ledger", "Jaipur", "On-site", "Senior", [2, 1, 1], "wrong city", "Ledger flows for small shops. Onboarding is close.", "Senior, on-site in Jaipur.", "3d", band(22, 28)],
  ["Product Designer", "Imli Cloud", "Remote", "Remote", "Senior", [2.5, 1, 1.5], "below your pay band", "Component work like Pulse, for a developer tool.", "Senior and remote. The band stops under your pay.", "1d", band(16, 20)],
  ["Interaction Designer", "Bansuri Audio", "Kochi", "On-site", "Mid", [1.5, 0.5, 1], "wrong city", "Hardware companion app. Interaction heavy, small scope.", "Mid-level, on-site in Kochi.", "6d"],
  ["Design Systems Designer", "Gully Grid", "Ahmedabad", "On-site", "Senior", [3, 1, 1], "five days on-site", "Owns a component library. Your Pulse work fits well.", "Senior, five days on-site in Ahmedabad.", "8h", band(26, 34)],
  ["UX Designer", "Tiffin Loop", "Kolkata", "Hybrid", "Mid", [1.5, 1, 1.5], "wrong domain", "Meal subscriptions. Booking logic is loosely related.", "Mid-level, hybrid in Kolkata.", "4d", band(12, 18)],
  ["Product Design Manager", "Chajja Homes", "Gurugram", "Hybrid", "Lead", [1.5, 1, 1.5], "too senior", "People management first. Little hands-on design.", "Manager, hybrid in Gurugram. Above your level.", "2d", band(42, 55)],
  ["Associate Product Designer", "Ginti Learn", "Noida", "Hybrid", "Junior", [1, 1, 1], "too junior", "Lesson screens from set templates.", "Associate, hybrid in Noida. Below your level.", "1d", band(8, 12)],
  ["UX Designer, Wellness", "Mogra Wellness", "Remote", "Remote", "Mid", [2, 1.5, 1.5], "below your pay band", "Habit tracking flows. Near patient-facing work.", "Mid-level and remote. The band stops under your pay.", "3d", band(12, 16)],
  ["Product Designer, Agritech", "Sarson Agri", "Indore", "On-site", "Mid", [1, 1, 1], "wrong city", "Field tools for buyers. Offline-first is new to you.", "Mid-level, on-site in Indore.", "1w"],
  ["UX Writer", "Takhti Notes", "Remote", "Remote", "Mid", [0.5, 0.5, 1], "a different craft", "Microcopy and help centre articles.", "Mid-level and remote.", "5d", band(10, 14)],
  ["Senior Visual Designer", "Anaar Analytics", "Bengaluru", "Hybrid", "Senior", [1, 1, 2], "no case study fits", "Chart styling and data visualisation. No flows to own.", "Senior, hybrid in Bengaluru.", "2d", band(24, 30)],
  ["Product Designer, Lending", "Elaichi Credit", "Mumbai", "On-site", "Senior", [2.5, 1, 1.5], "five days on-site", "Application flows, close to your booking work.", "Senior, five days on-site in Mumbai.", "11h", band(28, 38)],
  ["UX Researcher, Clinics", "Ajwain Care", "Pune", "Hybrid", "Senior", [1, 2, 2], "mostly research", "Field research in clinics. You would ship no screens.", "Senior, hybrid in Pune.", "1d", band(22, 30)],
  ["Product Designer, Travel", "Dhurrie Trips", "Delhi", "Hybrid", "Mid", [1.5, 1, 1.5], "wrong domain", "Trip planning. Booking is close, the domain is not.", "Mid-level, hybrid in Delhi.", "6d", band(16, 22)],
  ["Head of Design", "Genda Rx", "Hyderabad", "Hybrid", "Lead", [1, 1.5, 0.5], "too senior", "Sets hiring and budget. Almost no hands-on design.", "Head of design. Three levels above yours.", "2w"],
  ["UI Designer, Kiosks", "Surahi Water", "Chandigarh", "On-site", "Junior", [0.5, 0.5, 1], "wrong city", "Kiosk screens from a fixed template.", "Junior, on-site in Chandigarh.", "1w", band(6, 9)],
  ["Product Designer, EV", "Phirki Mobility", "Chennai", "On-site", "Mid", [1.5, 1, 1.5], "five days on-site", "Charging and trip flows. New ground for you.", "Mid-level, five days on-site in Chennai.", "3d", band(18, 24)],
  ["UX Designer, Stays", "Chabutra Stays", "Jaipur", "Remote", "Mid", [2, 1, 2], "no case study fits", "Host tools and listings. Nothing you have shown is close.", "Mid-level and remote.", "4d", band(14, 20)],
  ["Design Technologist", "Sandook Storage", "Bengaluru", "Hybrid", "Senior", [1, 1, 2], "a different craft", "Mostly front-end code. Prototypes, not flows.", "Senior, hybrid in Bengaluru.", "5d", band(26, 34)],
  ["Product Designer, Energy", "Angeethi Energy", "Ahmedabad", "Hybrid", "Mid", [1, 0.5, 1.5], "wrong domain", "Solar monitoring dashboards for installers.", "Mid-level, hybrid in Ahmedabad.", "1w"],
  ["Illustrator, Product", "Karonda Foods", "Remote", "Remote", "Mid", [0.5, 0.5, 1], "a different craft", "Spot illustrations and packaging.", "Mid-level and remote.", "2w", band(8, 12)],
  ["Senior Product Designer", "Saunf Health", "Kochi", "On-site", "Senior", [2, 2, 1], "wrong city", "Clinic booking, close to your redesign.", "Senior, five days on-site in Kochi.", "7h", band(26, 34)],
  ["UX Designer", "Neem Street Health", "Kolkata", "On-site", "Mid", [2, 2, 1], "five days on-site", "Patient records screens. A good domain match.", "Mid-level, five days on-site in Kolkata.", "2d", band(14, 18)],
];

const aside: FireflyJob[] = ASIDE.map(([title, company, city, mode, level, pts, cut, portfolio, levelCity, posted, salary], i) => ({
  id: `lab-a${i + 1}`,
  title,
  company,
  city,
  mode,
  level,
  posted,
  salary,
  fit: pts[0] + pts[1] + pts[2],
  reasons: [
    { label: "Portfolio fit", text: portfolio },
    { label: "Domain", text: DOMAIN_TEXT[String(pts[1])] ?? DOMAIN_TEXT["1"] },
    { label: "Level and city", text: levelCity },
  ],
  gap: `Set aside: ${cut}.`,
  source: SOURCES[(i + 1) % SOURCES.length],
}));

/** Twelve that fit, thirty-six set aside. */
export const LAB_JOBS: FireflyJob[] = [...kept, ...aside];
