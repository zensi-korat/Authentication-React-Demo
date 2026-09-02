# Server — Express API

A small Express API with two things going on:

1. **Auth** — hand-rolled (no Supabase Auth, no third-party auth SDK). We check
   passwords ourselves with `bcrypt` and issue our own JWTs. Users are stored in
   a real Supabase Postgres table (`demo_users`), we just don't use Supabase's
   *auth* features — only its database.
2. **Consumer CRUD** — a demo dataset (`demo_consumers`) read/written straight
   through Supabase, protected by our own auth.

For the full concept-by-concept walkthrough (why JWTs work, what bcrypt does,
why cookies are httpOnly, etc.), see `../AUTH-LEARNING-MILESTONES.md` and
`../JWT-AUTH-FROM-SCRATCH.md` at the repo root. This file is just "what's in
this folder and how does it fit together."

## Running it

```bash
npm install
npm run dev      # watch mode, auto-restarts on file changes
npm start        # no watch
```

Reads `server/.env` automatically via `node --env-file=.env` (see `package.json`
scripts) — no `dotenv` package needed. Copy `.env.example` to `.env` and fill in
real values before running.

## Folder map

```
server/
├── index.js              Express app setup — the entry point
├── lib/
│   ├── jwt.js             Sign/verify JWTs (access + refresh tokens)
│   └── supabase-admin.js  The one Supabase client — talks to Postgres directly
└── routes/
    ├── auth.js            signup, login, logout, me, refresh
    └── consumers.js       CRUD for the demo consumers table + the requireAuth guard
```

### `index.js`

Wires everything together: parses JSON bodies, parses cookies (`cookie-parser`,
so `req.cookies` exists), mounts `authRouter` at `/api/auth/*` and
`consumersRouter` at `/api/consumers/*`.

### `lib/jwt.js`

The only place `jsonwebtoken` is used directly. Four functions:

| Function | What it does |
|---|---|
| `signAccessToken(user)` | Signs a short-lived (15 min) JWT with `{ sub, email }` |
| `signRefreshToken(user)` | Signs a long-lived (30 day) JWT with just `{ sub }` |
| `verifyAccessToken(token)` | Returns the decoded payload, or `null` if invalid/expired/tampered |
| `verifyRefreshToken(token)` | Same, for refresh tokens |

Two different secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` in `.env`) —
if one leaked, the other token type stays safe. Nothing here talks to the
network; verifying a token is pure local computation.

### `lib/supabase-admin.js`

One Supabase client, built with the **service-role key** (bypasses Row Level
Security). It's used for both auth (`demo_users`) and consumer CRUD
(`demo_consumers`) — this app has no separate "anon" client, because we don't
use Supabase's own auth rules at all; every access check is our own
`requireAuth`/`verifyAccessToken` code instead.

### `routes/auth.js`

| Route | What happens |
|---|---|
| `POST /signup` | Validate input → `bcrypt.hashSync` the password → insert a row into `demo_users`. Rejects duplicate emails (Postgres `unique` constraint, error code `23505`). |
| `POST /login` | Look up the row by email → `bcrypt.compareSync` the password → sign both tokens → set them as httpOnly cookies → return `{ user }` (never the token itself). |
| `POST /logout` | Clear both cookies. |
| `GET /me` | Read the `access_token` cookie → `verifyAccessToken` → return `{ user }` or 401. This is how the frontend checks "am I logged in?" on page load. |
| `POST /refresh` | Read the `refresh_token` cookie → `verifyRefreshToken` → re-fetch the user from Supabase → sign a fresh access token. Lets the session continue without asking for the password again. |

### `routes/consumers.js`

Two unrelated things share this file:

- `requireAuth` — the auth guard. Reads the `access_token` cookie, calls
  `verifyAccessToken`, and either calls `next()` or returns 401. Applied to
  every route in this router via `consumersRouter.use(requireAuth)`.
- The CRUD routes themselves (`GET/POST/PUT/PATCH/DELETE /api/consumers*`),
  which have nothing to do with auth — they just happen to require it.

## Cookies this API sets

| Cookie | Lifetime | Purpose |
|---|---|---|
| `access_token` | 15 minutes | Sent on every request; proves who you are |
| `refresh_token` | 30 days | Sent only to `/api/auth/refresh`; renews the access token |

Both are `httpOnly` (JavaScript in the browser can't read them),
`sameSite: "lax"`, `path: "/"`.

## Env vars (`.env`)

| Var | Used by |
|---|---|
| `PORT` | `index.js` — defaults to 8787 |
| `SUPABASE_URL` | `lib/supabase-admin.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-admin.js` |
| `JWT_ACCESS_SECRET` | `lib/jwt.js` |
| `JWT_REFRESH_SECRET` | `lib/jwt.js` |

## Database tables (Supabase Postgres, not in this repo — created via the SQL Editor)

- `demo_users (id uuid, email text unique, password_hash text, email_verified boolean, created_at timestamptz)`
- `demo_consumers (id, consumer_number, first_name, middle_name, last_name, email, account_status)`
