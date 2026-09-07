# Every Call Site, `fetch` → `api`

`AXIOS-INTERCEPTORS-EXPLAINED.md` covers the *engine* — the shared instance and
its response interceptor in `client/src/lib/axios.ts`. This file covers
everywhere that engine actually gets *used*: every hook and component that
used to call `fetch` directly and now calls `api.get`/`api.post`/etc. instead
(M11 in `AUTH-LEARNING-MILESTONES.md`). Read alongside the real files.

## The shape of the change, everywhere

Every call site made the same three edits, because `fetch` and axios disagree
on three things:

| | `fetch` | `api` (axios) |
|---|---|---|
| Failure signal | resolves normally even on 4xx/5xx — you must check `res.ok` yourself | **rejects** the promise on any non-2xx status, so a plain `try/catch` catches it |
| Body parsing | manual `await res.json()` | already-parsed JSON on `response.data` |
| 401 from an expired access token | the caller sees the failure directly | the interceptor in `lib/axios.ts` may silently refresh and retry first — the caller only sees a failure if that *also* fails |

Concretely, this pattern:

```ts
const res = await fetch("/api/consumers");
if (!res.ok) throw new Error("Request failed");
const data = await res.json();
```

became this everywhere:

```ts
const { data } = await api.get("/consumers");
```

Two smaller details ride along with that:

- The URL loses its `/api` prefix — `api` already has `baseURL: "/api"` set
  once in `lib/axios.ts`, so every call site writes the path relative to that.
- `import { api } from "@/lib/axios";` replaces nothing (there was no `fetch`
  import — it's a browser global), so it's a pure addition at the top of each
  file.

## GET — reading data (`useConsumers.ts`, `useConsumerDetail.ts`)

```ts
const { data } = await api.get<ConsumersResponse>("/consumers", {
  params: { search: search || undefined, page, pageSize },
});
if (!ignore) {
  setConsumers(data.consumers);
  setTotal(data.total);
}
```

- `api.get<ConsumersResponse>(...)` — the generic parameter tells TypeScript
  what shape `data` will be, so `data.consumers` and `data.total` are
  type-checked instead of `any`.
- `{ params: { search: search || undefined, page, pageSize } }` — axios's
  second argument on a GET builds the query string for you
  (`?search=...&page=...&pageSize=...`). This replaces manually constructing
  a `URLSearchParams` and appending it to the URL. `search || undefined` is
  the key detail: an **empty** search box should mean "no filter," and axios
  drops any key whose value is `undefined` entirely — a `URLSearchParams`
  would instead stringify it as the literal text `"undefined"`, sending the
  server a real (wrong) filter.
- The `try { ... } catch (err) { ... } finally { ... }` and `ignore` /
  race-guard scaffolding around this didn't change at all. Axios doesn't
  remove the need for loading/error state — it only removes the manual
  `res.ok` check and `res.json()` call *inside* the `try`.

`useConsumerDetail.ts` is the same shape with a path parameter instead of
query params: `api.get<ConsumerResponse>(\`/consumers/${id}\`)`. There's no
`params` option because the id is already part of the URL, not a filter on it.

## POST — creating data (`useCreateConsumer.ts`)

```ts
const { data } = await api.post<ConsumerResponse>("/consumers", input);
return data.consumer;
```

- `api.post(url, body)` — the request body is axios's **second** positional
  argument (not a `params`-style options object, and not a manually
  `JSON.stringify`'d third argument like the old `fetch(url, { method:
  "POST", body: JSON.stringify(input) })`). Axios serializes `input` to JSON
  and sets `Content-Type: application/json` itself — both were explicit,
  repeated boilerplate in the `fetch` version.
- Everything else — `isPending`/`error` state, `useCallback`, re-throwing `e`
  from the `catch` so the calling component's own error handling still
  fires — is untouched. The migration only ever touches the one line that
  makes the network call.

## PUT / PATCH / DELETE — the not-yet-wired hooks

`useUpdateConsumer.ts`, `useReplaceConsumer.ts`, and `useDeleteConsumer.ts`
are mid-lesson stubs: the real axios call is written but commented out, and
an explicit `throw new Error(...)` runs in its place so the UI fails loudly
and obviously instead of silently doing nothing. This is deliberate scaffolding
for the "DEMO STEP" milestones, not leftover work:

```ts
/*
const { data } = await api.patch<ConsumerResponse>(`/consumers/${id}`, input); // ONLY the changed fields
return data.consumer;
*/

