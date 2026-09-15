import pytest
from aiohttp.test_utils import TestClient, TestServer

from stocks_service.server import build_app
from stocks_service.storage import connect

ORIGIN = {"Origin": "http://localhost:3000"}


class FakeFinnhubClient:
    def __init__(self, quotes: list[dict] | None = None, raise_error: bool = False) -> None:
        self._quotes = quotes if quotes is not None else []
        self._raise_error = raise_error
        self.requested_symbols: list[str] | None = None

    async def fetch_quotes(self, symbols: list[str]) -> list[dict]:
        self.requested_symbols = symbols
        if self._raise_error:
            raise RuntimeError("boom")
        return self._quotes


@pytest.fixture
def storage(tmp_path):
    return connect(str(tmp_path / "stocks.db"))


@pytest.mark.asyncio
async def test_get_tickers_returns_stored_symbols(storage):
    storage.add_ticker("AAPL")
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/tickers", headers=ORIGIN)
        assert resp.status == 200
        assert await resp.json() == ["AAPL"]


@pytest.mark.asyncio
async def test_post_tickers_adds_a_symbol(storage):
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.post("/tickers", json={"symbol": "aapl"}, headers=ORIGIN)
        assert resp.status == 201
        assert await resp.json() == {"symbol": "AAPL"}
    assert storage.list_tickers() == ["AAPL"]


@pytest.mark.asyncio
async def test_post_tickers_rejects_missing_symbol(storage):
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.post("/tickers", json={}, headers=ORIGIN)
        assert resp.status == 400


@pytest.mark.asyncio
async def test_delete_ticker_removes_symbol(storage):
    storage.add_ticker("AAPL")
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.delete("/tickers/AAPL", headers=ORIGIN)
        assert resp.status == 200
    assert storage.list_tickers() == []


@pytest.mark.asyncio
async def test_delete_ticker_returns_404_when_missing(storage):
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.delete("/tickers/AAPL", headers=ORIGIN)
        assert resp.status == 404


@pytest.mark.asyncio
async def test_get_quotes_returns_client_data_for_stored_tickers(storage):
    storage.add_ticker("AAPL")
    fake_client = FakeFinnhubClient(quotes=[{"symbol": "AAPL", "price": 231.14, "change": 2.5, "changePercent": 1.2}])
    app = build_app(storage, fake_client)
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/quotes", headers=ORIGIN)
        assert resp.status == 200
        assert await resp.json() == [{"symbol": "AAPL", "price": 231.14, "change": 2.5, "changePercent": 1.2}]
    assert fake_client.requested_symbols == ["AAPL"]


@pytest.mark.asyncio
async def test_get_quotes_returns_502_when_finnhub_call_fails(storage):
    app = build_app(storage, FakeFinnhubClient(raise_error=True))
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/quotes", headers=ORIGIN)
        assert resp.status == 502


@pytest.mark.asyncio
async def test_disallowed_origin_is_rejected(storage):
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.get("/tickers", headers={"Origin": "http://evil.example.com"})
        assert resp.status == 403


@pytest.mark.asyncio
async def test_options_preflight_returns_cors_headers(storage):
    app = build_app(storage, FakeFinnhubClient())
    async with TestClient(TestServer(app)) as client:
        resp = await client.options("/tickers", headers=ORIGIN)
        assert resp.status in (200, 204)
        assert resp.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
