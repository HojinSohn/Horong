"""Entrypoint: `python -m finance_service.main`."""
from __future__ import annotations

import os

from aiohttp import web

from finance_service.plaid_client import PlaidClient
from finance_service.server import build_app
from finance_service.storage import connect


def main() -> None:
    plaid_client = PlaidClient(
        client_id=os.environ["PLAID_CLIENT_ID"],
        secret=os.environ["PLAID_SECRET"],
        environment=os.environ.get("PLAID_ENV", "sandbox"),
    )
    storage = connect(
        os.environ.get("FINANCE_DB_PATH", "/root/hermes-dashboard-finance/finance.db"),
        os.environ["FINANCE_FERNET_KEY"],
    )
    app = build_app(plaid_client, storage)
    host = os.environ.get("FINANCE_HOST", "100.109.58.59")
    port = int(os.environ.get("FINANCE_PORT", "8766"))
    web.run_app(app, host=host, port=port)


if __name__ == "__main__":
    main()
