# API, Fetch & Async — Session Handout

The reference document for this session. Everything here is meant to be shown on
screen or read by attendees — diagrams, tables, and code, no presenter notes. All
code examples are **plain JavaScript** (no React) so the concepts stay clean.

**Agenda**
1. What is an API?
2. REST vs GraphQL
3. JSON — data as text
4. Headers & `Content-Type`
5. Request & Response structure
6. Promises, async/await & fetch
7. The standard shape of a call (try/catch/finally)
8. Authenticated requests
9. Live demo checklist
10. The "two URLs" idea
11. Tour of the real code
12. Q&A reference
13. Cheat sheet

---

## 1. What is an API?

**API = Application Programming Interface.** A way for two programs to talk to
each other using an agreed set of rules.

**The restaurant analogy:**
- You (the **frontend**) sit at a table with a menu.
- The **waiter** is the **API** — you don't go into the kitchen; you give your
  order to the waiter.
- The **kitchen** (the **backend / database**) makes the food.
- The waiter brings back your dish (the **response**).

You don't need to know *how* the kitchen works — just what you can order (the
menu) and how to ask. In this app, the React frontend never touches the database
directly. It asks the **API** (`/api/consumers`, `/api/auth/login`, …) and the
backend does the work.

---

## 2. REST vs GraphQL

Our app uses **REST**.

### REST (what we use)
- Organized around **resources**, each with its own **URL** (`/api/consumers`).
- Acted on with **HTTP methods**: GET (read), POST (create), PUT/PATCH (update),
  DELETE (remove).
- Each endpoint returns a **fixed shape** of data decided by the server.

### GraphQL
- **One** URL (usually `/graphql`).
- The **client asks for exactly the fields it wants**, and gets back exactly
  that — no more, no less.

| | **REST** | **GraphQL** |
|---|----------|-------------|
| Endpoints | Many (one per resource) | One |
| Who decides the response shape | The server | The client (in the query) |
| Getting related data | Often several requests | Often one request |
| Risk | Over-fetching or under-fetching | More setup/complexity upfront |
| Feels like | Ordering set meals from a menu | Building your own custom plate |

**One-liner:** REST gives fixed dishes at fixed URLs; GraphQL lets you ask for a
custom plate from a single counter.

---

## 3. JSON — data as text

