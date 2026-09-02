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
        first = await asyncio.wait_for(session.updates.get(), timeout=5)
        second = await asyncio.wait_for(session.updates.get(), timeout=5)

    assert first == {"type": "chunk", "text": "echo: hello"}
    assert second == {"type": "done"}
