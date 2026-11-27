// hub.js - the one file every Stella app loads from the hub.
//
//   const { Hub } = await import('/core/v1/hub.js');
//   const r = await Hub.connect({
//     project: firebaseConfig.projectId, title: 'Production board',
//     session: () => auth.currentUser?.email ?? null,
//     signIn:  ({ email, password, token }) => ...,   // the app's own sign-in
//     signOut: () => ...,
//     legacy:  () => showOwnForm(),                    // only while migrating
//   });
//   Hub.switcher(document.getElementById('hubSlot'), { current: firebaseConfig.projectId });
//   await Hub.confirmPassword(typed)     // true or false: an app's own unlock, never a sign-in
//
// THIS FILE IS A CONTRACT. Every app depends on it, and an iPad can keep a
// page alive for days, so an old copy of it will meet new data. Add to it;
// do not change what a name means or what the note below holds. A change is
// tried from core/next first (tools/channel.py) and only then copied here.
//
// IT HAS NO IMPORTS AND LOADS NO SDK. On a device that is already signed in,
// connecting is one read of a note in localStorage and a comparison of two
// addresses: no network at all. Everything heavier - the sign-in screen, the
// hub's own Firebase session, reading a key - is in hub-impl.js, fetched only
// when it is needed.
//
// THE NOTE (localStorage `stella.hub.session`), three states:
//   absent                     the hub has never been used on this device
//   { v, uid, email, name, apps, master, at, checkedAt }
//                              somebody is signed in to the hub here. `apps`
//                              is { projectId: role id | 'link' }: what the
//                              switcher draws.
//   { v, out }                 they signed out. Apps that were not open at the
//                              time find this when next opened, and sign
//                              themselves out too.
// THE NOTE GRANTS NOTHING. Anyone can edit their own localStorage. What lets a
// person read an app's data is that app's own Firebase session and its rules;
// all the note decides is whether this file troubles the network.
//
// WHAT connect() ANSWERS (`state`):
//   in           the app is signed in as the hub's person: carry on
//   legacy       the app is signed in and this device has never met the hub,
//                or the app has not joined yet (the registry's `joined`):
//                carry on exactly as before (pass `strict: true` to end the first)
//   none         signed in to the hub, but this login has no access to the app
//   broken       it has a key, the app refused it, and the person's own fix
//                (typing their old password for the app once) did not take
//   unreachable  the hub could not be reached; `legacy` was called if given

const BUILD = '2026-11-27.8';
const CHANNEL = 'next';
const NOTE = 'stella.hub.session';
const CHANNEL_KEY = 'stella.hub.channel';
const SHELL_KEY = 'stella.hub.shell';
const DAY = 24 * 60 * 60 * 1000;

const tidy = (e) => String(e ?? '').trim().toLowerCase();
const iso = (ms) => new Date(ms).toISOString();

/** The note, read from its stored text. Anything unreadable is "never used". */
export function readNote(raw) {
  let v = null;
  try { v = JSON.parse(raw ?? 'null'); } catch { v = null; }
  if (!v || typeof v !== 'object') return { kind: 'none' };
  if (typeof v.out === 'string') return { kind: 'out', at: v.out };
  if (typeof v.uid === 'string' && v.uid && typeof v.email === 'string' && v.email) {
    return {
      kind: 'user',
      uid: v.uid,
      email: tidy(v.email),
      name: typeof v.name === 'string' ? v.name : '',
      apps: v.apps && typeof v.apps === 'object' && !Array.isArray(v.apps) ? v.apps : {},
      master: v.master === true,
      at: typeof v.at === 'string' ? v.at : null,
      checkedAt: typeof v.checkedAt === 'string' ? v.checkedAt : null,
    };
  }
  return { kind: 'none' };
}

const publicMe = (n) => (n.kind === 'user' ? { uid: n.uid, email: n.email, name: n.name, apps: { ...n.apps }, master: n.master } : null);

