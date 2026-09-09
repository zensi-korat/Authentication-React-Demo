import { OAuth2Client } from "google-auth-library";

/**
 * Google OAuth (technically OpenID Connect on top of it) helpers — the
 * "redirect flow" piece. `routes/auth.js` still owns the DB lookups and
 * cookie-setting, same division of labor as lib/jwt.js and lib/otp.js.
 *
 * Verifying Google's id_token is delegated to google-auth-library (Google's
 * own official verifier) rather than hand-rolled like our own access/refresh
 * tokens: Google signs with RS256 against a rotating public key set (JWKS),
 * and correctly fetching/caching/rotating those keys by hand is a lot of
 * plumbing for no extra teaching value beyond what HS256 already covers in
 * lib/jwt.js. Same category of choice as using @supabase/supabase-js
 * instead of hand-rolling the Postgres wire protocol.
 */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in environment");
if (!GOOGLE_CLIENT_SECRET) throw new Error("Missing GOOGLE_CLIENT_SECRET in environment");
if (!GOOGLE_REDIRECT_URI) throw new Error("Missing GOOGLE_REDIRECT_URI in environment");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);

/** The URL to redirect the browser to, kicking off Google's consent screen. */
export function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Trades the one-time `code` from the callback for Google's tokens.
 * Server-to-server (uses GOOGLE_CLIENT_SECRET, which the browser never
 * sees) — this is why the code itself is safe to briefly appear in the
 * callback URL: it's useless without the secret held only here.
 */
async function exchangeCodeForTokens(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json(); // { id_token, access_token, expires_in, ... }
}

/**
 * Exchanges the code and verifies the resulting id_token's signature +
 * audience + issuer, returning the identity claims we actually trust:
 * { googleId, email, emailVerified, name }.
 */
export async function verifyGoogleAuthCode(code) {
  const { id_token: idToken } = await exchangeCodeForTokens(code);

  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  // Belt-and-suspenders: even though this token arrived over a direct
  // server-to-server TLS call to Google (not through the browser), still
  // check Google's own claim that the email is verified before trusting it
  // as a login identity.
  if (!payload.email_verified) {
    throw new Error("Google account email is not verified");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}
