# ConsumersListPage & DataTable, Explained in Detail

A plain-language walkthrough of `client/src/pages/ConsumersListPage.tsx` and the
reusable `DataTable` it renders. Order follows the data: **page → columns →
table engine**.

Files covered:
- `client/src/pages/ConsumersListPage.tsx` — the page
- `client/src/features/consumers/consumers-page.columns.tsx` — column definitions
- `client/src/features/consumers/consumers-page.data.ts` — status → label/color map
- `client/src/components/ui/data-table.tsx` — the reusable table engine

---

## Part 1: `ConsumersListPage.tsx` — the page

This page's job is simple: **fetch the consumers, let the user search them, and
hand the result to a table.** It owns almost no table logic itself — that's
delegated to `DataTable`.

### 1a. Getting the data

```tsx
const { consumers, isLoading, isError, error } = useConsumers();
const [searchQuery, setSearchQuery] = useState("");
```

- `useConsumers()` is the GET hook. The page pulls out the data and the three
  status flags.
- `searchQuery` is local state for the search box (starts empty).

### 1b. Filtering the list (client-side search)

```tsx
const filteredData = useMemo(() => {
  if (!searchQuery.trim()) return consumers;          // no query → show all
  const query = searchQuery.toLowerCase();
  return consumers.filter((consumer) =>
    [consumer.firstName, consumer.middleName, consumer.lastName]
      .filter(Boolean)          // drop empty middle names
      .join(" ")
      .toLowerCase()
      .includes(query) || consumer.email.toLowerCase().includes(query),
  );
}, [consumers, searchQuery]);
```

This computes the visible rows by keeping only consumers whose **name or email**
contains the typed text. Key points:

- **It's client-side filtering** — all consumers are already in memory; we're
  just hiding some. (A large app would filter on the server instead.)
- **Why `useMemo`?** Filtering runs on *every* render (typing, etc.). `useMemo`
  caches the result and only recomputes when `consumers` or `searchQuery`
  actually change — so re-renders caused by *other* things don't redo the filter
  work. Same "don't redo work every render" idea as `useCallback`, but for a
  **value** instead of a function.
- `.filter(Boolean)` removes empty middle names so you don't get
  `"Ada  Lovelace"` with a double space.

### 1c. The header (title + search + Add button)

```tsx
<Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} ... />
<Button onClick={() => navigate("/consumers/add")}> Add Consumer </Button>
```

- The search box is a **controlled input**: its value comes from `searchQuery`,
  and every keystroke calls `setSearchQuery`, which re-renders and re-filters.
- The Add button just navigates to the create page.

### 1d. The three render states

The important pattern — **a data page always has three possible states**, and
the page picks one:

```tsx
{isLoading ? (
  <Skeleton ... />          // 1. still fetching → show gray placeholder bars
) : isError ? (
  <p>Failed to load...</p>  // 2. fetch failed → show the error message
) : (
  <DataTable ... />         // 3. success → show the table
)}
```

The page never assumes data is present. It shows a **skeleton** while loading,
an **error** on failure, and only renders the table on success. This is exactly
the `isLoading` / `isError` / data trio the hook exposes.

### 1e. Handing data to the table

```tsx
<DataTable
  columns={consumersColumns}     // HOW to display columns (from the columns file)
  data={filteredData}            // WHAT rows to show (filtered consumers)
  pageSize={10}
  showPagination={true}
  emptyMessage="No consumers found."
  onRowClick={(consumer) => navigate(`/consumers/${consumer.id}`)}
/>
```

Two things the table needs are separated on purpose:
- **`data`** = the rows (the *what*).
- **`columns`** = the recipe for each column (the *how*).
- **`onRowClick`** = clicking a row navigates to that consumer's detail page.

---

## Part 2: `consumers-page.columns.tsx` — the column definitions

`columns` tells the table **what columns exist and how to render each cell.**
It's an array of column definitions:

```tsx
export const consumersColumns: ColumnDef<Consumer>[] = [ ... ];
```

Each entry describes one column. There are two ways a column gets its value:

**1. `accessorKey` — read a field directly**
```tsx
{ accessorKey: "consumerNumber", header: "ID", cell: ({ row }) => (...), enableSorting: true }
```
- `accessorKey: "consumerNumber"` → this column's value is `consumer.consumerNumber`.
- `header: "ID"` → the column's title text.
- `cell: ({ row }) => ...` → **custom rendering**. Here it shows `#123` in a
  monospace font, with the raw UUID as a hover tooltip (`title={row.original.id}`).
- `enableSorting: true` → clicking the header sorts by this column.

**2. `accessorFn` — compute a value**
```tsx
{ id: "name", accessorFn: (row) => getFullName(row), header: "Consumer Name", enableSorting: true }
```
- There's no single "name" field, so `accessorFn` **builds one** by joining
  first + middle + last. Because it's computed (not a real key), it needs an
  explicit `id: "name"`.

**The status column renders a colored badge:**
```tsx
{
  accessorKey: "accountStatus",
  cell: ({ row }) => {
    const status = row.getValue("accountStatus") as Consumer["accountStatus"];
    return <Badge variant={ACCOUNT_STATUS_CONFIG[status].variant}>
             {ACCOUNT_STATUS_CONFIG[status].label}
           </Badge>;
  },
}
```

`ACCOUNT_STATUS_CONFIG` (from `consumers-page.data.ts`) maps each status to a
label + color:

```ts
active:     { label: "Active",     variant: "green" }
delinquent: { label: "Delinquent", variant: "amber" }
inactive:   { label: "Inactive",   variant: "red" }
```

