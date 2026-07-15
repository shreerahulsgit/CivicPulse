"""
services/ai_classification_service.py — AI Classification Service Layer

Wraps the ComplaintClassifier with business-layer logic:
  - DB category resolution (AI label → Category ORM row)
  - Fallback to manual category_id when model is unavailable or low-confidence
  - Structured result for the complaint creation pipeline

Classes:
  AIClassificationResult  — structured output for complaint_service.py
  AIClassificationService — service methods called by complaint_service

Public API:
  service = AIClassificationService()

  result = service.classify_complaint(
      db          = db,
      text        = "Large pothole on MG Road near signal",
      category_id = 3,   # manual category_id from user input (fallback)
  )

  # result.ai_label         → "Pothole" or None
  # result.ai_confidence    → 0.934 or 0.0
  # result.resolved_category_id  → AI category from DB, or manual fallback
  # result.used_ai          → True/False

Fallback hierarchy:
  1. AI predicts with high confidence → use AI category from DB
  2. AI predicts but low confidence   → keep manual, store ai_label for audit
  3. AI unavailable / error           → keep manual, ai_label = None
  4. AI predicts but DB category not found → keep manual, warn

Design principles:
  - NEVER blocks or raises — complaint creation must always succeed.
  - All results are logged for training data collection.
  - The complaint.ai_category field is always populated if AI ran,
    even if the manual category is used (for monitoring model accuracy).
"""

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models.category import Category

logger = logging.getLogger(__name__)


# ── Lazy classifier import — avoids torch import at cold start ────────────────
def _get_classifier():
    try:
        from ai_models.classification.classifier import classifier
        return classifier
    except Exception as exc:
        logger.warning("Could not import AI classifier: %s", exc)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Result
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AIClassificationResult:
    """
    Structured output of AIClassificationService.classify_complaint().

    Fields:
      ai_label              — AI predicted label, e.g. "Pothole" (None if model failed)
      ai_confidence         — Model confidence 0.0–1.0
      resolved_category_id  — The category_id to use for the complaint.
                              Either the AI-resolved DB category (if confident)
                              or the manual fallback category_id.
      used_ai               — True if the AI category was actually applied
                              (i.e. confidence was high enough AND DB category found)
      fallback_reason       — Human-readable explanation of fallback (for logging/audit)
    """
    ai_label:             Optional[str]  = None
    ai_confidence:        float          = 0.0
    resolved_category_id: Optional[int] = None
    used_ai:              bool           = False
    fallback_reason:      str            = ""


# ═══════════════════════════════════════════════════════════════════════════════
# Service
# ═══════════════════════════════════════════════════════════════════════════════

