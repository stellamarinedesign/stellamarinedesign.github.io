// registry.js - the apps the hub knows, as a file.
//
// A FILE, NOT A DATABASE RECORD. Adding an app is a commit that somebody
// reviews, and nobody can repoint an app, or add one, from a browser.
//
// PROJECTS are Firebase projects: one per app (material ordering has two, live
// and test). A project's `config` is the set of PUBLIC identifiers its own
// site already publishes; every browser needs them to talk to Firebase and
// they protect nothing. What protects an app is its sign-in and its rules.
// GitHub secret scanning flags every "AIzaSy..." string: a Firebase web key is
// public by design, so close that alert as a false positive and never rotate
// the key.
//
// No address of any person belongs in this file or anywhere in this repo.
//
//   joined   the app's site loads the hub's core and signs in through it.
//            Until then its tile is a plain link to the app's own sign-in,
//            and a hub master ticks who sees it.
//   stage    'live' for everyone who has it, 'dev' for hub masters only.
//   access   how the app's settings/access document is laid out (js/access.js).
//            `fixed: true` means the app's roles are not a document the hub
//            can edit (workshop drawings): the hub links logins and no more.
//   appCheck the app's reCAPTCHA v3 SITE key, when its project enforces App
//            Check. Also public; the secret half never leaves the console.
//   card     the address of the app's overview card module, once it has one.
//   home     where a tile goes: a default, and overrides by role.

// THE HUB'S NAME, in one place. It began as a working name and may yet change:
// `python tools/rename.py "New Name"` rewrites it here and in the few static
// files that cannot read this one (page titles, the web manifest).
export const HUB_NAME = 'Hubinator';

export const GROUPS = ['Production', 'Design', 'Tools'];

