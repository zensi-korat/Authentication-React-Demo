# Query Params in ConsumersListPage — The Simple Version

Confused by the query-param code in `ConsumersListPage.tsx`? This explains it as
**one simple loop**, in plain language. Read it top to bottom.

---

## 1. The one big idea

Think of the part of the URL after the `?` as a small **whiteboard** that holds
the page's settings:

```
/consumers?search=jane&page=2&pageSize=10
           └─────── the whiteboard ───────┘
```

That whiteboard says: *"showing search 'jane', page 2, 10 per page."*

Everything in this file does just **two things** with that whiteboard:
1. **Reads** settings off it — to know what to fetch and show.
2. **Writes** new settings onto it — when the user types or clicks.

And there's a magic rule that ties it together:

> **Whenever the whiteboard (URL) changes, the page automatically re-reads it and
> re-fetches.** You never manually "refresh" the data.

That's the entire concept. The rest is just details.

---

## 2. The tool that reads & writes the whiteboard

```tsx
const [searchParams, setSearchParams] = useSearchParams();
```

This single line gives you two tools:

| Tool | Does | Example |
|------|------|---------|
| `searchParams` | **READ** the URL | `searchParams.get("page")` → `"2"` |
| `setSearchParams` | **WRITE** the URL | changes the address bar |

Remember it as: **`searchParams` = read, `setSearchParams` = write.**

---

## 3. Reading the settings

```tsx
const search   = searchParams.get("search") ?? "";        // read ?search=
const page     = Number(searchParams.get("page")) || 1;   // read ?page=
const pageSize = Number(searchParams.get("pageSize")) || 10; // read ?pageSize=
```

Each line **reads one setting off the whiteboard**, with a fallback if it's not
there:
- No `?page=` in the URL → `page` becomes `1`.
- `?page=2` in the URL → `page` becomes `2`.

Why `Number(...)`? Because the URL always stores **text** (`"2"`), but we want the
**number** `2` to do math and pass to the fetch.

---

## 4. Using the settings (the fetch)

```tsx
const { consumers, total, isLoading, isError, error } = useConsumers({
  search,
  page,
  pageSize,
});
```

We hand those three values (read from the URL) to the hook, and it fetches exactly
that page.

> **The URL decides what we fetch.** The page doesn't keep a separate copy of the
> settings — it always reads them fresh from the URL.

---

## 5. Writing new settings — the `updateParams` helper

This is the part that *looks* scary but does something simple:
**"change one setting on the whiteboard, keep the rest."**

```tsx
function updateParams(changes) {
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);   // 1. copy the current whiteboard
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === "") next.delete(key); // remove it
      else next.set(key, String(value));                         // or set it
    }
    return next;                              // 2. this becomes the new URL
  });
}
```

**Why do we need this helper** instead of writing the URL directly? Because all
the settings share **one** whiteboard. If you only want to change `page`, you must
**keep** `search` and `pageSize`. This helper copies what's already there, changes
only the keys you pass, and leaves the rest untouched.

Examples:

| Call | Result on the URL |
|------|-------------------|
| `updateParams({ page: 2 })` | `?search=jane&page=2&pageSize=10` (search kept!) |
| `updateParams({ page: undefined })` | removes `page` → back to default page 1 |
| `updateParams({ pageSize: 20, page: undefined })` | sets size 20, resets to page 1 |

> Passing `undefined` **removes** a param — that's how we keep the URL clean (no
> `?page=1` clutter, since page 1 is the default anyway).

The little handlers just call this helper:
```tsx
const goToPage = (p) => updateParams({ page: p > 1 ? p : undefined });
const changePageSize = (size) => updateParams({ pageSize: size, page: undefined });
```

---

## 6. The full loop — a real example: clicking "Next"

Say you're on page 1 and click **Next**. Follow the loop:

```
1. CLICK      → goToPage(page + 1)  → updateParams({ page: 2 })
2. WRITE      → the URL becomes  ?page=2
3. RE-RENDER  → because the URL changed, React re-runs the component (automatic)
4. READ       → const page = Number(searchParams.get("page")) || 1  → now 2
5. FETCH      → useConsumers({ page: 2 })  fetches page 2
6. SHOW       → the screen displays page 2
```

You never told the data to refresh. You just **changed the URL**, and steps 3–6
happened on their own. That's the key mental shift:

```
 click → write URL → (auto) re-render → read URL → fetch → show
          ▲                                                   │
          └───────────────── next click ──────────────────────┘
```

---

## 7. The one twist: search (typing)

Search works the same way, with one extra step. Typing is fast (every keystroke),
but we don't want to change the URL on *every letter*. So the box keeps its **own
local state** first:

```tsx
const [searchInput, setSearchInput] = useState(search); // what's in the box right now
```

Then a **debounce** waits 400ms after you stop typing, and *then* writes to the URL:

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    if (searchInput !== search) {
      updateParams({ search: searchInput || undefined, page: undefined });
    }
  }, 400);
  return () => clearTimeout(timer); // typing again cancels the pending write
}, [searchInput]);
```

So the search flow is:
> **box updates instantly → after you pause 400ms, it writes to the URL → then the
> same read-fetch loop from Section 6 runs.**

Page is reset (`page: undefined`) because a brand-new search should start at page 1.

---

## 8. Why do it this way at all?

Because storing the settings in the **URL** (instead of in plain memory) means:
- **Refresh-proof** — reload the page and your search/page are still there.
- **Shareable** — send someone `/consumers?search=jane&page=2` and they see the
  exact same view.
- **Back button works** — it steps back through your searches/pages.
- **One source of truth** — there's only one place the settings live (the URL), so
  the UI and the fetch can never disagree.

---

## 9. The 3 sentences to remember

1. The URL after `?` is a **whiteboard** holding `search`, `page`, `pageSize`.
2. We **read** it (`searchParams.get`) to decide what to fetch, and **write** it
   (`updateParams` → `setSearchParams`) when the user acts.
3. Changing the URL **automatically** re-runs the page, which re-reads and
   re-fetches — so we never manually refresh the data.

---

## 10. Cheat sheet

- `useSearchParams()` → `[read, write]` for the URL's `?...` part.
- `searchParams.get("page")` → read one setting (as text).
- `updateParams({ page: 2 })` → change one setting, keep the others.
- `updateParams({ page: undefined })` → remove a setting (use its default).
- Change the URL → the page re-renders → re-reads → re-fetches. Automatic.
- Search uses local state + a 400ms debounce before it writes to the URL.
