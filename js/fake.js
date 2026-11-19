// fake.js - a hub and a set of apps held in memory, behaving as Firebase
// does wherever the linking code depends on it. Two uses:
//
//   THE TESTS drive js/linking.js against it, including a tab closing halfway
//   through any step (a "trap").
//   THE DEMO is the hub page with no Firebase project behind it: until the
//   hub's config is filled in (core/v1/hub-impl.js) the page runs on this,
//   with invented people, so every screen can be looked at and tried.
//
// What it imitates, because the code relies on it:
//   - a project that makes accounts from a browser, and one that does not;
//   - "that address already has a user", and a wrong password, under the
//     codes Firebase uses for them;
//   - the hub's rules: a master writes, a person reads only their own key,
//     a disabled person reads none;
//   - an app's rules: its lists are read by a listed account and changed by
//     one of ITS masters, and cannot be changed when the document is missing.
//
// Every person and address in here is invented. The repo is public.

import { HubError } from './errors.js';
import { tidyEmail, newKey } from './keys.js';
import { applyOps, isMaster, listed } from './access.js';
import { PROJECTS } from './registry.js';

/** An error shaped like one of Firebase's. */
const fb = (code) => Object.assign(new Error(code), { code });
const clone = (v) => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function makeWorld() {
  return {
    seq: 0,
    now: '2026-11-16T00:00:00.000Z',
    hub: { users: {}, people: {}, keys: {}, self: {}, masters: [], log: [], session: null },
    apps: {},
    joined: {},
    traps: [],
  };
}

const nextUid = (world, prefix = 'u') => `${prefix}${String(++world.seq).padStart(3, '0')}`;

export function addProject(world, pid, { model = PROJECTS[pid]?.access ?? null, signUp = true, access = null, joined = true } = {}) {
  world.apps[pid] = { model, signUp, users: {}, access: clone(access), drops: 0 };
  world.joined[pid] = joined;
}

export function addHubLogin(world, email, password) {
  const uid = nextUid(world);
  world.hub.users[tidyEmail(email)] = { uid, password, disabled: false };
  return uid;
}

export function addAppLogin(world, pid, email, password) {
  const uid = nextUid(world, 'a');
  world.apps[pid].users[tidyEmail(email)] = { uid, password };
  return uid;
}

/**
 * Make a port method fail once, as a tab closing or the network dropping
 * would. `after: true` lets the step take effect first and then fails, which
 * is the awkward case: the thing happened and the code never heard.
 */
export function trap(world, name, { kind = 'network', after = false, times = 1 } = {}) {
  world.traps.push({ name, kind, after, times });
}

function guarded(world, prefix, port, onChange) {
  const out = {};
  for (const [name, fn] of Object.entries(port)) {
    if (typeof fn !== 'function' || name === 'now' || name === 'me') { out[name] = fn; continue; }
    out[name] = async (...args) => {
      const t = world.traps.find((x) => x.name === `${prefix}.${name}` && x.times > 0);
      if (t && !t.after) { t.times -= 1; throw new HubError(t.kind, `${prefix}.${name} did not go through`); }
      const r = await fn(...args);
      onChange?.();
      if (t && t.after) { t.times -= 1; throw new HubError(t.kind, `${prefix}.${name} went through, and then the tab closed`); }
      return r;
    };
  }
  return out;
}

