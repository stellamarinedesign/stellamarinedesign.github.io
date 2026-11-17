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

import { el, icon } from '../ui.js';
import { tilesFor } from '../registry.js';
import { loadCard } from '../cards.js';

export async function render(view, { me, backend }) {
  const tiles = tilesFor(me.apps, { master: me.master, joined: backend.joined(), demo: backend.demo });

  // A login with one app has no use for a page of one tile. (Not in the demo,
  // where the point is to look at this page.)
  if (tiles.length === 1 && !me.master && !backend.demo && !new URLSearchParams(location.search).has('stay')) {
    location.replace(tiles[0].href);
    return;
  }

  view.textContent = '';
  view.append(el('h1', { class: 'sr-only' }, 'Your apps'));
  if (!tiles.length) {
    view.append(el('div', { class: 'empty' },
      el('b', {}, 'No apps yet. '),
      // A master's own role is never theirs to give; what they can do for themselves is tick a tile, or link.
      me.master ? 'Tick the apps you use, or link yourself to one, under Accounts.' : 'A hub master gives this login its apps.'));
    return;
  }
  const grid = el('div', { class: 'tiles' });
  for (const t of tiles) grid.append(tile(t, me, backend));
  view.append(grid);
}

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
    el('div', { class: 't-label' }, el('span', { class: 'sr-only' }, `Loading ${t.title}`), ' '),
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
  if (card.count) label.append(el('span', { class: 'count', 'aria-label': `${card.count} waiting` }, card.count));
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
