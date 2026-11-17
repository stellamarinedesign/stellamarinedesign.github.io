// errors.js - what went wrong, as a KIND the code can branch on and a
// sentence a person can read.
//
// Firebase reports the same failure under different codes depending on the SDK
// an app loads: a wrong password is `auth/invalid-credential` from 10.7 on and
// `auth/invalid-login-credentials` or `auth/wrong-password` before it, and
// material ordering is on 9.23. So nothing here matches one exact code; it
// reads the code for what it means.

/** An error this code raises itself, already classified. */
export class HubError extends Error {
  constructor(kind, message, extra = {}) {
    super(message ?? kind);
    this.name = 'HubError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const has = (code, ...parts) => parts.some((p) => code.includes(p));

/**
 * What kind of failure this is.
 *
 *   credential  the address and password do not match (or there is no such user)
 *   exists      that address already has a user in this project
 *   signup-off  the project does not let a browser make users
 *   weak        the password is too weak for Firebase
 *   throttle    too many attempts; wait
 *   network     could not reach Firebase
 *   disabled    the user is disabled
 *   denied      the security rules refused it
 *   stale       the sign-in is too old for this, or has been revoked
 *   missing     the document is not there
 *   other       anything else
 */
export function kindOf(e) {
  if (e instanceof HubError) return e.kind;
  const code = String(e?.code ?? '').toLowerCase();
  if (!code) return /failed to fetch|networkerror|load failed/i.test(String(e?.message ?? '')) ? 'network' : 'other';
  if (has(code, 'invalid-credential', 'invalid-login-credentials', 'wrong-password', 'user-not-found', 'invalid-email')) return 'credential';
  if (has(code, 'email-already-in-use', 'email-exists')) return 'exists';
  if (has(code, 'operation-not-allowed', 'admin-restricted-operation')) return 'signup-off';
  if (has(code, 'weak-password')) return 'weak';
  if (has(code, 'too-many-requests')) return 'throttle';
  if (has(code, 'network-request-failed', 'unavailable', 'deadline-exceeded')) return 'network';
  if (has(code, 'user-disabled')) return 'disabled';
  if (has(code, 'permission-denied', 'insufficient-permission')) return 'denied';
  if (has(code, 'requires-recent-login', 'user-token-expired', 'token-expired')) return 'stale';
  if (has(code, 'not-found')) return 'missing';
  return 'other';
}

const SENTENCE = {
  credential: 'Wrong email or password.',
  exists: 'That address already has a login here.',
  'signup-off': 'This project does not let the hub make logins. Add the user in its Firebase console.',
  weak: 'Firebase wants a stronger password: at least six characters.',
  throttle: 'Too many attempts. Wait a minute and try again.',
  network: 'No connection to Firebase. Check the network and try again.',
  disabled: 'That login has been disabled.',
  denied: 'This login is not allowed to do that.',
  stale: 'Sign out, sign in again, and then try once more.',
  missing: 'That is not there any more.',
};

/** A sentence for the person at the screen. Never a raw Firebase message for the kinds above. */
export function friendly(e) {
  const kind = kindOf(e);
  if (e instanceof HubError && e.message && e.message !== e.kind) return e.message;
  return SENTENCE[kind] ?? (e?.message ? String(e.message) : 'Something went wrong.');
}
