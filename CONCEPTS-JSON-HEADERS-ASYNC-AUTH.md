# Deeper Dive: JSON, Headers, Async/Await & "Authenticated Requests"

A companion to `SESSION-GUIDE.md`. This goes one level deeper on four things that
often feel fuzzy the first time. Read-aloud friendly, plain language.

Contents:
1. JSON — in a bit more detail
2. Headers & `Content-Type: application/json` — what and why (and other types)
3. Async / await — a clearer mental model (+ why `response.json()`?)
4. "The requests are all authenticated" — what it means & where it lives in code

---

## 1. JSON — in a bit more detail

### What it actually is
**JSON = JavaScript Object Notation.** It's a **text format** for representing
data — objects, arrays, strings, numbers, booleans. It looks like a JavaScript
object, but the critical thing to understand is: **while data travels over the
network, it is just a plain string of text.**

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

### Why do we even need it?
The network (and a database, and a file) can only store/transmit **bytes of
text**. It cannot send a "live" JavaScript object with its methods and memory
references. So we need an agreed **text format** that both sides understand. JSON
is that shared language — the frontend (JavaScript) and the backend (could be
Node, Python, Java, anything) all know how to read and write it.

> Analogy: a JS object is a built piece of furniture. To ship it, you flatten it
> into a flat-pack box (JSON text). The other side rebuilds it from the box.

### JSON vs a JavaScript object (the difference beginners miss)

| | JavaScript object | JSON |
|---|---|---|
| What it is | A live thing in memory | A **string** of text |
| Keys | Can be unquoted (`name:`) | **Must** be in double quotes (`"name":`) |
| Values | Any JS value, incl. functions | Only text, numbers, booleans, null, arrays, objects |
| Usable directly? | Yes | No — must be parsed first |

### The two functions that convert between them
- **`JSON.stringify(object)`** → object **→** JSON text. Use when **sending**.
  ```js
  JSON.stringify({ firstName: "Ada" })   // '{"firstName":"Ada"}'  (a string)
  ```
- **`JSON.parse(text)`** → JSON text **→** object. (In fetch, `response.json()`
  does this parse step for you — see Section 3.)
  ```js
  JSON.parse('{"firstName":"Ada"}')      // { firstName: "Ada" }   (an object)
  ```

> **One-liner:** "JSON is data written as text so any two programs can exchange it.
> `stringify` packs an object into text to send; parsing unpacks it back into an
> object to use."

---

## 2. Headers & `Content-Type: application/json`

### What are headers?
**Headers** are small pieces of **extra information about the request or
response** — sent alongside it, separate from the body. They're not the data
itself; they *describe* the data or the caller. Think of them as the **label on a
package**: what's inside, who's sending it, how to handle it.

Both requests and responses have headers. Examples you'll meet:
- `Content-Type` — what format the **body** is in.
- `Authorization` — credentials (a token), on some APIs.
- `Accept` — what format the client *wants back*.
- `Cookie` / `Set-Cookie` — cookies going up / coming down.

### What `Content-Type: application/json` means
It tells the receiver: **"the body I'm sending is JSON."**

```js
fetch("/api/consumers", {
  method: "POST",
  headers: { "Content-Type": "application/json" }, // "my body is JSON"
  body: JSON.stringify({ firstName: "Ada" }),      // ...and here it is, as JSON text
});
```

### Why do we write it?
Because the body is **just text** (Section 1). Text alone doesn't say *how to
interpret it*. The server needs to be told "this text is JSON" so it knows to
**parse it as JSON** and give your route a real object (`req.body`).

If you send a JSON body but **forget** this header, the server may not parse it —
`req.body` could come out empty or wrong, and validation fails. So the rule:
**sending a JSON body → set `Content-Type: application/json`.**

> Analogy: `Content-Type` is the label on the box that says "FRAGILE — GLASS."
> Without the label, the receiver doesn't know how to handle what's inside.

