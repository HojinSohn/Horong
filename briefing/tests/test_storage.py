import pytest

from briefing_service.storage import connect


@pytest.fixture
def storage(tmp_path):
    return connect(str(tmp_path / "briefing.db"))


def test_add_briefing_returns_the_stored_briefing_with_an_id_and_timestamp(storage):
    briefing = storage.add_briefing("Today's weather is sunny.")
    assert briefing.id == 1
    assert briefing.text == "Today's weather is sunny."
    assert briefing.created_at  # non-empty ISO timestamp


def test_latest_briefing_returns_the_most_recently_added_one(storage):
    storage.add_briefing("first")
    second = storage.add_briefing("second")
    assert storage.latest_briefing() == second


def test_latest_briefing_returns_none_when_nothing_stored(storage):
    assert storage.latest_briefing() is None


def test_add_briefing_persists_across_reconnects(tmp_path):
    db_path = str(tmp_path / "briefing.db")
    connect(db_path).add_briefing("persisted briefing")
    reopened = connect(db_path)
    assert reopened.latest_briefing().text == "persisted briefing"
