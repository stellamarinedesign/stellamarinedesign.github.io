---
name: Hubinator
description: "The front door to the Stella apps. One tile per app, with what is waiting inside on its face."
colors:
  black-night: "#0e0a0a"
  band: "#1c1c1b"
  shadow-grey: "#282827"
  chip-grey: "#333331"
  rule-grey: "#454542"
  rule-strong: "#5e5e5a"
  text-white: "#ffffff"
  text-ash: "#d2d2ce"
  text-muted: "#b0b0ab"
  upsdell-red: "#af1f24"
  burning-star-red: "#ea372e"
  link-coral: "#ff7369"
  signal-amber: "#d97706"
  signal-amber-bg: "#2b1f08"
  signal-amber-text: "#f2b84b"
  toast-green: "#1f7a3a"
  workshop-white: "#ffffff"
  workshop-band: "#f5f4f0"
  workshop-chip: "#eceae4"
  workshop-rule: "#d4d2c8"
  workshop-rule-strong: "#b8b6ac"
  workshop-ink: "#1a1a18"
  workshop-ash: "#5a5a54"
  workshop-muted: "#6f6f68"
  workshop-header-muted: "#9ca3af"
  workshop-red: "#dc2626"
  workshop-red-text: "#b91c1c"
  workshop-amber-bg: "#fffbeb"
  workshop-amber-text: "#b45309"
  workshop-blue: "#2563eb"
  workshop-blue-bg: "#eff6ff"
  workshop-blue-text: "#1d4ed8"
  workshop-toast-green: "#15803d"
typography:
  header-title:
    fontFamily: "Friz Quadrata Pro, Friz Quadrata BT, Friz Quadrata, Georgia, serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.1em"
  headline:
    fontFamily: "Friz Quadrata Pro, Friz Quadrata BT, Friz Quadrata, Georgia, serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Friz Quadrata Pro, Friz Quadrata BT, Friz Quadrata, Georgia, serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.4
  body-strong:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.4
  field:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  meta:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  meta-strong:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  meta-figures:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  label:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.1em"
  count:
    fontFamily: "Sweet Sans Pro, Sweet Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0em"
    fontFeature: "tnum"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, Menlo, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  inner: "6px"
  md: "8px"
  lg: "11px"
  pill: "999px"
  workshop-md: "6px"
  workshop-lg: "10px"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "24px"
  sp-6: "32px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.upsdell-red}"
    textColor: "{colors.text-white}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-ash}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
  button-secondary-active:
    backgroundColor: "{colors.chip-grey}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.link-coral}"
  button-amber:
    backgroundColor: "transparent"
    textColor: "{colors.signal-amber-text}"
  button-small:
    typography: "{typography.meta-strong}"
    padding: "0 10px"
    height: "28px"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
  icon-button:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    size: "36px"
  icon-button-hover:
    backgroundColor: "{colors.chip-grey}"
  input:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  select:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "36px"
  field-label:
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  field-error:
    textColor: "{colors.link-coral}"
    typography: "{typography.meta}"
  chip:
    backgroundColor: "{colors.chip-grey}"
    textColor: "{colors.text-ash}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  chip-amber:
    backgroundColor: "{colors.signal-amber-bg}"
    textColor: "{colors.signal-amber-text}"
  chip-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
  count-bubble:
    backgroundColor: "{colors.burning-star-red}"
    textColor: "{colors.text-white}"
    typography: "{typography.count}"
    rounded: "{rounded.pill}"
    padding: "1px 6px"
  header:
    backgroundColor: "{colors.shadow-grey}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    padding: "0 24px"
    height: "56px"
  header-title:
    textColor: "{colors.text-white}"
    typography: "{typography.header-title}"
  tab:
    textColor: "{colors.text-muted}"
    typography: "{typography.body-strong}"
    padding: "3px 12px 0"
  tab-active:
    textColor: "{colors.text-white}"
  mode-strip:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-ash}"
    typography: "{typography.meta}"
    padding: "8px 24px"
  tile:
    backgroundColor: "{colors.shadow-grey}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 12px"
  tile-name:
    textColor: "{colors.text-white}"
    typography: "{typography.headline}"
  tile-label:
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  tile-line:
    backgroundColor: "transparent"
    textColor: "{colors.text-white}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    height: "56px"
  tile-line-hover:
    backgroundColor: "{colors.band}"
  tile-line-when:
    textColor: "{colors.text-ash}"
    typography: "{typography.meta-figures}"
  tile-line-when-late:
    textColor: "{colors.signal-amber-text}"
  tile-page-link:
    textColor: "{colors.text-ash}"
    typography: "{typography.meta}"
    padding: "6px 0"
  skeleton-line:
    backgroundColor: "{colors.band}"
    rounded: "{rounded.md}"
    height: "56px"
  callout:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  callout-amber:
    backgroundColor: "{colors.signal-amber-bg}"
    textColor: "{colors.signal-amber-text}"
  empty-state:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "16px"
  secret-box:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
    typography: "{typography.mono}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  accounts-grid:
    backgroundColor: "{colors.shadow-grey}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
  accounts-person-column:
    backgroundColor: "{colors.shadow-grey}"
    typography: "{typography.body-strong}"
    padding: "6px 12px"
  leftover-address-row:
    textColor: "{colors.text-white}"
    typography: "{typography.body-strong}"
    padding: "8px 12px"
    height: "52px"
  log-row:
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    padding: "10px 4px"
  dialog:
    backgroundColor: "{colors.shadow-grey}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "20px"
    width: "440px"
  dialog-wide:
    width: "640px"
  dialog-title:
    textColor: "{colors.text-white}"
    typography: "{typography.title}"
  menu:
    backgroundColor: "{colors.shadow-grey}"
    rounded: "{rounded.lg}"
    padding: "4px"
  menu-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-ash}"
    typography: "{typography.body}"
    rounded: "{rounded.inner}"
    padding: "0 10px"
    height: "36px"
  menu-item-hover:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
  menu-item-danger:
    textColor: "{colors.link-coral}"
  toast:
    backgroundColor: "{colors.toast-green}"
    textColor: "{colors.text-white}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  toast-warn:
    backgroundColor: "{colors.upsdell-red}"
  signin-column:
    backgroundColor: "{colors.black-night}"
    textColor: "{colors.text-white}"
    typography: "{typography.body}"
    width: "352px"
  signin-place:
    textColor: "{colors.text-white}"
    typography: "{typography.header-title}"
  signin-field:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
    typography: "{typography.field}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  switcher-button:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    size: "36px"
  switcher-popover:
    backgroundColor: "{colors.shadow-grey}"
    rounded: "{rounded.lg}"
    padding: "12px"
    width: "324px"
  switcher-app:
    backgroundColor: "transparent"
    textColor: "{colors.text-ash}"
    rounded: "{rounded.md}"
    padding: "12px 4px 10px"
    height: "84px"
  switcher-app-hover:
    backgroundColor: "{colors.band}"
    textColor: "{colors.text-white}"
  switcher-app-current:
    backgroundColor: "{colors.chip-grey}"
    textColor: "{colors.text-white}"
