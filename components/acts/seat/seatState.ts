"use client";

/**
 * Shared state of the seat ticket (Act IV): the waitlist request status.
 * Lives outside the ticket face, because the face renders more than once (the
 * flying Actor copy and the real docked ticket), and the seat printed on the stub
 * and the line under "ready." react to a successful request too.
 *
 * The stamp finale (Delight 8) keeps its outcome here as well, so a remount and the flying Actor
 * copy draw the same ticket the visitor left: the ink impression, and where the stub went.
 */

import { useSyncExternalStore } from "react";

/** The 25 seats printed on the ticket's stub, and the one a successful request fills (the centre, 0-based). */
export const SEATS = 25;
export const CLAIM_RING = 12;
/** The seat number the stamp prints and the nav shows (the filled ring, 1-based). */
export const SEAT_NO = CLAIM_RING + 1;

export type SeatStatus = "idle" | "sending" | "done" | "duplicate" | "error";

/**
 * The finale's outcome.
 * - impress: the ink left on the ticket ("saved" after a request, "already" for a duplicate).
 * - stub: "on" (attached), "torn" (torn off, in flight), "flown" (docked in the nav),
 *   "settled" (torn off and left lying beside the ticket: the nav CTA was not on screen).
 * - note: the success line as the visitor saw it, so the flying copy prints the same words.
 */
export type SeatFinale = { impress: "none" | "saved" | "already"; stub: "on" | "torn" | "flown" | "settled"; note: string };
const NO_FINALE: SeatFinale = { impress: "none", stub: "on", note: "" };

let snapshot: { status: SeatStatus; at: number; finale: SeatFinale } = { status: "idle", at: 0, finale: NO_FINALE };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const seatState = {
  get: () => snapshot,
  set(status: SeatStatus) {
    if (status === snapshot.status) return;
    // Leaving a finished state (Edit it., or a new attempt) puts the ticket back together.
    const finale = status === "done" || status === "duplicate" ? snapshot.finale : NO_FINALE;
    snapshot = { status, at: typeof performance !== "undefined" ? performance.now() : 0, finale };
    emit();
  },
  finale(patch: Partial<SeatFinale>) {
    const f = { ...snapshot.finale, ...patch };
    if (f.impress === snapshot.finale.impress && f.stub === snapshot.finale.stub && f.note === snapshot.finale.note) return;
    snapshot = { ...snapshot, finale: f };
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

const server = { status: "idle" as SeatStatus, at: 0, finale: NO_FINALE };

export function useSeatState() {
  return useSyncExternalStore(seatState.subscribe, seatState.get, () => server);
}
