# Speaking Scripts — File-by-File Code Walkthrough

Read-aloud narration for the live code portion of the session. Order matches the
plan: **five methods first, then query params.**

**Walkthrough order**
1. GET — `get/useConsumerDetail.ts` *(plain GET, no query params)*
2. POST — `post/useCreateConsumer.ts`
3. PUT — `put/useReplaceConsumer.ts`
4. PATCH — `patch/useUpdateConsumer.ts`
5. DELETE — `delete/useDeleteConsumer.ts`
6. **Bridge line** → query params
7. Query params (GET) — `get/useConsumers.ts`
8. The page — `pages/ConsumersListPage.tsx`

> Tip: keep the browser + Network tab open. After each method, trigger it in the
> UI and point at the matching request.

---

## Before you start — say this once

> "Every call in this app has the **same skeleton**: call `fetch`, check if the
> response is OK, then read the JSON. Only two things change between methods — the
> **method name** and whether we send a **body**. So once you've seen one, you've
> seen them all. Let's go through the five methods."

Keep this in your pocket and repeat "same skeleton" each time — it's the thread
that ties the whole walkthrough together.

---

## 1. GET — `get/useConsumerDetail.ts`

**Framing:**
> "The first and simplest method is **GET** — it just **reads** data. No body; it
> only needs a URL. This hook fetches one consumer by its id."

**Types (lines 3–19) — quick:**
> "Quick TypeScript. `Consumer` is the shape of one row. `ConsumerResponse` is
> what the server sends back — an object with a `consumer` inside. That's just
> describing the data; let's look at the request."

**The hook + state (lines 22–26):**
> "It takes an `id` — which consumer we want. Inside, four pieces of state: the
> `consumer` itself, plus `isLoading`, `isError`, `error`. That trio shows up in
> every read: are we loading, did it fail, and here's the data."

**The GET request — the core (line 43):**
> "Here's the whole method in one line: `fetch` of `/api/consumers/` plus the id.
> Notice — **no method, no headers, no body.** When you call `fetch` with just a
> URL, it defaults to **GET**. That's it — give me the thing at this URL."

**The response (lines 44–49):**
> "Then the standard three steps: check `res.ok` — because `fetch` doesn't throw
> on a 404, we check ourselves and throw if it failed. Then `res.json()` turns the
> body into a real object. Then we save it into state."

**useEffect + id dependency (lines 31, 71):**
> "The fetch runs inside `useEffect`, which re-runs whenever the `id` changes. So
> open a different consumer → new id → it fetches the new one automatically."

**ignore flag — light touch (lines 35, 68–70):**
> "This `ignore` flag is just a safety guard — it stops a slow, old response from
> overwriting newer data if you switch consumers quickly. Don't overthink it."

**Close / transition:**
> "So that's **GET** — no body, just read from a URL. Now, what changes when we
> need to *send* data? That's **POST**."

**Land it:** *"GET reads. Call `fetch` with just a URL — it defaults to GET."*

---

## 2. POST — `post/useCreateConsumer.ts`

**Framing:**
> "**POST creates** something new. The big difference from GET: we're **sending
> data** now, so the request grows a body."

**The input type (line 23):**
> "`CreateConsumerInput` is what the caller must provide — every field **except**
> `id` and `consumerNumber`, because the **server** generates those. You don't get
> to pick a new record's id."

**mutate + the request (lines 38–49):**
> "Instead of running on render like GET, creating happens when the user submits
> the form — so we expose a `mutate` function you call on submit. Inside, look at
> the fetch: now we pass three new things (point at lines 44–48):
> 1. **`method: 'POST'`** — the verb.
> 2. **`headers: { 'Content-Type': 'application/json' }`** — 'the body I'm sending
>    is JSON,' so the server parses it correctly.
> 3. **`body: JSON.stringify(input)`** — the actual data, turned into a JSON string
>    because the network can only carry text."

**The response (lines 50–55):**
> "Same skeleton as GET: check `res.ok`, then `res.json()`. It returns the created
> consumer — which now has the server-generated id."

**State names (lines 32, 40, 61):**
> "One small thing: instead of `isLoading` we call it `isPending` — 'the save is in
> progress' — used to disable the Save button so you can't double-submit."

