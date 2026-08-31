# The Page Files, Explained — How Hooks Meet the UI

We've covered the **hooks** (the code that talks to the API). This guide covers
the **pages** — the screens the user sees — and, most importantly, **how a page
uses a hook and turns its data into UI.** Plain language, read-aloud friendly.

Pages covered:
- `ConsumersListPage.tsx` — the list (uses the GET-list hook)
- `ConsumerDetailPage.tsx` — one consumer (uses GET-one + DELETE)
- `ConsumerAddPage.tsx` — create form (uses POST)
- `ConsumerEditPage.tsx` — edit form (uses GET-one + PATCH + PUT)

---

## 0. The big idea: hooks fetch, pages present

Keep this division clear in your head (and say it in the session):

> **A hook's job:** talk to the API and hand back data + status flags.
> **A page's job:** call the hook, then decide what to show — a spinner, an error,
> or the data — and wire up buttons/forms to the hook's actions.

The page never calls `fetch` itself. It just **uses** the hook and reacts to what
comes back. Think of the hook as a kitchen and the page as the waiter arranging
the plate for the customer.

---

## 1. Patterns you'll see on EVERY page

Learn these five once and all four pages read easily.

### a) Pulling values out of a hook (destructuring)
```tsx
const { consumers, total, isLoading, isError, error } = useConsumers({ ... });
```
The hook returns an object; this line grabs the pieces the page needs. You can
also **rename** while destructuring, which the pages use to avoid clashes:
```tsx
const { mutate: deleteConsumer, isPending: isDeleting } = useDeleteConsumer();
//              ↑ rename mutate → deleteConsumer, isPending → isDeleting
```

### b) The three states of any data screen
Every page that reads data handles the same three cases, in order:
1. **Loading** → show a skeleton/placeholder.
2. **Error** → show an error message.
3. **Success** → show the data.

### c) `navigate()` — moving between pages
```tsx
const navigate = useNavigate();
navigate("/consumers");              // go to the list
navigate(`/consumers/${id}/edit`);   // go to a specific page
```
This is how a page sends the user somewhere else after an action (or on a click).

### d) `toast` — little pop-up notifications
```tsx
toast.success("Consumer created");
toast.error("Failed to create consumer");
```
Quick feedback after an action succeeds or fails.

### e) Controlled inputs — React owns the form fields
```tsx
const [email, setEmail] = useState("");
<Input value={email} onChange={(e) => setEmail(e.target.value)} />
```
The input's value **comes from** state, and every keystroke **updates** state. So
React always knows the current value — that's what "controlled" means. When the
user submits, we just read those state variables.

---

## 2. `ConsumersListPage.tsx` — reading a list (GET)

**What it does:** fetch the consumers and show them in a table, with search,
pagination, and sorting (all via the URL).

### How it uses the hook
```tsx
const { consumers, total, isLoading, isError, error } = useConsumers({
  search, page, pageSize, sort, dir,   // the "question", read from the URL
});
```
The page reads `search`/`page`/`pageSize`/`sort`/`dir` from the address bar
(`useSearchParams`), passes them to the hook, and gets back `consumers` (this
page's rows) and `total` (the grand count). *(The URL/query-param details are in
`QUERY-PARAMS-DEEP-DIVE.md`; here we focus on using the data.)*

### Turning the data into UI — the three states
A helper `renderContent()` picks one of the three states with plain early returns:
```tsx
function renderContent() {
  if (isLoading) return <Skeletons />;        // 1. loading
  if (isError)   return <ErrorMessage />;     // 2. error
  return <><DataTable .../> <Pagination /></>; // 3. success
}
```
> Say this: "The page asks the hook three questions — are we loading, did it
> fail, is the data here — and shows the matching screen. Only the third case
> renders the table."

### Handing data to the table
```tsx
<DataTable
  data={consumers}                                   // the rows
  columns={consumersColumns}                          // how to render columns
  onRowClick={(consumer) => navigate(`/consumers/${consumer.id}`)}  // row → detail page
  ...
/>
```
- `data={consumers}` — the rows straight from the hook.
- `onRowClick` — clicking a row navigates to that consumer's detail page, using
  its `id`.

### The pagination display
```tsx
const totalPages = Math.max(1, Math.ceil(total / pageSize));
// "Showing {start}–{end} of {total} results"
```
`total` (from the hook) is what lets the page say "of 42" and know how many pages
exist.

**One-liner:** "This page reads the list from `useConsumers`, shows loading/error/
data, and renders the rows in a table where a click opens the detail page."

