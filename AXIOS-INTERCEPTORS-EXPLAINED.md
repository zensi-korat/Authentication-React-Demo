# `client/src/lib/axios.ts`, Line by Line

A plain-English walkthrough of the shared axios instance and its response
interceptor — the piece that makes M11 (`AUTH-LEARNING-MILESTONES.md`) work:
silently refreshing an expired access token and retrying the failed request,
without the calling code ever noticing. Read alongside the real file.

## What an "interceptor" actually is, before the code

An axios interceptor is just **a function that runs automatically on every
request or every response**, before your own `.then()`/`await` code ever sees
it. Think of it as a checkpoint every API call has to pass through — a place
to inject shared logic (like "if this failed with a 401, try to fix that
before giving up") once, instead of repeating it in every single hook that
makes a request.

## The instance itself

```ts
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});
```

- `axios.create({...})` — makes a *new, independent* axios instance with its
  own settings, instead of using the global `axios` object directly. This
  matters because the interceptor we're about to add only applies to `api`,
  not to every axios call anywhere in the app (we actually rely on that
  distinction later, for the refresh call itself).
- `baseURL: "/api"` — every call site can now write `api.get("/consumers")`
  instead of `api.get("/api/consumers")` — axios prepends this automatically.
- `headers: { "Content-Type": "application/json" }` — set once here instead
  of repeating `headers: { "Content-Type": "application/json" }` in every
  `fetch()` call like the old code did.
- **No `withCredentials: true`.** That flag exists to make axios send cookies
  on *cross-origin* requests — but the Vite proxy (`vite.config.ts`) forwards
  every `/api/*` call to the Express server, so the browser always sees this
  as a same-origin request. The httpOnly `access_token`/`refresh_token`
  cookies ride along automatically either way, same as they would with plain
  `fetch`. If this app ever called an API on a genuinely different origin,
  this line is the one that would need to change.

## Deciding which failures are worth retrying

```ts
const AUTH_ENDPOINTS_TO_SKIP = ["/auth/login", "/auth/signup", "/auth/refresh"];

function shouldAttemptRefresh(config: InternalAxiosRequestConfig | undefined) {
  if (!config?.url) return false;
  return !AUTH_ENDPOINTS_TO_SKIP.some((path) => config.url!.includes(path));
}
```

- `const AUTH_ENDPOINTS_TO_SKIP = [...]` — an array of URL fragments where a
  401 means something entirely different than "your token expired":
  - `/auth/login` 401 = wrong password. Retrying via refresh would make no
    sense — there's no session to refresh yet.
  - `/auth/signup` 401 can't actually happen here (signup doesn't require
    auth), but it's excluded defensively anyway.
  - `/auth/refresh` 401 = the refresh token itself is invalid/expired. If we
    let *this* trigger another refresh attempt, and that also 401'd, and we
    tried to refresh again... that's an infinite loop.
- `config?.url` and `config.url!` — the `?.` (optional chaining) says "if
  `config` is `undefined`, stop here and return `undefined` instead of
  crashing." The `!` further down is a manual promise to TypeScript — "trust
  me, `config.url` is definitely not `undefined` by this point" (safe here
  because the line above already returned early if it was).
- `.some((path) => config.url!.includes(path))` — `.some()` returns `true` if
  *any* item in the array satisfies the check. So this reads: "does the
  request URL contain any of the skip-list paths?" The `!` in front of the
  whole `.some(...)` call inverts it: the function returns `true` (meaning
  "yes, attempt a refresh") only when the URL matches **none** of them.

## Avoiding duplicate refresh calls

```ts
let refreshPromise: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post("/api/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
```

**The problem this solves:** imagine a page that fires off 3 API calls at
once (say, loading a dashboard). If the access token happens to be expired,
all 3 could fail with a 401 within milliseconds of each other. Without this
guard, each one would independently trigger its own `POST /auth/refresh` —
wasteful, and there's a subtler risk of race conditions if multiple refreshes
overlap.

- `let refreshPromise: Promise<void> | null = null;` — a variable living
  *outside* any function, at the module level, so it persists between calls
  and is shared by every request that goes through this file.
- `if (!refreshPromise)` — only start a *new* refresh if one isn't already
  in flight.
- `axios.post("/api/auth/refresh")` — note this is the raw `axios` object,
  **not** the `api` instance. That's deliberate: `api` has the interceptor
  we're currently defining attached to it; using it here would mean *this
  exact refresh call* is also subject to "if I 401, try to refresh again" —
  recursive risk. Calling plain `axios` bypasses that entirely.
- `.then(() => undefined)` — the actual response data from `/auth/refresh`
  doesn't matter to callers of this function; they only care *that* it
  succeeded, not *what* it returned. This discards the response and resolves
  with nothing (`void`).
