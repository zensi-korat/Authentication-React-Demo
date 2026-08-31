# Pagination Flow — File by File, Start to End

How `page` and `pageSize` travel through the app, in the exact order to present
them. We follow **one thing** the whole way: the two query params `page` and
`pageSize`. (Search works the same way — this doc focuses on pagination.)

**File tour (present in this order):**
1. `client/src/features/consumers/get/useConsumers.ts` — the hook that fetches a page
2. `client/src/pages/ConsumersListPage.tsx` — where `page`/`pageSize` live and change
3. `server/routes/consumers.js` — what the server does with them
4. Back to the hook → the page — showing the result

At the end there's a full round-trip diagram.

---

## STAGE 1 — `useConsumers.ts` (the hook that fetches a page)

Start here. This hook's job: **take a `page` and `pageSize`, ask the server for
exactly that page, and hand back the rows + a total count.**

### It receives the two numbers
```ts
export function useConsumers({ search, page, pageSize }: UseConsumersParams) {
```
The hook doesn't decide the page — it's **given** `page` and `pageSize` by the
page component (we'll see where they come from in Stage 2).

### It turns them into a URL (the query params)
```ts
const params = new URLSearchParams();
if (search) params.set("search", search);
params.set("page", String(page));         // ← page number → ?page=
params.set("pageSize", String(pageSize)); // ← rows per page → ?pageSize=

const res = await fetch(`/api/consumers?${params.toString()}`);
// e.g. GET /api/consumers?page=2&pageSize=10
```
`URLSearchParams` builds the `?page=2&pageSize=10` string. `String(page)` because
a URL carries **text**, not numbers. This is the request that goes to the server.

### It reads back the rows AND the total
```ts
const data: ConsumersResponse = await res.json();
if (!ignore) {
  setConsumers(data.consumers); // just THIS page's rows
  setTotal(data.total);         // how many rows exist in TOTAL (all pages)
}
```
Notice the server sends **two** things: the page of rows, and `total`. We'll need
`total` back on the page to know how many pages there are.

### It re-fetches automatically when the page changes
```ts
}, [search, page, pageSize]);
```
This dependency array is the engine: **whenever `page` or `pageSize` changes, this
effect runs again and fetches the new page.** The hook never has to be told "go" —
it reacts to the numbers changing.

> **Say this:** "The hook takes a page and pageSize, turns them into
> `?page=&pageSize=`, fetches that slice, and stores the rows plus a total. If the
> page number changes, it re-fetches on its own."

**Now the natural question:** *where do `page` and `pageSize` come from?* → Stage 2.

---

## STAGE 2 — `ConsumersListPage.tsx` (where page & pageSize live and change)

The page is where the two numbers are **stored** (in the URL) and **changed** (by
the buttons).

### Where they come from: the URL
```ts
const [searchParams, setSearchParams] = useSearchParams();

const page = Number(searchParams.get("page")) || 1;        // reads ?page= (default 1)
const pageSize = Number(searchParams.get("pageSize")) || 10; // reads ?pageSize= (default 10)
```
The numbers live in the **browser address bar** (e.g. `/consumers?page=2`). We
read them out with `searchParams.get(...)`. `Number(...)` because the URL stores
text; `|| 1` / `|| 10` are the defaults when the param isn't there.

### It passes them to the hook (the link back to Stage 1)
```ts
const { consumers, total, isLoading, isError, error } = useConsumers({
  search,
  page,       // ← from the URL
  pageSize,   // ← from the URL
});
```
So: **URL → page/pageSize → hook.** This is the connection between the two files.

### How the user CHANGES the page: the buttons write to the URL
```ts
const goToPage = (p: number) => updateParams({ page: p > 1 ? p : undefined });
const changePageSize = (size: number) => updateParams({ pageSize: size, page: undefined });
```
- Clicking **Next / a page number** calls `goToPage(...)`, which writes a new
  `?page=` into the URL.
- Changing **rows-per-page** calls `changePageSize(...)`, which writes `?pageSize=`
  and resets to page 1.

`updateParams` just changes those params in the address bar. And because `page`
is **read from the URL** (above) and **passed to the hook**, changing the URL makes
the hook re-fetch. The loop closes itself.

### It shows the page numbers using `total`
```ts
const totalPages = Math.max(1, Math.ceil(total / pageSize)); // 42 rows / 10 = 5 pages
const start = total === 0 ? 0 : (page - 1) * pageSize + 1;    // "Showing 11..."
const end = Math.min(page * pageSize, total);                 // "...–20 of 42"
```
Remember `total` came from the server (Stage 1). It's what lets the page know how
many page buttons to draw and print "Showing 11–20 of 42".

### The buttons themselves
```tsx
<Button onClick={() => goToPage(page - 1)} disabled={page <= 1}>Previous</Button>
{/* one numbered button per page */}
<Button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Next</Button>
<select value={pageSize} onChange={(e) => changePageSize(Number(e.target.value))}>...</select>
```

> **Say this:** "The page number lives in the URL. The buttons write a new page
> into the URL. The page reads it back out and hands it to the hook, which
> re-fetches. `total` from the server tells us how many pages exist."

**Now:** the hook sent `?page=2&pageSize=10` to the server. What does the server
do? → Stage 3.

---

## STAGE 3 — `server/routes/consumers.js` (what the server does)

The request `GET /api/consumers?page=2&pageSize=10` arrives here.

### Read the two params (as text → numbers, with limits)
```js
const page = Math.max(1, parseInt(req.query.page, 10) || 1);
const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
```
`req.query.page` is how the server reads `?page=`. `parseInt` turns the text into a
number; the `Math` calls apply safe defaults/limits (page ≥ 1, pageSize 1–100).

### Turn page + pageSize into a row RANGE
```js
const from = (page - 1) * pageSize;  // page 2, size 10 → 10
const to   = from + pageSize - 1;    //                 → 19
```
This is the heart of pagination: page 2 of size 10 means **rows 10 through 19**
(counting from 0).

### Ask the database for just that slice + the grand total
```js
const { data, count } = await supabaseAdmin
  .from(TABLE)
  .select(COLS, { count: "exact" }) // count = TOTAL rows (ignores the range)
  .order("consumer_number", { ascending: true })
  .range(from, to);                 // return ONLY rows 10..19
```
- `.range(from, to)` → returns only that page's rows.
- `count: "exact"` → the **total** number of matching rows, across all pages.

### Send both back
```js
res.json({
  consumers: data.map(rowToConsumer), // this page's rows
  total: count ?? 0,                  // grand total (→ becomes the page's `total`)
  page,
  pageSize,
});
```

> **Say this:** "The server reads page and pageSize, turns them into a row range —
> page 2 size 10 is rows 10 to 19 — asks the database for just that slice plus the
> total count, and sends both back."

---

## STAGE 4 — back to the hook, then the page (showing the result)

The response travels back the way it came:

1. **`useConsumers.ts`** receives it and stores it:
   ```ts
   setConsumers(data.consumers); // this page's rows
   setTotal(data.total);         // grand total
   ```
2. **`ConsumersListPage.tsx`** re-renders with the new data:
   - `<DataTable data={consumers} />` shows the new page's rows.
   - `totalPages` / "Showing X–Y of Z" update from the new `total`.

Done — the new page is on screen.

---

## The full round trip (one picture)

```
        ┌──────────────────────── ConsumersListPage.tsx ────────────────────────┐
        │  1. User clicks "Next"  → goToPage(2) → writes ?page=2 into the URL     │
        │  2. page = Number(searchParams.get("page"))  → 2   (read back from URL) │
        │  3. useConsumers({ page: 2, pageSize: 10 })                             │
        └───────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
        ┌──────────────────────────── useConsumers.ts ──────────────────────────┐
        │  4. build URL: /api/consumers?page=2&pageSize=10                        │
        │  5. fetch(...)                                                          │
        └───────────────────────────────┬────────────────────────────────────────┘
                                         │  (HTTP request)
                                         ▼
        ┌─────────────────────────── consumers.js (server) ─────────────────────┐
        │  6. read page=2, pageSize=10                                            │
        │  7. from = 10, to = 19                                                  │
        │  8. .range(10,19) + count:"exact"                                       │
        │  9. respond { consumers: [10 rows], total: 42 }                         │
        └───────────────────────────────┬────────────────────────────────────────┘
                                         │  (HTTP response)
                                         ▼
        ┌──────────────────────────── useConsumers.ts ──────────────────────────┐
        │ 10. setConsumers(rows); setTotal(42)                                    │
        └───────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
        ┌──────────────────────── ConsumersListPage.tsx ────────────────────────┐
        │ 11. table shows page 2; "Showing 11–20 of 42"                           │
        └────────────────────────────────────────────────────────────────────────┘
                                         │
                    click "Next" again ──┘  (loop repeats)
```

---

## The 4 sentences to remember

1. **`useConsumers.ts`** turns `page`/`pageSize` into `?page=&pageSize=` and fetches
   that slice; it re-fetches whenever those numbers change.
2. **`ConsumersListPage.tsx`** stores the page in the URL, reads it back, passes it
   to the hook, and the buttons change it by writing a new page to the URL.
3. **`consumers.js`** turns page + pageSize into a row range (`from`/`to`), returns
   just that slice plus the `total` count.
4. The result flows back: hook stores rows + total → page shows the rows and
   "Showing X–Y of Z". Clicking a page just changes the URL and the loop repeats.
