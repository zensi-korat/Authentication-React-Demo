# The Data Hooks, Explained Line-by-Line

A deep, plain-language walkthrough of the three "method" hooks and — most
importantly — **why** they use `useEffect` and `useCallback`. Read this before
your session and you'll be able to answer follow-up questions confidently.

Files covered:
- `useConsumers.ts` — GET the full list
- `useConsumerDetail.ts` — GET one item by id
- `useCreateConsumer.ts` — POST a new item

---

## Part 0: Two ideas you need first

### What is a "hook"?
A hook is just a **function whose name starts with `use`** that lets a React
component tap into React features (like state). `useState`, `useEffect`, and
`useCallback` are built into React. `useConsumers` is one *we* wrote, built out
of those. Components "call" a hook to get data and behavior.

### What is a "render"?
A React component is a function that returns UI. React calls that function
**every time something changes** (like state updating) to figure out what to
show. Each call is a **render**. This matters a lot below: code in the body of
the component runs *on every single render*.

---

## Part 1: `useConsumers.ts` — the GET-list hook

### The state (4 variables)

```ts
const [consumers, setConsumers] = useState<Consumer[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isError, setIsError]     = useState(false);
const [error, setError]         = useState<Error | null>(null);
```

`useState(x)` gives you a **value** and a **setter**. When you call the setter,
React re-renders the component with the new value. We track four things by hand
— the data, whether we're still loading, whether it failed, and the error
itself. (A library like React Query would create these for you; here we do it
manually so the mechanics are visible.)

- `consumers` starts as `[]` (empty list — nothing fetched yet).
- `isLoading` starts as `true` because we begin fetching immediately.

### The `load` function

```ts
const load = useCallback(async () => {
  setIsLoading(true);
  setIsError(false);
  setError(null);
  try {
    const res = await fetch(URL);                    // GET by default
    if (!res.ok) {                                   // fetch won't throw on 404/500
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? "Failed to load consumers");
    }
    const data: ConsumersResponse = await res.json();
    setConsumers(data.consumers);                    // success → store data
  } catch (err) {
    setIsError(true);                                // failure → store error
    setError(err instanceof Error ? err : new Error("Unknown error"));
  } finally {
    setIsLoading(false);                             // always stop loading
  }
}, []);
```

