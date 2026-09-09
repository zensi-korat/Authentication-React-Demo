import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { generateOtp, hashOtp, compareOtp, otpExpiresAt } from "../lib/otp.js";
import { buildGoogleAuthUrl, verifyGoogleAuthCode } from "../lib/google-oauth.js";

// Rebuilding from scratch, one piece at a time, this time backed by a real
// Supabase table instead of an in-memory array. Each route below is an empty
// stub — we'll fill them in together as we cover each concept.

const USERS_TABLE = "demo_users";
const OTPS_TABLE = "demo_otps";
const EMAIL_VERIFICATION_PURPOSE = "email_verification";
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const OAUTH_STATE_COOKIE = "oauth_state";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_DAYS_MS = 60 * 60 * 24 * 30 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
// The client origin OAuth redirects should land back on — derived from the
// same env var Google itself is configured with, instead of a new one.
const CLIENT_ORIGIN = new URL(process.env.GOOGLE_REDIRECT_URI).origin;

export const authRouter = Router();

/**
 * Signs both JWTs for a user and sets them as httpOnly cookies — the exact
 * same two res.cookie() calls POST /login already made, now shared with
 * GET /google/callback so the "how a session gets created" logic exists in
 * exactly one place regardless of which door the user came in through.
 */
function setAuthCookies(res, user) {
  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = signRefreshToken({ id: user.id });

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: FIFTEEN_MINUTES_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_MS,
  });
}

/**
 * Generates a fresh OTP for a user, invalidates any still-active code for
 * the same purpose (so only the latest one is ever valid), stores the HASH
 * of the new code, and "sends" it by logging to the server console — a
 * stand-in for a real email service (SendGrid, Resend, etc.), which this
 * demo doesn't wire up on purpose to keep the focus on the OTP mechanics
 * themselves (generate, store hashed, expire, invalidate after use).
 *
 * Returns the raw code so the route handler can *also* echo it back in the
 * API response (as `devCode`) purely so the client can console.log it for
 * this demo — a real app would never put a verification code in a JSON
 * response, since anything the browser can read, an attacker on the same
 * machine/network could too.
 */
async function issueOtp({ userId, email, purpose }) {
  await supabaseAdmin
    .from(OTPS_TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const code = generateOtp();

  const { error } = await supabaseAdmin.from(OTPS_TABLE).insert({
    user_id: userId,
    purpose,
    code_hash: hashOtp(code),
    expires_at: otpExpiresAt(),
  });

  if (error) throw error;

  console.log(
    `[DEV] Verification code for ${email}: ${code} — a real app would email this instead of logging it`,
  );

  return code;
}

/**
 * POST /api/auth/signup — body: { email, password }
 *
 * Same shape as our old in-memory version, but the user now lives in a real
 * Postgres row via Supabase instead of a JS array. The password is hashed
 * with bcrypt BEFORE it ever reaches the database — Postgres only ever sees
 * `password_hash`, never the plaintext.
 */
authRouter.post("/signup", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "A valid email is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const { data: user, error } = await supabaseAdmin
    .from(USERS_TABLE)
    .insert({ email, password_hash: passwordHash, email_verified: false })
    .select("id, email")
    .single();

  if (error) {
    // Postgres error code 23505 = unique constraint violation — our `email
    // text not null unique` column already rejects the duplicate for us.
    if (error.code === "23505") {
      return res.status(409).json({ message: "An account with that email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }

  const devCode = await issueOtp({
    userId: user.id,
    email: user.email,
    purpose: EMAIL_VERIFICATION_PURPOSE,
  });

  res.status(201).json({
    message: "Account created. Check your email for a verification code.",
    devCode, // demo-only convenience; see the comment on issueOtp()
  });
});

/**
 * POST /api/auth/verify-otp — body: { email, code }
 *
 * Looks up the user's latest un-consumed email-verification OTP row,
 * checks it hasn't expired, and compares the submitted code against the
 * stored HASH (never a plaintext comparison, same reasoning as passwords).
 * On success, marks the OTP consumed (so it can't be replayed) and flips
 * `email_verified` to true.
 */
authRouter.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body ?? {};

  if (typeof email !== "string" || typeof code !== "string") {
    return res.status(400).json({ message: "Email and code are required" });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, email_verified")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    return res.status(500).json({ message: userError.message });
  }
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }
  if (user.email_verified) {
    return res.status(400).json({ message: "Email is already verified" });
  }

  const { data: otp, error: otpError } = await supabaseAdmin
    .from(OTPS_TABLE)
    .select("id, code_hash, expires_at")
    .eq("user_id", user.id)
    .eq("purpose", EMAIL_VERIFICATION_PURPOSE)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpError) {
    return res.status(500).json({ message: otpError.message });
  }

  const isExpired = !otp || new Date(otp.expires_at).getTime() < Date.now();
  const codeMatches = otp && compareOtp(code, otp.code_hash);

  if (isExpired || !codeMatches) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  await supabaseAdmin
    .from(OTPS_TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", otp.id);

  const { error: verifyError } = await supabaseAdmin
    .from(USERS_TABLE)
    .update({ email_verified: true })
    .eq("id", user.id);

  if (verifyError) {
    return res.status(500).json({ message: verifyError.message });
  }

  res.json({ message: "Email verified" });
});

/**
 * POST /api/auth/resend-otp — body: { email }
 *
 * Re-runs the same issueOtp() flow signup uses. Deliberately responds with
 * the same generic message whether or not the email exists, so this
 * endpoint can't be used to probe which emails are registered.
 */
authRouter.post("/resend-otp", async (req, res) => {
  const { email } = req.body ?? {};

  if (typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" });
  }

  const { data: user, error } = await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, email, email_verified")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  let devCode;
  if (user && !user.email_verified) {
    devCode = await issueOtp({
      userId: user.id,
      email: user.email,
      purpose: EMAIL_VERIFICATION_PURPOSE,
    });
  }

  res.json({
    message: "If that account needs verification, a new code was sent.",
    devCode, // demo-only convenience; see the comment on issueOtp()
  });
});

/**
 * POST /api/auth/login — body: { email, password }
 *
 * Looks the user up by email, checks the password with bcrypt, and — if it
 * matches — signs a JWT and sets it as an httpOnly cookie. The response body
 * NEVER contains the token itself; only the cookie does.
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const { data: user, error } = await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, email, password_hash, email_verified")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  // user.password_hash is null for Google-only accounts (see GET
  // /google/callback) — guard against passing null to bcrypt, which would
  // throw, instead of letting it fail cleanly as "wrong password."
  const passwordMatches =
    user && user.password_hash && bcrypt.compareSync(password, user.password_hash);

  if (!passwordMatches) {
    // Deliberately the SAME message whether the email doesn't exist or the
    // password is wrong — telling an attacker which one is true would leak
    // which emails are registered.
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (!user.email_verified) {
    return res.status(403).json({
      message: "Please verify your email before logging in",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  setAuthCookies(res, user);

  res.json({ user: { id: user.id, email: user.email } });
});

/**
 * GET /api/auth/google — step 1 of the redirect flow. Not an axios/fetch
 * call from the client; the browser navigates here directly
 * (window.location.href), because what happens next is a redirect to a
 * DIFFERENT origin (accounts.google.com) — something only a real page
 * navigation can do.
 *
 * Generates a random `state`, stashes it in a short-lived httpOnly cookie,
 * and redirects to Google with that same value attached. The callback below
 * checks the two match — this is CSRF protection for the OAuth flow itself
 * (see OTP-EMAIL-VERIFICATION-EXPLAINED.md-style reasoning: never trust a
 * callback without proving it's the one *you* started).
 */
authRouter.get("/google", (_req, res) => {
  const state = randomBytes(16).toString("hex");

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: FIVE_MINUTES_MS,
  });

  res.redirect(buildGoogleAuthUrl(state));
});

