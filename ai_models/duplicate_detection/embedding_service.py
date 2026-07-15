"""
ai_models/duplicate_detection/embedding_service.py — Sentence-BERT Embedding Service

Generates dense vector embeddings from complaint text using the
all-MiniLM-L6-v2 SentenceTransformer model.

Model specs:
  - Model:     all-MiniLM-L6-v2
  - Dims:      384
  - Max tokens: 256 (handles most complaint descriptions)
  - Similarity: cosine similarity (optimised for this model)

Environment Variables:
  SBERT_MODEL_NAME    — HuggingFace model ID or local path
                        Default: "all-MiniLM-L6-v2"
  SBERT_DEVICE        — "cpu" | "cuda" | "mps"  (Default: "cpu")
  AI_MODEL_ENABLED    — "true" | "false"  (shared with classifier)

Caching:
  Singleton pattern — model loaded once and reused across requests.
  Thread-safe for concurrent inference after initial load.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

EMBEDDING_DIM: int = 384   # all-MiniLM-L6-v2 output dimension


# ═══════════════════════════════════════════════════════════════════════════════
# Model Holder (Singleton)
# ═══════════════════════════════════════════════════════════════════════════════

class _SBERTHolder:
    """Internal singleton holding the loaded SentenceTransformer instance."""

    _model = None
    _loaded: bool = False
    _failed: bool = False

    @classmethod
    def get_model(cls):
        if cls._loaded:
            return cls._model
        if cls._failed:
            return None
        return cls._load()

    @classmethod
    def _load(cls):
        enabled = os.getenv("AI_MODEL_ENABLED", "true").lower()
        if enabled == "false":
            logger.info("SBERT embedding disabled via AI_MODEL_ENABLED=false")
            cls._failed = True
            return None

        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            logger.warning(
                "sentence-transformers not installed — duplicate detection disabled. "
                "Install with: pip install sentence-transformers"
            )
            cls._failed = True
            return None

        model_name = os.getenv("SBERT_MODEL_NAME", "all-MiniLM-L6-v2")
        device     = os.getenv("SBERT_DEVICE", "cpu")

        try:
            logger.info("Loading SBERT model: %s on %s", model_name, device)
            model = SentenceTransformer(model_name, device=device)
            cls._model  = model
            cls._loaded = True
            logger.info("SBERT model loaded: %s (%d dims)", model_name, EMBEDDING_DIM)
            return model
        except Exception as exc:
            logger.warning("Failed to load SBERT model '%s': %s", model_name, exc)
            cls._failed = True
            return None

    @classmethod
    def reset(cls) -> None:
        """Reset for tests."""
        cls._model  = None
        cls._loaded = False
        cls._failed = False


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════

def is_embedding_available() -> bool:
    """Return True if SBERT model is (or can be) loaded."""
    return _SBERTHolder.get_model() is not None


def embed_text(text: str) -> Optional[list[float]]:
    """
    Generate a 384-dim embedding for a single text string.

    Args:
        text: complaint title + description (already concatenated)

    Returns:
        list of 384 floats, or None if model unavailable.
    """
    model = _SBERTHolder.get_model()
    if model is None:
        return None

    text = (text or "").strip()
    if not text:
        logger.debug("embed_text(): empty text — returning None")
        return None

    try:
        vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
        return vec.tolist()
    except Exception as exc:
        logger.error("embed_text() failed: %s", exc, exc_info=True)
        return None


def embed_batch(texts: list[str]) -> list[Optional[list[float]]]:
    """
    Generate embeddings for a batch of texts in a single forward pass.

    Args:
        texts: list of complaint strings (title + description)

    Returns:
        list[Optional[list[float]]] — None for empty/failed texts.
        Preserves input order.
    """
    model = _SBERTHolder.get_model()
    if model is None:
        return [None] * len(texts)

    cleaned = [(i, t.strip()) for i, t in enumerate(texts) if t.strip()]
    if not cleaned:
        return [None] * len(texts)

    indices, valid_texts = zip(*cleaned)

    try:
        vecs = model.encode(
            list(valid_texts),
            convert_to_numpy     = True,
            normalize_embeddings = True,
            batch_size           = 32,
            show_progress_bar    = False,
        )
        results: list[Optional[list[float]]] = [None] * len(texts)
        for i, idx in enumerate(indices):
            results[idx] = vecs[i].tolist()
        return results
    except Exception as exc:
        logger.error("embed_batch() failed: %s", exc, exc_info=True)
        return [None] * len(texts)


def serialise_embedding(vec: list[float]) -> str:
    """Serialise float list to compact JSON string for DB storage."""
    return json.dumps(vec, separators=(",", ":"))


def deserialise_embedding(raw: str) -> Optional[list[float]]:
    """Deserialise JSON string from DB back to float list."""
    try:
        return json.loads(raw)
    except Exception as exc:
        logger.error("deserialise_embedding() failed: %s", exc)
        return None
