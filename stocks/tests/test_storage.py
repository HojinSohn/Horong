import pytest

from stocks_service.storage import connect


@pytest.fixture
def storage(tmp_path):
    return connect(str(tmp_path / "stocks.db"))


def test_add_ticker_stores_uppercased_symbol(storage):
    assert storage.add_ticker("aapl") == "AAPL"
    assert storage.list_tickers() == ["AAPL"]


def test_add_ticker_is_idempotent(storage):
    storage.add_ticker("AAPL")
    storage.add_ticker("AAPL")
    assert storage.list_tickers() == ["AAPL"]


def test_list_tickers_returns_alphabetical_order(storage):
    storage.add_ticker("NVDA")
    storage.add_ticker("AAPL")
    assert storage.list_tickers() == ["AAPL", "NVDA"]


def test_list_tickers_returns_empty_list_when_nothing_stored(storage):
    assert storage.list_tickers() == []


def test_add_ticker_persists_across_reconnects(tmp_path):
    db_path = str(tmp_path / "stocks.db")
    connect(db_path).add_ticker("AAPL")
    reopened = connect(db_path)
    assert reopened.list_tickers() == ["AAPL"]


def test_delete_ticker_removes_it_and_returns_true(storage):
    storage.add_ticker("AAPL")
    assert storage.delete_ticker("AAPL") is True
    assert storage.list_tickers() == []


def test_delete_ticker_returns_false_when_symbol_does_not_exist(storage):
    assert storage.delete_ticker("AAPL") is False
