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
    # check_same_thread=False: required for Starlette's TestClient, which
    # runs the ASGI app inside a separate OS thread via anyio's blocking
    # portal (anyio.from_thread.start_blocking_portal) — the storage object
    # is created on the test's calling thread but exercised from that
    # portal thread. Safe because sqlite3.threadsafety == 3 (serialized
    # mode) on this build; MCP tool functions are async (see server.py) so
    # in production nothing besides this test-harness indirection crosses
    # threads.
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

    def update_note(self, id: int, text: str) -> Note | None:
        cursor = self._conn.execute(
            "UPDATE notes SET text = ? WHERE id = ?", (text, id)
        )
        self._conn.commit()
        if cursor.rowcount == 0:
            return None
        row = self._conn.execute(
            "SELECT id, text, created_at FROM notes WHERE id = ?", (id,)
        ).fetchone()
        return Note(id=row[0], text=row[1], created_at=row[2])

    def delete_note(self, id: int) -> bool:
        cursor = self._conn.execute("DELETE FROM notes WHERE id = ?", (id,))
        self._conn.commit()
        return cursor.rowcount > 0