**JSON** (JavaScript Object Notation) is the **text format** used to send data
between frontend and backend.

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "accountStatus": "active",
  "isActive": true,
  "loginCount": 42,
  "tags": ["admin", "beta"]
}
```

### Why it's needed
A network (or a database, or a file) can only carry **bytes of text** — never a
"live" JS object with methods and memory references. JSON is the shared text
format both sides understand, regardless of language (Node, Python, Java, …).

> A JS object is a built piece of furniture. To ship it, you flatten it into a
> flat-pack box (JSON text). The other side rebuilds it from the box.

### JSON vs a JavaScript object

| | JavaScript object | JSON |
|---|---|---|
| What it is | A live thing in memory | A **string** of text |
| Keys | Can be unquoted (`name:`) | **Must** be double-quoted (`"name":`) |
| Values | Any JS value, incl. functions | Only text, numbers, booleans, null, arrays, objects |
| Usable directly? | Yes | No — must be parsed first |

### The two conversion functions

| Function | Direction | Use when |
|---|---|---|
| `JSON.stringify(object)` | object → JSON text | **sending** data |
| `JSON.parse(text)` / `response.json()` | JSON text → object | **reading** data |

```js
JSON.stringify({ firstName: "Ada" })   // '{"firstName":"Ada"}'  (a string)
JSON.parse('{"firstName":"Ada"}')      // { firstName: "Ada" }   (an object)
```

---

## 4. Headers & `Content-Type`

**Headers** are small pieces of extra information about a request or response,
sent separately from the body — the **label on a package**: what's inside, who's
sending it, how to handle it.

| Header | Purpose |
|---|---|
| `Content-Type` | What format the **body** is in |
| `Authorization` | Credentials (a token), on some APIs |
| `Accept` | What format the client wants back |
| `Cookie` / `Set-Cookie` | Cookies going up / coming down |

### `Content-Type: application/json`

Tells the receiver: **"the body I'm sending is JSON."**

```js
fetch("/api/consumers", {
  method: "POST",
  headers: { "Content-Type": "application/json" }, // "my body is JSON"
  body: JSON.stringify({ firstName: "Ada" }),       // ...here it is, as JSON text
});
```

The body is just text — it doesn't say how to interpret itself. Without this
header, the server may fail to parse it, and `req.body` can come out empty or
wrong.

**GET requests skip it** — GET has no body (its data rides in the URL as query
params), so there's nothing to label.

### Other Content-Types (for context)

| Content-Type | Used for | Example |
|---|---|---|
| `application/json` | JSON data (our app) | `{"firstName":"Ada"}` |
| `text/plain` | Plain text | `hello world` |
| `application/x-www-form-urlencoded` | Classic HTML form fields | `firstName=Ada&last=Lovelace` |
| `multipart/form-data` | File uploads (+ fields) | a photo + form fields |
| `text/html` | An HTML page | `<html>...</html>` |
| `application/octet-stream` | Raw binary / any file | a PDF, a zip |

---

## 5. Request & Response structure

### The REQUEST has four parts

```
POST   /api/consumers          ← Method + URL
Headers: Content-Type: application/json
Body:   { "firstName": "Ada", "lastName": "Lovelace" }
```

| Part | Meaning | Example |
|------|---------|---------|
| **Method** | The *action* (verb) | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| **URL** | *Where* / which resource | `/api/consumers` |
| **Headers** | Extra info about the request | `Content-Type: application/json` |
| **Body** | The data you send (only some methods) | `{ "firstName": "Ada" }` |

**The methods, with a notebook analogy:**

| Method | Does | Analogy | Body? |
|--------|------|---------|-------|
| GET | Read | "Show me the contacts" | No |
| POST | Create | "Add a new contact" | Yes |
| PUT | Replace whole item | "Rewrite the whole card" | Yes |
| PATCH | Update part of item | "Change just the phone number" | Yes |
| DELETE | Remove | "Tear out the page" | Usually no |

### The RESPONSE has three parts

| Part | Meaning | Example |
|------|---------|---------|
| **Status code** | How it went (a number) | `200`, `201`, `401`, `404`, `500` |
| **Headers** | Info about the response | `Content-Type: application/json` |
| **Body** | The data sent back | `{ "consumers": [ ... ] }` |

**Status codes:**

| Range | Meaning | Examples |
|-------|---------|----------|
| **2xx** | Success | `200` OK, `201` Created |
| **4xx** | *You* sent something wrong | `400` bad data, `401` not logged in, `404` not found |
| **5xx** | *Server* had a problem | `500` server error |

> 2xx = it worked. 4xx = the client's fault. 5xx = the server's fault.

---

## 6. Promises, async/await & fetch

### Why any of this exists
JavaScript runs on **one thread**. Talking to an API takes time; if JS just
froze waiting, the whole page would lock up — no clicks, no scrolling, no
typing. So JS handles slow things **asynchronously**: start the task, keep the
page responsive, deal with the result when it arrives.

### A Promise = "a result that isn't ready yet"
A **Promise** is a placeholder for a future value — a pager that buzzes when the
food is ready. It has three states:

| State | Meaning |
|---|---|
| **pending** | still working |
| **fulfilled (resolved)** | done — here's the value |
| **rejected** | failed — here's the error |

`fetch(url)` immediately returns a **pending Promise**; the real response
arrives later.

### `await` = "pause here until it settles"
`await` unwraps a Promise: it pauses **inside this function only** until the
Promise finishes, then gives you the value — the rest of the page keeps running.

### `async` = "this function may use await"
An `async` function can use `await`, and always returns a Promise itself (so its
callers can `await` it too).

```js
async function getConsumers() {
  const response = await fetch("/api/consumers"); // wait for the response...
  const data = await response.json();             // ...then wait to parse JSON
  return data.consumers;
}
```

### Old way vs new way

```js
// .then() chains
fetch("/api/consumers")
  .then((response) => response.json())
  .then((data) => console.log(data.consumers));