---

## 3. `ConsumerDetailPage.tsx` — one record (GET + DELETE)

**What it does:** show one consumer's details, with Edit and Delete buttons.

### It uses TWO hooks
```tsx
const { consumer, isLoading, isError, error } = useConsumerDetail(id); // READ
const { mutate: deleteConsumer, isPending: isDeleting } = useDeleteConsumer(); // DELETE
```
- `useConsumerDetail(id)` — reads the one consumer. Where does `id` come from?
  ```tsx
  const { id = "" } = useParams<{ id: string }>();
  ```
  **`useParams`** reads the `:id` out of the URL path (`/consumers/abc123` → `id =
  "abc123"`). That id is passed to the hook.
- `useDeleteConsumer()` — gives a `deleteConsumer` function for the Delete button.

### The three states as early returns
```tsx
if (isLoading) return <Skeleton .../>;                 // loading
if (isError || !consumer) return <ErrorMessage />;     // error / not found
// ...otherwise we have `consumer`, so render it
```
> Note the `!consumer` guard: after these two returns, TypeScript (and we) know
> `consumer` definitely exists, so the rest of the page can use it safely.

### Showing the data
```tsx
const fullName = [consumer.firstName, consumer.middleName, consumer.lastName]
  .filter(Boolean).join(" ");   // skip empty middle name, join with spaces
// ...
<p>{consumer.email}</p>
<Badge variant={ACCOUNT_STATUS_CONFIG[consumer.accountStatus].variant}>...</Badge>
```
Just reading fields off the `consumer` object the hook returned.

### The Delete action (how a mutation is used)
```tsx
async function handleDelete() {
  if (!consumer) return;
  try {
    await deleteConsumer(consumer.id);   // call the DELETE hook, WAIT for it
    toast.success("Consumer deleted");   // success feedback
    navigate("/consumers");              // go back to the list
  } catch {
    toast.error("Failed to delete consumer");  // failure feedback
  }
}
```
This is the **standard mutation pattern**, and you'll see it on every action page:
1. `await` the hook's `mutate`.
2. On success → toast + navigate.
3. On failure → the `catch` shows an error toast.

The Delete button lives inside a confirmation dialog (`AlertDialog`) so the user
must confirm first, and it's disabled while `isDeleting` is true.

**One-liner:** "It reads one consumer with `useConsumerDetail(id)` (id from the
URL), shows loading/error/data, and the Delete button calls `useDeleteConsumer`,
then toasts and navigates back."

---

## 4. `ConsumerAddPage.tsx` — creating (POST)

**What it does:** a form to create a new consumer.

### It uses the POST hook
```tsx
const { mutate, isPending, error } = useCreateConsumer();
```
No data to *read* here — creating is an **action**, so we just take `mutate` (to
send the new consumer), `isPending` (to disable the button while saving), and
`error`.

### The form fields are controlled state
```tsx
const [firstName, setFirstName] = useState("");
const [email, setEmail] = useState("");
// ...one useState per field...
<Input value={email} onChange={(e) => setEmail(e.target.value)} required />
```
Each field is a piece of state (pattern 1e). React holds the current values.

### Submitting (how POST is used)
```tsx
async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();                 // stop the browser's default page reload
  try {
    await mutate({ firstName, middleName, lastName, email, accountStatus }); // POST
    toast.success("Consumer created");
    navigate("/consumers");           // back to the list
  } catch {
    toast.error("Failed to create consumer");
  }
}
```
- **`e.preventDefault()`** — by default an HTML form reloads the page on submit;
  we stop that so React can handle it.
- We gather the field state into one object and hand it to `mutate` — the hook
  turns it into the POST body.
- Same mutation pattern: `await` → toast → navigate (or `catch` on failure).

### The button reflects progress
```tsx
<Button type="submit" disabled={isPending}>
  {isPending ? "Saving..." : "Save"}
</Button>
```
While the request is in flight, the button is disabled and says "Saving..." — so
the user can't double-submit.

**One-liner:** "A controlled form collects the fields; on submit we hand them to
`useCreateConsumer`'s `mutate` (a POST), then toast and go back to the list."

---

## 5. `ConsumerEditPage.tsx` — editing (GET + PATCH + PUT)

The richest page: it **reads** the existing record, then offers **two** ways to
save it. It combines everything above.