**Close / transition:**
> "So POST = same skeleton, plus method + Content-Type + body. Now — updating an
> existing record. There are **two** ways, and the contrast is the whole lesson:
> **PUT** and **PATCH**."

**Land it:** *"POST creates. It adds three things: method, Content-Type header, and a body."*

---

## 3 & 4. PUT vs PATCH — teach these together

> Open both files side by side. The point is the **difference**, so present them as
> a pair, not two separate things.

**Framing:**
> "There are two ways to update a record. **PUT replaces the whole thing** — you
> send every field. **PATCH updates just part** — you send only what changed.
> Same URL, same skeleton — the difference is *how much you send*."

### PUT — `put/useReplaceConsumer.ts`
**The input type (line 22):**
> "`ReplaceConsumerInput` requires **every** editable field — because PUT means
> 'make the record exactly this.'"

**The request (lines 40–44):**
> "The fetch uses **`method: 'PUT'`**, the id in the URL, and a body that's the
> **whole object** — every field, changed or not. Anything you leave out gets
> **cleared** on the server, because you're replacing the entire record."

### PATCH — `patch/useUpdateConsumer.ts`
**The input type (line 22):**
> "`UpdateConsumerInput` uses `Partial<...>`, which makes **every field optional**.
> So the caller sends only the fields that changed."

**The request (lines 39–43):**
> "The fetch uses **`method: 'PATCH'`**, same URL, but the body is **only the
> changed fields**. Everything you don't send is left exactly as it was."

**The killer live demo (do this now):**
> "Watch the difference. On the Edit page I'll change only the status.
> - **Save changes (PATCH)** → in the Network Payload you'll see *only*
>   `{ accountStatus }` — and the middle name stays.
> - **Replace all (PUT)** → the Payload has *every* field — and because I didn't
>   type a middle name, PUT **clears** it.
> Same edit, two behaviors. That's PUT vs PATCH."

**Close / transition:**
> "PUT = make it exactly this. PATCH = change these fields, leave the rest. Last
> method — removing a record: **DELETE**."

**Land it:** *"PUT replaces the whole record; PATCH updates only what you send."*

---

## 5. DELETE — `delete/useDeleteConsumer.ts`

**Framing:**
> "The last method is **DELETE** — remove a record. It's the shortest file, and
> notice there aren't even any types."

**The request (line 13):**
> "One line: `fetch` of `/api/consumers/` plus the id, with **`method: 'DELETE'`**.
> Like GET, there's **no body** — the id in the URL is all the server needs to know
> what to remove."

**The response (lines 14–17):**
> "Same `res.ok` check. There's no data to return — the record's gone — so we don't
> parse a body on success; we just confirm it worked."

**Close / the big recap:**
> "And that's all five methods. Look how similar they were — every one was
> **fetch → check res.ok → read JSON**. Only the **method** and the **body**
> changed:
> - GET and DELETE — no body.
> - POST, PUT, PATCH — a body.
> Five verbs, one shape."

**Land it:** *"DELETE removes. Id in the URL, no body."*

---

## 6. The bridge — methods → query params

> Say this slowly. It's the pivot that makes query params feel like a continuation.

> "Four of those five methods are simple. But **GET** has a problem: what if there
> are 10,000 consumers? We don't want all of them at once. We need to **refine the
> read** — search it, page it, sort it. We do that by adding **query parameters**
> to the GET's URL. So query params aren't a new method — they're just **options
> on the GET you already met.** Let me show you the smarter GET."

---

## 7. Query params (GET) — `get/useConsumers.ts`

**Framing:**
> "Remember GET from earlier? This is the same verb — but a *smart* GET. We attach
> **options** to the URL: search, page, sort. Those options are query params."

**The types (lines 17–31) — quick, but flag two things:**
> "Two shapes worth noting. `ConsumersResponse` (line 17) — the server sends back
> not just the rows but a **`total`** count, which we'll need for pagination. And
> `UseConsumersParams` (line 25) — the five options the page passes in: `search`,
> `page`, `pageSize`, and optional `sort` and `dir`. These five are the *question*
> we ask the server."

