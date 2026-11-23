// node.mjs - run the suite from a terminal:  node tests/node.mjs
//
// The same tests/run.js the browser page runs, plus one check only Node can
// make: that no address has found its way into the repository. The repo is
// public, and a static site hands every file in it to whoever asks.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './run.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = new Set(['.js', '.mjs', '.html', '.css', '.json', '.md', '.txt', '.py', '.yml', '.rules', '']);
const SKIP = new Set(['.git', 'node_modules', '.firebase']);
// Invented addresses are fine: the domains reserved for examples (RFC 2606),
// which can never belong to anybody, and nothing else.
const ALLOWED = /@(?:[a-z0-9-]+\.)*(?:test|example|invalid)$|@example\.(?:com|org|net)$/i;
const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (TEXT.has(extname(name).toLowerCase())) yield path;
  }
}

function addressesInRepo() {
  const found = [];
  for (const path of files(ROOT)) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.match(ADDRESS) ?? []) {
      if (!ALLOWED.test(m)) found.push(`${relative(ROOT, path)}: ${m}`);
    }
  }
  return found;
}

/**
 * The hub's name is one constant (js/registry.js) where code can read it, and
 * is written out by hand in the few files that cannot: tools/rename.py changes
 * them together, by replacing the old name. A file that says something else
 * would be missed by it, so they must all agree.
 */
function nameDrift() {
  const name = /export const HUB_NAME = '([^']+)';/.exec(readFileSync(join(ROOT, 'js', 'registry.js'), 'utf8'))?.[1];
  if (!name) return ['js/registry.js: no HUB_NAME'];
  const out = [];
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  if (manifest.name !== name) out.push(`manifest.json name: "${manifest.name}", not "${name}"`);
  if (manifest.short_name !== name) out.push(`manifest.json short_name: "${manifest.short_name}", not "${name}"`);
  const title = /<title>([^<]*)<\/title>/.exec(readFileSync(join(ROOT, 'index.html'), 'utf8'))?.[1];
  if (title !== name) out.push(`index.html title: "${title}", not "${name}"`);
  return out;
}

/**
 * The Stella internal-apps rules (the stella-internal-ux skill) that code can
 * be checked against, over everything the site serves. Motion: only named
 * properties, no layout properties, no ease-in entrance, nothing from
 * scale(0), nothing endless, nothing anyone waits on over 300ms (the one
 * exception is the refused-field shake, about 360ms), and a reduced-motion
 * rule wherever something moves. Words: no button that only says OK, Done,
 * Submit, Confirm or Apply.
 */
function uxRules() {
  const out = [];
  const served = [...files(ROOT)].filter((p) => {
    const rel = relative(ROOT, p).replace(/\\/g, '/');
    return /\.(css|html|js)$/.test(rel) && !/^(tests|tools)\//.test(rel);
  });
  const tokens = {};
  for (const m of readFileSync(join(ROOT, 'css', 'style.css'), 'utf8').matchAll(/(--dur[\w-]*):\s*(\d+)ms/g)) tokens[m[1]] = Number(m[2]);
  for (const path of served) {
    const rel = relative(ROOT, path).replace(/\\/g, '/');
    const text = readFileSync(path, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      if (/transition:\s*all\b/.test(line)) out.push(`${at}: transition: all (name the properties)`);
      if (/scale\(0\)/.test(line)) out.push(`${at}: scale(0) (start from .95 to .97)`);
      if (/ease-in(?!-out)\b/.test(line)) out.push(`${at}: ease-in (ease-out for what arrives)`);
      if (/\binfinite\b/.test(line)) out.push(`${at}: an endless animation (only while something is really in progress)`);
      for (const decl of line.match(/(?:transition|animation):[^;}"`]*/g) ?? []) {
        if (/\b(top|right|bottom|left|width|height)\b/.test(decl)) out.push(`${at}: animates a layout property (${decl.trim()})`);
        const waits = decl.split(',').filter((part) => !/shake/.test(part));
        for (const part of waits) {
          const ms = [...part.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
          const viaToken = [...part.matchAll(/var\((--dur[\w-]*)\)/g)].map((m) => tokens[m[1]] ?? 0);
          // A delay is the second time in a part; the first is how long it runs.
          const runs = [...ms, ...viaToken][0];
          if (runs > 300) out.push(`${at}: runs ${runs}ms (nothing anyone waits on runs over 300ms)`);
        }
      }
    });
    if (/\b(transition|animation)\s*:/.test(text) && !/prefers-reduced-motion/.test(text)) out.push(`${rel}: moves, with no reduced-motion rule`);
    if (/^(js|core)\//.test(rel)) {
      for (const m of text.matchAll(/['"](OK|Ok|Done|Submit|Confirm|Apply)['"]/g)) {
        out.push(`${rel}: a button that only says "${m[1]}" (say what it does)`);
      }
    }
  }
  for (const [name, ms] of Object.entries(tokens)) if (ms > 300) out.push(`css/style.css: ${name} is ${ms}ms`);
  return out;
}

const results = await run();
const stray = addressesInRepo();
results.push({
  group: 'the repository',
  name: 'no real address anywhere in the repo',
  pass: stray.length === 0,
  detail: stray.join('\n'),
});
const drift = nameDrift();
results.push({
  group: 'the repository',
  name: 'the hub has one name, everywhere it is written',
  pass: drift.length === 0,
  detail: drift.join('\n'),
});

const ux = uxRules();
results.push({
  group: 'the repository',
  name: 'motion and button words keep to the Stella internal-apps rules',
  pass: ux.length === 0,
  detail: ux.join('\n'),
});

let group = '';
for (const r of results) {
  if (r.group !== group) { group = r.group; console.log(`\n${group}`); }
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.name}`);
  if (!r.pass && r.detail) console.log(r.detail.split('\n').map((l) => `         ${l}`).join('\n'));
}
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `\n${failed.length} of ${results.length} FAILED` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
