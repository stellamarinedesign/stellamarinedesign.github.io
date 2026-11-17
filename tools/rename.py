#!/usr/bin/env python3
"""Rename the hub, everywhere its name is written.

"Hubinator" began as a working name. The name is one constant (HUB_NAME in
js/registry.js) wherever code can read it: the header, the sign-in screen, the
switcher. A few static files cannot read a constant and carry the name
literally: page titles and the web manifest. This rewrites the constant and
those files together.

    python tools/rename.py "Stella Hub"
    python tools/rename.py                 # show the current name and where it is written

Afterwards: bump VERSION in js/version.js and BUILD in core/v1/hub.js (the
usual release steps), and copy core/v1 to core/next with tools/channel.py if a
trial copy is in use. An iPad home-screen icon keeps the name it was added
with; re-add it to see the new one. The private notes outside this repo
(../handoff, ../SETUP.md) are not touched: they say "the hub" throughout.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / 'js' / 'registry.js'
FILES = ['js/registry.js', 'index.html', '404.html', 'manifest.json', 'lab/app.html', 'lab/rules.html', 'README.md', 'PRODUCT.md', 'DESIGN.md']
NAME = re.compile(r"export const HUB_NAME = '([^']+)';")


def current():
    m = NAME.search(REGISTRY.read_text(encoding='utf-8'))
    if not m:
        sys.exit('js/registry.js: no HUB_NAME found')
    return m.group(1)


def main():
    old = current()
    if len(sys.argv) < 2:
        print(f'The hub is called "{old}". Written in:')
        for name in FILES:
            path = ROOT / name
            if path.exists():
                print(f'  {name}: {path.read_text(encoding="utf-8").count(old)}')
        return
    new = sys.argv[1].strip()
    if not new or "'" in new or '"' in new or '<' in new:
        sys.exit('A name without quotes or angle brackets, please.')
    if new == old:
        sys.exit(f'It is already called "{old}".')
    for name in FILES:
        path = ROOT / name
        if not path.exists():
            continue
        text = path.read_text(encoding='utf-8')
        n = text.count(old)
        if n:
            path.write_text(text.replace(old, new), encoding='utf-8', newline='')
        print(f'  {name}: {n}')
    print(f'"{old}" is now "{new}". Bump the version strings before releasing.')


if __name__ == '__main__':
    main()
