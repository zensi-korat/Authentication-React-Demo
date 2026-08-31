import { Router } from "express";
import { supabaseAnon } from "../lib/supabase-anon.js";

const ACCESS_TOKEN_COOKIE = "sb-access-token";
const REFRESH_TOKEN_COOKIE = "sb-refresh-token";
const THIRTY_DAYS_MS = 60 * 60 * 24 * 30 * 1000;

export const authRouter = Router();

/** POST /api/auth/login — body: { email, password } */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const { session, user } = data;

  // httpOnly = page JS can't read the token (anti-theft). Express cookie
  // maxAge is in MILLISECONDS (Next.js used seconds), hence the *1000.
  res.cookie(ACCESS_TOKEN_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.expires_in * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, session.refresh_token, {
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

/** GET /api/auth/me — reads the sb-access-token cookie and validates it. */
authRouter.get("/me", async (req, res) => {
  const token = req.cookies[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  res.json({ user: { id: data.user.id, email: data.user.email } });
});
