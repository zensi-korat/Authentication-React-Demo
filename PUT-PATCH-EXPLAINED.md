# PUT & PATCH + Method-wise File Organization, Explained

This guide covers the two methods we just added (**PUT** and **PATCH**), how they
differ, how they flow through the app, and how the consumer hooks are now
organized **method-wise** into folders.

---

## 1. The new folder structure

The consumer data hooks are now grouped by HTTP method. Shared, non-hook files
(types, table columns) stay at the top level.

```
client/src/features/consumers/
├── get/
│   ├── useConsumers.ts         → GET  /api/consumers        (list)
│   └── useConsumerDetail.ts    → GET  /api/consumers/:id    (one)
├── post/
│   └── useCreateConsumer.ts    → POST /api/consumers        (create)
├── put/
│   └── useReplaceConsumer.ts   → PUT  /api/consumers/:id    (full replace)  ★ new
├── patch/
│   └── useUpdateConsumer.ts    → PATCH /api/consumers/:id   (partial update) ★ new
├── delete/
│   └── useDeleteConsumer.ts    → DELETE /api/consumers/:id  (remove)
├── types.ts                    (shared Consumer / AccountStatus types)
├── consumers-page.columns.tsx  (table column definitions)
└── consumers-page.data.ts      (status → label/color map)
```

**Why organize this way?** For a session about HTTP methods, a folder per method
makes the mapping obvious: one glance shows every method the app supports and
which hook implements it. In a normal production app you'd more likely group by
*feature* than by *method* — this layout is chosen for teaching clarity.

Each page imports the hook it needs from the method folder, e.g.:

```ts
import { useConsumers }       from "@/features/consumers/get/useConsumers";
import { useCreateConsumer }  from "@/features/consumers/post/useCreateConsumer";
import { useUpdateConsumer }  from "@/features/consumers/patch/useUpdateConsumer";
import { useReplaceConsumer } from "@/features/consumers/put/useReplaceConsumer";
import { useDeleteConsumer }  from "@/features/consumers/delete/useDeleteConsumer";
```

---

## 2. PUT vs PATCH — the core idea

Both **change an existing** record (identified by its id in the URL). The
difference is *how much* you send:

| | **PUT** | **PATCH** |
|---|---------|-----------|
| Meaning | **Replace** the whole record | **Update** part of the record |
| You send | **Every** editable field | **Only** the fields that changed |
| Omitted fields | Get **reset/cleared** | Left **untouched** |
| Analogy | Rewrite the whole contact card | Change just the phone number |
| Typical use | "Reset to exactly this" | Normal "Edit" form save |

> **One-liner:** PUT means "make the record *exactly* this"; PATCH means "change
> *these fields* and leave the rest alone."

### A concrete example (from our own live test)

Starting record:
```json
{ "firstName": "Sloane", "middleName": "Orlando Pearson", "lastName": "Mccall", "accountStatus": "active" }
```

**PATCH** `{ "accountStatus": "delinquent" }` →
```json
{ "firstName": "Sloane", "middleName": "Orlando Pearson", "lastName": "Mccall", "accountStatus": "delinquent" }
```
Only status changed. **The middle name stayed.**

**PUT** `{ "firstName": "PutTest", "lastName": "Replaced", "email": "...", "accountStatus": "active" }`
(note: no `middleName` sent) →
```json
{ "firstName": "PutTest", "middleName": "", "lastName": "Replaced", "accountStatus": "active" }
```
Everything replaced. **The middle name was cleared** because PUT sends the whole
record and we didn't include one.

That single difference — middle name kept vs. cleared — is the clearest way to
demo PUT vs PATCH in your session.

---

## 3. The backend routes (`server/routes/consumers.js`)

Both routes target `/:id`, validate, run an `UPDATE` on the `demo_consumers`
table, and return the updated row. If no row matches the id, Supabase reports
zero rows (`PGRST116`) or an invalid-UUID error (`22P02`), which we turn into a
clean `404`.

### PUT — full replace

```js
consumersRouter.put("/:id", async (req, res) => {
  const body = req.body;
  // PUT requires the full set of editable fields:
  if (!body || typeof body.firstName !== "string" || typeof body.lastName !== "string"
           || typeof body.email !== "string" || typeof body.accountStatus !== "string") {
    return res.status(400).json({ message: "...all required for a full replace (PUT)" });
  }

  // Build a COMPLETE row — every column set, so an omitted middleName is cleared.
  const fullRow = {
    first_name: body.firstName,
    middle_name: body.middleName ?? "",   // ← the "replace" behavior
    last_name: body.lastName,
    email: body.email,
    account_status: body.accountStatus,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE).update(fullRow).eq("id", req.params.id).select(COLS).single();
  // ...404 / 400 handling...
  res.json({ consumer: rowToConsumer(data) });
});
```

