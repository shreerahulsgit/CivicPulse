"""
connection.py — SQLAlchemy Engine

Responsibilities:
  - Load DATABASE_URL from the .env file
  - Create a production-grade SQLAlchemy 2.0 engine for MySQL
  - Configure connection pooling suitable for a FastAPI / async-capable app

Key settings:
  pool_pre_ping  : Tests every connection before handing it to the app,
                   automatically recovering from "MySQL has gone away" errors.
  pool_size      : Number of persistent connections kept open.
  max_overflow   : Extra connections allowed beyond pool_size under load.
  pool_recycle   : Forces connections to be recycled after N seconds,
                   preventing MySQL from closing idle connections (default 8-hour wait_timeout).
  future=True    : Opts in to SQLAlchemy 2.0-style usage (required for 2.x).
  echo           : Set True only in development to log all SQL statements.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

# ── Load .env ──────────────────────────────────────────────────────────────────
# Walks up from this file's directory to locate the .env file in backend/
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

# ── Validate ────────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    raise EnvironmentError(
        "DATABASE_URL is not set. "
        "Add it to your .env file: "
        "mysql+pymysql://user:password@host/dbname"
    )

if not DATABASE_URL.startswith("mysql+pymysql://"):
    raise ValueError(
        f"Unsupported database URL scheme: '{DATABASE_URL}'. "
        "CivicPulse requires 'mysql+pymysql://'."
    )

# ── Engine ──────────────────────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,

    # ── Pooling ────────────────────────────────────────────────────────────────
    pool_pre_ping=True,       # Silently reconnect on stale connections
    pool_size=10,             # Core pool — 10 persistent connections
    max_overflow=20,          # Allow 20 extra connections under burst load
    pool_recycle=1800,        # Recycle connections every 30 min (< MySQL wait_timeout)
    pool_timeout=30,          # Raise after 30 s if no connection is available

    # ── SQLAlchemy 2.0 ─────────────────────────────────────────────────────────
    future=True,              # Enables 2.0-style engine and Session behaviour

    # ── Debugging — disable in production ─────────────────────────────────────
    echo=os.getenv("APP_DEBUG", "False").lower() == "true",
)


def verify_connection() -> None:
    """
    Lightweight health-check called at app startup.
    Raises OperationalError if the database is unreachable.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError as exc:
        raise RuntimeError(
            f"Cannot connect to the database. "
            f"Check DATABASE_URL in .env.\nOriginal error: {exc}"
        ) from exc
