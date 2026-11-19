// shots.mjs - look at the hub without a window: screenshots of every screen in
// the demo, at desk, half-screen and phone widths, in both themes.
//
//   python tools/serve.py            (in another terminal)
//   node tools/shots.mjs             -> .impeccable/review/*.png
//
// It runs Edge headless with a throwaway profile and drives it over its
// debugging port, so nothing opens on screen and nothing of yours is touched.
// The demo starts signed in as its first invented person, which is what a
// fresh profile sees. Only useful in demo mode (an empty HUB_CONFIG).
//
// Set HUB_BROWSER to another Chromium's path to use it instead of Edge.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.impeccable', 'review');
const BASE = process.argv[2] ?? 'http://localhost:8791';
const BROWSER = process.env.HUB_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9377;
const ORDERING = 'material-ordering-41851';

// HUB_ONLY=ipad takes the two iPad captures and stops.
const ONLY = process.env.HUB_ONLY ?? '';
class Done extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'hub-shots-'));
const browser = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('The browser did not start.');
}

function connect(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  let id = 0;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (!msg.id) return;
    const w = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) w.reject(new Error(msg.error.message)); else w.resolve(msg.result);
  };
  return new Promise((resolve, reject) => {
    ws.onerror = () => reject(new Error('Could not connect to the browser.'));
    ws.onopen = () => resolve((method, params = {}) => new Promise((res, rej) => {
      id += 1;
      waiting.set(id, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id, method, params }));
    }));
  });
}

