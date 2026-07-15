"""
ai_models/classification/model_loader.py — HuggingFace Model Loader

Handles loading (and lazy-caching) the fine-tuned sequence classification
model and its tokenizer from disk or HuggingFace Hub.

Architecture:
  - Model:     AutoModelForSequenceClassification
  - Tokenizer: AutoTokenizer
  - Base model: distilbert-base-uncased (lightweight, fast inference)
  - Fine-tuned on: civic complaint text (to be trained — see training/README)

Environment Variables:
  AI_MODEL_PATH       — local path OR HuggingFace Hub model ID
                        Default: "distilbert-base-uncased"
  AI_DEVICE           — "cpu" | "cuda" | "mps"  (Default: "cpu")
  AI_MODEL_ENABLED    — "true" | "false"  (Default: "true")
                        Set to "false" to disable AI and always use manual category.

Caching:
  ModelLoader is a singleton. The first call to load() downloads/loads the model
  and caches it. Subsequent calls return the cached instance.

  Call ModelLoader.unload() to free GPU memory when shutting down.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Lazy imports — only resolved when model is actually loaded ────────────────
# This keeps startup fast when AI_MODEL_ENABLED=false.
_transformers_available: bool | None = None


def _check_transformers() -> bool:
    global _transformers_available
    if _transformers_available is None:
        try:
            import transformers  # noqa: F401
            _transformers_available = True
        except ImportError:
            _transformers_available = False
            logger.warning(
                "HuggingFace 'transformers' package not installed. "
                "AI classification will be disabled. "
                "Install with: pip install transformers torch"
            )
    return _transformers_available


# ═══════════════════════════════════════════════════════════════════════════════
# Model Loader — Singleton
# ═══════════════════════════════════════════════════════════════════════════════

class ModelLoader:
    """
    Singleton that owns the loaded tokenizer and model.
    Thread-safe for read-only inference after initial load.

    Usage:
        loader = ModelLoader.instance()
        if loader.is_loaded:
            tokenizer = loader.tokenizer
            model     = loader.model
    """

    _instance: Optional["ModelLoader"] = None

    def __init__(self) -> None:
        self._tokenizer = None
        self._model     = None
        self._device    = None
        self._loaded    = False
        self._failed    = False   # True after a failed load — skip retries

    # ── Singleton access ─────────────────────────────────────────────────────
    @classmethod
    def instance(cls) -> "ModelLoader":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset singleton — used in tests."""
        cls._instance = None

    # ── Properties ──────────────────────────────────────────────────────────
    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def tokenizer(self):
        return self._tokenizer

    @property
    def model(self):
        return self._model

    @property
    def device(self) -> str:
        return self._device or "cpu"

    # ── Load ─────────────────────────────────────────────────────────────────
    def load(self) -> bool:
        """
        Load tokenizer and model. Returns True on success, False on failure.

        Sequence:
          1. Check AI_MODEL_ENABLED env var — skip if disabled.
          2. Check transformers is installed — skip if missing.
          3. Determine device (CPU / CUDA / MPS).
          4. Load tokenizer from AI_MODEL_PATH.
          5. Load model with correct label config.
          6. Set model to eval mode and move to device.

        On any error: logs warning and returns False.
        The caller (classifier.py) interprets False as "use manual fallback".
        """
        if self._loaded:
            return True

        if self._failed:
            return False  # don't retry after a known failure

        # ── Check enabled ────────────────────────────────────────────────────
        enabled = os.getenv("AI_MODEL_ENABLED", "true").lower()
        if enabled == "false":
            logger.info("AI classification disabled via AI_MODEL_ENABLED=false")
            return False

        # ── Check transformers ───────────────────────────────────────────────
        if not _check_transformers():
            self._failed = True
            return False

        # ── Import lazily ────────────────────────────────────────────────────
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except ImportError as exc:
            logger.warning("Cannot import torch/transformers: %s", exc)
            self._failed = True
            return False

        # ── Config ───────────────────────────────────────────────────────────
        from ai_models.classification.labels import id2label, label2id, NUM_LABELS

        model_path = os.getenv("AI_MODEL_PATH", "distilbert-base-uncased")
        device_env = os.getenv("AI_DEVICE", "cpu")

        # Resolve best available device
        if device_env == "cuda" and torch.cuda.is_available():
            device = "cuda"
        elif device_env == "mps" and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        logger.info(
            "Loading AI model: path=%s device=%s num_labels=%d",
            model_path, device, NUM_LABELS,
        )

        # ── Load tokenizer ───────────────────────────────────────────────────
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_path)
        except Exception as exc:
            logger.warning("Failed to load tokenizer from '%s': %s", model_path, exc)
            self._failed = True
            return False

        # ── Load model ───────────────────────────────────────────────────────
        try:
            model = AutoModelForSequenceClassification.from_pretrained(
                model_path,
                num_labels    = NUM_LABELS,
                id2label      = id2label,
                label2id      = label2id,
                ignore_mismatched_sizes = True,  # OK for architecture-only loading
            )
            model.eval()
            model.to(device)
        except Exception as exc:
            logger.warning("Failed to load model from '%s': %s", model_path, exc)
            self._failed = True
            return False

        self._tokenizer = tokenizer
        self._model     = model
        self._device    = device
        self._loaded    = True

        logger.info(
            "AI model loaded ✓ — %s on %s",
            model.config.model_type, device,
        )
        return True

    # ── Unload ───────────────────────────────────────────────────────────────
    def unload(self) -> None:
        """Free model from memory (GPU/CPU). Safe to call multiple times."""
        if self._loaded:
            del self._model
            del self._tokenizer
            self._model     = None
            self._tokenizer = None
            self._loaded    = False
            self._failed    = False
            logger.info("AI model unloaded.")
