"""Entrypoint: `python -m briefing_service.main`."""
from __future__ import annotations

import os

import uvicorn

from briefing_service.server import build_app
from briefing_service.storage import connect


def main() -> None:
    storage = connect(os.environ.get("BRIEFING_DB_PATH", "/root/hermes-dashboard-briefing/briefing.db"))
    app = build_app(storage)
    host = os.environ.get("BRIEFING_HOST", "100.109.58.59")
    port = int(os.environ.get("BRIEFING_PORT", "8771"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