/**
 * GET /api/auth/google/callback — step 2. Google redirects the browser
 * here with `code` (a one-time claim ticket) and `state` (echoed back
 * unchanged) as query params.
 *
 * On success, this does exactly what POST /login does after a successful
 * password check (setAuthCookies) — OAuth only replaces "how do we know
 * this is really them," not anything downstream of that.
 */
authRouter.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.cookies[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" }); // single-use, like an OTP

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !expectedState ||
    state !== expectedState
  ) {
    return res.redirect(`${CLIENT_ORIGIN}/login?error=oauth_failed`);
  }

  try {
    const { email } = await verifyGoogleAuthCode(code);

    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from(USERS_TABLE)
      .select("id, email, email_verified")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) throw lookupError;

    let user = existingUser;

    if (!user) {
      // First time this email has been seen — create a Google-only account.
      // No password_hash (Google is the only way in), and no OTP needed:
      // Google already proved this email belongs to whoever just logged in.
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from(USERS_TABLE)
        .insert({ email, password_hash: null, email_verified: true })
        .select("id, email, email_verified")
        .single();

      if (insertError) throw insertError;
      user = newUser;
    } else if (!user.email_verified) {
      // An existing account signed up with a password but never finished
      // OTP verification — Google's proof is at least as strong, so unblock
      // it here too rather than making them separately complete the OTP flow.
      const { error: verifyError } = await supabaseAdmin
        .from(USERS_TABLE)
        .update({ email_verified: true })
        .eq("id", user.id);

      if (verifyError) throw verifyError;
    }

    setAuthCookies(res, user);

    res.redirect(CLIENT_ORIGIN);
  } catch (err) {
    console.error("Google OAuth callback failed:", err.message);
    res.redirect(`${CLIENT_ORIGIN}/login?error=oauth_failed`);
  }
});

/** POST /api/auth/logout — clears both cookies. */
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
  res.json({ message: "Logged out" });
});

/** GET /api/auth/me — verifies the access-token cookie LOCALLY (no network call). */
authRouter.get("/me", (req, res) => {
  const token = req.cookies[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  res.json({ user: { id: payload.sub, email: payload.email } });
});

/**
 * POST /api/auth/refresh — trades a valid refresh-token cookie for a new
 * access-token cookie, without requiring the password again. This is the
 * whole reason for having TWO tokens: the short-lived access token can
 * expire often (safer) while the long-lived refresh token quietly renews it.
 */
authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies[REFRESH_TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // The refresh token only carries `sub` (the user id) — we look up the
  // current email fresh from the database rather than trusting a stale copy.
  const { data: user, error } = await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, email")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error || !user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const accessToken = signAccessToken(user);

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: FIFTEEN_MINUTES_MS,
  });

  res.json({ message: "Refreshed" });
});
