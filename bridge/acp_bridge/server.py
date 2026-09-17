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


async def handle_connection(
    ws: ServerConnection,
    hermes_cmd: Sequence[str],
    workspace_dir: str,
    notes_mcp_url: str | None = None,
    session_file: str | None = None,
) -> None:
    async with open_session(hermes_cmd, workspace_dir, notes_mcp_url, session_file) as session:

        async def forward_updates() -> None:
            while True:
                update = await session.updates.get()
                await ws.send(json.dumps(update))

        # Prompts run one at a time, in the order sent (a queue, not
        # concurrent tasks) — same behavior as before. What changes is that
        # the read loop below no longer blocks on a prompt's completion, so
        # a "cancel" message sent mid-turn reaches session.cancel()
        # immediately instead of sitting behind the current await.
        prompt_queue: "asyncio.Queue[str]" = asyncio.Queue()

        async def process_prompts() -> None:
            while True:
                text = await prompt_queue.get()
                await session.send_prompt(text)

        forwarder = asyncio.create_task(forward_updates())
        worker = asyncio.create_task(process_prompts())
        try:
            async for raw in ws:
                message = json.loads(raw)
                msg_type = message.get("type")
                if msg_type == "prompt":
                    await prompt_queue.put(message["text"])
                elif msg_type == "cancel":
                    await session.cancel()
                elif msg_type == "new_session":
                    await session.start_new()
                elif msg_type == "switch_session":
                    await session.switch_to(message["session_id"])
                elif msg_type == "list_sessions":
                    sessions = await session.list_sessions()
                    await session.updates.put({"type": "session_list", "sessions": sessions})
        finally:
            forwarder.cancel()
            worker.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await forwarder
            with contextlib.suppress(asyncio.CancelledError):
                await worker


def build_handler(
    hermes_cmd: Sequence[str], workspace_dir: str, notes_mcp_url: str | None = None, session_file: str | None = None
):
    async def handler(ws: ServerConnection) -> None:
        try:
            await handle_connection(ws, hermes_cmd, workspace_dir, notes_mcp_url, session_file)
        except Exception:
            logger.exception("bridge connection failed")

    return handler


async def run_server(
    host: str,
    port: int,
    hermes_cmd: Sequence[str],
    workspace_dir: str,
    notes_mcp_url: str | None = None,
    session_file: str | None = None,
) -> None:
    # Origin check: only the dashboard frontend may open a connection. Without
    # this, any page reachable on the tailnet could open a WebSocket here and
    # drive Horong with auto-approved tool execution as root.
    async with serve(
        build_handler(hermes_cmd, workspace_dir, notes_mcp_url, session_file),
        host,
        port,
        origins=["http://localhost:3000", "http://horong.taila5421b.ts.net:8770"],
    ):
        logger.info("bridge listening on %s:%s", host, port)
        await asyncio.Future()  # run forever
