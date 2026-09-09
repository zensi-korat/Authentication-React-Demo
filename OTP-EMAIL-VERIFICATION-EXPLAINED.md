# OTP Email Verification, Line by Line

A plain-English walkthrough of the OTP (one-time password) flow added in M12
(`AUTH-LEARNING-MILESTONES.md`) — `server/lib/otp.js`, the new routes in
`server/routes/auth.js`, and every client piece that drives them:
`App.tsx`'s routing, `signup-page.tsx`, `verify-email-page.tsx`,
`ui/otp-input.tsx`, and the `EMAIL_NOT_VERIFIED` handling in
`login-page.tsx`. `JWT-AUTH-FROM-SCRATCH.md` §11 covers the *concept* (why
hash it, why expire it, why single-use); this file covers the actual code,
statement by statement — server first, then a dedicated "Frontend
integration" section tracing the same data through every page in the order a
real user hits them. Read alongside the real files.

## What problem this solves

A password proves you know a secret. It does **not** prove the email address
typed at signup belongs to you — anyone can type `you@company.com` without
ever receiving mail there. An OTP closes that gap: a short code sent to the
address, which only the real owner can read back and type in.

## The building blocks — `server/lib/otp.js`

```js
const OTP_EXPIRY_MS = 10 * 60 * 1000;

export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
```

- `randomInt(0, 1_000_000)` — Node's built-in `crypto.randomInt`, not
  `Math.random()`. This matters: `Math.random()` is not cryptographically
  secure (its internal state can, in principle, be predicted), and a
  guessable OTP defeats the entire point of the check. `randomInt` draws from
  the OS's secure random source, same category of guarantee as
  `JWT_ACCESS_SECRET` itself.
- `.padStart(6, "0")` — `randomInt(0, 1_000_000)` can return `0` through
  `999999`. Without padding, the number `817` would produce the 3-character
  string `"817"` instead of a 6-digit code like `"000817"`. Padding keeps
  every code exactly 6 characters, which is what `OtpInput` and the
  `code.length !== CODE_LENGTH` check on the client both assume.

```js
export function hashOtp(code) {
  return bcrypt.hashSync(code, 10);
}

export function compareOtp(code, hash) {
  return bcrypt.compareSync(code, hash);
}
```

Exactly the same `bcrypt` calls `server/routes/auth.js` already uses for
passwords, applied to OTP codes instead. The reasoning carries over
unchanged: `hashOtp` is one-way (no `bcrypt.decrypt()`), so if the
`demo_otps` table ever leaked, the raw 6-digit codes still wouldn't be
readable from it — only `compareOtp` can confirm a guess matches, not
reverse the hash back into the code.

```js
export function otpExpiresAt() {
  return new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
}
```

A timestamp 10 minutes in the future, as an ISO string — the shape
Postgres's `timestamptz` column expects. Called once per OTP, at the moment
it's created, so `expires_at` is always "10 minutes from *when this code was
issued*," not from some fixed point.

Notice this whole file has **no** `supabaseAdmin` import and makes no
database calls — same division of labor as `lib/jwt.js`: pure functions here,
DB orchestration in the route handlers.

## Issuing a code — `issueOtp()` in `routes/auth.js`

```js
async function issueOtp({ userId, email, purpose }) {
  await supabaseAdmin
    .from(OTPS_TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("consumed_at", null);
```

Before creating a new code, this **invalidates every still-active code** for
this exact user + purpose by stamping a `consumed_at` on it. `.is("consumed_at", null)`
means "only rows that haven't already been consumed" — so this is a no-op
the very first time (nothing to invalidate yet), but on a "resend," it makes
sure the *previous* code stops working the instant a new one is issued.
Without this, both the old and new code would be valid simultaneously, which
is confusing to reason about and unnecessarily widens the attack window.

```js
  const code = generateOtp();

  const { error } = await supabaseAdmin.from(OTPS_TABLE).insert({
    user_id: userId,
    purpose,
    code_hash: hashOtp(code),
    expires_at: otpExpiresAt(),
  });

  if (error) throw error;
```

