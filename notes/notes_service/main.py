"""Entrypoint: `python -m notes_service.main`."""
from __future__ import annotations

import os

import uvicorn

from notes_service.server import build_app
from notes_service.storage import connect


def main() -> None:
    storage = connect(os.environ.get("NOTES_DB_PATH", "/root/hermes-dashboard-notes/notes.db"))
    app = build_app(storage)
    host = os.environ.get("NOTES_HOST", "100.109.58.59")
    port = int(os.environ.get("NOTES_PORT", "8767"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
