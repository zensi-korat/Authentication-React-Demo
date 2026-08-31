# JWT Auth From Scratch

Narrative companion to the auth code in `server/lib/jwt.js`, `server/lib/users.js`,
`server/routes/auth.js`, and `server/routes/consumers.js`. Where `HTTP-METHODS-GUIDE.md`
explains the fetch/HTTP side of this repo, this doc explains the auth side — built up
from zero, no prior knowledge of sessions or tokens assumed.

## 1. What problem does authentication solve?

HTTP is **stateless**: every request your browser sends is a totally isolated event.
When your browser calls `GET /api/consumers`, the Express server has no built-in way
to know "this is the same person who logged in a minute ago" — by default, a server
treats every request like it's from a total stranger.

Authentication is the mechanism that fixes this: prove who you are *once* (login),
then attach some kind of proof to every future request so the server can recognize
you without asking for your password again.

## 2. Sessions vs. tokens — two ways to "remember" someone

There are two classic approaches:

- **Server-side sessions**: after login, the server generates a random ID, stores
  "session abc123 = user demo-user-1" in its own memory/database, and gives the
  browser just that ID in a cookie. Every request, the server looks up the ID in its
  session store to find out who it belongs to.
- **Tokens (what this repo uses)**: after login, the server doesn't store anything.
  Instead it hands the browser a self-contained, signed piece of data that says "this
  is user demo-user-1" — and the server can verify that claim later using math, not a
  lookup. **JWT (JSON Web Token)** is the standard format for this.

The tradeoff: sessions are easy to revoke (delete the row) but need a shared store;
tokens need no server-side storage but are harder to revoke early (they're valid
until they expire, unless you build a revocation list). This repo uses tokens.

## 3. What a JWT actually looks like