class AIClassificationService:
    """
    Integrates AI classification into the complaint creation pipeline.

    Instantiate once at module level:
        ai_service = AIClassificationService()

    Then call in complaint_service.create_complaint():
        result = ai_service.classify_complaint(db, title + " " + description, category_id)
        complaint.ai_category  = result.ai_label
        complaint.category_id  = result.resolved_category_id
    """

    def __init__(self) -> None:
        self._classifier = None  # lazy-loaded

    def _load_classifier(self):
        if self._classifier is None:
            self._classifier = _get_classifier()
            if self._classifier:
                self._classifier.load_model()
        return self._classifier

    # ── Single complaint classification ──────────────────────────────────────

    def classify_complaint(
        self,
        db:          Session,
        text:        str,
        category_id: int,       # manual category from user input — fallback
    ) -> AIClassificationResult:
        """
        Classify a single complaint text and resolve the best category.

        Args:
            db:          SQLAlchemy session (for category lookup)
            text:        Combined complaint title + description
            category_id: Manual category_id chosen by the user

        Returns:
            AIClassificationResult with resolved_category_id always set.
            Never raises.
        """
        fallback = AIClassificationResult(
            ai_label             = None,
            ai_confidence        = 0.0,
            resolved_category_id = category_id,
            used_ai              = False,
            fallback_reason      = "AI not run",
        )

        text = (text or "").strip()
        if not text:
            fallback.fallback_reason = "Empty text — skipping AI"
            logger.debug("classify_complaint(): empty text, using manual category")
            return fallback

        # ── Run inference ─────────────────────────────────────────────────────
        try:
            clf = self._load_classifier()
            if clf is None or not clf.is_ready:
                fallback.fallback_reason = "Model not loaded"
                logger.info(
                    "classify_complaint(): model unavailable, using manual category_id=%d",
                    category_id,
                )
                return fallback

            prediction = clf.predict(text)

        except Exception as exc:
            logger.error("classify_complaint(): unexpected error: %s", exc, exc_info=True)
            fallback.fallback_reason = f"Inference error: {exc}"
            return fallback

        # ── Record AI prediction even if we don't apply it ───────────────────
        ai_label      = prediction.label
        ai_confidence = prediction.confidence

        if ai_label is None:
            fallback.fallback_reason = "Model returned no label"
            return fallback

        # ── Confidence gate ───────────────────────────────────────────────────
        if not prediction.is_confident:
            logger.info(
                "classify_complaint(): low confidence (%.4f) for label='%s' — "
                "keeping manual category_id=%d",
                ai_confidence, ai_label, category_id,
            )
            return AIClassificationResult(
                ai_label             = ai_label,       # store for audit
                ai_confidence        = ai_confidence,
                resolved_category_id = category_id,   # keep manual
                used_ai              = False,
                fallback_reason      = f"Low confidence ({ai_confidence:.4f} < threshold)",
            )

        # ── Resolve AI label to DB Category ──────────────────────────────────
        from ai_models.classification.labels import get_db_category_name

        db_category_name = get_db_category_name(ai_label)
        ai_category = (
            db.query(Category)
            .filter(Category.name == db_category_name)
            .first()
        )

        if ai_category is None:
            logger.warning(
                "classify_complaint(): AI label '%s' maps to DB name '%s' "
                "but no matching Category found — keeping manual category_id=%d",
                ai_label, db_category_name, category_id,
            )
            return AIClassificationResult(
                ai_label             = ai_label,
                ai_confidence        = ai_confidence,
                resolved_category_id = category_id,   # keep manual
                used_ai              = False,
                fallback_reason      = f"DB category '{db_category_name}' not found",
            )

        # ── Apply AI category ─────────────────────────────────────────────────
        logger.info(
            "classify_complaint(): AI applied — label='%s' confidence=%.4f "
            "→ category_id=%d (was manual: %d)",
            ai_label, ai_confidence, ai_category.id, category_id,
        )
        return AIClassificationResult(
            ai_label             = ai_label,
            ai_confidence        = ai_confidence,
            resolved_category_id = ai_category.id,
            used_ai              = True,
            fallback_reason      = "",
        )

    # ── Batch classification ──────────────────────────────────────────────────

    def classify_batch(
        self,
        db:           Session,
        texts:        list[str],
        category_ids: list[int],
    ) -> list[AIClassificationResult]:
        """
        Classify a batch of complaints.

        Args:
            db:           SQLAlchemy session
            texts:        List of combined title + description strings
            category_ids: List of manual fallback category IDs (same length as texts)

        Returns:
            List of AIClassificationResult, one per input.

        Use case: bulk re-classification of existing complaints for AI accuracy analysis.
        """
        if len(texts) != len(category_ids):
            raise ValueError("texts and category_ids must have the same length")

        if not texts:
            return []

        # ── Run batch inference ───────────────────────────────────────────────
        try:
            clf = self._load_classifier()
            if clf is None or not clf.is_ready:
                logger.info(
                    "classify_batch(): model not loaded — returning manual fallbacks for %d texts",
                    len(texts),
                )
                return [
                    AIClassificationResult(
                        resolved_category_id = cat_id,
                        fallback_reason      = "Model not loaded",
                    )
                    for cat_id in category_ids
                ]

            predictions = clf.predict_batch(texts)

        except Exception as exc:
            logger.error("classify_batch(): inference failed: %s", exc, exc_info=True)
            return [
                AIClassificationResult(
                    resolved_category_id = cat_id,
                    fallback_reason      = f"Inference error: {exc}",
                )
                for cat_id in category_ids
            ]

        # ── Build results — one DB query per unique resolved category name ────
        from ai_models.classification.labels import get_db_category_name

        # Pre-fetch all categories needed
        needed_names = set()
        for pred in predictions:
            if pred.label and pred.is_confident:
                needed_names.add(get_db_category_name(pred.label))

        cat_by_name: dict[str, Category] = {}
        if needed_names:
            rows = db.query(Category).filter(Category.name.in_(needed_names)).all()
            cat_by_name = {c.name: c for c in rows}

        results: list[AIClassificationResult] = []
        for i, (pred, cat_id) in enumerate(zip(predictions, category_ids)):
            if pred.label is None:
                results.append(AIClassificationResult(
                    resolved_category_id = cat_id,
                    fallback_reason      = "Model returned no label",
                ))
                continue

            if not pred.is_confident:
                results.append(AIClassificationResult(
                    ai_label             = pred.label,
                    ai_confidence        = pred.confidence,
                    resolved_category_id = cat_id,
                    used_ai              = False,
                    fallback_reason      = f"Low confidence ({pred.confidence:.4f})",
                ))
                continue

            db_name    = get_db_category_name(pred.label)
            ai_cat     = cat_by_name.get(db_name)
            used_cat_id = ai_cat.id if ai_cat else cat_id

            results.append(AIClassificationResult(
                ai_label             = pred.label,
                ai_confidence        = pred.confidence,
                resolved_category_id = used_cat_id,
                used_ai              = ai_cat is not None,
                fallback_reason      = "" if ai_cat else f"DB category '{db_name}' not found",
            ))

        logger.info(
            "classify_batch(): %d/%d used AI, %d fallbacks",
            sum(1 for r in results if r.used_ai),
            len(results),
            sum(1 for r in results if not r.used_ai),
        )
        return results


# ── Module-level singleton ────────────────────────────────────────────────────
ai_classification_service = AIClassificationService()
