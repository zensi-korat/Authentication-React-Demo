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

// Rebuilding from scratch, one piece at a time, this time backed by a real
// Supabase table instead of an in-memory array. Each route below is an empty
// stub — we'll fill them in together as we cover each concept.

const USERS_TABLE = "demo_users";
const OTPS_TABLE = "demo_otps";
const EMAIL_VERIFICATION_PURPOSE = "email_verification";
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_DAYS_MS = 60 * 60 * 24 * 30 * 1000;

export const authRouter = Router();

/**
 * Generates a fresh OTP for a user, invalidates any still-active code for
 * the same purpose (so only the latest one is ever valid), stores the HASH
 * of the new code, and "sends" it by logging to the server console — a
 * stand-in for a real email service (SendGrid, Resend, etc.), which this
 * demo doesn't wire up on purpose to keep the focus on the OTP mechanics
 * themselves (generate, store hashed, expire, invalidate after use).
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

  await issueOtp({ userId: user.id, email: user.email, purpose: EMAIL_VERIFICATION_PURPOSE });

  res.status(201).json({ message: "Account created. Check your email for a verification code." });
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

  if (user && !user.email_verified) {
    await issueOtp({ userId: user.id, email: user.email, purpose: EMAIL_VERIFICATION_PURPOSE });
  }

  res.json({ message: "If that account needs verification, a new code was sent." });
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

  const passwordMatches = user && bcrypt.compareSync(password, user.password_hash);

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

  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = signRefreshToken({ id: user.id });

  // httpOnly = page JS can't read this cookie (anti-theft). maxAge is in
  // MILLISECONDS for Express, matching each token's own expiry.
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

  res.json({ user: { id: user.id, email: user.email } });
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
