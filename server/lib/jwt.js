import jwt from "jsonwebtoken";

/**
 * The core of "hand-rolled" auth: sign a JWT with a secret, verify it later
 * with the same secret, no network call to anywhere.
 *
 * Two separate secrets/expiries on purpose — an access token is short-lived
 * and sent on every request; a refresh token is long-lived and only ever sent
 * to /api/auth/refresh. If the access secret ever leaked, refresh tokens
 * signed with a different secret stay safe.
 */
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_TOKEN_SECRET) throw new Error("Missing JWT_ACCESS_SECRET in environment");
if (!REFRESH_TOKEN_SECRET) throw new Error("Missing JWT_REFRESH_SECRET in environment");

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch {
    return null;
  }
}
