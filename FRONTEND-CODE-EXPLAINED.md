# Frontend Auth Code, Line by Line

A plain-English walkthrough of the actual JavaScript/TypeScript/React
**syntax** in every frontend auth file — not the auth *concepts* (see
`FRONTEND-AUTH-FROM-SCRATCH.md` for those), just "what does this code
literally say to do." Read each section alongside the real file open in your
editor. Covers, in the order data flows through them:

1. `useAuth.tsx` — shared login state
2. `require-auth.tsx` — the route guard
3. `login-page.tsx` — the login form
4. `signup-page.tsx` — the signup form

---

## 1. `client/src/features/auth/useAuth.tsx`

```tsx
import { createContext, useContext, useEffect, useState } from "react";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
```

- `interface AuthUser { id: string; email: string; }` — a TypeScript
  **shape definition**. It doesn't create any real value; it just says "if
  something is typed as `AuthUser`, it must have these two string fields."
  Purely a compile-time safety net — deleted entirely once the code is
  built/run.
- `refresh: () => Promise<void>` — this field's type is "a function, taking
  no arguments, that returns a `Promise` which eventually resolves to
  nothing (`void`)." That's the type of an `async` function that doesn't
  `return` a value.
- `createContext<AuthContextValue | undefined>(undefined)` — creates a
  React "channel" that can carry a value of type `AuthContextValue`, down
  through the component tree, without passing it as a prop at every level.
  It starts as `undefined` until a `<AuthContext.Provider>` further up
  supplies a real value.

```tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
```

- `{ children }: { children: React.ReactNode }` — destructures the
  `children` prop straight out of the function's argument object.
  `React.ReactNode` is the type for "anything React can render" (JSX,
  strings, numbers, arrays of those, etc.).
- `useState<AuthUser | null>(null)` — one independent piece of state,
  starting at `null`. Returns a 2-item array: current value, setter
  function. `const [a, b] = array` is **array destructuring** — pulling
  items out by position (1st → `a`, 2nd → `b`).
- `useState(true)` for `isLoading` — starts `true`, because we haven't
  checked with the server yet when the component first mounts.

```tsx
  const load = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Not authenticated");
      const data: { user: AuthUser } = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };
```

- `const load = async () => { ... }` — an **arrow function** (a compact way
  to write `function`) assigned to a constant named `load`. `async` unlocks
  the use of `await` inside it.
- `try { } catch { } finally { }` — "attempt this; if anything inside `try`
  throws, jump straight to `catch` instead of crashing the whole app;
  either way, always run `finally` at the very end." Think of `finally` as
  a guaranteed cleanup step.
- `await fetch("/api/auth/me")` — sends the request and **pauses this
  function** until a response object arrives. That's what `await` means:
  "wait here for this Promise to settle before continuing."
- `res.ok` — `true` for any 2xx status, `false` for 4xx/5xx. `fetch` itself
  does **not** throw on a 401 — only real network failure throws — so this
  manual check is required.
- `throw new Error("Not authenticated")` — manually raises an error, which
  immediately jumps execution into the `catch` block below.
- `await res.json()` — the response body arrives as raw bytes; this parses
  it into a real JS object. Also asynchronous, hence another `await`.
- `catch { setUser(null); }` — note there's no `(err)` here — this `catch`
  doesn't need the error value, it just needs to know *something* failed.
- `finally { setIsLoading(false); }` — runs whether `try` succeeded or
  `catch` ran — either way, loading is now finished.

```tsx
  useEffect(() => {
    load();
  }, []);
```

- `useEffect(fn, deps)` — runs `fn` after React finishes rendering.
- `[]` (empty array) as the second argument means "the values this effect
  depends on never change" → React only runs it **once**, right after the
  very first render. This is how `load()` gets triggered automatically on
  app startup, without needing a button click or user action.

