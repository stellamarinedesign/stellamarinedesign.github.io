// matrix.js - the Accounts grid, as data: people down, apps across.
//
// Pure: it is handed the registry, the hub's people and whatever each app's
// lists document came back as, and says what each cell is. The view draws it.
//
// WHO IS THE TRUTH. For a ROLE, the app's own document: its rules read that,
// and the hub's note of the role is only a copy for drawing tiles. For a LINK,
// the hub's directory: only the hub knows whether it holds a key.
//
// A cell's state:
//   ok       linked, and on one of the app's lists
//   linked   linked, on no list (can sign in there, sees nothing)
//   waiting  assigned to them; they have a login there from before the hub
//            and link it themselves the first time they open the app
//   loose    on a list, NOT linked and not waiting: an old login nobody has
//            dealt with, or an address with no login at all, which anyone
//            could sign up as
//   none     nothing
//   on, off  the tile tick of an app that has not joined

import { tidyEmail } from './keys.js';
import { roleOf, isMaster, rows as accessRows, normalise } from './access.js';

/**
 * @param {object} o
 * @param {object} o.projects  the registry's PROJECTS
 * @param {object} o.joined    { [pid]: boolean } which apps load the core
 * @param {object[]} o.people  the hub directory
 * @param {object} o.access    { [pid]: { doc } | { error: kind } } what each joined app answered
 * @param {{uid, email}} o.me  the acting master
 */
export function buildGrid({ projects, joined, people, access, me }) {
  const myEmail = tidyEmail(me?.email);
  const columns = Object.entries(projects).map(([pid, p]) => {
    const got = access?.[pid];
    const kind = !joined?.[pid] ? 'plain' : (p.access?.fixed ? 'fixed' : 'roles');
    const doc = got?.doc ?? null;
    return {
      pid,
      title: p.title,
      short: p.short,
      stage: p.stage,
      kind,
      roles: kind === 'roles' ? p.access.roles.map((r) => ({ id: r.id, label: r.label })) : [],
      // The acting master can change this app's lists only as a master THERE.
      canEdit: kind === 'roles' && Boolean(doc) && isMaster(p.access, doc, myEmail),
      problem: kind === 'roles' && !doc ? (got?.error ?? 'loading') : null,
      masters: kind === 'roles' && doc ? normalise(p.access, doc).masters : [],
    };
  });

  const known = new Set();
  const rows = [...people]
    .sort((a, b) => Number(Boolean(a.disabled)) - Number(Boolean(b.disabled)) || String(a.name || a.email).localeCompare(String(b.name || b.email)))
    .map((person) => {
      const email = tidyEmail(person.email);
      const self = email === myEmail;
      known.add(email);
      const cells = {};
      for (const c of columns) {
        const link = person.links?.[c.pid] ?? null;
        if (c.kind === 'plain') { cells[c.pid] = { state: link?.plain ? 'on' : 'off' }; continue; }
        const linked = Boolean(link?.linked);
        const waiting = !linked && Boolean(link?.waiting);
        // A tile tick from before the app joined, still standing because the person is not linked yet.
        const plain = !linked && !waiting && Boolean(link?.plain);
        if (c.kind === 'fixed') { cells[c.pid] = { state: linked ? 'ok' : waiting ? 'waiting' : 'none', linked, waiting, role: null, plain, canLink: !linked && !waiting }; continue; }
        const doc = access?.[c.pid]?.doc ?? null;
        const role = doc ? roleOf(projects[c.pid].access, doc, email) : (link?.role ?? null);
        const state = waiting ? 'waiting' : role ? (linked ? 'ok' : 'loose') : (linked ? 'linked' : 'none');
        cells[c.pid] = {
          state,
          linked,
          waiting,
          role,
          plain,
          // Where a Link button belongs. On a listed address with no link
          // behind it. And on the acting master's OWN cell while this app's
          // lists cannot be read because they are not linked to it themselves:
          // that is the way in, since nothing else in the column works until
          // they are (their own role there is the app's to say, not the hub's).
          canLink: !linked && (state === 'loose' || (self && c.problem === 'not-linked')),
          master: doc ? isMaster(projects[c.pid].access, doc, email) : false,
          // The hub's copy is behind the app's list: the view quietly corrects it.
          stale: Boolean(doc) && (linked || waiting) && (link.role ?? null) !== role,
        };
      }
      return { uid: person.uid, email, name: person.name || '', disabled: Boolean(person.disabled), self, cells };
    });

  // Addresses on an app's lists that the hub has no person for.
  const strays = new Map();
  for (const c of columns) {
    if (c.kind !== 'roles') continue;
    const doc = access?.[c.pid]?.doc;
    if (!doc) continue;
    for (const r of accessRows(projects[c.pid].access, doc)) {
      if (known.has(r.email)) continue;
      if (!strays.has(r.email)) strays.set(r.email, { email: r.email, cells: {} });
      strays.get(r.email).cells[c.pid] = { role: r.role, master: r.master };
    }
  }

  return { columns, rows, strays: [...strays.values()].sort((a, b) => a.email.localeCompare(b.email)) };
}

/**
 * The hub's copies of roles that the apps' own lists say otherwise: one entry
 * per linked person and app, for the screen to write back. The app's list is
 * the truth (its rules read it); the hub's copy only draws tiles and the
 * switcher. Without this, a role given inside the app, or held before the
 * person was linked, would never reach their tile. Removed people are left
 * alone. Each entry: { uid, pid, role } (role null: on none of its lists).
 */
export function staleLinks(grid) {
  const out = [];
  for (const r of grid.rows) {
    if (r.disabled) continue;
    for (const [pid, c] of Object.entries(r.cells)) if (c.stale) out.push({ uid: r.uid, pid, role: c.role ?? null });
  }
  return out;
}

/**
 * Links still waiting for their owner that the owner says are done: their
 * own record (`self/{uid}.linked`) names the app. The screen proves each one
 * (one sign-in with the key) before calling it linked. `self` is
 * { uid: { linked: { pid: iso } } }.
 */
export function claimedLinks(grid, self = {}) {
  const out = [];
  for (const r of grid.rows) {
    if (r.disabled) continue;
    for (const [pid, c] of Object.entries(r.cells)) if (c.waiting && self[r.uid]?.linked?.[pid]) out.push({ uid: r.uid, pid });
  }
  return out;
}

/** How many cells are `loose`, people and strays together: the number the screen warns with. */
export function looseCount(grid) {
  let n = 0;
  for (const r of grid.rows) for (const c of Object.values(r.cells)) if (c.state === 'loose') n += 1;
  for (const s of grid.strays) n += Object.values(s.cells).filter((c) => c.role).length;
  return n;
}

// Which apps a login has lives with the registry, where the core can reach it
// without loading this file.
export { appsFromLinks } from './registry.js';
