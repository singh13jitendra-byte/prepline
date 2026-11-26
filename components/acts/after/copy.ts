/**
 * Copy for Acts III–IV, the after-stage column and the form, read from lib/content.ts
 * (Foundation round 4 keys: story.form, story.founder, story.quotes, story.seat, story.privacy, story.footer).
 * This file holds no strings of its own: it only shapes those keys for the components.
 */
import { storyCopy } from "@/lib/content";

const c = storyCopy;

/** "Jitendra, product designer, Gurugram" → name in Hanken 650, the rest after it. */
function splitSignature(sig: string): { name: string; role: string } {
  const i = sig.indexOf(",");
  return i < 0 ? { name: sig, role: "" } : { name: sig.slice(0, i), role: sig.slice(i + 1).trim() };
}

export const founder = {
  title: c.founder.title,
  paragraphs: c.founder.long as readonly string[],
  ...splitSignature(c.founder.signature),
  imageAlt: c.founder.imageAlt,
  /** The deck has link labels but no URLs yet (founder.confirm): links render only once they have an href. */
  links: [] as { label: string; href: string }[],
};

/** The promises and the data note, on the paper slip after the seat stage (review 3, P0-2 / P1-8). */
export const promises = {
  title: c.privacy.title,
  items: c.seat.promises as readonly { title: string; body: string }[],
  note: c.seat.dataNote,
};

export const quotes = {
  real: c.quotes.real as boolean,
  label: c.quotes.label,
  items: c.quotes.items as readonly { quote: string; name: string; role: string }[],
};

export const form = {
  label: c.form.label,
  placeholder: c.form.placeholder,
  helper: c.form.helper,
  cta: c.form.button,
  empty: c.form.empty,
  invalid: c.form.invalid,
  sending: c.form.sending,
  sendingLive: c.form.sendingStatus,
  requestedFor: c.form.successFor,
  wrongAddress: c.form.wrongAddress,
  edit: c.form.edit,
  duplicate: c.form.duplicate,
  error: c.form.error,
  offline: c.form.offline,
  heroSuccess: c.form.success,
};

export const footerTime = { line: c.footer.timeSuffix };

export const landmarks = { sections: c.footer.sectionsLandmark, footer: c.footer.landmark };