let send;
const size = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
async function js(body) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function until(condition, what = condition, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await js(`return Boolean(${condition});`).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`Never happened: ${what}`);
}
let n = 0;
async function go(path) {
  n += 1;                                   // a new query each time, so a hash change is still a fresh load
  const [before, hash = ''] = path.split('#');
  const url = `${BASE}${before}${before.includes('?') ? '&' : '?'}shot=${n}${hash ? `#${hash}` : ''}`;
  await send('Page.navigate', { url });
  await sleep(700);
}
async function shot(name, { full = true, wait = 350 } = {}) {
  await sleep(wait);                        // let a transition finish
  const params = { format: 'png' };
  if (full) {
    const { cssContentSize: s } = await send('Page.getLayoutMetrics');
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width: s.width, height: Math.min(s.height, 5000), scale: 1 };
  }
  const { data } = await send('Page.captureScreenshot', params);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  ${name}.png`);
}
const settled = `document.querySelector('.tile, .acct, .log, .empty, .state-msg') && !document.querySelector('[aria-busy]')`;
const click = (selector, text) => js(`const n = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => ${text ? `x.textContent.trim() === ${JSON.stringify(text)}` : 'true'}); if (!n) throw new Error('nothing to click: ${selector} ${text ?? ''}'); n.click();`);
const row = (email) => `[...document.querySelectorAll('.acct tbody tr')].find((tr) => tr.querySelector('.p-mail')?.textContent === ${JSON.stringify(email)})`;

try {
  send = await connect(await target());
  await send('Page.enable');
  await send('Runtime.enable');
  // A page nobody is looking at draws no focus ring: have it behave as the focused window.
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // ---- an iPad: desk width, but fingers. The touch rule is keyed to the pointer
  // as well as to width, and this is the only capture that shows the pointer half.
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await size(1024, 768, true);
  await go('/#/accounts');
  await until(settled, 'accounts on an iPad');
  console.log(`  (pointer: coarse) matches: ${await js(`return matchMedia('(pointer: coarse)').matches;`)}`);
  await shot('accounts-ipad');
  await go('/');
  await until(settled, 'the front page on an iPad');
  await shot('ipad');
  await go(`/lab/app.html?app=${ORDERING}`);
  await until(`document.querySelector('#hubSlot .shub-sw')`, 'the switcher button on an iPad');
  await click('#hubSlot .shub-sw');
  await until(`document.querySelector('.shub-pop')`);
  await shot('switcher-ipad', { full: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  if (ONLY === 'ipad') throw new Done('Done: the iPad captures only.');

  // ---- a card still on its way: the space held for it, caught before it lands
  await size(1440, 900);
  n += 1;
  await send('Page.navigate', { url: `${BASE}/?shot=${n}` });
  await until(`document.querySelector('.t-face[aria-busy] .skel')`, 'a card still loading');
  await shot('loading', { full: false, wait: 0 });

  // ---- the front page, at the three widths it is used at
  for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['half', 900, 900, false], ['mobile', 390, 844, true]]) {
    await size(w, h, mobile);
    await go('/');
    await until(settled, 'the front page');
    await shot(name);
  }
  await size(1440, 900);
  await go('/');
  await until(settled, 'the front page');
  await click('#cogBtn');
  await until(`document.querySelector('.menu')`);
  await shot('menu-cog', { full: false });
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);

  // ---- Accounts
  for (const [name, w, h, mobile] of [['accounts-desktop', 1440, 900, false], ['accounts-half', 900, 900, false], ['accounts-mobile', 390, 844, true]]) {
    await size(w, h, mobile);
    await go('/#/accounts');
    await until(settled, 'accounts');
    await shot(name);
  }
  await size(1440, 900);
  await go('/#/accounts');
  await until(settled, 'accounts');
  await click('.page-head .btn.primary');
  await until(`document.querySelector('.overlay.show #apEmail')`);
  await shot('dialog-add', { full: false });
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await until(`!document.querySelector('.overlay.show')`);
  // Link on somebody's old login: it waits for them to link it on first open.
  await js(`[...${row('pat@example.test')}.querySelectorAll('button')].find((b) => b.textContent === 'Link').click();`);
  await until(`${row('pat@example.test')}?.querySelector('.chip-btn[aria-label^="Waiting"]')`, 'Pat waiting');
  await shot('accounts-pat-waiting', { full: false });
  // ...and the master can still take it over now, from that cell's menu.
  await js(`${row('pat@example.test')}.querySelector('.chip-btn[aria-label^="Waiting"]').click();`);
  await until(`document.querySelector('.menu')`);
  await click('.menu .menu-item', 'Take over now');
  await until(`document.querySelector('.overlay.show #lhPass')`);
  await shot('dialog-takeover', { full: false });
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await until(`!document.querySelector('.overlay.show')`);
  await js(`${row('riley@example.test')}.querySelector('.person .ib').click();`);
  await until(`document.querySelector('.menu')`);
  await shot('menu-person', { full: false });
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  // What a change says when it is done: a role moved, and the toast that reports it.
  await js(`const s = ${row('sam@example.test')}.querySelectorAll('select')[1]; s.value = 'engineer'; s.dispatchEvent(new Event('change', { bubbles: true }));`);
  await until(`document.querySelector('#toast.show')`, 'the toast');
  await shot('toast', { full: false });

  // ---- the account log
  await go('/#/log');
  await until(settled, 'the log');
  await shot('log');

  // ---- the light theme
  await js(`localStorage.setItem('stella.hub.theme', 'workshop'); localStorage.setItem('lab.theme', 'workshop');`);
  await go('/');
  await until(settled, 'the front page, light');
  await shot('desktop-light');
  await go('/#/accounts');
  await until(settled, 'accounts, light');
  await shot('accounts-light');

  // ---- inside an app: the switcher, light then dark, desk then phone
  await go(`/lab/app.html?app=${ORDERING}`);
  await until(`document.querySelector('#hubSlot .shub-sw')`, 'the switcher button');
  await click('#hubSlot .shub-sw');
  await until(`document.querySelector('.shub-pop')`);
  await shot('switcher-light', { full: false });
  await js(`localStorage.removeItem('stella.hub.theme'); localStorage.removeItem('lab.theme');`);
  await go(`/lab/app.html?app=${ORDERING}`);
  await until(`document.querySelector('#hubSlot .shub-sw')`, 'the switcher button');
  await shot('app', { full: false });
  await click('#hubSlot .shub-sw');
  await until(`document.querySelector('.shub-pop')`);
  await shot('switcher-desktop', { full: false });
  await size(390, 844, true);
  await go(`/lab/app.html?app=${ORDERING}`);
  await until(`document.querySelector('#hubSlot .shub-sw')`, 'the switcher button');
  await click('#hubSlot .shub-sw');
  await until(`document.querySelector('.shub-pop')`);
  await shot('switcher-mobile', { full: false });

  // ---- the password dialog
  await size(1440, 900);
  await go(`/lab/app.html?app=${ORDERING}`);
  await until(`document.querySelector('#view .actions')`);
  await click('#view .actions button', 'Password');
  await until(`document.querySelector('.shub-box')`);
  await shot('password', { full: false });

  // ---- somebody with no role in this app
  await go('/');
  await until(settled, 'the front page');
  await js(`const s = document.getElementById('viewAs'); s.value = [...s.options].find((o) => o.textContent === 'Riley Chen').value; s.dispatchEvent(new Event('change', { bubbles: true }));`);
  await sleep(1500);
  await until(`document.getElementById('who')?.textContent === 'Riley Chen' && ${settled}`, 'the page as Riley');
  await shot('desktop-designer');
  await go(`/lab/app.html?app=${ORDERING}`);
  await until(`document.querySelector('.shub-screen .shub-title')`, 'the no-access card');
  await shot('noaccess', { full: false });

  // ---- somebody the hub knows who has no app yet
  await go('/');
  await until(settled, 'the front page');
  await js(`const s = document.getElementById('viewAs'); s.value = [...s.options].find((o) => o.textContent === 'Jordan Park').value; s.dispatchEvent(new Event('change', { bubbles: true }));`);
  await sleep(1500);
  await until(`document.getElementById('who')?.textContent === 'Jordan Park' && ${settled}`, 'the page as Jordan');
  await shot('desktop-empty', { full: false });

  // ---- signed out: the sign-in screen, and what a wrong password looks like
  await js(`const { Hub } = await import('/core/v1/hub.js'); await Hub.signOut();`);
  await go('/');
  await until(`document.querySelector('.shub-screen #shub-email')`, 'the sign-in screen');
  await shot('signin-desktop', { full: false });
  await js(`const s = document.querySelector('.shub-screen'); s.querySelector('#shub-email').value = 'alex@example.test'; s.querySelector('#shub-pass').value = 'nope'; s.querySelector('form').requestSubmit();`);
  await until(`document.querySelector('.shub-err').textContent`);
  await shot('signin-error', { full: false });
  // The same two states in the light theme: a focused field, then an error.
  await js(`localStorage.setItem('stella.hub.theme', 'workshop');`);
  await go('/');
  await until(`document.querySelector('.shub-screen #shub-email')`, 'the sign-in screen, light');
  await shot('signin-light', { full: false });
  await js(`const s = document.querySelector('.shub-screen'); s.querySelector('#shub-email').value = 'alex@example.test'; s.querySelector('#shub-pass').value = 'nope'; s.querySelector('form').requestSubmit();`);
  await until(`document.querySelector('.shub-err').textContent`);
  await shot('signin-error-light', { full: false });
  await js(`localStorage.removeItem('stella.hub.theme');`);
  await size(390, 844, true);
  await go('/');
  await until(`document.querySelector('.shub-screen #shub-email')`, 'the sign-in screen');
  await shot('signin-mobile', { full: false });

  // ---- the sign-in screen as an iPad draws it (still signed out here)
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await size(1024, 768, true);
  await go('/');
  await until(`document.querySelector('.shub-screen #shub-email')`, 'the sign-in screen on an iPad');
  await shot('signin-ipad', { full: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });

  // ---- arranging your own tiles: edit mode, a tile hidden and one moved
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await size(1440, 900);
  await js(`localStorage.removeItem('stella.hub.demo.v1'); localStorage.removeItem('stella.hub.session');`);
  await go('/');
  await until(settled, 'the front page, demo started again');
  await go('/#/edit');
  await until(`document.querySelector('.tiles.editing .tile')`, 'edit mode');
  await click('.tiles.editing .tile .btn.small', 'Hide');
  await until(`document.querySelector('.tile.is-hidden')`, 'a hidden tile');
  await js(`document.querySelectorAll('.tiles.editing .tile')[2].querySelector('[aria-label^="Move"][aria-label$="earlier"]').click();`);
  await shot('edit-tiles', { full: false });
  await size(390, 844, true);
  await go('/#/edit');
  await until(`document.querySelector('.tiles.editing .tile')`, 'edit mode on a phone');
  await shot('edit-tiles-mobile');
  await size(1440, 900);
  await go('/');
  await until(settled, 'the front page after editing');
  await shot('desktop-arranged', { full: false });

  // ---- linking an old login on first open: Sam, waiting for design scheduling
  await go('/#/accounts');
  await until(settled, 'accounts');
  await shot('accounts-waiting', { full: false });
  await go('/');
  await until(settled, 'the front page');
  await js(`const s = document.getElementById('viewAs'); s.value = [...s.options].find((o) => o.textContent === 'Sam Lee').value; s.dispatchEvent(new Event('change', { bubbles: true }));`);
  await sleep(1500);
  await until(`document.getElementById('who')?.textContent === 'Sam Lee' && ${settled}`, 'the page as Sam');
  await go('/lab/app.html?app=stella-design-scheduling');
  await until(`document.querySelector('.shub-screen #shub-link-pass')`, 'the link screen');
  await shot('link-screen', { full: false });
  await js(`const s = document.querySelector('.shub-screen'); s.querySelector('#shub-link-pass').value = 'wrong-guess'; s.querySelector('form').requestSubmit();`);
  await until(`document.querySelector('#shub-link-err').textContent`, 'the wrong-password line');
  await shot('link-screen-error', { full: false });
  await js(`const s = document.querySelector('.shub-screen'); s.querySelector('#shub-link-pass').value = 'old-password'; s.querySelector('form').requestSubmit();`);
  await until(`!document.querySelector('.shub-screen') && document.querySelector('#view .page-head')`, 'signed in after linking');
  await shot('link-done', { full: false });
  await size(390, 844, true);
  await js(`localStorage.removeItem('stella.hub.demo.v1'); localStorage.removeItem('stella.hub.session'); localStorage.removeItem('lab.session.stella-design-scheduling');`);
  await go('/');
  await until(settled, 'the front page, demo started again');
  await js(`const s = document.getElementById('viewAs'); s.value = [...s.options].find((o) => o.textContent === 'Sam Lee').value; s.dispatchEvent(new Event('change', { bubbles: true }));`);
  await sleep(1500);
  await go('/lab/app.html?app=stella-design-scheduling');
  await until(`document.querySelector('.shub-screen #shub-link-pass')`, 'the link screen on a phone');
  await shot('link-screen-mobile', { full: false });
  await size(1440, 900);

  // ---- day one: the hub is online and no app has joined it yet. Every app is
  // a plain link to its own sign-in, for whoever a master has ticked it for.
  await size(1440, 900);
  await js(`localStorage.removeItem('stella.hub.demo.v1'); localStorage.removeItem('stella.hub.session');`);
  await go('/');
  await until(settled, 'the front page, demo started again');
  // The page holds one demo world (a singleton on globalThis): change it, save
  // it, and have the note follow. (No // comments inside: the text is run as one line's worth of code.)
  await js(`const F = await import('/js/fake.js');
    const w = F.demo();
    for (const pid of Object.keys(w.joined)) w.joined[pid] = false;
    const me = w.hub.session;
    w.hub.people[me].links = Object.fromEntries(Object.keys(w.apps).map((pid) => [pid, { plain: true }]));
    F.saveDemo();
    const { Hub } = await import('/core/v1/hub.js');
    await (await Hub._impl()).refresh();`);
  await go('/');
  await until(settled, 'the front page on day one');
  await shot('day-one');
  await go('/#/accounts');
  await until(settled, 'accounts on day one');
  await shot('day-one-accounts');

  console.log(`Done: ${OUT}`);
} catch (e) {
  if (e instanceof Done) console.log(e.message);
  else { console.error(`Stopped: ${e.message}`); process.exitCode = 1; }
} finally {
  try { await send?.('Browser.close'); } catch { /* already gone */ }
  browser.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the profile is in temp; it will go */ }
}