Here's a real access token this app generated during login:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXItMSIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSIsImlhdCI6MTc4ODE3OTQ0MSwiZXhwIjoxNzg4MTgwMzQxfQ.W6R2URlGO9eAV5qNSAQexyW73rD7WS6Jh6sj4cDL9ow
```

Notice the two `.` characters — a JWT is always **three parts joined by dots**:

```
header.payload.signature
```

## 4. Decoding it by hand (this is NOT encryption)

Each of the first two parts is [Base64url](https://en.wikipedia.org/wiki/Base64)-encoded
JSON — not encrypted, just encoded, which is reversible by anyone with no secret
required. Try it yourself in a Node REPL:

```js
Buffer.from("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "base64url").toString()
// → {"alg":"HS256","typ":"JWT"}

Buffer.from("eyJzdWIiOiJkZW1vLXVzZXItMSIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSIsImlhdCI6MTc4ODE3OTQ0MSwiZXhwIjoxNzg4MTgwMzQxfQ", "base64url").toString()
// → {"sub":"demo-user-1","email":"demo@example.com","iat":1788179441,"exp":1788180341}
```

- **Header**: which algorithm was used to sign it (`HS256` = HMAC-SHA256).
- **Payload**: the actual claims — `sub` (subject = user id), `email`, `iat`
  (issued-at timestamp), `exp` (expiry timestamp). This is exactly what
  `signAccessToken()` in `server/lib/jwt.js` puts in.

**This is the single most important thing to internalize about JWTs: anyone who
intercepts this token can read the payload in two seconds.** That's why a JWT payload
should never contain a password, a credit card number, or anything secret — only
non-sensitive identity claims. The security doesn't come from hiding the data; it
comes from the third part.

## 5. The signature — what actually makes it trustworthy

The third part, the signature, is computed like this (simplified):

```
signature = HMAC-SHA256(header + "." + payload, SECRET)
```

`SECRET` is `JWT_ACCESS_SECRET` in `server/.env` — a random string only the server
knows. `jwt.sign(...)` in `server/lib/jwt.js` computes this signature and appends it.
Later, `jwt.verify(token, SECRET)` **recomputes** the same signature from the token's
header+payload and checks it matches the one attached to the token.

If even one character of the header or payload changes, the recomputed signature
comes out completely different — so tampering is instantly detectable. Proven live in
this repo's own build process:

```
verify(original token)             → { sub: 'demo-user-1', email: '...', iat: ..., exp: ... }
verify(same token, 1 char flipped) → null
```

That's `verifyAccessToken()` returning `null` because `jwt.verify` throws internally
when the signature doesn't match, and we catch it. **Nobody without the secret can
forge a valid signature for arbitrary data** — that's the entire trust model.

## 6. Passwords: why bcrypt instead of storing them directly

`server/lib/users.js` never stores a plaintext password — only a `passwordHash` like
`$2a$10$dNfOaSaK2YZ.vBiz0f2J0OUbseaSdUEiKEcij7UQfagSXRnKiYOJm`. Two properties make
bcrypt right for this:

1. **One-way**: there's no `bcrypt.decrypt()`. You can't turn a hash back into the
   original password — you can only hash a *guess* and compare hashes.
2. **Salted**: bcrypt bakes a random salt into every hash, so hashing `"Demo1234!"`
   twice produces two *different* strings. This defeats precomputed "rainbow table"
   lookups. `bcrypt.compareSync(password, hash)` still correctly matches because the
   salt is stored inside the hash string itself.

Login (`POST /api/auth/login`) calls `bcrypt.compareSync(password, user.passwordHash)`.
Signup (`POST /api/auth/signup`) calls `bcrypt.hashSync(password, 10)` before ever
storing anything — the plaintext password that arrived in the request body is never
persisted anywhere, even in memory, past that single request.

## 7. Access tokens vs. refresh tokens — why two?

A single long-lived token is convenient (rarely have to log in again) but dangerous
if stolen (valid for a long time). A single short-lived token is safer but annoying
(constant re-logins). This repo uses **two tokens to get both properties**:

| | Access token | Refresh token |
|---|---|---|
| Lifespan | 15 minutes | 30 days |
| Sent on | Every request (`/api/auth/me`, `/api/consumers/*`) | Only `/api/auth/refresh` |
| Secret | `JWT_ACCESS_SECRET` | `JWT_REFRESH_SECRET` (different!) |
| Payload | `{ sub, email }` | `{ sub }` only |

When the access token expires, the client can call `POST /api/auth/refresh` with just
the refresh-token cookie; the server verifies it and mints a brand-new access token —
no password re-entry needed. Using **different secrets** means a leaked access secret
can't be used to forge refresh tokens, and vice versa — two independent trust
boundaries instead of one.

## 8. Why httpOnly cookies instead of localStorage

Both tokens are set via `res.cookie(name, token, { httpOnly: true, ... })`. `httpOnly`
means: **JavaScript running on the page cannot read this cookie** (`document.cookie`
won't show it) — only the browser engine can, and only to auto-attach it on requests
to the same origin. Compare that to storing a token in `localStorage`, which *any*
script running on the page can read — including a malicious script injected via an
XSS bug in some unrelated part of the app. That's why `client/src/features/auth/useAuth.tsx`
never touches a token string directly; it just calls `fetch("/api/auth/me")` and lets
the browser handle cookie delivery automatically (same-origin, via the Vite proxy —
see `HTTP-METHODS-GUIDE.md`).

## 9. Local verification vs. delegated verification

This app used to hand its access token to Supabase's servers on every request
(`supabaseAnon.auth.getUser(token)`) — a network round-trip, every single time, just
to answer "is this token still valid?" Now `requireAuth` in `server/routes/consumers.js`
calls `verifyAccessToken(token)`, which is pure local computation (recompute the
HMAC, compare strings) — **zero network calls**. This is the core payoff of
understanding JWTs: the server can authenticate a request entirely on its own,
using only the secret it already holds.

## 10. Signup: creating a new account

`POST /api/auth/signup` (body: `{ email, password }`):

1. Validates the email looks roughly right and the password is ≥8 characters.
2. Rejects if the email is already registered (`findUserByEmail`).
3. Hashes the password with `bcrypt.hashSync(password, 10)`.
4. Pushes `{ id, email, passwordHash }` onto the in-memory `users` array
   (`server/lib/users.js`) via `addUser()`.
5. Responds `201 { message: "Account created" }` — it does **not** log the user in;
   they're redirected to `/login` to sign in with their new credentials.

Because there's no database, new accounts live only in server memory and disappear
on restart — the hardcoded demo account (`demo@example.com`) is defined directly in
`users.js`'s source, so it always survives. Swapping the in-memory array for a real
users table is the natural next step once you're comfortable with the mechanics here.

## 11. Where every concept lives in the code

| Concept | File |
|---|---|
| Sign/verify JWTs | `server/lib/jwt.js` |
| User store, password hashes | `server/lib/users.js` |
| Login, signup, logout, refresh, /me | `server/routes/auth.js` |
| Route-level auth guard (`requireAuth`) | `server/routes/consumers.js` |
| Client login form | `client/src/components/login-page.tsx` |
| Client signup form | `client/src/components/signup-page.tsx` |
| Client auth state (`/api/auth/me` on mount) | `client/src/features/auth/useAuth.tsx` |
| Client route guard (UX only, not security) | `client/src/components/require-auth.tsx` |
| Same-origin proxy so cookies just work | `client/vite.config.ts` |

## 12. Full request lifecycle, end to end

1. `POST /api/auth/signup` → account created (bcrypt hash stored in memory).
2. `POST /api/auth/login` → password checked with `bcrypt.compare` → two JWTs signed
   → set as httpOnly cookies → `{user}` returned.
3. `GET /api/auth/me` (on every page load) → reads `access_token` cookie →
   `jwt.verify` locally → `{user}` or 401.
4. `GET/POST/PUT/PATCH/DELETE /api/consumers*` → `requireAuth` middleware → same
   local `jwt.verify` → `next()` or 401.
5. Access token expires after 15 minutes → `POST /api/auth/refresh` using the
   refresh-token cookie → new access-token cookie minted, no password needed.
6. `POST /api/auth/logout` → both cookies cleared.
