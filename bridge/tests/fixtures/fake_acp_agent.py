"""Minimal ACP agent used only by the bridge's own tests. Echoes the prompt
text back as a single agent_message_chunk, then ends the turn. A prompt whose
text is exactly "slow" instead blocks until `cancel` is called (or 5s pass),
so tests can exercise cancellation without a real long-running turn.

load_session succeeds (replaying one canned past turn) for any session_id
except "unknown-session", which raises -- so tests can exercise both the
resume-succeeds and resume-fails-falls-back-to-new-session paths.

new_session increments a counter each call ("fake-session-1", "-2", ...) so
tests can tell a fresh session from a later one on the same connection.
list_sessions returns two canned entries."""
from __future__ import annotations

import asyncio

from acp.agent import AgentSideConnection
from acp.helpers import (
    start_tool_call,
    update_agent_message_text,
    update_agent_thought_text,
    update_tool_call,
    update_user_message_text,
)
from acp.schema import (
    InitializeResponse,
    ListSessionsResponse,
    LoadSessionResponse,
    NewSessionResponse,
    PromptResponse,
    SessionInfo,
)
from acp.stdio import stdio_streams


class FakeAgent:
    def __init__(self, holder: dict) -> None:
        self._holder = holder

    async def initialize(self, protocol_version: int, **kwargs) -> InitializeResponse:
        return InitializeResponse(protocol_version=protocol_version)

    async def new_session(self, cwd: str, mcp_servers=None, **kwargs) -> NewSessionResponse:
        self._holder["new_session_count"] = self._holder.get("new_session_count", 0) + 1
        return NewSessionResponse(session_id=f"fake-session-{self._holder['new_session_count']}")

    async def list_sessions(self, cwd: str | None = None, cursor: str | None = None, **kwargs) -> ListSessionsResponse:
        return ListSessionsResponse(
            sessions=[
                SessionInfo(
                    cwd=cwd or "/tmp", session_id="fake-session-1", title="First chat", updated_at="2026-01-01T00:00:00Z"
                ),
                SessionInfo(
                    cwd=cwd or "/tmp",
                    session_id="resumable-session",
                    title="Resumed chat",
                    updated_at="2026-01-02T00:00:00Z",
                ),
            ]
        )

    async def load_session(self, cwd: str, session_id: str, mcp_servers=None, **kwargs) -> LoadSessionResponse:
        if session_id == "unknown-session":
            raise ValueError(f"no such session: {session_id}")
        connection = self._holder["connection"]
        await connection.session_update(session_id=session_id, update=update_user_message_text("earlier question"))
        await connection.session_update(session_id=session_id, update=update_agent_message_text("earlier answer"))
        return LoadSessionResponse()

    async def cancel(self, session_id: str, **kwargs) -> None:
        self._holder["cancel_event"].set()

    async def prompt(self, prompt, session_id: str, message_id=None, **kwargs) -> PromptResponse:
        text = prompt[0].text if prompt else ""
        if text == "slow":
            cancel_event = self._holder["cancel_event"]
            try:
                await asyncio.wait_for(cancel_event.wait(), timeout=5)
                return PromptResponse(stop_reason="cancelled")
            except asyncio.TimeoutError:
                return PromptResponse(stop_reason="end_turn")
        connection = self._holder["connection"]
        await connection.session_update(
            session_id=session_id,
            update=update_agent_thought_text("thinking about echo"),
        )
        await connection.session_update(
            session_id=session_id,
            update=start_tool_call("tool-1", "echo_lookup", kind="fetch", status="in_progress"),
        )
        await connection.session_update(
            session_id=session_id,
            update=update_tool_call("tool-1", status="completed"),
        )
        await connection.session_update(
            session_id=session_id,
            update=update_agent_message_text(f"echo: {text}"),
        )
        return PromptResponse(stop_reason="end_turn")


async def main() -> None:
    reader, writer = await stdio_streams()
    holder: dict = {"cancel_event": asyncio.Event()}
    connection = AgentSideConnection(lambda _client: FakeAgent(holder), writer, reader)
    holder["connection"] = connection
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
