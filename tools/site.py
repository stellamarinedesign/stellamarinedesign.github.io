#!/usr/bin/env python3
"""Serve the hub AND the apps under one local origin, as GitHub Pages does.

On the live site every app is a folder of one origin:

    /                              this repo (the hub)
    /Production-Scheduling/        the production board's repo
    /material-ordering/            ...and so on

That one origin is what lets an app load the hub's core from /core/v1/hub.js
and share its sign-in note. This server lays the local checkouts out the same
way, so an app's patch can be tried against the local hub before anything is
pushed.

    python tools/site.py            # port 8791
    python tools/site.py 8792

WHAT IT IS NOT. The apps' Firebase keys only work from the live site (and, for
material ordering's TEST project, from localhost:8791). Served from here the
board and design scheduling fall back to their local modes or fail to sign in.
This is for checking that pages load the core, draw the switcher and behave
when the hub is in demo mode - not for looking at live data.

Like GitHub Pages, a path with no extension is tried with `.html` added, which
is how the board's own links (`parts`, `vessel-codes`) are written.

The MOUNTS below are relative to the folder that holds all the projects. A
checkout that is missing is simply not served.
"""
import http.server
import os
import posixpath
import socketserver
import sys
import urllib.parse
from pathlib import Path

HUB = Path(__file__).resolve().parent.parent
PROJECTS = HUB.parent.parent

MOUNTS = {
    '/Production-Scheduling/': PROJECTS / 'production-scheduling' / 'Production Scheduling',
    '/material-ordering/': PROJECTS / 'material-ordering',
    '/design-scheduling/': PROJECTS / 'design-scheduling' / 'Design Scheduling',
    '/stella-workshop-drawings/': PROJECTS / 'stella-workshop-drawings' / 'stella-workshop-drawings',
}


class Site(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urllib.parse.unquote(path.split('?', 1)[0].split('#', 1)[0])
        path = posixpath.normpath(path) + ('/' if path.endswith('/') else '')
        root, rest = HUB, path.lstrip('/')
        for prefix, folder in MOUNTS.items():
            if (path + '/').startswith(prefix) or path.startswith(prefix):
                root, rest = folder, path[len(prefix):]
                break
        parts = [p for p in rest.split('/') if p and p not in ('.', '..')]
        full = Path(root, *parts)
        # A page named without its extension, as Pages serves it.
        if not full.exists() and not full.suffix and full.with_suffix('.html').exists():
            full = full.with_suffix('.html')
        out = str(full)
        return out + os.sep if path.endswith('/') and full.is_dir() else out

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    Site.extensions_map.update({'.js': 'text/javascript', '.mjs': 'text/javascript'})
    with Server(('', port), Site) as httpd:
        print(f'Hub:  {HUB}  ->  http://localhost:{port}/')
        for prefix, folder in MOUNTS.items():
            print(f'      {folder}  ->  {prefix}' + ('' if folder.exists() else '   (not found, not served)'))
        httpd.serve_forever()
