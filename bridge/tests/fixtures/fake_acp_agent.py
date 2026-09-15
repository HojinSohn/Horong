"""Minimal ACP agent used only by the bridge's own tests. Echoes the prompt
text back as a single agent_message_chunk, then ends the turn. A prompt whose
text is exactly "slow" instead blocks until `cancel` is called (or 5s pass),
so tests can exercise cancellation without a real long-running turn."""
from __future__ import annotations

import asyncio

from acp.agent import AgentSideConnection
from acp.helpers import start_tool_call, update_agent_message_text, update_agent_thought_text, update_tool_call
from acp.schema import InitializeResponse, NewSessionResponse, PromptResponse
from acp.stdio import stdio_streams


class FakeAgent:
    def __init__(self, holder: dict) -> None:
        self._holder = holder

    async def initialize(self, protocol_version: int, **kwargs) -> InitializeResponse:
        return InitializeResponse(protocol_version=protocol_version)

    async def new_session(self, cwd: str, mcp_servers=None, **kwargs) -> NewSessionResponse:
        return NewSessionResponse(session_id="fake-session-1")

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
