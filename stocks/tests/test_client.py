import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from stocks_service.client import FinnhubClient


@pytest.mark.asyncio
async def test_fetch_quote_sends_token_and_parses_response():
    received = {}

    async def handler(request: web.Request) -> web.Response:
        received["symbol"] = request.query.get("symbol")
        received["token"] = request.query.get("token")
        return web.json_response({"c": 231.14, "d": 2.5, "dp": 1.2, "h": 233, "l": 228, "o": 229, "pc": 228.64})

    app = web.Application()
    app.router.add_get("/quote", handler)
    async with TestServer(app) as server:
        client = FinnhubClient(api_key="test-key", base_url=str(server.make_url("/quote")))
        result = await client.fetch_quote("AAPL")

    assert received == {"symbol": "AAPL", "token": "test-key"}
    assert result == {"symbol": "AAPL", "price": 231.14, "change": 2.5, "changePercent": 1.2}


@pytest.mark.asyncio
async def test_fetch_quotes_returns_a_quote_per_symbol():
    async def handler(request: web.Request) -> web.Response:
        symbol = request.query.get("symbol")
        return web.json_response({"c": 1.0, "d": 0.1, "dp": 0.5} if symbol == "AAPL" else {"c": 2.0, "d": 0.2, "dp": 0.3})

    app = web.Application()
    app.router.add_get("/quote", handler)
    async with TestServer(app) as server:
        client = FinnhubClient(api_key="test-key", base_url=str(server.make_url("/quote")))
        results = await client.fetch_quotes(["AAPL", "NVDA"])

    assert {r["symbol"] for r in results} == {"AAPL", "NVDA"}


@pytest.mark.asyncio
async def test_fetch_quotes_drops_symbols_that_error():
    async def handler(request: web.Request) -> web.Response:
        if request.query.get("symbol") == "BAD":
            return web.json_response({"error": "nope"}, status=500)
        return web.json_response({"c": 1.0, "d": 0.1, "dp": 0.5})

    app = web.Application()
    app.router.add_get("/quote", handler)
    async with TestServer(app) as server:
        client = FinnhubClient(api_key="test-key", base_url=str(server.make_url("/quote")))
        results = await client.fetch_quotes(["AAPL", "BAD"])

    assert [r["symbol"] for r in results] == ["AAPL"]
