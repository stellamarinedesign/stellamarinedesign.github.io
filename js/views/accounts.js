// views/accounts.js - people down, apps across, for a hub master.
//
// Every cell is one person's place in one app: their ROLE there, in that
// app's own words, and whether the hub holds their sign-in for it (LINKED).
// The steps behind each control are in js/linking.js; this file only asks
// what the master wants, runs the step, says what happened, and draws the
// grid again from what is now true.
//
// LINKED FIRST, LISTED SECOND. A role is never given to an address the hub
// has not linked: an address on an app's list with no login behind it can be
// claimed by anyone who signs up as it. Addresses that are already listed
// that way (from before the hub) are flagged "Not linked".
//
// This screen is where somebody can be locked out by mistake, so nothing
// destructive happens on one click, and every refusal says what to do next.

import { el, icon, menu, copyText, withReveal } from '../ui.js';
import { openDialog, confirmDialog, promptDialog } from '../dialog.js';
import { PROJECTS, HUB_NAME } from '../registry.js';
import { buildGrid, looseCount, staleLinks, claimedLinks } from '../matrix.js';
import * as L from '../linking.js';
import { friendly, kindOf, HubError } from '../errors.js';
import { isEmail, tidyEmail } from '../keys.js';

let onlyLoose = false;

const WHY = {
  denied: 'You are not on its list',
  'not-linked': 'Link yourself first',
  // The acting master's own key was refused there: their own cell's menu has Check link.
  credential: 'Check your own link',
  missing: 'No list yet',
  network: 'Not reachable',
  loading: 'Loading',
};
const why = (c) => WHY[c.problem] ?? (c.problem ? 'Not reachable' : 'Only its own masters change its list');

async function load({ backend, me }) {
  const joined = backend.joined();
  const people = await backend.hub.listPeople();
  const access = {};
  await Promise.all(Object.entries(PROJECTS).map(async ([pid, p]) => {
    if (!joined[pid] || p.access.fixed) return;
    try {
      const doc = await backend.app(pid).readAccess();
      access[pid] = doc ? { doc } : { error: 'missing' };
    } catch (e) { access[pid] = { error: kindOf(e) }; }
  }));
  return { people, joined, grid: buildGrid({ projects: PROJECTS, joined, people, access, me }) };
}

/** Write back the hub's copies of roles that the apps' lists say otherwise. Returns true if any was written. */
async function catchUp({ backend, me, impl }, { people, grid }) {
  const { hub } = backend;
  let wrote = false;
  let mine = false;
  for (const s of staleLinks(grid)) {
    const link = people.find((p) => p.uid === s.uid)?.links?.[s.pid];
    if (!link?.linked) continue;
    try {
      await hub.setLink(s.uid, s.pid, { ...link, role: s.role, at: hub.now(), by: hub.me().uid });
      wrote = true;
      if (s.uid === me.uid) mine = true;
    } catch (e) { console.warn('[hub] role copy not brought up to date:', s.pid, kindOf(e)); }
  }
  // Links their owners say they have made, on first open: proved with one
  // sign-in with the key, and only then called linked.
  let self = {};
  try { self = await hub.listSelf(); } catch { self = {}; }
  for (const c of claimedLinks(grid, self)) {
    const person = people.find((p) => p.uid === c.uid);
    try {
      const r = await L.confirmClaim({ hub, app: backend.app(c.pid), person });
      if (r.status === 'linked') { wrote = true; if (c.uid === me.uid) mine = true; }
    } catch (e) { console.warn('[hub] could not check a link its owner made:', c.pid, kindOf(e)); }
  }
  if (mine) { try { await impl.refresh(); } catch { /* the note catches up at the next sign-in */ } }
  return wrote;
}

export async function render(view, ctx) {
  if (!view.querySelector('.grid-wrap')) {
    view.textContent = '';
    view.append(head(null), el('div', { 'aria-busy': 'true' }, el('span', { class: 'sr-only' }, 'Loading accounts'),
      el('div', { class: 'skel' }), el('div', { class: 'skel' }), el('div', { class: 'skel' }), el('div', { class: 'skel' })));
  }
  let data;
  try {
    data = await load(ctx);
    // The hub's copy of a role catches up with the app's own list, quietly:
    // it is a copy for drawing tiles, not a change anybody made.
    if (await catchUp(ctx, data)) data = await load(ctx);
  } catch (e) {
    view.textContent = '';
    view.append(el('div', { class: 'state-msg', role: 'alert' },
      el('h1', { class: 'h1' }, 'Accounts did not load'),
      el('p', {}, kindOf(e) === 'denied' ? 'This login is not a hub master.' : `${friendly(e)} If you are offline, it loads when the connection is back.`),
      el('button', { class: 'btn', type: 'button', onclick: () => render(view, ctx) }, 'Reload')));
    return;
  }
  draw(view, ctx, data);
}

