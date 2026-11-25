// tiles.js - which of their tiles a person sees on the front page, and in
// what order. Pure: no storage, no page.
//
// TWO LAYERS OF CHOICE, each { order: [projectId...], hidden: [projectId...] }:
//   the person's own   kept in the hub (self/{uid}.tiles), the same on every
//                      device they sign in on;
//   this device's own  kept in this browser only, for a device that should
//                      differ (a phone without the board, say). When a device
//                      has one, it replaces the person's there, whole.
// A tile neither list mentions shows, after the ordered ones, in its usual
// place. So an app given to someone later simply appears.
//
// NOTHING HERE IS A PERMISSION. Which apps a person has is a hub master's
// call (Accounts); this only hides and arranges their tiles, and a hidden app
// is still in the app switcher.

export const MAX = 40;

/** A choice made safe to keep and to use: strings only, no repeats, not too many. */
export function tidyPrefs(p) {
  const list = (v) => [...new Set((Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x))].slice(0, MAX);
  return { order: list(p?.order), hidden: list(p?.hidden) };
}

/** The choice that applies on this device: its own if it has one, else the person's. */
export const effective = (person, device) => tidyPrefs(device ?? person ?? null);

/** The tiles in the order chosen, each marked hidden or not. */
export function arrange(tiles, prefs) {
  const { order, hidden } = tidyPrefs(prefs);
  const off = new Set(hidden);
  const rank = (t, i) => { const at = order.indexOf(t.id); return at < 0 ? order.length + i : at; };
  return tiles.map((t, i) => ({ t, r: rank(t, i) })).sort((a, b) => a.r - b.r).map(({ t }) => ({ ...t, hidden: off.has(t.id) }));
}

/** The whole choice after moving one tile earlier (-1) or later (+1). */
export function moved(arranged, id, delta) {
  const ids = arranged.map((t) => t.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i >= 0 && j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]];
  return { order: ids, hidden: arranged.filter((t) => t.hidden).map((t) => t.id) };
}

/** The whole choice after hiding (true) or showing (false) one tile. */
export function toggled(arranged, id, hide) {
  const off = new Set(arranged.filter((t) => t.hidden).map((t) => t.id));
  if (hide) off.add(id); else off.delete(id);
  return { order: arranged.map((t) => t.id), hidden: arranged.map((t) => t.id).filter((x) => off.has(x)) };
}

/**
 * The tiles dealt into columns: first left, second right, third left. Each
 * column is a stack of its own, so a tall tile pushes down only what is under
 * it. Dealt by ORDER and never by height: a tile stays where its person put
 * it, however much is waiting in it today.
 */
export function columns(list, n) {
  const out = Array.from({ length: Math.max(1, Math.min(n, list.length)) }, () => []);
  list.forEach((t, i) => out[i % out.length].push(t));
  return out;
}

/** Do two choices come to the same thing? */
export const same = (a, b) => JSON.stringify(tidyPrefs(a)) === JSON.stringify(tidyPrefs(b));
