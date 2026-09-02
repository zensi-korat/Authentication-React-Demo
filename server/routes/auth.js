import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/jwt.js";

// Rebuilding from scratch, one piece at a time, this time backed by a real
// Supabase table instead of an in-memory array. Each route below is an empty
// stub — we'll fill them in together as we cover each concept.

const USERS_TABLE = "demo_users";
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_DAYS_MS = 60 * 60 * 24 * 30 * 1000;

export const authRouter = Router();

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

  const { error } = await supabaseAdmin
    .from(USERS_TABLE)
    .insert({ email, password_hash: passwordHash });

  if (error) {
    // Postgres error code 23505 = unique constraint violation — our `email
    // text not null unique` column already rejects the duplicate for us.
    if (error.code === "23505") {
      return res.status(409).json({ message: "An account with that email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }

  res.status(201).json({ message: "Account created" });
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
    .select("id, email, password_hash")
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
