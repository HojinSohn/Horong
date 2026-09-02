"""Entrypoint: `python -m acp_bridge.main`."""
from __future__ import annotations

import asyncio
import logging
import os

from acp_bridge.server import run_server


def _hermes_cmd() -> list[str]:
    return [os.environ.get("HERMES_BIN", "hermes"), "acp"]


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    host = os.environ.get("BRIDGE_HOST", "100.109.58.59")
    port = int(os.environ.get("BRIDGE_PORT", "8765"))
    workspace_dir = os.environ.get("BRIDGE_WORKSPACE_DIR", "/root/hermes-workspace")
    asyncio.run(run_server(host, port, _hermes_cmd(), workspace_dir))


if __name__ == "__main__":
    main()
