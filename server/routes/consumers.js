import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { supabaseAnon } from "../lib/supabase-anon.js";

// Demo-only table, separate from the production `consumers` table.
const TABLE = "demo_consumers";
const COLS =
  "id, consumer_number, first_name, middle_name, last_name, email, account_status";

// ── snake_case DB row <-> camelCase app object ──────────────────────────────
const s = (v) => v ?? "";

function rowToConsumer(row) {
  return {
    id: row.id,
    consumerNumber: row.consumer_number ?? 0,
    firstName: row.first_name,
    middleName: s(row.middle_name),
    lastName: row.last_name,
    email: row.email,
    accountStatus: row.account_status,
  };
}

function consumerToRow(input) {
  const row = {};
  if (input.firstName !== undefined) row.first_name = input.firstName;
  if (input.middleName !== undefined) row.middle_name = input.middleName;
  if (input.lastName !== undefined) row.last_name = input.lastName;
  if (input.email !== undefined) row.email = input.email;
  if (input.accountStatus !== undefined) row.account_status = input.accountStatus;
  return row;
}

// ── Auth guard: proves the API is protected server-side, not just the UI ────
async function requireAuth(req, res, next) {
  const token = req.cookies["sb-access-token"];
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export const consumersRouter = Router();
consumersRouter.use(requireAuth); // every route below requires a valid cookie

/**
 * GET /api/consumers?search=&page=&pageSize=
 *   -> { consumers: Consumer[], total, page, pageSize }
 *
 * SEARCH and PAGINATION now happen on the SERVER, driven by URL query params:
 *   - search:   text to match against name/email (case-insensitive)
 *   - page:     which page to return (1-based)
 *   - pageSize: how many rows per page
 *
 * The response includes `total` (how many rows match the search in TOTAL, not
 * just on this page) so the frontend can show "Showing 1–10 of 42" and know how
 * many pages exist.
 */
consumersRouter.get("/", async (req, res) => {
  // 1. Read the query params off the URL. They're always strings (or missing),
  //    so we clean them up and apply sensible defaults.
  const search = (req.query.search ?? "").toString().trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

  // 2. Turn "page + pageSize" into a row range. `.range()` is 0-based and
  //    inclusive: page 1 / size 10 -> rows 0..9; page 2 -> rows 10..19.
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 3. Build the query. `count: "exact"` asks Supabase for the total number of
  //    matching rows (ignoring the range), which we need for the page count.
  let query = supabaseAdmin
    .from(TABLE)
    .select(COLS, { count: "exact" })
    .order("consumer_number", { ascending: true });

  // 4. If there's a search term, match it against any of these columns.
  //    `ilike` is case-insensitive "contains"; `%term%` means "term anywhere".
  if (search) {
    const like = `%${search}%`;
    query = query.or(
      `first_name.ilike.${like},middle_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`,
    );
  }

  // 5. Apply the page range LAST and run the query.
  const { data, error, count } = await query.range(from, to);

  if (error) return res.status(500).json({ message: error.message });

  res.json({
    consumers: data.map(rowToConsumer),
    total: count ?? 0,
    page,
    pageSize,
  });
});

/** POST /api/consumers -> { consumer: Consumer } */
consumersRouter.post("/", async (req, res) => {
  const body = req.body;
  if (
    !body ||
    typeof body.firstName !== "string" ||
    typeof body.lastName !== "string" ||
    typeof body.email !== "string"
  ) {
    return res
      .status(400)
      .json({ message: "firstName, lastName, and email are required" });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert(consumerToRow(body))
    .select(COLS)
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ consumer: rowToConsumer(data) });
});

/** GET /api/consumers/:id -> { consumer: Consumer } */
consumersRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLS)
    .eq("id", req.params.id)
    .single();

  if (error) {
    // PGRST116 = 0 rows; 22P02 = id isn't a valid UUID. Both mean "no such
    // consumer" -> a clean 404 instead of leaking the raw Postgres message.
    if (error.code === "PGRST116" || error.code === "22P02") {
      return res.status(404).json({ message: "Consumer not found" });
    }
    return res.status(500).json({ message: error.message });
  }

  res.json({ consumer: rowToConsumer(data) });
});

/**
 * PUT /api/consumers/:id -> { consumer: Consumer }
 *
 * FULL REPLACE. The client must send every editable field; anything omitted is
 * reset (middleName defaults to ""). Use PUT when you want to overwrite the
 * whole record, not just tweak a field.
 */
consumersRouter.put("/:id", async (req, res) => {
  const body = req.body;
  if (
    !body ||
    typeof body.firstName !== "string" ||
    typeof body.lastName !== "string" ||
    typeof body.email !== "string" ||
    typeof body.accountStatus !== "string"
  ) {
    return res.status(400).json({
      message:
        "firstName, lastName, email, and accountStatus are all required for a full replace (PUT)",
    });
  }

  // Build a COMPLETE row — every column is set, so unspecified optional fields
  // (middleName) are explicitly cleared. That's what makes this a "replace".
  const fullRow = {
    first_name: body.firstName,
    middle_name: body.middleName ?? "",
    last_name: body.lastName,
    email: body.email,
    account_status: body.accountStatus,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(fullRow)
    .eq("id", req.params.id)
    .select(COLS)
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.code === "22P02") {
      return res.status(404).json({ message: "Consumer not found" });
    }
    return res.status(400).json({ message: error.message });
  }

  res.json({ consumer: rowToConsumer(data) });
});

/**
 * PATCH /api/consumers/:id -> { consumer: Consumer }
 *
 * PARTIAL UPDATE. The client sends ONLY the fields that changed; everything
 * else is left as-is. `consumerToRow` already drops undefined fields, so it
 * naturally produces a partial row.
 */
consumersRouter.patch("/:id", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ message: "A JSON body is required" });
  }

  const row = consumerToRow(body); // only the provided fields survive
  if (Object.keys(row).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(row)
    .eq("id", req.params.id)
    .select(COLS)
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.code === "22P02") {
      return res.status(404).json({ message: "Consumer not found" });
    }
    return res.status(400).json({ message: error.message });
  }

  res.json({ consumer: rowToConsumer(data) });
});

/** DELETE /api/consumers/:id -> { message: string } */
consumersRouter.delete("/:id", async (req, res) => {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ message: "Consumer deleted" });
});
