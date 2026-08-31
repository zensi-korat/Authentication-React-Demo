# Speaker Script — API, Fetch & Async Session

Personal prep copy — not meant to be shown to the audience. Full talk track:
what to say, when to pause for the demo, and answers ready for likely
questions. Pair this with **`SESSION-HANDOUT.md`** on screen — this script
follows its section numbers exactly, so you can glance at the handout while
speaking from here.

**Total run time ≈ 33 min + Q&A.** Timings are guides, not a stopwatch —
if a section is landing well, let it breathe; if the room's flagging, cut the
optional bits (marked *optional*).

---

## Opening (30 sec)

"Today's session is about one thing: how the browser talks to a server. We'll
build it up from 'what is an API' all the way to watching real requests fly by
in the Network tab, and then we'll open the actual code in this project. Every
example starts in plain JavaScript — no React — so the idea stays clean before
we see it wrapped in a hook."

---

## 1. What is an API? (~2 min)

Say it plainly first: "API = Application Programming Interface. It's just a
way for two programs to talk to each other using an agreed set of rules."

**Use the restaurant analogy, told as a mini-story:**
"You sit down at a table with a menu — that's the frontend. You don't walk
into the kitchen and cook it yourself. You tell the waiter what you want. The
waiter is the API. The kitchen — the backend and database — actually makes the
food. The waiter brings back your dish — that's the response. You never needed
to know how the kitchen works, only what's on the menu and how to ask."

Land the point: "In our app, the React frontend never touches the database
directly. It asks the API — `/api/consumers`, `/api/auth/login` — and the
backend does the work."

---

## 2. REST vs GraphQL (~2 min)

"There's more than one style of API. The two everyone name-drops are REST and
GraphQL. We use REST."

Walk the table on the handout, but say it as a comparison, not a memorized
table read-aloud:
- "REST has many URLs, one per resource — `/api/consumers` is its own thing.
  You act on it with verbs: GET to read, POST to create, PUT or PATCH to
  update, DELETE to remove. Whatever shape the server decides to send back,
  that's what you get."
- "GraphQL flips that — one URL, usually `/graphql`, and the client says
  exactly which fields it wants in the query. You get back exactly that, no
  more, no less."

**The one-liner to close on:** "REST gives you fixed dishes at fixed URLs;
GraphQL lets you build a custom plate from a single counter. We use REST —
simple, standard, and perfect for a demo app like this."

---

## 3. JSON in one minute (~1 min)

"JSON — JavaScript Object Notation — is just the **text format** we use to
ship data between frontend and backend. It looks like a JS object, but the
second it's traveling over the network, it's nothing but a string."

Show the JSON snippet on the handout, then the two functions:
"`JSON.stringify` turns an object into that string, for sending.
`response.json()` turns the string back into an object, for reading."

**Why bother, if asked or if you have the extra beat (optional):**
"A network can only carry text — it can't send a live JavaScript object with
its methods and memory references. Think of it like flat-packing furniture:
you break the object down into a flat string to ship it, and the other side
rebuilds it. Also worth knowing: JSON keys must always be double-quoted,
JS object keys don't have to be — that trips people up when they hand-write
JSON."

---

## 4. Headers & Content-Type (~2 min, expand only if time allows)

*This section is folded in from the deep-dive doc — use it here if the
audience seems comfortable, or hold it for Q&A if you're behind schedule.*

"Headers are extra information riding alongside a request or response — not
the data itself, more like the label on a shipping box. `Content-Type` is the
one you'll see most: it tells the receiver what format the body is in."

Point at the POST snippet: "We say `Content-Type: application/json` because
our body is just text, and text alone doesn't say how to read itself. Without
that label, the server might not parse the body correctly and `req.body`
comes back empty or wrong."

"One thing people always ask: does GET need this header? No — GET has no
body, its data rides in the URL as query params, so there's nothing to
label."

*(Optional, only if someone asks about file uploads or forms):* "There are
other Content-Types — `multipart/form-data` for file uploads,
`x-www-form-urlencoded` for classic HTML forms — but for a JSON API like
ours, `application/json` is basically the only one we use."