/** The hub port (js/linking.js), acting as the hub login `as`. */
export function fakeHub(world, { as, onChange = null } = {}) {
  const h = world.hub;
  const emailOf = (uid) => Object.entries(h.users).find(([, u]) => u.uid === uid)?.[0] ?? '';
  const master = () => h.masters.includes(as);
  const member = (uid) => Boolean(h.people[uid]) && !h.people[uid].disabled;
  const need = (ok) => { if (!ok) throw fb('permission-denied'); };
  return guarded(world, 'hub', {
    // The tests run on a fixed clock; the demo on the wall clock, so what is done now is dated now.
    now: () => (world.live ? new Date().toISOString() : world.now),
    me: () => ({ uid: as, email: emailOf(as) }),
    isMaster: async () => master(),
    getKey: async (uid, pid) => { need(master() || (uid === as && member(as))); return clone(h.keys[uid]?.[pid] ?? null); },
    putKey: async (uid, pid, key) => {
      need(master());
      if (typeof key?.k !== 'string' || key.k.length < 32) throw fb('permission-denied');
      (h.keys[uid] ??= {})[pid] = clone(key);
    },
    deleteKey: async (uid, pid) => { need(master()); if (h.keys[uid]) delete h.keys[uid][pid]; },
    listKeys: async (uid) => { need(master()); return clone(h.keys[uid] ?? {}); },
    listPeople: async () => { need(master()); return Object.entries(h.people).map(([uid, p]) => ({ uid, ...clone(p) })); },
    getPerson: async (uid) => { need(master() || uid === as); return h.people[uid] ? { uid, ...clone(h.people[uid]) } : null; },
    createPerson: async (uid, data) => { need(master()); if (h.people[uid]) throw fb('already-exists'); h.people[uid] = clone(data); },
    patchPerson: async (uid, patch) => {
      need(master());
      if (!h.people[uid]) throw fb('not-found');
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete h.people[uid][k]; else h.people[uid][k] = clone(v); }
    },
    deletePerson: async (uid) => { need(master()); delete h.people[uid]; },
    setLink: async (uid, pid, link) => {
      need(master());
      if (!h.people[uid]) throw fb('not-found');
      const links = (h.people[uid].links ??= {});
      if (link === null) delete links[pid]; else links[pid] = clone(link);
    },
    createLogin: async (email, password) => {
      const e = tidyEmail(email);
      if (h.users[e]) throw fb('auth/email-already-in-use');
      const uid = nextUid(world);
      h.users[e] = { uid, password, disabled: false };
      return uid;
    },
    checkLogin: async (email, password) => {
      const u = h.users[tidyEmail(email)];
      if (!u || u.password !== password) throw fb('auth/invalid-credential');
      return u.uid;
    },
    log: async (entry) => { need(master()); h.log.unshift(clone(entry)); },
    listLog: async (n = 50) => { need(master()); return clone(h.log.slice(0, n)); },
    // A person's own record (tiles, apps they linked themselves): theirs to write, a master's to read.
    getSelf: async (uid) => { need(master() || (uid === as && member(as))); return clone((h.self ??= {})[uid] ?? null); },
    setSelf: async (uid, patch) => {
      need(uid === as && member(as));
      const next = { ...((h.self ??= {})[uid] ?? {}), ...clone(patch) };
      if (Object.keys(next).some((k) => !['tiles', 'linked', 'at'].includes(k))) throw fb('permission-denied');
      if (next.tiles && Object.keys(next.tiles).some((k) => !['order', 'hidden'].includes(k))) throw fb('permission-denied');
      h.self[uid] = next;
    },
    listSelf: async () => { need(master()); return clone(h.self ??= {}); },
  }, onChange);
}

/**
 * The app port (js/linking.js) for one project. `as` is the address the
 * acting master is signed in to THAT app as, or null when they are not linked
 * to it: account steps work either way, the lists do not.
 */
