// STUB — replace with the card and data builder's file (branch `fireflies-card`) at merge.
//
// The type below is the contract's (research/fireflies-contract.md), word for word. The data is a
// short stand-in built from the page's own illustrative roles (components/product/data.ts), so the
// explore stop (components/acts/explore) can be built and checked before the real 48 exist.
// Every company here is invented, like everything else on the page ("Illustrative data").

import { cutRoles, detailFor, roles } from "@/components/product/data";

export type FireflyJob = {
  id: string;
  title: string;
  company: string;
  city: string;
  mode: "On-site" | "Hybrid" | "Remote";
  level: string;
  posted: string;
  salary?: string;
  /** 0–10 */
  fit: number;
  /** 2–3 lines */
  reasons: { label: string; text: string }[];
  gap?: string;
  /** e.g. "Careers page" */
  source: string;
};

const kept: FireflyJob[] = roles.map((role) => {
  const detail = detailFor(role);
  return {
    id: role.id,
    title: role.title,
    company: role.company,
    city: role.city,
    mode: role.mode,
    level: role.level,
    posted: role.found,
    fit: role.score,
    reasons: detail.why.slice(0, 3).map((r) => ({ label: r.label, text: r.text })),
    gap: detail.watchOuts[0]?.text,
    source: "Careers page",
  };
});

const setAside: FireflyJob[] = cutRoles.map((role, i) => ({
  id: role.id,
  title: role.title,
  company: role.company,
  city: role.city,
  mode: role.city === "Remote" ? "Remote" : i % 2 ? "On-site" : "Hybrid",
  level: /junior|^UI /i.test(role.title) ? "Junior" : "Mid",
  posted: `${i + 2}d`,
  fit: 3 + (i % 3),
  reasons: [
    { label: "Set aside", text: `${role.reason}.` },
    { label: "Level and city", text: role.city === "Remote" ? "Fully remote." : `Based in ${role.city}.` },
  ],
  gap: `${role.reason}.`,
  source: "Careers page",
}));

export const FIREFLY_JOBS: FireflyJob[] = [...kept, ...setAside];