---

## 5. Request & Response structure (~5 min)

"Every API call is a request going out and a response coming back. Get this
part solid and the code just reads itself later."

**Walk the request line-by-line** using the handout's block:
```
POST   /api/consumers
Headers: Content-Type: application/json
Body:   { "firstName": "Ada", "lastName": "Lovelace" }
```
"Four parts: the **method** — the verb, what action; the **URL** — which
resource; **headers** — extra info; the **body** — the data, only on some
methods."

**Go through the methods table using the notebook analogy out loud:**
"GET is 'show me the contacts' — no body, you're just asking. POST is 'add a
new contact' — you're sending a body. PUT is 'rewrite the whole card' —
replace everything. PATCH is 'just change the phone number' — update one
part. DELETE is 'tear out the page' — usually no body needed."

**Then the response — three parts:** "Status code, headers, body. Status
code is the one people actually watch."

**Status code rule of thumb — say this exactly, it's the line people
remember:** "2xx = it worked. 4xx = the client's fault. 5xx = the server's
fault."

---

## 6. Promises, async/await, and fetch (~5–6 min)

This is the heart of the session — slow down here.

**Frame the problem first:** "Talking to an API takes time — the request
travels, the server works, the response comes back. JavaScript runs on one
thread. It can't just freeze the whole page waiting — your buttons would stop
working. So JavaScript handles slow things asynchronously: start the task,
keep the page responsive, deal with the result when it shows up."

**Promise, with the pager analogy:** "A Promise is a placeholder for a value
that isn't ready yet — like a pager at a restaurant. You don't have your food,
but you have something that'll buzz when it's ready. A Promise ends one of two
ways: resolved — it worked, here's the value; or rejected — it failed, here's
the error." *(If you want the fuller version: there's also a `pending` state
while it's still cooking — three states total.)*

**fetch returns a Promise:** "`fetch(url)` doesn't hand you the data directly
— it hands you a Promise that resolves to the response later."

**async/await as the readable way to use it.** Read the code sample aloud,
literally narrating each line:
"'Go fetch the consumers — wait — now turn the response into an object — wait
— now use it.' `await` just lets us write asynchronous code as if it were
step by step."

**Land the mental model as one sentence:** "`fetch` starts a slow task and
hands you a Promise. `await` waits for that Promise without freezing the
page. `async` is the keyword that lets you use `await` at all."

**If someone asks "why do I need `response.json()`, why not just use the
response?" — this is the deep-dive answer, have it ready:**
"`fetch` only gives you an envelope — the status and headers — the body
might still be downloading as a stream. `.json()` reads that stream to the
end and parses it into an object, which is why it's a second `await`. It's
also a separate step because the body could be lots of formats — `.text()`
for plain text, `.blob()` for files/images, `.formData()` for form
submissions. You pick the one that matches what's coming back. For us,
that's always `.json()`."

---

## 7. The standard shape of a call — try/catch/finally (~4 min)

"Almost every call in this whole app follows the exact same skeleton. Learn
it once, every file looks familiar."

Walk the five numbered comments in the code block **in order**, saying each
keyword's job plainly:
- "`try` — attempt this code; if something goes wrong, jump to `catch`."
- "`catch (error)` — here's what to do if it failed. `error` holds the reason."
- "`finally` — runs either way, success or failure. Perfect for turning off a
  loading spinner or re-enabling a button."

**Then the beginner trap — say this deliberately, it's the one thing worth
repeating twice:** "`fetch` does NOT throw on a 404 or a 500. It only rejects
on a real network failure — no internet, DNS failure, that kind of thing. A
404 is still a *completed* request. So we have to check `response.ok`
ourselves — true for any 2xx — and throw it ourselves if it's not."

**Then show the POST version and close with the one-liner:** "GET just needs
a URL. POST adds three things: a method, a `Content-Type` header, and a body
— the data we're sending, packaged as a JSON string."

---

## 8. Authenticated requests (~3 min)

