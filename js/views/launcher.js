// views/launcher.js - the front page: one tile per app, and on each tile's
// face what needs attention in that app.
//
// THE TILE IS THE DOOR. A link lies under the whole tile, so anywhere on it
// opens the app; each overview line sits above that link and is a door of its
// own, to that one thing.
//
// THE TILES DO NOT WAIT FOR THE CARDS. They are drawn at once from what the
// hub already knows about this person; each app's card is then fetched by
// itself and arrives into space already held for it, so nothing moves.
//
// THE PERSON ARRANGES THEIR OWN TILES (#/edit, from the cog): hide and order,
// for all their devices or for this one only (js/tiles.js). The tiles still
// do not wait: they are drawn from the copy of that choice this browser kept
// last time, and redrawn only if it changed on another device since.

import { el, icon, working } from '../ui.js';
import { tilesFor } from '../registry.js';
import { loadCard } from '../cards.js';
import { arrange, effective, moved, toggled, tidyPrefs, same } from '../tiles.js';
import { friendly } from '../errors.js';

// This browser's copy of the person's choice, and this device's own choice.
const MINE = (uid) => `stella.hub.tiles.mine.${uid}`;
const HERE = (uid) => `stella.hub.tiles.here.${uid}`;
// Set while a change to the person's own choice has not reached the hub (offline,
// say): the next visit sends it, instead of overwriting it with the hub's older copy.
const UNSENT = (uid) => `stella.hub.tiles.unsent.${uid}`;
const flag = {
  get(k) { try { return localStorage.getItem(k) === '1'; } catch { return false; } },
  set(k, on) { try { if (on) localStorage.setItem(k, '1'); else localStorage.removeItem(k); } catch { /* nothing kept */ } },
};

/** Send the person's own choice to the hub. True once it is there. */
async function sendMine(backend, uid, prefs) {
  try {
    await backend.hub.setSelf(uid, { tiles: tidyPrefs(prefs), at: backend.hub.now() });
    flag.set(UNSENT(uid), false);
    return true;
  } catch (e) {
    flag.set(UNSENT(uid), true);
    throw e;
  }
}
const local = {
  get(k) { try { const v = localStorage.getItem(k); return v ? tidyPrefs(JSON.parse(v)) : null; } catch { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(tidyPrefs(v))); } catch { /* a private window keeps nothing */ } },
};

/** The person's own choice, from the hub. null when there is none or it cannot be read. */
async function fetchMine(backend, uid) {
  try { return tidyPrefs((await backend.hub.getSelf(uid))?.tiles ?? null); } catch { return null; }
}

