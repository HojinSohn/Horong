import pytest
from cryptography.fernet import Fernet

from finance_service.storage import connect


@pytest.fixture
def storage(tmp_path):
    key = Fernet.generate_key().decode()
    return connect(str(tmp_path / "finance.db"), key)


def test_save_and_load_item_round_trips_and_encrypts_at_rest(storage, tmp_path):
    storage.save_item("item-1", "access-sandbox-abc123")

    loaded = storage.load_item()
    assert loaded.item_id == "item-1"
    assert loaded.access_token == "access-sandbox-abc123"
    assert loaded.cursor is None

    raw = (tmp_path / "finance.db").read_bytes()
    assert b"access-sandbox-abc123" not in raw


def test_load_item_returns_none_when_nothing_linked(storage):
    assert storage.load_item() is None


def test_save_cursor_persists_across_loads(storage):
    storage.save_item("item-1", "access-token")
    storage.save_cursor("cursor-xyz")
    assert storage.load_item().cursor == "cursor-xyz"


def test_save_item_clears_stale_transactions_from_a_previously_linked_item(storage):
    storage.save_item("item-sandbox", "access-sandbox")
    storage.apply_sync(
        added=[
            {
                "transaction_id": "sandbox-t1",
                "date": "2026-08-27",
                "name": "United Airlines",
                "amount": 500,
                "category": "Travel",
                "pending": False,
            }
        ],
        modified=[],
        removed_ids=[],
    )
    assert len(storage.load_transactions()) == 1

    # Re-linking (e.g. switching from Sandbox to a real Production bank)
    # must not leave the previous item's cached transactions behind — they
    # belong to an item that's no longer linked and would otherwise show up
    # forever alongside the new item's real data.
    storage.save_item("item-production", "access-production")

    assert storage.load_transactions() == []


def test_apply_sync_upserts_added_and_modified_and_deletes_removed(storage):
    storage.save_item("item-1", "access-token")
    txn = {
        "transaction_id": "t1",
        "date": "2026-09-01",
        "name": "Coffee Shop",
        "amount": 4.5,
        "category": "Food and Drink",
        "pending": False,
    }
    storage.apply_sync(added=[txn], modified=[], removed_ids=[])
    assert storage.load_transactions() == [
        {"id": "t1", "date": "2026-09-01", "name": "Coffee Shop", "amount": 4.5, "category": "Food and Drink", "pending": False}
    ]

    modified_txn = {**txn, "amount": 5.0, "pending": True}
    storage.apply_sync(added=[], modified=[modified_txn], removed_ids=[])
    updated = storage.load_transactions()[0]
    assert updated["amount"] == 5.0
    assert updated["pending"] is True

    storage.apply_sync(added=[], modified=[], removed_ids=["t1"])
    assert storage.load_transactions() == []
