import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the ANON/PUBLISHABLE key.
 *
 * Used ONLY for auth operations (signInWithPassword, getUser). The anon key is
 * what makes Supabase apply its normal auth rules instead of a server-side
 * bypass — never use the service-role client (supabase-admin.js) for auth.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL in environment");
if (!anonKey) throw new Error("Missing SUPABASE_ANON_KEY in environment");

export const supabaseAnon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});
