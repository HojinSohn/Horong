import json
import sys
from pathlib import Path

import pytest
import websockets
from websockets.asyncio.server import serve

from acp_bridge.server import build_handler

FIXTURE = [sys.executable, str(Path(__file__).parent / "fixtures" / "fake_acp_agent.py")]


@pytest.mark.asyncio
async def test_prompt_round_trip_over_websocket(tmp_path):
    handler = build_handler(FIXTURE, str(tmp_path))
    async with serve(handler, "localhost", 0) as server:
        port = server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as client:
            await client.send(json.dumps({"type": "prompt", "text": "hi"}))
            frames = [json.loads(await client.recv()) for _ in range(5)]

    # The fixture's canned response includes a thought and a tool-call
    # lifecycle alongside the chunk/done — this confirms the server relays
    # every frame type generically, not just chunk/done.
    assert frames == [
        {"type": "thought", "text": "thinking about echo"},
        {"type": "tool_call", "id": "tool-1", "title": "echo_lookup", "kind": "fetch", "status": "in_progress"},
        {"type": "tool_call", "id": "tool-1", "title": None, "kind": None, "status": "completed"},
        {"type": "chunk", "text": "echo: hi"},
        {"type": "done"},
    ]
