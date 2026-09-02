# Frontend Auth From Scratch

Narrative companion to `client/src/features/auth/useAuth.tsx`,
`client/src/components/require-auth.tsx`, `client/src/components/login-page.tsx`,
and `client/src/components/signup-page.tsx` — the frontend half of M10 in
`AUTH-LEARNING-MILESTONES.md`. Where `JWT-AUTH-FROM-SCRATCH.md` explains the
backend (signing, verifying, hashing, cookies), this doc explains how the React
app actually talks to that backend, and why it's built the way it is.

## 1. The question the frontend has to answer on every page load

A page refresh wipes every bit of JavaScript state — any `user` variable sitting
in memory is gone. So the very first thing the app needs, before it can decide
whether to show the login page or the dashboard, is an answer to: **"is this
browser currently logged in?"**

The frontend has no way to know this on its own. It doesn't store a token
anywhere it can inspect (that's `httpOnly` cookies working as intended — see
`JWT-AUTH-FROM-SCRATCH.md` §8). So it does the only thing it can: **ask the
server**, via `GET /api/auth/me`, and trust whatever answer comes back. The
browser attaches the `access_token` cookie automatically (same-origin, via the
Vite proxy), so this fetch call needs no manual header, no token variable, no
`credentials: 'include'` — none of that machinery.

## 2. `useAuth.tsx` — asking once, sharing the answer everywhere

If every component that cared about login state made its own `/api/auth/me`
call, you'd get redundant network requests and inconsistent answers mid-render.
React's **Context** API solves "check once, read anywhere":

```tsx
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Not authenticated");
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // runs once, when the app first mounts

  return (
    <AuthContext.Provider value={{ user, isLoading, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}
```

`App.tsx` wraps the entire `<Routes>` tree in `<AuthProvider>`, so this check
happens exactly once per page load, and any component anywhere in the tree can
call `useAuth()` to read the current `{ user, isLoading, refresh }` without
making its own network request.

### Why `isLoading` exists — a race condition, made visible

The instant the app mounts, before `/api/auth/me` has had time to respond,
`user` is `null` — its initial state. But `null` here doesn't mean "confirmed
logged out," it means "we haven't heard back yet." If a route guard treated
`user === null` as "definitely not logged in" during that brief window, a
perfectly logged-in user would flash a redirect-to-login on every single page
load, before the real answer arrived a few milliseconds later.

`isLoading` names that in-between state explicitly: `true` until the fetch
settles (success or failure), `false` after. Anything that needs to make an
auth decision — like the route guard below — must wait for `isLoading` to be
`false` before trusting `user`.

### `refresh()` — re-running the same check on demand

`refresh` is just the same `load` function, exposed so other components can
re-trigger the check. Login and logout both call it: after `POST
/api/auth/login` succeeds, the browser now has a fresh `access_token` cookie,
but the `AuthProvider`'s `user` state is still whatever it was before (stale,
`null`) — calling `refresh()` re-asks `/api/auth/me`, which now succeeds and
updates `user`, so the rest of the app immediately reflects the new logged-in
state.

## 3. `require-auth.tsx` — the route guard

```tsx
export function RequireAuth({ children }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) return <SkeletonPlaceholder />;
  if (!user) return null; // redirect is in-flight
  return <>{children}</>;
}
```

`DashboardLayout` wraps every authenticated route in this component. Three
states, handled explicitly:

1. **`isLoading` is `true`** → show a skeleton placeholder. We genuinely don't
   know yet whether to show the dashboard or bounce to login.
2. **`isLoading` is `false`, `user` is `null`** → definitely logged out. The
   `useEffect` fires `navigate("/login")`. Render `null` in the meantime — the
   redirect is already in motion, there's nothing meaningful to show.
3. **`isLoading` is `false`, `user` exists** → render the actual page.

### Why the redirect lives inside `useEffect`, not directly in the render