Generates the code, then inserts a row storing only `hashOtp(code)` — the
raw `code` variable never touches the database. `purpose` is a plain string
(`"email_verification"` today); it exists so the exact same table and this
exact same function can be reused for a different flow later (M13's "forgot
password" would call this with `purpose: "password_reset"` instead) without
needing a second table or a second copy of this logic.

```js
  console.log(
    `[DEV] Verification code for ${email}: ${code} — a real app would email this instead of logging it`,
  );

  return code;
}
```

This is the "sending" step — except this demo has no email provider wired
up (no SendGrid/Resend API key, no new dependency), so it prints the code to
the server terminal instead, clearly labeled `[DEV]` so it reads as an
obvious stand-in rather than real behavior. `return code` hands the raw code
back to whichever route called `issueOtp` — that's what makes the
`devCode` trick below possible.

## Why the code is deliberately echoed back to the browser

```js
// routes/auth.js — POST /signup
const devCode = await issueOtp({ userId: user.id, email: user.email, purpose: EMAIL_VERIFICATION_PURPOSE });

res.status(201).json({
  message: "Account created. Check your email for a verification code.",
  devCode, // demo-only convenience; see the comment on issueOtp()
});
```

`POST /resend-otp` does the identical thing. Normally an API response would
**never** contain a verification code — the entire security property of an
OTP rests on it only ever reaching the one inbox it was sent to. This app
breaks that rule on purpose, only because there's no real inbox to check:
`devCode` is a clearly-named field that only exists so the demo is usable
without an email account. The client-side code that reads it
(`verify-email-page.tsx`, `signup-page.tsx`) is written to match — see below.

```js
// client — signup-page.tsx / verify-email-page.tsx
const { data } = await api.post<{ devCode?: string }>("/auth/signup", { email, password });
if (data.devCode) {
  console.log(`[DEV] Verification code for ${email}: ${data.devCode}`);
}
```

Both the server terminal *and* the browser devtools console print the same
code — the browser console.log is just a second, more convenient copy of the
exact same "email" for whoever is testing this locally.

## Verifying a code — `POST /verify-otp`

```js
const { data: user, error: userError } = await supabaseAdmin
  .from(USERS_TABLE)
  .select("id, email_verified")
  .eq("email", email)
  .maybeSingle();

if (!user) return res.status(400).json({ message: "Invalid or expired code" });
if (user.email_verified) return res.status(400).json({ message: "Email is already verified" });
```

Two early exits before ever looking at `demo_otps`: no matching user (bad
email), or already verified (nothing to do — verifying twice isn't an
error condition worth a special message).

```js
const { data: otp } = await supabaseAdmin
  .from(OTPS_TABLE)
  .select("id, code_hash, expires_at")
  .eq("user_id", user.id)
  .eq("purpose", EMAIL_VERIFICATION_PURPOSE)
  .is("consumed_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

Finds the OTP row to check against — but notice there's no `code` filter
here. The lookup is by `user_id` + `purpose` + "not yet consumed," ordered
newest-first with `limit(1)`. Only *after* fetching that one row does the
code comparison happen. This is deliberate: comparing the hash in
application code (via `compareOtp`, which is `bcrypt.compareSync`) rather
than asking Postgres to filter `WHERE code_hash = ...` is the only way it
*can* work, since the submitted code and the stored hash are never equal as
strings — hashing isn't reversible, so the database can't match them itself.

```js
const isExpired = !otp || new Date(otp.expires_at).getTime() < Date.now();
const codeMatches = otp && compareOtp(code, otp.code_hash);

if (isExpired || !codeMatches) {
  return res.status(400).json({ message: "Invalid or expired code" });
}
```

Both checks must pass. Two things worth noticing:

- **The error message is identical either way** ("Invalid or expired
  code") whether the code was simply wrong, already used, or genuinely
  timed out. Same principle as login's "Invalid email or password" — a
  more specific message (e.g. "that code already expired 3 minutes ago")
  would leak information about *why* it failed, which isn't needed for a
  legitimate user and only helps someone probing the endpoint.
- `!otp` short-circuits `isExpired` to `true` before `new Date(otp.expires_at)`
  would crash on `undefined` — if there's no active code at all (never
  requested, or already consumed by a prior successful verify), that's
  treated the same as "expired," not a separate crash.

```js
await supabaseAdmin.from(OTPS_TABLE).update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
await supabaseAdmin.from(USERS_TABLE).update({ email_verified: true }).eq("id", user.id);
```

Two writes on success: mark **this specific row** consumed (so replaying the
same code a second time fails the `.is("consumed_at", null)` filter above
and falls through to "Invalid or expired code"), then flip
`email_verified` on the user. This is the entire payoff of the whole
feature — after this line, `POST /login`'s `if (!user.email_verified)`
check (see below) stops blocking this account.

## Where OTP verification actually blocks something — `POST /login`

```js
const { data: user } = await supabaseAdmin
  .from(USERS_TABLE)
  .select("id, email, password_hash, email_verified") // email_verified added for this feature
  .eq("email", email)
  .maybeSingle();

const passwordMatches = user && bcrypt.compareSync(password, user.password_hash);
if (!passwordMatches) return res.status(401).json({ message: "Invalid email or password" });

if (!user.email_verified) {
  return res.status(403).json({
    message: "Please verify your email before logging in",
    code: "EMAIL_NOT_VERIFIED",
  });
}
```

Order matters here: the password check happens **first**. If the check for
`email_verified` ran before the password check, a wrong password on an
unverified account would incorrectly report "please verify your email"
instead of "wrong password" — telling an attacker the account exists and is
just unverified, which is more information than a failed login should ever
reveal. Only after proving they know the password does the response
distinguish "unverified" from anything else.

`code: "EMAIL_NOT_VERIFIED"` is a machine-readable string, separate from the
human-readable `message`. This is what lets the client branch on the
*reason* for a 403 without parsing English text — see below.

## Frontend integration, end to end

Everything above is what the server does; this section is *only* the
client — how three pages and one reusable input work together to drive that
server through a full signup → verify → login journey. Read this section in
page order, the same order a real user hits them.

### 1. Routing — `App.tsx`

```tsx
<Route path="/login" element={<LoginPage />} />
<Route path="/signup" element={<SignupPage />} />
<Route path="/verify-email" element={<VerifyEmailPage />} />
<Route path="/" element={<DashboardLayout />}>
  ...
</Route>
```

`/verify-email` sits as a **flat, top-level route**, exactly like `/login`
and `/signup` — not nested inside `<DashboardLayout>`. That placement is the
whole reason it works for a logged-out user: routes nested under
`DashboardLayout` are guarded (only reachable once `useAuth` confirms a
session), but someone verifying a brand-new account has no session yet —
they don't get cookies until *after* login, which itself doesn't happen
until *after* verification. Putting this route at the same level as
`/login` is what makes it reachable at all during that gap.

### 2. Signup hands off to verification — `signup-page.tsx`

```tsx
const { data } = await api.post<{ devCode?: string }>("/auth/signup", { email, password });

if (data.devCode) {
  console.log(`[DEV] Verification code for ${email}: ${data.devCode}`);
}

toast.success("Account created. Check your email for a verification code.");
navigate(`/verify-email?email=${encodeURIComponent(email)}`);
```

Three things happen in sequence once signup succeeds:

1. **Print the dev code** — see the `devCode` explanation above. This only
   runs `if (data.devCode)` is truthy, so nothing breaks if that field is
   ever removed (e.g. once a real email provider is wired up and the server
   stops sending it).
2. **Toast** — a transient success notice, unrelated to navigation.
3. **`navigate(...)` with the email in the URL** — this is the hand-off.
   `SignupPage` and `VerifyEmailPage` are two *separate* components with no
   shared parent state; the only way to carry the just-typed email address
   from one to the other is to put it somewhere both can reach. A query
   string is the simplest option that also survives a manual page refresh
   (unlike React Router's `location.state`, which is lost on reload).
   `encodeURIComponent(email)` escapes characters like `@` and `+` that
   would otherwise corrupt the URL (`a+b@x.com` would become two separate
   query params without it).

### 3. Reading the email back out — `verify-email-page.tsx`

```tsx
const [searchParams] = useSearchParams();
const email = searchParams.get("email") ?? "";
```

The other half of the hand-off. `useSearchParams()` is React Router's hook
for reading `?key=value` pairs out of the current URL — `searchParams.get("email")`
reverses exactly what `signup-page.tsx` just encoded into the URL.
The `?? ""` matters for a case `signup-page.tsx` never produces but a user
still could: someone bookmarking or manually typing `/verify-email` with no
`?email=` at all. Without the fallback, `email` would be `null`, and the
`<span>{email}</span>` in the JSX would render nothing where an address is
expected — `""` at least keeps every downstream usage (the API call, the
`Verify now` link elsewhere) working with a predictable empty string instead
of `null`.

```tsx
const [code, setCode] = useState("");
const [error, setError] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [isResending, setIsResending] = useState(false);
```

Four independent pieces of state, each answering one question:

| State | Question it answers |
|---|---|
| `code` | What has the user typed so far? (fed to/from `OtpInput`) |
| `error` | Did the last verify attempt fail, and with what message? |
| `isSubmitting` | Is a *verify* request in flight? (disables the Verify button, freezes the boxes) |
| `isResending` | Is a *resend* request in flight? (disables only the Resend button) |

Two separate booleans (`isSubmitting`/`isResending`) rather than one shared
"loading" flag is deliberate: verify and resend are two different network
calls that can't happen at the same time from the same click, but keeping
them separate means clicking "Resend" doesn't visually disable/relabel the
*Verify* button (and vice versa) — each button only reacts to the request
it actually triggered.

```tsx
async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setError(null);
  setIsSubmitting(true);
  try {
    await api.post("/auth/verify-otp", { email, code });
    toast.success("Email verified. Sign in to continue.");
    navigate("/login");
  } catch (err) {
    const message = isAxiosError<{ message?: string }>(err)
      ? (err.response?.data?.message ?? "Verification failed")
      : "Something went wrong.";
    setError(message);
    toast.error(message);
  } finally {
    setIsSubmitting(false);
  }
}
```

Same `try/catch/finally` shape as `login-page.tsx` and `signup-page.tsx` —
this app repeats this pattern by hand at every call site rather than
centralizing it (see `CLAUDE.md`: the duplication is intentional and
pedagogical). On success, it doesn't just show a toast — it **navigates to
`/login`**, because verifying alone doesn't log anyone in; the user still
needs to submit their password one more time now that `email_verified` is
`true` server-side.

```tsx
async function handleResend() {
  setIsResending(true);
  try {
    const { data } = await api.post<{ devCode?: string }>("/auth/resend-otp", { email });
    if (data.devCode) {
      console.log(`[DEV] Verification code for ${email}: ${data.devCode}`);
    }
    toast.success("If that account needs verification, a new code was sent.");
  } catch {
    toast.error("Something went wrong.");
  } finally {
    setIsResending(false);
  }
}
```

Notice this `catch` block takes no `(err)` parameter and shows one fixed
message, unlike `handleSubmit`'s. That's intentional, not an oversight: the
server's `/resend-otp` always responds `200` with the same generic message
whether or not the email exists (see the server section above) specifically
so this endpoint can't be used to probe which emails are registered — there
is no server-provided error detail *to* surface here, so the client doesn't
pretend otherwise.

```tsx
<OtpInput length={CODE_LENGTH} value={code} onChange={setCode} disabled={isSubmitting} />
...
<Button type="submit" disabled={isSubmitting || code.length !== CODE_LENGTH}>
```

This is where `code` (a plain string) meets the 6-box UI: `OtpInput` is used
exactly like any controlled `<input>` — `value={code}` flows in,
`onChange={setCode}` flows out, and the page never has to know it's
rendering 6 DOM elements instead of 1. `disabled={isSubmitting}` freezes
every box while a request is in flight, so a user can't edit the code
mid-submit. The Verify button adds one more guard, `code.length !== CODE_LENGTH`
— submitting a 3-digit code would just come back as "Invalid or expired
code" from the server anyway, but catching it client-side avoids a wasted
round-trip and gives instant feedback (the button simply won't respond)
instead of a network delay before the same rejection.

The rest of the JSX is the visible shell around that logic:

```tsx
<CardDescription>
  Enter the 6-digit code we sent to <span className="font-medium">{email}</span>.
  <br />
  <span className="text-xs">
    (Demo mode: this app has no email service wired up — the code was printed to
    your browser console and the server terminal, both prefixed "[DEV]".)
  </span>
