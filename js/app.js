// app.js - the hub page: who is here, which view, and the chrome around it.
//
// The sign-in itself is the shared core's (core/v1/hub.js): the same screen
// every app shows. Once somebody is in, this page is three views:
//
//   #/            the front page: a tile per app, its overview on its face
//   #/accounts    people down, apps across (hub masters only)
//   #/log         who changed which account (hub masters only)
//
// Whether anyone MAY read or change anything is decided by the hub's rules
// (firestore.rules), never by what this page chooses to draw.

import { VERSION } from './version.js';
import { Hub } from '../core/v1/hub.js';
import { el, icon, menu, toast } from './ui.js';
import { HUB_NAME } from './registry.js';
import { makeBackend } from './backend.js';

const $ = (id) => document.getElementById(id);
const THEME_KEY = 'stella.hub.theme';
const SHELL_KEY = 'stella.hub.shell';

const state = { me: null, backend: null, impl: null };

const VIEWS = {
  '': { module: './views/launcher.js', tab: '#/' },
  edit: { module: './views/launcher.js', tab: '#/' },          // arranging your own tiles
  accounts: { module: './views/accounts.js', tab: '#/accounts', master: true },
  log: { module: './views/account-log.js', tab: '#/log', master: true },
};

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* a private window keeps nothing */ } },
};

function setTheme(name) {
  if (name === 'workshop') document.documentElement.dataset.theme = 'workshop';
  else delete document.documentElement.dataset.theme;
  store.set(THEME_KEY, name === 'workshop' ? 'workshop' : null);
}

/** Something stopped the page before it could draw: say what, and offer the one thing that helps. */
function problem(heading, detail) {
  const view = $('view');
  view.textContent = '';
  view.append(el('div', { class: 'state-msg', role: 'alert' },
    el('h1', { class: 'h1' }, heading),
    el('p', {}, detail),
    el('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Reload')));
}

function drawChrome(current) {
  $('hubName').textContent = HUB_NAME;
  document.title = HUB_NAME;
  $('who').textContent = state.me.name || state.me.email;

  const tabs = $('tabs');
  tabs.hidden = !state.me.master;
  tabs.replaceChildren(...(state.me.master ? [['#/', 'Home'], ['#/accounts', 'Accounts'], ['#/log', 'Account log']] : [])
    .map(([href, label]) => el('a', { href, 'aria-current': href === current ? 'page' : null }, label)));

  const cog = $('cogBtn');
  cog.hidden = false;
  if (!cog.firstChild) {
    cog.append(icon('cog'));
    cog.addEventListener('click', () => {
      const light = document.documentElement.dataset.theme === 'workshop';
      menu(cog, [
        { heading: state.me.email },
        { label: 'Password', icon: 'key', onSelect: () => Hub.openPassword() },
        { label: 'Edit tiles', icon: 'app', onSelect: () => { location.hash = '#/edit'; } },
        'sep',
        { label: 'Dark', checked: !light, onSelect: () => setTheme('stella') },
        { label: 'Light', checked: light, onSelect: () => setTheme('workshop') },
        'sep',
        { label: 'Sign out', onSelect: async () => { await Hub.signOut(); location.reload(); } },
        { heading: `Version ${VERSION}` },
      ], { label: 'Settings' });
    });
  }
}

/** The demo says it is the demo, and lets the page be looked at as anyone in it. */
function drawDemoStrip() {
  const note = $('modeNote');
  const b = state.backend;
  if (!b.demo) { note.hidden = true; return; }
  const sel = el('select', { class: 'sel', id: 'viewAs' },
    b.people().map((p) => el('option', { value: p.uid, selected: p.uid === state.me.uid }, p.name || p.email)));
  sel.addEventListener('change', async () => {
    b.viewAs(sel.value);
    await state.impl.refresh();          // the note follows; Hub.onChange reloads the page
    location.reload();
  });
  const again = el('button', { class: 'btn small', type: 'button' }, 'Start the demo again');
  again.addEventListener('click', async () => {
    b.reset();
    await Hub.signOut();
    location.reload();
  });
  note.replaceChildren(
    el('span', {}, 'Demo. Every person here is invented and nothing is saved online.'),
    el('span', { class: 'sp' }),
    el('label', { for: 'viewAs' }, 'View as', sel),
    again);
  note.hidden = false;
}

async function route() {
  const name = location.hash.replace(/^#\/?/, '').split('/')[0];
  const v = VIEWS[name] ?? VIEWS[''];
  if (v.master && !state.me.master) { location.replace('#/'); return; }
  drawChrome(v.tab);
  const view = $('view');
  try {
    const mod = await import(v.module);
    await mod.render(view, { me: state.me, backend: state.backend, impl: state.impl, redraw: route, toast });
  } catch (e) {
    console.error(e);
    problem('This page did not load', e?.message ?? String(e));
  }
}

async function boot() {
  console.info(`${HUB_NAME} ${VERSION} · core ${Hub.version}`);
  // Inside the hub's own home-screen icon every app shares this storage, so
  // the switcher may be shown there (see core/v1/hub.js, inAppIcon).
  if (navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches) store.set(SHELL_KEY, '1');

  try {
    await Hub.signIn({ title: HUB_NAME });
    state.impl = await Hub._impl();
    state.me = Hub.me();
    state.backend = await makeBackend(state.impl);
  } catch (e) {
    console.error(e);
    problem('The hub could not start', 'Check the connection. If it keeps happening, the hub may be mid-update: try again in ten minutes.');
    return;
  }
  if (!state.me) { location.reload(); return; }

  // Signed out, or somebody else signed in, here or in another tab: start again.
  // The same person with other apps (a tile ticked, a role given, here or in
  // another tab): the front page, if it is showing, is drawn again with them.
  Hub.onChange((me) => {
    if (!me || me.uid !== state.me.uid) { location.reload(); return; }
    const before = JSON.stringify([state.me.apps, state.me.master]);
    state.me = me;
    if (JSON.stringify([me.apps, me.master]) !== before && location.hash.replace(/^#\/?/, '').split('/')[0] === '') route();
  });
  drawDemoStrip();
  window.addEventListener('hashchange', route);
  await route();
}

boot();