// Runs while PATCH is OFF (becomes unreachable once enabled above).
throw new Error("PATCH is not wired up yet — enable it in DEMO STEP 4");
```

- `api.patch(url, body)` / `api.put(url, body)` — same two-positional-argument
  shape as `.post`. The comments alongside them (`ONLY the changed fields` vs.
  `the WHOLE object — every field`) are the actual teaching point of
  `PUT-PATCH-EXPLAINED.md`: PATCH and PUT differ in what you're expected to
  send, not in how axios calls them.
- `api.delete(url)` (in `useDeleteConsumer.ts`) — no body argument at all;
  DELETE identifies what to remove entirely through the URL.
- Enabling any of these later is a two-line change: delete the `throw`, and
  uncomment the real call above it.

## Auth call sites — same rules, only the auth cookies matter more

`useAuth.tsx`, `login-page.tsx`, `signup-page.tsx`, and
`dashboard-header.tsx` (logout) all follow the exact `fetch`→`api` swap above,
but they're worth calling out separately because they're the ones the
interceptor in `lib/axios.ts` actually cares about.

```ts
// useAuth.tsx
const { data } = await api.get<{ user: AuthUser }>("/auth/me");
setUser(data.user);
```

- No manual cookie handling appears anywhere in this file, on `fetch` or on
  `api` — the httpOnly `access_token` cookie is attached by the browser
  automatically because the Vite proxy makes this a same-origin request (see
  `CLAUDE.md`). Axios changes *how failure is detected*, not *how auth is
  sent*.
- If `access_token` happens to be expired, this exact request is the one the
  interceptor intercepts: it calls `POST /auth/refresh` and replays this
  `GET /auth/me` transparently. `useAuth` never sees that happen — it only
  ever sees a success or a final failure.

```ts
// login-page.tsx
await api.post("/auth/login", { email, password });
```

```ts
// login-page.tsx — reading the error back out
const message = isAxiosError<{ message?: string }>(err)
  ? (err.response?.data?.message ?? "Login failed")
  : "Something went wrong.";
```

- `isAxiosError<T>(err)` — a type guard axios exports. Because `api.post`
  rejects on a 401 (wrong password) instead of resolving with an `!res.ok`
  response, the error arrives in the `catch` block as an `unknown`-typed
  value. `isAxiosError` narrows it so TypeScript allows reading
  `err.response.data.message` — the JSON error body the server sent — instead
  of just a generic `Error.message`.
- `/auth/login` is one of the three paths in `AUTH_ENDPOINTS_TO_SKIP` inside
  `lib/axios.ts`. A 401 here means "wrong password," not "expired token," so
  the interceptor deliberately does **not** try to refresh and retry it — it
  passes the rejection straight through to this `catch` block.
- `signup-page.tsx` is identical in shape (`api.post("/auth/signup", ...)` +
  the same `isAxiosError` narrowing) and is also on the skip list, for the
  same reason: a signup failure (e.g. duplicate email) isn't a token problem.
- Logout, in `dashboard-header.tsx`, is a bare `await api.post("/auth/logout")`
  with no response body to read — success just means "the cookies are now
  cleared server-side," so there's nothing to destructure out of `data`.

## What to check if something breaks

- A network call that used to "just fail visibly" now throws — if you add a
  new call site and forget the `try/catch`, the promise rejection will
  surface as an unhandled rejection instead of quietly falling through an
  `if (!res.ok)` you forgot to write. This is a feature: axios makes it
  harder to skip error handling by accident, not easier.
- If a new authenticated endpoint 401s and you *don't* want the interceptor's
  refresh-and-retry behavior for it (like `/auth/login`), add its path to
  `AUTH_ENDPOINTS_TO_SKIP` in `lib/axios.ts` — nothing about the call site
  itself needs to change.
