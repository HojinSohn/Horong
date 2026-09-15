"""Entrypoint: `python -m openrouter_service.main`."""
from __future__ import annotations

import os

from aiohttp import web

from openrouter_service.client import OpenRouterClient
from openrouter_service.server import DEFAULT_HERMES_CONFIG_PATH, build_app


def main() -> None:
    client = OpenRouterClient(api_key=os.environ["OPENROUTER_API_KEY"])
    config_path = os.environ.get("HERMES_CONFIG_PATH", DEFAULT_HERMES_CONFIG_PATH)
    app = build_app(client, config_path=config_path)
    host = os.environ.get("OPENROUTER_STATUS_HOST", "100.109.58.59")
    port = int(os.environ.get("OPENROUTER_STATUS_PORT", "8768"))
    web.run_app(app, host=host, port=port)


if __name__ == "__main__":
    main()