</CardDescription>
```

`{email}` here is the exact same state read out of the URL in step 3 — this
is the one place on the page a user actually sees which address they're
verifying, confirming the query-string hand-off worked. The demo-mode note
underneath is directly telling the reader where to find the value that
belongs in `OtpInput` above, since this app has no real inbox to check.

```tsx
<Button type="button" variant="ghost" disabled={isResending} onClick={handleResend}>
  {isResending ? "Sending..." : "Resend code"}
</Button>
```

Note `type="button"`, not the default `type="submit"`. Both this button and
the "Verify" button sit inside the same `<form>`, but only one of them
should trigger `handleSubmit` when clicked — `type="button"` opts this one
out of the form's submit behavior entirely, wiring it to `handleResend`
via `onClick` instead. Without it, clicking "Resend code" would *also* fire
`handleSubmit` (submit an empty/incomplete `code`) since it's the second
button inside the form.

```tsx
<p className="text-xs text-muted-foreground text-center">
  Already verified?{" "}
  <Link to="/login" className="underline underline-offset-2">
    Sign in
  </Link>
</p>
```

An escape hatch for the case where someone lands on this page with an
already-verified account (e.g. they verified once, then hit the browser's
back button) — a plain link back to `/login`, no API call involved, since
there's nothing left to check.

### 4. Inside `OtpInput` — `ui/otp-input.tsx`

The server only cares about receiving a 6-character string; the boxes are
purely a UX layer on top of that string, matching the `code` that
`compareOtp` expects on the server. The prop shape reflects that — from
outside, it behaves like a single text field:

```tsx
interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}
```

```tsx
const digits = Array.from({ length }, (_, i) => value[i] ?? "");
```

Derives 6 individual characters from the one `value` string **on every
render** — there's no separate "array of digits" state living inside
`OtpInput` that could drift out of sync with the parent's `code`. This is
the same "derive, don't duplicate" principle as any controlled component:
`OtpInput` holds zero state of its own for the digits themselves (only the
`inputRefs` for focus management, which is DOM plumbing, not data).
`value[3]` on the string `"12"` is `undefined`, so `?? ""` keeps unfilled
boxes as empty strings rather than the literal text `"undefined"`.

```tsx
function setDigit(index: number, digit: string) {
  const next = digits.slice();
  next[index] = digit;
  onChange(next.join(""));
}
```

Whenever any one box changes, this rebuilds the *entire* 6-character string
and calls the parent's `onChange` with it — that call is what lands back in
`verify-email-page.tsx`'s `setCode`, completing the round trip: box change →
`OtpInput` reassembles the full string → parent's `code` state updates →
`OtpInput` re-renders with the new `value` → `digits` is recomputed from
it. One-way data flow, same shape as every other controlled input in this
app, just assembled from 6 sources instead of 1.

```tsx
function handleChange(index: number, raw: string) {
  const digit = raw.replace(/\D/g, "").slice(-1);
  setDigit(index, digit);
  if (digit && index < length - 1) {
    inputRefs.current[index + 1]?.focus();
  }
}
```

- `raw.replace(/\D/g, "")` — strips anything that isn't a digit, so pasting
  or typing a letter can't corrupt the code.
- `.slice(-1)` — keeps only the *last* character typed. Necessary because
  the box already has a value (say `"4"`) when a new keystroke arrives —
  the browser's `onChange` event fires with the *combined* string (e.g.
  `"47"` if `7` was typed next to an existing `4`), and a single-digit box
  should only ever hold one final digit, not accumulate.
- The auto-advance: after accepting a real digit (not a backspace/clear,
  which produces `digit === ""`), move focus to `index + 1` — unless this
  was already the last box.

```tsx
function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Backspace" && !digits[index] && index > 0) {
    inputRefs.current[index - 1]?.focus();
  }
}
```

Handles the one case `onChange` can't: backspacing on a box that's
**already empty**. `onChange` only fires when the value actually changes, so
pressing backspace on an empty box fires no change event at all — this
separate `onKeyDown` listener is what makes backspace "walk left" through
already-empty boxes, matching how every OTP UI you've used elsewhere
behaves.

```tsx
function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
  if (!pasted) return;
  e.preventDefault();
  onChange(pasted.padEnd(length, "").slice(0, length).trimEnd());
  inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
}
```

Without this, pasting a 6-digit code (the realistic way anyone actually
enters an OTP — copy from the console/terminal, paste) would only fill the
one box that was focused, since a plain `<input maxLength={1}>` truncates
pasted text to its first character. `e.preventDefault()` stops that default
truncate-and-insert behavior; the handler then does the splitting itself —
strip non-digits, cap at 6 characters, distribute across every box in one
`onChange` call — and moves focus to whichever box comes right after the
pasted digits.

### 5. Login reacts to an unverified account — `login-page.tsx`

```tsx
const [needsVerification, setNeedsVerification] = useState(false);

