import pytest
from starlette.testclient import TestClient

from briefing_service.server import ALLOWED_HOST, _save_daily_briefing, build_app
from briefing_service.storage import connect

ORIGIN = {"Origin": "http://localhost:3000"}
BASE_URL = f"http://{ALLOWED_HOST}"


@pytest.fixture
def storage(tmp_path):
    return connect(str(tmp_path / "briefing.db"))


def test_get_latest_briefing_returns_null_when_nothing_stored(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/briefing/latest", headers=ORIGIN)
        assert resp.status_code == 200
        assert resp.json() == {"briefing": None}


def test_get_latest_briefing_returns_the_most_recent_one(storage):
    storage.add_briefing("first")
    storage.add_briefing("second")
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/briefing/latest", headers=ORIGIN)
        assert resp.status_code == 200
        body = resp.json()
        assert body["text"] == "second"
        assert body["created_at"]


def test_disallowed_origin_is_rejected(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/briefing/latest", headers={"Origin": "http://evil.example.com"})
        assert resp.status_code == 403


def test_allowed_origin_response_includes_cors_header(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/briefing/latest", headers=ORIGIN)
        assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_mcp_endpoint_is_not_blocked_by_the_origin_guard(storage):
    # No Origin header at all — matches how `hermes acp` actually calls
    # this (server-to-server, not a browser). Only asserts it isn't
    # rejected by our own guard (403); the SDK owns full protocol
    # correctness beyond that.
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.post(
            "/mcp",
            headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "probe", "version": "0"},
                },
            },
        )
        assert resp.status_code != 403


def test_save_daily_briefing_tool_stores_and_returns_a_confirmation(storage):
    result = _save_daily_briefing(storage, "Today's weather is sunny.")
    assert result == "Saved today's briefing."
    assert storage.latest_briefing().text == "Today's weather is sunny."
