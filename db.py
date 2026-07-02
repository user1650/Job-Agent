"""
db.py — SQLite database layer for session metadata.

LangGraph conversation memory is persisted separately via SqliteSaver (checkpointer).
This module manages the sessions table: id, title, created_at, updated_at.
"""
import sqlite3
import time
import os
from pathlib import Path
from contextlib import contextmanager

# DB file lives in /app/data inside the container (mounted as a Docker volume)
# Falls back to ./data/deepagent.db for local dev
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = str(DATA_DIR / "deepagent.db")


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT 'New Chat',
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            )
        """)


# ──────────────────────────────────────────────────────────────
# Session CRUD
# ──────────────────────────────────────────────────────────────

def create_session(session_id: str, title: str = "New Chat") -> dict:
    now = int(time.time() * 1000)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (session_id, title, now, now),
        )
    return {"id": session_id, "title": title, "created_at": now, "updated_at": now}


def list_sessions() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def update_session_title(session_id: str, title: str) -> bool:
    now = int(time.time() * 1000)
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE sessions SET title=?, updated_at=? WHERE id=?",
            (title, now, session_id),
        )
    return cur.rowcount > 0


def touch_session(session_id: str):
    """Update updated_at timestamp (called after each message)."""
    now = int(time.time() * 1000)
    with get_conn() as conn:
        conn.execute(
            "UPDATE sessions SET updated_at=? WHERE id=?",
            (now, session_id),
        )


def delete_session(session_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    return cur.rowcount > 0


def session_exists(session_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM sessions WHERE id=?", (session_id,)
        ).fetchone()
    return row is not None


# Initialize on import
init_db()
