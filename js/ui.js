// ui.js - the small kit every view builds with: an element helper, the icon
// set, the toast and the popover menu. Taken from design scheduling's ui.js,
// cut down to what the hub uses.
//
// Icons are drawn SVG in one stroke weight (1.8 on a 24 grid), never Unicode
// glyphs, so they line up and take the text colour.

/**
 * Make an element. `props` may hold class, text, attrs, dataset, style,
 * on{Event} handlers; children are nodes or strings.
 */
export function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) n.style.setProperty(sk, sv);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bang: '<path d="M12 5.5v8"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  chevRight: '<path d="m9 6 6 6-6 6"/>',
  chevLeft: '<path d="m15 6-6 6 6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  // One per app in the registry (`icon`), and a spare.
  board: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9 9.5v10M14.5 9.5v10"/>',
  box: '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  sheet: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="m14.5 6.5 3-3"/>',
  app: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
};

/** An icon, aria-hidden: the control around it carries the label. */
export function icon(name, size = 18) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.innerHTML = P[name] ?? P.app;
  return s;
}

/** A labelled icon button. */
export const iconBtn = (name, label, onClick, cls = '') => el('button', {
  class: `ib ${cls}`.trim(), type: 'button', 'aria-label': label, title: label, onclick: onClick,
}, icon(name));

/** A text button, optionally with a leading icon. */
export const btn = (text, onClick, { cls = '', ic = null, title = null } = {}) => el('button', {
  class: `btn ${cls}`.trim(), type: 'button', onclick: onClick, title,
}, ic ? icon(ic, 16) : null, text);

/** A password field with its own Show / Hide button (Edge's built-in eye comes and goes). */
export function withReveal(input) {
  const b = el('button', { class: 'reveal', type: 'button', 'aria-controls': input.id || null }, 'Show');
  b.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show';
    input.focus();
  });
  return el('div', { class: 'reveal-wrap' }, input, b);
}

/** Initials for a name or an address. */
export function initials(name) {
  const parts = String(name ?? '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// toast
// ---------------------------------------------------------------------------

let toastTimer = null;

/** A short message at the bottom of the page. `warn` for something that did not work. */
export function toast(message, { warn = false, ms = 5000 } = {}) {
  const host = document.getElementById('toast');
  if (!host) { console.log('[toast]', message); return; }
  clearTimeout(toastTimer);
  host.textContent = message;
  host.classList.toggle('warn', warn);
  host.hidden = false;
  host.classList.remove('show');
  void host.offsetWidth;                   // a second toast replacing the first reads as new
  host.classList.add('show');
  toastTimer = setTimeout(() => {
    host.classList.remove('show');
    toastTimer = setTimeout(() => { host.hidden = true; }, 220);
  }, ms);
}

// ---------------------------------------------------------------------------
// popover menu
// ---------------------------------------------------------------------------

let openMenu = null;

export function closeMenu() {
  if (!openMenu) return;
  const { node, anchor, onKey, onDown } = openMenu;
  node.remove();
  document.removeEventListener('keydown', onKey, true);
  document.removeEventListener('pointerdown', onDown, true);
  anchor?.setAttribute('aria-expanded', 'false');
  openMenu = null;
}

/**
 * A menu under (or above) an anchor. Items: { label, onSelect, icon?, danger?,
 * checked?, disabled?, hint? } or 'sep' or { heading }. Fixed-position, so no
 * overflow:hidden ancestor clips it. Arrow keys move; Esc closes.
 */
export function menu(anchor, items, { label = 'Actions' } = {}) {
  closeMenu();
  const node = el('div', { class: 'menu', role: 'menu', 'aria-label': label });
  const buttons = [];
  // If any item has an icon, the others hold its place, so every label starts on one line.
  const icons = items.some((it) => it && it.icon);
  for (const it of items) {
    if (!it) continue;
    if (it === 'sep') { node.append(el('div', { class: 'menu-sep', role: 'separator' })); continue; }
    if (it.heading) { node.append(el('div', { class: 'menu-head' }, it.heading)); continue; }
    const b = el('button', {
      class: `menu-item${it.danger ? ' danger' : ''}`,
      type: 'button',
      role: it.checked !== undefined ? 'menuitemradio' : 'menuitem',
      'aria-checked': it.checked !== undefined ? String(Boolean(it.checked)) : null,
      disabled: it.disabled,
      // Heard as one phrase with its hint ("Remove, not your own"), not run together.
      'aria-label': it.hint ? `${it.label}, ${String(it.hint).toLowerCase()}` : null,
      onclick: (e) => { e.stopPropagation(); closeMenu(); it.onSelect?.(); },
    },
    it.icon ? icon(it.icon, 16) : (icons ? el('span', { class: 'menu-gap' }) : null),
    el('span', { class: 'menu-label' }, it.label),
    it.hint ? el('span', { class: 'menu-hint' }, it.hint) : null,
    it.checked ? icon('check', 16) : null);
    buttons.push(b);
    node.append(b);
  }
  document.body.append(node);
  const r = anchor.getBoundingClientRect();
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  // It grows from the button that opened it: above it or below it.
  node.style.transformOrigin = `${Math.round(r.left + r.width / 2 - left)}px ${top < r.top ? '100%' : '0'}`;
  anchor.setAttribute('aria-expanded', 'true');

  const onKey = (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); anchor.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (buttons[(i + 1) % buttons.length] ?? buttons[0])?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (buttons[(i - 1 + buttons.length) % buttons.length] ?? buttons[0])?.focus(); }
    else if (e.key === 'Tab') closeMenu();
  };
  const onDown = (e) => { if (!node.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onDown, true);
  openMenu = { node, anchor, onKey, onDown };
  (buttons.find((b) => !b.disabled))?.focus();
  return node;
}

/** A refused value: shake the field once (a password's box with its Show button). */
export function shake(input) {
  const n = input?.closest?.('.reveal-wrap') ?? input;
  if (!n) return;
  n.classList.remove('shake');
  void n.offsetWidth;                  // start again if it is still shaking
  n.classList.add('shake');
  n.addEventListener('animationend', () => n.classList.remove('shake'), { once: true });
}

/** A button that is doing what it says: it says so, keeps its width, and cannot be pressed twice. */
export function working(button, label) {
  const was = button.textContent;
  button.style.minWidth = `${button.offsetWidth}px`;
  button.disabled = true;
  button.textContent = label;
  return () => { button.disabled = false; button.textContent = was; button.style.minWidth = ''; };
}

/** Per-device view settings: localStorage, never data. */
export const prefs = {
  get(key, fallback) { try { const v = localStorage.getItem(`stella.hub.${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`stella.hub.${key}`, JSON.stringify(value)); } catch { /* a private window forgets on close */ } },
};

/** Copy text; says so on the button that was pressed. */
export async function copyText(text, button) {
  const was = button?.textContent;
  try { await navigator.clipboard.writeText(text); if (button) button.textContent = 'Copied'; }
  catch { if (button) button.textContent = 'Select and copy it'; }
  if (button) setTimeout(() => { button.textContent = was; }, 2500);
}

/** A time as "14 Nov, 2:10 pm", in this device's own clock. */
export function whenText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
