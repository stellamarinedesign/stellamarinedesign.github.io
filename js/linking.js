// linking.js - everything a hub master does to a login, as steps over two
// PORTS, so the same code runs against Firebase and against the in-memory
// back-end the tests and the demo use (js/backend.js, js/fake.js).
//
// THE IDEA. A person has ONE password, in the hub project. In each app's own
// project the same person has an ordinary account whose password is an APP KEY
// nobody types (js/keys.js). The key is kept in the hub at
// keys/{uid}/p/{projectId}, and the shared core hands it to the app's own
// sign-in. Because that account carries the person's real address, the app's
// rules, lists and records keep working exactly as they did.
//
// EVERY STEP IS SAFE TO RUN AGAIN. A browser tab can close halfway through
// anything here. So the key is always written to the hub BEFORE an account is
// given it (a key without an account is harmless; an account whose password
// nobody recorded is lost), and a second run finds what the first one did
// rather than assuming.
//
// THE PORTS (all methods return promises unless marked):
//
//   hub.now()                         -> ISO string                (sync)
//   hub.me()                          -> { uid, email }            (sync) the acting master
//   hub.getKey(uid, pid)              -> { k, next?, email, at, by } | null
//   hub.putKey(uid, pid, key)         resolves once the SERVER has it
//   hub.deleteKey(uid, pid)
//   hub.listKeys(uid)                 -> { [pid]: key }
//   hub.listPeople()                  -> person[]
//   hub.getPerson(uid)                -> person | null
//   hub.createPerson(uid, data)
//   hub.patchPerson(uid, patch)       name, disabled, rebindFrom
//   hub.deletePerson(uid)
//   hub.setLink(uid, pid, link|null)  one entry of the person's `links` map
//   hub.createLogin(email, password)  -> uid       a new hub login
//   hub.checkLogin(email, password)   -> uid       proves a hub login's password
//   hub.log(entry)
//
//   app.projectId, app.title                                       (sync) the title is for the account log
//   app.create(email, password)       a new account in the app's project
//   app.check(email, password)        signs in and straight out again
//   app.changePassword(email, current, next)
//   app.readAccess()                  -> the app's lists document | null   (as the acting master)
//   app.listOps([{ list, op, email }])                                     (as the acting master)
//
// A person:  { uid, email, name, links: { [pid]: link }, disabled?, createdAt, createdBy }
// A link:    { linked: true, role: string|null, at, by }   an app that has joined
//            { waiting: true, role: string|null, at, by }  assigned; the person has
//                                    a login there from before the hub, and links it
//                                    THEMSELVES the first time they open the app (the
//                                    shared core asks for its password once and swaps
//                                    it for the key the hub saved here)
//            { plain: true, at, by }                       a tile for one that has not

import { newKey, tempPassword, tidyEmail, isEmail } from './keys.js';
import { HubError, kindOf } from './errors.js';
import { roleOps, pinOps, roleLabel } from './access.js';

const stamp = (hub) => ({ at: hub.now(), by: hub.me().uid });
/** What the account log calls an app: its title where the port carries one. */
const nameOf = (app) => app.title ?? app.projectId;
const say = (hub, action, text, extra = {}) => hub.log({ at: hub.now(), by: hub.me().uid, byEmail: tidyEmail(hub.me().email), action, text, ...extra }).catch(() => {});

/** Which of a key's passwords the app account answers to: 'k', 'next', or null. Anything but a wrong password is thrown. */
async function answersTo(app, email, key) {
  for (const which of ['k', 'next']) {
    if (!key?.[which]) continue;
    try { await app.check(email, key[which]); return which; }
    catch (e) { if (kindOf(e) !== 'credential') throw e; }
  }
  return null;
}

/** The key for this person and project, made and SAVED if there is none yet. */
async function keyFor(hub, person, pid, fill) {
  const have = await hub.getKey(person.uid, pid);
  if (have) return have;
  const key = { k: newKey(fill), email: tidyEmail(person.email), ...stamp(hub) };
  await hub.putKey(person.uid, pid, key);
  return key;
}

const noteLinked = (hub, person, pid) => hub.setLink(person.uid, pid, { linked: true, role: person.links?.[pid]?.role ?? null, ...stamp(hub) });

/**
 * The app is this person's, and they link their existing login themselves on
 * first open. Their key is already saved (ensureLink saves it before anything
 * else), so all the person's device has to do is swap the old password for it.
 */
export async function markWaiting({ hub, person, projectId, role = undefined, app = null }) {
  // Called once ensureLink has found the key does NOT open the login, so a
  // link noted as working is not any more: it waits for its owner too.
  const link = person.links?.[projectId];
  const email = tidyEmail(person.email);
  await hub.setLink(person.uid, projectId, { waiting: true, role: role === undefined ? (link?.role ?? null) : role, ...stamp(hub) });
  say(hub, 'link', `${email} links their existing ${nameOf(app ?? { projectId })} login the first time they open it.`, { target: email, project: projectId });
  return { status: 'waiting' };
}

