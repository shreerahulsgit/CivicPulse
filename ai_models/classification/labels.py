"""
ai_models/classification/labels.py — Complaint Category Label Registry

Single source of truth for all AI-classifiable complaint categories.

Usage:
  from ai_models.classification.labels import LABELS, id2label, label2id

LABELS         — ordered list of canonical category strings
id2label       — int index → label string (for HuggingFace config)
label2id       — label string → int index (for HuggingFace config)
CATEGORY_MAP   — AI label → DB Category.name mapping
                 (used to translate AI predictions back to DB lookups)

Design notes:
  - Keep LABELS in a stable order — changing order invalidates trained weights.
  - CATEGORY_MAP allows the AI label to differ from the DB name
    (e.g. "Streetlight Failure" in AI → "Electricity" in DB).
  - Add new labels at the END of LABELS list only, never insert in the middle.
"""

from typing import Final

# ── Canonical AI category labels ────────────────────────────────────────────
# Order is fixed — used as class indices in the classification model.
LABELS: Final[list[str]] = [
    "Pothole",             # 0
    "Garbage Overflow",    # 1
    "Water Leakage",       # 2
    "Drainage Blockage",   # 3
    "Streetlight Failure", # 4
    "Road Damage",         # 5
]

NUM_LABELS: Final[int] = len(LABELS)

# ── HuggingFace-compatible mappings ─────────────────────────────────────────
id2label: Final[dict[int, str]] = {i: label for i, label in enumerate(LABELS)}
label2id: Final[dict[str, int]] = {label: i for i, label in enumerate(LABELS)}

# ── AI label → DB Category.name mapping ─────────────────────────────────────
# Maps the AI prediction back to the Category.name stored in the DB.
# If the DB category name differs from the AI label, map it here.
CATEGORY_MAP: Final[dict[str, str]] = {
    "Pothole":             "Pothole",
    "Garbage Overflow":    "Sanitation",
    "Water Leakage":       "Water Supply",
    "Drainage Blockage":   "Sanitation",
    "Streetlight Failure": "Electricity",
    "Road Damage":         "Pothole",      # closest DB category
}

# ── Confidence threshold ─────────────────────────────────────────────────────
# Predictions below this threshold are treated as "low confidence"
# and logged but not automatically applied to the complaint.
CONFIDENCE_THRESHOLD: Final[float] = 0.60


def get_db_category_name(ai_label: str) -> str:
    """
    Translate an AI classification label to the corresponding DB Category.name.
    Falls back to the AI label itself if no mapping exists.
    """
    return CATEGORY_MAP.get(ai_label, ai_label)
