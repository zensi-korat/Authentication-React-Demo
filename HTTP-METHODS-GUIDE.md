# HTTP Methods & the Fetch Flow — A Beginner's Guide

This is a plain-language guide to how the frontend talks to the backend in this
app, and what the HTTP methods (GET, POST, PUT, PATCH, DELETE) actually mean.
Read it top to bottom — each section builds on the last.

---

## 1. The mental model: a request and a response

Every time the frontend needs data, it sends a **request** to the backend and
gets back a **response**. Think of it like ordering at a restaurant:

- **Request** = you telling the waiter what you want.
- **Response** = the waiter bringing back food (or saying "we're out of that").

In code, the frontend sends a request with `fetch(...)` and the backend
(Express) sends a response back.

```
  FRONTEND  ───────────  request  ──────────▶   BACKEND
  (React)   ◀──────────  response  ─────────    (Express)
```

---

## 2. Anatomy of a REQUEST

A request has four parts. Only the first two are always required.

| Part | What it is | Example |
|------|-----------|---------|
| **URL** | *Where* the request goes | `/api/consumers` |
| **Method** | *What kind* of action (the "verb") | `GET`, `POST`, ... |
| **Headers** | Extra info about the request | `Content-Type: application/json` |
| **Body** | The data you send along | `{ "firstName": "Ada" }` |

In `fetch`, that looks like:

```js
fetch("/api/consumers", {          // 1. URL
  method: "POST",                  // 2. Method
  headers: {                       // 3. Headers
    "Content-Type": "application/json",
  },
  body: JSON.stringify({           // 4. Body (must be a string)
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  }),
});
```

**Key rules to remember:**
- If you don't pass a `method`, `fetch` defaults to **GET**.
- A body must be a **string**, which is why we wrap objects in `JSON.stringify(...)`.
- When you send a JSON body, you should set the `Content-Type: application/json`
  header so the server knows how to read it.
- **GET and DELETE usually have no body.** POST, PUT, and PATCH do.

---

## 3. Anatomy of a RESPONSE

The response has three parts we care about:

| Part | What it is | Example |
|------|-----------|---------|
| **Status code** | A number saying how it went | `200`, `201`, `401`, `404`, `500` |
| **Headers** | Info about the response | `Content-Type: application/json` |
| **Body** | The actual data sent back | `{ "consumers": [ ... ] }` |

### Status codes you'll see in this app

| Code | Meaning | When |
|------|---------|------|
| **200** OK | Success | GET / DELETE worked |
| **201** Created | Success, something new was made | POST created a consumer |
| **400** Bad Request | You sent bad/missing data | Missing `firstName` on create |
| **401** Unauthorized | You're not logged in | No valid auth cookie |
| **404** Not Found | That thing doesn't exist | Consumer id not in the table |
| **500** Server Error | Something broke on the server | Database error |

Rough rule of thumb:
- **2xx** = success
- **4xx** = *you* (the client) did something wrong
- **5xx** = *the server* had a problem

### Reading a response in `fetch`

```js
const res = await fetch("/api/consumers");

// IMPORTANT: fetch does NOT throw on a 404 or 500. It only throws if the
// network itself fails (no internet, server unreachable). So we must check
// the status ourselves:
if (!res.ok) {                       // res.ok is true for any 2xx status
  throw new Error("Request failed");
}

const data = await res.json();       // parse the JSON body into an object
```

That `if (!res.ok)` check is the single most common beginner gotcha. Without it,
a failed request looks like a success and you try to use error data as if it
were real data.

---

## 4. The methods, one by one

The method is just a **verb** telling the server what you want to do. The
easiest analogy is a notebook full of contacts:

| Method | Intent | Notebook analogy | Body? | This app uses it? |
|--------|--------|------------------|-------|-------------------|
| **GET** | Read data | "Show me the contacts" | No | ✅ Yes |
| **POST** | Create new data | "Add a new contact" | Yes | ✅ Yes |
| **PUT** | Replace an item fully | "Rewrite this whole contact" | Yes | ❌ Not yet |
| **PATCH** | Update part of an item | "Just change their phone number" | Yes | ❌ Not yet |
| **DELETE** | Remove an item | "Tear out this contact page" | Usually no | ✅ Yes |

