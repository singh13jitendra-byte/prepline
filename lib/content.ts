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
};

export const matches: Match[] = [
  { initials: "KH", title: "Senior Product Designer", company: "Kestrel Health", city: "Bengaluru", mode: "Hybrid", score: 9 },
  { initials: "PL", title: "Product Designer, Design Systems", company: "Paisa Labs", city: "Gurugram", mode: "On-site", score: 8 },
  { initials: "NC", title: "UX Designer, Patient App", company: "Northwell Care", city: "Remote", mode: "Remote", score: 8 },
];

export const weeks = [
  { label: "Week 1", title: "12 roles ranked for her", body: "She saves five, each with a one-line reason it fits." },
  { label: "Week 2", title: "Four applications, one board", body: "Saved, applied, interview, closed. No spreadsheet." },
  { label: "Week 3", title: "Interview booked, sheet ready", body: "Questions from the JD, her portfolio and what this company asked before.", highlight: true },
  { label: "Week 4", title: "7 of 12 were asked", body: "One tap after the interview, and an offer the week after." },
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

export const features = [
  { title: "Reads your portfolio", body: "Questions cite your case studies, not a generic list.", icon: "doc" },
  { title: "Design rounds included", body: "Portfolio walkthrough, app critique, whiteboard and take-home prompts.", icon: "layers" },
  { title: "Fit you can read", body: "Every score out of 10 comes with a one-line reason.", icon: "bars" },
  { title: "Learns from real interviews", body: "Anonymous votes show what each company actually asks.", icon: "check" },
] as const;

export const trust = [
  { title: "Your portfolio isn’t stored", body: "Read once to write your sheet, then discarded." },
  { title: "No auto-apply, ever", body: "You choose where to apply. We never send anything for you." },
  { title: "Free during the beta", body: "Founding members get early pricing when it launches." },
  { title: "Votes stay anonymous", body: "Question votes carry no name or email." },
];