async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setError(null);
  setNeedsVerification(false); // reset on every new attempt
  setIsSubmitting(true);
  try {
    await api.post("/auth/login", { email, password });
    ...
  } catch (err) {
    const message = isAxiosError<{ message?: string; code?: string }>(err)
      ? (err.response?.data?.message ?? "Login failed")
      : "Something went wrong.";
    if (isAxiosError<{ code?: string }>(err) && err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
      setNeedsVerification(true);
    }
    setError(message);
    toast.error(message);
  }
  ...
}
```

`needsVerification` is a *second*, more specific flag layered on top of the
generic `error` string — `error` alone is enough to show a red message, but
not enough to know *whether that message deserves a "Verify now" link*. The
explicit `setNeedsVerification(false)` at the top of every submit matters:
without it, a stale `true` from a *previous* failed attempt (say, the user's
first try was unverified, then they clicked "Verify now," verified, came
back, and now mistypes their password) would incorrectly keep showing the
verify link on an error that has nothing to do with verification anymore.

```tsx
if (isAxiosError<{ code?: string }>(err) && err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
```

Checks the `code` field the server set (`server/routes/auth.js`'s
`403 { code: "EMAIL_NOT_VERIFIED" }`), not the `message` string — never
branch application logic on human-readable text, since that's free to
change wording later and silently break the check. `isAxiosError<{ code?: string }>(err)`
is the same type-narrowing trick used throughout this app's error handling
(see `AXIOS-MIGRATION-EXPLAINED.md`): it's what makes `err.response.data.code`
type-check instead of `err` staying `unknown`.

```tsx
{error && (
  <p className="text-sm text-destructive" role="alert">
    {error}
    {needsVerification && (
      <>
        {" "}
        <Link to={`/verify-email?email=${encodeURIComponent(email)}`} className="underline underline-offset-2">
          Verify now
        </Link>
      </>
    )}
  </p>
)}
```

The two flags combine in the JSX: `error` controls whether the whole
paragraph renders at all, and `needsVerification` controls whether an *extra*
link appears **inside** that same paragraph, right after the message text.
The link's `to` re-encodes `email` into the URL exactly the way
`signup-page.tsx` does — same hand-off mechanism, just triggered from a
different page.

### A note on the axios interceptor

`client/src/lib/axios.ts` has a response interceptor that catches `401`s and
silently retries after refreshing the access token (see
`AXIOS-INTERCEPTORS-EXPLAINED.md`). None of this OTP flow ever touches that
logic: `/verify-otp` and `/resend-otp` only ever respond `200` or `400`, and
the unverified-login case is a `403`, not a `401`. The interceptor only acts
on `401`s, so every error in this whole feature reaches each page's own
`catch` block directly and immediately — there's no hidden retry happening
underneath any of the code above.

## The full sequence, start to finish

1. `POST /signup` → user row inserted with `email_verified: false` →
   `issueOtp()` invalidates nothing (first code), generates + hashes +
   stores a new one, console.logs it, returns it as `devCode`.
2. Client prints `devCode` to the browser console and navigates to
   `/verify-email?email=...`.
3. User types (or pastes) the 6 digits into `OtpInput`, which assembles
   them into one `code` string.
4. `POST /verify-otp` looks up the newest un-consumed row for that user,
   checks `expires_at` and `compareOtp`, marks it consumed, flips
   `email_verified` to `true`.
5. `POST /login` now passes the `email_verified` check that was blocking it
   in step 1, signs both JWTs, and logs the user in normally — same flow
   `JWT-AUTH-FROM-SCRATCH.md` §3–§9 already covers.
6. If the user instead hits "Resend code," `issueOtp()` runs again — this
   time it *does* invalidate the code from step 1 first, so only the newest
   code from this second call is ever accepted in step 4.
