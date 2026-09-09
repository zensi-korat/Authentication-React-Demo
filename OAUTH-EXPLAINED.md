# Google OAuth, Line by Line

A plain-English walkthrough of the "Continue with Google" flow added in
M14 (`AUTH-LEARNING-MILESTONES.md`) — `server/lib/google-oauth.js`, the two
new routes in `server/routes/auth.js`, and every client piece that touches
this flow: `google-signin-button.tsx`, and the small additions to
`login-page.tsx` / `signup-page.tsx`. `JWT-AUTH-FROM-SCRATCH.md` covers your
own hand-rolled JWTs; this file covers a different trust problem — accepting
*someone else's* signed identity claim — and how it hands off into the exact
same session machinery you already built. Read alongside the real files.

## What problem this solves, and how it's different from everything else in this app

Every other flow in this repo is a request from already-running React code:
`api.post("/auth/login", ...)`, `api.get("/auth/me")` — the SPA never stops
running, state updates in place. OAuth can't work that way. Your app can
never see a user's Google password directly (that's the entire point), so
Google has to authenticate the user on **its own page**, and the only way to
hand control back to your app afterward is a real browser redirect — the SPA
physically unloads, Google's page takes over, then a second redirect brings
the browser back. There is no axios call anywhere in this flow. It's cookies
and HTTP redirects, start to finish.

## The building blocks — `server/lib/google-oauth.js`

```js
const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);
```

The one non-hand-rolled piece in this app's auth system, and deliberately
so. Your own `access_token`/`refresh_token` are HS256 — one shared secret,
`jwt.verify` recomputes the same HMAC and compares strings
(`JWT-AUTH-FROM-SCRATCH.md` §5). Google signs its `id_token` with **RS256**
against a *rotating public key set* (JWKS) — verifying that correctly means
fetching Google's current public keys, matching the right one by `kid`,
caching them, and re-fetching when they rotate. `google-auth-library` is
Google's own official client that does all of that; hand-rolling it would be
a lot of plumbing for zero additional teaching value beyond what HS256
already covers. Same category of call as this app already using
`@supabase/supabase-js` instead of hand-rolling the Postgres wire protocol.

```js
export function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
```

Builds the URL the browser gets redirected to. `response_type: "code"` asks
for the **authorization code flow** specifically (as opposed to older,
less-safe flows that hand back tokens directly in the URL). `scope: "openid email profile"`
is what makes Google mint an `id_token` at all — `openid` is what turns
plain OAuth into OpenID Connect (identity, not just API access);
`email`/`profile` add the claims you actually want back. `state` is passed
straight through untouched — Google's job is just to echo it back later,
not to interpret it.

```js
async function exchangeCodeForTokens(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  ...
  return res.json(); // { id_token, access_token, expires_in, ... }
}
```

This is **server-to-server** — plain `fetch` (Node's global, no HTTP
dependency needed) calling Google directly, not something the browser ever
sees. This is *why* the `code` in the callback URL is safe to sit there
briefly in plaintext (visible in browser history, maybe a server access log):
it's genuinely useless on its own. Trading it for real tokens requires
`GOOGLE_CLIENT_SECRET`, which only lives here, server-side, never shipped to
the browser bundle — same handling as `SUPABASE_SERVICE_ROLE_KEY`
(`server/lib/supabase-admin.js`). `redirect_uri` has to be sent again here
and must match the one used in `buildGoogleAuthUrl` *exactly* — Google
checks this to make sure the code is being redeemed by the same party that
requested it.

```js
export async function verifyGoogleAuthCode(code) {
  const { id_token: idToken } = await exchangeCodeForTokens(code);

  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload.email_verified) {
    throw new Error("Google account email is not verified");
  }

  return { googleId: payload.sub, email: payload.email, name: payload.name };
}
```

`verifyIdToken` does three checks at once: the RS256 signature (is this
really from Google, unaltered?), the `audience` (was this token issued *for
your app specifically*, not some other app that also uses Google login —
without this check, a token meant for a different site could be replayed
against yours), and the token's own `exp`/`iss` claims. `payload.email_verified`
is one more manual check on top: even though this exact token just arrived
over a direct TLS call to Google (not passed through the user's browser,
where it could theoretically be swapped), the code still doesn't take
Google's word for the email being real without checking that specific flag
— defense in depth, cheap to add, matches this app's general instinct to
double-check rather than assume (see the OTP flow's redundant `isExpired`
check for the same reflex).

## The redirect launch — `GET /google`

```js
authRouter.get("/google", (_req, res) => {
  const state = randomBytes(16).toString("hex");

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: FIVE_MINUTES_MS,
  });

  res.redirect(buildGoogleAuthUrl(state));
});
```

