# API, Fetch & Async — A Session Walkthrough

A read-aloud guide for presenting this project. It starts from "what is an API?"
and builds up, one small idea at a time, to reading the real code and watching
requests live in the browser. Every code example here is **plain JavaScript**
(no React), so the concepts stay clean — we meet the React code later.

**Suggested flow for the session**
1. What is an API + types (REST vs GraphQL) — *2 min*
2. JSON in one minute — *1 min*
3. Request & response structure — *5 min*
4. Promises, async/await, fetch — *5 min*
5. The standard shape of a call (try / catch / finally) — *4 min*
6. **Live demo in the Network tab** — *5 min*
7. The "two URLs" idea (address bar vs request) — *3 min*
8. Open the real code files — *8 min*
9. Q&A — *as needed*

---

## 1. What is an API?

**API = Application Programming Interface.** It's a way for two programs to talk
to each other using an agreed set of rules.

**The restaurant analogy (use this in the session):**
- You (the **frontend**) sit at a table with a menu.
- The **waiter** is the **API** — you don't go into the kitchen; you give your
  order to the waiter.
- The **kitchen** (the **backend / database**) makes the food.
- The waiter brings back your dish (the **response**).

You don't need to know *how* the kitchen works — you just need to know what you
can order (the menu) and how to ask. That "menu + rules" is the API.

In our app: the React frontend never touches the database directly. It asks the
**API** (`/api/consumers`, `/api/auth/login`, …) and the backend does the work.

---

## 2. Types of APIs — REST vs GraphQL (the short version)

There are several styles of web API. The two most talked-about are **REST** and
**GraphQL**. Our app uses **REST**.

### REST (what we use)
- Organized around **resources**, each with its own **URL** (`/api/consumers`).
- You act on them with **HTTP methods**: GET (read), POST (create), PUT/PATCH
  (update), DELETE (remove).
- Each endpoint returns a **fixed shape** of data decided by the server.

### GraphQL
- **One** URL (usually `/graphql`).
- The **client asks for exactly the fields it wants** in a query, and gets back
  exactly that — no more, no less.

### Side-by-side

| | **REST** | **GraphQL** |
|---|----------|-------------|
| Endpoints | Many (one per resource) | One |
| Who decides the response shape | The server | The client (in the query) |
| Getting related data | Often several requests | Often one request |
| Risk | Over-fetching (extra fields) or under-fetching (need more calls) | More setup/complexity upfront |
| Feels like | Ordering set meals from a menu | Building your own custom plate |

**One-liner:** "REST gives you fixed dishes at fixed URLs; GraphQL lets you ask
for a custom plate from a single counter. We use REST — simple, standard, and
perfect for this app."

---

## 3. JSON in one minute