- `.finally(() => { refreshPromise = null; })` — runs whether the refresh
  succeeded or failed. Resets the shared variable so the *next* time a 401
  happens (a genuinely new occasion, later), a fresh refresh attempt can
  start — otherwise every 401 after the very first one would incorrectly
  reuse a stale, already-settled promise.
- `return refreshPromise;` — every caller during the same in-flight window
  gets the exact same `Promise` back, so they all resolve (or reject)
  together, from one single network call.

## The interceptor itself

```ts
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => { ... }
);
```

`.interceptors.response.use(onSuccess, onError)` takes two functions:

- **First argument** — runs for every successful (2xx) response.
  `(response) => response` means "do nothing, just pass it through
  unchanged." Interceptors don't have to modify anything; they can also just
  observe/pass-through.
- **Second argument** — runs for every *failed* (non-2xx, or network error)
  response. This is where the actual recovery logic lives.

```ts
  const originalRequest = error.config as
    | (InternalAxiosRequestConfig & { _retry?: boolean })
    | undefined;
```

- `error.config` — axios attaches the original request's configuration (URL,
  method, headers, etc.) onto every error, so you can inspect or even re-send
  it.
- `as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined` — a
  TypeScript **type assertion**. `_retry` isn't a real axios field; it's a
  custom flag *we* invent and attach ourselves in a moment, to mark "this
  specific request has already been retried once." The `&` combines axios's
  real config type with our made-up extra field, so TypeScript doesn't
  complain when we read/write `.​_retry` on it later.

```ts
  const isUnauthorized = error.response?.status === 401;
  const alreadyRetried = originalRequest?._retry;

  if (!isUnauthorized || alreadyRetried || !shouldAttemptRefresh(originalRequest)) {
    return Promise.reject(error);
  }
```

Three conditions must ALL be false to proceed with a refresh attempt — if
ANY of them is true, we give up immediately:

1. **Not a 401** — some other kind of failure (500, network error, 404).
   Refreshing a token won't fix a server crash or a bad URL.
2. **Already retried** — we tried this exact request once already after a
   refresh, and it *still* failed. Trying a third time won't help; something
   else is wrong.
3. **This is an excluded auth endpoint** — from the `shouldAttemptRefresh`
   check above.

`return Promise.reject(error);` — re-throws the error, in Promise form. This
is what makes the failure visible again to whatever called `api.get(...)` in
the first place — their own `try/catch` runs normally, exactly as if this
interceptor didn't exist.

```ts
  try {
    originalRequest!._retry = true;
    await refreshAccessToken();
    return api(originalRequest!);
  } catch (refreshError) {
    window.location.href = "/login";
    return Promise.reject(refreshError);
  }
```

- `originalRequest!._retry = true;` — marks this specific request object so
  that *if* the retry below also somehow 401s, the check above
  (`alreadyRetried`) will catch it and stop, instead of looping forever.
- `await refreshAccessToken();` — call the de-duplicated refresh function
  from earlier. If the refresh token itself is invalid/expired, this
  `await` throws, jumping straight to the `catch` block below.
- `return api(originalRequest!);` — **replays the exact original request**
  (same URL, method, body) through the `api` instance again. Because the
  refresh call above just caused the server to set a fresh `access_token`
  cookie, this retry now succeeds — and whatever code originally called
  `api.get(...)` receives this *successful* response as if the first attempt
  had never failed at all. It has no idea a refresh even happened.
- `catch (refreshError)` — the refresh token is also dead; there is no way
  to silently recover a session at this point.
- `window.location.href = "/login";` — a **hard redirect**, not React
  Router's `navigate()`. This code runs outside any React component (it's
  plain module-level code, not a hook), so it doesn't have access to
  `useNavigate()`. A full page reload to `/login` is the simplest way to
  force a clean logged-out state from here.
- `return Promise.reject(refreshError);` — still propagate the failure, so
  any code awaiting the original request doesn't hang forever waiting for a
  response that's never coming (the redirect above will unmount everything
  a moment later anyway, but this keeps the Promise chain well-behaved
  until then).

## The full sequence, start to finish

1. Some component calls `api.get("/consumers", ...)`.
2. The access token cookie has expired; the server responds `401`.
3. The response interceptor's error handler fires. It checks: real 401? not
   already retried? not an excluded auth endpoint? All yes → proceed.
4. `refreshAccessToken()` calls `POST /auth/refresh` (deduplicated if
   multiple requests hit this at once).
5. The server verifies the refresh-token cookie, mints a new access-token
   cookie, sends it back via `Set-Cookie` — the browser stores it
   automatically, same as any cookie.
6. The interceptor replays the original `GET /consumers` request. This time
   it carries the fresh cookie and succeeds.
7. The original caller receives a normal, successful response — completely
   unaware that a 401 and a refresh happened in between.
8. If step 4 had failed instead (refresh token also dead), the user is
   hard-redirected to `/login`.