export async function render(view, ctx) {
  const { me, backend } = ctx;
  const tiles = tilesFor(me.apps, { master: me.master, joined: backend.joined(), demo: backend.demo });
  const editing = location.hash.replace(/^#\/?/, '').split('/')[0] === 'edit';

  // A login with one app has no use for a page of one tile. (Not in the demo,
  // where the point is to look at this page.)
  if (!editing && tiles.length === 1 && !me.master && !backend.demo && !new URLSearchParams(location.search).has('stay')) {
    location.replace(tiles[0].href);
    return;
  }

  view.textContent = '';
  view.append(el('h1', { class: 'sr-only' }, editing ? 'Edit your tiles' : 'Your apps'));
  if (!tiles.length) {
    view.append(el('div', { class: 'empty' },
      el('b', {}, 'No apps yet. '),
      // A master's own role is never theirs to give; what they can do for themselves is tick a tile, or link.
      me.master ? 'Tick the apps you use, or link yourself to one, under Accounts.' : 'A hub master gives this login its apps.'));
    return;
  }

  const kept = local.get(MINE(me.uid));
  const unsent = flag.get(UNSENT(me.uid)) && kept;

  if (editing) {
    const mine = unsent ? kept : ((await fetchMine(backend, me.uid)) ?? kept ?? tidyPrefs(null));
    local.set(MINE(me.uid), mine);
    editor(view, ctx, tiles, mine);
    return;
  }

  const draw = (mine) => drawTiles(view, ctx, tiles, effective(mine, local.get(HERE(me.uid))));
  draw(kept);
  // A change made here that never reached the hub goes now; otherwise, one
  // made on another device since this browser last looked is drawn, once.
  if (unsent) { sendMine(backend, me.uid, kept).catch(() => {}); return; }
  fetchMine(backend, me.uid).then((mine) => {
    if (!mine || same(mine, kept)) return;
    local.set(MINE(me.uid), mine);
    if (!local.get(HERE(me.uid)) && location.hash.replace(/^#\/?/, '') === '') draw(mine);
  });
}

function drawTiles(view, { me, backend }, tiles, prefs) {
  const shown = arrange(tiles, prefs).filter((t) => !t.hidden);
  view.querySelector('.tiles, .empty')?.remove();
  if (!shown.length) {
    view.append(el('div', { class: 'empty' }, el('b', {}, 'Every tile is hidden. '), el('a', { href: '#/edit' }, 'Edit tiles')));
    return;
  }
  const grid = el('div', { class: 'tiles' });
  for (const t of shown) grid.append(tile(t, me, backend));
  view.append(grid);
}

// ---------------------------------------------------------------------------
// editing: hide and order, for all devices or this one
// ---------------------------------------------------------------------------

function editor(view, ctx, tiles, mineAtStart) {
  const { me, backend, toast } = ctx;
  let mine = mineAtStart;
  let here = local.get(HERE(me.uid));
  let scope = here ? 'here' : 'all';
  // Each change goes to the hub at once, one after another, so leaving the
  // page straight after a click loses nothing.
  let sending = Promise.resolve();
  let warned = false;

  const current = () => (scope === 'here' ? effective(mine, here) : mine);
  const saveMine = () => sending;
  const change = (next, focus) => {
    if (scope === 'here') { here = tidyPrefs(next); local.set(HERE(me.uid), here); }
    else {
      mine = tidyPrefs(next);
      local.set(MINE(me.uid), mine);
      flag.set(UNSENT(me.uid), true);
      const prefs = mine;
      sending = sending.then(() => sendMine(backend, me.uid, prefs)).catch((e) => {
        if (!warned) { warned = true; toast(`Kept on this device; it goes to your other devices when the hub can be reached. ${friendly(e)}`, { warn: true, ms: 8000 }); }
      });
    }
    draw(focus);
  };

  const scopeBtn = (value, label) => el('button', {
    class: 'seg-btn', type: 'button', 'aria-pressed': String(scope === value),
    onclick: () => { if (scope !== value) { scope = value; draw(); } },
  }, label);

  function draw(focus = null) {
    const arranged = arrange(tiles, current());
    const bar = el('div', { class: 'edit-bar' },
      el('div', { class: 'seg', role: 'group', 'aria-label': 'Change the tiles on' },
        scopeBtn('all', 'All my devices'), scopeBtn('here', 'This device only')),
      here ? el('button', {
        class: 'btn small', type: 'button',
        onclick: () => { here = null; local.set(HERE(me.uid), null); scope = 'all'; draw(); toast('This device shows your usual tiles again.'); },
      }, 'Use my usual tiles here') : null,
      el('span', { class: 'sp' }),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { working(e.currentTarget, 'Saving…'); await saveMine(); location.hash = '#/'; } }, 'Finish editing'));

    const grid = el('div', { class: 'tiles editing' });
    arranged.forEach((t, i) => {
      const earlier = el('button', {
        class: 'ib', type: 'button', 'data-move': `${t.id}:-1`, disabled: i === 0,
        'aria-label': `Move ${t.title} earlier`, title: 'Earlier', onclick: () => change(moved(arranged, t.id, -1), `${t.id}:-1`),
      }, icon('chevLeft', 18));
      const later = el('button', {
        class: 'ib', type: 'button', 'data-move': `${t.id}:1`, disabled: i === arranged.length - 1,
        'aria-label': `Move ${t.title} later`, title: 'Later', onclick: () => change(moved(arranged, t.id, 1), `${t.id}:1`),
      }, icon('chevRight', 18));
      const hide = el('button', {
        class: 'btn small', type: 'button', 'data-move': `${t.id}:hide`, 'aria-pressed': String(t.hidden),
        'aria-label': `${t.hidden ? 'Show' : 'Hide'} ${t.title}`, onclick: () => change(toggled(arranged, t.id, !t.hidden), `${t.id}:hide`),
      }, t.hidden ? 'Show' : 'Hide');
      const ico = icon(t.icon, 22);
      ico.classList.add('t-ico');
      grid.append(el('article', { class: `tile${t.hidden ? ' is-hidden' : ''}` },
        el('div', { class: 't-head' }, ico,
          el('div', { class: 't-id' }, el('h2', { class: 't-name' }, t.title), t.hidden ? el('span', { class: 'chip outline' }, 'Hidden') : null)),
        el('div', { class: 't-edit' }, earlier, later, el('span', { class: 'sp' }), hide)));
    });

    view.replaceChildren(el('h1', { class: 'sr-only' }, 'Edit your tiles'), bar, grid);
    if (focus) {
      const b = view.querySelector(`[data-move="${focus}"]`);
      (b && !b.disabled ? b : view.querySelector(`[data-move^="${focus.split(':')[0]}:"]:not([disabled])`))?.focus();
    }
  }
  draw();
}

// ---------------------------------------------------------------------------
// a tile
// ---------------------------------------------------------------------------

function tile(t, me, backend) {
  const head = el('div', { class: 't-head' });
  const ico = icon(t.icon, 22);
  ico.classList.add('t-ico');
  const chev = icon('chevRight', 18);
  chev.classList.add('t-chev');
  // The name and what goes with it wrap as one group, so a narrow tile puts
  // the role and chips under the name instead of squeezing the name.
  const id = el('div', { class: 't-id' }, el('h2', { class: 't-name' }, t.title));
  if (t.roleLabel) id.append(el('span', { class: 't-role' }, t.roleLabel));
  // A project still being tried: its tile is drawn for hub masters and nobody else.
  if (t.stage === 'dev') id.append(el('span', { class: 'chip' }, 'Masters only'));
  if (t.own) id.append(el('span', { class: 'chip outline' }, 'Own sign-in'));
  head.append(ico, id, chev);

  const face = el('div', { class: 't-face' });
  const node = el('article', { class: 'tile' },
    el('a', { class: 'tile-go', href: t.href, 'aria-label': `Open ${t.title}` }),
    head,
    face,
    t.pages.length ? el('div', { class: 't-foot' }, t.pages.map((p) => el('a', { href: p.href }, p.title))) : null);

  if (t.joined && !t.own && backend.hasCard(t.id)) fill(face, t, me, backend);
  return node;
}

/** Fetch one tile's card and draw it where its skeleton was. */
async function fill(face, t, me, backend) {
  face.classList.add('has-card');
  face.setAttribute('aria-busy', 'true');
  face.replaceChildren(
    el('div', { class: 't-label' }, el('span', { class: 'sr-only' }, `Loading ${t.title}`), ' '),
    el('div', { class: 'skel' }), el('div', { class: 'skel' }), el('div', { class: 'skel' }));

  const got = await loadCard(backend, t, me);
  face.removeAttribute('aria-busy');

  if (got.state === 'none') { face.replaceChildren(); return; }
  if (got.state === 'failed') {
    const again = el('button', { class: 'btn small', type: 'button' }, 'Try again');
    again.addEventListener('click', () => fill(face, t, me, backend));
    face.replaceChildren(el('div', { class: 't-quiet', role: 'status' }, 'Not available just now.', again));
    return;
  }

  const { card } = got;
  const label = el('div', { class: 't-label' }, card.title || 'Now');
  if (card.count) label.append(el('span', { class: 'count', 'aria-label': `${card.count} waiting` }, card.count > 99 ? '99+' : String(card.count)));
  if (!card.items.length) {
    face.replaceChildren(label, el('div', { class: 't-quiet' }, card.empty || 'Nothing waiting.'));
    return;
  }
  face.replaceChildren(label, el('ul', { class: 'lines' }, card.items.map((i) => el('li', {}, line(i)))));
}

function line(i) {
  const parts = [
    el('span', { class: 'l-title' }, i.title),
    i.sub ? el('span', { class: 'l-sub' }, i.sub) : null,
    i.when ? el('span', { class: `l-when${i.late ? ' late' : ''}` }, i.when, i.late ? el('span', { class: 'sr-only' }, ', late') : null) : null,
  ];
  return i.href ? el('a', { class: 'line', href: i.href }, parts) : el('div', { class: 'line' }, parts);
}
