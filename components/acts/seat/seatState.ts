"use client";

/**
 * Shared state of the seat ticket (Act IV): the waitlist request status.
 * Lives outside the ticket face, because the face renders more than once (the
 * flying Actor copy and the real docked ticket), and the seat rings and the
 * line under "ready." react to a successful request too.
 */

import { useSyncExternalStore } from "react";

export type SeatStatus = "idle" | "sending" | "done" | "duplicate" | "error";

let snapshot: { status: SeatStatus; at: number } = { status: "idle", at: 0 };
const listeners = new Set<() => void>();

export const seatState = {
  get: () => snapshot,
  set(status: SeatStatus) {
    if (status === snapshot.status) return;
    snapshot = { status, at: typeof performance !== "undefined" ? performance.now() : 0 };
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

const server = { status: "idle" as SeatStatus, at: 0 };

export function useSeatState() {
  return useSyncExternalStore(seatState.subscribe, seatState.get, () => server);
}
