# Query Parameters: Search & Pagination, Explained in Detail

A beginner-friendly, read-aloud deep dive into **query parameters** — what they
are, and exactly how we use them for **search** and **pagination** in this app.
By the end you'll be able to explain every piece confidently.

---

## 1. What is a query parameter?

A URL can carry extra information at the end, after a **`?`**. That extra part is
made of **query parameters** (also called "query string" or "query params").

```
/api/consumers?search=jane&page=2&pageSize=10
└──── path ───┘└──────────── query string ─────────────┘
```

Break it down:
- The **`?`** marks where the query string begins.
- Each parameter is a **`key=value`** pair → `search=jane`.
- Multiple pairs are joined with **`&`** → `page=2&pageSize=10`.

So `?search=jane&page=2&pageSize=10` reads as:
> "Give me consumers matching **jane**, on **page 2**, with **10 per page**."

**Why do we use them?** Query params are the standard way for the client to tell
the server *how* it wants the data — filtered, paged, sorted. The **path**
(`/api/consumers`) says *what resource* you want; the **query string** says *which
slice and in what shape*.

> **Say this:** "The path is the *what* — which resource. The query string after
> the `?` is the *how* — search this, give me this page, this many per page."

### A few rules worth knowing
- Query params are **always text (strings)**. `page=2` is the string `"2"`, not
  the number `2` — so on the server we convert them (`parseInt`) and apply defaults.
- Their **order doesn't matter**: `?page=2&search=jane` == `?search=jane&page=2`.
- Special characters get **encoded**: a space becomes `%20`, so `search=jane doe`
  travels as `search=jane%20doe`. (Tools below do this for us automatically.)
- They're **optional**: `/api/consumers` with no `?` is valid — the server just
  uses its defaults (page 1, size 10, no search).

---

## 2. Two helpers that build & read query params

You almost never build these strings by hand. Two tools do it safely.

### `URLSearchParams` — the plain JavaScript tool
Builds and reads a query string, handling the `?`, `&`, and encoding for you.

```js
const params = new URLSearchParams();
params.set("search", "jane doe");
params.set("page", "2");

params.toString();        // "search=jane+doe&page=2"  (encoded for you)
params.get("page");       // "2"
```

We use this in the **fetch hook** to build the API request URL.

### `useSearchParams` — the React Router tool
Reads and writes the query string of the **browser address bar**. It's like
`useState`, but the "state" lives in the URL.

```tsx
const [searchParams, setSearchParams] = useSearchParams();

searchParams.get("search");        // read  ?search=... from the address bar
setSearchParams({ search: "jane" }); // write ?search=jane into the address bar
```

We use this in the **page** so the address bar reflects the current search/page.

> Both revolve around the same idea (`get`/`set` on query params). One builds the
> URL we *send* to the server; the other syncs the URL the *user sees*.

---

## 3. Search as a query parameter

Goal: type in the box → the server returns only matching rows.

### The journey of one search
```
You type "jane"
  → page writes ?search=jane into the address bar     (useSearchParams)
  → page reads search back out of the address bar
  → passes it to the fetch hook
  → hook builds /api/consumers?search=jane             (URLSearchParams)
  → server filters rows where name/email contains "jane"
  → returns just those rows
```

### On the frontend (the page)
```tsx
// The box updates instantly as you type (local state)...
const [searchInput, setSearchInput] = useState(search);

// ...but we wait 400ms after typing stops before touching the URL (debounce).
useEffect(() => {
  const timer = setTimeout(() => {
    if (searchInput !== search) {
      updateParams({ search: searchInput || undefined, page: undefined });
    }
  }, 400);
  return () => clearTimeout(timer);
}, [searchInput]);
```

**What is a debounce, and why?** Without it, typing "jane" fires four searches
(j, ja, jan, jane) — four requests, four address-bar changes. A debounce says
*"wait until they stop typing for 400ms, then search once."* Every keystroke
cancels the previous timer (`clearTimeout`) and starts a fresh countdown, so only
the final pause actually runs.

> **Say this:** "We don't search on every letter — we wait until you pause, then
> send one request. That's a debounce."

Notice `page: undefined` — starting a **new search resets you to page 1**, so you
don't stay on "page 5" of results that no longer have 5 pages.

### On the backend (the API)
```js
const search = (req.query.search ?? "").toString().trim();
// ...
if (search) {
  const like = `%${search}%`;   // % = wildcard → "term anywhere in the value"
  query = query.or(
    `first_name.ilike.${like},middle_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`,
  );
}
```
- `req.query.search` is how the server **reads** the `?search=` value.
- `ilike` = case-insensitive "contains"; `%jane%` matches "Jane", "JANET", "dejane".
- `.or(...)` = match **any** of these columns (name OR email).
- No search term? We skip the filter and return everything (paged).

---

## 4. Pagination as query parameters

Goal: don't download 10,000 rows — fetch one **page** at a time.

Pagination uses **two** query params:
- **`page`** — which page you want (1, 2, 3, …).
- **`pageSize`** — how many rows per page (10, 20, …).

### The core idea: turn page + size into a row range
If each page shows 10 rows:

| page | rows you want | zero-based range |
|------|---------------|------------------|
| 1 | 1st–10th | `0 .. 9` |
| 2 | 11th–20th | `10 .. 19` |
| 3 | 21st–30th | `20 .. 29` |

