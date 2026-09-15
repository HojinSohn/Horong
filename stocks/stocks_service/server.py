"""aiohttp routes for the ticker-watchlist + quotes service."""
from __future__ import annotations

from aiohttp import web

from stocks_service.client import FinnhubClient
from stocks_service.storage import TickerStorage

ALLOWED_ORIGINS = {"http://localhost:3000", "http://horong.taila5421b.ts.net:8770"}
CORS_METHODS = "GET, POST, DELETE, OPTIONS"
CORS_HEADERS = "Content-Type"


@web.middleware
async def origin_guard(request: web.Request, handler):
    origin = request.headers.get("Origin")
    if origin not in ALLOWED_ORIGINS:
        return web.json_response({"error": "forbidden origin"}, status=403)
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = origin
    return response


async def _cors_preflight(request: web.Request) -> web.Response:
    origin = request.headers.get("Origin", "")
    return web.Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": origin if origin in ALLOWED_ORIGINS else "",
            "Access-Control-Allow-Methods": CORS_METHODS,
            "Access-Control-Allow-Headers": CORS_HEADERS,
        },
    )


def build_app(storage: TickerStorage, client: FinnhubClient) -> web.Application:
    app = web.Application(middlewares=[origin_guard])

    async def list_tickers(request: web.Request) -> web.Response:
        return web.json_response(storage.list_tickers())

    async def add_ticker(request: web.Request) -> web.Response:
        body = await request.json()
        symbol = body.get("symbol")
        if not isinstance(symbol, str) or not symbol.strip():
            return web.json_response({"error": "symbol is required"}, status=400)
        stored = storage.add_ticker(symbol)
        return web.json_response({"symbol": stored}, status=201)

    async def delete_ticker(request: web.Request) -> web.Response:
        found = storage.delete_ticker(request.match_info["symbol"])
        if not found:
            return web.json_response({"error": "not found"}, status=404)
        return web.json_response({"ok": True})

    async def quotes(request: web.Request) -> web.Response:
        try:
            data = await client.fetch_quotes(storage.list_tickers())
        except Exception:
            return web.json_response({"error": "couldn't reach Finnhub"}, status=502)
        return web.json_response(data)

    app.router.add_get("/tickers", list_tickers)
    app.router.add_post("/tickers", add_ticker)
    app.router.add_options("/tickers", _cors_preflight)
    app.router.add_delete("/tickers/{symbol}", delete_ticker)
    app.router.add_options("/tickers/{symbol}", _cors_preflight)
    app.router.add_get("/quotes", quotes)
    app.router.add_options("/quotes", _cors_preflight)
    return app
