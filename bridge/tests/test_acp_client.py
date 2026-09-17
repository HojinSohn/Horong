import asyncio
import sys
from pathlib import Path

import pytest

from acp_bridge.acp_client import _build_mcp_servers, open_session

FIXTURE = [sys.executable, str(Path(__file__).parent / "fixtures" / "fake_acp_agent.py")]


async def _drain(session, count: int) -> list[dict]:
    return [await asyncio.wait_for(session.updates.get(), timeout=5) for _ in range(count)]


def test_build_mcp_servers_returns_empty_list_when_no_url_configured():
    assert _build_mcp_servers(None) == []


def test_build_mcp_servers_returns_the_notes_http_server_when_url_given():
    result = _build_mcp_servers("http://100.109.58.59:8767/mcp")
    assert len(result) == 1
    assert result[0].name == "dashboard-notes"
    assert result[0].url == "http://100.109.58.59:8767/mcp"
    assert result[0].type == "http"
    assert result[0].headers == []


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


@pytest.mark.asyncio
async def test_cancel_stops_an_in_flight_prompt_promptly(tmp_path):
    async with open_session(FIXTURE, str(tmp_path)) as session:
        prompt_task = asyncio.create_task(session.send_prompt("slow"))
        await asyncio.sleep(0.2)  # let the prompt actually reach the fake agent
        assert not prompt_task.done()

        await session.cancel()
        await asyncio.wait_for(prompt_task, timeout=2)

        # send_prompt's own "done" marker, put after the (now-cancelled) prompt() call returns.
        update = await asyncio.wait_for(session.updates.get(), timeout=2)
        assert update == {"type": "done"}


@pytest.mark.asyncio
async def test_first_connection_creates_a_session_and_persists_its_id(tmp_path):
    session_file = tmp_path / "session_id"

    async with open_session(FIXTURE, str(tmp_path), session_file=str(session_file)) as session:
        assert session.session_id == "fake-session-1"

    assert session_file.read_text() == "fake-session-1"


@pytest.mark.asyncio
async def test_a_later_connection_resumes_the_persisted_session_and_replays_its_history(tmp_path):
    session_file = tmp_path / "session_id"
    session_file.write_text("resumable-session")

    async with open_session(FIXTURE, str(tmp_path), session_file=str(session_file)) as session:
        assert session.session_id == "resumable-session"
        updates = await _drain(session, 3)

    assert updates == [
        {"type": "user_chunk", "text": "earlier question"},
        {"type": "chunk", "text": "earlier answer"},
        {"type": "done"},
    ]
    # Resuming successfully doesn't need to rewrite the file -- same id either way.
    assert session_file.read_text() == "resumable-session"


@pytest.mark.asyncio
async def test_falls_back_to_a_new_session_when_the_persisted_one_is_unrecognized(tmp_path):
    session_file = tmp_path / "session_id"
    session_file.write_text("unknown-session")

    async with open_session(FIXTURE, str(tmp_path), session_file=str(session_file)) as session:
        assert session.session_id == "fake-session-1"
        # No replay frames queued -- a fresh session, same as first-run.
        await session.send_prompt("hi")
        updates = await _drain(session, 5)

    assert updates[-2:] == [{"type": "chunk", "text": "echo: hi"}, {"type": "done"}]
    assert session_file.read_text() == "fake-session-1"


@pytest.mark.asyncio
async def test_start_new_abandons_the_current_session_for_a_fresh_one(tmp_path):
    session_file = tmp_path / "session_id"

    async with open_session(FIXTURE, str(tmp_path), session_file=str(session_file)) as session:
        assert session.session_id == "fake-session-1"

        await session.start_new()

        assert session.session_id == "fake-session-2"
        assert session_file.read_text() == "fake-session-2"


@pytest.mark.asyncio
async def test_switch_to_loads_a_specific_session_and_replays_it(tmp_path):
    session_file = tmp_path / "session_id"

    async with open_session(FIXTURE, str(tmp_path), session_file=str(session_file)) as session:
        assert session.session_id == "fake-session-1"

        await session.switch_to("resumable-session")
        updates = await _drain(session, 3)

    assert session.session_id == "resumable-session"
    assert session_file.read_text() == "resumable-session"
    assert updates == [
        {"type": "user_chunk", "text": "earlier question"},
        {"type": "chunk", "text": "earlier answer"},
        {"type": "done"},
    ]


@pytest.mark.asyncio
async def test_switch_to_an_unknown_session_surfaces_a_real_error(tmp_path):
    session_file = tmp_path / "session_id"

    async with open_session(FIXTURE, str(tmp_path), session_file=str(session_file)) as session:
        assert session.session_id == "fake-session-1"

        await session.switch_to("unknown-session")
        update = await asyncio.wait_for(session.updates.get(), timeout=5)

        # Unlike the initial connect-time resume, a failed switch is a real
        # user-facing error, and the session/file are left unchanged. The ACP
        # JSON-RPC layer genericizes the agent's raised exception before it
        # crosses the process boundary (confirmed: not the original message).
        assert update["type"] == "error"
        assert update["message"]
        assert session.session_id == "fake-session-1"

    assert session_file.read_text() == "fake-session-1"


@pytest.mark.asyncio
async def test_list_sessions_returns_the_agents_session_list(tmp_path):
    async with open_session(FIXTURE, str(tmp_path)) as session:
        sessions = await session.list_sessions()

    assert sessions == [
        {"id": "fake-session-1", "title": "First chat", "updatedAt": "2026-01-01T00:00:00Z"},
        {"id": "resumable-session", "title": "Resumed chat", "updatedAt": "2026-01-02T00:00:00Z"},
    ]
