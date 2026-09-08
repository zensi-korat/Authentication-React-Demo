import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Pure OTP helpers — no DB, no network, same spirit as lib/jwt.js. The
 * DB orchestration (looking up the user, inserting/consuming rows in
 * demo_otps) lives in routes/auth.js, right alongside the rest of the
 * signup/login flow.
 *
 * Codes are hashed with bcrypt before storage for the same reason
 * passwords are: if the demo_otps table ever leaked, the raw codes
 * shouldn't be readable from it.
 */
const OTP_EXPIRY_MS = 10 * 60 * 1000;

/** A random 6-digit numeric code, e.g. "042817". */
export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code) {
  return bcrypt.hashSync(code, 10);
}

export function compareOtp(code, hash) {
  return bcrypt.compareSync(code, hash);
}

/** Timestamp `OTP_EXPIRY_MS` from now, ready to store in `expires_at`. */
export function otpExpiresAt() {
  return new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
}
