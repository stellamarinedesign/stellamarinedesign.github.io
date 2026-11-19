// backend.js - what the hub page talks to: Firebase, or the demo.
//
// js/linking.js is written against two PORTS (a hub and an app) and never
// names Firebase. This file is those ports for real, and the same shape over
// js/fake.js for the demo, chosen by whether the hub has a Firebase config
// (core/v1/hub-impl.js). Views call nothing else.
//
//   backend.demo         true in the demo
//   backend.hub          the hub port, acting as the signed-in person
//   backend.app(pid)     the app port for one app's project
//   backend.joined()     { pid: boolean } which apps load the core
//   backend.hasCard(pid) does that app supply an overview card?
//   backend.hub.getSelf / setSelf / listSelf   a person's own record (tiles)
//   backend.card(pid, { email, role })  -> what its card returned

import { PROJECTS } from './registry.js';
import { tidyEmail } from './keys.js';
import { HubError } from './errors.js';
import { opsToPatches } from './access.js';

export async function makeBackend(impl) {
  return impl.isDemo() ? demoBackend() : realBackend(impl);
}

// ---------------------------------------------------------------------------
// the demo
// ---------------------------------------------------------------------------

async function demoBackend() {
  const F = await import('./fake.js');
  const w = F.demo();
  const uid = w.hub.session;
  const email = Object.entries(w.hub.users).find(([, u]) => u.uid === uid)?.[0] ?? '';
  return {
    demo: true,
    hub: F.fakeHub(w, { as: uid, onChange: F.saveDemo }),
    // The acting person reaches an app's lists only if they are linked to it themselves.
    app: (pid) => F.fakeApp(w, pid, { as: w.hub.people[uid]?.links?.[pid]?.linked ? email : null, onChange: F.saveDemo }),
    joined: () => ({ ...w.joined }),
    hasCard: (pid) => Boolean(F.DEMO_CARDS[pid]),
    card: (pid, ctx) => F.DEMO_CARDS[pid](ctx),
    // Demo only: look at the hub as somebody else, or start it over.
    people: () => Object.entries(w.hub.people).map(([id, p]) => ({ uid: id, name: p.name, email: p.email })),
    viewAs: (id) => { w.hub.session = id; F.saveDemo(); },
    reset: () => { F.resetDemo(); },
  };
}

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

/** Firestore refuses `undefined`: drop it. */
const clean = (o) => JSON.parse(JSON.stringify(o));

