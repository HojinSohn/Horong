"""Wraps `hermes acp` as a subprocess and exposes a simple async session API
that hides the ACP Client protocol from the rest of the bridge."""
from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path

from acp.helpers import text_block
from acp.schema import (
    AllowedOutcome,
    ClientCapabilities,
    DeniedOutcome,
    FileSystemCapabilities,
    HttpMcpServer,
    PermissionOption,
    ReadTextFileResponse,
    RequestPermissionResponse,
    ToolCallUpdate,
    WriteTextFileResponse,
)
from acp.stdio import spawn_agent_process

PROTOCOL_VERSION = 1


class HorongClient:
    """Implements the ACP Client protocol for a headless, chat-only bridge.

    fs and terminal capabilities are declared False in `open_session` below,
    so a spec-compliant agent should never call the fs/terminal methods here
    — they raise defensively rather than silently no-op, since a crash is a
    clearer signal than data quietly going nowhere.
    """

    def __init__(self, updates: "asyncio.Queue[dict]") -> None:
        self._updates = updates

    _CHUNK_FRAME_TYPES = {
        "agent_message_chunk": "chunk",
        "agent_thought_chunk": "thought",
        "user_message_chunk": "user_chunk",  # only ever arrives via a resumed session's replay
    }

    async def session_update(self, session_id: str, update, **kwargs) -> None:
        kind = getattr(update, "session_update", None)
        if kind in self._CHUNK_FRAME_TYPES:
            text = getattr(update.content, "text", "")
            if text:
                await self._updates.put({"type": self._CHUNK_FRAME_TYPES[kind], "text": text})
        elif kind in ("tool_call", "tool_call_update"):
            await self._updates.put(
                {
                    "type": "tool_call",
                    "id": update.tool_call_id,
                    "title": update.title,
                    "kind": update.kind,
                    "status": update.status,
                }
            )

    async def request_permission(
        self, options: Sequence[PermissionOption], session_id: str, tool_call: ToolCallUpdate, **kwargs
    ) -> RequestPermissionResponse:
        # ponytail: auto-approve every tool call. Matches the trust model this
        # project already applies to the Discord allowlist (docs/known-issues.md
        # #3) — single-user, Tailscale-scoped. Add a real per-tool policy if
        # the bridge ever gets more than one trusted user.
        allowed = next((o for o in options if o.kind in ("allow_always", "allow_once")), None)
        if allowed is None:
            return RequestPermissionResponse(outcome=DeniedOutcome(outcome="cancelled"))
        return RequestPermissionResponse(outcome=AllowedOutcome(outcome="selected", option_id=allowed.option_id))

    async def write_text_file(self, content: str, path: str, session_id: str, **kwargs) -> WriteTextFileResponse | None:
        raise RuntimeError("write_text_file: not supported — fs capability was declared false")

    async def read_text_file(
        self, path: str, session_id: str, limit: int | None = None, line: int | None = None, **kwargs
    ) -> ReadTextFileResponse:
        raise RuntimeError("read_text_file: not supported — fs capability was declared false")

    async def create_terminal(self, command, session_id, args=None, cwd=None, env=None, output_byte_limit=None, **kwargs):
        raise RuntimeError("create_terminal: not supported — terminal capability was declared false")

    async def terminal_output(self, session_id, terminal_id, **kwargs):
        raise RuntimeError("terminal_output: not supported — terminal capability was declared false")

    async def release_terminal(self, session_id, terminal_id, **kwargs):
        raise RuntimeError("release_terminal: not supported — terminal capability was declared false")

    async def wait_for_terminal_exit(self, session_id, terminal_id, **kwargs):
        raise RuntimeError("wait_for_terminal_exit: not supported — terminal capability was declared false")

    async def kill_terminal(self, session_id, terminal_id, **kwargs):
        raise RuntimeError("kill_terminal: not supported — terminal capability was declared false")


