import pytest
from starlette.testclient import TestClient

from notes_service.server import ALLOWED_HOST, _add_note, _list_notes, build_app
from notes_service.storage import connect

ORIGIN = {"Origin": "http://localhost:3000"}
BASE_URL = f"http://{ALLOWED_HOST}"


@pytest.fixture
def storage(tmp_path):
    return connect(str(tmp_path / "notes.db"))


def test_get_notes_returns_empty_list_when_nothing_stored(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/notes", headers=ORIGIN)
        assert resp.status_code == 200
        assert resp.json() == {"notes": []}


def test_post_notes_adds_a_note_and_returns_it(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.post("/notes", json={"text": "Follow up with recruiter Friday"}, headers=ORIGIN)
        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] == 1
        assert body["text"] == "Follow up with recruiter Friday"
    assert [n.text for n in storage.list_notes()] == ["Follow up with recruiter Friday"]


def test_get_notes_reflects_stored_notes_newest_first(storage):
    storage.add_note("first")
    storage.add_note("second")
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/notes", headers=ORIGIN)
        assert [n["text"] for n in resp.json()["notes"]] == ["second", "first"]


def test_post_notes_malformed_json_returns_400(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.post("/notes", data="not json", headers={**ORIGIN, "Content-Type": "application/json"})
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid request body"


def test_post_notes_missing_text_returns_400(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.post("/notes", json={}, headers=ORIGIN)
        assert resp.status_code == 400


def test_disallowed_origin_is_rejected_on_notes_routes(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/notes", headers={"Origin": "http://evil.example.com"})
        assert resp.status_code == 403


def test_allowed_origin_response_includes_cors_header(storage):
    app = build_app(storage)
    with TestClient(app, base_url=BASE_URL) as client:
        resp = client.get("/notes", headers=ORIGIN)
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
                "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "probe", "version": "0"}},
            },
        )
        assert resp.status_code != 403


def test_add_note_tool_stores_and_returns_a_confirmation(storage):
    result = _add_note(storage, "Follow up with recruiter Friday")
    assert result == "Added note: Follow up with recruiter Friday"
    assert [n.text for n in storage.list_notes()] == ["Follow up with recruiter Friday"]


def test_list_notes_tool_returns_text_only_newest_first(storage):
    storage.add_note("first")
    storage.add_note("second")
    assert _list_notes(storage) == ["second", "first"]
