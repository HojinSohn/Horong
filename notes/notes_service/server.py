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

ALLOWED_ORIGINS = {"http://localhost:3000", "http://horong.taila5421b.ts.net:8770"}
ALLOWED_HOST = "100.109.58.59:8767"


class _OriginGuard(BaseHTTPMiddleware):
    """Server-side origin check for the /notes REST routes only. The /mcp
    routes are called by `hermes acp` itself (server-to-server on the VPS,
    no browser Origin header) and must never be blocked by this."""

    async def dispatch(self, request: Request, call_next) -> Response:
        origin = request.headers.get("origin")
        if request.url.path.startswith("/notes") and origin not in ALLOWED_ORIGINS:
            return JSONResponse({"error": "forbidden origin"}, status_code=403)
        response = await call_next(request)
        if request.url.path.startswith("/notes"):
            response.headers["Access-Control-Allow-Origin"] = origin
        return response


def _note_json(note: Note) -> dict:
    return {"id": note.id, "text": note.text, "created_at": note.created_at}


def _add_note(storage: NotesStorage, text: str) -> str:
    note = storage.add_note(text)
    return f"Added note: {note.text}"


def _list_notes(storage: NotesStorage) -> list[dict]:
    return [{"id": note.id, "text": note.text} for note in storage.list_notes()]


def _update_note(storage: NotesStorage, id: int, text: str) -> str:
    note = storage.update_note(id, text)
    if note is None:
        return f"Note {id} not found."
    return f"Updated note: {note.text}"


def _delete_note(storage: NotesStorage, id: int) -> str:
    if storage.delete_note(id):
        return "Deleted note."
    return f"Note {id} not found."


def build_app(storage: NotesStorage) -> Starlette:
    server = MCPServer("notes")

    @server.tool()
    async def add_note(text: str) -> str:
        """Save a short note to the user's dashboard notes list."""
        return _add_note(storage, text)

    @server.tool()
    async def list_notes() -> list[dict]:
        """List the user's saved notes (each with its id and text), newest first."""
        return _list_notes(storage)

    @server.tool()
    async def update_note(id: int, text: str) -> str:
        """Change the text of an existing note. Call list_notes first to find its id."""
        return _update_note(storage, id, text)

    @server.tool()
    async def delete_note(id: int) -> str:
        """Delete a note. Call list_notes first to find its id."""
        return _delete_note(storage, id)

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
        if not isinstance(text, str) or not text.strip():
            return JSONResponse({"error": "invalid request body"}, status_code=400)
        note = storage.add_note(text)
        return JSONResponse(_note_json(note), status_code=201)

    @server.custom_route("/notes", methods=["OPTIONS"])
    async def options_notes(request: Request) -> Response:
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )

    @server.custom_route("/notes/{id}", methods=["PATCH"])
    async def patch_note(request: Request) -> JSONResponse:
        try:
            body = await request.json()
            text = body["text"]
        except (ValueError, KeyError, TypeError):
            return JSONResponse({"error": "invalid request body"}, status_code=400)
        if not isinstance(text, str) or not text.strip():
            return JSONResponse({"error": "invalid request body"}, status_code=400)
        note = storage.update_note(int(request.path_params["id"]), text)
        if note is None:
            return JSONResponse({"error": "note not found"}, status_code=404)
        return JSONResponse(_note_json(note))

    @server.custom_route("/notes/{id}", methods=["DELETE"])
    async def delete_note_route(request: Request) -> Response:
        if storage.delete_note(int(request.path_params["id"])):
            return Response(status_code=204)
        return JSONResponse({"error": "note not found"}, status_code=404)

    @server.custom_route("/notes/{id}", methods=["OPTIONS"])
    async def options_note_by_id(request: Request) -> Response:
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )

    app = server.streamable_http_app(
        transport_security=TransportSecuritySettings(allowed_hosts=[ALLOWED_HOST]),
    )
    app.add_middleware(_OriginGuard)
    return app
