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

let group = '';
for (const r of results) {
  if (r.group !== group) { group = r.group; console.log(`\n${group}`); }
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.name}`);
  if (!r.pass && r.detail) console.log(r.detail.split('\n').map((l) => `         ${l}`).join('\n'));
}
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `\n${failed.length} of ${results.length} FAILED` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