*Folded in from the deep-dive doc — pairs naturally with Demo B below, so you
can either explain this first and then demo it, or demo it and explain after
("now let's see what 'authenticated' actually means in code").*

"When we say 'the requests are all authenticated,' here's exactly what that
means: every call to a protected endpoint — `/api/consumers` — carries proof
that a real, logged-in user is making it, and the server checks that proof
before doing anything. If it's missing or invalid, the server answers 401
Unauthorized instead of handing back data."

"Our proof is a cookie — `sb-access-token`. When you log in, the server sets
it as httpOnly, meaning JavaScript can't read it — that's what keeps it safe
from things like XSS. After that, the browser attaches it to every request to
the same site automatically."

**Point out the asymmetry — this is the part people find surprising:**
"Look at the frontend fetch call — there's no token, no Authorization header,
nothing. It just works because this is a same-origin request, so the browser
sends the cookie along by itself. All the actual auth code lives on the
backend — the `requireAuth` middleware reads the cookie, asks Supabase to
verify it, and only calls `next()` if it's valid. That one line —
`consumersRouter.use(requireAuth)` — is what makes 'every request is
authenticated' literally true in code."

---

## 9. Live demo — Network tab (~5 min)

**Setup line before you touch anything:** "Seeing a real request makes the
code obvious, so let's look before we read anything." Open DevTools → Network
tab → filter to Fetch/XHR. Keep it open through the whole section — point at
things as you talk.

### Demo A — GET with query params
1. Go to Consumers page. Point at the request: `consumers?page=1&pageSize=10`.
2. Click it. Headers tab: "GET, status 200, here's the full request URL with
   the `?` query string."
3. Payload tab: "and here they are broken out — page, pageSize. This is where
   query params live for a GET."
4. Response tab: show the JSON body.
5. Type in the search box → point at the **new** request firing with
   `?search=...`. Mention the small delay is the debounce.
6. Click page 2 → new request, `?page=2`.
7. Click a column header to sort → new request, `?sort=name&dir=asc`.

**Key line, say it exactly:** "I never changed the code — I changed the
question in the URL, and the server returned a different answer. Search,
paging, and sorting are all just query params."

### Demo B — POST with a body (login)
1. Log out, log in again. Find the `login` request — Method: POST.
2. Payload tab: "this is the request body — email and password. This is the
   difference from GET — POST carries a body, not query params."
3. Response tab: `{ user: {...} }`.
4. Application → Cookies: point at `sb-access-token`, HttpOnly checked.
   "The token's stored here by the server. HttpOnly means JavaScript can't
   read it — that's what keeps it safe."

*(If you skipped Section 8 above, this is your cue to explain "authenticated"
right here instead.)*

### Demo C — other methods (optional, quick, skip if short on time)
- Add Consumer → POST with a body.
- Edit → Save changes → PATCH, only changed fields in the body.
- Edit → Replace all → PUT, every field in the body.
- Delete → DELETE, no body.

---

## 10. The "two URLs" idea (~3 min)

"This one trips up almost everybody the first time, so it's worth its own
moment. In a React app there are two completely different URLs, and they are
not the same thing."

Point at the comparison table: "the browser address bar — that's the route,
controlled by React Router. And the API request URL — that's what `fetch`
sends, and you only see it in the Network tab."

**The key point, say it slowly:** "Changing one does not automatically change
the other. They only end up matching because we deliberately keep them in
sync."

Walk the numbered flow diagram: "User types 'jane'. Step one, we write
`?search=jane` into the browser address bar using `useSearchParams`. Step
two, we read that value back out. Step three, we pass it to the fetch hook.
Step four, the hook builds the API URL and requests it. Step five, the server
filters and returns just those rows."

**Then the payoff — why bother:** "Because now the URL is shareable,
bookmarkable, refresh-proof. Copy `/consumers?search=jane&page=2` to a
colleague, they see the exact same view. Refresh the page, your search and
page are still there. Hit the browser Back button, it undoes your last
search or page change. If we'd kept this in `useState` instead, all of that
would vanish on refresh."