```tsx
  return (
    <AuthContext.Provider value={{ user, isLoading, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- This is **JSX** — HTML-looking syntax that's really JavaScript function
  calls under the hood.
- `<AuthContext.Provider value={...}>{children}</AuthContext.Provider>` —
  makes the object `{ user, isLoading, refresh: load }` available to every
  component nested inside `{children}`, no matter how deeply nested,
  without manually passing it down through props at each level.
- `refresh: load` — renames the field: consumers of this context call it
  `refresh()`, even though internally it's the same `load` function.

```tsx
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
```

- `useContext(AuthContext)` — reads whatever value the nearest
  `<AuthContext.Provider>` above this component in the tree is currently
  providing.
- `if (!ctx) throw ...` — a safety check: if some component calls
  `useAuth()` without being wrapped in `<AuthProvider>`, `ctx` would be
  `undefined`, and this throws a clear, specific error instead of a
  confusing crash somewhere else later.

---

## 2. `client/src/components/require-auth.tsx`

```tsx
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, user, navigate]);
```

- `const { user, isLoading } = useAuth();` — **object destructuring**: pull
  the `user` and `isLoading` fields out of whatever `useAuth()` returns, by
  name (not position, unlike array destructuring).
- `useNavigate()` — a React Router hook returning a function that changes
  the current URL/page without a full browser reload.
- `useEffect(() => { ... }, [isLoading, user, navigate])` — this time the
  dependency array is **not** empty. React re-runs this effect any time
  `isLoading`, `user`, or `navigate` changes value between renders — so as
  soon as the auth check resolves and `isLoading` flips to `false`, this
  effect runs again with the new values.
- `if (!isLoading && !user)` — reads as "loading has finished AND there's
  no logged-in user." Both `!isLoading` and `!user` must be true.
- `navigate("/login", { replace: true })` — go to `/login`. `replace: true`
  swaps the current browser history entry instead of adding a new one, so
  clicking "back" afterward doesn't return you to the guarded page you were
  just bounced from.

```tsx
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col gap-3 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

- Three explicit branches, each an early `return`:
  1. **Still loading** → render three `<Skeleton>` bars (a placeholder
     shimmer effect) instead of guessing whether to show the real page.
  2. **Loading finished, no user** → `return null` renders literally
     nothing. The redirect from the `useEffect` above is already in
     motion; there's nothing meaningful to show in this instant.
  3. **Loading finished, user exists** → `return <>{children}</>` renders
     whatever was passed in between `<RequireAuth>` and `</RequireAuth>` by
     the parent (`DashboardLayout.tsx`).
- `<>{children}</>` — the empty `<>` `</>` tags are a **React Fragment**: a
  wrapper that groups content without adding an actual extra HTML element
  to the page (no `<div>` wrapper is emitted).

---

## 3. `client/src/components/login-page.tsx`

```tsx
export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
```

