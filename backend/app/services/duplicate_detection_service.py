"""
services/duplicate_detection_service.py — Duplicate Detection Service Layer

Bridges the complaint creation pipeline with the AI duplicate detector.
Handles:
  1. Generating the SBERT embedding for a new complaint
  2. Persisting the embedding in complaint_embeddings table
  3. Running the three-stage duplicate detection pipeline
  4. Returning structured results for complaint_service.py to apply

Never raises — all exceptions are caught and logged.
Complaint creation continues normally even if duplicate detection fails.

Public API:
    service = DuplicateDetectionService()

    result = service.run(
        db           = db,
        complaint_id = "uuid-...",
        title        = "Large pothole on MG Road",
        description  = "...",
        category_id  = 3,
        ward_id      = 7,
        latitude     = 12.9716,
        longitude    = 77.5946,
    )

    # result.is_duplicate         → True / False
    # result.duplicate_group_id   → UUID string or None
    # result.matched_complaint_id → UUID string or None
    # result.similarity_score     → float or None
"""

import logging
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Result
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DuplicateDetectionResult:
    """
    Structured output of DuplicateDetectionService.run().

    Fields:
      is_duplicate          — True if a duplicate was detected
      duplicate_group_id    — Cluster UUID (set even for the first complaint in a group)
      matched_complaint_id  — ID of the matched original complaint, or None
      similarity_score      — Cosine similarity of best match, or None
      embedding_stored      — True if embedding was saved to DB
      skipped               — True if detection was skipped (AI disabled / error)
    """
    is_duplicate:          bool          = False
    duplicate_group_id:    Optional[str] = None
    matched_complaint_id:  Optional[str] = None
    similarity_score:      Optional[float] = None
    embedding_stored:      bool          = False
    skipped:               bool          = False


# ═══════════════════════════════════════════════════════════════════════════════
# Service
# ═══════════════════════════════════════════════════════════════════════════════

class DuplicateDetectionService:
    """
    Orchestrates embedding generation, persistence, and duplicate detection
    for complaint creation flow.
    """

    def run(
        self,
        db:           Session,
        complaint_id: str,
        title:        str,
        description:  str,
        category_id:  int,
        ward_id:      Optional[int],
        latitude:     float,
        longitude:    float,
    ) -> DuplicateDetectionResult:
        """
        Full duplicate detection pipeline for a newly-created complaint.

        Steps:
          1. Generate SBERT embedding from title + description
          2. Save embedding to complaint_embeddings table
          3. Run three-stage duplicate detector against DB candidates
          4. Return result for complaint_service to apply

        Returns DuplicateDetectionResult with skipped=True if AI is disabled.
        """
        # ── Step 1: Generate embedding ────────────────────────────────────────
        try:
            from ai_models.duplicate_detection.embedding_service import (
                embed_text,
                is_embedding_available,
                serialise_embedding,
            )
        except ImportError as exc:
            logger.warning("duplicate_detection_service: import failed: %s", exc)
            return DuplicateDetectionResult(skipped=True)

        if not is_embedding_available():
            logger.info(
                "duplicate_detection_service: SBERT not available — skipping for %s",
                complaint_id,
            )
            return DuplicateDetectionResult(skipped=True)

        text = f"{title} {description}".strip()
        embedding = embed_text(text)

        if embedding is None:
            logger.warning(
                "duplicate_detection_service: embedding returned None for %s",
                complaint_id,
            )
            return DuplicateDetectionResult(skipped=True)

        # ── Step 2: Persist embedding ─────────────────────────────────────────
        embedding_stored = False
        try:
            from app.models.complaint_embedding import ComplaintEmbedding

            emb_row = ComplaintEmbedding(
                id           = str(uuid.uuid4()),
                complaint_id = complaint_id,
                embedding    = serialise_embedding(embedding),
            )
            db.add(emb_row)
            db.flush()          # write before running detection so it's available to future queries
            embedding_stored = True
            logger.debug(
                "duplicate_detection_service: embedding persisted for %s", complaint_id
            )
        except Exception as exc:
            logger.error(
                "duplicate_detection_service: failed to save embedding for %s: %s",
                complaint_id, exc, exc_info=True,
            )
            # Continue — detection can still run with in-memory embedding

        # ── Step 3: Run duplicate detection ───────────────────────────────────
        try:
            from ai_models.duplicate_detection.duplicate_detector import duplicate_detector

            match = duplicate_detector.detect(
                db           = db,
                complaint_id = complaint_id,
                category_id  = category_id,
                ward_id      = ward_id,
                latitude     = latitude,
                longitude    = longitude,
                embedding    = embedding,
            )
        except Exception as exc:
            logger.error(
                "duplicate_detection_service: detector error for %s: %s",
                complaint_id, exc, exc_info=True,
            )
            return DuplicateDetectionResult(
                embedding_stored = embedding_stored,
                skipped          = True,
            )

        # ── Step 4: Build result ──────────────────────────────────────────────
        if match is None:
            return DuplicateDetectionResult(
                is_duplicate    = False,
                embedding_stored= embedding_stored,
            )

        return DuplicateDetectionResult(
            is_duplicate         = True,
            duplicate_group_id   = match.duplicate_group_id,
            matched_complaint_id = match.matched_complaint_id,
            similarity_score     = match.similarity_score,
            embedding_stored     = embedding_stored,
        )


# ── Module-level singleton ────────────────────────────────────────────────────
duplicate_detection_service = DuplicateDetectionService()
