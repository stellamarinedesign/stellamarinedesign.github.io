// hub-impl.js - everything the shared core does that needs more than a note
// in localStorage: the hub's own sign-in, reading a key, and the few things it
// draws inside OTHER apps' pages (the sign-in screen, the "no access" cards,
// the password dialog, the app switcher).
//
// hub.js fetches this file only when one of those is needed. A device that is
// already signed in to its app never loads it.
//
// IT DRAWS INSIDE PAGES IT DOES NOT OWN. The board, material ordering, design
// scheduling and the drawings app each have their own stylesheet, and this
// file's screens appear in all of them. So everything it draws lives under one
// element (.shub), starts from a clean slate there, carries its own copy of
// the family's colours, and is named with a prefix no app uses.
//
// THE SIGN-IN FORM IS ORDINARY PAGE MARKUP, not shadow DOM: a real <form>
// with a username and a current-password field, which is what password
// managers and the iPad keychain look for.

// ---------------------------------------------------------------------------
// The hub's own Firebase project: PUBLIC identifiers, from Firebase console ->
// Project settings -> Your apps. Nothing here is a secret; what protects the
// hub is its sign-in and its rules (firestore.rules in this repo).
//
// EMPTY MEANS DEMO MODE: no Firebase at all, invented people (js/fake.js).
// The hub ran that way until its project existed (stella-hubinator, made
// 2026-11-17). To see the demo again, serve a copy with these four emptied.
// ---------------------------------------------------------------------------
export const HUB_CONFIG = {
  apiKey: 'AIzaSyDIw-Hl3O-jS1kK5gVWouHAa8Z3aVDDi3Y',
  authDomain: 'stella-hubinator.firebaseapp.com',
  projectId: 'stella-hubinator',
  appId: '1:621142621399:web:c658505c1d39347ab20492',
};

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const APP_NAME = 'stella-hub';
const MIN_PASSWORD = 8;

// The build stamp hub.js fetched this file with, passed on to what this file
// fetches in turn, so one release is never mixed with pieces of another.
const STAMP = new URL(import.meta.url).searchParams.get('v');
const here = (path) => new URL(path + (STAMP ? `?v=${STAMP}` : ''), import.meta.url).href;

const tidy = (e) => String(e ?? '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Firestore's REST answers, as plain values
// ---------------------------------------------------------------------------

function fromValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return fromFields(v.mapValue?.fields);
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(fromValue);
  return null;
}
const fromFields = (fields) => Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, fromValue(v)]));

/** A document as Firestore's REST API returns it, as a plain object. */
export const decodeDoc = (doc) => fromFields(doc?.fields);

// ---------------------------------------------------------------------------
// the hub's sign-in: Firebase, or the demo
// ---------------------------------------------------------------------------

async function firebaseProvider() {
  const [{ initializeApp, getApps }, fa] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
  ]);
  // A NAMED app. Three of the apps load this same SDK build, so this page may
  // already hold their own default app; the hub's must not be mistaken for it.
  const app = getApps().find((a) => a.name === APP_NAME) ?? initializeApp(HUB_CONFIG, APP_NAME);
  const auth = fa.getAuth(app);
  await auth.authStateReady();

  const base = `https://firestore.googleapis.com/v1/projects/${HUB_CONFIG.projectId}/databases/(default)/documents`;
  // One read over REST, as the signed-in person: no second Firestore SDK on an app's page.
  async function read(path) {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error(`The hub answered ${r.status}`), { status: r.status, code: r.status === 403 ? 'permission-denied' : 'unavailable' });
    return decodeDoc(await r.json());
  }
  const current = () => (auth.currentUser ? { uid: auth.currentUser.uid, email: tidy(auth.currentUser.email) } : null);

  return {
    demo: false,
    app,
    auth,
    fa,
    joined: () => null,                    // the registry says which apps have joined
    current,
    signIn: async (email, password) => { await fa.signInWithEmailAndPassword(auth, String(email).trim(), password); return current(); },
    signOut: () => fa.signOut(auth),
    sendReset: (email) => fa.sendPasswordResetEmail(auth, String(email).trim()),
    changePassword: async (currentPassword, next) => {
      const user = auth.currentUser;
      // Firebase will not change a password on a stale sign-in: prove the current one first.
      await fa.reauthenticateWithCredential(user, fa.EmailAuthProvider.credential(user.email, currentPassword));
      await fa.updatePassword(user, next);
    },
    // Is this login still alive? Asking for a fresh token is what finds out.
    verify: async () => {
      if (!auth.currentUser) return 'gone';
      try { await auth.currentUser.getIdToken(true); return 'ok'; }
      catch (e) { return /network|timeout|unavailable/.test(String(e?.code ?? '').toLowerCase()) ? 'offline' : 'gone'; }
    },
    readPerson: (uid) => read(`directory/${uid}`),
    isMaster: async (uid) => {
      try { const d = await read('config/access'); return Array.isArray(d?.masters) && d.masters.includes(uid); }
      catch { return false; }             // the rules let only a master read it
    },
    readKey: (uid, project) => read(`keys/${uid}/p/${project}`),
  };
}

