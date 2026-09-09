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
│   ├── otp.js             Generate/hash/compare OTP codes (pure, no DB)
│   ├── google-oauth.js    Build the Google redirect URL, exchange a code, verify the id_token
│   └── supabase-admin.js  The one Supabase client — talks to Postgres directly
└── routes/
    ├── auth.js            signup, verify-otp, resend-otp, login, google, google/callback, logout, me, refresh
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
| `POST /signup` | Validate input → `bcrypt.hashSync` the password → insert a row into `demo_users` (`email_verified: false`) → generate + store a hashed OTP → console.log the raw code (stand-in for a real email service) and also echo it back as `devCode` in the response so the client can print it too. Rejects duplicate emails (Postgres `unique` constraint, error code `23505`). |
| `POST /verify-otp` | Look up the user's latest un-consumed `email_verification` OTP row → check expiry + `compareOtp` against the hash → mark it consumed → flip `demo_users.email_verified` to true. |
| `POST /resend-otp` | Re-runs the same generate/invalidate-old/store/console.log flow as signup. Always returns the same generic message, verified or not, so it can't be used to probe which emails are registered. |
| `POST /login` | Look up the row by email → `bcrypt.compareSync` the password (guarded against a `null` `password_hash` for Google-only accounts) → reject with `403 { code: "EMAIL_NOT_VERIFIED" }` if `email_verified` is false → sign both tokens → set them as httpOnly cookies → return `{ user }` (never the token itself). |
| `GET /google` | Full browser redirect (not called via axios) → generates a random `state`, stores it in a short-lived `oauth_state` cookie, redirects to Google's consent screen. |
| `GET /google/callback` | Google redirects here with `code` + `state` → checks `state` against the cookie → exchanges `code` + verifies the `id_token` (`lib/google-oauth.js`) → finds/creates the `demo_users` row by email (`password_hash: null`, `email_verified: true` for new rows) → same `setAuthCookies` as `/login` → redirects to the dashboard, or to `/login?error=oauth_failed` on any failure. |
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
| `oauth_state` | 5 minutes | Set by `GET /google`, checked (and cleared) by `GET /google/callback` — CSRF protection for the OAuth redirect, not a session cookie |

All three are `httpOnly` (JavaScript in the browser can't read them),
`sameSite: "lax"`, `path: "/"`.

## Env vars (`.env`)

| Var | Used by |
|---|---|
| `PORT` | `index.js` — defaults to 8787 |
| `SUPABASE_URL` | `lib/supabase-admin.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-admin.js` |
| `JWT_ACCESS_SECRET` | `lib/jwt.js` |
| `JWT_REFRESH_SECRET` | `lib/jwt.js` |
| `GOOGLE_CLIENT_ID` | `lib/google-oauth.js` |
| `GOOGLE_CLIENT_SECRET` | `lib/google-oauth.js` — server-only, never sent to the browser |
| `GOOGLE_REDIRECT_URI` | `lib/google-oauth.js` — must exactly match the redirect URI registered in the Google Cloud Console client |

## Database tables (Supabase Postgres, not in this repo — created via the SQL Editor)

- `demo_users (id uuid, email text unique, password_hash text NULLABLE, email_verified boolean, created_at timestamptz)` —
  `password_hash` was made nullable to support Google-only accounts (no local
  password ever set): `alter table demo_users alter column password_hash drop not null;`
- `demo_consumers (id, consumer_number, first_name, middle_name, last_name, email, account_status)`
- `demo_otps (id uuid, user_id uuid references demo_users, purpose text, code_hash text, expires_at timestamptz, consumed_at timestamptz, created_at timestamptz)` —
  `purpose` is `"email_verification"` today; M13 (forgot password) will reuse this
  same table with `purpose: "password_reset"`. `consumed_at` is null while the
  code is still valid.
