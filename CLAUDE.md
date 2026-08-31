# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A teaching demo of the browser `fetch` API against a real backend. It is a two-part
app: a React + Vite SPA (`client/`) and an Express API (`server/`). Consumer CRUD data
is backed by Supabase; authentication is hand-rolled JWTs (no Supabase, no database).
The whole point is to show the raw fetch flow — HTTP methods, request/response shape,
cookie-based auth — in the plainest possible code. `HTTP-METHODS-GUIDE.md` is the
narrative companion to the fetch/HTTP code; `JWT-AUTH-FROM-SCRATCH.md` is the narrative
companion to the auth code. Keep them consistent when changing the relevant patterns.

Because it is a teaching artifact, **bias toward clarity over cleverness**. Several
"proper" abstractions are deliberately left unused (see below) — do not wire them in
or DRY up the hooks unless explicitly asked.

## Commands

Run the two halves in separate terminals.

```bash
# server/ — Express API on :8787 (reads server/.env via node --env-file)
cd server && npm run dev      # watch mode (auto-restart)
cd server && npm start        # no watch

# client/ — Vite dev server on :5173
cd client && npm run dev
cd client && npm run build    # tsc -b && vite build
cd client && npm run preview
```

There is no test suite, linter, or formatter configured. Do not invent commands for them.

## Architecture

**Same-origin via proxy.** The Vite dev server (`client/vite.config.ts`) proxies
`/api/*` to `http://localhost:8787`. This is deliberate: the browser sees every API
call as same-origin, so the httpOnly auth cookies are sent automatically with no CORS
setup and no `credentials: 'include'`. If you touch auth or fetch code, preserve the
same-origin assumption.

**Auth is cookie + hand-rolled JWT, entirely separate from the consumer data store.**
On login (`server/routes/auth.js`), the server checks the password with
`bcrypt.compare` against `server/lib/users.js` (an in-memory, hardcoded user list —
no database), then signs two JWTs locally with `server/lib/jwt.js`
(`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` from env) and sets them as httpOnly
cookies (`access_token`, 15min; `refresh_token`, 30 days). Every protected request
re-verifies the access-token cookie **locally** via `jwt.verify` — no network call,
unlike a delegated-auth provider. `POST /api/auth/signup` adds a new user to the
same in-memory list (bcrypt-hashed, no auto-login); `POST /api/auth/refresh` trades a
valid refresh-token cookie for a new access-token cookie without re-entering a
password. See `JWT-AUTH-FROM-SCRATCH.md` for the full concept walkthrough.
`server/lib/supabase-admin.js` (service-role key, bypasses Row Level Security) is
used **only** for consumer CRUD against `demo_consumers` — it has nothing to do with
auth and must never reach the browser bundle.

**Auth is enforced in two places.** `server/routes/consumers.js` guards every route
with a `requireAuth` middleware (the real enforcement). The client's
`components/require-auth.tsx` + `features/auth/useAuth.tsx` (which polls `/api/auth/me`)
is UX only. Don't rely on the client guard for security.

**Data flows through a snake_case ↔ camelCase boundary.** The DB uses snake_case
(`first_name`, `consumer_number`); the app uses camelCase (`firstName`). The mapping
lives entirely in `rowToConsumer` / `consumerToRow` in `server/routes/consumers.js`.
The client only ever sees camelCase. Data lives in a demo-only `demo_consumers` table.

**Client structure.** Routing is React Router in `client/src/App.tsx` (this app was
ported from Next.js — comments reference the old file-based routes). Feature logic is
organized under `client/src/features/<feature>/` as one custom hook per operation
(`useConsumers`, `useCreateConsumer`, `useDeleteConsumer`, `useConsumerDetail`). Pages
in `client/src/pages/` compose those hooks; `client/src/components/ui/` is shadcn/ui.
The `@/*` import alias maps to `client/src/*`.

## The fetch pattern (the thing this repo teaches)

Every data hook calls `fetch` **directly** and repeats the same ceremony by hand:
manual `isLoading`/`isError` state, an explicit `if (!res.ok)` check (since `fetch`
only rejects on network failure, not on 4xx/5xx), then `res.json()`. This duplication
is intentional and pedagogical. When adding a new operation, follow the existing hook
as a template rather than extracting shared logic.

Two files are **intentionally unused, kept as reference only** — do not import them
unless asked:
- `client/src/lib/fetch-client.ts` — shows how you'd centralize the `res.ok` check.
- `client/src/lib/simple-cache.ts` — shows a hand-rolled React-Query-style cache/dedupe.
