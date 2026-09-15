"""Entrypoint: `python -m stocks_service.main`."""
from __future__ import annotations

import os

from aiohttp import web

from stocks_service.client import FinnhubClient
from stocks_service.server import build_app
from stocks_service.storage import connect


def main() -> None:
    storage = connect(os.environ.get("STOCKS_DB_PATH", "/root/hermes-dashboard-stocks/stocks.db"))
    client = FinnhubClient(api_key=os.environ["FINNHUB_API_KEY"])
    app = build_app(storage, client)
    host = os.environ.get("STOCKS_HOST", "100.109.58.59")
    port = int(os.environ.get("STOCKS_PORT", "8769"))
    web.run_app(app, host=host, port=port)


if __name__ == "__main__":
    main()
