"""
base.py — SQLAlchemy Declarative Base

Responsibilities:
  - Provide the single DeclarativeBase all ORM models must inherit from.
  - All future models (User, Issue, etc.) import Base from here so that
    Alembic's autogenerate can discover every table in one place.

Usage:
    from app.database.base import Base

    class User(Base):
        __tablename__ = "users"
        ...

Alembic env.py must import Base.metadata so migrations are auto-generated:
    from app.database.base import Base
    target_metadata = Base.metadata
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Project-wide SQLAlchemy 2.0 declarative base.

    All ORM model classes inherit from this single Base so that:
      - Base.metadata holds every table definition.
      - Alembic can autogenerate migrations from a single metadata object.
      - Table relationships resolve correctly across modules.
    """
    pass
