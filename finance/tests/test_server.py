import pytest
from aiohttp.test_utils import TestClient, TestServer
from cryptography.fernet import Fernet

from finance_service.plaid_client import ItemLoginRequiredError, SyncResult
from finance_service.server import build_app
from finance_service.storage import connect

ORIGIN = {"Origin": "http://localhost:3000"}


class FakePlaidClient:
    def __init__(self) -> None:
        self.raise_login_required = False

    def create_link_token(self) -> str:
        return "link-sandbox-fake"

    def exchange_public_token(self, public_token: str) -> tuple[str, str]:
        assert public_token == "public-sandbox-fake"
        return "access-sandbox-fake", "item-fake"

    def sync_transactions(self, access_token: str, cursor: str | None) -> SyncResult:
        if self.raise_login_required:
            raise ItemLoginRequiredError
        txn = {
            "transaction_id": "t1",
            "date": "2026-09-01",
            "name": "Coffee Shop",
            "amount": 4.5,
            "category": "Food and Drink",
            "pending": False,
        }
        return SyncResult(added=[txn], modified=[], removed_ids=[], next_cursor="cursor-1")


@pytest.fixture
def storage(tmp_path):
    key = Fernet.generate_key().decode()
    return connect(str(tmp_path / "finance.db"), key)


@pytest.mark.asyncio
async def test_link_token_route_returns_the_token(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.post("/link/token", headers=ORIGIN)
        assert resp.status == 200
        assert await resp.json() == {"link_token": "link-sandbox-fake"}


@pytest.mark.asyncio
async def test_link_exchange_stores_the_access_token(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.post("/link/exchange", json={"public_token": "public-sandbox-fake"}, headers=ORIGIN)
        assert resp.status == 200
        assert await resp.json() == {"status": "linked"}
    assert storage.load_item().access_token == "access-sandbox-fake"


@pytest.mark.asyncio
async def test_transactions_route_syncs_and_returns_cached_list(storage):
    storage.save_item("item-fake", "access-sandbox-fake")
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/transactions", headers=ORIGIN)
        body = await resp.json()
        assert body["linked"] is True
        assert body["needs_reauth"] is False
        assert body["transactions"][0]["name"] == "Coffee Shop"
    assert storage.load_item().cursor == "cursor-1"


@pytest.mark.asyncio
async def test_transactions_route_reports_not_linked_when_nothing_stored(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/transactions", headers=ORIGIN)
        assert await resp.json() == {"linked": False, "needs_reauth": False, "transactions": []}


@pytest.mark.asyncio
async def test_transactions_route_surfaces_reauth_needed(storage):
    storage.save_item("item-fake", "access-sandbox-fake")
    plaid_client = FakePlaidClient()
    plaid_client.raise_login_required = True
    app = build_app(plaid_client, storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/transactions", headers=ORIGIN)
        assert (await resp.json())["needs_reauth"] is True


@pytest.mark.asyncio
async def test_disallowed_origin_is_rejected(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.post("/link/token", headers={"Origin": "http://evil.example.com"})
        assert resp.status == 403


@pytest.mark.asyncio
async def test_allowed_origin_response_includes_cors_header(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/transactions", headers=ORIGIN)
        assert resp.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


@pytest.mark.asyncio
async def test_options_preflight_returns_cors_headers(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.options("/link/exchange", headers=ORIGIN)
        assert resp.status in (200, 204)
        assert resp.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
        assert "POST" in resp.headers["Access-Control-Allow-Methods"]
        assert resp.headers["Access-Control-Allow-Headers"] == "Content-Type"


@pytest.mark.asyncio
async def test_link_exchange_malformed_json_returns_400(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.post(
            "/link/exchange", data="not json", headers={**ORIGIN, "Content-Type": "application/json"}
        )
        assert resp.status == 400
        assert (await resp.json())["error"] == "invalid request body"


@pytest.mark.asyncio
async def test_link_exchange_missing_public_token_returns_400(storage):
    app = build_app(FakePlaidClient(), storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.post("/link/exchange", json={}, headers=ORIGIN)
        assert resp.status == 400
        assert (await resp.json())["error"] == "invalid request body"


@pytest.mark.asyncio
async def test_transactions_route_reports_diagnostic_on_bad_fernet_key(tmp_path):
    db_path = str(tmp_path / "finance.db")
    linking_storage = connect(db_path, Fernet.generate_key().decode())
    linking_storage.save_item("item-fake", "access-sandbox-fake")
    # Simulate a rotated/corrupted encryption key: same DB, different Fernet key.
    mismatched_storage = connect(db_path, Fernet.generate_key().decode())
    app = build_app(FakePlaidClient(), mismatched_storage)
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/transactions", headers=ORIGIN)
        assert resp.status == 500
        body = await resp.json()
        assert "FINANCE_FERNET_KEY" in body["error"]
