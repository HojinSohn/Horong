"""Wraps `hermes acp` as a subprocess and exposes a simple async session API
that hides the ACP Client protocol from the rest of the bridge."""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager

from acp.helpers import text_block
from acp.schema import (
    AllowedOutcome,
    ClientCapabilities,
    DeniedOutcome,
    FileSystemCapabilities,
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

    async def session_update(self, session_id: str, update, **kwargs) -> None:
        if getattr(update, "session_update", None) == "agent_message_chunk":
            text = getattr(update.content, "text", "")
            if text:
                await self._updates.put({"type": "chunk", "text": text})

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
    def __init__(self, connection, session_id: str, updates: "asyncio.Queue[dict]") -> None:
        self._connection = connection
        self.session_id = session_id
        self.updates = updates

    # ponytail: known race — `done` can be enqueued before the final `chunk`.
    # `acp`'s notification dispatcher runs each incoming `session/update` as a
    # fire-and-forget `asyncio.create_task(...)`, not awaited inline. So
    # `connection.prompt()` below can return (its response arrives on the same
    # transport, but isn't gated on those tasks finishing) before the task
    # handling the *last* chunk's `session_update` callback has actually run
    # and put its chunk on `self.updates`. If `done` is enqueued first, a
    # client reading the queue in order sees `done` before that final chunk.
    # Reproduced against a 5-chunk fixture: 4/15 runs. Against the existing
    # 1-chunk fixture: 0/30 runs — with only one chunk there's nothing for
    # `done` to race ahead of, which is why the current test never catches
    # this. Not observed against live `hermes acp` (real chunk timing leaves
    # enough of a gap for the dispatched task to run first), so this is
    # latent, not active, today.
    # Upgrade path if it ever bites: either (a) track expected vs. received
    # chunk count from `session_update`'s payload (e.g. `stop_reason`) and
    # hold `done` until they match, or (b) have `session_update` hand back an
    # awaitable per dispatched task and await all pending ones here before
    # enqueueing `done`. Both require change on top of `acp`'s dispatch, which
    # is more surgery than this fix wave covers.
    async def send_prompt(self, text: str) -> None:
        try:
            await self._connection.prompt(prompt=[text_block(text)], session_id=self.session_id)
        except Exception as exc:  # subprocess/protocol boundary: surface, don't crash the caller
            await self.updates.put({"type": "error", "message": str(exc)})
            return
        await self.updates.put({"type": "done"})


@asynccontextmanager
async def open_session(hermes_cmd: Sequence[str], workspace_dir: str) -> AsyncIterator[HorongSession]:
    updates: "asyncio.Queue[dict]" = asyncio.Queue()
    client = HorongClient(updates)
    async with spawn_agent_process(lambda _agent: client, hermes_cmd[0], *hermes_cmd[1:]) as (connection, _process):
        await connection.initialize(
            protocol_version=PROTOCOL_VERSION,
            client_capabilities=ClientCapabilities(
                terminal=False,
                fs=FileSystemCapabilities(read_text_file=False, write_text_file=False),
            ),
        )
        new_session = await connection.new_session(cwd=workspace_dir, mcp_servers=[])
        yield HorongSession(connection, new_session.session_id, updates)