**JSON** (JavaScript Object Notation) is the **text format** used to send data
between frontend and backend. It looks like a JavaScript object, but it's really
just a **string** while traveling over the network.

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "accountStatus": "active"
}
```

Two functions you'll see everywhere:
- `JSON.stringify(object)` → turns a JS object **into** a JSON string (to **send**).
- `response.json()` → turns a JSON string **back into** a JS object (to **read**).

Why? Because the network can only carry **text**, not live JS objects. JSON is
how we package an object as text and unpack it on the other side.

---

## 4. Request & Response structure

Every API call is a **request** going out and a **response** coming back. Get
this section solid and the code reads itself.

### 4a. The REQUEST has four parts

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

**The methods (verbs), with a notebook analogy:**

| Method | Does | Analogy | Body? |
|--------|------|---------|-------|
| GET | Read | "Show me the contacts" | No |
| POST | Create | "Add a new contact" | Yes |
| PUT | Replace whole item | "Rewrite the whole card" | Yes |
| PATCH | Update part of item | "Change just the phone number" | Yes |
| DELETE | Remove | "Tear out the page" | Usually no |

### 4b. The RESPONSE has three parts

| Part | Meaning | Example |
|------|---------|---------|
| **Status code** | How it went (a number) | `200`, `201`, `401`, `404`, `500` |
| **Headers** | Info about the response | `Content-Type: application/json` |
| **Body** | The data sent back | `{ "consumers": [ ... ] }` |

**Status codes — the rule of thumb:**

| Range | Meaning | Examples |
|-------|---------|----------|
| **2xx** | Success | `200` OK, `201` Created |
| **4xx** | *You* sent something wrong | `400` bad data, `401` not logged in, `404` not found |
| **5xx** | *Server* had a problem | `500` server error |

> Say this: "2xx = it worked. 4xx = the client's fault. 5xx = the server's fault."

---

## 5. Promises, async/await, and fetch

This is the heart of it. Take it slow — three small ideas.

### 5a. Why do we need any of this?
Talking to an API takes **time** (the request travels, the server works, the
response comes back). JavaScript can't just **freeze** the whole page waiting for
it — the buttons would stop working. So JavaScript handles slow things
**asynchronously**: it starts the task, keeps the page responsive, and deals with
the result **when it arrives**.

### 5b. A Promise = "I'll get back to you"
A **Promise** is a placeholder for a value that **isn't ready yet**. Like a
pager at a restaurant: you don't have your food, but you have something that will
**buzz when it's ready**.

A Promise ends in one of two ways:
- **resolved** (fulfilled) → it worked, here's the value.
- **rejected** → it failed, here's the error.

### 5c. `fetch` returns a Promise
`fetch(url)` is the browser's built-in function to make an HTTP request. It
**doesn't** return the data directly — it returns a **Promise** that will resolve
to the response later.

### 5d. `async` / `await` = the easy way to use Promises
Instead of chaining `.then()`, we write code that **looks normal, top to bottom**:

- `await` means: **"pause here until this Promise finishes, then continue."**
- You can only use `await` inside a function marked `async`.

```js
async function getConsumers() {
  const response = await fetch("/api/consumers"); // wait for the response...
  const data = await response.json();             // ...then wait to parse JSON
  console.log(data.consumers);                    // now we have the data
}
```

**Read that aloud as:** "Go fetch the consumers — *wait* — now turn the response
into an object — *wait* — now use it." `await` just lets us write asynchronous
code as if it were step-by-step.

> **The mental model:** `fetch` starts a slow task and hands you a Promise;
> `await` waits for that Promise to finish without freezing the page; `async` is
> the keyword that lets you use `await`.

---

## 6. The standard shape of an API call (try / catch / finally)

Almost every call in the app follows the **same skeleton**. Learn it once, and
every file looks familiar. Here it is in plain JavaScript:

```js
async function loadConsumers() {
  try {
    // 1. Send the request and WAIT for the response.
    const response = await fetch("/api/consumers");

    // 2. Check the status. IMPORTANT: fetch does NOT throw on 404 or 500 —
    //    it only rejects on a real network failure. So we check ourselves.
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

### What each keyword means (say these plainly)

- **`try`** — "attempt this code; if something goes wrong, jump to `catch`."
- **`catch (error)`** — "here's what to do if it failed." The `error` holds the
  reason.
- **`finally`** — "run this **either way**, success or failure." Perfect for
  turning off a loading spinner or re-enabling a button.
- **`if (!response.ok)`** — the #1 beginner trap. A `404`/`500` is still a
  *completed* fetch, so we must check `response.ok` (true for any `2xx`) and
  throw ourselves if it's not.

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

**GET vs POST in one breath:** "GET just needs a URL. POST adds three things: a
`method`, a `Content-Type` header, and a `body` — the data we're sending, packaged
as a JSON string."

---

## 7. Live demo — the Network tab (do this before the code!)

Seeing a real request makes the code obvious. Open the app, then open **DevTools
→ Network tab**, and click **Fetch/XHR** to filter.

> Tip: keep the Network tab open for this whole section. Point at things as you
> talk — the audience *sees* the concepts from Sections 4–6 happening for real.

### Demo A — GET with query params (search / pagination / sorting)
1. Go to the **Consumers** page. In Network you'll see a request like
   **`consumers?page=1&pageSize=10`**.
2. Click it and walk through the tabs:
   - **Headers** → **Request Method: GET**, **Status Code: 200**, the full
     **Request URL** with the `?...` query string.
   - **Payload** (or "Query String Parameters") → shows `page`, `pageSize`
     broken out as a list. *This is where query params live for a GET.*
   - **Response** → the JSON body: `{ consumers: [...], total, page, pageSize }`.
3. **Type in the search box** → watch a **new request** fire with
   `?search=...` added. (Point out the small delay — that's the debounce.)
4. **Click page 2** → new request with `?page=2`.
5. **Click a column header to sort** → new request with `?sort=name&dir=asc`.

> Key line: "I never changed the code — I changed the **question** in the URL,
> and the server returned a different **answer**. Search, paging, and sorting are
> all just query params."

### Demo B — POST with a body (login)
1. Log out, then log in. Find the **`login`** request (Method: **POST**).
2. **Payload** tab → the **request body**: `{ "email": "...", "password": "..." }`.
   *This is the difference from GET — POST carries a body, not query params.*
3. **Response** → `{ "user": { ... } }`.
4. Open **Application → Cookies** → show **`sb-access-token`** with **HttpOnly ✓**.
   Say: "The token is stored here by the server. Notice HttpOnly — JavaScript
   can't read it, which is what keeps it safe."

### Demo C — the other methods (optional, quick)
- **Add Consumer** → a **POST** with a body.
- **Edit → Save changes** → a **PATCH** whose body has **only the changed fields**.
- **Edit → Replace all** → a **PUT** whose body has **every field**.
- **Delete** → a **DELETE** request, no body.

---

## 8. The "two URLs" idea (why the address bar and the request differ)

This one trips up almost every beginner, so it's worth its own moment. In a React
app there are **two completely different URLs**, and they are not the same thing.

| | **Browser address bar** (the "route") | **API request URL** (`fetch`) |
|---|---|---|
| Example | `localhost:5173/consumers?search=jane` | `localhost:8787/api/consumers?search=jane` |
| Who controls it | **React Router** | Your `fetch` call |
| Where you see it | The address bar at the top | The **Network tab** |
| What it's for | Which *page/view* the user is on | Asking the *server* for data |

**The key point:** changing one does **not** automatically change the other. They
only match if we deliberately keep them in sync.

### How they connect in this app
We use React Router's **`useSearchParams`** to make the **browser URL the single
source of truth**. The flow is a small loop:

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

So the address bar and the request end up with the same `?search=jane` — but only
because step 1 explicitly puts it there.

### Why bother putting state in the URL?
Because the URL then becomes **shareable, bookmarkable, and refresh-proof**:
- Copy `/consumers?search=jane&page=2` to a colleague → they see the exact view.
- Refresh the page → your search and page are still there.
- The browser **Back button** undoes your last search/page change.

If we'd kept the state only in memory (`useState`), all of that would be lost on
refresh, and the address bar would just say `/consumers` no matter what.

> **Say this in the session:** "There are two URLs — the one in the address bar
> (the route) and the one `fetch` sends to the server. They're separate. We use
> `useSearchParams` to store our search/page/sort in the address bar, read it back
> out, and hand it to `fetch`. That's why you can refresh or share the link and
> get the same view."

**Live demo:** type in the search box and watch the **address bar** change (not
just the Network tab). Then hit refresh — the view stays. That's the proof the
state lives in the route now.

---

## 9. Now open the real code

Show the files in this order so it mirrors the request's journey.

**Frontend (the caller):**
1. `client/src/features/consumers/get/useConsumers.ts` — builds the URL with
   `URLSearchParams` and does the `fetch` (GET). Point out the same
   try/`res.ok`/`json()` skeleton from Section 6.
2. `client/src/features/consumers/post/useCreateConsumer.ts` — the POST version
   (method + headers + body).
3. `client/src/pages/ConsumersListPage.tsx` — where search/page/sort **state**
   becomes the params passed to the hook.

**Backend (the responder):**
4. `server/routes/consumers.js` — the matching routes. Show how
   `req.query.search / page / pageSize / sort` are read, how `ilike` does search,
   `.range()` does paging, and `.order()` does sorting.
5. `server/routes/auth.js` — `POST /login` verifying the password with Supabase
   and setting the httpOnly cookie.

**The connection to make out loud:** "The URL we watched in the Network tab
(`?search=jane&page=2`) is built **here** in the hook, and read **there** in the
route. Frontend owns the question; backend owns the answer."

---

## 10. Questions you might get asked (with answers)

**Q: Where's the base URL / API address?**
There isn't one in the code — the frontend uses **relative** paths like
`/api/consumers`, and in development a **proxy** forwards `/api/*` to the backend.
Same origin, so no CORS and no base-URL setting needed.

**Q: Where is the password stored? Can we see it?**
Not in our code, and you can't see it anywhere. Supabase stores only a one-way
**hash** of it. At login we hand the typed password to Supabase and *it* checks
the match. If lost, you reset it — you never recover it.

**Q: What's the difference between PUT and PATCH?**
PUT = **replace the whole record** (send every field). PATCH = **update part**
(send only changed fields). PUT clears anything you omit; PATCH leaves it alone.

**Q: Who decides whether it's PUT or PATCH — frontend or backend?**
The **backend** decides which methods exist (it implements a handler for each).
The frontend must use one the backend supports. Many real APIs only offer PUT.

**Q: Why check `response.ok`? Doesn't `fetch` throw on errors?**
No — `fetch` only rejects on a **network** failure. A `404` or `500` is a
*completed* request, so we check `response.ok` and throw ourselves.

**Q: What does `await` actually do?**
It **pauses inside the async function** until the Promise settles, then continues
with the result — without freezing the rest of the page.

---

## 11. Cheat sheet (one-liners to memorize)

- **API** = the waiter between frontend and backend.
- **REST** = fixed dishes at fixed URLs; **GraphQL** = custom plate from one counter.
- **JSON** = objects packaged as text for the network; `stringify` to send,
  `.json()` to read.
- **Request** = method + URL + headers + (body). **Response** = status + headers + body.
- **2xx** worked · **4xx** your fault · **5xx** server's fault.
- **Promise** = a pager that buzzes when a slow task is done.
- **fetch** returns a Promise; **await** waits for it; **async** lets you use await.
- **try** attempt · **catch** handle failure · **finally** run either way.
- Always check **`response.ok`** — fetch won't throw on 404/500.
- **GET** carries **query params** in the URL; **POST/PUT/PATCH** carry a **body**.
- Query params = the **question**; the server's JSON = the **answer**.
- **Two URLs**: the address bar (the route) vs the request `fetch` sends. We keep
  our state in the address bar with `useSearchParams` so views are shareable and
  survive refresh.
