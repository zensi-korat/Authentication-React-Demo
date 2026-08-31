# Live Demo Run-Sheet — Revealing the 5 Methods

The 5 method hooks are pre-written but **switched OFF** (real `fetch` code sits
inside a `/* ... */` comment). During the demo you **enable each one by removing
the `/*` and `*/`**, save, and it works live. No typing syntax in front of anyone.

---

## Before you start (prep)

1. **Run both servers:**
   - Backend: in `server/` → `npm run dev` (port 8787)
   - Frontend: in `client/` → `npm run dev` (port 5173)
2. Open the app at **http://localhost:5173** and log in
   (`demo@example.com` / `Demo1234!`).
3. Open **DevTools → Network tab**, click **Fetch/XHR**, and (recommended)
   **right-click the column header → enable "Method"** so GET/POST/PATCH/DELETE
   are visible at a glance.
4. Open your editor with these 5 files ready in tabs:
   - `client/src/features/consumers/get/useConsumers.ts` (STEP 1)
   - `client/src/features/consumers/post/useCreateConsumer.ts` (STEP 2)
   - `client/src/features/consumers/put/useReplaceConsumer.ts` (STEP 3)
   - `client/src/features/consumers/patch/useUpdateConsumer.ts` (STEP 4)
   - `client/src/features/consumers/delete/useDeleteConsumer.ts` (STEP 5)

**The reveal action is the same every time:** find the block marked
`👉 DEMO STEP N`, delete the `/*` line above the code and the `*/` line below it,
then **save** (Vite hot-reloads instantly).

---

## Starting state (what your manager sees first)

- The Consumers list is **empty** ("No consumers found") — because GET is still OFF.
- This is your hook: *"Right now nothing talks to the server yet. Let's turn on
  each method one at a time and watch it work."*

> Note: the single-record GET (`useConsumerDetail`) is intentionally left ON so
> the Detail and Edit pages can load a record once the list has data. You're
> revealing the **list** GET as the representative read.

---

## STEP 1 — GET (read the list)

**File:** `get/useConsumers.ts`
**Do:** remove the `/*` and `*/` around the STEP 1 block → save.
**Show:**
- The list **fills with data** instantly.
- In Network: a **GET** `consumers?page=1&pageSize=10` → click it → **Response**
  shows the JSON rows.
- Type in the search box / click a page → new GET requests with `?search=` /
  `?page=`.

**Say:** *"GET just reads. No body — the options ride in the URL as query params."*

---

## STEP 2 — POST (create)

**File:** `post/useCreateConsumer.ts`
**First show it's off:** click **Add Consumer**, fill the form, Save →
you get an error toast ("Failed to create consumer"). *"Not wired up yet."*
**Do:** remove the `/*` and `*/` around the STEP 2 block → save.
**Show:** submit the form again → **success toast**, redirected to the list with
the new row. In Network: a **POST** → **Payload** tab shows the JSON body you sent.

**Say:** *"POST creates. Now we send a body — method + Content-Type + the data."*

---

## STEP 3 — PUT (full replace)

**File:** `put/useReplaceConsumer.ts`
**Do:** open a consumer → **Edit** → remove the `/*` and `*/` around STEP 3 → save.
**Show:** click **"Replace all (PUT)"** → saved. In Network: a **PUT** → **Payload**
shows **every** field. (If you cleared the middle name, point out it's now blank —
PUT replaced the whole record.)

**Say:** *"PUT replaces the entire record — every field is sent."*

---

## STEP 4 — PATCH (partial update)

**File:** `patch/useUpdateConsumer.ts`
**Do:** on the Edit page, remove the `/*` and `*/` around STEP 4 → save.
**Show:** change **only** the status → click **"Save changes (PATCH)"** → saved.
In Network: a **PATCH** → **Payload** shows **only the one changed field**.

**Say:** *"PATCH updates only what changed — a much smaller body than PUT."*

---

## STEP 5 — DELETE (remove)

**File:** `delete/useDeleteConsumer.ts`
**Do:** open a consumer → remove the `/*` and `*/` around STEP 5 → save.
**Show:** click **Delete** → confirm → the row is gone, back on the list. In
Network: a **DELETE** request (no body needed — the id is in the URL).

**Say:** *"DELETE removes it. Id in the URL, no body."*

---

## Closing line

> "Five methods, and every one was the same shape in code: `fetch` → check
> `res.ok` → read the JSON. Only the **method** and whether we send a **body**
> changed."

---

## Gotchas & tips

- **Save the file** after removing the markers — Vite hot-reloads on save.
- **Which request is which:** with the Method column on, GET/POST/PUT/PATCH/DELETE
  are labeled. Rows named by the consumer id (`abc123`) can look identical — the
  Method column disambiguates.
- **PATCH sends nothing if you didn't change a field** — always edit a field first,
  or it shows "Nothing changed — no PATCH sent" and makes no request.
- **If a step doesn't work:** make sure you removed **both** the `/*` and the `*/`
  (not just one), and that you saved.

---

## Resetting for another rehearsal

Your edits just remove the `/*`/`*/` markers. To switch a method back OFF, put
the `/*` and `*/` back (or press **Cmd/Ctrl+Z** to undo). Want a clean reset of
all five at once? Ask and they can be restored to the OFF state instantly.
