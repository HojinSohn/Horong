"""aiohttp routes for the Plaid finance service."""
from __future__ import annotations

from aiohttp import web

from finance_service.plaid_client import ItemLoginRequiredError, PlaidClient
from finance_service.storage import FinanceStorage

ALLOWED_ORIGIN = "http://localhost:3000"


@web.middleware
async def origin_guard(request: web.Request, handler):
    if request.headers.get("Origin") != ALLOWED_ORIGIN:
        return web.json_response({"error": "forbidden origin"}, status=403)
    return await handler(request)


def build_app(plaid_client: PlaidClient, storage: FinanceStorage) -> web.Application:
    app = web.Application(middlewares=[origin_guard])

    async def link_token(request: web.Request) -> web.Response:
        return web.json_response({"link_token": plaid_client.create_link_token()})

    async def link_exchange(request: web.Request) -> web.Response:
        body = await request.json()
        access_token, item_id = plaid_client.exchange_public_token(body["public_token"])
        storage.save_item(item_id, access_token)
        return web.json_response({"status": "linked"})

    async def transactions(request: web.Request) -> web.Response:
        item = storage.load_item()
        if item is None:
            return web.json_response({"linked": False, "needs_reauth": False, "transactions": []})
        try:
            result = plaid_client.sync_transactions(item.access_token, item.cursor)
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
    return app