### PATCH — partial update

```js
consumersRouter.patch("/:id", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ message: "A JSON body is required" });
  }

  // consumerToRow already drops undefined fields → a naturally partial row.
  const row = consumerToRow(body);
  if (Object.keys(row).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE).update(row).eq("id", req.params.id).select(COLS).single();
  // ...404 / 400 handling...
  res.json({ consumer: rowToConsumer(data) });
});
```

**The key implementation detail:** the existing `consumerToRow(input)` helper
only copies fields that are `!== undefined`. That means PATCH automatically
sends just the provided fields, while PUT deliberately builds a *full* row by
hand. Same database call (`.update()`), different row shape.

---

## 4. The frontend hooks

Both hooks are plain `fetch` calls and follow the same shape as the POST hook.
The only real differences are the **method** and **what goes in the body**.

### PATCH hook — `patch/useUpdateConsumer.ts`

```ts
export type UpdateConsumerInput = Partial<Omit<Consumer, "id" | "consumerNumber">>;
//                                 ^^^^^^^ every field optional (partial)

const res = await fetch(`/api/consumers/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),   // only the changed fields
});
```

`Partial<...>` is the TypeScript way of saying "all these fields are optional" —
exactly what a partial update needs.

### PUT hook — `put/useReplaceConsumer.ts`

```ts
export type ReplaceConsumerInput = Omit<Consumer, "id" | "consumerNumber">;
//                                 ^^^^ all fields required (full record)

const res = await fetch(`/api/consumers/${id}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),   // the whole record
});
```

Both call `mutate(id, input)` and return the updated consumer, mirroring the
create hook's `{ mutate, isPending, error }` interface.

---

## 5. The Edit page (`pages/ConsumerEditPage.tsx`)

This is where PUT and PATCH are actually used, so you can demo them live.

**Route:** `/consumers/:id/edit` (added in `App.tsx`). There's an **Edit
Consumer** button on the detail page.

**Flow:**
1. `useConsumerDetail(id)` **GET**s the current record to pre-fill the form.
2. A `useEffect` copies the loaded values into editable form state.
3. Two buttons:
   - **"Save changes (PATCH)"** — compares each field to the original and sends
     **only the differences**:
     ```ts
     const changes = {};
     if (firstName !== consumer.firstName) changes.firstName = firstName;
     // ...one check per field...
     await patchConsumer(id, changes);   // PATCH with just the diffs
     ```
     If nothing changed, it sends nothing and shows "Nothing changed".
   - **"Replace all (PUT)"** — sends **every** field regardless:
     ```ts
     await putConsumer(id, { firstName, middleName, lastName, email, accountStatus });
     ```
4. On success, it navigates back to the detail page (which re-fetches and shows
   the updated data — no caching involved).

**Demo tip for your session:** open a consumer with a middle name, go to Edit,
change only the status, and:
- Click **Save changes (PATCH)** → toast shows exactly which field was sent; the
  middle name is preserved.
- Or click **Replace all (PUT)** after clearing the middle name field → the
  middle name is wiped, proving PUT replaces the whole record.

---

## 6. The complete method map (all five now)

| Action | Method | Hook | Backend route |
|--------|--------|------|---------------|
| List consumers | GET | `get/useConsumers` | `GET /api/consumers` |
| One consumer | GET | `get/useConsumerDetail` | `GET /api/consumers/:id` |
| Create | POST | `post/useCreateConsumer` | `POST /api/consumers` |
| Full replace | **PUT** | `put/useReplaceConsumer` | `PUT /api/consumers/:id` |
| Partial update | **PATCH** | `patch/useUpdateConsumer` | `PATCH /api/consumers/:id` |
| Delete | DELETE | `delete/useDeleteConsumer` | `DELETE /api/consumers/:id` |

Your app now demonstrates the full set of common REST methods, one folder each.

---

## 7. Verified working

These were tested live against the running backend:

- ✅ PATCH `{accountStatus}` → only status changed, middle name kept
- ✅ PUT (no middleName) → whole record replaced, middle name cleared
- ✅ PATCH `{}` → `400 "No valid fields to update"`
- ✅ PUT missing a field → `400 "...all required for a full replace"`