export const PROJECTS = {
  'production-scheduling-stella': {
    title: 'Production board',
    short: 'Board',
    group: 'Production',
    icon: 'board',
    stage: 'live',
    joined: false,
    home: { default: '/Production-Scheduling/' },
    pages: [
      { title: 'Parts', href: '/Production-Scheduling/parts' },
      { title: 'Vessel codes', href: '/Production-Scheduling/vessel-codes', roles: ['manager', 'engineer', 'tester'] },
    ],
    config: {
      apiKey: 'AIzaSyCzSwY2Pxet1bHZUPtEj93GzpytGhISwKg',
      authDomain: 'production-scheduling-stella.firebaseapp.com',
      projectId: 'production-scheduling-stella',
      appId: '1:397159853236:web:23133f8085d3a17f2e3be1',
    },
    appCheck: null,
    card: null,
    access: {
      doc: ['settings', 'access'],
      roles: [
        { id: 'manager', list: 'managers', label: 'Manager' },
        { id: 'engineer', list: 'engineers', label: 'Engineer' },
        { id: 'floor', list: 'floor', label: 'Floor' },
        { id: 'tester', list: 'testers', label: 'Tester' },
      ],
      precedence: ['tester', 'manager', 'engineer', 'floor'],
      masters: 'masters',
      fallback: 'managers',
    },
  },

  'material-ordering-41851': {
    title: 'Material ordering',
    short: 'Ordering',
    group: 'Production',
    icon: 'box',
    stage: 'live',
    joined: false,
    home: { default: '/material-ordering/', manager: '/material-ordering/manager.html' },
    pages: [
      { title: 'Consumables', href: '/material-ordering/consumables.html' },
      { title: 'Deliveries', href: '/material-ordering/warehouse.html' },
    ],
    config: {
      apiKey: 'AIzaSyBuh_oL3dUQ3qCU8qQQL3e7hBKfGhYdBds',
      authDomain: 'material-ordering-41851.firebaseapp.com',
      projectId: 'material-ordering-41851',
      appId: '1:999530935622:web:e6798dc5b4edbe54142147',
    },
    appCheck: '6LcvOCctAAAAAFXUhpQRg2c09P1g5l7qULqwZCbh',
    card: null,
    access: {
      doc: ['settings', 'access'],
      roles: [
        { id: 'manager', list: 'managers', label: 'Manager' },
        { id: 'engineer', list: 'engineers', label: 'Engineer' },
        { id: 'floor', list: 'floor', label: 'Floor' },
      ],
      precedence: ['manager', 'engineer', 'floor'],
      masters: 'masters',
      fallback: 'managers',
    },
  },

  // Material ordering's throwaway copy: its own users and its own lists. The
  // hub's proof runs against this one before anything touches a live app.
  // JOINED FOR THE PROOF: the page that has joined is lab/proof.html, a
  // stand-in built the way material ordering is built, so the tile goes there.
  // When material ordering itself joins, `home` goes back to
  // { default: '/material-ordering/', manager: '/material-ordering/manager.html' }.
  'material-ordering-testing': {
    title: 'Material ordering (test)',
    short: 'Ordering test',
    group: 'Production',
    icon: 'box',
    stage: 'dev',
    joined: true,
    home: { default: '/lab/proof.html' },
    pages: [],
    config: {
      apiKey: 'AIzaSyA-FhiK3Lr4-ioifSGJ7OvtTRwmmZfDrMY',
      authDomain: 'material-ordering-testing.firebaseapp.com',
      projectId: 'material-ordering-testing',
      appId: '1:165316963515:web:4916fe002bab1b45cf8d9e',
    },
    appCheck: '6LcvOCctAAAAAFXUhpQRg2c09P1g5l7qULqwZCbh',
    card: null,
    access: {
      doc: ['settings', 'access'],
      roles: [
        { id: 'manager', list: 'managers', label: 'Manager' },
        { id: 'engineer', list: 'engineers', label: 'Engineer' },
        { id: 'floor', list: 'floor', label: 'Floor' },
      ],
      precedence: ['manager', 'engineer', 'floor'],
      masters: 'masters',
      fallback: 'managers',
    },
  },

  'stella-design-scheduling': {
    title: 'Design scheduling',
    short: 'Design',
    group: 'Design',
    icon: 'pencil',
    stage: 'live',
    // Joined 23 Nov 2026: its site signs in through the hub from v2026-11-23.3.
    joined: true,
    home: { default: '/design-scheduling/' },
    pages: [],
    config: {
      apiKey: 'AIzaSyDNzGoZiogOQhr6OALckHAmlqYe8c36o84',
      authDomain: 'stella-design-scheduling.firebaseapp.com',
      projectId: 'stella-design-scheduling',
      appId: '1:663047303134:web:55114e9203e3d7a344774f',
    },
    appCheck: null,
    card: null,
    access: {
      doc: ['settings', 'access'],
      roles: [
        { id: 'lead', list: 'leads', label: 'Design lead' },
        { id: 'designer', list: 'designers', label: 'Designer' },
        { id: 'manager', list: 'managers', label: 'Manager contributor' },
        { id: 'contributor', list: 'contributors', label: 'Contributor' },
      ],
      precedence: ['lead', 'designer', 'manager', 'contributor'],
      masters: 'masters',
      fallback: 'leads',
    },
  },

  'stella-workshop-drawings': {
    title: 'Workshop drawings',
    short: 'Drawings',
    group: 'Design',
    icon: 'sheet',
    stage: 'live',
    joined: false,
    home: { default: '/stella-workshop-drawings/' },
    pages: [],
    config: {
      apiKey: 'AIzaSyDKtfyXxWzu8rOMiJP2qcvRObxnJEUQz5A',
      authDomain: 'stella-workshop-drawings.firebaseapp.com',
      projectId: 'stella-workshop-drawings',
      appId: '1:674286300074:web:17c1fe44f2bb07178a99d3',
    },
    appCheck: null,
    card: null,
    // Its editors are named in its rules, and sign-up is off in its project:
    // nothing here for the hub to edit, and a new login is added in its
    // console with the key the hub shows.
    access: { fixed: true },
  },
};

export const projectIds = () => Object.keys(PROJECTS);
export const project = (id) => PROJECTS[id] ?? null;

/** Where this project's tile goes for a person with this role there. */
export function homeFor(id, role) {
  const p = PROJECTS[id];
  if (!p) return '/';
  return (role && p.home[role]) || p.home.default;
}

/**
 * The tiles a login sees, in group order. `apps` is the map the hub keeps for
 * a person: project id -> role id, or 'link' for an app that has not joined.
 * A 'dev' project shows to hub masters only. A page with `roles` shows only to
 * those roles; one without shows to everyone who has the app.
 * @returns {{id, title, short, group, icon, href, role, joined, stage, current, pages}[]}
 */