### Do GET requests need it?
Usually **no**. GET has **no body** (its data rides in the URL as query params),
so there's nothing to describe — that's why our GET calls don't set it.

### Are there other Content-Types? (yes — good to mention)

| Content-Type | Used for | Example |
|---|---|---|
| `application/json` | JSON data (our app) | `{"firstName":"Ada"}` |
| `text/plain` | Plain text | `hello world` |
| `application/x-www-form-urlencoded` | Classic HTML form fields | `firstName=Ada&last=Lovelace` |
| `multipart/form-data` | **File uploads** (+ fields) | a photo + form fields |
| `text/html` | An HTML page | `<html>...</html>` |
| `application/octet-stream` | Raw binary / any file | a PDF, a zip |

For a JSON API like ours, `application/json` is the one we use almost everywhere.
The others matter when you upload files (`multipart/form-data`) or integrate with
older form-based systems (`x-www-form-urlencoded`).

> **One-liner:** "`Content-Type` labels the body's format. We send JSON, so we say
> `application/json`, so the server knows to parse it as JSON. GET has no body, so
> it needs no label."

---

## 3. Async / await — a clearer mental model

### The core problem
JavaScript runs on **one thread** — it can only do one thing at a time. Talking to
an API is **slow** (tens or hundreds of milliseconds). If JavaScript just **froze**
and waited, the whole page would lock up: no clicks, no scrolling, no typing.

So JavaScript does slow things **asynchronously**: it *starts* the task, immediately
moves on so the page stays responsive, and comes back to handle the result **when
it's ready**. `async`/`await` is the clean syntax for writing that.

### Step 1: a Promise = "a result that isn't here yet"
A **Promise** is an object that represents a value that will exist **later**. It's
in one of three states:
- **pending** — still working (the food is cooking).
- **fulfilled (resolved)** — done, here's the value (food's ready).
- **rejected** — failed, here's the error (kitchen ran out).

`fetch(url)` immediately returns a **pending Promise**. The actual response arrives
later.

### Step 2: `await` = "pause here until the Promise settles"
`await` unwraps a Promise: it waits until the Promise is fulfilled, then gives you
the **value inside**. Crucially, it pauses **only inside this function** — the rest
of the page keeps running.

```js
const response = await fetch("/api/consumers");
// ↑ "wait until the response arrives, then put it in `response`"
```

Without `await`, `response` would be the Promise object itself (not the data) —
a very common beginner bug.

### Step 3: `async` = "this function is allowed to use await"
You can only use `await` inside a function marked `async`. Also, an `async`
function **always returns a Promise** itself (so its callers can `await` it too).

```js
async function getConsumers() {          // async → may use await, returns a Promise
  const response = await fetch("/api/consumers"); // wait for the response
  const data = await response.json();            // wait to parse the body
  return data.consumers;                          // callers can await this
}
```

### The old way vs the new way (why await feels nicer)
Both do the same thing; `await` just reads top-to-bottom like normal code.

```js
// Old: .then() chains
fetch("/api/consumers")
  .then((response) => response.json())
  .then((data) => console.log(data.consumers));

// New: async/await
const response = await fetch("/api/consumers");
const data = await response.json();
console.log(data.consumers);
```

### Why `response.json()` and not the response directly?
This is the question that unlocks it. **`fetch` gives you back a `Response`
object, not the data.** That `Response` is like an **envelope**: it has the
status code, the headers, and a still-**unread body**.

Two reasons for the extra `.json()` step:

1. **The body arrives separately from the headers (as a stream).** When `fetch`
   resolves, the headers/status are ready, but the **body may still be
   downloading**. `.json()` **reads the body to the end**, then **parses** that
   text into a JS object. Because reading can take time, `.json()` itself returns
   a **Promise** — hence `await response.json()`.

