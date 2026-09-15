"""MCP + REST surface for the daily briefing: an MCP tool Hermes's cron
job calls to save one, plain REST for the frontend to read the latest,
both backed by the same BriefingStorage."""
from __future__ import annotations

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from briefing_service.storage import BriefingStorage

ALLOWED_ORIGINS = {"http://localhost:3000", "http://horong.taila5421b.ts.net:8770"}
ALLOWED_HOST = "100.109.58.59:8771"


class _OriginGuard(BaseHTTPMiddleware):
    """Server-side origin check for the /briefing REST route only. The
    /mcp route is called by `hermes acp` itself (server-to-server on the
    VPS, no browser Origin header) and must never be blocked by this."""

    async def dispatch(self, request: Request, call_next) -> Response:
        origin = request.headers.get("origin")
        if request.url.path.startswith("/briefing") and origin not in ALLOWED_ORIGINS:
            return JSONResponse({"error": "forbidden origin"}, status_code=403)
        response = await call_next(request)
        if request.url.path.startswith("/briefing"):
            response.headers["Access-Control-Allow-Origin"] = origin
        return response


def _save_daily_briefing(storage: BriefingStorage, text: str) -> str:
    storage.add_briefing(text)
    return "Saved today's briefing."


def build_app(storage: BriefingStorage) -> Starlette:
    server = MCPServer("briefing")

    @server.tool()
    async def save_daily_briefing(text: str) -> str:
        """Save today's briefing text; the dashboard widget shows the latest one saved."""
        return _save_daily_briefing(storage, text)

    @server.custom_route("/briefing/latest", methods=["GET"])
    async def get_latest_briefing(request: Request) -> JSONResponse:
        briefing = storage.latest_briefing()
        if briefing is None:
            return JSONResponse({"briefing": None})
        return JSONResponse({"text": briefing.text, "created_at": briefing.created_at})

    app = server.streamable_http_app(
        transport_security=TransportSecuritySettings(allowed_hosts=[ALLOWED_HOST]),
    )
    app.add_middleware(_OriginGuard)
    return app