---

# Design System: Hubinator

<!-- The name above is a working name held in one constant (js/registry.js). tools/rename.py
     rewrites it here; the prose below says "the hub". -->
<!-- Recorded from the shipped code on 2026-11-17: css/style.css, css/themes.css, css/hub.css,
     core/v1/hub-impl.js, core/v1/hub.js and js/. The North Star and the descriptive wording
     come from PRODUCT.md, the front page's brief and the code's own comments. The owner has
     not been asked to confirm them. -->

## Overview

**Creative North Star: "The Front Door"**

The hub is a front door, not a merged system. A signed-in person opens it between other work,
at a desk PC and often in a window snapped to half a screen, to step into one of the Stella
apps or straight to the thing that is waiting inside one. So each app is one tile, and the
tile's face is that app's own overview: where to go and what needs attention are the same
object. The whole tile is a door, and each line on it is a smaller door to one thing.

It wears the family's look and owns none of it. The colour, type, spacing and motion tokens
are the Stella family's, copied unchanged from a sibling app and fixed. The hub builds its
components on those tokens and brings no palette of its own, so a theme changes variables and
cannot miss a spot. Dark Stella is the default, and the light Workshop theme is a variable
override for bright rooms. The page is greyscale at rest: red is one filled button at most and
otherwise a line or a marker, amber marks what is late or wants doing, and nothing casts a
shadow unless it floats above the page and will go away.

There are two layers. The hub's own page (the front page, Accounts and the account log) is
drawn by `css/hub.css` on the family tokens. The shared core draws a few things inside the
other apps' pages: the sign-in screen, the no-access cards, the change-password dialog, the app
switcher and a toast. Those pages have stylesheets the hub does not own, so everything the core
draws sits under one root element, starts from a clean slate, and carries its own short-named
copy of the family tokens. That copy is kept in step by hand.

**Key Characteristics:**

- One tile per app, with that app's overview on its face. The tile is a door, and so is each
  line on it.
- The Stella family's tokens, fixed. Dark by default, light Workshop by variable override.
- Greyscale at rest. Red is one filled button at most, and otherwise a line or a marker. Amber
  marks what is late or wants doing.
- Friz Quadrata names places. The body face does every line, label and control.
- Flat surfaces told apart by tone and a 1px edge. Shadows only on what floats.
- Room is held before content arrives: flat skeletons the size of the lines, no shimmer and no
  shift.
- Built for a desk and a half-screen window first, with 44px targets on phones and touch
  screens.
- Words only where a control needs them: a label, a rule, an error.
- A shared core, drawn inside the other apps, with its own hand-kept copy of the tokens.

## Colors

Near-black and warm grey at rest, with two brand reds used sparingly and one amber for what is
late or wants doing. Every value is a Stella family token, from `css/style.css` (dark) or
`css/themes.css` (Workshop). They are fixed, and change only with the owner's approval.

### Primary

- **Upsdell Red** (upsdell-red): the Stella brand red. It fills the one primary button in a
  view or dialog, the toast that says something did not work, and selected text.
- **Burning Star Red** (burning-star-red): the brighter brand red, always a line or a marker.
  It is the 3px rule under the header, the underline of the current tab, the focus ring and the
  text caret, the count bubble, and the 1px outline of a destructive button.

### Secondary

- **Signal Amber** (signal-amber-text on signal-amber-bg, with signal-amber as the outline):
  what is late or wants doing. It is the late mark on a tile line, the callout on Accounts, the
  Link button where a link is missing, and the chip that says why a column cannot be read.
- **Link Coral** (link-coral): the red that text can be set in. It says what went wrong (an
  error line, the edge of an invalid field) and labels a destructive choice. The family also
  names it as its link colour, and the hub draws no link in it.
- **Toast Green** (toast-green): the fill of a toast that says something worked.

The family's stylesheet also carries blue, green and violet signal hues, status colours and ten
category colours. The hub's dark theme uses none of them. They stay in the file because the
file is the family's.

### Neutral