async function realBackend(impl) {
  const { sdk, projectApp } = await import('./firebase.js');
  const { app: fapp, auth: fa, fs } = await sdk();
  const provider = await impl.provider();
  const hubAuth = provider.auth;
  const db = fs.getFirestore(provider.app);
  const me = () => ({ uid: hubAuth.currentUser.uid, email: tidyEmail(hubAuth.currentUser.email) });
  const person = (uid) => fs.doc(db, 'directory', uid);
  const key = (uid, pid) => fs.doc(db, 'keys', uid, 'p', pid);

  // Hub logins are made on a second app, so the master's own sign-in is untouched.
  async function second() {
    const name = 'stella-hub:accounts';
    let a = fapp.getApps().find((x) => x.name === name);
    if (!a) { a = fapp.initializeApp(impl.config, name); fa.initializeAuth(a, { persistence: fa.inMemoryPersistence }); }
    return fa.getAuth(a);
  }

  const hub = {
    now: () => new Date().toISOString(),
    me,
    isMaster: async () => {
      try { return ((await fs.getDoc(fs.doc(db, 'config', 'access'))).data()?.masters ?? []).includes(me().uid); }
      catch { return false; }                // only a master may read it
    },
    getKey: async (uid, pid) => { const d = await fs.getDoc(key(uid, pid)); return d.exists() ? d.data() : null; },
    // Firestore Lite has no offline queue: a write that resolves has reached the server.
    putKey: (uid, pid, k) => fs.setDoc(key(uid, pid), clean(k)),
    deleteKey: (uid, pid) => fs.deleteDoc(key(uid, pid)),
    listKeys: async (uid) => Object.fromEntries((await fs.getDocs(fs.collection(db, 'keys', uid, 'p'))).docs.map((d) => [d.id, d.data()])),
    listPeople: async () => (await fs.getDocs(fs.collection(db, 'directory'))).docs.map((d) => ({ uid: d.id, ...d.data() })),
    getPerson: async (uid) => { const d = await fs.getDoc(person(uid)); return d.exists() ? { uid, ...d.data() } : null; },
    createPerson: (uid, data) => fs.setDoc(person(uid), clean(data)),
    patchPerson: (uid, patch) => fs.updateDoc(person(uid), Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? fs.deleteField() : v]))),
    deletePerson: (uid) => fs.deleteDoc(person(uid)),
    setLink: (uid, pid, link) => fs.updateDoc(person(uid), { [`links.${pid}`]: link === null ? fs.deleteField() : clean(link) }),
    createLogin: async (email, password) => {
      const a = await second();
      const c = await fa.createUserWithEmailAndPassword(a, tidyEmail(email), password);
      await fa.signOut(a);
      return c.user.uid;
    },
    checkLogin: async (email, password) => {
      const a = await second();
      const c = await fa.signInWithEmailAndPassword(a, tidyEmail(email), password);
      await fa.signOut(a);
      return c.user.uid;
    },
    getSelf: async (uid) => { const d = await fs.getDoc(fs.doc(db, 'self', uid)); return d.exists() ? d.data() : null; },
    // Merged, so tiles and the linked list never overwrite each other.
    setSelf: (uid, patch) => fs.setDoc(fs.doc(db, 'self', uid), clean(patch), { merge: true }),
    listSelf: async () => Object.fromEntries((await fs.getDocs(fs.collection(db, 'self'))).docs.map((d) => [d.id, d.data()])),
    log: (entry) => fs.addDoc(fs.collection(db, 'activity'), clean(entry)),
    listLog: async (n = 50) => (await fs.getDocs(fs.query(fs.collection(db, 'activity'), fs.orderBy('at', 'desc'), fs.limit(n)))).docs.map((d) => d.data()),
  };

  /** The signed-in person's own session in one app's project, opened with their own key. */
  async function mine(pid) {
    const a = await projectApp(pid, 'me');
    const au = fa.getAuth(a);
    if (!au.currentUser || tidyEmail(au.currentUser.email) !== me().email) {
      const k = await hub.getKey(me().uid, pid);
      if (!k) throw new HubError('not-linked', 'You are not linked to that app yourself.');
      let last = null;
      let ok = false;
      for (const password of [k.k, k.next]) {
        if (!password) continue;
        try { await fa.signInWithEmailAndPassword(au, k.email || me().email, password); ok = true; break; }
        catch (e) { last = e; }
      }
      if (!ok) throw last;
    }
    return { db: fs.getFirestore(a) };
  }

  function app(pid) {
    const p = PROJECTS[pid];
    const tmp = async () => fa.getAuth(await projectApp(pid, 'tmp'));
    const lists = async () => fs.doc((await mine(pid)).db, ...p.access.doc);
    return {
      projectId: pid,
      title: p.title,
      create: async (email, password) => { const au = await tmp(); await fa.createUserWithEmailAndPassword(au, tidyEmail(email), password); await fa.signOut(au); },
      check: async (email, password) => { const au = await tmp(); await fa.signInWithEmailAndPassword(au, tidyEmail(email), password); await fa.signOut(au); },
      changePassword: async (email, current, next) => {
        const au = await tmp();
        const c = await fa.signInWithEmailAndPassword(au, tidyEmail(email), current);
        await fa.updatePassword(c.user, next);
        await fa.signOut(au);
      },
      readAccess: async () => {
        if (p.access.fixed) return null;
        const d = await fs.getDoc(await lists());
        return d.exists() ? d.data() : null;
      },
      // updateDoc, never setDoc: a missing document must stay missing (the apps
      // let anybody signed in CREATE it), and only the named lists are touched.
      listOps: async (ops) => {
        const ref = await lists();
        const patches = opsToPatches(ops);
        for (const [i, patch] of patches.entries()) {
          const data = {};
          for (const [list, v] of Object.entries(patch)) data[list] = v.add ? fs.arrayUnion(...v.add) : fs.arrayRemove(...v.remove);
          if (i === patches.length - 1) { data.updatedAt = new Date().toISOString(); data.updatedBy = me().email; }
          await fs.updateDoc(ref, data);
        }
      },
    };
  }

  return {
    demo: false,
    hub,
    app,
    joined: () => Object.fromEntries(Object.entries(PROJECTS).map(([pid, p]) => [pid, Boolean(p.joined)])),
    hasCard: (pid) => Boolean(PROJECTS[pid]?.card),
    // The app's own card module, handed a read handle for its project as this person.
    card: async (pid, ctx) => {
      const mod = await import(PROJECTS[pid].card);
      const { db } = await mine(pid);
      return mod.card({ db, fs, ...ctx });
    },
  };
}
