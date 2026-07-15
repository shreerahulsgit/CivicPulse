"""
session.py — SQLAlchemy Session Factory + FastAPI Dependency

Responsibilities:
  - Create the SessionLocal factory bound to the engine from connection.py
  - Expose get_db() — a FastAPI dependency that yields one DB session per request
    and guarantees commit / rollback / close regardless of outcome.

Usage in a route:
    from app.database.session import get_db
    from sqlalchemy.orm import Session

    @router.get("/issues")
    def list_issues(db: Session = Depends(get_db)):
        ...
"""

from typing import Generator

from sqlalchemy.orm import Session, sessionmaker

from app.database.connection import engine

# ── Session factory ─────────────────────────────────────────────────────────────
#   autocommit=False : Transactions are explicit; call db.commit() yourself.
#   autoflush=False  : Prevents SQLAlchemy from auto-flushing before every query,
#                      giving you full control over when SQL is sent to MySQL.
#   bind=engine      : Associates every session with our MySQL engine.
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


# ── FastAPI dependency ──────────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    Yield a SQLAlchemy Session for a single HTTP request lifecycle.

    Flow:
        1. Open a new session from SessionLocal.
        2. Yield it to the route handler.
        3. On success  → commit any pending transaction.
        4. On error    → rollback to leave the DB in a clean state.
        5. Always      → close the session, returning the connection to the pool.

    Inject via FastAPI's Depends:
        db: Session = Depends(get_db)
    """
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
