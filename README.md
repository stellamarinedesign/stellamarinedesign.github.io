# Hubinator

One address and one login for Stella Marine Group's internal tools.

This repository is the root of the site (`stellamarinedesign.github.io`). It holds:

- **the front page**: a tile for each app a person has, with what needs attention in that app
  on the tile's face;
- **the shared core** (`core/v1/`): one small file every app loads, which carries the hub's
  sign-in into that app and draws the same sign-in screen and app switcher inside all of them;
- **Accounts**, for a hub master: people down, apps across, a role per cell.

It is a front door, not a merged system. Every app keeps its own Firebase project, its own
data, rules and role names. Nothing of theirs is stored here.

The repo is public and a static site hands every file to whoever asks. There are no addresses,
names or secrets in it; the Firebase identifiers in `js/registry.js` are public by design.

## How it works

A person has one password, in the hub's own Firebase project. In each app's project the same
person has an ordinary account whose password is a key nobody types. The hub keeps the keys;
the core hands one to the app's own sign-in. Because that account carries the person's real
address, the app's rules, lists and records work exactly as they did.

What an app adds is one call and one place in its header:

```js
const { Hub } = await import('/core/v1/hub.js');
const r = await Hub.connect({
  project: firebaseConfig.projectId, title: 'Production board',
  session: () => auth.currentUser?.email ?? null,   // the app's own session
  signIn:  ({ email, password }) => signInWithEmailAndPassword(auth, email, password),
  signOut: () => signOut(auth),
  legacy:  () => showOwnForm(),                      // only while migrating
});
// r.state: 'in' | 'legacy' | 'none' | 'broken' | 'unreachable'
Hub.switcher(document.getElementById('hubSlot'), { current: firebaseConfig.projectId });
```

A device that is already signed in to its app answers from a note in `localStorage`: no
network, and none of the rest of the core is even fetched. `lab/app.html` is a stand-in app
that does exactly this, to read or to try.

An app that wants a place on the front page publishes a small module of its own and names it
in the registry; see `js/cards.js`.

## Layout

| Path | What |
|---|---|
| `index.html`, `js/app.js`, `js/views/` | the hub page: front page, Accounts, account log |
| `core/v1/hub.js` | the contract every app loads. No imports, no SDK |
| `core/v1/hub-impl.js` | fetched by `hub.js` when needed: the hub's sign-in and what it draws inside other apps |
| `core/next/` | a trial copy of the core, for one device at a time (`tools/channel.py`) |
| `js/registry.js` | the apps the hub knows, and the hub's name |
| `js/linking.js`, `js/access.js`, `js/matrix.js`, `js/keys.js`, `js/errors.js` | the logic, with no Firebase in it |
| `js/backend.js`, `js/firebase.js` | that logic's two ports, over Firebase |
| `js/fake.js` | the same ports held in memory: the tests and the demo |
| `firestore.rules` | the hub project's rules |
| `lab/` | the demo's stand-in app; the proof page (material ordering's test project, real hub only); a page that checks the deployed rules |
| `tests/` | one suite, run in Node and in the browser |

## Running it

No build step. Serve the folder and open it:

```
python tools/serve.py
```

Then `http://localhost:8791/`. While `HUB_CONFIG` in `core/v1/hub-impl.js` is empty the hub
runs in **demo mode**: invented people, nothing online, and a "View as" switch to see it as
any of them. `python tools/site.py` serves the hub and the apps' local checkouts under one
origin, as the live site does.

With the server running, `node tools/shots.mjs` saves a screenshot of every screen in the demo
(desk, half-screen and phone widths, both themes) to `.impeccable/review/`. It drives Edge with
nothing on screen; set `HUB_BROWSER` to use another Chromium.

## Tests

```
node tests/node.mjs
```

or `http://localhost:8791/tests/` with the server running. Pure logic only; nothing loads
Firebase. The Node run also checks that no address has found its way into the repo.

## Releasing

- Bump `VERSION` in `js/version.js` and the `?v=` strings in `index.html` in the same commit
  as the change. Run `python tools/importmap.py` after adding or removing a module under `js/`.
- A change to the core is made in `core/next`, tried on one device, then promoted:
  `python tools/channel.py`. Bump `BUILD` in `core/v1/hub.js` when promoting. Every app's
  sign-in depends on that file; it only ever gains things.
- Rules: `firebase deploy --only firestore:rules`, then run `lab/rules.html` against the
  project.
- The name is one constant and a few static files: `python tools/rename.py "New Name"`.

Never create another Pages repository on this account named `core`, `js`, `css`, `images`,
`lab` or `tests`: its site would land on this one's folders.