function head(onAdd) {
  return el('div', { class: 'page-head' },
    el('h1', { class: 'h1' }, 'Accounts'),
    el('span', { class: 'sp' }),
    el('button', { class: 'btn primary', type: 'button', disabled: !onAdd, onclick: onAdd }, icon('plus', 16), 'Add person'));
}

function draw(view, ctx, { people, grid }) {
  const { backend, me } = ctx;
  const { hub } = backend;
  const personOf = (uid) => people.find((p) => p.uid === uid);

  /** Run a step, say what happened, and draw again from what is now true. */
  async function run(step) {
    const wrap = view.querySelector('.grid-wrap');
    wrap?.setAttribute('aria-busy', 'true');
    wrap?.setAttribute('inert', '');
    try {
      const said = await step();
      if (said) ctx.toast(said);
    } catch (e) {
      ctx.toast(friendly(e), { warn: true, ms: 9000 });
    }
    await render(view, ctx);
  }

  /**
   * A link that needs a person: an old login to take over now, or a project
   * that makes no logins from here. Resolves 'linked', 'waiting' (left for
   * its owner to link on first open) or null (cancelled).
   */
  async function finishLink(person, col, app, first) {
    let r = first;
    let error = '';
    while (r.status !== 'linked') {
      const answer = await linkHelpDialog({ person, col, status: r.status, key: r.key, error, self: person.uid === me.uid });
      if (!answer) return null;
      if (answer.waiting) { await L.markWaiting({ hub, person, projectId: col.pid, app }); return 'waiting'; }
      try {
        if (answer.password) r = await L.takeOver({ hub, app, person, currentPassword: answer.password });
        else {
          r = await L.ensureLink({ hub, app, person });
          error = r.status === 'linked' ? '' : 'That password does not sign in there yet. Check the user was added with exactly this one.';
        }
      } catch (e) { error = kindOf(e) === 'credential' ? 'That is not its password.' : friendly(e); }
    }
    if (person.uid === me.uid) await ctx.impl.refresh();
    return 'linked';
  }

  const act = {
    role: (row, col, role) => run(async () => {
      const person = personOf(row.uid);
      const app = backend.app(col.pid);
      const model = PROJECTS[col.pid].access;
      const r = await L.giveRole({ hub, app, model, person, role });
      let waiting = Boolean(r.waiting);
      if (r.status === 'legacy' || r.status === 'console') {
        const done = await finishLink(person, col, app, r);
        if (!done) return null;
        waiting = done === 'waiting';
        await L.setRole({ hub, app, model, person: await hub.getPerson(person.uid), role });
      }
      const label = col.roles.find((x) => x.id === role)?.label;
      if (!role) return `${row.email} has no role in ${col.title} now.`;
      return waiting ? `${row.email} is now ${label} in ${col.title}, and links their login the first time they open it.` : `${row.email} is now ${label} in ${col.title}.`;
    }),
    link: (row, col) => run(async () => {
      const person = personOf(row.uid);
      const app = backend.app(col.pid);
      const r = await L.ensureLink({ hub, app, person });
      if (r.status === 'linked') {
        if (person.uid === me.uid) await ctx.impl.refresh();
        return `${row.email} is linked to ${col.title}.`;
      }
      // Somebody else's login from before the hub: they link it themselves on first open.
      if (r.status === 'legacy' && person.uid !== me.uid) {
        await L.markWaiting({ hub, person, projectId: col.pid, role: row.cells[col.pid]?.role ?? null, app });
        return `${row.email} links their ${col.title} login the first time they open it.`;
      }
      const done = await finishLink(person, col, app, r);
      if (!done) return null;
      return done === 'waiting' ? `${row.email} links their ${col.title} login the first time they open it.` : `${row.email} is linked to ${col.title}.`;
    }),
    // Do now what the person would do on first open: type their login's password (theirs to give).
    takeOver: (row, col) => run(async () => {
      const person = personOf(row.uid);
      const done = await finishLink(person, col, backend.app(col.pid), { status: 'legacy' });
      return done === 'linked' ? `${row.email} is linked to ${col.title}.` : null;
    }),
    tile: (row, col, on) => run(async () => {
      await L.setPlain({ hub, person: personOf(row.uid), projectId: col.pid, on });
      if (row.uid === me.uid) await ctx.impl.refresh();
      return null;
    }),
    rotate: async (row, col) => {
      if (!await confirmDialog({ title: `New key for ${row.email} in ${col.title}?`, body: 'Its devices there sign in again at the hub screen within the hour.', ok: 'New key' })) return;
      run(async () => { await L.rotateLink({ hub, app: backend.app(col.pid), person: personOf(row.uid) }); return `${row.email} has a new key for ${col.title}.`; });
    },
    handBack: async (row, col) => {
      if (!await confirmDialog({ title: `Hand ${col.title} back to ${row.email}?`, body: `Its login there gets a password of its own again and the hub forgets its key. ${HUB_NAME} will no longer sign it in to ${col.title}.`, ok: 'Hand back', destructive: true })) return;
      run(async () => {
        const r = await L.handBack({ hub, app: backend.app(col.pid), person: personOf(row.uid) });
        if (row.uid === me.uid) await ctx.impl.refresh();
        await onceDialog({ title: `${col.title} handed back`, lede: `${row.email} signs in to ${col.title} with this password now.`, label: 'Temporary password', secret: r.temp });
        return null;
      });
    },
    copyKey: async (row, col, button) => {
      try { const k = await hub.getKey(row.uid, col.pid); if (k) await copyText(k.k, button); }
      catch (e) { ctx.toast(friendly(e), { warn: true }); }
    },
    rename: async (row) => {
      const name = await promptDialog({ title: `Name for ${row.email}`, label: 'Name', value: row.name, required: false, validate: (v) => (v.length > 80 ? 'Keep it under 80 characters.' : null) });
      if (name === null) return;
      run(async () => { await hub.patchPerson(row.uid, { name }); if (row.uid === me.uid) await ctx.impl.refresh(); return null; });
    },
    rotateAll: async (row) => {
      const cols = grid.columns.filter((c) => row.cells[c.pid].linked);
      if (!await confirmDialog({ title: `New keys for ${row.email}?`, body: `In ${cols.map((c) => c.title).join(', ')}. Its devices sign in again at the hub screen within the hour.`, ok: 'New keys' })) return;
      run(async () => {
        const failed = [];
        for (const c of cols) { try { await L.rotateLink({ hub, app: backend.app(c.pid), person: personOf(row.uid) }); } catch { failed.push(c.title); } }
        if (failed.length) throw new HubError('partial', `Not replaced in ${failed.join(', ')}. Try those again.`);
        return `${row.email} has new keys everywhere.`;
      });
    },
    remove: async (row) => {
      if (!await confirmDialog({ title: `Remove ${row.email}?`, body: 'Off every app\'s list, a new key everywhere, and no more keys for this login. Nothing is deleted: Restore brings the login back, and its roles are given again.', ok: 'Remove', destructive: true })) return;
      run(async () => {
        const apps = Object.fromEntries(grid.columns.filter((c) => c.kind !== 'plain').map((c) => [c.pid, { app: backend.app(c.pid), model: PROJECTS[c.pid].access }]));
        const results = await L.removePerson({ hub, person: personOf(row.uid), apps });
        const left = Object.entries(results).filter(([, r]) => r !== 'ok').map(([pid]) => PROJECTS[pid].title);
        if (left.length) throw new HubError('partial', `${row.email} is removed from the hub, but check ${left.join(', ')}: its list or key could not be changed from here.`);
        return `${row.email} removed.`;
      });
    },
    restore: (row) => run(async () => { await L.restorePerson({ hub, person: personOf(row.uid) }); return `${row.email} restored. Give its roles again.`; }),
    remake: async (row) => {
      if (!await confirmDialog({ title: `Make ${row.email}'s login again?`, body: 'For a forgotten password. First delete that user in the hub project\'s Firebase console (Authentication, Users). This then makes it again with a temporary password; its apps and roles stay as they are.', ok: 'Make login' })) return;
      run(async () => {
        const r = await L.rebindPerson({ hub, person: personOf(row.uid) });
        if (r.temp) await onceDialog({ title: `Login made again for ${row.email}`, lede: 'They sign in with this and change it under the cog.', label: 'Temporary password', secret: r.temp });
        return r.temp ? null : `${row.email}'s login was already made again. If its password is lost, delete the user and do this once more.`;
      });
    },
    add: async (email = '') => {
      const made = await addPersonDialog({ hub, email });
      if (made?.temp) await onceDialog({ title: `Login made for ${made.email}`, lede: 'They sign in with this and change it under the cog.', label: 'Temporary password', secret: made.temp });
      if (made) await render(view, ctx);
    },
  };

  const loose = looseCount(grid);
  // Only people can be filtered to. Addresses the hub has no person for are in
  // their own list under the grid, which is always shown; when they are all
  // there is, the warning says so and offers no filter (it would empty the grid).
  const looseRows = grid.rows.filter((r) => Object.values(r.cells).some((c) => c.state === 'loose'));
  if (!looseRows.length) onlyLoose = false;
  const rows = onlyLoose ? looseRows : grid.rows;

  view.textContent = '';
  view.append(head(() => act.add()));
  if (loose) {
    const text = looseRows.length
      ? (loose === 1 ? '1 address is on an app\'s list without a linked login.' : `${loose} addresses are on an app's list without a linked login.`)
      : (loose === 1 ? '1 address is on an app\'s list but not in the hub. It is listed below.' : `${loose} addresses are on an app's list but not in the hub. They are listed below.`);
    view.append(el('div', { class: 'callout amber', role: 'status' },
      icon('bang', 18),
      el('span', { class: 'callout-text' }, text),
      looseRows.length
        ? el('button', { class: 'btn small', type: 'button', 'aria-pressed': String(onlyLoose), onclick: () => { onlyLoose = !onlyLoose; draw(view, ctx, { people, grid }); } }, onlyLoose ? 'Show everyone' : 'Show only these')
        : null));
  }

  const table = el('table', { class: 'acct' },
    el('caption', { class: 'sr-only' }, 'People and their role in each app'),
    el('thead', {}, el('tr', {},
      el('th', { class: 'who-col', scope: 'col' }, 'Person'),
      grid.columns.map((c) => {
        // What is unusual about a column sits above its name, so the names stay on one line.
        const notes = [
          c.kind === 'plain' ? el('span', { class: 'chip outline' }, 'Not joined') : null,
          c.problem ? el('span', { class: 'chip amber' }, why(c)) : null,
        ].filter(Boolean);
        return el('th', { scope: 'col', title: c.title }, notes.length ? el('div', { class: 'th-notes' }, notes) : null, c.short);
      }))),
    el('tbody', {}, rows.map((r) => rowNode(r, grid.columns, act))));
  // The grid scrolls sideways inside its own frame. While columns remain to
  // the right, the frame's trailing edge fades (css/hub.css, .grid-shell.more).
  const wrap = el('div', { class: 'grid-wrap' }, table);
  const shell = el('div', { class: 'grid-shell' }, wrap);
  const cue = () => shell.classList.toggle('more', wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 1);
  wrap.addEventListener('scroll', cue, { passive: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(cue).observe(wrap);
  view.append(shell);
  cue();

  if (grid.strays.length) {
    view.append(
      el('h2', { class: 'h2' }, 'On an app\'s list, not in the hub'),
      // A list, not a table: each row wraps by itself on a narrow screen.
      el('ul', { class: 'strays' }, grid.strays.map((s) => el('li', {},
        el('span', { class: 's-mail' }, s.email),
        el('span', { class: 's-on' }, Object.entries(s.cells).map(([pid, c]) => {
          const p = PROJECTS[pid];
          const label = p.access.roles.find((x) => x.id === c.role)?.label ?? (c.master ? 'Master' : '');
          return el('span', { class: 'chip' }, `${p.short}: ${label}`);
        })),
        el('button', { class: 'btn small', type: 'button', 'aria-label': `Add ${s.email} as a person`, onclick: () => act.add(s.email) }, 'Add person')))));
  }
}

function rowNode(row, columns, act) {
  const more = el('button', { class: 'ib', type: 'button', 'aria-label': `More for ${row.email}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more'));
  more.addEventListener('click', () => menu(more, [
    { heading: row.email },
    { label: 'Name', icon: 'pencil', onSelect: () => act.rename(row) },
    { label: 'New keys everywhere', icon: 'key', disabled: row.disabled || !Object.values(row.cells).some((c) => c.linked), onSelect: () => act.rotateAll(row) },
    { label: 'Make login again', icon: 'restore', onSelect: () => act.remake(row) },
    'sep',
    row.disabled
      ? { label: 'Restore', icon: 'restore', onSelect: () => act.restore(row) }
      : { label: 'Remove', icon: 'trash', danger: true, disabled: row.self, onSelect: () => act.remove(row) },
  ], { label: `More for ${row.email}` }));

  // The person's own menu sits with the person, in the column that stays put
  // while the apps scroll: it is on screen at every width.
  return el('tr', { class: row.disabled ? 'off' : null },
    el('td', { class: 'who-col' }, el('div', { class: 'person' },
      el('div', { class: 'person-id' },
        el('div', { class: 'p-name' }, el('span', {}, row.name || row.email.split('@')[0]),
          row.self ? el('span', { class: 'chip' }, 'You') : null,
          row.disabled ? el('span', { class: 'chip outline' }, 'Removed') : null),
        el('div', { class: 'p-mail' }, row.email)),
      more)),
    columns.map((c) => el('td', {}, cellNode(row, c, row.cells[c.pid], act))));
}

function cellNode(row, col, cell, act) {
  const out = el('div', { class: 'cell' });
  const who = row.name || row.email;

  if (col.kind === 'plain') {
    const box = el('input', { type: 'checkbox', checked: cell.state === 'on', disabled: row.disabled, 'aria-label': `Show ${col.title} to ${who}` });
    box.addEventListener('change', () => act.tile(row, col, box.checked));
    out.append(el('label', { class: 'check' }, box, 'Tile'));
    return out;
  }

  if (col.kind === 'roles') {
    const sel = el('select', { class: 'sel', 'aria-label': `${who} in ${col.title}` },
      el('option', { value: '' }, 'None'),
      col.roles.map((r) => el('option', { value: r.id, selected: r.id === cell.role }, r.label)));
    sel.disabled = !col.canEdit || row.self || row.disabled;
    if (row.self) sel.title = 'Your own role is changed by another master.';
    else if (!col.canEdit) sel.title = why(col);
    sel.addEventListener('change', () => act.role(row, col, sel.value || null));
    out.append(sel);
  }

  if (cell.linked) {
    // ONE control per link. Where there is no role to say it (linked with no
    // role, or an app whose roles are fixed) the word "Linked" is the button;
    // beside a role, the dots are.
    const label = `${who}'s link to ${col.title}`;
    const words = col.kind === 'fixed' || cell.state === 'linked';
    const more = words
      ? el('button', { class: 'chip outline chip-btn', type: 'button', 'aria-label': `Linked. ${label}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, 'Linked', icon('more', 14))
      : el('button', { class: 'ib', type: 'button', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more', 16));
    more.addEventListener('click', () => menu(more, [
      { heading: col.title },
      // Proves the app account still answers to its key, and mends it if not.
      { label: 'Check link', icon: 'link', onSelect: () => act.link(row, col) },
      { label: 'New key', icon: 'key', onSelect: () => act.rotate(row, col) },
      col.kind === 'fixed' ? { label: 'Copy key', icon: 'copy', onSelect: () => act.copyKey(row, col, null) } : null,
      'sep',
      { label: 'Hand back', danger: true, onSelect: () => act.handBack(row, col) },
    ], { label }));
    out.append(more);
  } else if (cell.waiting && !row.self && !row.disabled) {
    // Assigned; its owner links their old login the first time they open the app.
    const label = `${who}'s ${col.title} login`;
    const chip = el('button', {
      class: 'chip outline chip-btn', type: 'button', title: `${who} links it the first time they open ${col.title}`,
      'aria-label': `Waiting for ${who} to link it. ${label}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    }, 'Waiting', icon('more', 14));
    chip.addEventListener('click', () => menu(chip, [
      { heading: col.title },
      { label: 'Check link', icon: 'link', onSelect: () => act.link(row, col) },
      { label: 'Take over now', icon: 'key', onSelect: () => act.takeOver(row, col) },
    ], { label }));
    out.append(chip);
  } else if (!row.disabled && (cell.canLink || (cell.waiting && row.self))) {
    // Amber where it wants doing: an address on the app's list with no link
    // behind it, or the master's own cell in an app they must link themselves
    // to before its column can be read at all (js/matrix.js).
    const wants = col.kind !== 'fixed';
    out.append(el('button', {
      class: `btn small${wants ? ' amber' : ''}`, type: 'button',
      'aria-label': `${cell.state === 'loose' ? 'Not linked. ' : ''}Link ${row.self ? 'yourself' : who} to ${col.title}`,
      onclick: () => act.link(row, col),
    }, 'Link'));
  }
  // A tile tick from before this app joined, on somebody neither listed nor
  // linked: they keep the tile until it is taken away here. (Somebody listed
  // gets Link instead, and linking replaces the tick.)
  if (cell.plain && cell.state === 'none' && !row.disabled) {
    const box = el('input', { type: 'checkbox', checked: true, 'aria-label': `Show ${col.title} to ${who} until linked` });
    box.addEventListener('change', () => act.tile(row, col, box.checked));
    out.append(el('label', { class: 'check', title: 'Keeps its tile, with its own sign-in, until linked' }, box, 'Tile'));
  }
  return out;
}

// ---------------------------------------------------------------------------
// dialogs
// ---------------------------------------------------------------------------

/** Something shown ONCE: a temporary password. It goes when the dialog closes. */
function onceDialog({ title, lede, label, secret }) {
  return openDialog((box, close) => {
    const copy = el('button', { class: 'btn small', type: 'button' }, 'Copy');
    copy.addEventListener('click', () => copyText(secret, copy));
    box.append(
      el('h3', {}, title),
      el('p', { class: 'lede' }, lede),
      el('div', { class: 'fresh' }, el('span', { class: 'cap' }, label), el('div', { class: 'fresh-line' }, el('code', {}, secret), copy)),
      el('p', { class: 'hint' }, 'Shown once. It goes when this closes.'),
      el('div', { class: 'actions' }, el('button', { class: 'btn primary', type: 'button', 'data-autofocus': '', onclick: () => close(true) }, 'Done')));
  }, { label: title, guard: true });
}

/** A new person: their address and a name. Resolves { email, temp } once the login is made, or null. */
function addPersonDialog({ hub, email = '' }) {
  return openDialog((box, close, guard) => {
    const mail = el('input', { class: 'input', id: 'apEmail', type: 'email', autocomplete: 'off', spellcheck: 'false', value: email });
    const name = el('input', { class: 'input', id: 'apName', type: 'text', autocomplete: 'off', maxlength: '80' });
    const theirs = el('input', { class: 'input', id: 'apPass', type: 'password', autocomplete: 'off' });
    const adopt = el('div', { class: 'field', hidden: true }, el('label', { for: 'apPass' }, 'Its password'), withReveal(theirs));
    const err = el('div', { class: 'form-err', id: 'apErr', role: 'alert' });
    const go = el('button', { class: 'btn primary', type: 'button' }, 'Add');
    // The field an error is about is marked as well as focused, so it is seen and heard as the one at fault.
    const fail = (message, at) => {
      err.textContent = message;
      go.disabled = false;
      for (const i of [mail, name, theirs]) { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); }
      if (at) { at.setAttribute('aria-invalid', 'true'); at.setAttribute('aria-describedby', 'apErr'); at.focus(); }
    };
    for (const i of [mail, name, theirs]) i.addEventListener('input', () => i.removeAttribute('aria-invalid'));
    const submit = async () => {
      const e = tidyEmail(mail.value);
      if (!isEmail(e)) return fail('That does not look like an email address.', mail);
      go.disabled = true;
      err.textContent = '';
      try {
        if (!adopt.hidden) {
          if (!theirs.value) return fail('Type its password, or delete that login in the console and add the person again.', theirs);
          await L.adoptPerson({ hub, email: e, name: name.value, password: theirs.value });
          return close({ email: e, temp: null });
        }
        const r = await L.createPerson({ hub, email: e, name: name.value });
        close({ email: e, temp: r.temp });
      } catch (x) {
        if (kindOf(x) === 'login-exists') {
          adopt.hidden = false;
          go.textContent = 'Add with its password';
          return fail(`${e} already has a hub login that is not in the directory. If it is theirs, type its password. If you did not expect it, delete it in the hub project's console first.`, theirs);
        }
        fail(kindOf(x) === 'credential' ? 'That is not its password.' : friendly(x), kindOf(x) === 'credential' ? theirs : mail);
      }
    };
    go.addEventListener('click', submit);
    for (const i of [mail, name, theirs]) i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } });
    mail.dataset.autofocus = '';
    box.append(
      el('h3', {}, 'Add person'),
      el('div', { class: 'field' }, el('label', { for: 'apEmail' }, 'Email'), mail),
      el('div', { class: 'field' }, el('label', { for: 'apName' }, 'Name'), name),
      adopt, err,
      el('div', { class: 'actions' }, go, el('button', { class: 'btn', type: 'button', onclick: () => guard.dismiss() }, 'Cancel')));
  }, { label: 'Add person', guard: true });
}

