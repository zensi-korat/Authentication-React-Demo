/**
 * Hardcoded demo user store — no database involved.
 *
 * Real apps store users in a database with a `password_hash` column. This repo
 * skips that on purpose: the goal is to learn how login/JWT verification works,
 * not how to set up a users table. Swap this for a real lookup later.
 *
 * The hash below is bcrypt.hashSync("Demo1234!", 10) computed once, offline —
 * bcrypt hashes are salted, so hashing the same password twice gives a
 * DIFFERENT string each time. That's expected; `bcrypt.compare` still matches.
 */
export const users = [
  {
    id: "demo-user-1",
    email: "demo@example.com",
    passwordHash: "$2a$10$dNfOaSaK2YZ.vBiz0f2J0OUbseaSdUEiKEcij7UQfagSXRnKiYOJm",
  },
];

export function findUserByEmail(email) {
  return users.find((u) => u.email === email);
}

export function findUserById(id) {
  return users.find((u) => u.id === id);
}

/**
 * Adds a new user to the in-memory list. Lives only in server memory, so it
 * resets when the server restarts — a database would persist it, but that's
 * a separate concern from how signup/hashing actually works.
 */
export function addUser({ email, passwordHash }) {
  const user = { id: `user-${users.length + 1}-${Date.now()}`, email, passwordHash };
  users.push(user);
  return user;
}
