"""
ai_models/duplicate_detection/duplicate_detector.py — DuplicateDetector

Orchestrates the three-stage duplicate detection pipeline:

  Stage 1 — DB Filter (SQL)
    • Same ward_id
    • Same category_id
    • Created within last N days (default: 90)
    • Status is not REJECTED/RESOLVED (still active)

  Stage 2 — Geographic Filter (Haversine)
    • Within 100 metres of the new complaint

  Stage 3 — Semantic Filter (cosine similarity)
    • Embedding cosine similarity >= 0.85

Returns the best match (highest similarity score above threshold),
or None if no duplicate is found.

Architecture notes:
  - Never compares against all complaints — always ward+date-filtered first.
  - Batch cosine similarity using NumPy for efficiency.
  - Graceful degradation — if embeddings unavailable, returns no duplicate.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ai_models.duplicate_detection.similarity_service import (
    DISTANCE_THRESHOLD_M,
    SIMILARITY_THRESHOLD,
    cosine_similarity_batch,
    is_semantically_similar,
    passes_geo_filter,
)
from ai_models.duplicate_detection.embedding_service import (
    deserialise_embedding,
    is_embedding_available,
)

logger = logging.getLogger(__name__)

_LOOKBACK_DAYS: int = 90


# ═══════════════════════════════════════════════════════════════════════════════
# Result
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DuplicateMatch:
    """
    Represents a detected duplicate match.

    Fields:
      matched_complaint_id — ID of the existing complaint
      duplicate_group_id   — Shared group UUID (use existing if matched has one)
      similarity_score     — Cosine similarity (0.85–1.0)
      distance_m           — GPS distance in metres
    """
    matched_complaint_id: str
    duplicate_group_id:   str
    similarity_score:     float
    distance_m:           float

    def __repr__(self) -> str:
        return (
            f"<DuplicateMatch id={self.matched_complaint_id!r} "
            f"sim={self.similarity_score:.4f} dist={self.distance_m:.1f}m>"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Detector
# ═══════════════════════════════════════════════════════════════════════════════

class DuplicateDetector:
    """
    Three-stage duplicate detector for civic complaints.

    Usage:
        detector = DuplicateDetector()

        match = detector.detect(
            db          = db_session,
            complaint_id= new_complaint_id,
            category_id = resolved_category_id,
            ward_id     = detected_ward_id,
            latitude    = 12.9716,
            longitude   = 77.5946,
            embedding   = [0.12, -0.34, ...],   # 384-dim
        )

        if match:
            complaint.duplicate_group_id   = match.duplicate_group_id
            complaint.matched_complaint_id = match.matched_complaint_id
            complaint.similarity_score     = match.similarity_score
    """

    def detect(
        self,
        db:           Session,
        complaint_id: str,
        category_id:  int,
        ward_id:      Optional[int],
        latitude:     float,
        longitude:    float,
        embedding:    Optional[list[float]],
        lookback_days:int = _LOOKBACK_DAYS,
    ) -> Optional[DuplicateMatch]:
        """
        Run the full three-stage duplicate detection pipeline.

        Returns:
            DuplicateMatch — best match, or None if no duplicate found.
        """
        if not is_embedding_available():
            logger.debug("detect(): SBERT not available — skipping duplicate detection")
            return None

        if embedding is None:
            logger.debug("detect(): no embedding for complaint %s — skipping", complaint_id)
            return None

        # ── Stage 1: DB-level candidate filtering ───────────────────────────
        candidates = self._fetch_candidates(
            db           = db,
            exclude_id   = complaint_id,
            category_id  = category_id,
            ward_id      = ward_id,
            lookback_days= lookback_days,
        )

        if not candidates:
            logger.debug("detect(): 0 candidates after DB filter for ward=%s cat=%s", ward_id, category_id)
            return None

        logger.debug("detect(): %d candidates after DB filter", len(candidates))

        # ── Stage 2: Geographic filter (Haversine) ──────────────────────────
        geo_passed = []
        for c in candidates:
            if c["latitude"] is None or c["longitude"] is None:
                continue
            passes, dist = passes_geo_filter(c["latitude"], c["longitude"], latitude, longitude)
            if passes:
                geo_passed.append({**c, "_dist_m": dist})

        if not geo_passed:
            logger.debug("detect(): 0 candidates within %dm", DISTANCE_THRESHOLD_M)
            return None

        logger.debug("detect(): %d candidates within %dm", len(geo_passed), DISTANCE_THRESHOLD_M)

        # ── Stage 3: Semantic similarity (batch cosine) ──────────────────────
        candidate_vecs = []
        valid_candidates = []
        for c in geo_passed:
            vec = deserialise_embedding(c["embedding"]) if c.get("embedding") else None
            if vec is not None:
                candidate_vecs.append(vec)
                valid_candidates.append(c)

        if not candidate_vecs:
            logger.debug("detect(): no stored embeddings in geo-filtered candidates")
            return None

        scores = cosine_similarity_batch(embedding, candidate_vecs)

        # Find best match above threshold
        best_score = -1.0
        best_candidate = None
        for c, score in zip(valid_candidates, scores):
            if is_semantically_similar(score) and score > best_score:
                best_score     = score
                best_candidate = c

        if best_candidate is None:
            logger.info(
                "detect(): no duplicate found — best score=%.4f (threshold=%.2f)",
                max(scores) if scores else 0.0,
                SIMILARITY_THRESHOLD,
            )
            return None

        # ── Assign / inherit duplicate_group_id ─────────────────────────────
        group_id = (
            best_candidate.get("duplicate_group_id")
            or str(uuid.uuid4())
        )

        match = DuplicateMatch(
            matched_complaint_id = best_candidate["id"],
            duplicate_group_id   = group_id,
            similarity_score     = round(best_score, 6),
            distance_m           = round(best_candidate["_dist_m"], 2),
        )

        logger.info(
            "detect(): DUPLICATE FOUND — matched=%s sim=%.4f dist=%.1fm group=%s",
            match.matched_complaint_id,
            match.similarity_score,
            match.distance_m,
            match.duplicate_group_id,
        )
        return match

    # ── DB Query ─────────────────────────────────────────────────────────────

    def _fetch_candidates(
        self,
        db:            Session,
        exclude_id:    str,
        category_id:   int,
        ward_id:       Optional[int],
        lookback_days: int,
    ) -> list[dict]:
        """
        Stage 1: Fetch geo-filtered complaint candidates from DB.

        Filters:
          - Different complaint (exclude_id)
          - Same category
          - Same ward (skip ward filter if None — GPS not resolved)
          - Created within lookback_days
          - Status not REJECTED or RESOLVED
          - Has an embedding stored

        Returns:
            list of dicts with keys: id, latitude, longitude, duplicate_group_id, embedding
        """
        from sqlalchemy import text

        # Build ward filter
        ward_clause = "AND c.ward_id = :ward_id" if ward_id is not None else ""

        sql = text(f"""
            SELECT
                c.id,
                c.duplicate_group_id,
                l.latitude,
                l.longitude,
                ce.embedding
            FROM complaints c
            JOIN locations l
                ON l.id = c.location_id
            JOIN complaint_embeddings ce
                ON ce.complaint_id = c.id
            WHERE
                c.id            != :exclude_id
                AND c.category_id = :category_id
                {ward_clause}
                AND c.created_at  >= :since
                AND c.status NOT IN ('rejected', 'resolved')
            ORDER BY c.created_at DESC
            LIMIT 200
        """)

        since = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        params = {
            "exclude_id":  exclude_id,
            "category_id": category_id,
            "since":       since,
        }
        if ward_id is not None:
            params["ward_id"] = ward_id

        try:
            rows = db.execute(sql, params).mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:
            logger.error("_fetch_candidates() DB error: %s", exc, exc_info=True)
            return []


# ── Module-level singleton ────────────────────────────────────────────────────
duplicate_detector = DuplicateDetector()
