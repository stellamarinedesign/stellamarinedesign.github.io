#!/usr/bin/env python3
"""The two copies of the shared core: the live one and the trial one.

    core/v1/     what every app loads. A mistake here breaks sign-in everywhere.
    core/next/   the trial copy. Nothing loads it unless a device asks to.

A change to the core is made in core/next, tried on one device, and only then
copied to core/v1:

    python tools/channel.py stage      core/v1 -> core/next   (start from what is live)
    python tools/channel.py promote    core/next -> core/v1   (make the trial live)
    python tools/channel.py diff       which files differ

To try the trial copy on a device, in that browser's console on any page of
the site:

    localStorage.setItem('stella.hub.channel', 'next')     # and reload
    localStorage.removeItem('stella.hub.channel')          # back to the live copy

The copies differ in one line: the CHANNEL constant in hub.js, which is what
stops the trial copy looking for a trial copy of itself. This script keeps it
right. Bump BUILD in both copies of hub.js by hand with EVERY hub release,
to the same string as js/version.js: the core fetches hub-impl.js and the
registry under it (tests/node.mjs checks the live copy).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVE = ROOT / 'core' / 'v1'
NEXT = ROOT / 'core' / 'next'
FLAG = "const CHANNEL = '{}';"


def copy(src, dst, channel):
    dst.mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in src.iterdir() if p.is_file())
    for old in dst.iterdir():
        if old.is_file() and old.name not in names:
            old.unlink()
    other = 'next' if channel == 'v1' else 'v1'
    for name in names:
        text = (src / name).read_text(encoding='utf-8')
        if name == 'hub.js':
            if FLAG.format(other) not in text:
                sys.exit(f'{src / name}: expected the line {FLAG.format(other)}')
            text = text.replace(FLAG.format(other), FLAG.format(channel))
        (dst / name).write_text(text, encoding='utf-8', newline='')
        print(f'  {name}')
    print(f'{src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}')


def diff():
    names = sorted({p.name for d in (LIVE, NEXT) if d.exists() for p in d.iterdir() if p.is_file()})
    same = True
    for name in names:
        a = (LIVE / name).read_text(encoding='utf-8') if (LIVE / name).exists() else None
        b = (NEXT / name).read_text(encoding='utf-8') if (NEXT / name).exists() else None
        if a is not None and b is not None:
            b = b.replace(FLAG.format('next'), FLAG.format('v1'))
        if a != b:
            same = False
            print(f'  differs: {name}')
    print('the two copies are the same' if same else 'core/next has changes that core/v1 does not')


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    if what == 'stage':
        copy(LIVE, NEXT, 'next')
    elif what == 'promote':
        copy(NEXT, LIVE, 'v1')
    elif what == 'diff':
        diff()
    else:
        sys.exit(__doc__)
