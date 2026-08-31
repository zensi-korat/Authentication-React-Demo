/**
 * NOTE: Currently UNUSED. Kept for reference only.
 * To stay beginner-friendly, every hook now calls `fetch` directly instead of
 * going through this wrapper. This file shows how you'd later centralise that
 * logic in one place once the raw version is understood.
 *
 * apiFetch — the one shared place that turns raw `fetch` into something a
 * component can trust.
 *
 * WHY this wrapper exists: `fetch` only rejects its promise on network
 * failure (DNS error, connection refused, offline, aborted). A 404 or a 500
 * response is still a *successful* fetch as far as the Promise is concerned
 * — `res.ok` is what tells you the server considered the request a failure.
 * If you don't check `res.ok` yourself, `res.json()` on an error response
 * happily resolves with whatever error JSON the server sent, and calling
 * code will treat it as valid data. Every hook in this app goes through this
 * function so that check happens exactly once, in one place.
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    // Try to read a { message } field the API routes send on error; fall
    // back to the status text if the body isn't JSON (or is empty).
    let message = res.statusText || `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // Body wasn't JSON — keep the statusText fallback above.
    }
    throw new Error(message);
  }

  // 204 No Content (not used here, but a real API can return it) has no body.
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