// async/await — same thing, reads top to bottom
const response = await fetch("/api/consumers");
const data = await response.json();
console.log(data.consumers);
```

### Why `response.json()` is a separate step
`fetch` resolves to a **`Response` object** — an envelope with status and
headers, but an **unread body**. Two reasons for the extra step:

1. **The body arrives as a stream**, possibly still downloading when the
   envelope (headers/status) is ready. `.json()` reads it to the end and parses
   it — that's why it also returns a Promise.
2. **The body could be many formats** — you choose how to read it:

| Method | Reads the body as | Use when |
|---|---|---|
| `response.json()` | JSON → JS object | the API returns JSON (our case) |
| `response.text()` | plain text/string | HTML, plain text |
| `response.blob()` | binary blob | images, files, downloads |
| `response.formData()` | form data | form submissions |

So the flow is always **two awaits**: one for the envelope, one for the
contents.

---

## 7. The standard shape of a call (try/catch/finally)

Almost every call in the app follows this skeleton:

```js
async function loadConsumers() {
  try {
    // 1. Send the request and WAIT for the response.
    const response = await fetch("/api/consumers");

    // 2. fetch does NOT throw on 404/500 — only on a real network failure.
    //    So we check the status ourselves.
    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }

    // 3. Parse the JSON body into a real object and use it.
    const data = await response.json();
    return data.consumers;

  } catch (error) {
    // 4. Runs if ANYTHING above failed (network error OR the throw in step 2).
    console.error("Could not load consumers:", error.message);

  } finally {
    // 5. Runs no matter what — success OR failure. Great for "stop the spinner".
    console.log("Done trying to load consumers.");
  }
}
```

| Keyword | Meaning |
|---|---|
| `try` | Attempt this code; if something goes wrong, jump to `catch`. |
| `catch (error)` | What to do if it failed — `error` holds the reason. |
| `finally` | Runs either way — great for turning off a spinner. |
| `if (!response.ok)` | The #1 beginner trap — a 404/500 is still a *completed* fetch. |

### A POST is the same skeleton + a body

```js
async function createConsumer(newConsumer) {
  try {
    const response = await fetch("/api/consumers", {
      method: "POST",                                   // the verb
      headers: { "Content-Type": "application/json" },  // "I'm sending JSON"
      body: JSON.stringify(newConsumer),                // object → JSON string
    });

    if (!response.ok) {
      throw new Error("Create failed with status " + response.status);
    }

    const data = await response.json();
    return data.consumer;                               // the created row
  } catch (error) {
    console.error("Could not create consumer:", error.message);
  }
}
```

**GET vs POST:** GET just needs a URL. POST adds three things: a `method`, a
`Content-Type` header, and a `body` — the data being sent, packaged as JSON.

---

## 8. Authenticated requests

**Authentication** = proving who you are. A request is **authenticated** when it
carries proof that a real, logged-in user is making it. Every call to a
protected endpoint (like `/api/consumers`) carries that proof, and the server
checks it before doing anything. Missing or invalid proof → **`401 Unauthorized`**.

### The proof: a cookie
A cookie called **`sb-access-token`**, set by the server at login as **httpOnly**
(JavaScript can't read it). The browser **automatically attaches it** to every
request to the same site — no code needed on the frontend.

**Frontend — nothing special:**
```js
const res = await fetch("/api/consumers"); // no auth code here!
```
Because this is a **same-origin** request, the browser sends the cookie
automatically. (For a cross-origin API, you'd need
`fetch(url, { credentials: "include" })` — not needed here.)

**Backend — the actual check** (`server/routes/consumers.js`):
```js
async function requireAuth(req, res, next) {
  const token = req.cookies["sb-access-token"];          // read the proof (cookie)
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const { data, error } = await supabaseAnon.auth.getUser(token); // verify it
  if (error || !data.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next(); // proof is valid → allow the real route to run
}

export const consumersRouter = Router();
consumersRouter.use(requireAuth); // ← EVERY route below requires a valid cookie
```

### The flow

```
Browser sends GET /api/consumers   (cookie sb-access-token attached automatically)
        │
        ▼
requireAuth middleware:  is there a cookie? is it valid (ask Supabase)?
        │                         │
     no / invalid              yes ✔
        │                         │
        ▼                         ▼
   401 Unauthorized        run the real route → return consumers
```

---

## 9. Live demo checklist

### Demo A — GET with query params (search / pagination / sorting)
1. Consumers page → Network tab shows `consumers?page=1&pageSize=10`.
2. **Headers** → Request Method: GET, Status: 200, full Request URL with `?...`.
3. **Payload** ("Query String Parameters") → `page`, `pageSize` broken out.
4. **Response** → `{ consumers: [...], total, page, pageSize }`.
5. Type in the search box → new request with `?search=...` (note the debounce delay).
6. Click page 2 → new request with `?page=2`.
7. Click a column header → new request with `?sort=name&dir=asc`.

### Demo B — POST with a body (login)
1. Log out, then log in → find the `login` request (POST).
2. **Payload** → request body `{ "email": "...", "password": "..." }`.
3. **Response** → `{ "user": { ... } }`.
4. **Application → Cookies** → `sb-access-token`, HttpOnly ✓.

### Demo C — the other methods
- **Add Consumer** → POST with a body.
- **Edit → Save changes** → PATCH, body has only the changed fields.
- **Edit → Replace all** → PUT, body has every field.
- **Delete** → DELETE, no body.

---

## 10. The "two URLs" idea

In a React app there are **two completely different URLs**:

| | **Browser address bar** (the "route") | **API request URL** (`fetch`) |
|---|---|---|
| Example | `localhost:5173/consumers?search=jane` | `localhost:8787/api/consumers?search=jane` |
| Who controls it | **React Router** | Your `fetch` call |
| Where you see it | The address bar | The **Network tab** |
| What it's for | Which *page/view* the user is on | Asking the *server* for data |

Changing one does **not** automatically change the other — they only match if we
deliberately keep them in sync.

### How they connect in this app

```
User types "jane"
   │
   ▼
1. Write ?search=jane into the BROWSER address bar   (useSearchParams)
   │
   ▼
2. Read that value back OUT of the address bar
   │
   ▼
3. Pass it to the fetch hook
   │
   ▼
4. Hook builds the API URL  /api/consumers?search=jane  and requests it
   │
   ▼
5. Server filters and returns just those rows
```

### Why put state in the URL?
- Copy `/consumers?search=jane&page=2` to a colleague → they see the exact view.
- Refresh the page → search and page are still there.
- The browser **Back button** undoes the last search/page change.

If state lived only in `useState`, all of that would be lost on refresh.

---

## 11. Tour of the real code

**Frontend (the caller):**
1. `client/src/features/consumers/get/useConsumers.ts` — builds the URL with
   `URLSearchParams`, does the `fetch` (GET). Same try/`res.ok`/`json()`
   skeleton as Section 7.
2. `client/src/features/consumers/post/useCreateConsumer.ts` — the POST version
   (method + headers + body).
3. `client/src/pages/ConsumersListPage.tsx` — search/page/sort **state** becomes
   the params passed to the hook.

**Backend (the responder):**
4. `server/routes/consumers.js` — matching routes. `req.query.search / page /
   pageSize / sort` are read; `ilike` does search, `.range()` does paging,
   `.order()` does sorting.
5. `server/routes/auth.js` — `POST /login`, verifying the password with
   Supabase and setting the httpOnly cookie.

The URL seen in the Network tab (`?search=jane&page=2`) is **built** in the
hook, and **read** in the route. Frontend owns the question; backend owns the
answer.

---

## 12. Q&A reference

**Where's the base URL / API address?**
There isn't one in the code — the frontend uses **relative** paths like
`/api/consumers`, and in development a **proxy** forwards `/api/*` to the
backend. Same origin, so no CORS and no base-URL setting needed.

**Where is the password stored? Can we see it?**
Not in our code, and not visible anywhere. Supabase stores only a one-way
**hash**. At login, the typed password is handed to Supabase and *it* checks
the match. Lost passwords are reset, never recovered.

**What's the difference between PUT and PATCH?**
PUT = **replace the whole record** (send every field). PATCH = **update part**
(send only changed fields). PUT clears anything omitted; PATCH leaves it alone.

**Who decides whether it's PUT or PATCH — frontend or backend?**
The **backend** decides which methods exist (it implements a handler for each).
The frontend must use one the backend supports. Many real APIs only offer PUT.

**Why check `response.ok`? Doesn't `fetch` throw on errors?**
No — `fetch` only rejects on a **network** failure. A 404 or 500 is a
*completed* request, so `response.ok` is checked and thrown manually.

**What does `await` actually do?**
It pauses **inside the async function** until the Promise settles, then
continues with the result — without freezing the rest of the page.

**Do GET requests need `Content-Type`?**
No — GET has no body, so there's nothing to label.

**How does the frontend send the auth proof without any auth code?**
Same-origin requests carry cookies automatically. The `sb-access-token` cookie
rides along on every request to the app's own origin with zero extra code.

---

## 13. Cheat sheet

- **API** = the waiter between frontend and backend.
- **REST** = fixed dishes at fixed URLs; **GraphQL** = custom plate from one counter.
- **JSON** = objects packaged as text for the network; `stringify` to send,
  `.json()`/`JSON.parse` to read.
- **Content-Type** = the label on the body's format; `application/json` for our
  bodies; GET needs none (no body).
- **Request** = method + URL + headers + (body). **Response** = status + headers + body.
- **2xx** worked · **4xx** your fault · **5xx** server's fault.
- **Promise** = a pager that buzzes when a slow task is done (pending → fulfilled/rejected).
- **fetch** returns a Promise; **await** waits for it; **async** lets you use await.
- **`response.json()`** = a second step to read + parse the still-unread body stream.
- **try** attempt · **catch** handle failure · **finally** run either way.
- Always check **`response.ok`** — fetch won't throw on 404/500.
- **GET** carries **query params** in the URL; **POST/PUT/PATCH** carry a **body**.
- **Authenticated** = the request proves who you are — our proof is the
  `sb-access-token` httpOnly cookie, sent automatically, checked by `requireAuth`.
- **Two URLs**: the address bar (the route) vs the request `fetch` sends. State
  lives in the address bar via `useSearchParams` so views are shareable and
  survive refresh.