2. **The body could be many formats**, so you choose how to read it:

   | Method | Reads the body as | Use when |
   |---|---|---|
   | `response.json()` | JSON → JS object | the API returns JSON (our case) |
   | `response.text()` | plain text/string | HTML, plain text |
   | `response.blob()` | binary blob | images, files, downloads |
   | `response.formData()` | form data | form submissions |

So the flow is always **two awaits**: one for the **envelope** (the response
arrives), one for the **contents** (read + parse the body).

```js
const response = await fetch("/api/consumers"); // 1. envelope (status, headers)
const data = await response.json();             // 2. read + parse the body
```

> **Say this:** "`fetch` gives you an envelope — status and headers — but the
> letter inside isn't read yet. `response.json()` reads the body and turns that
> JSON text into an object. It's a second step because reading the body takes time
> and because you get to choose the format (json, text, blob)."

---

## 4. "The requests are all authenticated" — what it means

### What "authenticated" means
**Authentication** = proving **who you are**. A request is **authenticated** when
it carries proof that a real, logged-in user is making it. An **unauthenticated**
request has no such proof and should be **rejected** for protected data.

"The requests are all authenticated" simply means: **every call to our protected
endpoints (like `/api/consumers`) carries the logged-in user's proof, and the
server checks it before doing anything.** If the proof is missing or invalid, the
server answers **`401 Unauthorized`** instead of returning data.

### What is the "proof" in our app?
A **cookie** called **`sb-access-token`**. When you log in, the server puts this
token in an **httpOnly cookie** (JavaScript can't read it — safer). After that,
the browser **automatically attaches that cookie to every request to the same
site.** So each request quietly carries the proof.

### Do we have to show it in the code? — YES, in two places

**Place 1 — the frontend: (almost) invisible, and that's the point.**
The frontend does **nothing special**. Look at the fetch — no token, no
`Authorization` header:
```js
const res = await fetch("/api/consumers"); // no auth code here!
```
Why does it still work? Because it's a **same-origin** request, so the **browser
automatically sends the `sb-access-token` cookie** with it. The proof rides along
by itself. (If the API were on a *different* domain, you'd need
`fetch(url, { credentials: "include" })` to opt in — but here we don't.)

**Place 2 — the backend: the actual check (this is the visible auth code).**
Every consumer route is guarded by a middleware called `requireAuth`
(`server/routes/consumers.js`):
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

`consumersRouter.use(requireAuth)` is the key line: it runs `requireAuth`
**before every consumer route**. That's literally what "all the requests are
authenticated" means in code — nothing reaches the GET/POST/PUT/PATCH/DELETE
handlers unless the token checks out.

### The flow in one picture
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

### How to demo it live
- Open DevTools → **Application → Cookies** → show `sb-access-token` (HttpOnly ✓).
- Open **Network** → click any `consumers` request → **Headers → Request Headers**
  → you'll see a **`Cookie:`** header carrying it. *That* is the authentication
  traveling with the request.
- **Log out** (which deletes the cookie) and hit a protected page → the request
  comes back **401**. That's `requireAuth` rejecting an unauthenticated request.

> **Say this:** "Authenticated means the request proves who you are. Our proof is
> the `sb-access-token` cookie the browser sends automatically. The frontend needs
> no special code; the backend's `requireAuth` middleware checks the cookie on
> every consumer route and returns 401 if it's missing or invalid."

---

## Quick recap (one-liners)

- **JSON** = data written as text so any two programs can exchange it; `stringify`
  to send, parse (`.json()`) to read.
- **`Content-Type: application/json`** = a label saying "my body is JSON" so the
  server parses it correctly; GET has no body, so it needs no label.
- **Promise** = a result that isn't ready yet; **await** waits for it; **async**
  lets you use await and returns a Promise.
- **`response.json()`** = read the body stream and parse it into an object — a
  second step because `fetch` first hands you only the envelope (status/headers).
- **Authenticated request** = carries proof of who you are (our `sb-access-token`
  cookie); the browser sends it automatically, and the backend `requireAuth`
  middleware verifies it on every protected route.