`randomBytes(16).toString("hex")` — a value nobody could guess, generated
fresh for this one login attempt. It's stored in a cookie *and* embedded in
the URL Google will redirect back to, so `GET /google/callback` can later
prove "this callback is answering the exact request I just made," not one
an attacker tricked the browser into starting. This is CSRF protection for
the OAuth handshake itself: without it, an attacker could start their own
OAuth flow, capture the resulting `code`, then get a victim's browser to hit
your callback URL with that code — silently logging the victim into the
attacker's Google account. `res.redirect(...)` sends a real `302`, which is
what makes the *browser itself* (not any JS) navigate to Google.

Note this route is a `GET`, not the `POST`s every other auth action in this
app uses. That's not a style choice — a redirect triggered by
`window.location.href` is a normal browser navigation, and navigations are
always `GET` requests. There's no body to send, either; everything this
route needs comes from server-side env vars.

## The callback — `GET /google/callback`

```js
const { code, state } = req.query;
const expectedState = req.cookies[OAUTH_STATE_COOKIE];
res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" }); // single-use, like an OTP

if (
  typeof code !== "string" ||
  typeof state !== "string" ||
  !expectedState ||
  state !== expectedState
) {
  return res.redirect(`${CLIENT_ORIGIN}/login?error=oauth_failed`);
}
```

The cookie is cleared **unconditionally**, before the check even runs — same
"invalidate immediately, whether or not this attempt succeeds" instinct as
`issueOtp()` consuming old codes. `state !== expectedState` is the CSRF
check actually happening: does what Google just echoed back match what this
exact browser was given a moment ago? Any mismatch — missing cookie
(expired after 5 minutes, or a stale/replayed callback URL), wrong type, or
a straight-up mismatch — gets the *same* generic failure redirect, not a
specific error message, so a bad actor probing this endpoint learns nothing
about which check failed.

```js
try {
  const { email } = await verifyGoogleAuthCode(code);

  const { data: existingUser } = await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, email, email_verified")
    .eq("email", email)
    .maybeSingle();

  let user = existingUser;

  if (!user) {
    const { data: newUser } = await supabaseAdmin
      .from(USERS_TABLE)
      .insert({ email, password_hash: null, email_verified: true })
      .select("id, email, email_verified")
      .single();
    user = newUser;
  } else if (!user.email_verified) {
    await supabaseAdmin.from(USERS_TABLE).update({ email_verified: true }).eq("id", user.id);
  }

  setAuthCookies(res, user);
  res.redirect(CLIENT_ORIGIN);
} catch (err) {
  console.error("Google OAuth callback failed:", err.message);
  res.redirect(`${CLIENT_ORIGIN}/login?error=oauth_failed`);
}
```

This is **account linking by email** — three possible outcomes:

1. **No existing row** → a brand-new Google-only account:
   `password_hash: null` (there's no password to hash — Google is the only
   way into this account) and `email_verified: true` immediately. No OTP
   round-trip needed, because Google already did the work M12's whole OTP
   flow exists to do: prove this email belongs to whoever is logging in.
   This is the direct payoff of `email_verified` being a real, load-bearing
   column instead of a cosmetic one — the *same* flag gets set by two
   completely different verification methods.
2. **Existing row, already verified** → just log into it. Someone who signed
   up with a password can later use "Continue with Google" with the same
   email and land in the *same* account, not a duplicate.
3. **Existing row, not yet verified** (signed up with a password, never
   finished the OTP step) → flip `email_verified` to `true` here too.
   Google's proof is at least as strong as completing the OTP flow, so there's
   no reason to make them do both.

`setAuthCookies(res, user)` — the shared helper both this route and
`POST /login` call. This is the line that makes the earlier claim literally
true: **OAuth only replaces "how do we know this is really them."**
Everything after this point — signing a JWT, setting it httpOnly, the 15
minute/30 day split — is identical code, not just identical behavior, to a
password login.

The whole block is wrapped in one `try/catch` — any failure at any step
(bad code, Google API error, unverified email, a DB error) falls through to
the exact same `oauth_failed` redirect as the `state` mismatch above.
`console.error` logs the real reason server-side (so *you* can debug it),
while the user just sees a generic "try again" — same asymmetry as OTP's
"Invalid or expired code" covering multiple distinct failure reasons with
one message.

## Frontend integration, end to end

Here's the part with almost no code, because almost none is needed — and
understanding *why* so little client code exists is the actual lesson.

### 1. The button — `google-signin-button.tsx`

```tsx
<Button
  type="button"
  onClick={() => {
    window.location.href = "/api/auth/google";
  }}
>
```