export function fakeApp(world, pid, { as = null, onChange = null } = {}) {
  const a = world.apps[pid];
  if (!a) throw new Error(`No such project in this world: ${pid}`);
  const me = tidyEmail(as);
  const check = (email, password) => {
    const u = a.users[tidyEmail(email)];
    if (!u || u.password !== password) throw fb('auth/invalid-credential');
    return u;
  };
  return {
    projectId: pid,
    title: PROJECTS[pid]?.title ?? pid,
    ...guarded(world, 'app', {
      create: async (email, password) => {
        if (!a.signUp) throw fb('auth/admin-restricted-operation');
        const e = tidyEmail(email);
        if (a.users[e]) throw fb('auth/email-already-in-use');
        a.users[e] = { uid: nextUid(world, 'a'), password };
      },
      check: async (email, password) => { check(email, password); },
      changePassword: async (email, current, next) => {
        const u = check(email, current);
        u.password = next;
        a.drops += 1;                       // every other session of this account is revoked
      },
      readAccess: async () => {
        if (!me) throw new HubError('not-linked', 'You are not linked to that app yourself.');
        if (!a.access || !a.model || a.model.fixed) return null;
        if (!listed(a.model, a.access).includes(me)) throw fb('permission-denied');
        return clone(a.access);
      },
      listOps: async (ops) => {
        if (!me) throw new HubError('not-linked', 'You are not linked to that app yourself.');
        if (!a.access) throw fb('not-found');
        if (!isMaster(a.model, a.access, me)) throw fb('permission-denied');
        a.access = applyOps(a.access, ops);
      },
    }, onChange),
  };
}

// ---------------------------------------------------------------------------
// the demo: an invented workshop
// ---------------------------------------------------------------------------

const BOARD = 'production-scheduling-stella';
const ORDERING = 'material-ordering-41851';
const ORDERING_TEST = 'material-ordering-testing';
const DESIGN = 'stella-design-scheduling';
const DRAWINGS = 'stella-workshop-drawings';

export const DEMO_PASSWORD = 'demo';

/**
 * Six invented people across the four apps, with one of every situation the
 * Accounts screen has to show: linked with a role, linked with none, an old
 * login not yet taken over, an address on a list that has no login at all, an
 * app that has not joined, and an app whose roles the hub cannot edit.
 */
export function demoWorld() {
  const w = makeWorld();
  addProject(w, BOARD, { access: { managers: [], engineers: [], floor: [], testers: [], masters: [] } });
  addProject(w, ORDERING, { access: { managers: [], engineers: [], floor: [], masters: [] } });
  addProject(w, ORDERING_TEST, { access: { managers: [], engineers: [], floor: [], masters: [] }, joined: false });
  addProject(w, DESIGN, { access: { leads: [], designers: [], contributors: [], managers: [], masters: [] } });
  addProject(w, DRAWINGS, { signUp: false });

  const person = (name, email, links) => {
    const e = tidyEmail(email);
    const uid = addHubLogin(w, e, DEMO_PASSWORD);
    const entry = { email: e, name, links: {}, disabled: false, createdAt: w.now, createdBy: 'setup' };
    for (const [pid, role] of Object.entries(links)) {
      if (role === 'plain') { entry.links[pid] = { plain: true, at: w.now, by: 'setup' }; continue; }
      const k = newKey();
      (w.hub.keys[uid] ??= {})[pid] = { k, email: e, at: w.now, by: 'setup' };
      addAppLogin(w, pid, e, k);
      entry.links[pid] = { linked: true, role: role === 'linked' ? null : role, at: w.now, by: 'setup' };
      const model = w.apps[pid].model;
      if (model && !model.fixed && role !== 'linked') {
        const list = model.roles.find((r) => r.id === role).list;
        w.apps[pid].access[list].push(e);
      }
    }
    w.hub.people[uid] = entry;
    return uid;
  };

  const alex = person('Alex Morgan', 'alex@example.test', { [BOARD]: 'manager', [ORDERING]: 'manager', [DESIGN]: 'lead', [DRAWINGS]: 'linked', [ORDERING_TEST]: 'plain' });
  const sam = person('Sam Lee', 'sam@example.test', { [BOARD]: 'manager', [ORDERING]: 'manager' });
  person('Riley Chen', 'riley@example.test', { [DESIGN]: 'designer', [BOARD]: 'engineer', [DRAWINGS]: 'linked' });
  person('Workshop floor', 'workshop@example.test', { [BOARD]: 'floor', [ORDERING]: 'floor', [DRAWINGS]: 'linked' });
  person('Jordan Park', 'jordan@example.test', {});
  person('Pat Quinn', 'pat@example.test', { [ORDERING]: 'linked' });

  // Pat is on the board's floor list with a login from before the hub, not yet taken over.
  w.apps[BOARD].access.floor.push('pat@example.test');
  addAppLogin(w, BOARD, 'pat@example.test', 'old-password');
  // An address on a list that has no login anywhere: the case that matters.
  w.apps[ORDERING].access.floor.push('stores@example.test');
  // And one the hub has never heard of, with an old login.
  w.apps[DESIGN].access.contributors.push('casey@example.test');
  addAppLogin(w, DESIGN, 'casey@example.test', 'old-password');

  // Sam has a design scheduling login from before the hub: given Designer, and
  // WAITING to link it himself the first time he opens it (its password is
  // old-password; the key it becomes is already saved).
  addAppLogin(w, DESIGN, 'sam@example.test', 'old-password');
  (w.hub.keys[sam] ??= {})[DESIGN] = { k: newKey(), email: 'sam@example.test', at: w.now, by: 'setup' };
  w.hub.people[sam].links[DESIGN] = { waiting: true, role: 'designer', at: w.now, by: 'setup' };
  w.apps[DESIGN].access.designers.push('sam@example.test');

  for (const pid of [BOARD, ORDERING, DESIGN]) w.apps[pid].access.masters = ['alex@example.test'];
  w.hub.masters = [alex];
  w.hub.session = alex;
  w.hub.log = [
    { at: '2026-11-13T04:10:00.000Z', by: alex, byEmail: 'alex@example.test', action: 'role', text: 'riley@example.test is now Designer in Design scheduling.' },
    { at: '2026-11-13T04:08:00.000Z', by: alex, byEmail: 'alex@example.test', action: 'link', text: 'riley@example.test linked to Design scheduling.' },
    { at: '2026-11-12T23:30:00.000Z', by: alex, byEmail: 'alex@example.test', action: 'person', text: 'jordan@example.test added.' },
  ];
  return w;
}

