import { Router } from "express";
import bcrypt from "bcryptjs";
import { findUserByEmail, findUserById, addUser } from "../lib/users.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/jwt.js";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_DAYS_MS = 60 * 60 * 24 * 30 * 1000;

export const authRouter = Router();

/**
 * POST /api/auth/signup — body: { email, password }
 *
 * Creates a new account and hashes the password with bcrypt before storing
 * it — the server never keeps the plaintext password anywhere, even in
 * memory, past this request. Does NOT log the user in; they head to /login
 * afterward with their new credentials, same as most real signup flows.
 */
authRouter.post("/signup", (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "A valid email is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ message: "An account with that email already exists" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  addUser({ email, passwordHash });

  res.status(201).json({ message: "Account created" });
});

/** POST /api/auth/login — body: { email, password } */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const user = findUserByEmail(email);
  const passwordMatches = user && bcrypt.compareSync(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // httpOnly = page JS can't read the token (anti-theft). Express cookie
  // maxAge is in MILLISECONDS.
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

/** POST /api/auth/logout — clears the auth cookies. */
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
 * access-token cookie, without requiring the user to log in again. This is
 * the whole reason for having TWO tokens: the short-lived access token can
 * expire often (safer) while the long-lived refresh token quietly renews it.
 */
authRouter.post("/refresh", (req, res) => {
  const token = req.cookies[REFRESH_TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const payload = verifyRefreshToken(token);
  const user = payload && findUserById(payload.sub);

  if (!user) {
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
