"""SQLite persistence for the set of tickers the dashboard tracks."""
from __future__ import annotations

import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS tickers (
    symbol TEXT PRIMARY KEY
);
"""


def connect(db_path: str) -> "TickerStorage":
    # check_same_thread=False: mirrors notes_service/storage.py — safe under
    # sqlite3.threadsafety == 3 (serialized mode), needed for aiohttp's
    # TestServer/TestClient test harness.
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.executescript(SCHEMA)
    conn.commit()
    return TickerStorage(conn)


class TickerStorage:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def add_ticker(self, symbol: str) -> str:
        symbol = symbol.strip().upper()
        self._conn.execute("INSERT OR IGNORE INTO tickers (symbol) VALUES (?)", (symbol,))
        self._conn.commit()
        return symbol

    def list_tickers(self) -> list[str]:
        rows = self._conn.execute("SELECT symbol FROM tickers ORDER BY symbol ASC").fetchall()
        return [r[0] for r in rows]

    def delete_ticker(self, symbol: str) -> bool:
        cursor = self._conn.execute("DELETE FROM tickers WHERE symbol = ?", (symbol.strip().upper(),))
        self._conn.commit()
        return cursor.rowcount > 0