`type="button"` matters because this button renders *inside*
`login-page.tsx`'s `<form onSubmit={handleSubmit}>`, right alongside the
"Sign in" submit button — without it, clicking "Continue with Google" would
also fire the password form's submit handler (same fix as the OTP page's
"Resend code" button needed). `window.location.href = "/api/auth/google"` is
a **hard navigation** — not `useNavigate()`, not `api.get(...)`. This one
line is the entire client-side trigger for the whole flow; everything after
it happens outside React's control.

### 2. The browser leaves the SPA (steps with no client code at all)

The browser requests `GET /api/auth/google`. Vite's dev proxy forwards it to
Express — same proxy every axios call already relies on, just now carrying
a real page navigation instead of a fetch. `GET /google`'s `302` sends the
browser to `accounts.google.com` — the entire React app is now frozen and
about to be torn down; no component is rendering or reacting to anything.
You approve on Google's own page (code you don't control or need to). Google
redirects back to `GOOGLE_REDIRECT_URI`
(`http://localhost:5173/api/auth/google/callback?code=...&state=...`) —
back on your client's origin by design, proxied to Express again, where
`GET /google/callback` does everything described above and finishes with
`res.redirect(CLIENT_ORIGIN)` → `http://localhost:5173/`.

### 3. The SPA reboots — no explicit "OAuth callback handler" in React

This is the step that surprises people coming from libraries like
`@react-oauth/google`, which hand you a token in JS that you'd normally post
via `axios` yourself. Here, that entire "receive and use the result"
responsibility is handled server-side before the browser ever gets back to
your app. Landing on `http://localhost:5173/` after that last redirect is a
**full page load** — Vite serves `index.html` fresh, and the whole React
tree mounts from scratch, same as opening a brand-new tab:

```tsx
// App.tsx
<AuthProvider>
  <Routes>...</Routes>
</AuthProvider>
```

```tsx
// features/auth/useAuth.tsx
useEffect(() => {
  load(); // fires once, on this fresh mount
}, []);

const load = async () => {
  const { data } = await api.get<{ user: AuthUser }>("/auth/me");
  setUser(data.user);
};
```

Compare this to the password-login success path in `login-page.tsx`, which
explicitly calls `await refresh(); navigate("/")` from inside an
*already-running* app. OAuth never calls either of those — a full remount
does the equivalent job for free: `AuthProvider` mounting for the first time
is what triggers `GET /auth/me`, and because the browser is back on
`localhost:5173`, the `access_token` cookie the callback just set is
attached automatically (same-origin, same as every other request in this
app). The server verifies it locally, returns `{ user }`, `setUser` fires,
and `App.tsx`'s routing (`RequireAuth` watching `useAuth()`) renders the
dashboard instead of `/login` — indistinguishable, from here, from a normal
password login that just finished.

### 4. The one thing client code *does* handle: failure

```tsx
// login-page.tsx
useEffect(() => {
  if (searchParams.get("error") === "oauth_failed") {
    toast.error("Google sign-in failed. Please try again.");
  }
}, [searchParams]);
```

If the callback hit any failure, the redirect target is
`/login?error=oauth_failed` instead of `/`. This `useEffect` — reading the
query param via `useSearchParams`, same pattern `verify-email-page.tsx` uses
for `?email=` — is the *only* client-side reaction to that whole failure
path. There's no `.catch()` here, because nothing on the client ever made a
request that could reject; the "request" was the entire redirect chain, and
its only visible trace back in React is this one query param.

## The full sequence, start to finish

1. User clicks "Continue with Google" → `window.location.href = "/api/auth/google"`.
2. `GET /google` → random `state` set in a 5-minute cookie → `302` to Google.
3. User approves on Google's own page (outside your app entirely).
4. Google `302`s to `GET /google/callback?code=...&state=...`.
5. Server checks `state` against the cookie, exchanges `code` server-to-server
   for an `id_token`, verifies its signature/audience/`email_verified` via
   `google-auth-library`.
6. Finds-or-creates the `demo_users` row by email; flips `email_verified` to
   `true` either way if it wasn't already.
7. `setAuthCookies()` — the exact same access/refresh JWT cookies
   `POST /login` sets.
8. `302` to `http://localhost:5173/` → full SPA remount → `AuthProvider`'s
   normal `GET /auth/me` on mount picks up the now-set cookies → dashboard
   renders.
9. On any failure at steps 4–7, `302` to `/login?error=oauth_failed` instead
   — the SPA still remounts fresh, but `login-page.tsx`'s `useEffect` reads
   that query param and shows a toast.
