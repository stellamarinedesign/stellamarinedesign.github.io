# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site with no build step: plain ES modules, served as-is by GitHub Pages from the root
of `stellamarinedesign.github.io`. Firebase JS SDK 10.12.2 (modular) from the CDN, with the
hub's own small Firebase project used for sign-in only (email + password, and a Firestore
holding the directory and the app keys). Chosen by the owner to match the other Stella web
apps. With no Firebase config the hub runs in a demo mode on invented data.

## Users

- **Hub master.** The owner, who runs design and drafting at Stella Marine Group and builds
  these tools. Adds people, gives each a role per app, re-keys or removes a login. At a desk PC.
- **Office staff who use several apps** (production, warehouse, design). Open the front page
  between other work to jump into an app, or to whatever needs attention across them. A desk
  PC, often a browser window snapped to half a screen beside CAD, Outlook or the ERP.
- **Workshop staff and shared floor logins.** Never visit the front page. They meet the
  sign-in screen once per device, and the app switcher only if their login has two or more
  apps. Phones and iPads, some fixed as kiosks.

## Product Purpose

One address and one login for Stella's internal tools: the production board, material
ordering, design scheduling, workshop drawings, and whatever is built next.

Success means:

- a person signs in once on a device and every app they are allowed opens already signed in;
- adding someone, changing what they may do in each app, and taking them off again is done in
  one place;
- the front page shows, without scrolling on a desk screen, the apps a person has and what
  needs their attention across them;
- a new app can be built and tested entirely alone and joined afterwards without touching the
  others.

## Positioning

A front door, not a merged system. Every app keeps its own Firebase project, data, rules and
role names; the hub carries one sign-in into each of them and draws the same sign-in screen
and app switcher inside all of them. Each app supplies its own overview card, so the hub never
has to know how another app stores its work.

## Operating Context

- **The front page** is glanced at on a desk PC between other work, at full width or snapped
  to about half a screen. It must read in seconds.
- **The sign-in screen and the app switcher** are drawn inside the other apps' own pages, in
  either of their themes (dark Stella, light Workshop), on PCs, phones and iPads.
- **The Accounts screen** is used rarely and carefully, by the hub master, at a desk. It is
  where someone can be locked out by mistake.
- **Neighbouring apps** share the `stellamarinedesign.github.io` origin: production board,
  material ordering, design scheduling, workshop drawings. The hub looks like one of them.
- **No hub Firebase project exists yet.** Everything is built and reviewed in demo mode.

## Capabilities and Constraints

**Terminology (fixed on screen):**

- **App:** one of the tools. Never "project", which is a Firebase word.
- **Role:** what a person may do in one app, in that app's own words (Manager, Design lead,
  Floor...). A person has one role per app, or none.
- **Linked:** the hub holds this person's sign-in for that app. Not linked: it does not.
- **Hub master:** may change accounts. Set in the Firebase console only.
- **Overview:** the cards on the front page showing what needs attention in each app.

**Capabilities:** one sign-in; the front page (apps and overview together), which each person
may arrange for themselves (hide and order tiles, for all their devices or one); the app
switcher inside every app; Accounts, for hub masters only (people down, apps across, a role per
cell; link, take over, rotate, hand back, remove, make a login again); linking an existing app
login by its owner, once, the first time they open that app; the account log.

**Constraints:**

- Nothing on screen beyond what a control needs: a label, a rule, an error. No reassurance,
  no explanation paragraphs.
- The repository is public. No staff addresses, customer or vessel names, or licensed font
  files in code, fixtures, mockups or examples. Demo content is invented.
- The security rules, not the interface, decide what anyone may read or change.
- A device that is already signed in to an app must not be slowed by the hub: no network on
  that path.
- The sign-in screen has to work with password managers and iPad keychain, inside pages whose
  styles the hub does not own.

**Undecided:**

- whether the single home-screen icon for every app works on iPads (to be proven);
- which apps get an overview card, and what each shows (each app decides when it joins).

## Brand Commitments

- **Name:** Hubinator. It began as a working name and the owner has kept it, on the condition
  that it stays easy to change: the name lives in one place and one command renames it
  everywhere (`tools/rename.py`).
- **Binding:**
  - It looks like one family with the other Stella apps.
  - The Stella colour tokens in `css/style.css` and the Friz Quadrata headings are fixed, and
    change only with the owner's approval.
  - The brand faces (Friz Quadrata, Sweet Sans Pro) are licensed and are not shipped.
- **Assets:** the mark at `images/brand/stella-icon.png`.
- **Voice:** plain, direct, workshop-practical. Australian English spelling.

## Evidence on Hand

- The four apps' own screens, and design scheduling's `DESIGN.md`, which records the family's
  design system.
- Demo people, addresses and card contents are invented and must stay so.
- **None of the following exist; do not fabricate them:** testimonials, usage figures, outside
  endorsements.

## Product Principles

1. **A bookmark never gets slower.** A signed-in device goes straight into its app. The hub
   shows itself only when it is needed.
2. **One login, permissions per app.** What a person may do is decided app by app, in that
   app's own words.
3. **The front page earns its place.** Where to go and what needs attention, at a glance, or
   it is just another tab.
4. **Say what happened and what to do next.** Accounts are where people get locked out; every
   state has plain words and a way on.
5. **Drawn once, the same everywhere.** The sign-in screen and the switcher are the hub's, and
   identical in every app.

## Accessibility & Inclusion

No formal standard has been set. The working floor is the family's:

- WCAG AA text contrast in both themes (dark Stella and light Workshop);
- 44px minimum touch targets on phones and iPads;
- full keyboard operation on desktop;
- reduced motion respected.