/** Was that a refusal by the rules (as opposed to no connection)? */
const refused = (e) => e?.status === 403 || String(e?.code ?? '').includes('permission-denied');
/** Is this failure about the connection or about being asked to wait, rather than about the password? */
const cannotTell = (e) => /network|too-many|unavailable|timeout|deadline/.test(String(e?.code ?? '').toLowerCase())
  || /failed to fetch|networkerror|load failed/i.test(String(e?.message ?? ''));

const SWITCHER_CSS = '.shub-sw{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;'
  + 'width:36px;height:36px;border-radius:8px;cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent}'
  + '.shub-sw:hover{background:rgba(127,127,127,.22)}'
  // The host page's own focus colour where it has one (every Stella app does), so the ring follows its theme.
  + '.shub-sw:focus-visible{outline:2px solid var(--focus,#ea372e);outline-offset:2px}'
  + '.shub-sw[aria-expanded="true"]{background:rgba(127,127,127,.3)}'
  + '.shub-sw:active{transform:scale(.97)}'
  + '@media (pointer:coarse){.shub-sw{width:44px;height:44px}}';
const GRID_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">'
  + [5, 12, 19].map((y) => [5, 12, 19].map((x) => `<circle cx="${x}" cy="${y}" r="1.9"/>`).join('')).join('') + '</svg>';

/**
 * The hub, over an environment. The browser's is at the foot of this file;
 * the tests pass their own (tests/core.js).
 */
