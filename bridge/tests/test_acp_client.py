import asyncio
import sys
from pathlib import Path

import pytest

from acp_bridge.acp_client import open_session

FIXTURE = [sys.executable, str(Path(__file__).parent / "fixtures" / "fake_acp_agent.py")]


@pytest.mark.asyncio
async def test_send_prompt_streams_chunk_then_done(tmp_path):
    async with open_session(FIXTURE, str(tmp_path)) as session:
        await session.send_prompt("hello")
        updates = [await asyncio.wait_for(session.updates.get(), timeout=5) for _ in range(5)]

    assert updates == [
        {"type": "thought", "text": "thinking about echo"},
        {"type": "tool_call", "id": "tool-1", "title": "echo_lookup", "kind": "fetch", "status": "in_progress"},
        {"type": "tool_call", "id": "tool-1", "title": None, "kind": None, "status": "completed"},
        {"type": "chunk", "text": "echo: hello"},
        {"type": "done"},
    ]