const DEMO_KEY = 'stella.hub.demo.v1';

/** The one demo world of this page, kept across reloads. However many copies of this module the page loads, they share it. */
export function demo() {
  if (globalThis.__stellaHubDemo) return globalThis.__stellaHubDemo;
  let w = null;
  try { w = JSON.parse(globalThis.localStorage?.getItem(DEMO_KEY) ?? 'null'); } catch { w = null; }
  if (!w?.hub || !w?.apps) w = demoWorld();
  // Models are code, not data: take them from the registry on every load.
  for (const [pid, a] of Object.entries(w.apps)) a.model = PROJECTS[pid]?.access ?? null;
  w.traps = [];
  w.live = true;
  globalThis.__stellaHubDemo = w;
  return w;
}

export function saveDemo() {
  const w = globalThis.__stellaHubDemo;
  if (!w) return;
  try { globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify({ ...w, traps: [] })); } catch { /* a private window forgets on close */ }
}

export function resetDemo() {
  try { globalThis.localStorage?.removeItem(DEMO_KEY); } catch { /* nothing kept */ }
  globalThis.__stellaHubDemo = null;
  return demo();
}

/**
 * The hub's sign-in, for the demo: the same shape the core's Firebase
 * provider has (core/v1/hub-impl.js), over the demo world.
 */
