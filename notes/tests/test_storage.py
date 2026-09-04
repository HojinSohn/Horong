import pytest

from notes_service.storage import connect


@pytest.fixture
def storage(tmp_path):
    return connect(str(tmp_path / "notes.db"))


def test_add_note_returns_the_stored_note_with_an_id_and_timestamp(storage):
    note = storage.add_note("Follow up with recruiter Friday")
    assert note.id == 1
    assert note.text == "Follow up with recruiter Friday"
    assert note.created_at  # non-empty ISO timestamp


def test_list_notes_returns_newest_first(storage):
    storage.add_note("first")
    storage.add_note("second")
    assert [n.text for n in storage.list_notes()] == ["second", "first"]


def test_list_notes_returns_empty_list_when_nothing_stored(storage):
    assert storage.list_notes() == []


def test_add_note_persists_across_reconnects(tmp_path):
    db_path = str(tmp_path / "notes.db")
    connect(db_path).add_note("persisted note")
    reopened = connect(db_path)
    assert [n.text for n in reopened.list_notes()] == ["persisted note"]
