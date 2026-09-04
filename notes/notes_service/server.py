"""MCP + REST surface for notes: MCP tools for Hermes, plain REST for the
frontend, both backed by the same NotesStorage."""
from __future__ import annotations

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from notes_service.storage import Note, NotesStorage

ALLOWED_ORIGIN = "http://localhost:3000"
ALLOWED_HOST = "100.109.58.59:8767"


class _OriginGuard(BaseHTTPMiddleware):
    """Server-side origin check for the /notes REST routes only. The /mcp
    routes are called by `hermes acp` itself (server-to-server on the VPS,
    no browser Origin header) and must never be blocked by this."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path.startswith("/notes") and request.headers.get("origin") != ALLOWED_ORIGIN:
            return JSONResponse({"error": "forbidden origin"}, status_code=403)
        response = await call_next(request)
        if request.url.path.startswith("/notes"):
            response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
        return response


def _note_json(note: Note) -> dict:
    return {"id": note.id, "text": note.text, "created_at": note.created_at}


def _add_note(storage: NotesStorage, text: str) -> str:
    note = storage.add_note(text)
    return f"Added note: {note.text}"


def _list_notes(storage: NotesStorage) -> list[str]:
    return [note.text for note in storage.list_notes()]


def build_app(storage: NotesStorage) -> Starlette:
    server = MCPServer("notes")

    @server.tool()
    async def add_note(text: str) -> str:
        return _add_note(storage, text)

    @server.tool()
    async def list_notes() -> list[str]:
        return _list_notes(storage)

    @server.custom_route("/notes", methods=["GET"])
    async def get_notes(request: Request) -> JSONResponse:
        return JSONResponse({"notes": [_note_json(n) for n in storage.list_notes()]})

    @server.custom_route("/notes", methods=["POST"])
    async def post_notes(request: Request) -> JSONResponse:
        try:
            body = await request.json()
            text = body["text"]
        except (ValueError, KeyError, TypeError):
            return JSONResponse({"error": "invalid request body"}, status_code=400)
        note = storage.add_note(text)
        return JSONResponse(_note_json(note), status_code=201)

    app = server.streamable_http_app(
        transport_security=TransportSecuritySettings(allowed_hosts=[ALLOWED_HOST]),
    )
    app.add_middleware(_OriginGuard)
    return app