- **Black Night** (black-night): the page ground, and the full-screen ground of the sign-in
  and no-access screens.
- **Band** (band): fields, the hover fill of a line, a button or a menu item, skeleton blocks,
  the shown-once box, the demo strip, and the fade on the grid's trailing edge.
- **Shadow Grey** (shadow-grey): the header bar, tiles, the Accounts grid, the list of leftover
  addresses, dialogs, menus and the app switcher.
- **Chip Grey** (chip-grey): chips, the quiet rules between lines and rows inside a container,
  the hover fill of an icon button, a pressed secondary button, and the current app in the
  switcher.
- **Rule Grey** (rule-grey): the 1px edge of every container and field, the rule over a tile's
  foot, menu separators, and the inner edge of the pinned column.
- **Strong Rule** (rule-strong): the outline of secondary buttons and outline chips, the rule
  under the grid's header row, a tile's edge on hover, the underline of page links, the dashed
  edge of an empty state, and the scrollbar thumb.
- **White** (text-white): titles, primary text, and the label on a red or green fill.
- **Ash** (text-ash): secondary text, button labels, dates and ages, chips.
- **Muted Ash** (text-muted): metadata, roles, sub-lines, uppercase labels, the quiet tabs, and
  disabled text.

Text pairings as the hub draws them clear 4.5:1 in both themes, worked out from the token
values. The one exception is the dark count bubble (see Chips).

### Workshop

The light theme, for bright offices and the workshop floor. It is the same system with other
values: one block of variable overrides keyed on the page's theme attribute, chosen per device
under the cog and applied before first paint.

- **Workshop White** (workshop-white): the ground, and every surface and panel on it. A tile is
  told from the ground by its edge alone.
- **Workshop Band, Chip and Rules** (workshop-band, workshop-chip, workshop-rule,
  workshop-rule-strong): the same four roles as Band, Chip Grey, Rule Grey and Strong Rule.
- **Workshop Ink** (workshop-ink): text, the fill of the primary button, and the header bar.
  The label on Ink is workshop-band.
- **Workshop Ash and Muted Ash** (workshop-ash, workshop-muted): secondary text and metadata.
  The quiet text on the Ink header is workshop-header-muted.
- **No brand red.** There is no rule under the header and no mark in it. The focus ring and the
  caret are workshop-blue, and selected text is workshop-blue-text on workshop-blue-bg. Errors
  and destructive labels are workshop-red-text, with workshop-red as the destructive outline.
  Amber is workshop-amber-text on workshop-amber-bg, with Signal Amber unchanged as the
  outline. Toasts are workshop-toast-green and workshop-red-text.
- Corners tighten (see Shapes), the scrim and the floating shadow lighten (see Elevation &
  Depth), and the header title drops its capitals.

### The core's copy

The shared core cannot use the page's variables, because it is drawn inside pages whose
stylesheets the hub does not own. Its styles are one block inside `core/v1/hub-impl.js`, under
one root element, and they open with a copy of the family tokens under short names, for both
themes. While a trial copy of the core is in use (`core/next/`), it holds the same block.

**The copy must be changed by hand whenever a family value changes.** This table is the check
list. As recorded, every value in the copy matches the family's.

| Family variable | Core's name | Dark | Workshop |
|---|---|---|---|
| `--ground` | `--g` | black-night | workshop-white |
| `--bg` | `--bg` | band | workshop-band |
| `--bg2` | `--bg2` | chip-grey | workshop-chip |
| `--surface` | `--sf` | shadow-grey | workshop-white |
| `--border` | `--bd` | rule-grey | workshop-rule |
| `--border2` | `--bd2` | rule-strong | workshop-rule-strong |
| `--text` | `--tx` | text-white | workshop-ink |
| `--text2` | `--tx2` | text-ash | workshop-ash |
| `--text3` | `--tx3` | text-muted | workshop-muted |
| `--accent` | `--ac` | upsdell-red | workshop-ink |
| `--accent-text` | `--act` | text-white | workshop-band |
| `--red-text` | `--rt` | link-coral | workshop-red-text |
| `--focus` | `--fc` | burning-star-red | workshop-blue |
| `--select-bg` | `--sb` | upsdell-red | workshop-blue-bg |
| `--select-text` | `--st` | text-white | workshop-blue-text |
| `--title-transform` | `--tt` | uppercase | none |
| `--title-spacing` | `--ts` | 0.1em | 0.02em |
| `--toast-bg` | `--ok` | toast-green | workshop-toast-green |
| `--toast-warn-bg` | `--warn` | upsdell-red | workshop-red-text |
| `--scrim` | `--scrim` | the scrim | the Workshop scrim |
| `--shadow-panel` | `--sh` | the floating shadow | the Workshop floating shadow |
| `--radius` | `--r` | md | workshop-md |
| `--radius-lg` | `--rl` | lg | workshop-lg |
| `--ease-out` | `--ease` | the family ease-out | the same |
| `--font` | `--font` | the body stack | the same |
| `--font-head` | `--head` | the heading stack | the same |

- Its type sizes (11, 13, 14.5, 16 and 19px), its control heights (36 and 44px) and its
  durations are written as plain numbers, not copied tokens. They match the family's scale and
  need the same hand check.
- The app switcher's button is drawn in the host app's header, outside the core's root. It
  carries a second, smaller stylesheet in `core/v1/hub.js` with plain values and no theme: an
  8px corner, a translucent grey hover veil, and a focus ring in the host page's own focus
  colour (`var(--focus)`, which every Stella app defines), falling back to Burning Star Red.