The formula (0-based, because databases count from 0):
```
from = (page - 1) * pageSize
to   = from + pageSize - 1
```
So page 2, size 10 → `from = 10`, `to = 19`. The server returns only those rows.

### On the backend (the API)
```js
const page     = Math.max(1, parseInt(req.query.page, 10) || 1);       // default 1
const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10)); // default 10, cap 100

const from = (page - 1) * pageSize;
const to   = from + pageSize - 1;

const { data, count } = await supabaseAdmin
  .from(TABLE)
  .select(COLS, { count: "exact" })  // count = TOTAL matching rows (all pages)
  .range(from, to);                  // return only this page's slice
```

Two things the server sends back that pagination needs:
1. **the rows** for this page (`data`), and
2. **`total`** — how many rows match in *total* (from `count: "exact"`), so the
   frontend can say "Showing 11–20 of 42" and know there are 5 pages.

> **Say this:** "`page` and `pageSize` become a row range. `.range(10, 19)` grabs
> just page 2. `count` tells us the grand total so we know how many pages exist."

### On the frontend (the page)
The page reads `page`/`pageSize` from the URL and does the display math:
```tsx
const totalPages = Math.max(1, Math.ceil(total / pageSize));  // 42 / 10 → 5 pages (round UP)
const start = total === 0 ? 0 : (page - 1) * pageSize + 1;    // "Showing 11..."
const end   = Math.min(page * pageSize, total);               // "...–20 of 42"
```
- `Math.ceil` rounds **up** — 42 rows at 10/page needs 5 pages (the 5th has 2).
- `start`/`end` are the friendly "Showing X–Y" numbers.

Clicking a page button just changes the URL param:
```tsx
const goToPage = (p) => updateParams({ page: p > 1 ? p : undefined });
```
That updates the address bar → the hook re-reads `page` → re-fetches → new rows.

---

## 5. How search + pagination work together

They're independent params, so they combine naturally:

```
/api/consumers?search=mailinator&page=2&pageSize=3
```
means: "Rows matching *mailinator*, page 2, 3 per page." The server first
**filters** by the search, then **counts** the matches, then returns the
**range** for that page. Tested live: 8 rows matched, but only 3 came back
because `pageSize=3`, and it was the *second* group of 3.

> **The golden sentence:** "Each concern is just a query param. Search filters,
> `page`+`pageSize` slice. Add them to the URL and the server does the rest."

---

## 6. The full picture in one diagram

```
  ADDRESS BAR (what the user sees)          useSearchParams (read/write)
  /consumers?search=jane&page=2  ◀──────────────────┐
        │  page reads params out                     │ page writes params in
        ▼                                             │ (on type / click)
  useConsumers({ search:"jane", page:2, pageSize:10 })│
        │  hook builds request with URLSearchParams   │
        ▼                                             │
  GET /api/consumers?search=jane&page=2&pageSize=10   │
        │  (visible in the Network tab)               │
        ▼                                             │
  BACKEND: req.query.search / page / pageSize         │
        │  ilike filter + .range(from,to) + count     │
        ▼                                             │
  { consumers: [...10 rows...], total: 42 }  ─────────┘  → render rows + "of 42"
```

---

## 7. Live demo checklist (open the Network tab)

1. Go to **Consumers** → see the request `consumers?page=1&pageSize=10`.
2. Click it → **Payload / Query String Parameters** shows `page`, `pageSize` as a
   neat list. → **Response** shows `{ consumers, total, page, pageSize }`.
3. **Type in search** → a new request appears with `?search=...` (after the
   debounce pause). The **address bar** also updates.
4. **Click page 2** → new request with `?page=2`.
5. **Change rows-per-page to 5** → `?pageSize=5`, back to page 1.
6. **Refresh the browser** → your search/page stay, because they're in the URL.

---

## 8. Quick answers to likely questions

**Q: Why are `page`/`pageSize` strings on the server?**
Everything in a URL is text. `?page=2` arrives as `"2"`, so we `parseInt` it and
default/clamp it (missing or junk → page 1, size 10, max 100).

**Q: Why send `total` from the server?**
The page only receives 10 rows, so it can't know there are 42 in total. `total`
(from `count: "exact"`) lets us compute the page count and "Showing X–Y of Z".

**Q: Why reset to page 1 when searching or changing page size?**
Because the number of results changed. Staying on "page 5" could land you on a
page that no longer exists.

**Q: What's the difference between the two URLs I keep seeing?**
The **address bar** URL (the route the user is on) and the **API request** URL
that `fetch` sends. We keep our params in the address bar (`useSearchParams`),
read them out, and pass them to the request. Same `?search=...`, two purposes.

**Q: Why a debounce on search?**
So we send one request when you *pause*, not one per keystroke.

---

## 9. Cheat sheet

- Query params live after `?`, as `key=value`, joined by `&`.
- They're always **strings**; convert & default them on the server.
- **`URLSearchParams`** builds the request URL; **`useSearchParams`** syncs the
  address bar.
- **Search** = one param (`search`) → server does an `ilike` "contains" filter.
- **Pagination** = two params (`page`, `pageSize`) → server returns a row
  `.range()` + a `total` count.
- `from = (page-1)*pageSize`, `to = from + pageSize - 1`.
- `totalPages = ceil(total / pageSize)`.
- New search / new page size → reset to **page 1**.
- Params in the URL = shareable, bookmarkable, refresh-proof.
