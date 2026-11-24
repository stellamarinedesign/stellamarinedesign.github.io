// core.js - the shared core's decision table (core/v1/hub.js), every row.
//
// The facade is driven here with a made-up environment: a note held in
// memory, a stand-in for hub-impl.js, and a stand-in for an app's own
// sign-in. Nothing loads Firebase or touches a real page.

import { makeHub, readNote } from '../core/v1/hub.js';

const NOTE = 'stella.hub.session';
const P = 'some-project';
const T0 = Date.parse('2026-11-16T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const fb = (code) => Object.assign(new Error(code), { code });

const userNote = (o = {}) => JSON.stringify({
  v: 1, uid: 'u1', email: 'ann@example.test', name: 'Ann', apps: { [P]: 'floor' }, master: false,
  at: new Date(T0).toISOString(), checkedAt: new Date(T0).toISOString(), ...o,
});
const outNote = () => JSON.stringify({ v: 1, out: new Date(T0).toISOString() });

/** A stand-in for an app's own Firebase sign-in. */
function fakeAppAuth({ email = null, accounts = {} } = {}) {
  const a = {
    email,
    accounts,                 // address -> password
    fail: null,               // an error to throw from the next sign-in
    signIns: [],
    signOuts: 0,
    legacyShown: 0,
    session: () => a.email,
    signIn: async ({ email: e, password }) => {
      a.signIns.push({ email: e, password });
      if (a.fail) { const f = a.fail; a.fail = null; throw f; }
      if (a.accounts[e] !== password) throw fb('auth/invalid-credential');
      a.email = e;
    },
    signOut: async () => { a.signOuts += 1; a.email = null; },
    legacy: () => { a.legacyShown += 1; },
  };
  return a;
}

/** A stand-in for hub-impl.js: a hub login that may or may not exist, some keys, and a sign-in screen that "somebody" completes. */
function fakeImpl(o = {}) {
  const i = {
    user: o.user ?? null,                 // the hub's real session on this device
    screenUser: o.screenUser ?? null,     // who signs in when the screen is shown
    keys: o.keys ?? {},                   // project -> key, or an array of keys to return in turn
    verifyAnswer: o.verifyAnswer ?? 'ok',
    calls: [],
    cards: [],
    closed: 0,
    ctx: null,
    attach(ctx) { i.ctx = ctx; },
    async session() {
      i.calls.push('session');
      if (o.sessionFails) throw fb('unavailable');
      if (i.user) i.ctx.writeUser(i.user);
      return i.user ? { uid: i.user.uid, email: i.user.email } : null;
    },
    async signInScreen() {
      i.calls.push('screen');
      i.user = i.screenUser;
      i.ctx.writeUser(i.user);
      return { uid: i.user.uid, email: i.user.email };
    },
    async readKey(uid, project) {
      i.calls.push('readKey');
      if (o.readFails) throw o.readFails;
      const k = i.keys[project];
      return Array.isArray(k) ? (k.length > 1 ? k.shift() : k[0]) : (k ?? null);
    },
    async verify() { i.calls.push('verify'); return i.verifyAnswer; },
    async signOut() { i.calls.push('signOut'); if (o.signOutFails) throw fb('unavailable'); i.user = null; },
    card(kind, info) { i.cards.push({ kind, title: info?.title }); },
    closeScreens() { i.closed += 1; },
    openSwitcher(button, info) { i.calls.push(`switcher:${info.current}`); },
    async warm() { i.calls.push('warm'); },
    async passwordDialog() { i.calls.push('password'); },
  };
  return i;
}

/** A page: an element that can hold children, and enough of `document` for the switcher. */
function fakeDoc() {
  const make = (tag) => {
    const n = {
      tag, children: [], attrs: {}, listeners: {}, className: '', id: '',
      setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(k, fn) { n.listeners[k] = fn; },
      append(...c) { n.children.push(...c); },
      set textContent(v) { if (v === '') n.children = []; n._text = v; },
      get textContent() { return n._text ?? ''; },
      set innerHTML(v) { n._html = v; },
    };
    return n;
  };
  const head = make('head');
  return {
    head,
    createElement: make,
    getElementById: (id) => head.children.find((c) => c.id === id) ?? null,
  };
}

function setupEnv({ note = null, impl = null, loadFails = false, now = T0, online = true, standalone = false, shell = false } = {}) {
  const store = new Map();
  if (note !== null) store.set(NOTE, note);
  if (shell) store.set('stella.hub.shell', '1');
  const idle = [];
  const env = {
    loads: 0,
    time: now,
    get: (k) => (store.has(k) ? store.get(k) : null),
    set: (k, v) => { store.set(k, v); },
    watch: (k, cb) => { env.fireStorage = cb; },
    now: () => env.time,
    online: () => online,
    idle: (fn) => { idle.push(fn); },
    doc: () => env.document,
    document: fakeDoc(),
    standalone: () => standalone,
    loadImpl: async () => { env.loads += 1; if (loadFails) throw new Error('could not fetch'); return impl; },
    runIdle: async () => { while (idle.length) await idle.shift()(); },
    store,
  };
  return env;
}

export async function coreTests({ test, expect, ok, setGroup }) {
  const connect = (hub, app, extra = {}) => hub.connect({ project: P, title: 'Some app', session: app.session, signIn: app.signIn, signOut: app.signOut, legacy: app.legacy, ...extra });
  const ANN = { uid: 'u1', email: 'ann@example.test', name: 'Ann', apps: { [P]: 'floor' } };

  // -------------------------------------------------------------------------
  setGroup('the note');
  await test('unreadable, empty or half a note is "never used"', () => {
    for (const raw of [null, '', 'not json', '[]', '{}', '{"uid":"u1"}', '{"email":"a@x.test"}', '42']) expect(readNote(raw).kind, 'none', String(raw));
  });
  await test('a signed-in note is read with its address tidied', () => {
    const n = readNote(userNote({ email: ' Ann@Example.TEST ', apps: { a: 'manager', b: 'link' }, master: true }));
    expect([n.kind, n.email, n.apps, n.master], ['user', 'ann@example.test', { a: 'manager', b: 'link' }, true]);
  });
  await test('the signed-out mark', () => {
    expect(readNote(outNote()).kind, 'out');
  });

  // -------------------------------------------------------------------------
  setGroup('connect');
  await test('signed in to the app as the hub\'s person: in, and nothing is fetched', async () => {
    const impl = fakeImpl();
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ email: 'Ann@example.test' });
    const r = await connect(makeHub(env), app);
    expect(r.state, 'in');
    expect(r.me.email, 'ann@example.test');
    expect([env.loads, app.signIns.length, app.signOuts], [0, 0, 0]);
  });
  await test('signed in to the app, and the hub never used here: left exactly as it was', async () => {
    const env = setupEnv({ impl: fakeImpl() });
    const app = fakeAppAuth({ email: 'ann@example.test' });
    expect((await connect(makeHub(env), app)).state, 'legacy');
    expect([env.loads, app.signOuts], [0, 0]);
  });
  await test('a corrupt note counts as never used', async () => {
    const env = setupEnv({ note: '{{{', impl: fakeImpl() });
    expect((await connect(makeHub(env), fakeAppAuth({ email: 'ann@example.test' }))).state, 'legacy');
  });
  await test('strict ends that: the app signs out and goes through the hub', async () => {
    const impl = fakeImpl({ screenUser: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ impl });
    const app = fakeAppAuth({ email: 'ann@example.test', accounts: { 'ann@example.test': 'key-1' } });
    expect((await connect(makeHub(env), app, { strict: true })).state, 'in');
    expect(app.signOuts, 1);
    ok(impl.calls.includes('screen'));
  });
  await test('the hub was signed out while this app was closed: the app signs out too', async () => {
    const impl = fakeImpl({ screenUser: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ note: outNote(), impl });
    const app = fakeAppAuth({ email: 'ann@example.test', accounts: { 'ann@example.test': 'key-1' } });
    const r = await connect(makeHub(env), app);
    expect(app.signOuts, 1);
    expect(r.state, 'in');
    expect(impl.calls.filter((c) => c === 'screen').length, 1, 'and it asks who is here now');
  });
  await test('the hub is somebody else on this device: the app becomes that person', async () => {
    const bob = { uid: 'u2', email: 'bob@example.test', name: 'Bob', apps: { [P]: 'manager' } };
    const impl = fakeImpl({ user: bob, keys: { [P]: { k: 'bob-key', email: 'bob@example.test' } } });
    const env = setupEnv({ note: userNote({ uid: 'u2', email: 'bob@example.test' }), impl });
    const app = fakeAppAuth({ email: 'ann@example.test', accounts: { 'bob@example.test': 'bob-key' } });
    const r = await connect(makeHub(env), app);
    expect([r.state, app.email, app.signOuts], ['in', 'bob@example.test', 1]);
    ok(!impl.calls.includes('screen'), 'no sign-in screen: the hub already knows who');
  });
  await test('nobody signed in anywhere: the sign-in screen, then straight in', async () => {
    const impl = fakeImpl({ screenUser: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'key-1' } });
    const r = await connect(makeHub(env), app);
    expect([r.state, app.email], ['in', 'ann@example.test']);
    expect(r.me.email, 'ann@example.test');
    expect(impl.closed, 1, 'the screen is taken down');
  });
  await test('signed in to the hub already: the app signs in with the key and no screen', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'key-1' } });
    expect((await connect(makeHub(env), app)).state, 'in');
    expect(app.signIns, [{ email: 'ann@example.test', password: 'key-1' }]);
    ok(!impl.calls.includes('screen'));
  });
  await test('the note says signed in but the hub\'s own session is gone: it asks again', async () => {
    const impl = fakeImpl({ user: null, screenUser: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'key-1' } });
    expect((await connect(makeHub(env), app)).state, 'in');
    ok(impl.calls.includes('screen'));
  });
  await test('no key for this app: none, with the no-access card', async () => {
    const impl = fakeImpl({ user: ANN, keys: {} });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth();
    expect((await connect(makeHub(env), app)).state, 'none');
    expect(impl.cards, [{ kind: 'none', title: 'Some app' }]);
    expect(app.signIns, []);
  });
  await test('the hub refuses the key read (a disabled person): none', async () => {
    const impl = fakeImpl({ user: ANN, readFails: Object.assign(new Error('403'), { status: 403 }) });
    const env = setupEnv({ note: userNote(), impl });
    expect((await connect(makeHub(env), fakeAppAuth())).state, 'none');
  });
  await test('the app refuses the key: broken, and it does not hammer the app', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: { k: 'stale-key', email: 'ann@example.test' } } });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'something-else' } });
    expect((await connect(makeHub(env), app)).state, 'broken');
    expect(app.signIns.length, 1, 'one try per key');
    expect(impl.cards[0].kind, 'broken');
  });
  await test('the app refuses the key: the person links their old login themselves, and is in', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: { k: 'the-key', email: 'ann@example.test' } } });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'her-old-password' } });
    // What the impl's link screen does once she has typed her old password: the account takes the key.
    impl.linkScreen = async (info) => { impl.calls.push(`link:${info.project}`); app.accounts['ann@example.test'] = 'the-key'; return true; };
    const env = setupEnv({ note: userNote(), impl });
    expect((await connect(makeHub(env), app)).state, 'in');
    ok(impl.calls.includes(`link:${P}`), 'the link screen was shown');
    expect(app.signIns.map((s) => s.password), ['the-key', 'the-key'], 'refused once, then in with the same key');
    expect(impl.cards, [], 'no card');
  });
  await test('a key being replaced: the old one is refused, the new one works', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: { k: 'old-key', next: 'new-key', email: 'ann@example.test' } } });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'new-key' } });
    expect((await connect(makeHub(env), app)).state, 'in');
    expect(app.signIns.map((s) => s.password), ['old-key', 'new-key']);
  });
  await test('a key replaced between the read and the sign-in: read once more', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: [{ k: 'old-key', email: 'ann@example.test' }, { k: 'new-key', email: 'ann@example.test' }] } });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'new-key' } });
    expect((await connect(makeHub(env), app)).state, 'in');
    expect(app.signIns.map((s) => s.password), ['old-key', 'new-key']);
  });
  await test('the hub\'s code cannot be fetched: unreachable, and the app\'s own form is shown', async () => {
    const env = setupEnv({ loadFails: true });
    const app = fakeAppAuth();
    expect((await connect(makeHub(env), app)).state, 'unreachable');
    expect(app.legacyShown, 1);
  });
  await test('...and a signed-in device is not troubled by that at all', async () => {
    const env = setupEnv({ note: userNote(), loadFails: true });
    expect((await connect(makeHub(env), fakeAppAuth({ email: 'ann@example.test' }))).state, 'in');
  });
  await test('no connection while signing the app in: unreachable, not broken', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'key-1' } });
    app.fail = fb('auth/network-request-failed');
    expect((await connect(makeHub(env), app)).state, 'unreachable');
    expect(app.legacyShown, 1);
    expect(impl.cards, [], 'no "broken" card for a dropped connection');
  });
  await test('with no form of its own to fall back to, the app gets the hub\'s "cannot reach" card', async () => {
    const impl = fakeImpl({ user: ANN, readFails: fb('unavailable') });
    const env = setupEnv({ note: userNote(), impl });
    const app = fakeAppAuth();
    const r = await makeHub(env).connect({ project: P, title: 'Some app', session: app.session, signIn: app.signIn, signOut: app.signOut });
    expect(r.state, 'unreachable');
    expect(impl.cards[0].kind, 'unreachable');
  });
  await test('a failed fetch of the hub\'s code is tried again next time', async () => {
    const impl = fakeImpl({ user: ANN, keys: { [P]: { k: 'key-1', email: 'ann@example.test' } } });
    const env = setupEnv({ note: userNote(), impl, loadFails: true });
    const hub = makeHub(env);
    const app = fakeAppAuth({ accounts: { 'ann@example.test': 'key-1' } });
    expect((await connect(hub, app)).state, 'unreachable');
    env.loadImpl = async () => impl;
    expect((await connect(hub, app)).state, 'in');
  });

  // -------------------------------------------------------------------------
  setGroup('signing out, and other tabs');
  await test('sign-out leaves the mark even when the hub cannot be reached', async () => {
    const env = setupEnv({ note: userNote(), loadFails: true });
    const hub = makeHub(env);
    const seen = [];
    hub.onChange((me) => seen.push(me));
    await hub.signOut();
    expect(readNote(env.get(NOTE)).kind, 'out');
    expect(seen, [null]);
    expect(hub.me(), null);
  });
  await test('a change in another tab is passed on', async () => {
    const env = setupEnv({ note: userNote(), impl: fakeImpl() });
    const hub = makeHub(env);
    const seen = [];
    hub.onChange((me) => seen.push(me?.email ?? null));
    env.store.set(NOTE, outNote());
    env.fireStorage();
    env.store.set(NOTE, userNote({ uid: 'u2', email: 'bob@example.test' }));
    env.fireStorage();
    expect(seen, [null, 'bob@example.test']);
  });

  // -------------------------------------------------------------------------
  setGroup('the daily check');
  await test('checked today: nothing is fetched', async () => {
    const impl = fakeImpl();
    const env = setupEnv({ note: userNote(), impl });
    await connect(makeHub(env), fakeAppAuth({ email: 'ann@example.test' }));
    await env.runIdle();
    expect(env.loads, 0);
  });
  await test('not checked since yesterday, and the hub login is still good: nothing changes', async () => {
    const impl = fakeImpl({ verifyAnswer: 'ok' });
    const env = setupEnv({ note: userNote(), impl, now: T0 + DAY + 1000 });
    await connect(makeHub(env), fakeAppAuth({ email: 'ann@example.test' }));
    await env.runIdle();
    expect(impl.calls, ['verify']);
    expect(readNote(env.get(NOTE)).kind, 'user');
  });
  await test('...and the hub login is gone: the note becomes the signed-out mark', async () => {
    const impl = fakeImpl({ verifyAnswer: 'gone' });
    const env = setupEnv({ note: userNote(), impl, now: T0 + DAY + 1000 });
    const hub = makeHub(env);
    const seen = [];
    hub.onChange((me) => seen.push(me));
    await connect(hub, fakeAppAuth({ email: 'ann@example.test' }));
    await env.runIdle();
    expect(readNote(env.get(NOTE)).kind, 'out');
    expect(seen, [null]);
  });
  await test('offline: the check waits', async () => {
    const impl = fakeImpl({ verifyAnswer: 'gone' });
    const env = setupEnv({ note: userNote(), impl, now: T0 + 3 * DAY, online: false });
    await connect(makeHub(env), fakeAppAuth({ email: 'ann@example.test' }));
    await env.runIdle();
    expect(env.loads, 0);
  });

  // -------------------------------------------------------------------------
  setGroup('the switcher button');
  const slotOf = (env) => env.document.createElement('span');
  await test('drawn for a login with two apps, and it opens the hub\'s menu', async () => {
    const impl = fakeImpl();
    const env = setupEnv({ note: userNote({ apps: { a: 'manager', b: 'floor' } }), impl });
    const slot = slotOf(env);
    makeHub(env).switcher(slot, { current: 'a' });
    expect(slot.children.length, 1);
    expect(slot.children[0].attrs['aria-label'], 'Apps');
    await slot.children[0].listeners.click();
    expect(impl.calls, ['switcher:a']);
  });
  await test('its code is fetched once, when the page is idle, and the sign-in is left alone', async () => {
    const impl = fakeImpl();
    const env = setupEnv({ note: userNote({ apps: { a: 'manager', b: 'floor' } }), impl });
    const hub = makeHub(env);
    hub.switcher(slotOf(env), { current: 'a' });
    expect(impl.calls, [], 'nothing before the page is idle');
    hub.switcher(slotOf(env), { current: 'a' });
    await env.runIdle();
    expect(impl.calls, ['warm'], 'once, and nothing else');
    // One app, or nobody: no button, so nothing is fetched.
    const quiet = fakeImpl();
    const one = setupEnv({ note: userNote({ apps: { a: 'floor' } }), impl: quiet });
    makeHub(one).switcher(slotOf(one));
    await one.runIdle();
    expect(quiet.calls, []);
  });
  await test('not drawn for one app, for nobody, or when signed out', () => {
    for (const note of [userNote({ apps: { a: 'floor' } }), null, outNote()]) {
      const env = setupEnv({ note, impl: fakeImpl() });
      const slot = slotOf(env);
      makeHub(env).switcher(slot);
      expect(slot.children.length, 0);
    }
  });
  await test('not drawn inside one app\'s own home-screen icon; drawn inside the hub\'s', () => {
    const two = userNote({ apps: { a: 'manager', b: 'floor' } });
    const appIcon = setupEnv({ note: two, impl: fakeImpl(), standalone: true });
    const s1 = slotOf(appIcon);
    makeHub(appIcon).switcher(s1);
    expect(s1.children.length, 0);
    const hubIcon = setupEnv({ note: two, impl: fakeImpl(), standalone: true, shell: true });
    const s2 = slotOf(hubIcon);
    makeHub(hubIcon).switcher(s2);
    expect(s2.children.length, 1);
  });
  await test('it comes and goes as the hub sign-in changes', () => {
    const env = setupEnv({ note: userNote({ apps: { a: 'manager', b: 'floor' } }), impl: fakeImpl() });
    const slot = slotOf(env);
    makeHub(env).switcher(slot);
    expect(slot.children.length, 1);
    env.store.set(NOTE, outNote());
    env.fireStorage();
    expect(slot.children.length, 0);
  });
}
