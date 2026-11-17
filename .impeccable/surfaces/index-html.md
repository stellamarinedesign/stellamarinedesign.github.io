---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["js/views/launcher.js","css/hub.css"]
---

# Front page (the launcher and overview)

Mode: Operate. The page a signed-in person with several apps opens between other work, on a
desk PC first (often a window snapped to about half a screen); it also has to work on a phone.

Job: open an app in one click, or go straight to the thing that needs attention inside one.
Success: both are readable without scrolling at desk height, in seconds.
Must not: read as a marketing page or a dashboard of numbers; cost a signed-in person any wait
before the tiles appear (cards fill in after); explain itself in prose.
Content: one tile per app the login has, in group order; each app's own overview card when it
has one; page links; the hub master's Accounts and Account log sit in the header, not here.
Chosen by the owner on 2026-11-17 from three dealt structures (Live tiles, Today board, Rail
and feed).

## Direction contract

THESIS: Each app is one tile and the tile's face is its overview, so where to go and what is
waiting are the same object. It refuses the launcher-above-dashboard split, where the eye has
to match a tile to a separate card.

OWN-WORLD: The Stella family as shipped. Black Night ground; Shadow Grey tiles with a 1px Rule
Grey edge and 11px corners; Friz Quadrata for app names only; the body face for every line;
tabular figures for dates and ages; Burning Star Red only as the header rule, the focus ring
and count bubbles; amber only on what is overdue or oldest. No shadows at rest.

STORY: The person sees their apps and, inside each, the two or three lines that matter now.
They click a line to go to that item, or anywhere else on the tile to open the app.

FIRST VIEWPORT: Header bar (mark, name, Home / Accounts / Account log for a master, name, cog)
on the red rule. Below it a two-column grid of equal-height tiles at desk width, one column
under 700px. Each tile: a head row (icon, app name, role, chevron); a small label with an
optional count; up to three lines, each a title over a sub-line with its date or age at the
right; a foot of page links. No hero, no summary strip, no totals row. Signature interaction:
the whole tile is the door (a full-bleed link under its content) and each line above it is its
own door; cards arrive into line-sized skeletons with no layout shift, and nothing else moves.

FORM: Live tiles, third on the ordered list of seven; seed:0c54942f0f25d4c6.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
