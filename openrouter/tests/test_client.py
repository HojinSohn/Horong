import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from openrouter_service.client import OpenRouterClient


@pytest.mark.asyncio
async def test_fetch_usage_sends_bearer_auth_and_parses_response():
    received_auth = {}

    async def handler(request: web.Request) -> web.Response:
        received_auth["value"] = request.headers.get("Authorization")
        return web.json_response(
            {
                "data": {
                    "limit_remaining": 12.34,
                    "usage": 5.0,
                    "usage_daily": 0.1,
                    "usage_weekly": 1.0,
                    "usage_monthly": 5.0,
                    "is_free_tier": False,
                }
            }
        )

    app = web.Application()
    app.router.add_get("/api/v1/key", handler)
    async with TestServer(app) as server:
        client = OpenRouterClient(api_key="test-key", base_url=str(server.make_url("/api/v1/key")))
        result = await client.fetch_usage()

    assert received_auth["value"] == "Bearer test-key"
    assert result == {
        "limit_remaining": 12.34,
        "usage": 5.0,
        "usage_daily": 0.1,
        "usage_weekly": 1.0,
        "usage_monthly": 5.0,
        "is_free_tier": False,
    }


@pytest.mark.asyncio
async def test_fetch_usage_handles_null_limit_remaining():
    async def handler(request: web.Request) -> web.Response:
        return web.json_response(
            {
                "data": {
                    "limit_remaining": None,
                    "usage": 5.0,
                    "usage_daily": 0.1,
                    "usage_weekly": 1.0,
                    "usage_monthly": 5.0,
                    "is_free_tier": True,
                }
            }
        )

    app = web.Application()
    app.router.add_get("/api/v1/key", handler)
    async with TestServer(app) as server:
        client = OpenRouterClient(api_key="test-key", base_url=str(server.make_url("/api/v1/key")))
        result = await client.fetch_usage()

    assert result["limit_remaining"] is None
    assert result["is_free_tier"] is True