**Live proof, do this on screen:** Type in the search box, point at the
address bar changing (not just Network). Then hit refresh — the view stays.
"That's the proof the state now lives in the route, not in memory."

---

## 11. Open the real code (~8 min)

"Let's show the files in the order the request actually travels, frontend to
backend."

**Frontend:**
1. `client/src/features/consumers/get/useConsumers.ts` — "builds the URL with
   `URLSearchParams`, does the fetch. Same try / `res.ok` / `json()` skeleton
   we just walked through."
2. `client/src/features/consumers/post/useCreateConsumer.ts` — "the POST
   version — method, headers, body."
3. `client/src/pages/ConsumersListPage.tsx` — "this is where search/page/sort
   state becomes the params we pass into the hook."

**Backend:**
4. `server/routes/consumers.js` — "the matching routes. Watch how
   `req.query.search`, `page`, `pageSize`, `sort` get read — `ilike` does the
   search, `.range()` does paging, `.order()` does sorting."
5. `server/routes/auth.js` — "`POST /login`, verifying the password against
   Supabase and setting the httpOnly cookie we saw in the demo."

**Close the loop, say this out loud:** "The URL we watched in the Network tab
— `?search=jane&page=2` — is built here, in the hook, and read there, in the
route. Frontend owns the question, backend owns the answer."

---

## 12. Q&A — rehearsed answers

Read these once before the session so they come out naturally, not read off
the page.

**"Where's the base URL / API address?"**
"There isn't one in the code — we use relative paths like `/api/consumers`,
and in dev a proxy forwards `/api/*` to the backend. Same origin, so no CORS,
no base-URL config."

**"Where's the password stored — can we see it?"**
"Not in our code, and nowhere you can see it. Supabase stores a one-way hash.
At login we hand it the typed password and it checks the match. If it's
lost, you reset it — you never recover it."

**"PUT vs PATCH?"**
"PUT replaces the whole record — send every field, anything you omit gets
cleared. PATCH updates part of it — send only what changed, everything else
is left alone."

**"Who decides PUT vs PATCH — frontend or backend?"**
"The backend — it implements a handler for whichever methods it supports.
The frontend just has to use one that exists. Plenty of real APIs only offer
PUT."

**"Doesn't fetch throw on errors?"**
"Only on a real network failure. A 404 or 500 is a completed request, so we
check `response.ok` ourselves and throw it ourselves."

**"What does `await` actually do, in one sentence?"**
"It pauses inside the async function until the Promise settles, then
continues with the result — without freezing the rest of the page."

**"Why is `response.json()` separate from `fetch` itself?"**
"Because `fetch` only hands you the envelope — status and headers — while the
body might still be streaming in. `.json()` reads it to the end and parses
it, and it's a second step because you get to choose the format: json, text,
blob, formData."

**"How is the frontend 'authenticated' if there's no token in the fetch
code?"**
"Because it's a same-origin request, so the browser attaches the
`sb-access-token` cookie automatically — no code needed. All the real
enforcement is server-side, in the `requireAuth` middleware."

---

## Cheat sheet — glance-before-you-speak version

- API = waiter between frontend and backend.
- REST = fixed dishes, fixed URLs. GraphQL = custom plate, one counter.
- JSON = objects as text; `stringify` to send, `.json()`/`parse` to read.
- Content-Type labels the body's format; GET skips it (no body).
- Request = method + URL + headers + body. Response = status + headers + body.
- 2xx worked, 4xx your fault, 5xx server's fault.
- Promise = pager for a value that isn't ready yet (pending/resolved/rejected).
- fetch → Promise. await → wait for it. async → allowed to await.
- `response.json()` is a second await because the body is a separate, readable stream.
- try attempt, catch handle failure, finally runs either way.
- Always check `response.ok` — fetch won't throw on 404/500.
- GET → query params in URL. POST/PUT/PATCH → body.
- Authenticated = proof of identity travels with the request — our proof is
  the `sb-access-token` httpOnly cookie, checked by `requireAuth` server-side.
- Two URLs: address bar (route, React Router) vs request URL (fetch, Network
  tab) — kept in sync deliberately via `useSearchParams`.