React does not allow triggering navigation (a side effect) as a direct
consequence of rendering — render functions are supposed to be pure,
side-effect-free. `useEffect` runs *after* React finishes rendering, which is
the correct place for "given this state, go do something to the outside
world" logic like `navigate(...)`.

### The one thing to never forget about this file

**This guard is UX, not security.** It only stops the *React app* from
rendering a dashboard it shouldn't. Nothing here stops someone from disabling
JavaScript, or hitting `/api/consumers` directly with `curl`, bypassing this
component entirely. The actual enforcement is the `requireAuth` middleware on
the **server** (`server/routes/consumers.js`, covered in M9) — that's the
version that can't be bypassed by the client. `RequireAuth` on the frontend
just avoids showing a confusing, broken-looking page to someone who isn't
logged in; it is not a security boundary.

## 4. The login form — talking to the API by hand

```tsx
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!res.ok) {
  const body = await res.json().catch(() => null);
  throw new Error(body?.message ?? "Login failed");
}
await refresh();
navigate("/");
```

Two details that matter:

- **`fetch` does not reject on a 4xx/5xx response** — only on true network
  failure (DNS failure, no connection, etc.). A `401 Invalid email or
  password` is a "successful" fetch as far as `fetch` itself is concerned; you
  have to check `res.ok` yourself and branch on it. This is exactly the
  "ceremony" this whole repo's fetch pattern is built around (see
  `HTTP-METHODS-GUIDE.md`).
- **`await refresh()` before `navigate("/")`.** If we skipped straight to
  `navigate("/")`, `DashboardLayout` would render `RequireAuth`, which reads
  `useAuth()` — but the `AuthProvider`'s `user` state is still stale (it hasn't
  re-checked since before this login happened). Calling `refresh()` first
  forces a fresh `/api/auth/me` check, so by the time we navigate, `user` is
  already correct and `RequireAuth` doesn't briefly bounce us back to `/login`.

## 5. The signup form — deliberately does NOT log you in

```tsx
const res = await fetch("/api/auth/signup", { ... });
if (!res.ok) { /* same res.ok check */ }
toast.success("Account created. Sign in to continue.");
navigate("/login");
```

No cookies are set by `/api/auth/signup` on the server (see
`JWT-AUTH-FROM-SCRATCH.md` §10) — it only creates the row. So there's nothing
for the frontend to "pick up" here; it just tells the user it worked and sends
them to `/login` to authenticate normally with the credentials they just
created. This mirrors how most real-world apps separate "account exists" from
"currently signed in."

## 6. Where every concept lives in the code

| Concept | File |
|---|---|
| Shared auth state via Context | `client/src/features/auth/useAuth.tsx` |
| `/api/auth/me`-on-mount check | `useAuth.tsx`, inside `AuthProvider`'s `load()` |
| The `isLoading` race-condition guard | `useAuth.tsx` state + `require-auth.tsx`'s checks |
| Route guard (UX only) | `client/src/components/require-auth.tsx` |
| Login form + `res.ok` handling | `client/src/components/login-page.tsx` |
| Signup form (no auto-login) | `client/src/components/signup-page.tsx` |
| Where `AuthProvider` wraps the app | `client/src/App.tsx` |
| Where `RequireAuth` wraps protected routes | `client/src/pages/DashboardLayout.tsx` |
| Logout call + re-`refresh()` | `client/src/components/dashboard-header.tsx` |

## 7. Full picture: what happens on a page load

1. `App.tsx` mounts `<AuthProvider>`, which immediately fires `GET /api/auth/me`.
2. While that's in flight, `isLoading` is `true` — any `RequireAuth`-wrapped
   route shows a skeleton.
3. The response comes back:
   - **200** → `user` is set, `isLoading` becomes `false`. `RequireAuth`
     renders the real page.
   - **401** → `user` stays `null`, `isLoading` becomes `false`. `RequireAuth`'s
     `useEffect` fires, navigates to `/login`.
4. On `/login`, submitting the form POSTs credentials, and on success calls
   `refresh()` (re-running step 1's check, now with a fresh cookie) before
   navigating back into the guarded area.
