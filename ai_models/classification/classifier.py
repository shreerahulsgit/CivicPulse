"""
ai_models/classification/classifier.py — ComplaintClassifier

The primary inference interface. Wraps ModelLoader to provide:
  - predict(text)          → ClassificationResult
  - predict_batch(texts)   → list[ClassificationResult]

Architecture:
  Input text → AutoTokenizer → DistilBERT encoder → classification head
                             → softmax → top-1 label + confidence score

  The classifier is ARCHITECTURE-ONLY at this point. The model will produce
  random predictions until fine-tuned on labeled civic complaint data.
  See ai_models/training/README.md for the training pipeline.

ClassificationResult fields:
  label:       str    — predicted category label (from labels.LABELS)
  confidence:  float  — softmax probability 0.0–1.0
  all_scores:  dict   — {label: score} for all classes (for debugging)
  is_confident: bool  — True if confidence >= CONFIDENCE_THRESHOLD

Fallback behaviour:
  If the model is not loaded (disabled, missing, or errored):
  - predict()       returns ClassificationResult with label=None
  - predict_batch() returns a list of None-labelled results
  This allows the service layer to fall back gracefully to the manual category.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from ai_models.classification.labels import (
    CONFIDENCE_THRESHOLD,
    LABELS,
    id2label,
)
from ai_models.classification.model_loader import ModelLoader

logger = logging.getLogger(__name__)

# Max token length for BERT-family models
_MAX_LENGTH: int = 512


# ═══════════════════════════════════════════════════════════════════════════════
# Result dataclass
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ClassificationResult:
    """
    Output of a single complaint classification.

    Fields:
      label        — Top-1 predicted AI category label, or None on failure.
      confidence   — Probability of the top-1 class (0.0–1.0).
      all_scores   — Full softmax distribution over all classes.
      is_confident — True if confidence >= CONFIDENCE_THRESHOLD.
      model_used   — True if the AI model ran; False if it was a fallback/error.
    """
    label:        Optional[str]        = None
    confidence:   float                = 0.0
    all_scores:   dict[str, float]     = field(default_factory=dict)
    is_confident: bool                 = False
    model_used:   bool                 = False

    def as_dict(self) -> dict:
        return {
            "label":        self.label,
            "confidence":   round(self.confidence, 4),
            "is_confident": self.is_confident,
            "model_used":   self.model_used,
            "all_scores":   {k: round(v, 4) for k, v in self.all_scores.items()},
        }


# ── Fallback result (model not available) ────────────────────────────────────
_FALLBACK_RESULT = ClassificationResult(
    label        = None,
    confidence   = 0.0,
    all_scores   = {},
    is_confident = False,
    model_used   = False,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Classifier
# ═══════════════════════════════════════════════════════════════════════════════

class ComplaintClassifier:
    """
    Inference engine for civic complaint text classification.

    Usage:
        classifier = ComplaintClassifier()
        classifier.load_model()          # idempotent — safe to call multiple times

        result = classifier.predict("Large pothole on MG Road near signal")
        if result.is_confident:
            print(result.label)          # "Pothole"
            print(result.confidence)     # 0.934

        batch = classifier.predict_batch([text1, text2, text3])
    """

    def __init__(self) -> None:
        self._loader = ModelLoader.instance()

    # ── Model management ─────────────────────────────────────────────────────

    def load_model(self) -> bool:
        """
        Load the model (idempotent). Returns True if model is ready.
        Safe to call at application startup — failures are logged, not raised.
        """
        return self._loader.load()

    @property
    def is_ready(self) -> bool:
        """True if the model is loaded and ready for inference."""
        return self._loader.is_loaded

    # ── Inference ────────────────────────────────────────────────────────────

    def predict(self, text: str) -> ClassificationResult:
        """
        Classify a single complaint text.

        Steps:
          1. Ensure model is loaded (attempt lazy load if not yet tried).
          2. Tokenize input (truncated to MAX_LENGTH=512 tokens).
          3. Forward pass through DistilBERT + classification head.
          4. Apply softmax to logits.
          5. Return top-1 label + full score distribution.

        Returns _FALLBACK_RESULT if model is unavailable or inference fails.
        Never raises — exceptions are caught and logged.
        """
        if not self._ensure_ready():
            return _FALLBACK_RESULT

        text = text.strip()
        if not text:
            logger.warning("predict() called with empty text — returning fallback")
            return _FALLBACK_RESULT

        try:
            import torch

            tokenizer = self._loader.tokenizer
            model     = self._loader.model
            device    = self._loader.device

            inputs = tokenizer(
                text,
                return_tensors    = "pt",
                truncation        = True,
                padding           = True,
                max_length        = _MAX_LENGTH,
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                logits = model(**inputs).logits

            probs      = torch.softmax(logits, dim=-1).squeeze()
            top_idx    = int(probs.argmax())
            confidence = float(probs[top_idx])
            label      = id2label[top_idx]

            all_scores = {
                id2label[i]: float(probs[i])
                for i in range(len(LABELS))
            }

            result = ClassificationResult(
                label        = label,
                confidence   = confidence,
                all_scores   = all_scores,
                is_confident = confidence >= CONFIDENCE_THRESHOLD,
                model_used   = True,
            )

            logger.debug(
                "predict(): text='%.60s...' → label='%s' confidence=%.4f",
                text, label, confidence,
            )
            return result

        except Exception as exc:
            logger.error("predict() inference failed: %s", exc, exc_info=True)
            return _FALLBACK_RESULT

    def predict_batch(self, texts: list[str]) -> list[ClassificationResult]:
        """
        Classify a batch of complaint texts in a single forward pass.

        For efficiency, all texts are tokenized together with padding.
        Empty texts are replaced with a placeholder and get fallback results.

        Args:
            texts: List of complaint description strings.

        Returns:
            List of ClassificationResult, one per input text.
            Results are in the same order as the input.
        """
        if not texts:
            return []

        if not self._ensure_ready():
            return [_FALLBACK_RESULT] * len(texts)

        # Track which indices are valid (non-empty)
        valid_indices = [i for i, t in enumerate(texts) if t.strip()]
        valid_texts   = [texts[i].strip() for i in valid_indices]

        if not valid_texts:
            return [_FALLBACK_RESULT] * len(texts)

        try:
            import torch

            tokenizer = self._loader.tokenizer
            model     = self._loader.model
            device    = self._loader.device

            inputs = tokenizer(
                valid_texts,
                return_tensors = "pt",
                truncation     = True,
                padding        = True,
                max_length     = _MAX_LENGTH,
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                logits = model(**inputs).logits

            probs = torch.softmax(logits, dim=-1)  # [batch, num_labels]

            # Build result list in original order
            results: list[ClassificationResult] = [_FALLBACK_RESULT] * len(texts)

            for batch_idx, orig_idx in enumerate(valid_indices):
                row        = probs[batch_idx]
                top_idx    = int(row.argmax())
                confidence = float(row[top_idx])
                label      = id2label[top_idx]

                all_scores = {
                    id2label[i]: float(row[i])
                    for i in range(len(LABELS))
                }

                results[orig_idx] = ClassificationResult(
                    label        = label,
                    confidence   = confidence,
                    all_scores   = all_scores,
                    is_confident = confidence >= CONFIDENCE_THRESHOLD,
                    model_used   = True,
                )

            logger.info(
                "predict_batch(): %d/%d texts classified successfully",
                len(valid_indices), len(texts),
            )
            return results

        except Exception as exc:
            logger.error("predict_batch() inference failed: %s", exc, exc_info=True)
            return [_FALLBACK_RESULT] * len(texts)

    # ── Internals ────────────────────────────────────────────────────────────

    def _ensure_ready(self) -> bool:
        """Lazy-load the model if not yet loaded. Returns True if ready."""
        if not self._loader.is_loaded:
            self._loader.load()
        return self._loader.is_loaded


# ── Module-level singleton ────────────────────────────────────────────────────
# Import this in services that need inference.
classifier = ComplaintClassifier()
