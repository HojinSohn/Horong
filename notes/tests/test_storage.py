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


def test_update_note_changes_text_and_returns_the_updated_note(storage):
    note = storage.add_note("original")
    updated = storage.update_note(note.id, "revised")
    assert updated.id == note.id
    assert updated.text == "revised"
    assert updated.created_at == note.created_at  # unchanged
    assert [n.text for n in storage.list_notes()] == ["revised"]


def test_update_note_returns_none_when_id_does_not_exist(storage):
    assert storage.update_note(999, "revised") is None


def test_delete_note_removes_it_and_returns_true(storage):
    note = storage.add_note("to be deleted")
    assert storage.delete_note(note.id) is True
    assert storage.list_notes() == []


def test_delete_note_returns_false_when_id_does_not_exist(storage):
    assert storage.delete_note(999) is False
