// run.js - the tests. One suite, run two ways: `node tests/node.mjs`, and
// /tests/ in a browser with the local server up. Pure logic only: nothing
// here loads Firebase, and every person and address is invented.

import { newKey, tempPassword, tidyEmail, isEmail, tidyList } from '../js/keys.js';
import { HubError, kindOf, friendly } from '../js/errors.js';
import * as A from '../js/access.js';
import { PROJECTS, problems, tilesFor, homeFor } from '../js/registry.js';
import * as L from '../js/linking.js';
import { buildGrid, looseCount, appsFromLinks, staleLinks, claimedLinks } from '../js/matrix.js';
import { makeWorld, addProject, addHubLogin, addAppLogin, trap, fakeHub, fakeApp, demoWorld } from '../js/fake.js';
import { coreTests } from './core.js';
import { normaliseCard, sitePath, loadCard } from '../js/cards.js';
import { arrange, effective, moved, toggled, tidyPrefs } from '../js/tiles.js';
import { decodeDoc } from '../core/v1/hub-impl.js';

const results = [];
let group = '';
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function test(name, fn) {
  try {
    await fn();
    results.push({ group, name, pass: true });
  } catch (e) {
    results.push({ group, name, pass: false, detail: e?.stack ?? e?.message ?? String(e) });
  }
}
function expect(actual, expected, what = '') {
  if (!eq(actual, expected)) throw new Error(`${what ? what + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || 'expected true'); }
/** The kind of error a step fails with; fails the test when it does not fail. */
async function failsWith(fn) {
  try { await fn(); } catch (e) { return kindOf(e); }
  throw new Error('expected it to fail, and it did not');
}

/** Repeatable "randomness": every call gives different bytes, the same ones each run. */
function makeFill() {
  let n = 7;
  return (bytes) => { for (let i = 0; i < bytes.length; i += 1) { n = (n * 73 + 41) % 251; bytes[i] = n; } return bytes; };
}

const BOARD = 'production-scheduling-stella';
const ORDERING = 'material-ordering-41851';
const ORDERING_TEST = 'material-ordering-testing';
const DESIGN = 'stella-design-scheduling';
const DRAWINGS = 'stella-workshop-drawings';
const BOSS = 'boss@example.test';

/** A small world: a master, the board and design scheduling with lists, drawings with fixed roles and no sign-up. */
function setup() {
  const w = makeWorld();
  addProject(w, BOARD, { access: { managers: [BOSS], engineers: [], floor: [], testers: [], masters: [] } });
  addProject(w, DESIGN, { access: { leads: [BOSS], designers: [], contributors: [], managers: [], masters: [BOSS] } });
  addProject(w, DRAWINGS, { signUp: false });
  const boss = addHubLogin(w, BOSS, 'pw-boss');
  w.hub.masters = [boss];
  w.hub.people[boss] = { email: BOSS, name: 'Boss', links: {}, disabled: false, createdAt: w.now, createdBy: 'setup' };
  const fill = makeFill();
  const hub = fakeHub(w, { as: boss });
  const app = (pid, as = BOSS) => fakeApp(w, pid, { as });
  const add = async (email, name = '') => {
    const { uid } = await L.createPerson({ hub, email, name, fill });
    return hub.getPerson(uid);
  };
  const again = (p) => hub.getPerson(p.uid);
  return { w, boss, fill, hub, app, add, again };
}

export async function run() {
  // -------------------------------------------------------------------------
  group = 'keys';
  await test('an app key is 43 URL-safe characters and never the same twice', () => {
    const a = newKey();
    const b = newKey();
    ok(/^[A-Za-z0-9_-]{43}$/.test(a), a);
    ok(a !== b, 'two keys were equal');
  });
  await test('a temporary password reads aloud: three groups of four, no lookalikes', () => {
    for (let i = 0; i < 50; i += 1) ok(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/.test(tempPassword()), 'shape');
  });
  await test('addresses are tidied the way the rules read them', () => {
    expect(tidyEmail('  Sam@Example.TEST '), 'sam@example.test');
    ok(isEmail('sam@example.test') && !isEmail('sam@example') && !isEmail('sam example@x.y'));
    expect(tidyList([' A@x.test', 'a@x.test', '', null, 'b@x.test']), ['a@x.test', 'b@x.test']);
  });

  // -------------------------------------------------------------------------
  group = 'errors';
  await test('a wrong password is one kind, whatever the SDK calls it', () => {
    for (const code of ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found']) {
      expect(kindOf({ code }), 'credential', code);
    }
  });
  await test('sign-up switched off is recognised under both of its codes', () => {
    expect(kindOf({ code: 'auth/operation-not-allowed' }), 'signup-off');
    expect(kindOf({ code: 'auth/admin-restricted-operation' }), 'signup-off');
  });
  await test('the other kinds', () => {
    expect(kindOf({ code: 'auth/email-already-in-use' }), 'exists');
    expect(kindOf({ code: 'auth/too-many-requests' }), 'throttle');
    expect(kindOf({ code: 'auth/network-request-failed' }), 'network');
    expect(kindOf({ code: 'permission-denied' }), 'denied');
    expect(kindOf({ code: 'auth/user-token-expired' }), 'stale');
    expect(kindOf(new TypeError('Failed to fetch')), 'network');
    expect(kindOf(new HubError('not-linked')), 'not-linked');
    expect(kindOf(new Error('who knows')), 'other');
  });
  await test('nobody is shown a raw Firebase code', () => {
    expect(friendly({ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' }), 'Wrong email or password.');
    expect(friendly(new HubError('self', 'Your own role is changed by another master.')), 'Your own role is changed by another master.');
  });

  // -------------------------------------------------------------------------
  group = 'role lists';
  const board = PROJECTS[BOARD].access;
  const design = PROJECTS[DESIGN].access;
  await test('with no masters listed, the first on the fallback list is the master', () => {
    const doc = { managers: ['a@x.test', 'b@x.test'], engineers: [], floor: [], testers: [], masters: [] };
    expect(A.normalise(board, doc).masters, ['a@x.test']);
    ok(!A.normalise(board, doc).pinned);
    ok(A.isMaster(board, doc, 'A@x.test') && !A.isMaster(board, doc, 'b@x.test'));
    expect(A.normalise(design, { leads: ['l@x.test'] }).masters, ['l@x.test']);
  });
  await test('a listed masters list wins over the fallback', () => {
    const doc = { managers: ['a@x.test'], masters: ['m@x.test'] };
    expect(A.normalise(board, doc).masters, ['m@x.test']);
    ok(A.normalise(board, doc).pinned);
  });
  await test('an address on two lists has the role the app itself would give it', () => {
    expect(A.roleOf(board, { managers: ['a@x.test'], testers: ['a@x.test'] }, 'a@x.test'), 'tester');
    expect(A.roleOf(design, { designers: ['a@x.test'], managers: ['a@x.test'] }, 'a@x.test'), 'designer');
    expect(A.roleOf(board, { managers: [] }, 'nobody@x.test'), null);
  });
  await test('giving a role adds to one list and takes off the others', () => {
    const doc = { managers: ['a@x.test'], engineers: [], floor: ['a@x.test'], testers: [] };
    expect(A.roleOps(board, doc, 'a@x.test', 'engineer'), [
      { list: 'managers', op: 'remove', email: 'a@x.test' },
      { list: 'engineers', op: 'add', email: 'a@x.test' },
      { list: 'floor', op: 'remove', email: 'a@x.test' },
    ]);
    expect(A.roleOps(board, { managers: ['a@x.test'] }, 'a@x.test', 'manager'), [], 'already right: nothing to do');
    expect(A.roleOps(board, doc, 'a@x.test', null), [
      { list: 'managers', op: 'remove', email: 'a@x.test' },
      { list: 'floor', op: 'remove', email: 'a@x.test' },
    ]);
  });
  await test('an address stored with a capital is replaced by its tidy form', () => {
    const ops = A.roleOps(board, { floor: ['Pat@X.test'] }, 'pat@x.test', 'floor');
    expect(ops, [{ list: 'floor', op: 'remove', email: 'Pat@X.test' }, { list: 'floor', op: 'add', email: 'pat@x.test' }]);
  });
  await test('a role the app does not have is refused', () => {
    let threw = false;
    try { A.roleOps(board, {}, 'a@x.test', 'lead'); } catch { threw = true; }
    ok(threw);
  });
  await test('the default master is pinned once, and only when there is one', () => {
    expect(A.pinOps(board, { managers: ['a@x.test'], masters: [] }), [{ list: 'masters', op: 'add', email: 'a@x.test' }]);
    expect(A.pinOps(board, { managers: ['a@x.test'], masters: ['a@x.test'] }), []);
    expect(A.pinOps(board, { managers: [] }), []);
  });
  await test('two masters changing different people both keep their change', () => {
    const start = { managers: ['boss@x.test'], engineers: [], floor: [], testers: [] };
    const one = A.roleOps(board, start, 'ann@x.test', 'floor');       // both worked from the same old copy
    const two = A.roleOps(board, start, 'bob@x.test', 'engineer');
    const end = A.applyOps(A.applyOps(start, one), two);
    expect(end.floor, ['ann@x.test']);
    expect(end.engineers, ['bob@x.test']);
    expect(end.managers, ['boss@x.test']);
  });
  await test('operations become one write, or two when a list is both added to and taken from', () => {
    expect(A.opsToPatches(A.roleOps(board, { managers: ['a@x.test'] }, 'a@x.test', 'engineer')), [
      { engineers: { add: ['a@x.test'] }, managers: { remove: ['a@x.test'] } },
    ]);
    expect(A.opsToPatches(A.roleOps(board, { floor: ['Pat@X.test'] }, 'pat@x.test', 'floor')), [
      { floor: { add: ['pat@x.test'] } },
      { floor: { remove: ['Pat@X.test'] } },
    ], 'the add goes first, so the person is never off the list');
    expect(A.opsToPatches([]), []);
  });
  await test('rows: everyone listed, with role and master', () => {
    expect(A.rows(design, { leads: ['l@x.test'], designers: ['d@x.test'], masters: ['l@x.test', 'm@x.test'] }), [
      { email: 'd@x.test', role: 'designer', master: false },
      { email: 'l@x.test', role: 'lead', master: true },
      { email: 'm@x.test', role: null, master: true },
    ]);
  });

  // -------------------------------------------------------------------------
  group = 'registry';
  await test('the registry is well formed and holds no address', () => {
    expect(problems(), []);
  });
  await test('a badly formed project is reported', () => {
    const bad = { 'p-one': { ...PROJECTS[BOARD], config: { ...PROJECTS[BOARD].config, projectId: 'p-two' }, group: 'Nowhere' } };
    ok(problems(bad).length >= 2, JSON.stringify(problems(bad)));
  });
  await test('tiles: only what the login has, test projects for masters only', () => {
    const apps = { [BOARD]: 'floor', [ORDERING]: 'manager', [ORDERING_TEST]: 'link' };
    expect(tilesFor(apps).map((t) => t.id), [BOARD, ORDERING]);
    expect(tilesFor(apps, { master: true }).map((t) => t.id), [BOARD, ORDERING, ORDERING_TEST]);
    expect(tilesFor({}), []);
  });
  await test('a tile goes where the role belongs, and shows only that role\'s pages', () => {
    expect(homeFor(ORDERING, 'manager'), '/material-ordering/manager.html');
    expect(homeFor(ORDERING, 'floor'), '/material-ordering/');
    const floor = tilesFor({ [BOARD]: 'floor' })[0];
    expect(floor.pages.map((p) => p.title), ['Parts']);
    const eng = tilesFor({ [BOARD]: 'engineer' }, { current: BOARD })[0];
    expect(eng.pages.map((p) => p.title), ['Parts', 'Vessel codes']);
    ok(eng.current);
  });

  // -------------------------------------------------------------------------
  group = 'linking';
  await test('a new link: key saved, account made with it, link noted', async () => {
    const { w, hub, app, add, fill, again } = setup();
    const p = await add('ann@example.test', 'Ann');
    expect(await L.ensureLink({ hub, app: app(BOARD), person: p, fill }), { status: 'linked', how: 'made' });
    const key = w.hub.keys[p.uid][BOARD];
    expect(w.apps[BOARD].users['ann@example.test'].password, key.k);
    expect(key.email, 'ann@example.test');
    ok((await again(p)).links[BOARD].linked);
  });
  await test('running it again finds the same link and changes nothing', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    const k1 = w.hub.keys[p.uid][BOARD].k;
    expect(await L.ensureLink({ hub, app: app(BOARD), person: p, fill }), { status: 'linked', how: 'found' });
    expect(w.hub.keys[p.uid][BOARD].k, k1);
  });
  await test('the tab closes after the key is saved: the next run uses that key', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    trap(w, 'hub.putKey', { after: true });
    expect(await failsWith(() => L.ensureLink({ hub, app: app(BOARD), person: p, fill })), 'network');
    ok(!w.apps[BOARD].users['ann@example.test'], 'no account yet');
    const k1 = w.hub.keys[p.uid][BOARD].k;
    expect((await L.ensureLink({ hub, app: app(BOARD), person: p, fill })).how, 'made');
    expect(w.apps[BOARD].users['ann@example.test'].password, k1);
  });
  await test('the tab closes after the account is made: the next run finds it', async () => {
    const { w, hub, app, add, fill, again } = setup();
    const p = await add('ann@example.test');
    trap(w, 'app.create', { after: true });
    await failsWith(() => L.ensureLink({ hub, app: app(BOARD), person: p, fill }));
    ok(!(await again(p)).links[BOARD], 'not noted yet');
    expect(await L.ensureLink({ hub, app: app(BOARD), person: p, fill }), { status: 'linked', how: 'found' });
    ok((await again(p)).links[BOARD].linked);
  });
  await test('an old login with its own password is reported, not touched', async () => {
    const { w, hub, app, add, fill, again } = setup();
    addAppLogin(w, BOARD, 'old@example.test', 'old-pw');
    const p = await add('old@example.test');
    expect(await L.ensureLink({ hub, app: app(BOARD), person: p, fill }), { status: 'legacy' });
    expect(w.apps[BOARD].users['old@example.test'].password, 'old-pw');
    ok(!(await again(p)).links[BOARD]);
  });
  await test('taking over needs the current password, and then the key is the password', async () => {
    const { w, hub, app, add, fill, again } = setup();
    const uidBefore = addAppLogin(w, BOARD, 'old@example.test', 'old-pw');
    const p = await add('old@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    expect(await failsWith(() => L.takeOver({ hub, app: app(BOARD), person: p, currentPassword: 'guess', fill })), 'credential');
    expect(w.apps[BOARD].users['old@example.test'].password, 'old-pw');
    expect(await L.takeOver({ hub, app: app(BOARD), person: p, currentPassword: 'old-pw', fill }), { status: 'linked', how: 'taken' });
    const u = w.apps[BOARD].users['old@example.test'];
    expect(u.password, w.hub.keys[p.uid][BOARD].k);
    expect(u.uid, uidBefore, 'the account keeps its uid');
    expect(w.apps[BOARD].drops, 1, 'its old sessions are revoked');
    ok((await again(p)).links[BOARD].linked);
  });
  await test('a project with sign-up off: the key is handed over for the console', async () => {
    const { w, hub, app, add, fill, again } = setup();
    const p = await add('ann@example.test');
    const r = await L.ensureLink({ hub, app: app(DRAWINGS), person: p, fill });
    expect(r.status, 'console');
    expect(r.key, w.hub.keys[p.uid][DRAWINGS].k);
    addAppLogin(w, DRAWINGS, 'ann@example.test', r.key);            // what "Add user" in the console does
    expect(await L.ensureLink({ hub, app: app(DRAWINGS), person: p, fill }), { status: 'linked', how: 'found' });
    ok((await again(p)).links[DRAWINGS].linked);
  });
  await test('an old login in a sign-up-off project can still be taken over', async () => {
    const { w, hub, app, add, fill } = setup();
    addAppLogin(w, DRAWINGS, 'old@example.test', 'old-pw');
    const p = await add('old@example.test');
    expect((await L.ensureLink({ hub, app: app(DRAWINGS), person: p, fill })).status, 'console');
    await L.takeOver({ hub, app: app(DRAWINGS), person: p, currentPassword: 'old-pw', fill });
    expect(w.apps[DRAWINGS].users['old@example.test'].password, w.hub.keys[p.uid][DRAWINGS].k);
  });
  await test('a failure that is not about the account is passed on', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    trap(w, 'app.create', { kind: 'throttle' });
    expect(await failsWith(() => L.ensureLink({ hub, app: app(BOARD), person: p, fill })), 'throttle');
  });

  // -------------------------------------------------------------------------
  group = 'rotate and hand back';
  await test('rotate: a new key, the old one dead, sessions dropped', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    const k1 = w.hub.keys[p.uid][BOARD].k;
    await L.rotateLink({ hub, app: app(BOARD), person: p, fill });
    const key = w.hub.keys[p.uid][BOARD];
    ok(key.k !== k1 && !key.next, 'promoted');
    expect(w.apps[BOARD].users['ann@example.test'].password, key.k);
    expect(w.apps[BOARD].drops, 1);
  });
  await test('rotate stops after the new key is saved beside the old: the next run finishes with the same key', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    const k1 = w.hub.keys[p.uid][BOARD].k;
    trap(w, 'hub.putKey', { after: true });
    await failsWith(() => L.rotateLink({ hub, app: app(BOARD), person: p, fill }));
    const waiting = w.hub.keys[p.uid][BOARD].next;
    ok(waiting && w.hub.keys[p.uid][BOARD].k === k1, 'old key still first');
    expect(w.apps[BOARD].users['ann@example.test'].password, k1, 'account not changed yet');
    await L.rotateLink({ hub, app: app(BOARD), person: p, fill });
    expect(w.hub.keys[p.uid][BOARD], { k: waiting, email: 'ann@example.test', at: w.now, by: hub.me().uid });
    expect(w.apps[BOARD].users['ann@example.test'].password, waiting);
  });
  await test('rotate stops after the password changed: the new key is never lost', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    trap(w, 'app.changePassword', { after: true });
    await failsWith(() => L.rotateLink({ hub, app: app(BOARD), person: p, fill }));
    const { k, next } = w.hub.keys[p.uid][BOARD];
    expect(w.apps[BOARD].users['ann@example.test'].password, next, 'the account has the new one');
    ok(k !== next);
    await L.rotateLink({ hub, app: app(BOARD), person: p, fill });
    expect(w.hub.keys[p.uid][BOARD].k, next);
    ok(!w.hub.keys[p.uid][BOARD].next);
  });
  await test('linking again after a half-done rotate also finishes it', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    trap(w, 'app.changePassword', { after: true });
    await failsWith(() => L.rotateLink({ hub, app: app(BOARD), person: p, fill }));
    const next = w.hub.keys[p.uid][BOARD].next;
    expect(await L.ensureLink({ hub, app: app(BOARD), person: p, fill }), { status: 'linked', how: 'found' });
    expect(w.hub.keys[p.uid][BOARD].k, next);
  });
  await test('rotate without a link says so', async () => {
    const { hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    expect(await failsWith(() => L.rotateLink({ hub, app: app(BOARD), person: p, fill })), 'not-linked');
  });
  await test('hand back: the account has a password a person can type, and the hub forgets the key', async () => {
    const { w, hub, app, add, fill, again } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    const r = await L.handBack({ hub, app: app(BOARD), person: p, fill });
    ok(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(r.temp), r.temp);
    expect(w.apps[BOARD].users['ann@example.test'].password, r.temp);
    ok(!w.hub.keys[p.uid][BOARD]);
    ok(!(await again(p)).links[BOARD]);
  });

  // -------------------------------------------------------------------------
  group = 'roles';
  await test('an address that is not linked is never listed', async () => {
    const { w, hub, app, add } = setup();
    const p = await add('ann@example.test');
    expect(await failsWith(() => L.setRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor' })), 'not-linked');
    expect(w.apps[BOARD].access.floor, []);
  });
  await test('linked first, listed second, and the default master is written down', async () => {
    const { w, hub, app, add, fill, again } = setup();
    const p = await add('ann@example.test');
    expect(await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill }), { status: 'saved', changed: true });
    expect(w.apps[BOARD].access.floor, ['ann@example.test']);
    expect(w.apps[BOARD].access.masters, [BOSS]);
    expect((await again(p)).links[BOARD].role, 'floor');
    ok(w.apps[BOARD].users['ann@example.test'], 'the account exists');
  });
  await test('changing a role moves the address; none takes it off', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'manager', fill });
    p = await again(p);
    await L.setRole({ hub, app: app(BOARD), model: board, person: p, role: 'engineer' });
    expect(w.apps[BOARD].access.managers, [BOSS]);
    expect(w.apps[BOARD].access.engineers, ['ann@example.test']);
    p = await again(p);
    await L.setRole({ hub, app: app(BOARD), model: board, person: p, role: null });
    expect(w.apps[BOARD].access.engineers, []);
    expect((await again(p)).links[BOARD], { linked: true, role: null, at: w.now, by: hub.me().uid });
  });
  await test('an old login: the role is given, and the app waits for its owner to link it', async () => {
    const { w, hub, app, add, fill, again } = setup();
    addAppLogin(w, BOARD, 'old@example.test', 'old-pw');
    const p = await add('old@example.test');
    expect(await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill }), { status: 'saved', changed: true, waiting: true });
    expect(w.apps[BOARD].access.floor, ['old@example.test'], 'listed: the login exists, so nobody can sign up as it');
    expect(w.apps[BOARD].users['old@example.test'].password, 'old-pw', 'its password is its owner\'s until they link it');
    const link = (await again(p)).links[BOARD];
    ok(link.waiting && !link.linked, JSON.stringify(link));
    expect(link.role, 'floor');
    ok(w.hub.keys[p.uid][BOARD].k.length >= 32, 'the key it will be given is already saved');
  });
  await test('the owner links it on first open: their old password swapped for the saved key', async () => {
    const { w, hub, app, add, fill, again } = setup();
    addAppLogin(w, BOARD, 'old@example.test', 'old-pw');
    let p = await add('old@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill });
    // What the core's link screen does, as the person: change the app password to their key.
    const key = w.hub.keys[p.uid][BOARD];
    await app(BOARD).changePassword('old@example.test', 'old-pw', key.k);
    // The master's Accounts screen then proves it and calls it linked.
    p = await again(p);
    expect(await L.ensureLink({ hub, app: app(BOARD), person: p, fill }), { status: 'linked', how: 'found' });
    const link = (await again(p)).links[BOARD];
    ok(link.linked && !link.waiting, JSON.stringify(link));
    expect(link.role, 'floor', 'the role survives the change');
  });
  await test('a person waiting to link is removed without a key being changed', async () => {
    const { w, hub, app, add, fill, again } = setup();
    addAppLogin(w, BOARD, 'old@example.test', 'old-pw');
    let p = await add('old@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill });
    p = await again(p);
    expect(await L.removePerson({ hub, person: p, apps: { [BOARD]: { app: app(BOARD), model: board } }, fill }), { [BOARD]: 'ok' });
    expect(w.apps[BOARD].access.floor, []);
    expect(w.apps[BOARD].users['old@example.test'].password, 'old-pw');
  });
  await test('a link that broke since is proved again before the role is listed', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill });
    p = await again(p);
    await L.setRole({ hub, app: app(BOARD), model: board, person: p, role: null });
    p = await again(p);
    ok(p.links[BOARD].linked, 'the hub still notes it as linked');
    w.apps[BOARD].users['ann@example.test'].password = 'set-by-a-reset-email';
    expect(await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill }), { status: 'saved', changed: true, waiting: true });
    const link = (await again(p)).links[BOARD];
    ok(link.waiting && !link.linked, 'no longer called linked: its owner re-links it on first open');
    expect(w.apps[BOARD].access.floor, ['ann@example.test'], 'listed: the login exists');
  });
  await test('an app account deleted since is made again with the same key, then listed', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill });
    p = await again(p);
    await L.setRole({ hub, app: app(BOARD), model: board, person: p, role: null });
    p = await again(p);
    const k = w.hub.keys[p.uid][BOARD].k;
    delete w.apps[BOARD].users['ann@example.test'];
    expect(await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'engineer', fill }), { status: 'saved', changed: true });
    expect(w.apps[BOARD].users['ann@example.test'].password, k);
    expect(w.apps[BOARD].access.engineers, ['ann@example.test']);
  });
  await test('a master does not change their own role', async () => {
    const { w, boss, hub, app, fill } = setup();
    const me = { uid: boss, ...w.hub.people[boss] };
    expect(await failsWith(() => L.setRole({ hub, app: app(BOARD), model: board, person: me, role: 'floor' })), 'self');
    expect(await failsWith(() => L.giveRole({ hub, app: app(BOARD), model: board, person: me, role: 'floor', fill })), 'self');
  });
  await test('an app with no lists document is left alone', async () => {
    const { w, hub, app, add, fill } = setup();
    const p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    w.apps[BOARD].access = null;
    expect(await failsWith(() => L.setRole({ hub, app: app(BOARD), model: board, person: { ...p, links: { [BOARD]: { linked: true } } }, role: 'floor' })), 'missing');
    expect(w.apps[BOARD].access, null, 'not created');
  });
  await test('only one of the app\'s own masters changes its lists', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(DESIGN), person: p, fill });
    p = await again(p);
    w.apps[DESIGN].access.designers.push('helper@example.test');     // listed there, not a master
    expect(await failsWith(() => L.setRole({ hub, app: app(DESIGN, 'helper@example.test'), model: design, person: p, role: 'designer' })), 'denied');
    expect(w.apps[DESIGN].access.designers, ['helper@example.test']);
  });
  await test('a tile tick for an app that has not joined', async () => {
    const { hub, add, again } = setup();
    const p = await add('ann@example.test');
    await L.setPlain({ hub, person: p, projectId: ORDERING_TEST, on: true });
    ok((await again(p)).links[ORDERING_TEST].plain);
    await L.setPlain({ hub, person: p, projectId: ORDERING_TEST, on: false });
    ok(!(await again(p)).links[ORDERING_TEST]);
  });

  // -------------------------------------------------------------------------
  group = 'people';
  await test('a new person: a hub login with a temporary password, and a directory entry', async () => {
    const { w, hub, fill } = setup();
    const r = await L.createPerson({ hub, email: ' Ann@Example.test ', name: ' Ann ', fill });
    expect(w.hub.users['ann@example.test'].password, r.temp);
    expect(w.hub.people[r.uid].email, 'ann@example.test');
    expect(w.hub.people[r.uid].name, 'Ann');
    expect(w.hub.log[0].action, 'person');
  });
  await test('somebody already in the hub is not added twice; a bad address is refused', async () => {
    const { hub, fill } = setup();
    await L.createPerson({ hub, email: 'ann@example.test', fill });
    expect(await failsWith(() => L.createPerson({ hub, email: 'ANN@example.test', fill })), 'exists');
    expect(await failsWith(() => L.createPerson({ hub, email: 'not an address', fill })), 'invalid');
  });
  await test('a hub login the hub did not make is not adopted without its password', async () => {
    const { w, hub, fill } = setup();
    const squatter = addHubLogin(w, 'ann@example.test', 'theirs');
    expect(await failsWith(() => L.createPerson({ hub, email: 'ann@example.test', fill })), 'login-exists');
    ok(!w.hub.people[squatter], 'no directory entry was made for it');
    expect(await failsWith(() => L.adoptPerson({ hub, email: 'ann@example.test', password: 'guess' })), 'credential');
    expect((await L.adoptPerson({ hub, email: 'ann@example.test', name: 'Ann', password: 'theirs' })).uid, squatter);
  });
  await test('remove: off every list, new keys, and no more keys for them', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'manager', fill });
    p = await again(p);
    await L.giveRole({ hub, app: app(DESIGN), model: design, person: p, role: 'designer', fill });
    p = await again(p);
    const before = { [BOARD]: w.hub.keys[p.uid][BOARD].k, [DESIGN]: w.hub.keys[p.uid][DESIGN].k };
    const apps = { [BOARD]: { app: app(BOARD), model: board }, [DESIGN]: { app: app(DESIGN), model: design } };
    expect(await L.removePerson({ hub, person: p, apps, fill }), { [BOARD]: 'ok', [DESIGN]: 'ok' });
    expect(w.apps[BOARD].access.managers, [BOSS]);
    expect(w.apps[DESIGN].access.designers, []);
    ok(w.hub.keys[p.uid][BOARD].k !== before[BOARD] && w.hub.keys[p.uid][DESIGN].k !== before[DESIGN], 'keys replaced');
    ok(w.hub.people[p.uid].disabled);
    expect(await failsWith(() => fakeHub(w, { as: p.uid }).getKey(p.uid, BOARD)), 'denied');
  });
  await test('remove says what it could not do, and still locks the login out', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.giveRole({ hub, app: app(DESIGN), model: design, person: p, role: 'designer', fill });
    p = await again(p);
    const k1 = w.hub.keys[p.uid][DESIGN].k;
    w.apps[DESIGN].access.masters = ['someone-else@example.test'];   // the acting master is no longer a master there
    const apps = { [DESIGN]: { app: app(DESIGN), model: design } };
    expect(await L.removePerson({ hub, person: p, apps, fill }), { [DESIGN]: 'denied' });
    expect(w.apps[DESIGN].access.designers, ['ann@example.test'], 'still listed: that app\'s master has to finish it');
    ok(w.hub.keys[p.uid][DESIGN].k !== k1, 'but re-keyed');
    ok(w.hub.people[p.uid].disabled);
  });
  await test('nobody removes themselves', async () => {
    const { w, boss, hub } = setup();
    expect(await failsWith(() => L.removePerson({ hub, person: { uid: boss, ...w.hub.people[boss] }, apps: {} })), 'self');
  });
  await test('a forgotten password: the login is made again and everything moves to it', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.giveRole({ hub, app: app(BOARD), model: board, person: p, role: 'floor', fill });
    p = await again(p);
    const k = w.hub.keys[p.uid][BOARD].k;
    expect(await failsWith(() => L.rebindPerson({ hub, person: p, fill })), 'login-exists');
    delete w.hub.users['ann@example.test'];                           // deleted in the console
    const r = await L.rebindPerson({ hub, person: p, fill });
    ok(r.uid !== p.uid && r.temp);
    expect(w.hub.users['ann@example.test'].password, r.temp);
    ok(!w.hub.people[p.uid] && !Object.keys(w.hub.keys[p.uid] ?? {}).length, 'the old entry and keys are gone');
    expect(w.hub.keys[r.uid][BOARD].k, k, 'the same key: nothing changed in the app');
    expect(w.hub.people[r.uid].links[BOARD].role, 'floor');
    ok(!('rebindFrom' in w.hub.people[r.uid]));
    expect(w.apps[BOARD].users['ann@example.test'].password, k);
  });
  await test('making a login again survives a closed tab', async () => {
    const { w, hub, app, add, fill, again } = setup();
    let p = await add('ann@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: p, fill });
    p = await again(p);
    const k = w.hub.keys[p.uid][BOARD].k;
    delete w.hub.users['ann@example.test'];
    trap(w, 'hub.deleteKey');
    await failsWith(() => L.rebindPerson({ hub, person: p, fill }));
    ok(w.hub.people[p.uid], 'the old entry is still there');
    const r = await L.rebindPerson({ hub, person: p, fill });
    expect(r.temp, null, 'the password shown the first time is gone');
    expect(w.hub.keys[r.uid][BOARD].k, k);
    ok(!w.hub.people[p.uid]);
    ok(!('rebindFrom' in w.hub.people[r.uid]));
  });

  // -------------------------------------------------------------------------
  group = 'the hub\'s own rules, as the fake keeps them';
  await test('a person reads their own key and nobody else\'s; only a master writes', async () => {
    const { w, hub, app, add, fill } = setup();
    const ann = await add('ann@example.test');
    const bob = await add('bob@example.test');
    await L.ensureLink({ hub, app: app(BOARD), person: ann, fill });
    await L.ensureLink({ hub, app: app(BOARD), person: bob, fill });
    const asAnn = fakeHub(w, { as: ann.uid });
    expect((await asAnn.getKey(ann.uid, BOARD)).k, w.hub.keys[ann.uid][BOARD].k);
    expect(await failsWith(() => asAnn.getKey(bob.uid, BOARD)), 'denied');
    expect(await failsWith(() => asAnn.putKey(ann.uid, BOARD, { k: 'x'.repeat(43) })), 'denied');
    expect(await failsWith(() => asAnn.listPeople()), 'denied');
  });

  // -------------------------------------------------------------------------
  group = 'accounts grid';
  const demoGrid = () => {
    const w = demoWorld();
    const people = Object.entries(w.hub.people).map(([uid, p]) => ({ uid, ...p }));
    const access = Object.fromEntries(Object.entries(w.apps).filter(([, a]) => a.access).map(([pid, a]) => [pid, { doc: a.access }]));
    const me = { uid: w.hub.masters[0], email: 'alex@example.test' };
    return { w, people, grid: buildGrid({ projects: PROJECTS, joined: w.joined, people, access, me }) };
  };
  await test('columns: lists the hub edits, fixed roles, and a tick for an app that has not joined', () => {
    const { grid } = demoGrid();
    const kinds = Object.fromEntries(grid.columns.map((c) => [c.pid, c.kind]));
    expect(kinds, { [BOARD]: 'roles', [ORDERING]: 'roles', [ORDERING_TEST]: 'plain', [DESIGN]: 'roles', [DRAWINGS]: 'fixed' });
    ok(grid.columns.find((c) => c.pid === BOARD).canEdit, 'the acting master is a master of the board');
    expect(grid.columns.find((c) => c.pid === DESIGN).roles.map((r) => r.id), ['lead', 'designer', 'manager', 'contributor']);
  });
  await test('cells: every situation the screen has to show', () => {
    const { grid } = demoGrid();
    const row = (email) => grid.rows.find((r) => r.email === email);
    expect(row('alex@example.test').cells[BOARD].state, 'ok');
    expect(row('alex@example.test').cells[BOARD].role, 'manager');
    ok(row('alex@example.test').self && row('alex@example.test').cells[BOARD].master);
    expect(row('alex@example.test').cells[DRAWINGS].state, 'ok');
    expect(row('alex@example.test').cells[ORDERING_TEST].state, 'on');
    expect(row('jordan@example.test').cells[BOARD].state, 'none');
    expect(row('jordan@example.test').cells[ORDERING_TEST].state, 'off');
    expect(row('pat@example.test').cells[BOARD].state, 'loose', 'listed, not linked');
    expect(row('pat@example.test').cells[ORDERING].state, 'linked', 'linked, on no list');
  });
  await test('addresses on an app\'s lists that the hub has no person for are shown, and counted', () => {
    const { grid } = demoGrid();
    expect(grid.strays.map((s) => s.email), ['casey@example.test', 'stores@example.test']);
    expect(grid.strays[1].cells[ORDERING].role, 'floor');
    expect(looseCount(grid), 3);
  });
  await test('an app that did not answer says why, and cannot be edited', () => {
    const { w, people } = demoGrid();
    const grid = buildGrid({ projects: PROJECTS, joined: w.joined, people, access: { [BOARD]: { error: 'denied' } }, me: { uid: 'x', email: 'alex@example.test' } });
    const col = grid.columns.find((c) => c.pid === BOARD);
    expect(col.problem, 'denied');
    ok(!col.canEdit);
    expect(grid.rows.find((r) => r.email === 'alex@example.test').cells[BOARD].role, 'manager', 'falls back to the hub\'s copy');
  });
  await test("the hub's copy of a role catches up with the app's list: a master linking themselves gets their tile", () => {
    const doc = { managers: ['boss@example.test'], engineers: ['ann@example.test'], floor: [], testers: [], masters: ['boss@example.test'] };
    const people = [
      // Linked by the amber Link, so the hub holds no role for them: the app says Manager / Engineer.
      { uid: 'u-boss', email: 'boss@example.test', name: 'Boss', links: { [BOARD]: { linked: true, role: null } } },
      { uid: 'u-ann', email: 'ann@example.test', name: 'Ann', links: { [BOARD]: { linked: true, role: null } } },
      // Already right, not linked, and removed: left alone.
      { uid: 'u-ok', email: 'ok@example.test', name: 'Ok', links: { [BOARD]: { linked: true, role: null } } },
      { uid: 'u-old', email: 'old@example.test', name: 'Old', links: {} },
      { uid: 'u-gone', email: 'gone@example.test', name: 'Gone', disabled: true, links: { [BOARD]: { linked: true, role: 'floor' } } },
    ];
    const grid = buildGrid({ projects: PROJECTS, joined: { [BOARD]: true }, people, access: { [BOARD]: { doc } }, me: { uid: 'u-boss', email: 'boss@example.test' } });
    expect(staleLinks(grid), [{ uid: 'u-ann', pid: BOARD, role: 'engineer' }, { uid: 'u-boss', pid: BOARD, role: 'manager' }]);
    // Once written back, the master has the app as theirs: a tile, and the switcher.
    expect(appsFromLinks({ [BOARD]: { linked: true, role: 'manager' } }, PROJECTS, { [BOARD]: true }), { [BOARD]: 'manager' });
    // Taken off the app's list inside the app: the copy follows to none.
    const grid2 = buildGrid({ projects: PROJECTS, joined: { [BOARD]: true }, people: [{ uid: 'u-ann', email: 'ann@example.test', links: { [BOARD]: { linked: true, role: 'engineer' } } }], access: { [BOARD]: { doc: { ...doc, engineers: [] } } }, me: { uid: 'x', email: 'boss@example.test' } });
    expect(staleLinks(grid2), [{ uid: 'u-ann', pid: BOARD, role: null }]);
  });
  await test('a login waiting for its owner: shown as waiting, not as a problem, and the app is theirs', () => {
    const doc = { managers: ['boss@example.test'], engineers: [], floor: ['ann@example.test'], testers: [], masters: ['boss@example.test'] };
    const people = [{ uid: 'u-ann', email: 'ann@example.test', name: 'Ann', links: { [BOARD]: { waiting: true, role: 'floor' } } },
      { uid: 'u-boss', email: 'boss@example.test', name: 'Boss', links: { [BOARD]: { linked: true, role: 'manager' } } }];
    const grid = buildGrid({ projects: PROJECTS, joined: { [BOARD]: true }, people, access: { [BOARD]: { doc } }, me: { uid: 'u-boss', email: 'boss@example.test' } });
    const cell = grid.rows.find((r) => r.uid === 'u-ann').cells[BOARD];
    expect([cell.state, cell.waiting, cell.linked, cell.canLink], ['waiting', true, false, false]);
    expect(looseCount(grid), 0, 'nothing for the master to do');
    expect(appsFromLinks(people[0].links, PROJECTS, { [BOARD]: true }), { [BOARD]: 'floor' }, 'a tile, and opening it is how she links it');
    expect(claimedLinks(grid, {}), []);
    expect(claimedLinks(grid, { 'u-ann': { linked: { [BOARD]: '2026-11-19T00:00:00Z' } } }), [{ uid: 'u-ann', pid: BOARD }], 'she says she has: the screen checks it');
  });
  await test('a master not yet linked to an app has a way in: Link on their own cell, and nowhere else', async () => {
    // What the grid is given when the acting master cannot read an app's lists.
    const { w, hub, add } = setup();
    const ann = await add('ann@example.test', 'Ann');
    const me = hub.me();
    const people = await hub.listPeople();
    expect(await failsWith(() => fakeApp(w, BOARD, { as: null }).readAccess()), 'not-linked');
    const grid = buildGrid({ projects: PROJECTS, joined: { [BOARD]: true }, people, access: { [BOARD]: { error: 'not-linked' } }, me });
    const col = grid.columns.find((c) => c.pid === BOARD);
    expect([col.problem, col.canEdit], ['not-linked', false]);
    const mine = grid.rows.find((r) => r.self).cells[BOARD];
    ok(mine.canLink, 'the master links themselves first');
    ok(!grid.rows.find((r) => r.uid === ann.uid).cells[BOARD].canLink, 'nobody else can be linked until the lists can be read');
  });
  await test('where Link is offered: a listed address with no link, and a fixed-roles app', () => {
    const { grid } = demoGrid();
    const row = (email) => grid.rows.find((r) => r.email === email);
    ok(row('pat@example.test').cells[BOARD].canLink, 'listed, not linked');
    ok(!row('jordan@example.test').cells[BOARD].canLink, 'not listed: a role is given instead, which links');
    ok(!row('alex@example.test').cells[BOARD].canLink, 'linked already');
    ok(row('jordan@example.test').cells[DRAWINGS].canLink, 'fixed roles: linking is all there is');
    ok(!row('alex@example.test').cells[DRAWINGS].canLink);
  });
  await test('the hub\'s copy of a role is flagged when the app says otherwise', () => {
    const { w, people } = demoGrid();
    w.apps[BOARD].access.managers = w.apps[BOARD].access.managers.filter((e) => e !== 'sam@example.test');
    w.apps[BOARD].access.floor.push('sam@example.test');
    const grid = buildGrid({ projects: PROJECTS, joined: w.joined, people, access: { [BOARD]: { doc: w.apps[BOARD].access } }, me: { uid: 'x', email: 'alex@example.test' } });
    const cell = grid.rows.find((r) => r.email === 'sam@example.test').cells[BOARD];
    expect(cell.role, 'floor');
    ok(cell.stale);
  });
  await test('which apps a login has: a role where the app has joined, a tick where it has not', () => {
    const { w, people } = demoGrid();
    const links = (email) => people.find((p) => p.email === email).links;
    expect(appsFromLinks(links('alex@example.test'), PROJECTS, w.joined), {
      [BOARD]: 'manager', [ORDERING]: 'manager', [DESIGN]: 'lead', [DRAWINGS]: 'link', [ORDERING_TEST]: 'link',
    });
    expect(appsFromLinks(links('pat@example.test'), PROJECTS, w.joined), {}, 'linked with no role is not an app you have');
    expect(appsFromLinks(links('jordan@example.test'), PROJECTS, w.joined), {});
  });
  await test('a tile tick outlives the day the app joins, until the person is linked', () => {
    const before = { [BOARD]: false };
    const after = { [BOARD]: true };
    const ticked = { [BOARD]: { plain: true, at: 't', by: 'u' } };
    expect(appsFromLinks(ticked, PROJECTS, before), { [BOARD]: 'link' });
    expect(appsFromLinks(ticked, PROJECTS, after), { [BOARD]: 'link' }, 'still there once the app has joined');
    // Their tile still says the app has its own sign-in, and asks for no card.
    const mine = tilesFor({ [BOARD]: 'link' }, { joined: after })[0];
    ok(mine.joined && mine.own, 'joined app, own sign-in for this person');
    ok(!tilesFor({ [BOARD]: 'floor' }, { joined: after })[0].own, 'linked with a role: the hub signs them in');
    ok(tilesFor({ [BOARD]: 'floor' }, { joined: before })[0].own, 'an app that has not joined is everybody\'s own sign-in');
    ok(!tilesFor({ [DRAWINGS]: 'link' }, { joined: { [DRAWINGS]: true } })[0].own, 'fixed roles: linked is all there is');
    // Linking replaces the tick, and the role is then what counts.
    expect(appsFromLinks({ [BOARD]: { linked: true, role: null } }, PROJECTS, after), {});
    expect(appsFromLinks({ [BOARD]: { linked: true, role: 'floor' } }, PROJECTS, after), { [BOARD]: 'floor' });
    // The grid shows the standing tick so it can be taken away.
    const people = [{ uid: 'u1', email: 'ann@example.test', name: 'Ann', links: ticked }];
    const grid = buildGrid({ projects: PROJECTS, joined: after, people, access: { [BOARD]: { doc: { managers: [], engineers: [], floor: [], testers: [], masters: [] } } }, me: { uid: 'x', email: 'boss@example.test' } });
    const cell = grid.rows[0].cells[BOARD];
    expect([cell.state, cell.plain], ['none', true]);
  });
  await test('no card is asked of an app the person still signs in to the old way', async () => {
    let asked = 0;
    const backend = { hasCard: () => true, card: async () => { asked += 1; return { title: 'x', items: [] }; } };
    expect(await loadCard(backend, { id: BOARD, joined: true, own: true, role: null }, { email: 'ann@example.test' }), { state: 'none' });
    expect(asked, 0);
    expect((await loadCard(backend, { id: BOARD, joined: true, own: false, role: 'floor' }, { email: 'ann@example.test' })).state, 'ready');
    expect(asked, 1);
  });

  // -------------------------------------------------------------------------
  group = 'arranging your own tiles';
  const T = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }, { id: 'd', title: 'D' }];
  const ids = (list) => list.map((t) => `${t.id}${t.hidden ? '-' : ''}`).join(' ');
  await test('no choice: every tile, in the usual order', () => {
    expect(ids(arrange(T, null)), 'a b c d');
  });
  await test('a chosen order first, and an app not in it keeps its usual place after them', () => {
    expect(ids(arrange(T, { order: ['c', 'a'] })), 'c a b d');
    expect(ids(arrange(T, { order: ['x', 'd'] })), 'd a b c', 'an app no longer theirs is ignored');
  });
  await test('hiding marks a tile; moving and hiding give the whole new choice', () => {
    const list = arrange(T, { hidden: ['b'] });
    expect(ids(list), 'a b- c d');
    expect(moved(list, 'c', -1), { order: ['a', 'c', 'b', 'd'], hidden: ['b'] });
    expect(moved(list, 'a', -1).order, ['a', 'b', 'c', 'd'], 'the first cannot go earlier');
    expect(toggled(list, 'b', false), { order: ['a', 'b', 'c', 'd'], hidden: [] });
    expect(toggled(list, 'd', true).hidden, ['b', 'd']);
  });
  await test('a device with its own choice uses it whole; without one, the person\'s', () => {
    const mine = { order: ['d'], hidden: ['a'] };
    const phone = { order: [], hidden: ['c'] };
    expect(ids(arrange(T, effective(mine, null))), 'd a- b c');
    expect(ids(arrange(T, effective(mine, phone))), 'a b c- d');
    expect(effective(null, null), { order: [], hidden: [] });
  });
  await test('what is kept is tidied: strings only, no repeats, not too many', () => {
    expect(tidyPrefs({ order: ['a', 'a', 7, null, 'b'], hidden: 'nope' }), { order: ['a', 'b'], hidden: [] });
    expect(tidyPrefs({ order: Array.from({ length: 60 }, (_, i) => `p${i}`) }).order.length, 40);
  });

  // -------------------------------------------------------------------------
  group = 'overview cards';
  await test('a link from a card stays on this site', () => {
    expect(sitePath('/material-ordering/manager.html'), '/material-ordering/manager.html');
    expect(sitePath('/Production-Scheduling/parts?x=1#y'), '/Production-Scheduling/parts?x=1#y');
    for (const bad of ['https://elsewhere.example/x', '//elsewhere.example/x', 'javascript:alert(1)', 'manager.html', '', null, 42, '/a b']) {
      expect(sitePath(bad), null, String(bad));
    }
  });
  await test('what a card returns is trimmed to what can be drawn', () => {
    const card = normaliseCard({
      title: '  Orders waiting ', count: 3.9, href: 'https://elsewhere.example/', empty: 'None.',
      items: [
        { title: 'One', sub: 'A', when: '2 h', href: '/material-ordering/', late: true },
        { title: '' }, null, 'text',
        { title: 'Two', href: 'javascript:alert(1)' },
        { title: 'Three' }, { title: 'Four' },
      ],
    });
    expect(card.title, 'Orders waiting');
    expect(card.count, 3);
    expect(card.href, null, 'a link off the site is dropped');
    expect(card.items.map((i) => i.title), ['One', 'Two', 'Three'], 'three lines at most, and only real ones');
    expect(card.items[0], { title: 'One', sub: 'A', when: '2 h', href: '/material-ordering/', late: true });
    expect(card.items[1].href, null);
    expect(normaliseCard({ title: 'x', count: 0, items: 'no' }), { title: 'x', count: null, items: [], href: null, empty: '' });
    for (const bad of [null, undefined, 'text', 7]) expect(normaliseCard(bad), null);
  });
  await test('a card that fails, hangs or has nothing costs only its own tile', async () => {
    const tile = { id: 'p', joined: true, role: 'manager' };
    const me = { email: 'a@x.test' };
    const quiet = console.warn;
    console.warn = () => {};
    try {
      const b = (card) => ({ hasCard: () => true, card });
      expect((await loadCard(b(async () => { throw new Error('boom'); }), tile, me)).state, 'failed');
      expect((await loadCard(b(() => new Promise(() => {})), tile, me, { limit: 20 })).state, 'failed');
      expect((await loadCard(b(async () => null), tile, me)).state, 'none');
      expect((await loadCard(b(async () => ({ title: 'T', items: [] })), tile, me)).state, 'ready');
      expect((await loadCard({ hasCard: () => false }, tile, me)).state, 'none');
      expect((await loadCard(b(async () => ({ title: 'T' })), { ...tile, joined: false }, me)).state, 'none', 'an app that has not joined has no card');
    } finally { console.warn = quiet; }
  });
  await test('a card is told who is looking', async () => {
    let seen = null;
    await loadCard({ hasCard: () => true, card: async (pid, ctx) => { seen = { pid, ...ctx }; return null; } }, { id: 'p', joined: true, role: 'floor' }, { email: 'a@x.test' });
    expect(seen, { pid: 'p', email: 'a@x.test', role: 'floor' });
  });

  // -------------------------------------------------------------------------
  group = 'reading the hub over REST';
  await test('a Firestore REST document becomes a plain object', () => {
    expect(decodeDoc({ name: 'projects/p/databases/(default)/documents/keys/u1/p/app', fields: {
      k: { stringValue: 'abc' }, email: { stringValue: 'a@x.test' }, n: { integerValue: '7' }, on: { booleanValue: true },
      links: { mapValue: { fields: { app: { mapValue: { fields: { linked: { booleanValue: true }, role: { nullValue: null } } } } } } },
      list: { arrayValue: { values: [{ stringValue: 'x' }, { doubleValue: 1.5 }] } }, none: { arrayValue: {} },
    } }), { k: 'abc', email: 'a@x.test', n: 7, on: true, links: { app: { linked: true, role: null } }, list: ['x', 1.5], none: [] });
    expect(decodeDoc({}), {});
    expect(decodeDoc(null), {});
  });

  await coreTests({ test, expect, ok, failsWith, setGroup: (g) => { group = g; } });

  return results;
}