export function makeHub(env) {
  let implPromise = null;
  let watching = false;
  let checking = false;
  let warmed = false;
  const listeners = new Set();
  const switchers = new Set();

  const note = () => readNote(env.get(NOTE));

  function changed() {
    const me = publicMe(note());
    for (const cb of [...listeners]) { try { cb(me); } catch { /* one listener's fault is not the others' */ } }
    for (const s of switchers) drawSwitcher(s);
  }
  function watch() {
    if (watching) return;
    watching = true;
    env.watch(NOTE, changed);                 // another tab signed in or out
  }
  function writeUser(u) {
    const now = iso(env.now());
    env.set(NOTE, JSON.stringify({
      v: 1, uid: u.uid, email: tidy(u.email), name: u.name ?? '', apps: u.apps ?? {}, master: u.master === true, at: now, checkedAt: now,
    }));
    changed();
  }
  function writeOut() {
    env.set(NOTE, JSON.stringify({ v: 1, out: iso(env.now()) }));
    changed();
  }

  /** hub-impl.js, fetched once, the first time anything needs it. A failed fetch is tried again next time. */
  function impl() {
    implPromise ??= Promise.resolve()
      .then(() => env.loadImpl())
      .then((i) => { i.attach({ writeUser, writeOut, note, hub: api }); return i; })
      .catch((e) => { implPromise = null; throw e; });
    return implPromise;
  }

  /**
   * At most once a day, and only when the page is idle and online: is the hub
   * login this note speaks of still alive? A password changed elsewhere, or a
   * person removed, ends it; the note then becomes the signed-out mark and the
   * app follows. It also brings the list of apps up to date.
   */
  function scheduleCheck() {
    const n = note();
    if (checking || n.kind !== 'user' || !env.online()) return;
    if (env.now() - (Date.parse(n.checkedAt ?? '') || 0) < DAY) return;
    checking = true;
    env.idle(async () => {
      try {
        const i = await impl();
        if ((await i.verify()) === 'gone') writeOut();
      } catch { /* not reachable now: tomorrow */ } finally { checking = false; }
    });
  }

  /** Sign the app in with this person's key. 'in' | 'none' | 'broken' | 'unreachable'. */
  async function bridge(i, user, project, opts) {
    let key;
    try { key = await i.readKey(user.uid, project); }
    catch (e) { return refused(e) ? 'none' : 'unreachable'; }
    if (!key?.k) return 'none';
    const tried = new Set();
    for (let round = 0; round < 2; round += 1) {
      for (const password of [key.k, key.next]) {
        if (!password || tried.has(password)) continue;
        tried.add(password);
        try {
          await opts.signIn({ email: tidy(key.email) || user.email, password });
          return 'in';
        } catch (e) {
          if (cannotTell(e)) return 'unreachable';
          // Refused: the other key, if a new one is on its way in.
        }
      }
      // Both refused. A master may have finished replacing the key since it was read: read it once more.
      try { key = await i.readKey(user.uid, project); }
      catch (e) { return refused(e) ? 'none' : 'unreachable'; }
      if (!key?.k) return 'none';
      if (tried.has(key.k) && (!key.next || tried.has(key.next))) break;
    }
    return 'broken';
  }

  async function connect(opts = {}) {
    const project = String(opts.project ?? '');
    const title = String(opts.title ?? 'this app');
    watch();
    let own = tidy(await opts.session?.());
    const n = note();

    if (own && n.kind === 'user' && n.email === own) { scheduleCheck(); return { state: 'in', me: publicMe(n) }; }
    if (own && n.kind === 'none' && !opts.strict) return { state: 'legacy', me: null };
    // Signed out of the hub, or the hub is somebody else here: the app follows,
    // but only once it has JOINED. An app whose patch has shipped and whose
    // `joined` is not set yet is left exactly as it was: shipping an app's
    // patch changes nothing a signed-in device can see. Signing it out there
    // would leave nothing to sign it back in, since the hub holds no key for it
    // yet (found by material ordering's session, 27 Nov). When the hub cannot
    // say, the app is left alone too: it fails open.
    if (own) {
      let joined = false;
      try { joined = (await (await impl()).isJoined(project)) === true; } catch { joined = false; }
      if (!joined) return { state: 'legacy', me: null };
      await opts.signOut?.();
      own = '';
    }

    const unreachable = async (i) => {
      if (opts.legacy) { try { i?.closeScreens(); } catch { /* nothing open */ } opts.legacy(); }
      else if (i) i.card('unreachable', { title });
      return { state: 'unreachable', me: publicMe(note()) };
    };

    let i;
    try { i = await impl(); } catch { return unreachable(null); }

    let user;
    try { user = await i.session(); } catch { return unreachable(i); }
    if (!user) user = await i.signInScreen({ title });       // stays up until a hub member has signed in

    let state = await bridge(i, user, project, opts);
    // The key was refused: their login in the app is still the one from
    // before the hub, or a reset email changed it. They put it right
    // themselves, once (the impl asks for that password and swaps it for the
    // key), and the key is tried again.
    if (state === 'broken' && typeof i.linkScreen === 'function') {
      if (await i.linkScreen({ title, project, user })) state = await bridge(i, user, project, opts);
    }
    if (state === 'unreachable') return unreachable(i);
    if (state === 'in') i.closeScreens();
    else i.card(state, { title, user });
    return { state, me: publicMe(note()) };
  }

  // ------------------------------------------------------------------ switcher

  /** Inside an iPad home-screen icon that belongs to ONE app, another app opens outside it: no switcher there. */
  function inAppIcon() {
    const standalone = env.standalone?.() === true;
    return standalone && env.get(SHELL_KEY) !== '1';
  }

  function drawSwitcher(s) {
    const d = env.doc?.();
    if (!d || !s.slot) return;
    const n = note();
    const show = n.kind === 'user' && Object.keys(n.apps).length >= 2 && !inAppIcon();
    s.slot.textContent = '';
    if (!show) return;
    if (!d.getElementById('shub-sw-css')) {
      const st = d.createElement('style');
      st.id = 'shub-sw-css';
      st.textContent = SWITCHER_CSS;
      (d.head ?? d.documentElement).append(st);
    }
    const b = d.createElement('button');
    b.type = 'button';
    b.className = 'shub-sw';
    b.title = 'Apps';
    b.setAttribute('aria-label', 'Apps');
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = GRID_ICON;
    b.addEventListener('click', async () => {
      try { (await impl()).openSwitcher(b, { current: s.current }); }
      catch { /* the hub cannot be reached: the button simply does nothing */ }
    });
    s.slot.append(b);
    warmSwitcher();
  }

  /**
   * The menu's code and its list of apps, fetched once the page is idle, so the
   * first press has only to draw. Files from this site: nothing is asked of
   * Firebase, and no SDK is loaded. If it fails, the press fetches them.
   */
  function warmSwitcher() {
    if (warmed) return;
    warmed = true;
    env.idle(async () => { try { await (await impl()).warm?.(); } catch { /* the press tries again */ } });
  }

  /**
   * Draw the app-switcher button into `slot`. Nothing is drawn for a login
   * with fewer than two apps. Returns a function that takes it away again.
   */
  function switcher(slot, o = {}) {
    if (!slot) return () => {};
    const s = { slot, current: o.current ?? null };
    switchers.add(s);
    watch();
    drawSwitcher(s);
    return () => { switchers.delete(s); slot.textContent = ''; };
  }

  // ----------------------------------------------------------------------- api

  const api = {
    version: `${CHANNEL} ${BUILD}`,
    connect,
    switcher,
    /** Who the note says is signed in to the hub here, or null. */
    me: () => publicMe(note()),
    /** Called with the new `me` (or null) whenever the hub sign-in changes, in this tab or another. */
    onChange(cb) { listeners.add(cb); watch(); return () => listeners.delete(cb); },
    /** The hub's own sign-in, for the hub page. Resolves with `me`. */
    async signIn(o = {}) {
      watch();
      const i = await impl();
      if (!(await i.session())) await i.signInScreen({ title: o.title ?? '' });
      i.closeScreens();
      return publicMe(note());
    },
    /** Sign out of the hub. The mark is written first, so the apps follow even if the hub cannot be reached. */
    async signOut() {
      writeOut();
      try { await (await impl()).signOut(); } catch { /* the mark is what matters */ }
    },
    async openPassword() { return (await impl()).passwordDialog(); },
    /**
     * Is this the hub password of the person signed in to the hub here? For an
     * app's own unlock (material ordering's admin lock on the floor iPads),
     * where the app's own password is a key nobody knows. True or false;
     * rejects only when the hub cannot be reached. Nothing else happens: no
     * sign-in, no sign-out, no screen, the note untouched. Added 27 Nov.
     */
    async confirmPassword(password) { return (await impl()).confirmPassword(String(password ?? '')); },
    async noAccess(title) { return (await impl()).card('none', { title: String(title ?? 'this app') }); },
    /** For the hub page and the tests: the implementation, loaded. */
    _impl: impl,
    _note: note,
  };
  return api;
}

