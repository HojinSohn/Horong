#!/usr/bin/env python3
"""Serves frontend/dist with cache headers that keep index.html always
revalidated -- plain `python -m http.server` sends no Cache-Control at all,
so a browser (or a phone's installed app-shortcut window, which is more
prone to skipping revalidation on its own) can keep serving a deploy from
before the last update indefinitely. Vite's JS/CSS assets are content-hashed
per build, so they're safe to cache indefinitely; only index.html (which
references those hashes) needs to always be fetched fresh."""
from __future__ import annotations

import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()


def main() -> None:
    host = os.environ.get("FRONTEND_HOST", "0.0.0.0")
    port = int(os.environ.get("FRONTEND_PORT", "8770"))
    directory = os.environ.get("FRONTEND_DIST_DIR", os.path.join(os.path.dirname(__file__), "dist"))
    with ThreadingHTTPServer((host, port), partial(Handler, directory=directory)) as httpd:
        print(f"serving {directory} on {host}:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
