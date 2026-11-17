// access.js - an app's accounts list, as data, for ANY app's role names.
//
// Every app keeps one document (settings/access) holding flat lists of
// addresses, one list per role, plus a `masters` list. The board's own
// access.js does this for the board's four roles; this is the same set of
// pure functions with the role names passed in as a MODEL, because each app
// names its roles differently (and `managers` means different things in two of
// them). A model comes from js/registry.js:
//
//   { roles: [{ id, list, label }],   one list per role, in the app's order
//     precedence: [id, ...],          which role wins if an address is on two
//     masters: 'masters',             the list of who may change the lists
//     fallback: 'managers' }          with no masters, this list's first entry
//
// THE HUB NEVER REWRITES THE DOCUMENT. The apps' own panels save all the
// lists at once, so a stale panel overwrites whatever changed since it was
// opened. The hub changes a list by adding or removing ONE address
// (Firestore's arrayUnion / arrayRemove), which cannot lose anybody else's
// change. So nothing here returns a new document: it returns OPERATIONS.

import { tidyEmail, tidyList } from './keys.js';

const roleById = (model, id) => model.roles.find((r) => r.id === id);

/**
 * The document as the app's rules read it: each role's list, tidied, and who
 * the masters are. With no masters listed the first address on the fallback
 * list is the master, which is the default every app's rules apply.
 */
export function normalise(model, doc) {
  const lists = {};
  for (const r of model.roles) lists[r.list] = tidyList(doc?.[r.list]);
  const pinned = tidyList(doc?.[model.masters]);
  const first = model.fallback ? lists[model.fallback]?.[0] : undefined;
  return { lists, masters: pinned.length ? pinned : (first ? [first] : []), pinned: pinned.length > 0 };
}

/** The role an address has in this app, or null when it is on no list. */
export function roleOf(model, doc, email) {
  const e = tidyEmail(email);
  if (!e) return null;
  const { lists } = normalise(model, doc);
  const order = model.precedence ?? model.roles.map((r) => r.id);
  for (const id of order) {
    const r = roleById(model, id);
    if (r && lists[r.list].includes(e)) return id;
  }
  return null;
}

export const isMaster = (model, doc, email) => normalise(model, doc).masters.includes(tidyEmail(email));

/** Every address on any list, with its role and whether it is a master. Sorted by address. */
export function rows(model, doc) {
  const n = normalise(model, doc);
  const all = new Set(n.masters);
  for (const r of model.roles) for (const e of n.lists[r.list]) all.add(e);
  return [...all].sort().map((email) => ({ email, role: roleOf(model, doc, email), master: n.masters.includes(email) }));
}

/** The entries of a stored list that are this address, however they were typed. */
const stored = (doc, list, e) => (Array.isArray(doc?.[list]) ? doc[list] : []).filter((x) => tidyEmail(x) === e);

/**
 * What to do to the lists so this address has exactly this role (null: none).
 * Each operation is { list, op: 'add' | 'remove', email }. An address is taken
 * off a list as it is stored there, so one typed with a capital still goes.
 */
export function roleOps(model, doc, email, role) {
  const e = tidyEmail(email);
  if (!e) throw new Error('No address.');
  if (role !== null && !roleById(model, role)) throw new Error(`Not a role here: ${role}`);
  const ops = [];
  for (const r of model.roles) {
    const have = stored(doc, r.list, e);
    if (r.id === role) {
      // Present but stored untidily: replace it, so the rules (which lower-case
      // the signed-in address, not the list) match it.
      const exact = have.includes(e);
      for (const x of have) if (x !== e) ops.push({ list: r.list, op: 'remove', email: x });
      if (!exact) ops.push({ list: r.list, op: 'add', email: e });
    } else {
      for (const x of have) ops.push({ list: r.list, op: 'remove', email: x });
    }
  }
  return ops;
}

/**
 * Write the default master down before anything else changes.
 *
 * With an empty masters list the master is "whoever is first on the fallback
 * list". Take that person off the list, or put somebody ahead of them, and the
 * mastership moves without anybody deciding it should. So the first time the
 * hub edits an app's lists it pins the current master into `masters`.
 */
export function pinOps(model, doc) {
  const n = normalise(model, doc);
  if (n.pinned || !n.masters.length) return [];
  return [{ list: model.masters, op: 'add', email: n.masters[0] }];
}

/**
 * Operations applied to a document, as Firestore applies them. For the
 * in-memory back-end and the tests; the real one sends the operations.
 */
export function applyOps(doc, ops) {
  const out = { ...(doc ?? {}) };
  for (const o of ops) {
    const cur = Array.isArray(out[o.list]) ? out[o.list] : [];
    out[o.list] = o.op === 'add' ? (cur.includes(o.email) ? [...cur] : [...cur, o.email]) : cur.filter((x) => x !== o.email);
  }
  return out;
}

/**
 * Operations as the writes that carry them out: a list of patches, each
 * { [list]: { add: [...] } | { remove: [...] } }, sent in order.
 *
 * Firestore will not add to and take from one list in a single write. That
 * only comes up when an address stored untidily is replaced by its tidy form,
 * and then the ADD goes first: for a moment the list holds both, never
 * neither, so the person is never unlisted halfway.
 */
export function opsToPatches(ops) {
  const adds = {};
  const removes = {};
  for (const o of ops) ((o.op === 'add' ? adds : removes)[o.list] ??= []).push(o.email);
  const first = {};
  const second = {};
  for (const [list, emails] of Object.entries(adds)) first[list] = { add: emails };
  for (const [list, emails] of Object.entries(removes)) (adds[list] ? second : first)[list] = { remove: emails };
  return [first, second].filter((p) => Object.keys(p).length);
}

/** Every address on a role list (not masters alone), tidied. */
export function listed(model, doc) {
  const { lists } = normalise(model, doc);
  return [...new Set(model.roles.flatMap((r) => lists[r.list]))];
}

export const roleLabel = (model, id) => roleById(model, id)?.label ?? id ?? '';
