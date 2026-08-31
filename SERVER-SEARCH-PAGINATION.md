# Server-Side Search, Pagination & Sorting with Query Params (Beginner Guide)

We moved **search**, **pagination**, AND **sorting** off the frontend and onto
the **backend**, all controlled by **URL query params**. This guide explains what
that means, why it's better, and walks through every piece — the actual work is
done by the database, driven by params like:

```
/api/consumers?search=jane&page=2&pageSize=10&sort=name&dir=desc
```

---

## 1. First: what is a "query param"?

A URL can carry extra info after a `?`. Those are **query parameters**:

```
/api/consumers?search=jane&page=2&pageSize=10
                └──── these are query params ────┘
```

- They start after `?`.
- Each is `key=value`.
- They're joined with `&`.

So `?search=jane&page=2&pageSize=10` means: *"give me consumers matching 'jane',
page 2, 10 per page."* Query params are the standard way a client tells an API
**how** it wants the data — filtered, sorted, paged, etc.

---

## 2. Client-side vs server-side — what actually changed

### Before (client-side)
The frontend downloaded **all** consumers once, then did the work in the browser:
- **Search:** filtered the full array with JavaScript.
- **Pagination:** sliced the array to show 10 at a time.

Problem: it downloads **everything**. Fine for 8 rows; terrible for 100,000 —
you'd ship the whole database to every browser.

### After (server-side)
The frontend asks the server for **exactly the page it needs**:
- **Search:** the database filters the rows.
- **Pagination:** the database returns only that slice.

The browser only ever receives ~10 rows at a time, no matter how big the table
is. This is how real apps do it.

```
BEFORE:  browser downloads 100,000 rows → filters/slices in JS
AFTER:   browser asks "?search=jane&page=2" → server returns just 10 rows
```

---

## 3. The flow, end to end

```
 User types "jane" and clicks page 2
        │
        ▼
 Frontend builds a URL:  /api/consumers?search=jane&page=2&pageSize=10
        │  (fetch)
        ▼
 Express reads the query params (search, page, pageSize)
        │
        ▼
 Supabase/Postgres:  filter by "jane"  +  return only rows 10–19  +  count total
        │
        ▼
 Response:  { consumers: [...10 rows...], total: 42, page: 2, pageSize: 10 }
        │
        ▼
 Frontend renders those rows + "Showing 11–20 of 42"
```

The important mindset shift: **the frontend no longer owns the data — it owns the
*question*** (search + which page), and the server owns the answer.

---

## 4. The backend (`server/routes/consumers.js`)

```js
consumersRouter.get("/", async (req, res) => {
  // 1. Read the query params off the URL. They arrive as strings (or missing),
  //    so clean them and apply defaults.
  const search   = (req.query.search ?? "").toString().trim();
  const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

  // 2. Convert page + pageSize into a row RANGE. `.range()` is 0-based and
  //    inclusive:  page 1/size 10 -> rows 0..9;  page 2 -> rows 10..19.
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  // 3. Start the query. `count: "exact"` also returns the TOTAL number of
  //    matching rows (ignoring the range) — needed to compute page count.
  let query = supabaseAdmin
    .from(TABLE)
    .select(COLS, { count: "exact" })
    .order("consumer_number", { ascending: true });

  // 4. If a search term was given, match it against several columns.
  //    `ilike` = case-insensitive "contains";  `%term%` = term anywhere.
  //    `.or(...)` = match ANY of these conditions.
  if (search) {
    const like = `%${search}%`;
    query = query.or(
      `first_name.ilike.${like},middle_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`,
    );
  }

  // 5. Apply the page range and run it.
  const { data, error, count } = await query.range(from, to);
  if (error) return res.status(500).json({ message: error.message });

  res.json({ consumers: data.map(rowToConsumer), total: count ?? 0, page, pageSize });
});
```

### The three ideas to teach here

1. **`req.query`** — Express automatically parses `?search=jane&page=2` into an
   object: `req.query.search === "jane"`, `req.query.page === "2"`. Note values
   are **always strings**, so we `parseInt` the numbers and guard with defaults.

2. **`ilike` + `%...%`** — this is "contains, case-insensitive". `%jane%` matches
   "Jane", "JANE", "Janet". Searching several columns with `.or(...)` means "match
   the name OR the email".