Four independent `useState` calls — one piece of state per form field, plus
`error` (starts `null` = no error) and `isSubmitting` (starts `false`).
**Why state instead of plain variables?** React only re-renders (updates
what's visually on screen) in response to a setter function
(`setEmail`, `setError`, ...) being called. A plain `let email = ""` would
never make the input box visually update as you type.

```tsx
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
```

- Runs every time the form is submitted (wired up via `onSubmit={handleSubmit}`
  further down).
- `e: FormEvent<HTMLFormElement>` — `e` is the browser's event object
  describing what just happened; the type says it came from an HTML
  `<form>`.
- `e.preventDefault();` — **critical line.** Submitting an HTML form
  normally makes the browser do a full-page navigation/reload (pre-JavaScript
  web behavior). This cancels that default so the code below can handle the
  submission in JavaScript instead, keeping all React state intact.

```tsx
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
```

- `method: "POST"` — explicitly a POST request (default is GET).
- `headers: { "Content-Type": "application/json" }` — tells the server "the
  body I'm sending is JSON."
- `body: JSON.stringify({ email, password })` — `{ email, password }` is
  shorthand for `{ email: email, password: password }` (skip repeating the
  name when it matches the variable). `JSON.stringify(...)` converts that
  live JS object into a plain text string, because an HTTP body is just
  text/bytes, not a live object.

```tsx
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Login failed");
      }
```

- `res.ok` is `false` for 4xx/5xx — this is how a rejected login (wrong
  password) gets detected, since `fetch` itself doesn't throw for that.
- `.catch(() => null)` — if parsing the error body as JSON fails for any
  reason, fall back to `null` instead of crashing here.
- `body?.message` — **optional chaining** (`?.`): if `body` is `null`, the
  whole expression short-circuits to `undefined` instead of throwing
  "cannot read property of null."
- `?? "Login failed"` — **nullish coalescing**: "use the left side, unless
  it's `null`/`undefined`, then use this fallback." So: use the server's
  real error message if we got one, otherwise a generic one.

```tsx
      await refresh();
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }
```

- Reaching `await refresh(); navigate("/");` means nothing threw — login
  succeeded. `refresh()` re-runs the `/api/auth/me` check from
  `useAuth.tsx` (now succeeding, since the login cookie is set) **before**
  navigating, so `RequireAuth` doesn't briefly think we're still logged out.
- `err instanceof Error ? err.message : "..."` — a **ternary**
  (`condition ? ifTrue : ifFalse`). JavaScript technically allows throwing
  anything (not just `Error` objects), so this safely extracts a message
  either way.
- `finally { setIsSubmitting(false); }` — runs regardless of success/failure,
  re-enabling the submit button.

```tsx
<Input
  id="email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>
```

- `value={email}` — this input's visible text is *always* exactly whatever
  `email` currently holds in state. This pattern is called a **"controlled"
  input** — React state is the single source of truth, not the browser's
  own internal input memory.
- `onChange={(e) => setEmail(e.target.value)}` — an inline arrow function
  that fires on every keystroke: read the input's current text
  (`e.target.value`), push it into state. Keystroke → `onChange` fires →
  `setEmail` runs → React re-renders → `value={email}` shows the new text.
  That round trip is why the box visually updates as you type.

```tsx
{error && (
  <p className="text-sm text-destructive" role="alert">
    {error}
  </p>
)}
```

- `{...}` in JSX means "evaluate this JS expression here."
- `error && (<p>...</p>)` — JavaScript's `&&` short-circuits: if `error` is
  falsy (`null`), the whole expression evaluates to that falsy value and
  React renders nothing. If `error` is a truthy string, it evaluates to the
  JSX and renders it. Standard React idiom for "show this only if that's
  true."

```tsx
<Button type="submit" disabled={isSubmitting} className="mt-2">
  {isSubmitting ? "Signing in..." : "Sign in"}
</Button>
```

`disabled={isSubmitting}` prevents a double-submit while a request is in
flight. `{isSubmitting ? "..." : "..."}` swaps the label via ternary.

---

## 4. `client/src/components/signup-page.tsx`

Structurally almost identical to `login-page.tsx` — same state pattern, same
`try/catch/finally`, same `res.ok` check. Only the meaningfully different
parts:

```tsx
export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
```

No `useAuth()` / `refresh` here at all — signup doesn't log you in (the
server doesn't set any cookies on `POST /api/auth/signup`), so there's no
auth state to re-check.

```tsx
      const res = await fetch("/api/auth/signup", { ... });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Signup failed");
      }

      toast.success("Account created. Sign in to continue.");
      navigate("/login");
```

Instead of `refresh()` + `navigate("/")`, success here just shows a toast and
sends you to `/login` — you sign in separately afterward with the credentials
you just created.

```tsx
<Input
  id="password"
  type="password"
  autoComplete="new-password"
  minLength={8}
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  required
/>
<p className="text-xs text-muted-foreground">At least 8 characters.</p>
```

- `autoComplete="new-password"` (vs. `"current-password"` on the login
  page) — a hint browsers use to decide whether to suggest a *saved*
  password or offer to *generate a new one*.
- `minLength={8}` — HTML5's own built-in validation attribute; the browser
  itself will refuse to submit the form if the password is shorter than 8
  characters, before `handleSubmit` even runs. This is a UX nicety only —
  the real enforcement is the server's own length check in
  `server/routes/auth.js` (never trust client-side validation alone).

---

## How these four files connect

```
App.tsx
 └─ <AuthProvider>                        (useAuth.tsx: runs /api/auth/me once)
     └─ <Routes>
         ├─ /login  → <LoginPage>          (posts credentials, calls refresh())
         ├─ /signup → <SignupPage>         (posts new account, no auto-login)
         └─ /        → <DashboardLayout>
                         └─ <RequireAuth>  (require-auth.tsx: reads useAuth(),
                                             redirects to /login if no user)
                             └─ actual dashboard pages
```
