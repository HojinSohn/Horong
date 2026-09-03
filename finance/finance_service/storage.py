"""SQLite persistence for the single linked Plaid item and its cached
transactions. The access token is the most sensitive credential in this
project (real bank access) — encrypted at rest with Fernet."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from cryptography.fernet import Fernet

SCHEMA = """
CREATE TABLE IF NOT EXISTS plaid_item (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    item_id TEXT NOT NULL,
    access_token_encrypted BLOB NOT NULL,
    cursor TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    pending INTEGER NOT NULL
);
"""


@dataclass
class PlaidItem:
    item_id: str
    access_token: str
    cursor: str | None


def connect(db_path: str, fernet_key: str) -> "FinanceStorage":
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return FinanceStorage(conn, Fernet(fernet_key.encode()))


class FinanceStorage:
    def __init__(self, conn: sqlite3.Connection, fernet: Fernet) -> None:
        self._conn = conn
        self._fernet = fernet

    def save_item(self, item_id: str, access_token: str) -> None:
        encrypted = self._fernet.encrypt(access_token.encode())
        self._conn.execute(
            "INSERT INTO plaid_item (id, item_id, access_token_encrypted, cursor) VALUES (1, ?, ?, NULL) "
            "ON CONFLICT(id) DO UPDATE SET item_id = excluded.item_id, "
            "access_token_encrypted = excluded.access_token_encrypted, cursor = NULL",
            (item_id, encrypted),
        )
        self._conn.commit()

    def load_item(self) -> PlaidItem | None:
        row = self._conn.execute(
            "SELECT item_id, access_token_encrypted, cursor FROM plaid_item WHERE id = 1"
        ).fetchone()
        if row is None:
            return None
        item_id, encrypted, cursor = row
        access_token = self._fernet.decrypt(encrypted).decode()
        return PlaidItem(item_id=item_id, access_token=access_token, cursor=cursor)

    def save_cursor(self, cursor: str) -> None:
        self._conn.execute("UPDATE plaid_item SET cursor = ? WHERE id = 1", (cursor,))
        self._conn.commit()

    def apply_sync(self, added: list[dict], modified: list[dict], removed_ids: list[str]) -> None:
        for txn in (*added, *modified):
            self._conn.execute(
                "INSERT INTO transactions (transaction_id, date, name, amount, category, pending) "
                "VALUES (?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(transaction_id) DO UPDATE SET date=excluded.date, name=excluded.name, "
                "amount=excluded.amount, category=excluded.category, pending=excluded.pending",
                (txn["transaction_id"], txn["date"], txn["name"], txn["amount"], txn["category"], int(txn["pending"])),
            )
        for transaction_id in removed_ids:
            self._conn.execute("DELETE FROM transactions WHERE transaction_id = ?", (transaction_id,))
        self._conn.commit()

    def load_transactions(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT transaction_id, date, name, amount, category, pending FROM transactions ORDER BY date DESC"
        ).fetchall()
        return [
            {"id": r[0], "date": r[1], "name": r[2], "amount": r[3], "category": r[4], "pending": bool(r[5])}
            for r in rows
        ]