Step by step:
1. Reset the flags (we're starting a fresh attempt).
2. `await fetch(URL)` sends the GET request and waits for the response.
3. `if (!res.ok)` — check the status ourselves. `fetch` only rejects on a
   *network* failure, so a 404 or 500 would otherwise look like success.
4. `await res.json()` parses the JSON body into a real object.
5. On success, save the list. On failure, save the error. Either way, `finally`
   turns loading off.

### Firing it off with `useEffect`

```ts
useEffect(() => {
  load();
}, [load]);
```

This runs `load()` once when the component appears. **Why it must be in a
`useEffect` and not just called directly** is the key lesson — see Part 4.

### What the hook returns

```ts
return { consumers, isLoading, isError, error, refetch: load };
```

The component gets the data, the flags, and a `refetch` function (which is just
`load` under a friendlier name) to reload on demand.

---

## Part 2: `useConsumerDetail.ts` — the GET-one hook

Almost the same, with two differences worth explaining in your session.

### Difference 1: the id goes in the URL

```ts
const res = await fetch(`/api/consumers/${id}`);
```

To fetch one specific consumer, we put its id **in the URL path**. The backend
route is `GET /api/consumers/:id`, where `:id` is a placeholder that captures
whatever id we send.

### Difference 2: the `ignore` flag (a race-condition guard)

```ts
useEffect(() => {
  let ignore = false;

  async function load() {
    ...
    if (!ignore) setConsumer(data.consumer);   // only set state if still relevant
    ...
  }

  load();

  return () => {          // cleanup
    ignore = true;
  };
}, [id]);
```

Imagine the user opens consumer **A**, then quickly clicks consumer **B** before
A finishes loading. Without a guard, A's slow response could arrive *after* B's
and overwrite the screen with the wrong data.

The fix:
- `ignore` starts `false`.
- The **cleanup function** (`return () => { ignore = true }`) runs when `id`
  changes or the component unmounts.
- So when we switch from A to B, A's cleanup sets *its* `ignore = true`, and A's
  late response hits `if (!ignore)` → skipped. Only B's data lands.

This is the standard React pattern for "fetch tied to a changing value."

---

## Part 3: `useCreateConsumer.ts` — the POST hook

This one is a **mutation** (it changes data) rather than a read, so it's shaped
differently: there's no `useEffect`. Creating happens **when the user submits a
form**, not automatically on render.

### The `mutate` function

```ts
const mutate = useCallback(async (input: CreateConsumerInput): Promise<Consumer> => {
  setIsPending(true);
  setError(null);
  try {
    const res = await fetch("/api/consumers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),        // object → JSON string
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? "Failed to create consumer");
    }
    const data: ConsumerResponse = await res.json();
    return data.consumer;                 // hand the created consumer back
  } catch (err) {
    const e = err instanceof Error ? err : new Error("Unknown error");
    setError(e);
    throw e;                              // re-throw so the form can react too
  } finally {
    setIsPending(false);
  }
}, []);
```

Key points to mention:
- `method: "POST"`, plus a JSON `body` — the three things a create needs.
- `isPending` (instead of `isLoading`) is a nicer name for "the save is in
  progress" — used to disable the Save button.
- It **returns** the created consumer AND **re-throws** on error. The form (in
  `ConsumerAddPage.tsx`) awaits `mutate(...)`; if it throws, the form shows a
  toast and stays put; if it succeeds, the form navigates away.

### `CreateConsumerInput`

```ts
export type CreateConsumerInput = Omit<Consumer, "id" | "consumerNumber">;
```

`Omit<Consumer, ...>` means "a Consumer **without** these fields." The caller
shouldn't supply `id` or `consumerNumber` — the server generates those. This is
a nice TypeScript touch you can point out.

---

## Part 4: WHY `useEffect`? (the important one)

### The problem it solves
Fetching data is a **side effect** — it reaches *outside* React (to the network)
and eventually changes state. React's rule: **the render body must be pure** —
it should only calculate UI, never do side effects.

If you fetched directly in the component body:

```ts
function ConsumersListPage() {
  const res = fetch("/api/consumers");   // ❌ WRONG
  ...
}
```

...you'd fire a request **on every render**. And since the response calls
`setState`, which triggers a **re-render**, which fires **another** request...
you get an infinite loop. 💥

### What `useEffect` does
`useEffect(fn, deps)` tells React: **"run `fn` AFTER rendering, not during — and
only re-run it when something in `deps` changes."**

```ts
useEffect(() => {
  load();
}, [load]);   // ← the dependency array
```

- The function runs *after* the component is painted to the screen.
- The `[load]` array controls **when it runs again**:
  - `[]` (empty) → run **once**, when the component first mounts.
  - `[id]` → run on mount **and** every time `id` changes (that's why the detail
    hook re-fetches when you open a different consumer).
  - no array at all → run after **every** render (almost never what you want).

### The cleanup function
If the effect `return`s a function, React calls it before the next run and on
unmount. We use that for the `ignore` flag in the detail hook (Part 2).

> **One-liner for your session:** "`useEffect` is where side effects like
> fetching live. It runs after render and only re-runs when its dependencies
> change — which stops us from fetching on every render and looping forever."

---

## Part 5: WHY `useCallback`? (the subtle one)

### The problem it solves
Every render re-creates the functions defined inside a component. So this:

```ts
const load = async () => { ... };   // a BRAND-NEW function object each render
```

...gives you a *different* `load` every render — same code, but a new object in
memory. Usually harmless. But it becomes a problem the moment that function is a
**dependency of `useEffect`**:

```ts
const load = async () => { ... };    // new every render
useEffect(() => { load(); }, [load]); // deps sees a "new" load every render
```

React compares dependencies by identity. A new `load` every render looks like "a
changed dependency," so the effect runs **every render** → fetch loop again. 💥

### What `useCallback` does
`useCallback(fn, deps)` returns the **same function object** across renders, only
creating a new one if something in *its* `deps` changes.

```ts
const load = useCallback(async () => { ... }, []);  // stable: same object every render
useEffect(() => { load(); }, [load]);               // deps never "changes" → runs once ✅
```

Now `load` is stable, so the `useEffect` sees the same dependency each render and
runs just once, as intended.

### Why `useCreateConsumer` uses it without a `useEffect`
There's a second, gentler reason: hooks hand functions back to components. If
`mutate` were re-created every render, any component doing `useEffect` or
`useMemo` on it, or a memoized child receiving it as a prop, would needlessly
re-run. Returning a **stable** function is just good hygiene — so `mutate` is
wrapped even though nothing here strictly loops without it.

### The dependency array of `useCallback`
Same rules as `useEffect`: list anything from outside the function that it uses.
Ours are `[]` because `load`/`mutate` only use setters (which React guarantees
are stable) and constants.

> **One-liner for your session:** "`useCallback` keeps a function from being
> re-created on every render. We need that here because the function is a
> `useEffect` dependency — a fresh function each render would make the effect
> run every render. It also keeps the functions a hook returns stable."

---

## Part 6: `useEffect` vs `useCallback` — the crisp distinction

Beginners mix these up. Keep them straight like this:

| | `useEffect` | `useCallback` |
|---|-------------|---------------|
| **Purpose** | *Run* code (a side effect) | *Remember* a function |
| **When it acts** | After render | During render (returns the function) |
| **Returns** | Nothing (optional cleanup fn) | A stable function |
| **Here it's used for** | Kicking off the fetch | Keeping `load`/`mutate` stable |
| **Analogy** | "Do this after painting the screen" | "Reuse the same function, don't rebuild it" |

They work as a **pair**: `useCallback` makes a stable `load`, and `useEffect`
depends on that stable `load` to run exactly once.

---

## Part 7: Quick reference — which hook uses what

| Hook | Method | `useState` | `useEffect` | `useCallback` | Special detail |
|------|--------|:----------:|:-----------:|:-------------:|----------------|
| `useConsumers` | GET list | ✅ | ✅ | ✅ | returns `refetch` |
| `useConsumerDetail` | GET one | ✅ | ✅ | ❌ | `ignore` race guard; re-runs on `id` |
| `useCreateConsumer` | POST | ✅ | ❌ | ✅ | runs on submit, not on render |

Why the detail hook has **no** `useCallback`: its `load` is defined *inside* the
`useEffect` (not passed in as a dependency), so it never needs to be stable.

Why the create hook has **no** `useEffect`: creating is triggered by a user
action (form submit), not automatically when the component renders.