### GET — read

```js
// Frontend
const res = await fetch("/api/consumers");     // no method = GET
const data = await res.json();
// data => { consumers: [ {...}, {...} ] }
```
- **Request:** URL only. No body.
- **Response:** `200` + the data.

### POST — create

```js
// Frontend
const res = await fetch("/api/consumers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@x.com" }),
});
const data = await res.json();
// data => { consumer: { id: "...", firstName: "Ada", ... } }
```
- **Request:** method `POST` + a JSON body with the new item's fields.
- **Response:** `201 Created` + the newly created item (now with an `id`).

### PUT — full replace *(not in this app, shown for learning)*

```js
const res = await fetch("/api/consumers/123", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  // With PUT you send the WHOLE object — every field, even unchanged ones.
  body: JSON.stringify({
    firstName: "Ada", middleName: "", lastName: "King", email: "ada@x.com", accountStatus: "active",
  }),
});
```
- Use when you want to **overwrite the entire record**.
- If you leave a field out, it's treated as "set this to empty".

### PATCH — partial update *(not in this app, shown for learning)*

```js
const res = await fetch("/api/consumers/123", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  // With PATCH you send ONLY the fields that changed.
  body: JSON.stringify({ email: "new@example.com" }),
});
```
- Use when you want to **change just a few fields** and leave the rest alone.
- This is usually what "Edit" buttons use in real apps.

> **PUT vs PATCH in one line:** PUT replaces the whole thing; PATCH edits a piece.

### DELETE — remove

```js
const res = await fetch("/api/consumers/123", { method: "DELETE" });
// Response => { message: "Consumer deleted" }
```
- **Request:** method `DELETE`, id in the URL. No body needed.
- **Response:** `200` + a confirmation message.

---

## 5. Where each method lives in THIS codebase

Every call is a plain `fetch` (no wrapper). Frontend hook → backend route:

| Action | Method | Frontend file | Backend route |
|--------|--------|---------------|---------------|
| Log in | POST | `client/src/components/login-page.tsx` | `POST /api/auth/login` |
| Log out | POST | `client/src/components/dashboard-header.tsx` | `POST /api/auth/logout` |
| Who am I? | GET | `client/src/features/auth/useAuth.tsx` | `GET /api/auth/me` |
| List consumers | GET | `client/src/features/consumers/useConsumers.ts` | `GET /api/consumers` |
| One consumer | GET | `client/src/features/consumers/useConsumerDetail.ts` | `GET /api/consumers/:id` |
| Create consumer | POST | `client/src/features/consumers/useCreateConsumer.ts` | `POST /api/consumers` |
| Delete consumer | DELETE | `client/src/features/consumers/useDeleteConsumer.ts` | `DELETE /api/consumers/:id` |

Backend routes are defined in `server/routes/auth.js` and
`server/routes/consumers.js`.

---

## 6. The standard fetch pattern used everywhere

Every hook in this app follows the same shape. Learn this once and you can read
all of them:

```js
try {
  // 1. Send the request.
  const res = await fetch(url, options);

  // 2. Check the status — fetch won't do this for you.
  if (!res.ok) {
    const body = await res.json().catch(() => null);   // read { message } if present
    throw new Error(body?.message ?? "Request failed");
  }

  // 3. Parse and use the data.
  const data = await res.json();
  // ...use data...
} catch (err) {
  // 4. Handle any failure (network error OR the throw above).
}
```

The React hooks wrap this in three pieces of state:
- `isLoading` — true while step 1 is in flight
- the data — set after step 3 succeeds
- `error` — set in step 4 if anything fails

---

## 7. A note on things we intentionally left out (to keep it simple)

- **`apiFetch` wrapper** (`client/src/lib/fetch-client.ts`) — a single helper
  that did the `res.ok` check in one place. Kept in the repo as a reference, but
  **not used** — every hook calls `fetch` directly so the full flow is visible.
- **Caching** (`client/src/lib/simple-cache.ts`) — remembered past results to
  avoid re-fetching. Also kept but **not used**. Because of this, the list
  simply re-fetches whenever you open the page, which is easier to follow.

Both can be reintroduced later once the raw version is understood.