### Named Rules

**The Family Tokens Rule.** Every colour, size and curve comes from the family's stylesheet.
The hub's own stylesheet names no colour, so a theme overrides variables and cannot miss a
spot. The one exception is the white label on a toast. The tokens change only with the owner's
approval.

**The One Red Rule.** Upsdell Red fills one primary button in a view or dialog, and the toast
for something that did not work. Burning Star Red is a line or a marker (the header rule, the
current tab, focus, a caret, a destructive outline, a count) and never fills anything larger
than a count bubble.

**The Amber Rule.** Amber means late or wants doing, and nothing else. It always sits on words
or figures that say the same thing: a date that has passed, a sentence, a button's label.

## Typography

**Display Font:** Friz Quadrata (Friz Quadrata Pro, Friz Quadrata BT, Friz Quadrata, with
Georgia and then the generic serif as fallbacks), at weight 700. No italic is asked for.
**Body Font:** Sweet Sans Pro (then Sweet Sans), falling back to the platform UI face: Segoe UI
on the PCs, San Francisco on iPhones and iPads.
**Label/Mono Font:** the system monospace (ui-monospace, Cascadia Mono, Consolas, Menlo).

**Character:** a chiselled brand serif names each place, over a plain UI face that stays out of
the way in a dense line. Both brand faces are licensed and never shipped, so the fallbacks have
to read well on their own.

**Open question for the owner: which heading cut.** The stylesheet asks for the heading stack
at weight 700 and names no italic. What is drawn depends on the fonts installed on the device.
On the build PC the installed Friz Quadrata files give a bold italic cut, which is the cut in
the review screenshots. A device without the brand fonts gets Georgia bold, upright. The owner
has not said which cut is the family's. Until then the stack above is the record, and neither
cut is a rule.

### Hierarchy

- **Header title** (Friz 700, 19px, 1.25, uppercase with 0.1em tracking in the dark theme): the
  hub's name in the header bar, and over the sign-in form. In Workshop both are set as
  written, without capitals, with 0.02em tracking.
- **Headline** (Friz 700, 19px, 1.25): an app's name on its tile, a page heading, the heading
  of a no-access card, the heading of an error.
- **Title** (Friz 700, 16px, 1.3): a section heading on a page, and a dialog's title.
- **Body strong** (600, 14.5px, 1.4): a line's title, a person's name, button labels, tabs and
  toasts.
- **Body** (400, 14.5px, 1.4): everything read as a sentence: dialog text, log entries, menu
  items, callouts. An error block stops at 62ch.
- **Field** (400, 16px, 1.4): text in fields on phones and touch screens, and in every field
  the core draws.
- **Meta** (400, 13px, 1.4): roles, sub-lines, chips, hints, error lines and addresses. Small
  buttons use it at 600. Dates and ages use it with tabular figures.
- **Label** (700, 11px, 0.1em tracking, uppercase, Muted Ash): a field's caption, a column
  head, and the label over a tile's lines. It names the field, column or list directly under
  it, and never sits over a heading.
- **Count** (700, 11px, 1.45, no tracking, tabular figures): the number in a count bubble.
- **Mono** (400, 16px, 0.04em tracking): a password or key shown once.

### Named Rules

**The Friz-for-Places Rule.** Friz Quadrata names where you are or what you are being asked:
the hub, an app, a page, a section, a dialog. Anything read in a line or pressed is in the body
face. A line's title, a button, a tab and a label are never set in Friz.

**The Tabular Numbers Rule.** Dates, ages and counts use tabular figures, so a column of them
lines up and does not jitter as it changes.

**The 16px Field Rule.** On phones and touch screens a field's text is 16px, so iOS never zooms
the page on focus. The core's fields are 16px at every width, because the core cannot know the
page it is drawn in.

## Layout

A sticky header over one centred column. The column is at most 1344px wide with 24px of padding
(sp-5). Spacing runs on the family's 4/8px scale, sp-1 (4px) to sp-6 (32px), with 6, 10, 14 and
20px used inside components.

- **The front page** is the tile grid and nothing above it: two equal columns with a 16px gap,
  one column with a 12px gap on a phone. Tiles in a row are the same height, and each tile's
  page links sit at its foot.
- **Accounts** is a page heading with the one primary button, a callout when something wants
  doing, the grid, and the list of leftover addresses under a section heading. The grid scrolls
  sideways inside its own container, so the page never does, and its trailing edge fades while
  more columns lie to the right.
- **The account log** is a page heading over rows of when, who and what.

| Band | Width | What changes |
|---|---|---|
| Phone | under 700px | One column of tiles. The header becomes two rows: mark, name and cog, then the tabs on a 44px row of their own that scrolls sideways. The person's name is hidden. Page padding is 16px. The pinned person column narrows to 184px and its addresses wrap. A log row puts what happened on a line of its own. |
| Half-screen | 700px to 1099px | The default. Two columns of tiles, 24px of page padding. |
| Desk | 1100px and over | Only the page padding grows: 28px above, 48px at the sides, 32px below. |

Touch is a second axis, not a width. A phone is known by its width and an iPad by its coarse
pointer, and either one switches every control to its 44px size. An iPad 1024px wide gets the
half-screen layout with the touch sizes.

### Named Rules

**The Half-Screen Rule.** Every screen has to hold at about 900px wide (a window snapped beside
CAD) as well as at 390px and 1440px, and the review screenshots are taken at all three. Nothing
depends on width above 1100px except the page's padding.

