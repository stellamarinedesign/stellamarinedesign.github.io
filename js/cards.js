// cards.js - the overview: each app's own card, one at a time.
//
// THE HUB KNOWS NOTHING ABOUT ANOTHER APP'S DATA. An app that wants a place on
// the front page publishes a small module in its OWN repo and names it in the
// registry (`card`). The hub signs in to that app's project as the person
// looking, hands the module a read handle, and draws what it returns:
//
//   export async function card({ db, fs, email, role }) {
//     return {
//       title: 'Orders waiting',          // the label over the lines
//       count: 3,                         // optional: a number that needs attention
//       items: [{ title, sub, when, href, late }],   // up to three are shown
//       href: '/material-ordering/manager.html',     // optional: where the label goes
//       empty: 'No orders waiting.',      // optional: said when items is empty
//     };
//   }
//
// `db` and `fs` are Firestore Lite (js/firebase.js): fs.getDoc, fs.getDocs,
// fs.query, fs.where, fs.limit and so on. A card returns DATA ONLY, never
// markup, and returns null when this person has nothing to see (a floor login
// gets no manager's queue). What the app's rules refuse, the card cannot read.
//
// A card that is slow, broken or missing costs its own tile a line of text and
// nothing else: each loads by itself, with a time limit.

const LIMIT = 8000;
const MAX_ITEMS = 3;

const text = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');

/**
 * Only an address on this site, written from its root. A card is another
 * repo's code: whatever it returns as a link is not followed anywhere else.
 */
export function sitePath(href) {
  const s = typeof href === 'string' ? href.trim() : '';
  return /^\/(?!\/)[^\s\\]*$/.test(s) ? s : null;
}

/** What a card returned, made safe to draw: strings trimmed, three lines at most, links kept on this site. */
export function normaliseCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .filter((i) => i && typeof i === 'object' && text(i.title, 120))
    .slice(0, MAX_ITEMS)
    .map((i) => ({ title: text(i.title, 120), sub: text(i.sub, 120), when: text(i.when, 24), href: sitePath(i.href), late: i.late === true }));
  const count = Number.isFinite(raw.count) && raw.count > 0 ? Math.min(Math.floor(raw.count), 999) : null;
  return { title: text(raw.title, 40), count, items, href: sitePath(raw.href), empty: text(raw.empty, 80) };
}

/**
 * One tile's card.
 *   { state: 'none' }            the app supplies none, or has nothing for this person
 *   { state: 'ready', card }     drawn as lines (or its `empty` words when there are none)
 *   { state: 'failed' }          it threw, or took too long
 */
export async function loadCard(backend, tile, me, { limit = LIMIT } = {}) {
  // No card for an app this person still signs in to the old way: the hub holds no key to read it with.
  if (!tile.joined || tile.own || !backend.hasCard(tile.id)) return { state: 'none' };
  let timer = null;
  try {
    const raw = await Promise.race([
      backend.card(tile.id, { email: me.email, role: tile.role }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The card took too long.')), limit); }),
    ]);
    const card = normaliseCard(raw);
    return card ? { state: 'ready', card } : { state: 'none' };
  } catch (e) {
    console.warn(`[hub] ${tile.id} card:`, e?.message ?? e);
    return { state: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