### It uses THREE hooks
```tsx
const { consumer, isLoading, isError } = useConsumerDetail(id);        // 1. READ (pre-fill)
const { mutate: patchConsumer, isPending: isPatching } = useUpdateConsumer();  // 2. PATCH
const { mutate: putConsumer,   isPending: isPutting }  = useReplaceConsumer(); // 3. PUT
```
- One read hook to load the current values.
- Two mutation hooks — one for PATCH, one for PUT — renamed for clarity.

### Pre-filling the form (the key extra step)
The form fields start empty, but we want them to show the existing values. So once
the consumer arrives, we copy it into the fields:
```tsx
useEffect(() => {
  if (!consumer) return;               // wait until the data is here
  setFirstName(consumer.firstName);
  setMiddleName(consumer.middleName);
  // ...copy every field...
}, [consumer]);                        // runs when `consumer` arrives
```
> Say this: "The GET loads the consumer; this `useEffect` copies those values into
> the form so the inputs start pre-filled. It runs when `consumer` shows up."

### Save with PATCH — send only what changed
```tsx
async function handlePatch(e) {
  e.preventDefault();
  const changes = {};
  if (firstName !== consumer.firstName) changes.firstName = firstName;  // only diffs
  // ...one comparison per field...

  if (Object.keys(changes).length === 0) {
    toast.info("Nothing changed — no PATCH sent.");   // nothing to do
    return;                                            // ← no request at all
  }
  await patchConsumer(id, changes);                    // PATCH with just the diffs
  toast.success(`Saved via PATCH (${Object.keys(changes).join(", ")})`);
  navigate(`/consumers/${id}`);
}
```
It compares each field to the original and sends **only the differences**. If
nothing changed, it sends **nothing** (that's why you sometimes see no PATCH
request in the Network tab).

### Save with PUT — send the whole record
```tsx
async function handlePut() {
  await putConsumer(id, { firstName, middleName, lastName, email, accountStatus }); // ALL fields
  toast.success("Replaced via PUT (all fields sent)");
  navigate(`/consumers/${id}`);
}
```
No diffing — it always sends every field. (Omitting one would clear it, because
PUT replaces the whole record.)

### Two buttons, one form
```tsx
<Button type="submit">Save changes (PATCH)</Button>          {/* form submit → handlePatch */}
<Button type="button" onClick={handlePut}>Replace all (PUT)</Button>  {/* explicit click → handlePut */}
```
The **submit** button runs PATCH (the form's `onSubmit={handlePatch}`); the
**PUT** button is `type="button"` so it doesn't submit the form — it calls
`handlePut` directly. Both are disabled while `isBusy = isPatching || isPutting`.

**One-liner:** "It GETs the consumer to pre-fill the form, then offers two saves:
PATCH sends only changed fields, PUT sends them all — each its own button."

---

## 6. Side-by-side: which page uses what

| Page | Hooks used | Reads data? | Sends data? | Key extra idea |
|------|-----------|:-----------:|:-----------:|----------------|
| List | `useConsumers` (GET) | ✅ | — | three states + table + URL params |
| Detail | `useConsumerDetail` (GET), `useDeleteConsumer` (DELETE) | ✅ | ✅ delete | `useParams` for the id; confirm dialog |
| Add | `useCreateConsumer` (POST) | — | ✅ create | controlled form + submit |
| Edit | `useConsumerDetail` (GET), `useUpdateConsumer` (PATCH), `useReplaceConsumer` (PUT) | ✅ | ✅ update | pre-fill via `useEffect`; PATCH diff vs PUT all |

---

## 7. The one flow to remember (repeat it for each page)

Every page is the same three-beat rhythm:

1. **Call the hook(s)** → get `data` + status flags (and `mutate` for actions).
2. **Read data / handle states** → loading, error, or show the data.
3. **Wire actions** → a button/form calls `mutate`, then `toast` + `navigate`.

> "Hooks do the talking to the server; pages decide what to show and what happens
> when the user acts. Read the hook, handle the three states, wire the buttons."

---

## 8. Pocket one-liners

- **Page vs hook:** "Hooks fetch; pages present."
- **Three states:** "loading → error → data, in that order."
- **`useParams`:** "reads the `:id` out of the URL for the detail/edit pages."
- **Controlled input:** "value from state, onChange updates state — React owns it."
- **Mutation pattern:** "`await mutate(...)` → toast success → navigate; `catch` →
  toast error."
- **`isPending`:** "disable the button and show 'Saving...' so you can't double-submit."
- **Edit pre-fill:** "GET the record, then a `useEffect` copies it into the form fields."
- **Add vs Edit:** "Add starts blank and POSTs; Edit pre-fills and PATCHes/PUTs."