**The Held Space Rule.** A tile holds the room for its card from the moment it is drawn: 206px,
which is a 36px label and three 56px lines with the two 1px rules between them. The card
arrives into exactly that, so the page does not move.

**The 44px Rule.** On a phone or a touch screen everything that can be pressed is at least 44px
tall, or is given that much room to be hit. A 22px chip that is a button reaches 11px past its
own top and bottom.

## Elevation & Depth

Flat by default. Depth comes from tone: the Black Night ground, Shadow Grey surfaces on it,
Band insets inside them, Chip Grey one step lighter for chips, and a 1px Rule Grey hairline
wherever two surfaces meet. Shadows belong only to layers that float above the page and can be
dismissed: a dialog, a menu, a toast, and the core's switcher, dialog and toast.

### Shadow Vocabulary

- **Floating panel** (`box-shadow: 0 12px 40px rgba(0, 0, 0, .5)`): dialogs, menus, toasts and
  the app switcher. In Workshop it softens to `rgba(0, 0, 0, .18)`.
- **Scrim** (`rgba(0, 0, 0, .55)`): behind a dialog, and behind the switcher when it is a sheet
  on a phone. In Workshop it is `rgba(26, 26, 24, .35)`.
- **Not shadows:** two 1px lines are drawn as insets rather than borders. The inner edge of the
  pinned person column is a Rule Grey line (`box-shadow: inset -1px 0 0`), the rule that shows
  cells passing beneath. The Workshop count bubble has an edge in its own colour
  (`box-shadow: inset 0 0 0 1px currentColor`).
- **Not a shadow either:** the 40px fade on the trailing edge of the Accounts grid, from clear
  to Band. It is there only while more columns lie to the right, and it says "this scrolls".

On the hub's page the order from the bottom is: the sticky header, a dialog on its scrim, a
menu, a toast. Everything the core draws sits above any host page, in the order: a full
screen, a dialog or sheet scrim, the switcher, a toast. While a full screen or a dialog of the
core's is up, the page behind it cannot be reached by Tab or by a screen reader.

### Named Rules

**The Floating-Only Shadow Rule.** Nothing at rest casts a shadow. Tiles, grids, lists and
rows are flat. A shadow means "this is above the page and will go away".

## Shapes

- **Corners** are modest and consistent:
  - 8px (md) on buttons, fields, icon buttons, toasts, skeleton blocks, and the hover fill of a
    line;
  - 11px (lg) on containers: tiles, the grid, lists, callouts, dialogs, menus, the empty box and
    the switcher;
  - 6px (inner) on a control nested inside a field or a menu: the Show button, a menu item;
  - a full pill only for chips and the count bubble.
  - In Workshop the two main steps tighten to 6px and 10px.
- **Lines** are 1px. The exceptions are the 3px Burning Star Red rule under the header and the
  3px underline of the current tab that sits on it. Rule Grey edges a container; the quieter
  Chip Grey divides the lines or rows inside one; Strong Rule is for an edge that has to be
  read, such as a button's outline or the rule under the grid's header row.
- **Focus** is a 2px ring in the focus colour, 2px outside the element. It moves 2px inside on
  a tab and on a tile's door, where an outer ring would be clipped. A menu item shows focus as
  its hover fill instead.
- **Icons** are drawn SVG on a 24 grid in the text colour, never Unicode characters, so they
  line up and follow the theme. They are drawn at 14, 16, 18, 20, 22 or 24px: 16px in a button
  or a menu, 18px on their own, 20px for the switcher button's dots, 22px for a tile's app icon,
  24px for an app in the switcher.
- **The mark** is the Stella icon (`images/brand/stella-icon.png`): 40px by 32px in the dark
  header, 56px over the sign-in form and the no-access cards.

### Named Rules

**The Dashed Rule.** A dashed edge means nothing here, or not yours to change: the empty box, a
disabled button, a disabled field. A solid edge is never used for either.

**The One Stroke Rule.** Every icon is a 1.8 stroke on a 24 grid with round caps and joins.
Dots are the only filled shapes: the three dots of "more", the point of the exclamation mark,
and the nine dots of the switcher button.

## Components

Recorded from the shipped code. Sizes are the dark theme's. Workshop changes values, not
structure, with the one exception noted under Chips.

### Buttons

Quiet and exact: outlined by default, one filled button at most.

- **Shape:** gently rounded (8px), 36px tall, 14px of side padding, a 16px icon 8px before the
  label when there is one. 44px tall on phones and touch screens.
- **Primary:** Upsdell Red fill and edge, White body-strong label. One in a view or dialog.
  Hover brightens it (1.12) and a press dims it (.94).
- **Secondary (the default):** transparent, a 1px Strong Rule outline, Ash label at 600. Hover
  fills it with Band and turns the label White; a press takes Chip Grey.
- **Ghost:** no outline, Muted Ash label at 400, 10px of side padding. It is in the stylesheet
  and on the lab's stand-in page. None of the hub's three views uses it.
- **Danger:** the secondary button with a Burning Star Red outline and a Link Coral label. It
  is never filled. It is the destructive choice in a confirm.
- **Amber:** the secondary button with a Signal Amber outline and an amber label. It is the
  Link button in a cell where a link wants doing.
- **Small:** 28px tall, 10px of side padding, a 13px label. For a button inside a row, a
  callout or a tile, and for "Show older" under the log. It still becomes 44px tall on touch.
- **Disabled:** transparent, Muted Ash label, a dashed Rule Grey outline, and no change on
  hover.
- **Icon button:** a 36px square (28px inside the grid) with an 8px corner and no outline.
  Hover fills it with Chip Grey. In the header it takes the header's text colour; in the grid
  it is Muted Ash and turns White on hover. 44px square on touch.