**The heart — building the query string (lines 60–70):**
> "This is the whole point of the file. We need a URL like
> `/api/consumers?search=jane&page=2&pageSize=10`. We could glue that string
> together by hand, but that's error-prone — so JavaScript gives us a built-in
> tool: **`URLSearchParams`** (line 60).
> Watch how we build it: *if* there's a search term, add `search` (line 61); always
> add `page` and `pageSize` (lines 62–63); and *only if* a column is sorted, add
> `sort` and `dir` (lines 65–68). Then `params.toString()` produces the
> `?search=...&page=...` string and safely encodes special characters for us.
> **That** is a query param — a `key=value` pair after the `?` that refines the
> request."

**The fetch (line 70):**
> "And here's the request: `fetch` of `/api/consumers` **plus** that query string.
> This exact URL is what you see in the Network tab."

*(Live: switch to the browser, search something, show the same URL appear.)*

**The response (lines 71–79) — brief:**
> "Same skeleton as always: check `res.ok`, parse the JSON, and save both the rows
> and the `total`."

**The dependency array (line 95) — emphasize:**
> "This line is what makes it reactive. The effect re-runs whenever `search`,
> `page`, `pageSize`, `sort`, or `dir` changes. So the moment the user searches or
> clicks page 2, a **new** URL is built and we re-fetch. The page just changes the
> options; the hook re-asks the question automatically."

**Close / transition:**
> "So this is still just a **GET** — same verb — we only attached options as query
> params. Now let's see the page that decides those options and puts them in the
> address bar."

**Land it:** *"Turn options into a `?key=value` string with URLSearchParams, attach it to a GET, re-fetch when the options change."*

---

## 8. The page — `pages/ConsumersListPage.tsx`

**Framing:**
> "This page is organized into three labeled blocks — **SEARCH**, **PAGINATION**,
> **SORTING** — plus one shared helper. Each block does the same thing: read its
> option from the URL, and write changes back to the URL."

**The URL is the source of truth (lines 15–34):**
> "First, `useSearchParams` (line 18) — this reads and writes the `?...` part of
> the **address bar**. And `updateParams` (line 22) is a small helper that changes
> some query params while keeping the rest. So the **browser URL** holds all our
> state now."

**SEARCH block (lines 36–52):**
> "We read `search` from the URL (line 39). The box itself uses local state so it
> updates instantly as you type — but we only push it into the URL **400ms after
> you stop typing**. That's a **debounce** (line 45): so we don't fire a request on
> every letter. And a new search resets back to page 1."

**PAGINATION block (lines 54–63):**
> "We read `page` and `pageSize` from the URL, with defaults of 1 and 10. Then two
> tiny handlers: `goToPage` changes the page param; `changePageSize` changes the
> size and resets to page 1."

**SORTING block (lines 65–83) — brief:**
> "Same idea: read `sort` and `dir` from the URL, and when a header is clicked,
> write the new sort back."

**The fetch + display math (lines 86–98):**
> "All those URL values flow into `useConsumers` — the hook we just saw. And below
> it we compute the display numbers: `totalPages`, and the 'Showing X–Y of Z' — that
> needs `total` from the server, which is why it sits right after the fetch."

**The live 'aha' (do this):**
> "Watch the address bar as I use the page." Type a search, click page 2, sort a
> column → the URL becomes `/consumers?search=jane&page=2&sort=name&dir=asc`. Then
> **refresh** → the view stays.
> "Two URLs working together: the address bar holds the state, and the hook turns
> that into the API request. That's why this view is shareable and survives a
> refresh."

**Close — the whole talk in two lines:**
> "So: **five verbs, one shape in code.** And **query params are just options on a
> GET — the question in the URL.**"

---

## Pocket one-liners (say these as you go)

- **Every method:** "fetch → check `res.ok` → read JSON. Only the method and body change."
- **GET:** "reads; just a URL; no body."
- **POST:** "creates; adds method + Content-Type + body."
- **PUT vs PATCH:** "PUT replaces the whole record; PATCH updates only what you send."
- **DELETE:** "removes; id in the URL, no body."
- **Bridge:** "GET has too much data — we refine it with query params."
- **Query params:** "options after the `?`; built with URLSearchParams; re-fetch when they change."
- **Two URLs:** "the address bar holds the state; the hook turns it into the request."