// ---------------------------------------------------------------------------
// what it draws
// ---------------------------------------------------------------------------

const TAGS = 'div,span,p,h2,h3,form,label,input,button,a,ul,li,img,header,footer,section,nav';
const BLOCK = 'div,p,h2,h3,form,ul,li,header,footer,section,nav';

// The family's tokens (css/style.css and css/themes.css), under short names.
const CSS = `
.shub{all:initial;--g:#0e0a0a;--bg:#1c1c1b;--bg2:#333331;--sf:#282827;--bd:#454542;--bd2:#5e5e5a;--tx:#fff;--tx2:#d2d2ce;--tx3:#b0b0ab;
--ac:#af1f24;--act:#fff;--rt:#ff7369;--fc:#ea372e;--sb:#af1f24;--st:#fff;--tt:uppercase;--ts:.1em;--scrim:rgba(0,0,0,.55);--sh:0 12px 40px rgba(0,0,0,.5);--ok:#1f7a3a;--warn:#af1f24;
--r:8px;--rl:11px;--ease:cubic-bezier(.23,1,.32,1);
--font:"Sweet Sans Pro","Sweet Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--head:"Friz Quadrata Pro","Friz Quadrata BT","Friz Quadrata",Georgia,serif;
font-family:var(--font);font-size:14.5px;line-height:1.4;color:var(--tx);color-scheme:dark;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
.shub[data-theme=workshop]{--g:#fff;--bg:#f5f4f0;--bg2:#eceae4;--sf:#fff;--bd:#d4d2c8;--bd2:#b8b6ac;--tx:#1a1a18;--tx2:#5a5a54;--tx3:#6f6f68;
--ac:#1a1a18;--act:#f5f4f0;--rt:#b91c1c;--fc:#2563eb;--sb:#eff6ff;--st:#1d4ed8;--tt:none;--ts:.02em;--scrim:rgba(26,26,24,.35);--sh:0 12px 40px rgba(0,0,0,.18);--ok:#15803d;--warn:#b91c1c;--r:6px;--rl:10px;color-scheme:light}
.shub :is(${TAGS}){all:unset;box-sizing:border-box}
.shub :is(${BLOCK}){display:block}
.shub [hidden]{display:none!important}
.shub ::selection{background:var(--sb);color:var(--st)}
.shub :focus-visible{outline:2px solid var(--fc);outline-offset:2px}
.shub .shub-ico{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}

.shub .shub-screen{position:fixed;inset:0;z-index:2147483000;background:var(--g);overflow:auto;display:grid;place-items:center;padding:24px 16px}
.shub .shub-col{width:100%;max-width:352px;display:grid;gap:16px;justify-items:stretch}
.shub .shub-col.shub-card{text-align:center}
.shub .shub-mark{width:56px;height:56px;object-fit:contain;justify-self:center;display:block}
.shub .shub-place{font-family:var(--head);font-weight:700;font-size:19px;line-height:1.25;letter-spacing:var(--ts);text-transform:var(--tt);text-align:center;text-wrap:balance}
.shub .shub-title{font-family:var(--head);font-weight:700;font-size:19px;line-height:1.25;text-wrap:balance}
.shub .shub-say{color:var(--tx2);overflow-wrap:anywhere}
.shub .shub-form{display:grid;gap:12px}
.shub .shub-field{display:grid;gap:6px}
.shub .shub-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tx3)}
.shub .shub-input{display:block;width:100%;height:36px;padding:0 12px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:var(--r);font-size:16px;caret-color:var(--fc)}
.shub .shub-input[aria-invalid=true]{border-color:var(--rt)}
.shub .shub-reveal-wrap{position:relative;display:block}
.shub .shub-reveal-wrap .shub-input{padding-right:64px}
.shub .shub-reveal{position:absolute;right:4px;top:4px;height:28px;padding:0 10px;border-radius:calc(var(--r) - 2px);color:var(--tx3);font-size:13px;cursor:pointer}
.shub .shub-reveal:hover{color:var(--tx);background:var(--bg2)}
.shub .shub-err{color:var(--rt);font-size:13px;min-height:18px;overflow-wrap:anywhere}
.shub .shub-note{color:var(--tx3);font-size:13px;overflow-wrap:anywhere}
.shub .shub-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;padding:0 14px;border-radius:var(--r);font-weight:600;cursor:pointer;border:1px solid var(--bd2);color:var(--tx2);text-align:center;white-space:nowrap;transition:background-color 120ms var(--ease),border-color 120ms var(--ease)}
.shub .shub-btn:hover{background:var(--bg);color:var(--tx)}
.shub .shub-btn.shub-primary{background:var(--ac);border-color:var(--ac);color:var(--act)}
.shub .shub-btn.shub-primary:hover{filter:brightness(1.12)}
.shub .shub-btn:disabled{cursor:default;color:var(--tx3);background:transparent;border-color:var(--bd);border-style:dashed;filter:none}
.shub .shub-link{justify-self:center;color:var(--tx3);font-size:13px;cursor:pointer;padding:6px 8px;border-radius:var(--r)}
.shub .shub-link:hover{color:var(--tx)}
.shub .shub-link:disabled{cursor:default;opacity:.6}
.shub .shub-acts{display:flex;flex-wrap:wrap;gap:8px}
.shub .shub-screen .shub-acts .shub-btn{flex:1 1 140px}

.shub .shub-scrim{position:fixed;inset:0;z-index:2147483001;background:var(--scrim);display:grid;place-items:center;padding:16px;overflow:auto}
.shub .shub-box{width:100%;max-width:440px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--rl);box-shadow:var(--sh);padding:20px;display:grid;gap:14px}
.shub .shub-box .shub-title{font-size:16px;line-height:1.3}
.shub .shub-box .shub-form{gap:14px}
.shub .shub-hint{color:var(--tx3);font-size:13px}

.shub .shub-pop{position:fixed;z-index:2147483002;width:324px;max-width:calc(100vw - 16px);background:var(--sf);border:1px solid var(--bd);border-radius:var(--rl);box-shadow:var(--sh);padding:12px;transform-origin:var(--ox,100%) 0;animation:shub-pop 150ms var(--ease)}
.shub .shub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.shub .shub-app{display:grid;justify-items:center;align-content:start;gap:6px;padding:12px 4px 10px;min-height:84px;border-radius:var(--r);color:var(--tx2);cursor:pointer;text-align:center;font-size:13px;line-height:1.25;overflow-wrap:anywhere}
.shub .shub-app:hover{background:var(--bg);color:var(--tx)}
.shub .shub-app[aria-current=page]{background:var(--bg2);color:var(--tx);font-weight:600}
.shub .shub-foot{display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:10px;border-top:1px solid var(--bd)}
.shub .shub-who{flex:1;min-width:0;display:grid}
.shub .shub-who b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shub .shub-who span{color:var(--tx3);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shub .shub-home{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 10px;border-radius:var(--r);color:var(--tx2);cursor:pointer;font-weight:600;white-space:nowrap}
.shub .shub-home:hover{background:var(--bg);color:var(--tx)}
.shub .shub-sheet-scrim{position:fixed;inset:0;z-index:2147483001;background:var(--scrim);animation:shub-fade 200ms var(--ease)}

.shub .shub-toast{position:fixed;z-index:2147483003;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 32px));background:var(--ok);color:#fff;border-radius:var(--r);box-shadow:var(--sh);padding:10px 14px;font-weight:600;animation:shub-rise 200ms var(--ease)}
.shub .shub-toast.shub-warn{background:var(--warn)}

@keyframes shub-pop{from{opacity:0;transform:scale(.96)}}
@keyframes shub-fade{from{opacity:0}}
@keyframes shub-rise{from{opacity:0;transform:translate(-50%,8px)}}
@keyframes shub-sheet{from{transform:translateY(100%)}}

@media (max-width:699px),(pointer:coarse){
  .shub .shub-input,.shub .shub-btn,.shub .shub-home{height:44px}
  .shub .shub-reveal{top:0;right:0;height:44px;padding:0 14px}
  .shub .shub-link{display:inline-flex;align-items:center;min-height:44px;padding:0 12px}
}
@media (max-width:699px){
  .shub .shub-pop{left:0!important;right:0;top:auto!important;bottom:0;width:auto;max-width:none;border-radius:var(--rl) var(--rl) 0 0;border-width:1px 0 0;padding:16px 12px calc(16px + env(safe-area-inset-bottom));animation:shub-sheet 260ms var(--ease)}
  .shub .shub-app{min-height:92px;font-size:14.5px}
}
@media (prefers-reduced-motion:reduce){
  .shub .shub-pop,.shub .shub-sheet-scrim,.shub .shub-toast{animation:none}
  .shub .shub-btn{transition:none}
}
`;