3. **`.range(from, to)` + `count: "exact"`** — `range` returns just one page of
   rows; `count` tells us how many match in total. Together they're everything
   pagination needs: the slice **and** the total.

> **Defaults & safety:** if `page`/`pageSize` are missing or garbage, we fall
> back to page 1 / size 10, clamp `pageSize` to a max of 100, and treat a missing
> search as "no filter". Never trust query params blindly — always sanitize.

---

## 5. The frontend hook (`get/useConsumers.ts`)

The hook takes `{ search, page, pageSize }`, builds the URL, and re-fetches
whenever any of them change.

```ts
export function useConsumers({ search, page, pageSize }) {
  const [consumers, setConsumers] = useState([]);
  const [total, setTotal] = useState(0);
  // ...isLoading / isError / error...

  useEffect(() => {
    let ignore = false;

    async function load() {
      // URLSearchParams builds "?search=...&page=..." and encodes it safely.
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/consumers?${params.toString()}`);
      // ...check res.ok, parse json...
      if (!ignore) {
        setConsumers(data.consumers);
        setTotal(data.total);   // ← so the page can show "of 42"
      }
    }

    load();
    return () => { ignore = true; };   // ignore stale/out-of-order responses
  }, [search, page, pageSize]);        // ← re-fetch when the "question" changes

  return { consumers, total, isLoading, isError, error };
}
```

### Two things worth calling out

- **`URLSearchParams`** — the native, safe way to build a query string. It
  URL-encodes values for you (so a search like "a b&c" won't break the URL). Much
  better than gluing strings together by hand.

- **The dependency array `[search, page, pageSize]`** — this is the engine of the
  whole feature. The moment any of those three change, `useEffect` re-runs and
  fetches the new page. The component just changes the *inputs*; the hook reacts.

---

## 6. The page (`ConsumersListPage.tsx`)

The page owns the state and the pagination UI.

### Search with a debounce

```ts
const [searchInput, setSearchInput] = useState(""); // what's in the box now
const [search, setSearch] = useState("");           // what we send to the server

useEffect(() => {
  const timer = setTimeout(() => {
    setSearch(searchInput);  // commit the term after a pause
    setPage(1);              // new search → back to page 1
  }, 400);
  return () => clearTimeout(timer);  // typing again cancels the pending timer
}, [searchInput]);
```

**Why debounce?** Without it, typing "jane" fires **four** requests (j, ja, jan,
jane). Debouncing waits until you *stop* typing for 400ms, then sends **one**
request. The trick: every keystroke resets `searchInput`, which re-runs the
effect; the cleanup `clearTimeout` cancels the previous countdown, so only the
final pause actually fires.

> Simple mental model: "Don't ask the server on every letter — wait until they
> stop typing."

### Raw pagination math

```ts
const totalPages = Math.max(1, Math.ceil(total / pageSize));
const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
const end   = Math.min(page * pageSize, total);
// → "Showing {start}–{end} of {total} results"
```

- `totalPages` = how many pages exist (round **up** — 42 rows / 10 = 5 pages).
- `start` / `end` = the human-friendly "Showing 11–20" numbers.

### Raw pagination controls
Plain buttons update `page`, which flows into the hook, which re-fetches:

```tsx
<Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
{/* one numbered button per page */}
<Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
```

And a native `<select>` for rows-per-page (resetting to page 1 on change). No
table library involved — we set `showPagination={false}` on the `DataTable` and
feed it exactly the rows the server returned.

---

## 7. Sorting — the same pattern applied

Sorting is now server-side too, driven by two params: `sort` (which column) and
`dir` (`asc` or `desc`).

### Backend: a whitelist + `.order()`

```js
// Only these columns may be sorted — a WHITELIST. This maps the frontend's
// field name to the real DB column and blocks anything else.
const SORT_COLUMNS = {
  consumerNumber: "consumer_number",
  name: "first_name",
  email: "email",
  accountStatus: "account_status",
};
const sortColumn = SORT_COLUMNS[req.query.sort] ?? "consumer_number"; // safe default
const ascending = req.query.dir !== "desc"; // ascending unless "desc"

let query = supabaseAdmin
  .from(TABLE)
  .select(COLS, { count: "exact" })
  .order(sortColumn, { ascending }); // ← the database does the sorting
