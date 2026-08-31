# API, Fetch & Async

Markdown version of the session artifact — same structure, same content, same
order. Use this if you need a plain-text/printable copy of what's on screen.

**Fetch API Demo · Team session**
How a browser asks a server for data, waits for the answer, and reads it back
— from first principles to the real code in this app.

```
Browser — fetch("/api/consumers")  ──────▶  Server — 200 OK, JSON body
```

---

## Today's agenda

Eight ideas, building on each other, ending with the pattern this app uses
everywhere.

| # | Topic | What it covers | Time |
|---|-------|-----------------|------|
| 01 | What is an API? | The restaurant analogy — frontend, waiter, kitchen. | 2 min |
| 02 | REST vs GraphQL | The two styles of web API, and why we use REST. | 2 min |
| 03 | JSON — data as text | Why data has to be packaged as text to travel at all. | 1 min |
| 04 | Request & Response structure | Method, URL, headers, body — and reading a status code. | 6 min |
| 05 | Promises, async/await & fetch | Why JavaScript doesn't freeze while waiting on the network. | 6 min |
| 06 | The standard shape of a call | try / catch / finally, and the `response.ok` trap. | 4 min |
| 07 | Query parameters | How search and pagination both ride in the URL. | 6 min |
| 08 | Cheat sheet | Every idea, one line each. | 1 min |

---

## 01 — What is an API?

**API = Application Programming Interface.** A way for two programs to talk
to each other using an agreed set of rules.

**The restaurant analogy:** you (the **frontend**) sit at a table with a
menu. The **waiter** is the **API** — you don't go into the kitchen; you give
your order to the waiter. The **kitchen** (the **backend / database**) makes
the food. The waiter brings back your dish (the **response**).

You don't need to know *how* the kitchen works — just what you can order (the
menu) and how to ask. In this app, the React frontend never touches the
database directly. It asks the **API** (`/api/consumers`, `/api/auth/login`)
and the backend does the work.

---

## 02 — REST vs GraphQL

There are several styles of web API. Our app uses **REST**.

### REST (what we use)
- Organized around **resources**, each with its own **URL** (`/api/consumers`).
- Acted on with **HTTP methods**: GET (read), POST (create), PUT/PATCH
  (update), DELETE (remove).
- Each endpoint returns a **fixed shape** of data decided by the server.

### GraphQL
- **One** URL (usually `/graphql`).
- The **client asks for exactly the fields it wants**, and gets back exactly
  that.

| | REST | GraphQL |
|---|------|---------|
| Endpoints | Many (one per resource) | One |
| Response shape decided by | The server | The client (in the query) |
| Related data | Often several requests | Often one request |
| Risk | Over/under-fetching | More setup upfront |
| Feels like | Set meals from a menu | Building a custom plate |

> REST gives fixed dishes at fixed URLs; GraphQL lets you ask for a custom
> plate from a single counter.

---

## 03 — JSON — data as text

**JSON** (JavaScript Object Notation) is the text format used to send data
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

A network can only carry **bytes of text** — never a "live" JS object with
methods and memory references. JSON is the shared text format both sides
understand, regardless of language.

> A JS object is a built piece of furniture. To ship it, you flatten it into
> a flat-pack box (JSON text). The other side rebuilds it from the box.

| | JavaScript object | JSON |
|---|---|---|
| What it is | A live thing in memory | A string of text |
| Keys | Can be unquoted | Must be double-quoted |
| Values | Any JS value, incl. functions | Text, number, boolean, null, array, object |
| Usable directly? | Yes | No — must be parsed first |

```js
// object → JSON text, for sending
JSON.stringify({ firstName: "Ada" })   // '{"firstName":"Ada"}'

// JSON text → object, for reading
JSON.parse('{"firstName":"Ada"}')      // { firstName: "Ada" }
```

---

## 04 — Request & Response structure

Every API call is a **request** going out and a **response** coming back.
Get this pair solid and every line of fetch code reads itself.

```
Browser ──request──▶ Server      (method + URL + headers + body)
Browser ◀──response── Server     (status + headers + body)
```

