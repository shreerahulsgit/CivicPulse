"""
ai_models/duplicate_detection/similarity_service.py — Similarity Calculations

Provides:
  1. Haversine distance  — geographic filtering (meters)
  2. Cosine similarity   — semantic comparison of SBERT embeddings
  3. Candidate filtering helpers

All functions are pure Python / NumPy — no database access.
They are called by duplicate_detector.py after candidates are fetched from DB.
"""

import logging
import math
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
EARTH_RADIUS_M: float = 6_371_000.0   # metres
DISTANCE_THRESHOLD_M: float = 100.0   # 100 metres
SIMILARITY_THRESHOLD: float = 0.85    # cosine similarity cutoff


# ═══════════════════════════════════════════════════════════════════════════════
# Geographic distance
# ═══════════════════════════════════════════════════════════════════════════════

def haversine_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
) -> float:
    """
    Compute great-circle distance between two GPS coordinates in metres.

    Uses the Haversine formula:
        a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
        c = 2·atan2(√a, √(1−a))
        d = R·c

    Args:
        lat1, lon1: origin coordinates (degrees)
        lat2, lon2: destination coordinates (degrees)

    Returns:
        Distance in metres (float).
    """
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlat   = math.radians(lat2 - lat1)
    dlon   = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_M * c


def is_within_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
    threshold_m: float = DISTANCE_THRESHOLD_M,
) -> bool:
    """Return True if two coordinates are within `threshold_m` metres."""
    return haversine_distance(lat1, lon1, lat2, lon2) <= threshold_m


# ═══════════════════════════════════════════════════════════════════════════════
# Semantic similarity
# ═══════════════════════════════════════════════════════════════════════════════

def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Compute cosine similarity between two embedding vectors.

    Since all-MiniLM-L6-v2 embeddings are L2-normalised by default
    (normalize_embeddings=True in embed_text), cosine similarity
    reduces to a simple dot product.

    Returns value in [0.0, 1.0] (clipped for numerical stability).
    """
    if not vec_a or not vec_b:
        return 0.0

    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    score = float(np.dot(a, b) / (norm_a * norm_b))
    return float(np.clip(score, 0.0, 1.0))


def cosine_similarity_batch(
    query_vec: list[float],
    candidate_vecs: list[list[float]],
) -> list[float]:
    """
    Compute cosine similarity between one query vector and many candidates
    in a single vectorised NumPy operation.

    Args:
        query_vec:      384-dim embedding for the new complaint
        candidate_vecs: list of 384-dim embeddings for candidate complaints

    Returns:
        list of float similarity scores, same length as candidate_vecs.
    """
    if not candidate_vecs:
        return []

    q = np.array(query_vec, dtype=np.float32)
    C = np.array(candidate_vecs, dtype=np.float32)   # [N, 384]

    norm_q = np.linalg.norm(q)
    norm_C = np.linalg.norm(C, axis=1)               # [N]

    if norm_q == 0.0:
        return [0.0] * len(candidate_vecs)

    # Avoid division by zero
    safe_norms = np.where(norm_C == 0.0, 1.0, norm_C)
    scores = (C @ q) / (safe_norms * norm_q)          # [N]
    return np.clip(scores, 0.0, 1.0).tolist()


def is_semantically_similar(
    score: float,
    threshold: float = SIMILARITY_THRESHOLD,
) -> bool:
    """Return True if cosine score meets or exceeds the duplicate threshold."""
    return score >= threshold


# ═══════════════════════════════════════════════════════════════════════════════
# Combined filter
# ═══════════════════════════════════════════════════════════════════════════════

def passes_geo_filter(
    candidate_lat: float, candidate_lon: float,
    query_lat: float, query_lon: float,
) -> tuple[bool, float]:
    """
    Check if a candidate passes the geographic distance filter.

    Returns:
        (passes: bool, distance_m: float)
    """
    dist = haversine_distance(query_lat, query_lon, candidate_lat, candidate_lon)
    return (dist <= DISTANCE_THRESHOLD_M, dist)