// One stroke weight on a 24 grid, as every icon in the family is drawn.
const ICONS = {
  board: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9 9.5v10M14.5 9.5v10"/>',
  box: '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  sheet: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="m14.5 6.5 3-3"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  app: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
};

/** Firebase's error codes are not sentences. Make them ones. */
function say(e) {
  const code = String(e?.code ?? '').toLowerCase();
  if (/invalid-credential|invalid-login|wrong-password|user-not-found|invalid-email|missing-password/.test(code)) return 'Wrong email or password.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a minute and try again.';
  if (/network|unavailable|timeout/.test(code) || /failed to fetch|load failed/i.test(String(e?.message ?? ''))) return 'No connection. Check the network and try again.';
  if (code.includes('user-disabled')) return 'That login has been disabled.';
  if (code.includes('weak-password')) return 'Firebase wants a stronger password than that.';
  if (code.includes('requires-recent-login')) return 'Sign out, sign in again, and then change it.';
  return 'That did not work. Try again.';
}

/** The implementation. hub.js calls this once and hands it the note's writers through `attach`. */
export function createImpl() {
  let ctx = null;                    // { writeUser, writeOut, note, hub } from hub.js
  let providerPromise = null;
  let registryPromise = null;
  let root = null;
  let inerted = [];
  let popover = null;

  const provider = () => (providerPromise ??= (HUB_CONFIG.apiKey
    ? firebaseProvider()
    : import(here('../../js/fake.js')).then((m) => m.demoProvider())
  ).catch((e) => { providerPromise = null; throw e; }));
  const registry = () => (registryPromise ??= import(here('../../js/registry.js')).catch((e) => { registryPromise = null; throw e; }));

  // ------------------------------------------------------------------- drawing

  function h(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }
  function icon(name, size = 22) {
    const t = document.createElement('template');
    t.innerHTML = `<svg class="shub-ico" viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px;height:${size}px" aria-hidden="true" focusable="false">${ICONS[name] ?? ICONS.app}</svg>`;
    return t.content.firstChild;
  }

  /** The one element everything is drawn under, wearing the host page's theme. */
  function mount() {
    if (!document.getElementById('shub-css')) document.head.append(h('style', { id: 'shub-css' }, CSS));
    if (!root?.isConnected) { root = h('div', { class: 'shub' }); document.body.append(root); }
    if (document.documentElement.dataset.theme === 'workshop') root.setAttribute('data-theme', 'workshop');
    else root.removeAttribute('data-theme');
    return root;
  }
  // While a full screen is up, nothing behind it can be reached by Tab or by a screen reader.
  function block() {
    for (const n of document.body.children) {
      if (n !== root && !n.hasAttribute('inert')) { n.setAttribute('inert', ''); inerted.push(n); }
    }
  }
  function unblock() { for (const n of inerted) n.removeAttribute('inert'); inerted = []; }

  function showScreen(node) {
    mount();
    root.querySelector('.shub-screen')?.remove();
    root.append(node);
    block();
  }
  function closeScreens() {
    root?.querySelector('.shub-screen')?.remove();
    unblock();
  }

  const mark = () => h('img', { class: 'shub-mark', src: new URL('../../images/brand/stella-icon.png', import.meta.url).href, alt: '', width: '56', height: '56' });
  const field = (label, control, id) => h('div', { class: 'shub-field' }, h('label', { class: 'shub-label', for: id }, label), control);
  function passwordInput(id, autocomplete) {
    const input = h('input', { class: 'shub-input', id, type: 'password', name: autocomplete === 'current-password' ? 'password' : id, autocomplete });
    const show = h('button', { class: 'shub-reveal', type: 'button', 'aria-controls': id }, 'Show');
    show.addEventListener('click', () => {
      const on = input.type === 'password';
      input.type = on ? 'text' : 'password';
      show.textContent = on ? 'Hide' : 'Show';
      input.focus();
    });
    return { input, wrap: h('div', { class: 'shub-reveal-wrap' }, input, show) };
  }

  function toast(message, { warn = false, ms = 4000 } = {}) {
    mount();
    root.querySelector('.shub-toast')?.remove();
    const t = h('div', { class: `shub-toast${warn ? ' shub-warn' : ''}`, role: 'status' }, message);
    root.append(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------------------------------------------------------------- the person

  /**
   * Is this hub login a member? If so write the note: who they are and which
   * apps they have. A login with no directory entry, or a disabled one, is
   * nobody as far as the hub is concerned.
   */
  async function memberNote(user) {
    const p = await provider();
    const person = await p.readPerson(user.uid);
    if (!person || person.disabled === true) return null;
    const reg = await registry();
    const apps = reg.appsFromLinks(person.links, reg.PROJECTS, p.joined());
    const master = await p.isMaster(user.uid);
    ctx.writeUser({ uid: user.uid, email: user.email, name: person.name ?? '', apps, master });
    return { uid: user.uid, email: user.email };
  }

  /** The hub login on this device, or null. The note is refreshed when it does not match. */
  async function session() {
    const p = await provider();
    const user = p.current();
    if (!user) return null;
    const n = ctx.note();
    // Signed out in the note but not in Firebase (the sign-out never reached it): finish the job.
    if (n.kind === 'out') { try { await p.signOut(); } catch { /* next time */ } return null; }
    if (n.kind === 'user' && n.uid === user.uid) return user;
    if (await memberNote(user)) return user;
    try { await p.signOut(); } catch { /* next time */ }
    return null;
  }

  async function verify() {
    const p = await provider();
    const answer = await p.verify();
    if (answer !== 'ok') return answer;
    try { return (await memberNote(p.current())) ? 'ok' : 'gone'; }
    catch { return 'offline'; }
  }

  // ---------------------------------------------------------- sign-in screen

  /** Draw the sign-in screen and resolve once a hub MEMBER has signed in. It never rejects: it stays up. */
  function signInScreen() {
    return new Promise((resolve) => {
      let done = false;
      const email = h('input', { class: 'shub-input', id: 'shub-email', type: 'email', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
      const pw = passwordInput('shub-pass', 'current-password');
      const err = h('p', { class: 'shub-err', id: 'shub-signin-err', role: 'alert' });
      const note = h('p', { class: 'shub-note', role: 'status', hidden: true });
      // The demo's own line is a separate element: a failed sign-in clears `note`, and must not take this with it.
      const demoNote = h('p', { class: 'shub-note', hidden: true });
      const go = h('button', { class: 'shub-btn shub-primary', type: 'submit' }, 'Sign in');
      const reset = h('button', { class: 'shub-link', type: 'button' }, 'Email me a reset link');
      const place = h('h2', { class: 'shub-place' }, '');
      const form = h('form', { class: 'shub-form', novalidate: true },
        field('Email', email, 'shub-email'), field('Password', pw.wrap, 'shub-pass'), err, go, reset, note, demoNote);
      const screen = h('div', { class: 'shub-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sign in' },
        h('div', { class: 'shub-col' }, mark(), place, form));

      const fail = (message, at) => {
        err.textContent = message;
        for (const i of [email, pw.input]) { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); }
        if (at) { at.setAttribute('aria-invalid', 'true'); at.setAttribute('aria-describedby', 'shub-signin-err'); at.focus(); }
      };
      const busy = (on) => { go.disabled = on; go.textContent = on ? 'Signing in…' : 'Sign in'; };
      for (const i of [email, pw.input]) i.addEventListener('input', () => { if (err.textContent) fail(''); });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (done || go.disabled) return;
        fail('');
        note.hidden = true;
        if (!email.value.trim()) return fail('Enter your email address.', email);
        if (!pw.input.value) return fail('Enter your password.', pw.input);
        busy(true);
        try {
          const p = await provider();
          const user = await p.signIn(email.value, pw.input.value);
          const member = await memberNote(user);
          if (!member) {
            await p.signOut().catch(() => {});
            pw.input.value = '';
            busy(false);
            return fail('That login is not set up here yet. Ask a hub master.', email);
          }
          done = true;                 // the screen stays, busy, until the app is in or a card replaces it
          resolve(member);
        } catch (e2) {
          busy(false);
          fail(say(e2), pw.input);
        }
      });
      reset.addEventListener('click', async () => {
        const address = email.value.trim();
        if (!address) return fail('Type your email address first.', email);
        reset.disabled = true;
        fail('');
        try {
          await (await provider()).sendReset(address);
          // Firebase answers the same whether or not the address has a login, so this cannot say "sent".
          note.textContent = `If ${address} has a login, a link to set a password is on its way. It can take a minute, and it may land in junk.`;
          note.hidden = false;
        } catch (e2) { fail(say(e2)); } finally { reset.disabled = false; }
      });

      showScreen(screen);
      registry().then((reg) => { place.textContent = reg.HUB_NAME; }).catch(() => {});
      provider().then((p) => {
        if (!p.demo || done) return;
        demoNote.textContent = 'Demo. Sign in as alex@example.test, password demo.';
        demoNote.hidden = false;
      }).catch(() => {});
      email.focus();
    });
  }

  // ------------------------------------------------------------------- cards

  /** A full-screen message with a way on: no access, a link that needs repairing, or no connection. */
  function card(kind, { title = 'this app', user = null } = {}) {
    const n = ctx.note();
    const who = n.kind === 'user' ? n.email : (user?.email ?? 'This login');
    const words = {
      none: [`No access to ${title}`, `${who} has no role there. A hub master can give it one.`],
      broken: [`${title} needs relinking`, `The link between ${who} and ${title} has stopped working. A hub master can relink it.`],
      unreachable: ['The hub cannot be reached', 'Check the connection, then try again.'],
    }[kind] ?? ['Something went wrong', 'Try again.'];
    const acts = h('div', { class: 'shub-acts' });
    if (kind === 'unreachable') {
      acts.append(h('button', { class: 'shub-btn shub-primary', type: 'button', onclick: () => location.reload() }, 'Try again'));
    } else {
      const home = h('a', { class: 'shub-btn shub-primary', href: new URL('../../', import.meta.url).pathname }, 'Open the hub');
      const out = h('button', { class: 'shub-btn', type: 'button' }, 'Sign out');
      out.addEventListener('click', async () => { out.disabled = true; await ctx.hub.signOut(); location.reload(); });
      acts.append(home, out);
      registry().then((reg) => { home.textContent = `Open ${reg.HUB_NAME}`; }).catch(() => {});
    }
    const heading = h('h2', { class: 'shub-title', id: 'shub-card-title' }, words[0]);
    showScreen(h('div', { class: 'shub-screen', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'shub-card-title' },
      h('div', { class: 'shub-col shub-card' }, mark(), heading, h('p', { class: 'shub-say' }, words[1]), acts)));
    acts.firstChild.focus();
  }

  // --------------------------------------------------------- password dialog

  /** Change the hub password: the current one, the new one twice. Resolves true when it was changed. */
  function passwordDialog() {
    return new Promise((resolve) => {
      mount();
      const last = document.activeElement;
      const n = ctx.note();
      const cur = passwordInput('shub-pw-cur', 'current-password');
      const next = passwordInput('shub-pw-new', 'new-password');
      const again = passwordInput('shub-pw-again', 'new-password');
      const err = h('p', { class: 'shub-err', id: 'shub-pw-err', role: 'alert' });
      const save = h('button', { class: 'shub-btn shub-primary', type: 'submit' }, 'Change password');
      const cancel = h('button', { class: 'shub-btn', type: 'button' }, 'Cancel');
      // The address, hidden, so a password manager files the new password under the right login.
      const user = h('input', { type: 'email', name: 'username', autocomplete: 'username', value: n.kind === 'user' ? n.email : '', hidden: true });
      const form = h('form', { class: 'shub-form', novalidate: true },
        user,
        field('Current password', cur.wrap, 'shub-pw-cur'),
        h('div', { class: 'shub-field' }, h('label', { class: 'shub-label', for: 'shub-pw-new' }, 'New password'), next.wrap,
          h('p', { class: 'shub-hint', id: 'shub-pw-hint' }, `At least ${MIN_PASSWORD} characters.`)),
        field('New password, again', again.wrap, 'shub-pw-again'),
        err, h('div', { class: 'shub-acts' }, save, cancel));
      next.input.setAttribute('aria-describedby', 'shub-pw-hint');
      const box = h('div', { class: 'shub-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'shub-pw-title' },
        h('h2', { class: 'shub-title', id: 'shub-pw-title' }, 'Change password'), form);
      const scrim = h('div', { class: 'shub-scrim' }, box);

      const close = (changed) => {
        scrim.remove();
        document.removeEventListener('keydown', onKey, true);
        if (!root.querySelector('.shub-screen')) unblock();
        last?.focus?.();
        resolve(changed);
      };
      const fail = (message, at) => { err.textContent = message; at?.focus(); };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
        if (e.key === 'Tab') {
          const f = [...box.querySelectorAll('input:not([hidden]),button')].filter((x) => !x.disabled);
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      };
      cancel.addEventListener('click', () => close(false));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        fail('');
        if (!cur.input.value) return fail('Type the current password first.', cur.input);
        if (next.input.value.length < MIN_PASSWORD) return fail(`The new password needs at least ${MIN_PASSWORD} characters.`, next.input);
        if (next.input.value !== again.input.value) return fail('The two new passwords are not the same.', again.input);
        if (next.input.value === cur.input.value) return fail('That is the current password.', next.input);
        save.disabled = true;
        try {
          await (await provider()).changePassword(cur.input.value, next.input.value);
          close(true);
          toast('Password changed. Use the new one from now on.');
        } catch (e2) {
          save.disabled = false;
          fail(say(e2) === 'Wrong email or password.' ? 'The current password is not right.' : say(e2), cur.input);
        }
      });

      root.append(scrim);
      block();
      document.addEventListener('keydown', onKey, true);
      cur.input.focus();
    });
  }

  // ------------------------------------------------------------ app switcher

  function closeSwitcher({ refocus = true } = {}) {
    if (!popover) return;
    const { node, scrim, button, onKey, onDown } = popover;
    node.remove();
    scrim?.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onDown, true);
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
    popover = null;
  }

  /** The grid of this login's apps, under the button that opened it; a sheet from the bottom on a phone. */
  async function openSwitcher(button, { current = null } = {}) {
    if (popover) { closeSwitcher(); return; }
    const n = ctx.note();
    if (n.kind !== 'user') return;
    const [reg, p] = await Promise.all([registry(), provider().catch(() => null)]);
    const tiles = reg.tilesFor(n.apps, { master: n.master, current, joined: p?.joined() ?? null, demo: Boolean(p?.demo) });
    mount();

    const links = tiles.map((t) => h('a', {
      class: 'shub-app', href: t.href, title: t.title, 'aria-current': t.current ? 'page' : null,
    }, icon(t.icon, 24), h('span', {}, t.short)));
    const home = h('a', { class: 'shub-home', href: new URL('../../', import.meta.url).pathname }, icon('home', 18), reg.HUB_NAME);
    const node = h('div', { class: 'shub-pop', role: 'dialog', 'aria-label': 'Apps' },
      h('nav', { class: 'shub-grid', 'aria-label': 'Your apps' }, links),
      h('div', { class: 'shub-foot' },
        h('div', { class: 'shub-who' }, n.name ? h('b', {}, n.name) : null, h('span', {}, n.email)),
        home));

    const phone = window.matchMedia('(max-width: 699px)').matches;
    const scrim = phone ? h('div', { class: 'shub-sheet-scrim' }) : null;
    if (scrim) root.append(scrim);
    root.append(node);
    if (!phone) {
      // Under the button, its right edge on the button's, kept on screen.
      const r = button.getBoundingClientRect();
      const w = node.offsetWidth;
      const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
      node.style.left = `${left}px`;
      node.style.top = `${Math.min(r.bottom + 6, window.innerHeight - node.offsetHeight - 8)}px`;
      node.style.setProperty('--ox', `${Math.round(((r.left + r.width / 2 - left) / w) * 100)}%`);
    }

    const stops = [...links, home];
    const onKey = (e) => {
      const i = stops.indexOf(document.activeElement);
      const go = (j) => { e.preventDefault(); stops[(j + stops.length) % stops.length].focus(); };
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSwitcher(); }
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowDown') go(i < 0 ? 0 : Math.min(i + 3, stops.length - 1));
      else if (e.key === 'ArrowUp') go(i < 0 ? 0 : Math.max(i - 3, 0));
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(stops.length - 1);
      else if (e.key === 'Tab') {
        if (e.shiftKey && i <= 0) go(stops.length - 1);
        else if (!e.shiftKey && i === stops.length - 1) go(0);
      }
    };
    const onDown = (e) => { if (!node.contains(e.target) && !button.contains(e.target)) closeSwitcher({ refocus: false }); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    button.setAttribute('aria-expanded', 'true');
    popover = { node, scrim, button, onKey, onDown };
    (links.find((a) => a.getAttribute('aria-current')) ?? links[0] ?? home).focus();
  }

  // ---------------------------------------------------------------------- api

  return {
    attach(context) { ctx = context; },
    session,
    signInScreen,
    readKey: async (uid, project) => (await provider()).readKey(uid, project),
    verify,
    signOut: async () => { closeSwitcher({ refocus: false }); await (await provider()).signOut(); },
    passwordDialog,
    card,
    closeScreens,
    openSwitcher,
    toast,
    /** For the hub page: the sign-in behind all this, the registry, and whether this is the demo. */
    provider,
    registry,
    config: HUB_CONFIG,
    isDemo: () => !HUB_CONFIG.apiKey,
    /** Write the note again from the directory: after a master changes their own apps. */
    refresh: async () => { const p = await provider(); const u = p.current(); return u ? memberNote(u) : null; },
  };
}