### Anatomy of a request

Take one real call from this app — creating a consumer — and break it into
its four parts:

| Part | Value | Meaning |
|---|---|---|
| **Method** | `POST` | The action: create a new record |
| **URL** | `/api/consumers` | Which resource is being acted on |
| **Headers** | `Content-Type: application/json` | Describes the body that follows |
| **Body** | `{ "firstName": "Ada", "lastName": "Lovelace" }` | The data being sent — only on some methods |

### The methods, in depth

| Method | Does | Analogy | Body? | Used in this app for |
|--------|------|---------|-------|-----------------------|
| `GET` | Read | "Show me the contacts" | No | Listing / searching consumers |
| `POST` | Create | "Add a new contact" | Yes | Adding a consumer, logging in |
| `PUT` | Replace whole item | "Rewrite the whole card" | Yes | "Replace all" edit — every field |
| `PATCH` | Update part of item | "Change just the phone number" | Yes | "Save changes" edit — changed fields only |
| `DELETE` | Remove | "Tear out the page" | Usually no | Removing a consumer |

GET has no body because its only job is to *ask* — anything it needs to say
rides in the URL instead (see Section 07). POST, PUT and PATCH all carry a
body because they're *sending* data for the server to store.

### Anatomy of a response

The server's answer to that same POST, once the consumer is created:

| Part | Value | Meaning |
|---|---|---|
| **Status** | `201 Created` | A 2xx — the record now exists |
| **Headers** | `Content-Type: application/json` | Describes the body coming back |
| **Body** | `{ "consumer": { "id": 41, "firstName": "Ada", ... } }` | The data sent back — the created row |

### Status codes — reading the first digit

| Range | Meaning | Examples |
|-------|---------|----------|
| **2xx** | Success | 200 OK · 201 Created |
| **4xx** | *You* sent something wrong | 400 bad data · 401 not logged in · 404 not found |
| **5xx** | *Server* had a problem | 500 server error |

> 2xx = it worked. 4xx = the client's fault. 5xx = the server's fault. Check
> the first digit before you read anything else.

### GET vs POST, side by side

| | GET /api/consumers | POST /api/consumers |
|---|---|---|
| Purpose | Fetch existing rows | Create a new row |
| Data travels via | Query string in the URL | JSON body |
| Needs `Content-Type`? | No — no body | Yes — `application/json` |
| Success status | 200 | 201 |

---

## 05 — Promises, async/await & fetch

JavaScript runs on **one thread**. Talking to an API takes time; if JS froze
waiting, the page would lock up — no clicks, no scrolling. So JS handles slow
things **asynchronously**: start the task, keep the page responsive, deal
with the result when it arrives.

### A Promise = "a result that isn't ready yet"

A placeholder for a future value — a pager that buzzes when the food is
ready.

| State | Meaning |
|---|---|
| **pending** | Still working |
| **fulfilled** | Done — here's the value |
| **rejected** | Failed — here's the error |

`fetch(url)` immediately returns a **pending Promise**; the real response
arrives later.

```js
// "wait until the response arrives, then put it in `response`"
async function getConsumers() {
  const response = await fetch("/api/consumers");
  const data = await response.json();
  return data.consumers;
}
```

### Why `response.json()` is a separate step

`fetch` resolves to a **Response object** — an envelope with status and
headers, but an unread body.

| Method | Reads body as | Use when |
|---|---|---|
| `response.json()` | JSON → JS object | the API returns JSON (our case) |
| `response.text()` | plain text/string | HTML, plain text |
| `response.blob()` | binary blob | images, files, downloads |
| `response.formData()` | form data | form submissions |

The flow is always **two awaits**: one for the envelope, one for the
contents.

---

## 06 — The standard shape of a call

Almost every call in the app follows this skeleton:

```js
async function loadConsumers() {
  try {
    // 1. Send the request and WAIT for the response.
    const response = await fetch("/api/consumers");

    // 2. fetch does NOT throw on 404/500 — check it ourselves.
    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }

    // 3. Parse the JSON body into a real object and use it.
    const data = await response.json();
    return data.consumers;

  } catch (error) {
    // 4. Runs if ANYTHING above failed.
    console.error("Could not load consumers:", error.message);

  } finally {
    // 5. Runs no matter what — great for "stop the spinner".
    console.log("Done trying to load consumers.");
  }
}
```