/**
 * A link its owner says they made on first open (their `self` record names
 * the app): proved with one sign-in with the key before it is called linked.
 * Logged here, by the master's screen, because the person's own device cannot
 * write the log.
 */
export async function confirmClaim({ hub, app, person, fill }) {
  const r = await ensureLink({ hub, app, person, fill });
  const email = tidyEmail(person.email);
  if (r.status === 'linked' && r.how === 'found') say(hub, 'link', `${email} linked their own ${nameOf(app)} login when they first opened it.`, { target: email, project: app.projectId });
  return r;
}

/**
 * Make sure this person has an account in the app's project whose password is
 * their app key.
 *
 *   { status: 'linked', how: 'made' }    a new account was made
 *   { status: 'linked', how: 'found' }   it was there already and the key works
 *   { status: 'legacy' }                 an account exists with a password the hub
 *                                        does not know: take it over, or delete it
 *                                        in that project's console and run again
 *   { status: 'console', key }           the project makes no accounts from a
 *                                        browser: take an existing login over, or
 *                                        add the user in its console with this key
 */
export async function ensureLink({ hub, app, person, fill }) {
  const pid = app.projectId;
  const email = tidyEmail(person.email);
  let key = await keyFor(hub, person, pid, fill);
  let how = 'made';
  try {
    await app.create(email, key.k);
  } catch (e) {
    const kind = kindOf(e);
    if (kind !== 'exists' && kind !== 'signup-off') throw e;
    const which = await answersTo(app, email, key);
    if (!which) return kind === 'exists' ? { status: 'legacy' } : { status: 'console', key: key.k };
    // A rotation that stopped after the password changed: finish it.
    if (which === 'next') { key = { k: key.next, email, ...stamp(hub) }; await hub.putKey(person.uid, pid, key); }
    how = 'found';
  }
  await noteLinked(hub, person, pid);
  if (how === 'made') say(hub, 'link', `${email} linked to ${nameOf(app)}.`, { target: email, project: pid });
  return { status: 'linked', how };
}

/**
 * Take over an account that already exists, by proving its current password:
 * the password becomes the app key. The account keeps its uid, which is what a
 * kiosk's queued offline writes belong to; deleting and remaking it would
 * strand them.
 */
export async function takeOver({ hub, app, person, currentPassword, fill }) {
  const pid = app.projectId;
  const email = tidyEmail(person.email);
  const key = await keyFor(hub, person, pid, fill);
  await app.changePassword(email, currentPassword, key.k);
  await noteLinked(hub, person, pid);
  say(hub, 'link', `${email}: its existing ${nameOf(app)} login taken over.`, { target: email, project: pid });
  return { status: 'linked', how: 'taken' };
}

/**
 * A new key for one person in one app. The old one stops working at once and
 * the account's signed-in devices drop within the hour, then link again by
 * themselves if the person still may.
 *
 * In two phases, so a crash never loses the password: the new key is saved
 * beside the old (`next`), the password is changed, and only then does the new
 * key replace the old. Whatever ran last, the core tries `k` and then `next`.
 */
export async function rotateLink({ hub, app, person, fill }) {
  const pid = app.projectId;
  const email = tidyEmail(person.email);
  const key = await hub.getKey(person.uid, pid);
  if (!key) throw new HubError('not-linked', 'There is no key to replace: this login is not linked to that app.');
  const next = key.next ?? newKey(fill);
  if (!key.next) await hub.putKey(person.uid, pid, { ...key, next });
  try {
    await app.changePassword(email, key.k, next);
  } catch (e) {
    if (kindOf(e) !== 'credential') throw e;
    await app.check(email, next);          // an earlier run changed it already; a wrong `next` throws here
  }
  await hub.putKey(person.uid, pid, { k: next, email, ...stamp(hub) });
  say(hub, 'rotate', `${email}: new key for ${nameOf(app)}.`, { target: email, project: pid });
  return { status: 'rotated' };
}

/**
 * Give an app account a human password again and forget its key: the way back
 * for one account. Returns the temporary password, to be shown once.
 */
export async function handBack({ hub, app, person, fill }) {
  const pid = app.projectId;
  const email = tidyEmail(person.email);
  const key = await hub.getKey(person.uid, pid);
  if (!key) throw new HubError('not-linked', 'This login is not linked to that app.');
  const which = await answersTo(app, email, key);
  if (!which) throw new HubError('broken', 'The app account does not answer to its key, so there is nothing to hand back. Delete the user in that project\'s console instead.');
  const temp = tempPassword(fill);
  await app.changePassword(email, key[which], temp);
  await hub.deleteKey(person.uid, pid);
  await hub.setLink(person.uid, pid, null);
  say(hub, 'handback', `${email}: ${nameOf(app)} handed back, with its own password again.`, { target: email, project: pid });
  return { status: 'handed-back', temp };
}

