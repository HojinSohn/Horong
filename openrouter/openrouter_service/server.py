"""aiohttp routes for the OpenRouter usage/balance service."""
from __future__ import annotations

import os

import yaml
from aiohttp import web

from openrouter_service.client import OpenRouterClient

ALLOWED_ORIGINS = {"http://localhost:3000", "http://horong.taila5421b.ts.net:8770"}
CORS_METHODS = "GET, OPTIONS"
CORS_HEADERS = "Content-Type"
DEFAULT_HERMES_CONFIG_PATH = os.path.expanduser("~/.hermes/config.yaml")


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


def build_app(client: OpenRouterClient, config_path: str = DEFAULT_HERMES_CONFIG_PATH) -> web.Application:
    app = web.Application(middlewares=[origin_guard])

    async def usage(request: web.Request) -> web.Response:
        try:
            data = await client.fetch_usage()
        except Exception:
            return web.json_response({"error": "couldn't reach OpenRouter"}, status=502)
        return web.json_response(data)

    async def model(request: web.Request) -> web.Response:
        try:
            with open(config_path) as f:
                config = yaml.safe_load(f)
            model_config = config["model"]
            data = {"model": model_config["default"], "provider": model_config["provider"]}
        except Exception:
            return web.json_response({"error": "couldn't read Hermes config"}, status=502)
        return web.json_response(data)

    app.router.add_get("/usage", usage)
    app.router.add_options("/usage", _cors_preflight)
    app.router.add_get("/model", model)
    app.router.add_options("/model", _cors_preflight)
    return app
