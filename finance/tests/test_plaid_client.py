from unittest.mock import MagicMock

import pytest
from plaid.exceptions import ApiException

from finance_service.plaid_client import REQUEST_TIMEOUT_SECONDS, ItemLoginRequiredError, PlaidClient


@pytest.fixture
def client():
    return PlaidClient(client_id="fake-id", secret="fake-secret", environment="sandbox")


def _fake_transaction(transaction_id: str, amount: float = 4.5) -> MagicMock:
    txn = MagicMock()
    txn.transaction_id = transaction_id
    txn.date = "2026-09-01"
    txn.name = "Coffee Shop"
    txn.amount = amount
    txn.category = ["Food and Drink"]
    txn.pending = False
    return txn


def test_create_link_token_returns_the_token(client, monkeypatch):
    response = MagicMock(link_token="link-sandbox-fake")
    mock_call = MagicMock(return_value=response)
    monkeypatch.setattr(client._api, "link_token_create", mock_call)

    assert client.create_link_token() == "link-sandbox-fake"
    assert mock_call.call_args.kwargs["_request_timeout"] == REQUEST_TIMEOUT_SECONDS


def test_exchange_public_token_returns_access_token_and_item_id(client, monkeypatch):
    response = MagicMock(access_token="access-sandbox-fake", item_id="item-fake")
    mock_call = MagicMock(return_value=response)
    monkeypatch.setattr(client._api, "item_public_token_exchange", mock_call)

    access_token, item_id = client.exchange_public_token("public-sandbox-fake")

    assert access_token == "access-sandbox-fake"
    assert item_id == "item-fake"
    assert mock_call.call_args.kwargs["_request_timeout"] == REQUEST_TIMEOUT_SECONDS


def test_sync_transactions_paginates_until_has_more_is_false(client, monkeypatch):
    page1 = MagicMock(
        added=[_fake_transaction("t1")], modified=[], removed=[], next_cursor="cursor-1", has_more=True
    )
    page2 = MagicMock(
        added=[_fake_transaction("t2")], modified=[], removed=[], next_cursor="cursor-2", has_more=False
    )
    mock_call = MagicMock(side_effect=[page1, page2])
    monkeypatch.setattr(client._api, "transactions_sync", mock_call)

    result = client.sync_transactions("access-sandbox-fake", cursor=None)

    assert [t["transaction_id"] for t in result.added] == ["t1", "t2"]
    assert result.next_cursor == "cursor-2"
    assert all(call.kwargs["_request_timeout"] == REQUEST_TIMEOUT_SECONDS for call in mock_call.call_args_list)


def test_sync_transactions_simplifies_transaction_fields(client, monkeypatch):
    page = MagicMock(
        added=[_fake_transaction("t1", amount=12.34)], modified=[], removed=[], next_cursor="cursor-1", has_more=False
    )
    monkeypatch.setattr(client._api, "transactions_sync", MagicMock(return_value=page))

    result = client.sync_transactions("access-sandbox-fake", cursor=None)

    assert result.added[0] == {
        "transaction_id": "t1",
        "date": "2026-09-01",
        "name": "Coffee Shop",
        "amount": 12.34,
        "category": "Food and Drink",
        "pending": False,
    }


def test_sync_transactions_raises_item_login_required_on_that_plaid_error(client, monkeypatch):
    error = ApiException(status=400)
    error.body = b'{"error_code": "ITEM_LOGIN_REQUIRED"}'
    monkeypatch.setattr(client._api, "transactions_sync", MagicMock(side_effect=error))

    with pytest.raises(ItemLoginRequiredError):
        client.sync_transactions("access-sandbox-fake", cursor=None)


def test_sync_transactions_reraises_other_plaid_errors_unchanged(client, monkeypatch):
    error = ApiException(status=500)
    error.body = b'{"error_code": "INTERNAL_SERVER_ERROR"}'
    monkeypatch.setattr(client._api, "transactions_sync", MagicMock(side_effect=error))

    with pytest.raises(ApiException):
        client.sync_transactions("access-sandbox-fake", cursor=None)


def test_sync_transactions_handles_none_body_without_crashing(client, monkeypatch):
    error = ApiException(status=500)
    error.body = None
    monkeypatch.setattr(client._api, "transactions_sync", MagicMock(side_effect=error))

    with pytest.raises(ApiException):
        client.sync_transactions("access-sandbox-fake", cursor=None)