/**
 * Put this person in exactly one role in an app (null: on no list).
 *
 * Refused for an address that is not linked: listing an address that has no
 * account in the app's project lets anyone sign up as it and take the role,
 * because the app's rules trust the address. Linked first, listed second.
 */
export async function setRole({ hub, app, model, person, role }) {
  const pid = app.projectId;
  const email = tidyEmail(person.email);
  if (email === tidyEmail(hub.me().email)) throw new HubError('self', 'Your own role is changed by another master.');
  const link = person.links?.[pid];
  // Listed only behind a login: one the hub holds, or one that exists and its
  // owner will link (waiting). Never an address with no login at all.
  if (role !== null && !link?.linked && !link?.waiting) throw new HubError('not-linked', 'Link this login to the app before giving it a role there.');
  const doc = await app.readAccess();
  if (!doc) throw new HubError('missing', 'That app has no accounts list yet. Set it up in the app first.');
  const ops = [...pinOps(model, doc), ...roleOps(model, doc, email, role)];
  if (ops.length) await app.listOps(ops);
  if (link?.linked || link?.waiting) await hub.setLink(person.uid, pid, { ...link, role, ...stamp(hub) });
  if (ops.length) say(hub, 'role', role ? `${email} is now ${roleLabel(model, role)} in ${nameOf(app)}.` : `${email} has no role in ${nameOf(app)} now.`, { target: email, project: pid });
  return { status: 'saved', changed: ops.length > 0 };
}

/**
 * Prove the link, then give the role.
 *
 * An existing login the hub does not hold (`legacy`) no longer stops the
 * role: the app becomes the person's, WAITING, and they link it themselves on
 * first open. That is safe to list, because the login exists, so nobody can
 * sign up as the address. A project that makes no logins from a browser
 * (`console`) still comes back to the caller.
 *
 * The link is PROVED every time a role is given, never read off the hub's own
 * note of it: the app account may have been deleted, or given another password
 * by a reset email, since it was linked. Listing an address with no working
 * login behind it is the very gap this closes, so the note is not enough.
 * Taking a role away needs no link.
 */
export async function giveRole({ hub, app, model, person, role, fill }) {
  if (tidyEmail(person.email) === tidyEmail(hub.me().email)) throw new HubError('self', 'Your own role is changed by another master.');
  let p = person;
  if (role !== null) {
    const pid = app.projectId;
    const r = await ensureLink({ hub, app, person: p, fill });
    if (r.status === 'legacy') {
      await markWaiting({ hub, person: p, projectId: pid, app });
      p = { ...p, links: { ...p.links, [pid]: { ...p.links?.[pid], linked: undefined, waiting: true } } };
      return { ...(await setRole({ hub, app, model, person: p, role })), waiting: true };
    }
    if (r.status !== 'linked') return r;
    p = { ...p, links: { ...p.links, [pid]: { ...p.links?.[pid], waiting: undefined, linked: true, role: p.links?.[pid]?.role ?? null } } };
  }
  return setRole({ hub, app, model, person: p, role });
}

/** Tick or untick the tile of an app that has not joined the hub yet. */
export async function setPlain({ hub, person, projectId, on }) {
  await hub.setLink(person.uid, projectId, on ? { plain: true, ...stamp(hub) } : null);
  return { status: 'saved' };
}

/**
 * A new person: a hub login with a temporary password, and their directory
 * entry. Returns { uid, temp }; the password is shown once and passed on.
 *
 * An address that already has a hub login the directory does not know is NOT
 * adopted: the hub did not make it, so it may be somebody who signed up as
 * that address. `adoptPerson` takes it only with its password.
 */
export async function createPerson({ hub, email, name, fill }) {
  const e = tidyEmail(email);
  if (!isEmail(e)) throw new HubError('invalid', 'That does not look like an email address.');
  if ((await hub.listPeople()).some((p) => tidyEmail(p.email) === e)) throw new HubError('exists', `${e} is already in the hub.`);
  const temp = tempPassword(fill);
  let uid;
  try {
    uid = await hub.createLogin(e, temp);
  } catch (err) {
    if (kindOf(err) === 'exists') throw new HubError('login-exists', `${e} already has a hub login that is not in the directory. If you did not expect that, delete it in the hub project's console and add it again.`);
    throw err;
  }
  await hub.createPerson(uid, { email: e, name: String(name ?? '').trim(), links: {}, disabled: false, createdAt: hub.now(), createdBy: hub.me().uid });
  say(hub, 'person', `${e} added.`, { target: e });
  return { uid, temp };
}

