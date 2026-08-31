/**
 * NOTE: Currently UNUSED. Kept for reference only.
 * Caching was removed to keep the demo simple — every hook just re-fetches.
 * This file stays as a reference for how caching/de-duplication could be added
 * back later.
 *
 * simple-cache — a hand-rolled version of what @tanstack/react-query does
 * internally, stripped down to the two mechanics this demo cares about:
 *
 * 1. `cache`: Map<url, data> — once a GET succeeds, keep the parsed result
 *    around so navigating back to a page already-fetched doesn't show a
 *    loading spinner again. Real caches also track staleness/TTL; this one
 *    is intentionally naive — it never expires on its own, only on
 *    `invalidate`.
 * 2. `inFlight`: Map<url, Promise> — request de-duplication. If two
 *    components mount at the same time and both call useConsumers(), we
 *    don't want two network requests for the same URL; the second caller
 *    gets handed the same in-flight Promise as the first.
 *
 * `invalidate(url)` is what a mutation (create/delete) calls afterwards so
 * the next read re-fetches instead of serving stale cached data — this is
 * the manual equivalent of React Query's `queryClient.invalidateQueries`.
 */

const cache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

export function getCached<T>(url: string): T | undefined {
  return cache.get(url) as T | undefined;
}

export function setCached<T>(url: string, data: T): void {
  cache.set(url, data);
}

export function getInFlight<T>(url: string): Promise<T> | undefined {
  return inFlight.get(url) as Promise<T> | undefined;
}

export function setInFlight<T>(url: string, promise: Promise<T>): void {
  inFlight.set(url, promise);
  // Once it settles (success or failure), stop treating it as in-flight so
  // the next call issues a fresh request instead of replaying a dead promise.
  // `.finally()` returns a NEW promise that re-rejects when `promise` rejects
  // (e.g. an aborted fetch). The real caller awaits `promise` itself and
  // handles that rejection; this bookkeeping chain has no awaiter, so we must
  // swallow it here or it surfaces as an unhandled rejection on abort.
  promise.finally(() => inFlight.delete(url)).catch(() => {});
}

export function invalidate(url: string): void {
  cache.delete(url);
  inFlight.delete(url);
}
