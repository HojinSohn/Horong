"""WebSocket server exposing the frontend's prompt/chunk/done protocol,
backed by one ACP session (one `hermes acp` conversation) per connection."""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import Sequence

from websockets.asyncio.server import ServerConnection, serve

from acp_bridge.acp_client import open_session

logger = logging.getLogger(__name__)


async def handle_connection(ws: ServerConnection, hermes_cmd: Sequence[str], workspace_dir: str) -> None:
    async with open_session(hermes_cmd, workspace_dir) as session:

        async def forward_updates() -> None:
            while True:
                update = await session.updates.get()
                await ws.send(json.dumps(update))

        forwarder = asyncio.create_task(forward_updates())
        try:
            async for raw in ws:
                message = json.loads(raw)
                if message.get("type") == "prompt":
                    await session.send_prompt(message["text"])
        finally:
            forwarder.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await forwarder


def build_handler(hermes_cmd: Sequence[str], workspace_dir: str):
    async def handler(ws: ServerConnection) -> None:
        try:
            await handle_connection(ws, hermes_cmd, workspace_dir)
        except Exception:
            logger.exception("bridge connection failed")

    return handler


async def run_server(host: str, port: int, hermes_cmd: Sequence[str], workspace_dir: str) -> None:
    # Origin check: only the dashboard frontend may open a connection. Without
    # this, any page reachable on the tailnet could open a WebSocket here and
    # drive Horong with auto-approved tool execution as root.
    async with serve(build_handler(hermes_cmd, workspace_dir), host, port, origins=["http://localhost:3000"]):
        logger.info("bridge listening on %s:%s", host, port)
        await asyncio.Future()  # run forever