/**
 * A link the hub cannot finish alone. `legacy`: the address has a login in
 * that app with a password of its own. `console`: the app's project makes no
 * logins from a browser. Resolves { password } to take a login over,
 * { added: true } once the user has been added in the console, or null.
 */
function linkHelpDialog({ person, col, status, key, error, self = false }) {
  return openDialog((box, close, guard) => {
    const pass = el('input', { class: 'input', id: 'lhPass', type: 'password', autocomplete: 'off' });
    const err = el('div', { class: 'form-err', id: 'lhErr', role: 'alert' }, error);
    const wrong = (on) => { if (on) { pass.setAttribute('aria-invalid', 'true'); pass.setAttribute('aria-describedby', 'lhErr'); } else pass.removeAttribute('aria-invalid'); };
    wrong(Boolean(error));
    pass.addEventListener('input', () => wrong(false));
    const take = el('button', { class: 'btn primary', type: 'button' }, 'Take over');
    take.addEventListener('click', () => { if (!pass.value) { err.textContent = 'Type its current password.'; wrong(true); pass.focus(); } else close({ password: pass.value }); });
    pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); take.click(); } });
    pass.dataset.autofocus = '';
    const cancel = el('button', { class: 'btn', type: 'button', onclick: () => guard.dismiss() }, 'Cancel');

    if (status === 'legacy') {
      box.append(
        el('h3', {}, `${person.email} already has a login in ${col.title}`),
        el('p', { class: 'lede' }, 'Type its current password to take it over. Its devices there then sign in once at the hub screen.'),
        el('div', { class: 'field' }, el('label', { for: 'lhPass' }, 'Its current password'), withReveal(pass)),
        err,
        el('p', { class: 'hint' }, `Password lost? Delete that user in ${col.title}'s Firebase console, then do this again.`),
        el('div', { class: 'actions' }, take, cancel));
      return;
    }
    const copy = el('button', { class: 'btn small', type: 'button' }, 'Copy');
    copy.addEventListener('click', () => copyText(key, copy));
    box.append(
      el('h3', {}, `${col.title} makes no logins from the hub`),
      el('p', { class: 'lede' }, `If ${person.email} has a login there already, type its current password to take it over.`),
      el('div', { class: 'field' }, el('label', { for: 'lhPass' }, 'Its current password'), withReveal(pass)),
      el('div', { class: 'actions' }, take),
      el('p', { class: 'lede' }, `If it has none, add the user in ${col.title}'s Firebase console (Authentication, Add user) with this password, then press Added.`),
      el('div', { class: 'fresh' }, el('span', { class: 'cap' }, 'Password to add it with'), el('div', { class: 'fresh-line' }, el('code', {}, key), copy)),
      err,
      el('div', { class: 'actions' },
        el('button', { class: 'btn', type: 'button', onclick: () => close({ added: true }) }, 'Added'),
        // An existing login there, whose password its owner knows: they link it on first open.
        self ? null : el('button', { class: 'btn', type: 'button', onclick: () => close({ waiting: true }) }, 'They link it themselves'),
        cancel));
  }, { label: `Link ${person.email} to ${col.title}`, wide: status !== 'legacy', guard: true });
}
