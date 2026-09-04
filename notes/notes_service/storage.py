"""SQLite persistence for notes — a flat, append-only list."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


@dataclass
class Note:
    id: int
    text: str
    created_at: str


def connect(db_path: str) -> "NotesStorage":
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.executescript(SCHEMA)
    conn.commit()
    return NotesStorage(conn)


class NotesStorage:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def add_note(self, text: str) -> Note:
        created_at = datetime.now(timezone.utc).isoformat()
        cursor = self._conn.execute(
            "INSERT INTO notes (text, created_at) VALUES (?, ?)", (text, created_at)
        )
        self._conn.commit()
        return Note(id=cursor.lastrowid, text=text, created_at=created_at)

    def list_notes(self) -> list[Note]:
        rows = self._conn.execute(
            "SELECT id, text, created_at FROM notes ORDER BY id DESC"
        ).fetchall()
        return [Note(id=r[0], text=r[1], created_at=r[2]) for r in rows]