So the raw value `"active"` becomes a green **Active** badge.

**Key idea:** `row.original` = the full original `Consumer` object;
`row.getValue("x")` = one column's computed value. `cell` returns JSX, so a
column can render anything — text, a badge, a button.

---

## Part 3: `DataTable` — the reusable table engine

`DataTable` is a **generic, reusable** component (`<TData, TValue>`) — it doesn't
know about consumers at all. You could feed it users, invoices, anything. It's
built on **TanStack Table** (`@tanstack/react-table`), a "headless" table
library: it does the *logic* (sorting, filtering, pagination) but you supply the
*markup*.

### 3a. The engine: `useReactTable`

```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
  ...
  state: { sorting, columnFilters, globalFilter: searchValue, expanded },
});
```

This one call creates a `table` object that holds all the logic. Think of those
`get*RowModel` functions as **plugins you switch on**:
- `getCoreRowModel` — the baseline (always on): turn `data` into rows.
- `getSortedRowModel` — enable sorting.
- `getFilteredRowModel` — enable filtering.
- `getPaginationRowModel` — enable paging (only if `showPagination`).
- `getExpandedRowModel` — expandable sub-rows (only if `renderSubRow` is passed —
  unused on this page).

The table's own state (`sorting`, `columnFilters`, `expanded`) lives in
`useState` at the top and is passed back in via `state`. So the table is
**controlled** by React state — a header click calls `setSorting`, which
re-renders with newly sorted rows.

> Note on search: this page filters *before* passing `data` in (its
> `filteredData`), and doesn't pass `searchValue`, so the table's own
> `globalFilter` is effectively unused here. The visible filtering is the page's
> `useMemo`.

### 3b. Rendering the header

```tsx
{table.getHeaderGroups().map((headerGroup) => (
  <TableRow key={headerGroup.id}>
    {headerGroup.headers.map((header) => (
      <TableHead>
        {header.column.getCanSort() ? (
          <Button onClick={header.column.getToggleSortingHandler()}>
            {flexRender(header.column.columnDef.header, header.getContext())}
            {/* ↑↓ arrow depending on sort state */}
          </Button>
        ) : (
          flexRender(header.column.columnDef.header, header.getContext())
        )}
      </TableHead>
    ))}
  </TableRow>
))}
```

- `table.getHeaderGroups()` gives the header rows to draw.
- If a column **can sort**, its header becomes a button; clicking runs
  `getToggleSortingHandler()`, which cycles none → asc → desc and shows the
  matching ↑/↓ arrow. Non-sortable columns (email, status) render as plain text.
- **`flexRender`** is TanStack's helper to render a column's `header`/`cell` — it
  handles both plain strings (`"ID"`) and functions that return JSX.

### 3c. Rendering the body

```tsx
{table.getRowModel().rows?.length ? (
  table.getRowModel().rows.map((row) => (
    <TableRow
      onClick={() => onRowClick?.(row.original)}   // ← row click → navigate
      role="button" tabIndex={0}
      onKeyDown={...Enter/Space also triggers...}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ))
) : (
  <TableRow><TableCell colSpan={columns.length}>{emptyMessage}</TableCell></TableRow>
)}
```

- `table.getRowModel().rows` = the **final rows after sorting/filtering/paging**.
  You never loop over raw `data` directly — you loop over what the engine
  computed.
- For each row, `row.getVisibleCells()` gives its cells;
  `flexRender(cell.column.columnDef.cell, ...)` runs each column's `cell`
  function (the badge, the `#123`, etc.).
- `onRowClick?.(row.original)` passes the **original consumer** back up — that's
  how `navigate(`/consumers/${consumer.id}`)` works. It's also keyboard-
  accessible (`role="button"`, `tabIndex`, Enter/Space).
- If there are zero rows, it shows a single centered `emptyMessage` row instead.

### 3d. Pagination

At the bottom (only if `showPagination`):
- A **"Showing 1–10 of 42 results"** counter computed from `pageIndex` and
  `pageSize`.
- A **rows-per-page** dropdown (`table.setPageSize`).
- **Previous / numbered / Next** buttons wired to `table.previousPage()`,
  `table.setPageIndex(i)`, `table.nextPage()`, with
  `getCanPreviousPage()/getCanNextPage()` disabling the ends.

---

## The one-paragraph summary (for the session)

> The page fetches consumers with `useConsumers`, filters them with a `useMemo`
> search, and shows one of three states: a skeleton while loading, an error
> message on failure, or the `DataTable` on success. It passes the table two
> things: **`data`** (the rows) and **`columns`** (how to render each column —
> including a computed full-name column and a colored status badge). `DataTable`
> itself is a generic component powered by TanStack Table: `useReactTable`
> handles sorting, filtering, and pagination as toggleable "row models," and we
> just render the header/body/pagination markup around it using `flexRender`.
> Clicking a row calls `onRowClick` with the original consumer, which navigates
> to its detail page.

---

## Quick reference — who does what

| Piece | Responsibility |
|-------|----------------|
| `ConsumersListPage` | Fetch data, run search, pick loading/error/table state |
| `useMemo` filter | Compute visible rows from the search query |
| `consumersColumns` | Define columns + how each cell renders |
| `ACCOUNT_STATUS_CONFIG` | Map status value → label + badge color |
| `DataTable` | Generic table shell (markup + wiring) |
| `useReactTable` | The engine: sorting, filtering, pagination logic |
| `flexRender` | Render a column's header/cell (string or JSX) |
| `onRowClick` | Navigate to the clicked consumer's detail page |
