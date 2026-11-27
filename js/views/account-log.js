// views/account-log.js - who changed which account, newest first.
//
// Written by js/linking.js as each step succeeds, to the hub's `activity`
// collection, which nobody can edit or delete (firestore.rules). Read here
// fifty at a time: each entry is one document read.

import { el, whenText, working } from '../ui.js';
import { friendly, kindOf } from '../errors.js';

const PAGE = 50;

export async function render(view, ctx, count = PAGE) {
  if (!view.querySelector('.log')) {
    view.textContent = '';
    view.append(el('div', { class: 'page-head' }, el('h1', { class: 'h1' }, 'Account log')),
      el('div', { 'aria-busy': 'true' }, el('span', { class: 'sr-only' }, 'Loading the account log'), el('div', { class: 'skel' }), el('div', { class: 'skel' }), el('div', { class: 'skel' })));
  }
  let entries;
  try { entries = await ctx.backend.hub.listLog(count); }
  catch (e) {
    if (ctx.stale?.()) return;           // another page was asked for meanwhile
    view.textContent = '';
    view.append(el('div', { class: 'state-msg', role: 'alert' },
      el('h1', { class: 'h1' }, 'The account log did not load'),
      el('p', {}, kindOf(e) === 'denied' ? 'This login is not a hub admin.' : `${friendly(e)} If you are offline, it loads when the connection is back.`),
      el('button', { class: 'btn', type: 'button', onclick: () => render(view, ctx, count) }, 'Reload')));
    return;
  }
  if (ctx.stale?.()) return;

  view.textContent = '';
  view.append(el('div', { class: 'page-head' }, el('h1', { class: 'h1' }, 'Account log')));
  if (!entries.length) {
    view.append(el('div', { class: 'empty' }, el('b', {}, 'Nothing changed yet. '), 'Every person added, linked, given a role or removed is noted here.'));
    return;
  }
  view.append(el('div', { class: 'log' }, entries.map((e) => el('div', { class: 'log-row' },
    el('span', { class: 'when' }, whenText(e.at)),
    el('span', { class: 'by', title: e.byEmail ?? '' }, String(e.byEmail ?? '').split('@')[0] || 'unknown'),
    el('span', { class: 'what' }, e.text ?? '')))));
  if (entries.length >= count) {
    view.append(el('p', { style: { 'margin-top': 'var(--sp-4)' } },
      el('button', { class: 'btn small', type: 'button', onclick: (e) => { working(e.currentTarget, 'Loading…'); render(view, ctx, count + PAGE); } }, 'Show older')));
  }
}
