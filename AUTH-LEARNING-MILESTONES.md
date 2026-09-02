# Auth Learning Milestones

A running curriculum for learning authentication end-to-end in this repo, from zero.
Each milestone has a concept to understand and something real to build/run. Revisit
this file any time to see where we are or refresh a past topic.

Status legend: ⬜ not started · 🔶 in progress · ✅ done

## Backend foundations

- ✅ **M1 — What authentication solves.** HTTP is stateless; every request arrives
  with no memory of past ones. Auth = prove identity once, carry proof forward.
- ✅ **M2 — JWT deep dive.** header.payload.signature, base64url ≠ encryption,
  HMAC signing/verifying, why tampering breaks the signature.
- ✅ **M3 — Real user storage (Supabase table).** Created `demo_users` (email,
  password_hash, email_verified, created_at) so accounts persist across restarts.
  Verified reachable via `supabase-admin.js` (0 rows, as expected on a fresh table).
- ✅ **M4 — Password hashing with bcrypt.** One-way hashing, salting (same
  password hashed twice → different strings, both still verify), why cost
  factor 10 makes brute-forcing deliberately slow.
- ✅ **M5 — Signup, rebuilt.** `POST /api/auth/signup` inserts into the real
  Supabase table via `supabase-admin.js`; bcrypt-hashes the password first;
  duplicate emails rejected by Postgres's own `unique` constraint (code 23505).
- ✅ **M6 — Login, rebuilt.** Looks up the Supabase row by email, `bcrypt.compare`
  against `password_hash`, signs a JWT (`sub`, `email`), sets it as an httpOnly
  cookie. Wrong password and nonexistent email return the identical generic
  error, so the response can't be used to enumerate registered emails.
- ✅ **M7 — httpOnly cookies.** `HttpOnly` blocks `document.cookie`/page JS from
  ever reading the token (the main XSS-theft defense); `SameSite=Lax` defends
  against CSRF; `Max-Age`/`Path` control lifetime and scope. Contrasted against
  the `localStorage` + `Authorization` header alternative and why it's riskier.
- ✅ **M8 — Access vs. refresh tokens.** Login now sets both cookies (15min
  access, 30day refresh). `POST /api/auth/refresh` verifies the refresh cookie,
  re-fetches the user from Supabase by id, and mints a new access token —
  verified working with ONLY the refresh cookie present, no password needed.
- ✅ **M9 — Protecting routes.** `GET /api/auth/me` and `requireAuth` in
  `consumers.js` both restored to local `verifyAccessToken` checks (no network
  call). Full cycle verified: login → /me → /consumers (200) → logout →
  /me (401) → /consumers (401). Backend is fully rebuilt end-to-end on Supabase.

## Frontend integration

> Reset to bare stubs (no fetch calls, no real auth state) so we rebuild each
> piece from scratch instead of reading pre-written code: `login-page.tsx`,
> `signup-page.tsx`, `useAuth.tsx`, `require-auth.tsx`. The rest of the app
> (dashboard, sidebar, consumers CRUD) still runs — `RequireAuth` currently
> lets everyone through unconditionally as a placeholder.

- ✅ **M10 — Frontend auth integration.** Rebuilt `useAuth.tsx` (Context +
  `/api/auth/me` on mount), `require-auth.tsx` (redirect guard, UX only — real
  enforcement is server-side M9), and real `fetch` calls in `login-page.tsx` /
  `signup-page.tsx`. Verified end-to-end through the Vite proxy (port 5173),
  cookies flowing correctly.
- ⬜ **M11 — Axios + interceptors.** Migrating from raw `fetch` to `axios`; request
  interceptors (attaching credentials) and response interceptors (catching a 401,
  silently calling `/api/auth/refresh`, retrying the original request) — the
  standard way real apps handle silent token refresh.

## Account lifecycle features

- ⬜ **M12 — OTP fundamentals.** One-time codes: generate, store with expiry,
  verify, invalidate after use. Applied to email verification at signup.
- ⬜ **M13 — Forgot password.** Reusing the OTP pattern to let a user reset their
  password without knowing the old one, safely.

## Beyond this app

- ⬜ **M14 — OAuth (concept + how it'd integrate).** Third-party login (e.g.
  "Sign in with Google"): what a redirect flow is, what an authorization code is,
  how the app would exchange it for its own session — how this differs from the
  password+JWT flow we built ourselves.

---
*Update the status markers as we complete each milestone.*
