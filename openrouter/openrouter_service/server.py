"""aiohttp routes for the OpenRouter usage/balance service."""
from __future__ import annotations

from aiohttp import web

from openrouter_service.client import OpenRouterClient

ALLOWED_ORIGIN = "http://localhost:3000"
CORS_METHODS = "GET, OPTIONS"
CORS_HEADERS = "Content-Type"


@web.middleware
async def origin_guard(request: web.Request, handler):
    if request.headers.get("Origin") != ALLOWED_ORIGIN:
        return web.json_response({"error": "forbidden origin"}, status=403)
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    return response


async def _cors_preflight(request: web.Request) -> web.Response:
    return web.Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Methods": CORS_METHODS,
            "Access-Control-Allow-Headers": CORS_HEADERS,
        },
    )


def build_app(client: OpenRouterClient) -> web.Application:
    app = web.Application(middlewares=[origin_guard])

    async def usage(request: web.Request) -> web.Response:
        try:
            data = await client.fetch_usage()
        except Exception:
            return web.json_response({"error": "couldn't reach OpenRouter"}, status=502)
        return web.json_response(data)

    app.router.add_get("/usage", usage)
    app.router.add_options("/usage", _cors_preflight)
    return app
