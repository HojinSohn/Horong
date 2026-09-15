"""aiohttp routes for the Plaid finance service."""
from __future__ import annotations

import asyncio

from aiohttp import web
from cryptography.fernet import InvalidToken

from finance_service.plaid_client import ItemLoginRequiredError, PlaidClient
from finance_service.storage import FinanceStorage

ALLOWED_ORIGINS = {"http://localhost:3000", "http://horong.taila5421b.ts.net:8770"}
CORS_METHODS = "POST, GET, OPTIONS"
CORS_HEADERS = "Content-Type"


@web.middleware
async def origin_guard(request: web.Request, handler):
    origin = request.headers.get("Origin")
    if origin not in ALLOWED_ORIGINS:
        return web.json_response({"error": "forbidden origin"}, status=403)
    response = await handler(request)
    # Server-side origin check above is the real security boundary; this header
    # is what lets a browser (which enforces CORS itself) actually read the response.
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


def build_app(plaid_client: PlaidClient, storage: FinanceStorage) -> web.Application:
    app = web.Application(middlewares=[origin_guard])

    async def link_token(request: web.Request) -> web.Response:
        link_token = await asyncio.to_thread(plaid_client.create_link_token)
        return web.json_response({"link_token": link_token})

    async def link_exchange(request: web.Request) -> web.Response:
        try:
            body = await request.json()
            public_token = body["public_token"]
        except (ValueError, KeyError, TypeError):
            return web.json_response({"error": "invalid request body"}, status=400)
        access_token, item_id = await asyncio.to_thread(plaid_client.exchange_public_token, public_token)
        storage.save_item(item_id, access_token)
        return web.json_response({"status": "linked"})

    async def transactions(request: web.Request) -> web.Response:
        try:
            item = storage.load_item()
        except InvalidToken:
            return web.json_response(
                {"error": "stored credentials could not be decrypted — check FINANCE_FERNET_KEY"},
                status=500,
            )
        if item is None:
            return web.json_response({"linked": False, "needs_reauth": False, "transactions": []})
        try:
            result = await asyncio.to_thread(plaid_client.sync_transactions, item.access_token, item.cursor)
        except ItemLoginRequiredError:
            return web.json_response(
                {"linked": True, "needs_reauth": True, "transactions": storage.load_transactions()}
            )
        storage.apply_sync(result.added, result.modified, result.removed_ids)
        storage.save_cursor(result.next_cursor)
        return web.json_response(
            {"linked": True, "needs_reauth": False, "transactions": storage.load_transactions()}
        )

    app.router.add_post("/link/token", link_token)
    app.router.add_post("/link/exchange", link_exchange)
    app.router.add_get("/transactions", transactions)
    for path in ("/link/token", "/link/exchange", "/transactions"):
        app.router.add_options(path, _cors_preflight)
    return app
