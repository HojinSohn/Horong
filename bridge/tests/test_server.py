import asyncio
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


@pytest.mark.asyncio
async def test_cancel_message_stops_an_in_flight_prompt_without_waiting_for_it(tmp_path):
    handler = build_handler(FIXTURE, str(tmp_path))
    async with serve(handler, "localhost", 0) as server:
        port = server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as client:
            await client.send(json.dumps({"type": "prompt", "text": "slow"}))
            await asyncio.sleep(0.2)  # let the prompt actually reach the fake agent

            await client.send(json.dumps({"type": "cancel"}))
            frame = json.loads(await asyncio.wait_for(client.recv(), timeout=2))

    # The fake agent's "slow" prompt only ever completes via cancellation (or
    # a 5s timeout) — receiving "done" this fast proves the cancel message
    # was actioned rather than queued behind the still-running prompt.
    assert frame == {"type": "done"}


@pytest.mark.asyncio
async def test_a_second_prompt_sent_while_one_is_in_flight_is_queued_not_dropped(tmp_path):
    handler = build_handler(FIXTURE, str(tmp_path))
    async with serve(handler, "localhost", 0) as server:
        port = server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as client:
            await client.send(json.dumps({"type": "prompt", "text": "slow"}))
            await asyncio.sleep(0.2)
            await client.send(json.dumps({"type": "prompt", "text": "second"}))

            await client.send(json.dumps({"type": "cancel"}))
            frames = [json.loads(await asyncio.wait_for(client.recv(), timeout=2)) for _ in range(6)]

    # First "done" ends the cancelled "slow" turn; the queued "second" prompt
    # then runs its own full turn (the fake agent's standard echo sequence) —
    # proving it wasn't silently dropped while the read loop was busy with
    # the first prompt.
    assert frames[0] == {"type": "done"}
    assert frames[1:] == [
        {"type": "thought", "text": "thinking about echo"},
        {"type": "tool_call", "id": "tool-1", "title": "echo_lookup", "kind": "fetch", "status": "in_progress"},
        {"type": "tool_call", "id": "tool-1", "title": None, "kind": None, "status": "completed"},
        {"type": "chunk", "text": "echo: second"},
        {"type": "done"},
    ]