export function tilesFor(apps, { master = false, current = null, joined = null, demo = false } = {}) {
  const out = [];
  for (const [id, p] of Object.entries(PROJECTS)) {
    const has = Object.prototype.hasOwnProperty.call(apps ?? {}, id);
    if (!has) continue;
    if (p.stage === 'dev' && !master) continue;
    const role = apps[id] === 'link' || apps[id] === true ? null : apps[id];
    const model = p.access?.fixed ? null : p.access;
    const isJoined = joined ? Boolean(joined[id]) : p.joined;
    out.push({
      id,
      title: p.title,
      short: p.short,
      group: p.group,
      icon: p.icon,
      // In the demo there are no apps to go to: every door opens the stand-in page.
      href: demo ? `/lab/app.html?app=${id}` : homeFor(id, role),
      role,
      roleLabel: role ? (model?.roles.find((r) => r.id === role)?.label ?? role) : '',
      joined: isJoined,
      // This person still signs in to it the old way: the app has not joined,
      // or it has and they have a tile tick but are not linked yet.
      own: !isJoined || (role === null && Boolean(model)),
      stage: p.stage,
      current: id === current,
      pages: (p.pages ?? [])
        .filter((pg) => !pg.roles || (role && pg.roles.includes(role)))
        .map((pg) => ({ title: pg.title, href: demo ? `/lab/app.html?app=${id}` : pg.href })),
    });
  }
  // Test projects after the real ones, then by group.
  return out.sort((a, b) => Number(a.stage === 'dev') - Number(b.stage === 'dev') || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
}

/**
 * The map the core keeps for a signed-in person: which apps they have, and as
 * what. An app that has joined counts once they have a ROLE there (or are
 * linked, for an app whose roles are fixed); one that has not joined counts
 * when a master has ticked its tile. Linked with no role is not an app you
 * have: you could sign in there and would see nothing.
 *
 * A TILE TICK OUTLIVES THE DAY THE APP JOINS. Logins are linked one at a time,
 * so a ticked person keeps their plain tile after the app has joined, until
 * they are linked (linking replaces the tick). Nobody's tile vanishes on the
 * day an app's patch ships.
 * @param {object} links   a person's `links` from the hub directory
 * @param {object} [joined] { [pid]: boolean }, to override the registry (the demo)
 * @returns {{ [pid]: string }} role id, or 'link'
 */
export function appsFromLinks(links, projects = PROJECTS, joined = null) {
  const out = {};
  for (const [pid, link] of Object.entries(links ?? {})) {
    const p = projects[pid];
    if (!p || !link) continue;
    if (link.plain) { out[pid] = 'link'; continue; }
    const isJoined = joined ? Boolean(joined[pid]) : Boolean(p.joined);
    // WAITING counts: the app is theirs, and opening it is how they link it.
    if (!isJoined || !(link.linked || link.waiting)) continue;
    if (p.access?.fixed) out[pid] = 'link';
    else if (link.role) out[pid] = link.role;
  }
  return out;
}

/**
 * Is the registry well formed? Returns a list of problems, empty when fine.
 * The tests run this, and it is also the guard that no address has crept in.
 */
export function problems(projects = PROJECTS) {
  const out = [];
  for (const [id, p] of Object.entries(projects)) {
    const at = (m) => out.push(`${id}: ${m}`);
    if (p.config?.projectId !== id) at('the key must be the Firebase project id');
    for (const k of ['apiKey', 'authDomain', 'appId']) if (!p.config?.[k]) at(`config.${k} is missing`);
    for (const k of ['title', 'short', 'icon']) if (!p[k]) at(`${k} is missing`);
    if (!GROUPS.includes(p.group)) at(`group "${p.group}" is not one of ${GROUPS.join(', ')}`);
    if (!['live', 'dev'].includes(p.stage)) at(`stage "${p.stage}" is not live or dev`);
    if (!p.home?.default?.startsWith('/')) at('home.default must be a path from the site root');
    if (!p.access) at('access is missing');
    else if (!p.access.fixed) {
      const m = p.access;
      const ids = (m.roles ?? []).map((r) => r.id);
      if (!ids.length) at('access.roles is empty');
      if (new Set(ids).size !== ids.length) at('access.roles repeats an id');
      if (new Set((m.roles ?? []).map((r) => r.list)).size !== ids.length) at('two roles share a list');
      for (const r of m.roles ?? []) if (!r.label || !r.list) at(`role ${r.id} needs a list and a label`);
      if (!m.masters) at('access.masters is missing');
      if (m.fallback && !(m.roles ?? []).some((r) => r.list === m.fallback)) at('access.fallback is not one of the role lists');
      for (const id2 of m.precedence ?? []) if (!ids.includes(id2)) at(`precedence names "${id2}", which is not a role`);
      for (const k of Object.keys(p.home)) if (k !== 'default' && !ids.includes(k)) at(`home.${k} is not a role`);
    }
    if (/[^\s"'`<>@]+@[^\s"'`<>@]+\.[a-z]{2,}/i.test(JSON.stringify({ ...p, config: undefined }))) at('contains what looks like an address');
  }
  return out;
}