```

**Why the whitelist matters (security!):** we never pass `req.query.sort` straight
into the query. A user could send `?sort=some_secret_column` or junk. By mapping
through `SORT_COLUMNS` and falling back to `consumer_number`, only approved
columns are ever sortable. Tested: `?sort=DROP;` safely falls back — no harm.

### Frontend hook: two more optional params

```ts
if (sort && dir) {
  params.set("sort", sort);
  params.set("dir", dir);
}
// ...and added to the effect's dependency array so a sort change re-fetches.
```

### The clever part: reusing the table header for server-side sorting

The `DataTable` header already shows the ↑/↓ arrows and handles clicks. We didn't
want to rebuild that — but we DID want the database to do the actual sorting. The
solution is TanStack Table's **`manualSorting`** mode:

- `manualSorting` = true tells the table: **"don't reorder the rows yourself."**
- We pass `sorting` (the current sort state) and `onSortingChange` (a callback)
  from the page, so sorting is **controlled by the parent**.
- When a header is clicked, the table just **reports** it via `onSortingChange`.
  The page updates its `sort`/`dir`, the hook re-fetches, and the server returns
  rows **already sorted**.

So the library only renders the arrow and tells us *which column was clicked* —
the sorting itself is a plain SQL `ORDER BY` on the server.

```tsx
// In ConsumersListPage.tsx
const [sorting, setSorting] = useState<SortingState>([]);  // e.g. [{ id:"name", desc:true }]

// Convert the table's sort state into simple query params:
const sort = sorting[0]?.id;                                   // "name"
const dir  = sorting[0] ? (sorting[0].desc ? "desc" : "asc") : undefined;

useConsumers({ search, page, pageSize, sort, dir });

<DataTable
  sorting={sorting}
  onSortingChange={handleSortingChange}  // updates sorting + resets to page 1
  manualSorting
  showPagination={false}
  /* ...columns, data... */
/>
```

`SortingState` is just an array like `[{ id: "name", desc: false }]`. We read the
first entry to get the active column (`sort`) and direction (`dir`).

---

## 8. Verified working (tested live)

| Request | Result |
|---------|--------|
| `?page=1&pageSize=3` | `total: 8`, rows `[1, 7, 8]` |
| `?page=2&pageSize=3` | rows `[9, 10, 11]` (next slice) |
| `?search=jane` | `total: 1` → "Jane Holmes" |
| `?search=mailinator&pageSize=5` | `total: 8`, but only 5 rows returned (paged) |
| `?search=zzznomatch` | `total: 0`, no rows |
| `?sort=name&dir=asc` | Amy, Darius, Deborah, Jane... (A→Z) |
| `?sort=name&dir=desc` | Tasha, Sophia, Sloane, Kuame... (Z→A) |
| `?sort=DROP;` (invalid) | safely falls back to default sort — no injection |
| `?search=mailinator&sort=name&dir=desc&page=2&pageSize=3` | correct page-2 slice of the sorted, searched results |

The last case is the best one to demo: **search + sort + pagination all at once**,
all on the backend, composed into one query. The `mailinator` search matched all
8 by email, sorted them Z→A by name, and returned just the 3 rows of page 2.

---

## 9. One-liner for your session

> "Instead of downloading everything and filtering in the browser, the frontend
> now sends its request as URL query params —
> `?search=jane&page=2&pageSize=10&sort=name&dir=desc` — and the server does the
> filtering, paging, AND sorting in the database, returning just that page plus a
> total count. The frontend owns the *question*; the server owns the *answer*.
> It's the same pattern every real app uses, and it scales to millions of rows
> because the browser only ever receives one small page."

---

## 10. Honest limitations (good to mention if asked)

- **Search special characters:** the `.or()` filter injects the raw term; a
  comma or parenthesis in the search could confuse the filter parser. A
  production version would escape those. Fine for the demo.
- **Sorting by name** sorts by `first_name` only (not the full "first middle
  last" string). Good enough for the demo; a production version might sort by
  last name or a combined expression.
- **URL sync (now done):** the search/page/sort/pageSize live in the browser
  address bar via React Router's `useSearchParams`, so the view survives a
  refresh and is shareable/bookmarkable. The URL is the single source of truth —
  the page reads its state out of the URL and writes changes back into it.
