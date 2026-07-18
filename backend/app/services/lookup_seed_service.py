"""
services/lookup_seed_service.py — Seed fixed lookup tables.

This module keeps small reference tables populated without requiring a
separate manual seed step.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.category import Category


DEFAULT_CATEGORIES: list[tuple[str, str | None]] = [
    ("Pothole", "Road surface damage, potholes, and broken paving."),
    ("Water Supply", "Leaks, low pressure, supply interruptions, and related issues."),
    ("Electricity", "Power outages, faulty street lights, and electrical hazards."),
    ("Sanitation", "Garbage collection, waste accumulation, and cleanliness issues."),
    ("Public Safety", "Street safety, hazards, and urgent civic safety concerns."),
    ("Noise", "Noise pollution and other disturbance complaints."),
    ("Other", "Anything that does not fit the standard civic categories."),
]


def seed_default_categories(db: Session) -> int:
    """Ensure the canonical complaint categories exist."""

    existing_names = {
        name for (name,) in db.execute(text("SELECT name FROM categories")).all()
    }

    created = 0
    for name, description in DEFAULT_CATEGORIES:
        if name in existing_names:
            continue
        db.add(Category(name=name, description=description))
        created += 1

    if created:
        db.commit()

    return created