// ---------------------------------------------------------------------------
// the browser
// ---------------------------------------------------------------------------

const inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

function browserEnv() {
  return {
    get: (k) => { try { return inBrowser ? window.localStorage.getItem(k) : null; } catch { return null; } },
    set: (k, v) => { try { if (inBrowser) window.localStorage.setItem(k, v); } catch { /* a private window keeps nothing */ } },
    watch: (k, cb) => { if (inBrowser) window.addEventListener('storage', (e) => { if (e.key === k || e.key === null) cb(); }); },
    now: () => Date.now(),
    online: () => !inBrowser || navigator.onLine !== false,
    idle: (fn) => { if (inBrowser && window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 10000 }); else setTimeout(fn, 3000); },
    doc: () => (inBrowser ? document : null),
    standalone: () => inBrowser && (navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true),
    loadImpl: () => import(new URL(`./hub-impl.js?v=${BUILD}`, import.meta.url).href).then((m) => m.createImpl()),
  };
}

// A device can be switched to the trial copy (core/next) to try a change
// before every app gets it: localStorage `stella.hub.channel` = 'next'.
let trial = null;
if (CHANNEL === 'v1' && inBrowser) {
  let want = null;
  try { want = window.localStorage.getItem(CHANNEL_KEY); } catch { want = null; }
  if (want === 'next') {
    try { trial = (await import(new URL('../next/hub.js', import.meta.url).href)).Hub; }
    catch { trial = null; }               // no trial copy published: the live one
  }
}

export const Hub = trial ?? makeHub(browserEnv());