export function demoProvider() {
  const w = demo();
  const h = w.hub;
  const emailOf = (uid) => Object.entries(h.users).find(([, u]) => u.uid === uid)?.[0] ?? '';
  const current = () => (h.session && h.people[h.session] ? { uid: h.session, email: emailOf(h.session) } : null);
  return {
    demo: true,
    joined: () => ({ ...w.joined }),
    ready: async () => {},
    current,
    signIn: async (email, password) => {
      const u = h.users[tidyEmail(email)];
      if (!u || u.password !== password) throw fb('auth/invalid-credential');
      h.session = u.uid;
      saveDemo();
      return current();
    },
    signOut: async () => { h.session = null; saveDemo(); },
    sendReset: async () => {},
    changePassword: async (currentPassword, next) => {
      const u = h.users[emailOf(h.session)];
      if (!u || u.password !== currentPassword) throw fb('auth/invalid-credential');
      u.password = next;
      saveDemo();
    },
    verify: async () => (current() ? 'ok' : 'gone'),
    readPerson: async (uid) => (h.people[uid] ? { uid, ...clone(h.people[uid]) } : null),
    isMaster: async (uid) => h.masters.includes(uid),
    readKey: async (uid, pid) => {
      if (uid !== h.session || !h.people[uid] || h.people[uid].disabled) throw fb('permission-denied');
      return clone(h.keys[uid]?.[pid] ?? null);
    },
    // Link your existing login: the password typed, swapped for the key, in that app.
    swapPassword: async ({ project, email, current, next }) => {
      const u = w.apps[project]?.users[tidyEmail(email)];
      if (!u || u.password !== current) throw fb('auth/invalid-credential');
      u.password = next;
      w.apps[project].drops += 1;
      saveDemo();
    },
    markLinked: async (uid, project) => {
      if (uid !== h.session) throw fb('permission-denied');
      const me = ((h.self ??= {})[uid] ??= {});
      (me.linked ??= {})[project] = new Date().toISOString();
      saveDemo();
    },
  };
}

// ---------------------------------------------------------------------------
// demo overview cards: what an app's own card module would return
// ---------------------------------------------------------------------------

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Invented card data per project. One is slow and one fails, on purpose. */
export const DEMO_CARDS = {
  [BOARD]: async () => ({
    title: 'Next due',
    href: '/Production-Scheduling/',
    items: [
      { title: 'P90014 · Example 62', sub: 'Stern lifter', when: 'Fri 13 Nov', late: true, href: '/Production-Scheduling/' },
      { title: 'P90011 · Example 55', sub: 'Davit, port side', when: 'Mon 23 Nov', href: '/Production-Scheduling/' },
      { title: 'P90017 · Example 70', sub: 'Tender launcher', when: 'Fri 27 Nov', href: '/Production-Scheduling/' },
    ],
  }),
  [ORDERING]: async ({ role }) => {
    await wait(1400);
    if (role !== 'manager') return null;
    return {
      title: 'Orders waiting',
      count: 3,
      href: '/material-ordering/manager.html',
      items: [
        // Oldest first: the one that has waited longest is the one to see, and it is marked.
        { title: 'Welding wire, 3 spools', sub: 'Fabrication bay', when: 'Yesterday', late: true, href: '/material-ordering/manager.html' },
        { title: 'M12 bolts, 1 box', sub: 'Assembly', when: '2 h ago', href: '/material-ordering/manager.html' },
        { title: '6 mm plate, 2 sheets', sub: 'Fabrication bay', when: '40 min ago', href: '/material-ordering/manager.html' },
      ],
    };
  },
  [DESIGN]: async ({ role }) => (role === 'lead' ? {
    title: 'Ready for check',
    count: 2,
    href: '/design-scheduling/',
    items: [
      { title: 'Example lifter R3, drawings', sub: 'Riley Chen', when: '1 d', href: '/design-scheduling/' },
      { title: 'Davit base plate, laser files', sub: 'Riley Chen', when: '3 h', href: '/design-scheduling/' },
    ],
  } : {
    title: 'Your tasks',
    count: 4,
    href: '/design-scheduling/',
    items: [
      { title: 'Example lifter R3, build form', sub: 'In progress', when: 'Thu 19 Nov', href: '/design-scheduling/' },
      { title: 'Davit base plate, drawings', sub: 'In progress', when: 'Fri 20 Nov', href: '/design-scheduling/' },
      { title: 'Tender launcher, 3D model', sub: 'Not started', when: 'Wed 25 Nov', href: '/design-scheduling/' },
    ],
  }),
  [DRAWINGS]: async () => { await wait(300); throw new Error('The drawings card could not be read.'); },
};