class HorongSession:
    def __init__(
        self,
        connection,
        session_id: str,
        updates: "asyncio.Queue[dict]",
        workspace_dir: str,
        mcp_servers: list[HttpMcpServer],
        session_file: str,
    ) -> None:
        self._connection = connection
        self.session_id = session_id
        self.updates = updates
        self._workspace_dir = workspace_dir
        self._mcp_servers = mcp_servers
        self._session_file = session_file

    # `done`-before-final-notification race, and the mitigation below:
    # `acp`'s notification dispatcher runs each incoming `session/update`
    # through two hops of fire-and-forget `asyncio.create_task(...)` (queue
    # dispatcher -> per-notification runner), not awaited inline. So
    # `connection.prompt()` below can return — its response arrives on the
    # same transport but isn't gated on those tasks finishing — before the
    # task handling the *last* notification's `session_update` callback has
    # actually run and put its item on `self.updates`. Confirmed with a
    # richer fixture emitting a thought + 2 tool-call updates + a chunk
    # before the response: 6/15 runs put `done` ahead of a still-pending
    # notification without a fix.
    #
    # `acp` gives no public synchronization point for "wait until all
    # dispatched notification handlers have run" (its internal message
    # queue's `join()` marks tasks done at *dispatch*, not completion, and
    # its `TaskSupervisor` tracks tasks only for cancellation on shutdown).
    # So the fix is a bounded number of `asyncio.sleep(0)` event-loop ticks
    # — not a time-based guess, each tick fully drains whatever's already
    # ready to run — comfortably more than the two hops observed above.
    # Ceiling: this is empirical, not a guarantee, against a fixed dispatch
    # depth; if `acp` ever adds a third hop (or under extreme scheduler
    # contention) this could still race. Upgrade path if it ever bites live:
    # track expected vs. received notification count and hold `done` until
    # they match, which needs a real signal for "this is the last one" that
    # the protocol doesn't currently expose.
    _NOTIFICATION_DRAIN_TICKS = 6

    async def send_prompt(self, text: str) -> None:
        try:
            await self._connection.prompt(prompt=[text_block(text)], session_id=self.session_id)
        except Exception as exc:  # subprocess/protocol boundary: surface, don't crash the caller
            await self.updates.put({"type": "error", "message": str(exc)})
            return
        for _ in range(self._NOTIFICATION_DRAIN_TICKS):
            await asyncio.sleep(0)
        await self.updates.put({"type": "done"})

    async def cancel(self) -> None:
        # session/cancel is a fire-and-forget notification (not a request), so
        # this returns immediately regardless of whether a prompt() call is
        # currently in flight on the same session.
        await self._connection.cancel(session_id=self.session_id)

    async def start_new(self) -> None:
        """Abandon the current session for a brand-new, empty one -- on the
        same already-running connection, no need to respawn the subprocess."""
        new_session = await self._connection.new_session(cwd=self._workspace_dir, mcp_servers=self._mcp_servers)
        self.session_id = new_session.session_id
        _write_session_file(self._session_file, self.session_id)

    async def switch_to(self, session_id: str) -> None:
        """Switch to a specific past session, replaying its history through
        the same update pipe used for send_prompt/the initial resume. Unlike
        the initial connect-time resume, a failure here (the id no longer
        exists) is a real user-facing error, not a silent fallback -- the
        user picked this specific session from a list."""
        try:
            await self._connection.load_session(cwd=self._workspace_dir, session_id=session_id, mcp_servers=self._mcp_servers)
        except Exception as exc:
            await self.updates.put({"type": "error", "message": str(exc)})
            return
        self.session_id = session_id
        _write_session_file(self._session_file, session_id)
        for _ in range(self._NOTIFICATION_DRAIN_TICKS):
            await asyncio.sleep(0)
        await self.updates.put({"type": "done"})

    async def list_sessions(self) -> list[dict]:
        response = await self._connection.list_sessions(cwd=self._workspace_dir)
        return [
            {"id": s.session_id, "title": s.title, "updatedAt": s.updated_at} for s in response.sessions
        ]


def _build_mcp_servers(notes_mcp_url: str | None) -> list[HttpMcpServer]:
    if not notes_mcp_url:
        return []
    return [HttpMcpServer(name="dashboard-notes", url=notes_mcp_url, headers=[], type="http")]


def _write_session_file(session_file: str, session_id: str) -> None:
    Path(session_file).write_text(session_id)


async def _resume_or_create_session(
    connection,
    workspace_dir: str,
    mcp_servers: list[HttpMcpServer],
    session_file: str,
    updates: "asyncio.Queue[dict]",
) -> str:
    """Try to resume the last session_id recorded in session_file via ACP
    session/load (replaying its history through the same session_update path
    already wired to `updates`); fall back to a brand-new session if there's
    no recorded id, or the agent no longer recognizes it (e.g. it restarted
    and lost its session store) -- never surfaced as an error to the caller."""
    previous_id = Path(session_file).read_text().strip() if os.path.exists(session_file) else ""

    if previous_id:
        try:
            await connection.load_session(cwd=workspace_dir, session_id=previous_id, mcp_servers=mcp_servers)
        except Exception:
            previous_id = ""  # stale/unknown on the agent's side -- fall through to a new session
        else:
            # Mirrors HorongSession.send_prompt's own drain: load_session's
            # replay notifications are dispatched via the same fire-and-forget
            # session_update tasks, so give them a few ticks before "done".
            for _ in range(HorongSession._NOTIFICATION_DRAIN_TICKS):
                await asyncio.sleep(0)
            await updates.put({"type": "done"})
            return previous_id

    new_session = await connection.new_session(cwd=workspace_dir, mcp_servers=mcp_servers)
    _write_session_file(session_file, new_session.session_id)
    return new_session.session_id


@asynccontextmanager
async def open_session(
    hermes_cmd: Sequence[str],
    workspace_dir: str,
    notes_mcp_url: str | None = None,
    session_file: str | None = None,
) -> AsyncIterator[HorongSession]:
    updates: "asyncio.Queue[dict]" = asyncio.Queue()
    client = HorongClient(updates)
    session_file = session_file or os.path.join(workspace_dir, ".bridge_session_id")
    mcp_servers = _build_mcp_servers(notes_mcp_url)
    async with spawn_agent_process(lambda _agent: client, hermes_cmd[0], *hermes_cmd[1:]) as (connection, _process):
        await connection.initialize(
            protocol_version=PROTOCOL_VERSION,
            client_capabilities=ClientCapabilities(
                terminal=False,
                fs=FileSystemCapabilities(read_text_file=False, write_text_file=False),
            ),
        )
        session_id = await _resume_or_create_session(connection, workspace_dir, mcp_servers, session_file, updates)
        yield HorongSession(connection, session_id, updates, workspace_dir, mcp_servers, session_file)