- **Inside a callout** a button takes the callout's own text colour for its outline and label.
- **Motion:** fill, outline and label colour change over 120ms on the family ease-out.

### Chips

- **Style:** 22px tall, a full pill, 8px of side padding, Chip Grey fill, Ash meta text. It
  names a fact about what it sits beside ("You", "Masters only").
- **Outline:** transparent with a 1px Strong Rule edge and Muted Ash text, the quieter of the
  two ("Own sign-in", "Not joined", "Removed").
- **Amber:** the amber tint with amber text, for why a column cannot be read.
- **A chip that is a button:** an outline chip followed by a 14px three-dot icon, used where
  the word is the only thing to press ("Linked", which opens that link's menu). On hover or
  while its menu is open the text turns White and the edge Muted Ash.
- **Count bubble:** a pill at least 18px wide beside a label, 1px by 6px of padding, the number
  centred in count type. In Workshop it also has a 1px edge in its own colour.

**Open question for the owner: the count bubble's colours.** The count is drawn with two family
tokens (`--count-bg` and `--count-text`), and the hub changes neither. In the dark theme that
is White on Burning Star Red, about 4.1:1 for 11px bold text, which is under the AA floor set
in PRODUCT.md. In Workshop it is amber text on a pale amber fill, about 4.8:1 for the text, but
the fill is almost the tile's own white (about 1.04:1), so on its own it is a numeral with no
bubble round it. The hub's stylesheet adds the 1px edge there to make it a bubble again, in one
of the two rules it writes for a theme instead of through a variable. The values are recorded because
they are what ships. The tokens are the family's to change, the question is with the owner, and
neither the dark pairing nor the added edge is a pattern for new components.

### Cards / Containers

- **Corner Style:** 11px.
- **Background:** Shadow Grey on the Black Night ground.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** 1px Rule Grey.
- **Internal Padding:** 16px by 20px on a tile (12px below); 12px by 14px on a callout or an
  inset box; 16px on the empty box.
- **Callout:** an 18px icon, a sentence, and one small button pushed to the right. The one on
  Accounts takes the amber tint and amber text, with no hairline. A neutral callout (Band with
  a hairline) is in the stylesheet, and no screen draws one yet.
- **Shown-once box:** a Band inset with a hairline that holds a temporary password or key: an
  uppercase label, the secret in mono (one click selects all of it), and a small Copy button.

### Inputs / Fields

- **Style:** Band fill, a 1px Rule Grey edge, 8px corners, 36px tall, 12px of side padding (8px
  on a select). 44px tall with 16px text on touch.
- **Label:** above the field in label type, 6px away. A hint under a field is Muted Ash meta.
- **Focus:** the family ring, as on everything else. The edge does not change. The caret takes
  the focus colour.
- **Error:** the reason is said under the fields in meta, in the red text colour (never the
  link colour, which is blue in Workshop), and the field it is about takes focus. The error
  line keeps 18px of room when empty, so the form does not jump. On the sign-in screen and in
  the hub page's own dialogs the field is also marked invalid, and its edge turns the same
  red until it is typed in again.
- **Disabled:** Muted Ash text and a dashed edge.
- **Password fields** carry their own Show and Hide button inside the field at the right: a
  28px text button in Muted Ash with a 6px corner. On touch it takes the field's full height.
- **Tick box:** the native 18px box tinted Ash, with its word beside it, in a row 36px tall.
- **A role select** in the grid is 120px wide.

### Navigation

- **Header:** a sticky Shadow Grey bar 56px tall, on the 3px Burning Star Red rule. It holds
  the Stella mark, the hub's name in header-title type, the tabs, then at the right the
  person's name in Muted Ash meta and a cog. The cog opens the settings menu: Password, Dark or
  Light as a ticked choice, Sign out, and the version.
- **Tabs:** only a hub master has them. Body strong in Muted Ash; White on hover. The current
  tab is White with a 3px Burning Star Red underline sitting on the header's rule. Its focus
  ring is inset.
- **Phone:** the tabs take a row of their own under the name, so none is cut short.
- **Workshop:** the bar is Ink with no rule and no mark, and the title is set as written,
  without capitals. The family's tab colour there is Ink, made for tabs on a light bar, and
  it would vanish on the Ink header. So the hub's stylesheet underlines the current tab in
  its own label colour in this theme: one of the two rules it writes for a theme rather than
  through a variable (the other is the count's edge).
- **Demo strip:** in demo mode only, a Band strip under the header with a hairline below it. It
  says in Ash meta that this is the demo, and holds a "View as" select and one small button.

### App tile (signature)

One app, and what is waiting in it.

- **The door:** a link lies under the whole tile. Everything else sits above it, and only the
  links and buttons above it take the pointer, so anywhere else on the tile opens the app. With
  a mouse, hovering the door raises the tile's edge to Strong Rule. The door's focus ring is
  inset.
- **Head row** (at least 36px): a 22px app icon in Ash, the app's name in headline type, the
  person's role there in Muted Ash meta, any chips, and an 18px chevron in Muted Ash at the
  right. The name, role and chips wrap as one group, so a narrow tile puts the role under the
  name instead of squeezing the name.
- **Label:** one uppercase label over the lines, in the app's own words, with the count bubble
  beside it. It sits 14px under the head row.
- **Lines:** up to three. Each is at least 56px: a title in body strong over a sub-line in
  Muted Ash meta, both cut with an ellipsis, and the date or age at the right in Ash meta with
  tabular figures. Lines are divided by 1px Chip Grey rules. A line with somewhere to go is its
  own door to that one thing: hover fills it with Band, 8px wider than the text on each side,
  with 8px corners.
- **Late mark:** when an app marks a line as late (a date that has passed, the oldest thing
  waiting), its date or age is set in amber text. A screen reader also hears "late".
- **Nothing waiting:** one quiet line in Muted Ash meta.
- **Card did not arrive:** one quiet line, "Not available just now.", and a small Try again
  button. A slow or broken card costs its own tile one line and nothing else.
- **No card:** an app that supplies none is a head row and its page links.
- **Foot:** the app's page links, pinned to the bottom of the tile under a 1px Rule Grey rule.
  They are quiet: Ash meta with a Strong Rule underline, 16px apart, turning White on hover. On
  touch each link gets 13px above and below, which makes it 44px tall.
- **Phone:** padding drops to 12px by 16px.

### Skeleton

A card still on its way is drawn as flat blocks exactly the size of the lines they stand for.

- **Block:** a 56px slot holding a Band block with a 1px Chip Grey edge and 8px corners, inset
  6px above and below. Slots are 1px apart, like the rules between lines.
- **In a tile:** the label's room and three blocks, inside the 206px the tile already holds.
- **On Accounts and the account log:** three or four blocks under the page heading.
- There is no shimmer. The container is marked busy and carries a "Loading" name for a screen
  reader.

### Accounts grid (signature)

People down, apps across, one cell for one person's place in one app. Used rarely and
carefully, at a desk.

- **Container:** Shadow Grey with a hairline and 11px corners, scrolling sideways when the apps
  do not fit. While more columns lie to the right, its trailing 40px fades from clear to Band
  inside the edge, over a cut cell or an empty gap alike, so the edge reads as "this scrolls"
  and not as a mistake. The fade goes when the last column is in view.
- **Header row:** uppercase labels over a 1px Strong Rule. Whatever is unusual about a column
  sits above its name as a chip, so the names stay on one line.
- **Rows:** 6px by 12px of cell padding, a 1px Chip Grey rule between rows, and at least 40px
  for a cell's controls (52px on touch).
- **Pinned person column:** it stays put while the apps scroll beneath it, between 232px and
  300px wide (184px on a phone), on its own Shadow Grey ground with the inset rule on its inner
  edge. It holds the name in body strong with its chips, the address under it in Muted Ash meta,
  and the person's own three-dot menu, which is therefore on screen at every width. At desk
  widths a long address ends in an ellipsis. On a phone it wraps and is never cut, because the
  address is what every confirm, toast and log line names a login by.
- **A cell** holds a role select, and one control for the link beside it: three dots where a
  role already says the person is there, or the "Linked" chip-button where there is no role to
  sit beside. Where a link wants doing the cell shows a small amber Link button (a plain small
  one for an app whose roles are fixed). An app that has not joined shows a "Tile" tick box
  instead.
- **A removed person** keeps their row, with the name and address struck through in Muted Ash.
- **While a step runs** the grid cannot be pressed and is marked busy, then it is drawn again
  from what is now true.

### Leftover addresses

Addresses an app lists that the hub has no person for. A section heading in title type, then a
list in a Shadow Grey container with a hairline and 11px corners. It is a list and not a table,
so each row wraps by itself on a narrow screen. A row is at least 52px with 8px by 12px of
padding and a Chip Grey rule above it: the address in body strong, chips naming the app and the
role, and a small Add person button.

### Account log

Rows of three columns: when (132px, Ash meta, tabular figures), who (176px, Muted Ash meta) and
what (the rest, body). Rows have 10px by 4px of padding and a 1px Chip Grey rule under each. A
small "Show older" button follows a full page.

### Dialogs

- **Box:** on the scrim, at most 440px wide (640px for a wide one), Shadow Grey with a hairline,
  11px corners, 20px of padding and 14px between its parts, with the floating shadow.
- **Parts, in order:** a title in title type, a sentence in Ash, fields, the error line, then
  the actions with the main one first and Cancel last, 8px apart.
- **Behaviour:** Enter saves and Esc cancels. Focus stays inside and goes back to what opened
  the dialog. A destructive confirm uses the outlined danger button and starts with focus on
  Cancel. A dialog that holds typed input closes only on purpose, never on a click outside it,
  and asks before throwing typing away.

### Menu

- **Panel:** under its button with right edges in line, or above it when there is no room.
  Between 200px and 320px wide, Shadow Grey with a hairline, 11px corners, 4px of padding and
  the floating shadow.
- **Item:** 36px tall (44px on touch) with 10px of side padding and a 6px corner, in Ash. Hover
  and focus fill it with Band and turn it White. A destructive item is Link Coral, and a
  disabled one is Muted Ash. An item may have a 16px icon in front (the others then hold its
  place), or a tick at the right when it is the chosen one.
- **Heading:** plain Muted Ash meta, not capitals, because a heading here is usually an
  address. Separators are 1px Rule Grey.
- **Keys:** the arrows move, Esc closes and gives focus back, Tab closes.

### Toast

A short message at the bottom centre of the page, 24px up. It is as wide as its words, up to
560px or the screen less 16px each side, with 10px by 14px of padding, 8px corners and the
floating shadow. Toast Green says something worked; Upsdell Red says it did not. The label is
White at 600 in both themes. It stays for about five seconds, and a new toast replaces the old
one.

### Loading, empty and error states

- **Empty:** a box with a dashed 1px Strong Rule edge, 11px corners and 16px of padding, in
  Muted Ash, with a short lead phrase in Ash at 600. It says what is not here yet, in one
  sentence.
- **Error:** a block at most 62ch wide with 24px above and below: a heading in headline type
  that says what failed ("Accounts did not load"), one line in Ash, and a secondary Reload
  button. It is announced as an alert.
- **The not-found page** stands alone on the family's base stylesheet: a heading, a sentence and
  one outlined link drawn like a secondary button. It follows the theme chosen on the device,
  as the hub's page does.

### The core's screens

Drawn by the shared core inside the other apps' pages, on its own copy of the tokens (see The
core's copy). The core reads the host page's theme each time it draws and wears it.

- **Sign-in screen:** the whole window in the ground colour, with one centred column at most
  352px wide and 16px between its parts. The Stella mark, then the hub's name in header-title
  type, centred. Then the form, 12px between its parts: Email and Password under uppercase
  labels (the password with its Show button), the error line, a primary Sign in button the full
  width of the column, a quiet text button in Muted Ash meta for the reset link, and a note
  line in Muted Ash meta. It is an ordinary form with a username and a current-password field,
  which is what password managers and the iPad keychain look for.
- **No-access cards:** the same ground and column with centred text: the mark, a heading in
  headline type, one sentence in Ash, and one or two buttons side by side that share the width.
  The way on is the primary button, and Sign out is secondary.
- **Change-password dialog:** the hub's dialog box, drawn by the core: at most 440px wide, with
  the same padding, corners and shadow. It holds three password fields each with its Show
  button, a hint under the new password, the error line, then the primary button and Cancel.
- **Switcher button:** a 36px square in the host app's header (44px on a coarse pointer) with
  an 8px corner and nine dots in the header's text colour. Hover lays a translucent grey veil
  over it, a little stronger while the switcher is open. It is drawn only for a login with two
  or more apps.
- **App switcher:** a panel under the button with right edges in line: 324px wide, Shadow Grey
  with a hairline, 11px corners, 12px of padding and the floating shadow. Inside is a grid of
  three columns, 4px apart. Each app is a cell at least 84px tall with a 24px icon over its
  short name in Ash, at meta size on a tighter 1.25 line. Hover fills a cell with Band and
  turns it White. The app you are in is Chip Grey with a White label at 600. Under a hairline
  are the person's name at 600 over their address in Muted Ash meta, and a link home: an 18px
  house icon and the hub's name.
- **On a phone** the switcher is a sheet from the bottom of the screen: full width, corners
  only at the top, an edge only at the top, on the scrim. Cells are at least 92px tall with
  body-size names, and the sheet keeps clear of the home indicator.
- **Toast:** the hub's toast, drawn by the core, for about four seconds.
- **In Workshop** the core follows the family as the hub's own page does: the name over the
  sign-in form is set as written, selected text is blue on pale blue, and the switcher
  button's focus ring takes the host page's focus colour.

### Motion

Only things that arrive move, and they move once.

- A dialog on the hub's page rises 6px and fades in over 200ms. A menu does the same over
  120ms. The core's change-password box simply appears.
- A toast rises 8px and fades in over 200ms.
- The app switcher grows from 96% and fades in over 150ms, from the point under its button. As
  a sheet it slides up over 260ms while its scrim fades in over 200ms.
- A button changes colour over 120ms.
- All of it is on the family ease-out, `cubic-bezier(.23, 1, .32, 1)`.

Nothing animates on load. A tile does not move when its card arrives, a skeleton does not
shimmer, and hover is a change of colour. With reduced motion asked for, none of the above
runs.

## Do's and Don'ts

### Do:

- **Do** build every component on the family variables, in `css/hub.css` or under the core's
  root, so the Workshop theme cannot miss a spot.
- **Do** change the core's copy of a token in the same change as the family's value, in both
  themes, using the table under The core's copy.
- **Do** check every screen at 390px, about 900px and 1440px, on a touch screen, and in both
  themes.
- **Do** hold the room for anything that loads after the page, with flat blocks the size of
  what they stand for (the Held Space Rule).
- **Do** give everything that can be pressed 44px of height on phones and touch screens, or
  that much room to be hit.
- **Do** show focus as the 2px ring in the focus colour, 2px outside the element, or 2px
  inside where an outer ring would be clipped.
- **Do** set dates, ages and counts in tabular figures.
- **Do** outline the destructive button in a confirm, and start that confirm with focus on
  Cancel.
- **Do** say what failed in the heading of an error, and offer one way on.
- **Do** draw an icon as a 1.8 stroke on a 24 grid in the text colour.
- **Do** write in plain Australian English.

### Don't:

- **Don't** change the family tokens in `css/style.css` or `css/themes.css`, or the Friz
  Quadrata headings, without the owner's approval.
- **Don't** ship the licensed font files (Friz Quadrata, Sweet Sans Pro).
- **Don't** fill more than one button in a view or dialog with Upsdell Red, and never fill
  anything larger than a count bubble with Burning Star Red.
- **Don't** put a shadow on a tile, a grid, a row or anything else at rest.
- **Don't** use amber for anything that is not late or wanting to be done.
- **Don't** set a line's title, a button, a tab, a label or a field in Friz Quadrata.
- **Don't** animate anything on load, shimmer a skeleton, or let the page move when content
  arrives.
- **Don't** use a Unicode character as an icon.
- **Don't** add words a control does not need: no reassurance and no paragraphs of
  explanation. A confirm may say what will happen in a sentence.
- **Don't** put a real name or address in a mock-up, a fixture or an example. Demo content is
  invented.