/** Put an existing hub login in the directory, by proving its password. */
export async function adoptPerson({ hub, email, name, password }) {
  const e = tidyEmail(email);
  const uid = await hub.checkLogin(e, password);
  if (await hub.getPerson(uid)) throw new HubError('exists', `${e} is already in the hub.`);
  await hub.createPerson(uid, { email: e, name: String(name ?? '').trim(), links: {}, disabled: false, createdAt: hub.now(), createdBy: hub.me().uid });
  say(hub, 'person', `${e} added (existing login).`, { target: e });
  return { uid };
}

/**
 * Take a person off everything.
 *
 * Off every app's lists the acting master may edit (the rules read the lists,
 * so that is immediate), a new key for every link (their devices drop within
 * the hour, and a key they may have copied is dead), and the directory entry
 * disabled, so no device of theirs can fetch a key again. Nothing is deleted:
 * adding them back is un-disabling and giving the roles again.
 *
 * `apps` is { [pid]: { app, model } } for every project that could be reached.
 * Returns { [pid]: 'ok' | <kind of what failed> } so the screen can say what
 * is left to do by hand.
 */
export async function removePerson({ hub, person, apps, fill }) {
  const email = tidyEmail(person.email);
  if (email === tidyEmail(hub.me().email)) throw new HubError('self', 'You cannot remove yourself; another master can.');
  const results = {};
  for (const [pid, link] of Object.entries(person.links ?? {})) {
    if (link.plain) { await hub.setLink(person.uid, pid, null); results[pid] = 'ok'; continue; }
    const a = apps[pid];
    if (!a) { results[pid] = 'unreachable'; continue; }
    let failed = null;
    if (a.model && !a.model.fixed) {
      try {
        const doc = await a.app.readAccess();
        const ops = doc ? [...pinOps(a.model, doc), ...roleOps(a.model, doc, email, null)] : [];
        if (ops.length) await a.app.listOps(ops);
        await hub.setLink(person.uid, pid, { ...link, role: null, ...stamp(hub) });
      } catch (e) { failed = kindOf(e); }
    }
    // A login still waiting for its owner was never given the key: nothing to replace.
    if (link.linked) {
      try { await rotateLink({ hub, app: a.app, person, fill }); }
      catch (e) { failed = failed ?? kindOf(e); }
    }
    results[pid] = failed ?? 'ok';
  }
  await hub.patchPerson(person.uid, { disabled: true });
  say(hub, 'remove', `${email} removed.`, { target: email });
  return results;
}

/** Undo the disabling. Roles are given again one by one. */
export async function restorePerson({ hub, person }) {
  await hub.patchPerson(person.uid, { disabled: false });
  say(hub, 'person', `${tidyEmail(person.email)} restored.`, { target: tidyEmail(person.email) });
  return { status: 'saved' };
}

/**
 * A forgotten password, the house way: the hub login was deleted in the
 * console, and this makes it again. The new login has a new uid, so the
 * directory entry and every key move to it; nothing in any app changes.
 *
 * Copy first, delete last, and the new entry remembers where it came from
 * (`rebindFrom`) until the move is finished, so a second run picks up where a
 * closed tab left off. Returns { uid, temp } (temp is null on such a second
 * run: the password shown the first time is gone, and it is made again).
 */
export async function rebindPerson({ hub, person, fill }) {
  const email = tidyEmail(person.email);
  const people = await hub.listPeople();
  let fresh = people.find((p) => p.rebindFrom === person.uid) ?? null;
  let temp = null;
  if (!fresh) {
    temp = tempPassword(fill);
    let uid;
    try {
      uid = await hub.createLogin(email, temp);
    } catch (e) {
      if (kindOf(e) === 'exists') throw new HubError('login-exists', `${email} still has its hub login. Delete it in the hub project's console (Authentication, Users) first, then press this again.`);
      throw e;
    }
    fresh = { ...person, uid, rebindFrom: person.uid };
    await hub.createPerson(uid, {
      email, name: person.name ?? '', links: person.links ?? {}, disabled: Boolean(person.disabled),
      createdAt: person.createdAt ?? hub.now(), createdBy: person.createdBy ?? hub.me().uid, rebindFrom: person.uid,
    });
  }
  const keys = await hub.listKeys(person.uid);
  for (const [pid, key] of Object.entries(keys)) await hub.putKey(fresh.uid, pid, key);
  for (const pid of Object.keys(keys)) await hub.deleteKey(person.uid, pid);
  await hub.deletePerson(person.uid);
  await hub.patchPerson(fresh.uid, { rebindFrom: null });
  say(hub, 'person', `${email}: login made again.`, { target: email });
  return { uid: fresh.uid, temp };
}
