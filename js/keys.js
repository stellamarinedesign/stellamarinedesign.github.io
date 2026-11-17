// keys.js - the two secrets the hub makes, and the email helpers every module
// shares.
//
// AN APP KEY is the password of a person's account in one app's own Firebase
// project. Nobody types it or sees it: the hub writes it, and the shared core
// hands it to the app's own sign-in. 32 random bytes, so it cannot be guessed.
//
// A TEMPORARY PASSWORD is what a master passes on to a new person. It is typed
// once, by a person, so it is short enough to read aloud and has no lookalike
// characters. Same shape as the board's (access.js, tempPassword).

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const PLAIN = 'abcdefghjkmnpqrstuvwxyz23456789';   // 31: no i, l, o, 0, 1

/** Fill a byte array with randomness. Injectable, so tests can repeat. */
const cryptoFill = (bytes) => globalThis.crypto.getRandomValues(bytes);

/** A new app key: 32 random bytes as 43 URL-safe characters. */
export function newKey(fill = cryptoFill) {
  const b = fill(new Uint8Array(32));
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64URL[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64URL[n & 63];
  }
  return out;
}

/**
 * A temporary password, `abcd-efgh-jkmn`. Bytes of 248 and over are thrown
 * away rather than wrapped, so every character is equally likely.
 */
export function tempPassword(fill = cryptoFill) {
  let s = '';
  while (s.length < 12) {
    for (const b of fill(new Uint8Array(24))) {
      if (b < 248 && s.length < 12) s += PLAIN[b % PLAIN.length];
    }
  }
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** An address as every list and every rule holds it: trimmed, lower case. */
export const tidyEmail = (e) => String(e ?? '').trim().toLowerCase();

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e ?? ''));

/** A list of addresses, tidied, blanks and repeats dropped, order kept. */
export const tidyList = (xs) => [...new Set((Array.isArray(xs) ? xs : []).map(tidyEmail).filter(Boolean))];
