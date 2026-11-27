// version.js - what build of the hub PAGE is on screen.
//
// There is no build step, so nothing stamps this automatically: it is bumped by
// hand in the same commit as the change it names. GitHub Pages serves
// everything with max-age=600, so a refresh within ten minutes of a deploy can
// legitimately show the old page; a version on screen is how "not deployed
// yet" is told apart from "deployed, and my browser is holding the old one".
//
// The stylesheet links and the import map in index.html carry `?v=` with this
// same string. After adding or removing a module under js/, regenerate the
// map with `python tools/importmap.py`.
//
// The shared core (core/v1/hub.js) has its OWN build string: apps load it
// directly, on their own schedule, and it changes far less often than this.
export const VERSION = '2026-11-27.3';
