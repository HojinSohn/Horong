import pytest
from aiohttp.test_utils import TestClient, TestServer

from openrouter_service.server import build_app

ORIGIN = {"Origin": "http://localhost:3000"}

USAGE = {
    "limit_remaining": 12.34,
    "usage": 5.0,
    "usage_daily": 0.1,
    "usage_weekly": 1.0,
    "usage_monthly": 5.0,
    "is_free_tier": False,
}


class FakeOpenRouterClient:
    def __init__(self, response: dict | None = None, raise_error: bool = False) -> None:
        self._response = response if response is not None else USAGE
        self._raise_error = raise_error

    async def fetch_usage(self) -> dict:
        if self._raise_error:
            raise RuntimeError("boom")
        return self._response


@pytest.mark.asyncio
async def test_usage_route_returns_client_data():
    app = build_app(FakeOpenRouterClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/usage", headers=ORIGIN)
        assert resp.status == 200
        assert await resp.json() == USAGE


@pytest.mark.asyncio
async def test_usage_route_returns_502_when_openrouter_call_fails():
    app = build_app(FakeOpenRouterClient(raise_error=True))
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/usage", headers=ORIGIN)
        assert resp.status == 502
        assert "error" in await resp.json()


@pytest.mark.asyncio
async def test_disallowed_origin_is_rejected():
    app = build_app(FakeOpenRouterClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/usage", headers={"Origin": "http://evil.example.com"})
        assert resp.status == 403


@pytest.mark.asyncio
async def test_allowed_origin_response_includes_cors_header():
    app = build_app(FakeOpenRouterClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/usage", headers=ORIGIN)
        assert resp.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


@pytest.mark.asyncio
async def test_options_preflight_returns_cors_headers():
    app = build_app(FakeOpenRouterClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.options("/usage", headers=ORIGIN)
        assert resp.status in (200, 204)
        assert resp.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
        assert "GET" in resp.headers["Access-Control-Allow-Methods"]