| Keyword | Meaning |
|---|---|
| `try` | Attempt this code; if something goes wrong, jump to `catch`. |
| `catch (error)` | `error` holds the reason it failed. |
| `finally` | Runs either way — great for turning off a spinner. |
| `!response.ok` | The #1 beginner trap — a 404/500 is still a *completed* fetch. |

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
    return data.consumer;
  } catch (error) {
    console.error("Could not create consumer:", error.message);
  }
}
```

> GET just needs a URL. POST adds three things: a `method`, a `Content-Type`
> header, and a `body`.

---

## 07 — Query parameters

GET requests have no body — so how does a GET ask for "page 2" or "rows
matching jane"? It rides in the URL, as a **query string**.

| Part | Meaning |
|---|---|
| `/api/consumers` | The base URL — the resource |
| `?` | Marks the start of the query string — everything after this is params, not the path |
| `search=jane` | A key=value pair — filter rows where the name matches "jane" |
| `&page=2` | `&` joins another pair — which page of results to return |
| `&pageSize=10` | Another pair — how many rows per page |

Put together: `/api/consumers?search=jane&page=2&pageSize=10` — one URL,
three questions asked at once.

### Example 1 — the search box

Typing "jane" into the search field doesn't call an endpoint named
`/search`. It changes the query string on the *same* endpoint:

1. User types `jane` in the search box.
2. After a short debounce, the value is written to the URL as `?search=jane`.
3. The hook rebuilds the request: `GET /api/consumers?search=jane`.
4. The server filters rows and returns only the matches.

```js
// building the query string on the frontend
const params = new URLSearchParams({ search: "jane", page: "1", pageSize: "10" });
const response = await fetch(`/api/consumers?${params}`);
```

```js
// reading it on the backend
const { search } = req.query;
let query = supabase.from("demo_consumers").select("*", { count: "exact" });
if (search) {
  query = query.ilike("first_name", `%${search}%`); // case-insensitive match
}
```

### Example 2 — pagination

Clicking "Page 2" works the same way — it's still a GET, still the same
endpoint, just a different query string:

1. User clicks page 2.
2. URL becomes `?page=2&pageSize=10`.
3. Server converts that into a row range: rows 10–19.
4. Response includes `total` so the client can compute how many pages exist.

```js
// reading page + pageSize on the backend
const page = Number(req.query.page) || 1;
const pageSize = Number(req.query.pageSize) || 10;
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

query = query.range(from, to); // e.g. page 2, size 10 → rows 10-19
```

| Response field | Meaning |
|---|---|
| `consumers` | The 10 rows for this page |
| `total` | How many rows match overall — used to render page numbers |
| `page` / `pageSize` | Echoed back so the UI knows what it asked for |

> I never changed the code — I changed the **question** in the URL, and the
> server returned a different **answer**. Search, paging, and sorting are all
> just query params.

---

## 08 — Cheat sheet

- **API** = the waiter between frontend and backend.
- **REST** = fixed dishes at fixed URLs; **GraphQL** = custom plate, one counter.
- **JSON** = objects as text; `stringify` to send, `.json()` to read.
- **Request** = method + URL + headers + body. **Response** = status + headers + body.
- **2xx** worked · **4xx** your fault · **5xx** server's fault.
- **Promise** = a pager for a value that isn't ready yet.
- **fetch** → Promise. **await** waits. **async** allows await.
- `response.json()` = a second step to read the unread body stream.
- **try** attempt · **catch** handle failure · **finally** runs either way.
- Always check `response.ok` — fetch won't throw on 404/500.
- **GET** → query params in URL. **POST/PUT/PATCH** → body.
- **Query params**: `?key=value&key2=value2` — how search, paging, and
  sorting all travel on a GET.
- Change the **question** in the URL, get a different **answer** back — same
  endpoint, same code.
