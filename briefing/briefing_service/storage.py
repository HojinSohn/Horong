"""SQLite persistence for the daily briefing — every briefing gets a row,
but only the newest one is ever read back."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS briefings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


@dataclass
class Briefing:
    id: int
    text: str
    created_at: str


def connect(db_path: str) -> "BriefingStorage":
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.executescript(SCHEMA)
    conn.commit()
    return BriefingStorage(conn)


class BriefingStorage:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def add_briefing(self, text: str) -> Briefing:
        created_at = datetime.now(timezone.utc).isoformat()
        cursor = self._conn.execute(
            "INSERT INTO briefings (text, created_at) VALUES (?, ?)", (text, created_at)
        )
        self._conn.commit()
        return Briefing(id=cursor.lastrowid, text=text, created_at=created_at)

    def latest_briefing(self) -> Briefing | None:
        row = self._conn.execute(
            "SELECT id, text, created_at FROM briefings ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if row is None:
            return None
        return Briefing(id=row[0], text=row[1], created_at=row[2])
