// firebase.js - the Firebase SDK, for the hub PAGE (the launcher, Accounts).
//
// The shared core (core/v1/hub-impl.js) owns the hub's own sign-in and loads
// the SDK for it. This file is for what only the hub page does: reading and
// writing the hub's Firestore as a master, and reaching into each APP's own
// project, as the signed-in person, to read its lists and its overview card.
//
// Same SDK build, from the same addresses, as the core and as three of the
// apps, so the browser fetches each file once and they are the same modules.
//
// FIRESTORE LITE, not the full Firestore: every call here is one read or one
// write, nothing listens and nothing queues offline. Lite is a third of the
// size, and a write that resolves has reached the server, which the linking
// steps rely on (js/linking.js: the key is saved before the account gets it).

import { PROJECTS } from './registry.js';

export const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

let loaded = null;

/** @returns {Promise<{ app, auth, fs }>} the SDK's app, auth and Firestore Lite modules. */
export function sdk() {
  loaded ??= Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore-lite.js`),
  ]).then(([app, auth, fs]) => ({ app, auth, fs }));
  return loaded;
}

/**
 * A Firebase app for one of the APPS' projects, on this page.
 *
 *   'me'   the signed-in person, in that project, with their own key
 *   'tmp'  a throwaway session for account steps (make, check, change a
 *          password): signed in and straight out again, so it never disturbs
 *          the first
 *
 * Both keep their session IN MEMORY. Nothing about another app's sign-in is
 * written to this browser from the hub page; the app's own page does that.
 *
 * A project that enforces App Check gets its own site key here, or its
 * Firestore refuses the hub page's reads (material ordering).
 */
const made = new Map();                 // `${kind}:${pid}` -> Promise<FirebaseApp>

export function projectApp(pid, kind = 'me') {
  if (!PROJECTS[pid]) return Promise.reject(new Error(`Not a project the hub knows: ${pid}`));
  const name = `${kind}:${pid}`;
  // One promise per app, kept: two callers that ask at the same moment (a card
  // and the Accounts grid, say) get the same finished app, never one that is
  // half set up. A failure is forgotten, so the next call tries again.
  if (!made.has(name)) made.set(name, makeApp(pid, name).catch((e) => { made.delete(name); throw e; }));
  return made.get(name);
}

async function makeApp(pid, name) {
  const { app, auth } = await sdk();
  const p = PROJECTS[pid];
  const a = app.getApps().find((x) => x.name === name) ?? app.initializeApp(p.config, name);
  // Straight away, before anything else can ask for this app's auth and be
  // given one that remembers its session in the browser.
  try { auth.initializeAuth(a, { persistence: auth.inMemoryPersistence }); }
  catch (e) { if (!String(e?.code ?? '').includes('already-initialized')) throw e; }
  if (p.appCheck) {
    try {
      const ac = await import(`${SDK}/firebase-app-check.js`);
      ac.initializeAppCheck(a, { provider: new ac.ReCaptchaV3Provider(p.appCheck), isTokenAutoRefreshEnabled: true });
    } catch (e) {
      console.warn(`[hub] App Check for ${pid} did not start:`, e?.message ?? e);
    }
  }
  return a;
}
