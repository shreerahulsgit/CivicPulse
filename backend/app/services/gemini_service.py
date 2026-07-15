"""
services/gemini_service.py — Gemini AI Integration (google-genai SDK)

Provides two features powered by Google Gemini:

1. classify_complaint(title, description, categories)
   → returns {category_id, category_name, priority, confidence, ai_summary, used_ai}

2. detect_duplicates(db, title, description, ward_id)
   → returns {is_duplicate, matched_complaint_id, similarity_score, used_ai}

Design:
  - Never raises — all errors are caught and logged.
  - Falls back gracefully when Gemini is unavailable.
  - Priority is 1 (low) → 10 (high).
  - Uses gemini-2.5-flash for better JSON instruction following.
"""

import json
import logging
import os
import re
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

_GEMINI_KEY     = os.getenv("GEMINI_API_KEY", "")
_GEMINI_ENABLED = os.getenv("GEMINI_ENABLED", "false").lower() == "true"
_MODEL          = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# ── Lazy client ───────────────────────────────────────────────────────────────

_client = None

def _get_client():
    global _client
    if _client is not None:
        return _client
    if not _GEMINI_ENABLED or not _GEMINI_KEY:
        logger.info("Gemini disabled or no key set (GEMINI_ENABLED=%s, key_set=%s)",
                    _GEMINI_ENABLED, bool(_GEMINI_KEY))
        return None
    try:
        from google import genai
        client = genai.Client(api_key=_GEMINI_KEY)
        _client = client
        logger.info("Gemini client initialized (model=%s)", _MODEL)
        return _client
    except Exception as exc:
        logger.warning("Could not init Gemini client: %s", exc)
        return None


def _generate(prompt: str) -> str | None:
    """Call Gemini and return raw text, or None on error."""
    client = _get_client()
    if client is None:
        return None
    try:
        from google import genai as _genai
        response = client.models.generate_content(
            model=_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()
        logger.debug("Gemini raw response (first 300): %s", raw[:300])
        return raw
    except Exception as exc:
        logger.error("Gemini generate_content error: %s", exc, exc_info=True)
        return None


def _parse_json(text: str) -> dict | None:
    """
    Robustly extract and parse a JSON object from Gemini output.
    Handles:
      - Raw JSON
      - ```json ... ``` fences
      - ``` ... ``` fences
      - JSON buried inside other text (finds first { ... })
    """
    if not text:
        return None

    t = text.strip()

    # 1. Try raw parse first
    try:
        return json.loads(t)
    except Exception:
        pass

    # 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    if fence_match:
        try:
            return json.loads(fence_match.group(1).strip())
        except Exception:
            pass

    # 3. Find the first complete JSON object in the text
    brace_match = re.search(r"\{[\s\S]*\}", t)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except Exception:
            pass

    logger.warning("_parse_json: could not extract JSON from: %s", t[:300])
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Complaint Classification
# ═══════════════════════════════════════════════════════════════════════════════

def classify_complaint(
    title:       str,
    description: str,
    categories:  list[dict],   # [{"id": 1, "name": "Roads & Bridges"}, ...]
) -> dict:
    """
    Ask Gemini to classify the complaint and assign a severity/priority score.

    Returns:
        {
            "category_id":   int | None,
            "category_name": str | None,
            "priority":      int,        # 1-10
            "confidence":    float,
            "ai_summary":    str,
            "used_ai":       bool,
        }
    """
    fallback = {
        "category_id": None, "category_name": None,
        "priority": 5, "confidence": 0.0,
        "ai_summary": "", "used_ai": False,
    }

    if not title:
        return fallback

    cat_list = "\n".join(f'  - id={c["id"]}: {c["name"]}' for c in categories)

    prompt = f"""You are a civic complaint classifier for Chennai Municipal Corporation (India).

TASK: Classify the complaint and estimate its severity.

Available categories:
{cat_list}

Complaint Title: {title}
Complaint Description: {description or 'N/A'}

Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{{
  "category_id": <integer id from the list above>,
  "category_name": "<exact name from the list>",
  "priority": <integer 1-10>,
  "confidence": <float 0.0-1.0>,
  "ai_summary": "<one concise sentence describing the issue>"
}}

Severity scale for priority (be precise — do NOT default to 5):
- 10:  Immediate life threat (gas leak, building collapse, electrocution risk)
- 8-9: Major hazard (open manhole, sewage overflow, downed power line)
- 6-7: Significant disruption (large pothole, broken street light on main road, water supply cut)
- 4-5: Moderate issue (pavement crack, garbage overflow, minor waterlogging)
- 2-3: Minor inconvenience (overgrown tree, faded road marking, noise complaint)
- 1:   Informational / very minor

Think carefully about the severity. A complaint about a dangerous open manhole should be 9, not 5."""

    text = _generate(prompt)
    if not text:
        logger.warning("classify_complaint: Gemini returned no text for title=%r", title)
        return fallback

    data = _parse_json(text)
    if not data:
        logger.warning("classify_complaint: failed to parse JSON. Raw=%s", text[:300])
        return fallback

    # Log what Gemini actually decided
    logger.info(
        "classify_complaint: title=%r → category=%r priority=%s confidence=%s",
        title, data.get("category_name"), data.get("priority"), data.get("confidence"),
    )

    valid_ids = {c["id"] for c in categories}
    cat_id = data.get("category_id")
    if cat_id not in valid_ids:
        cat_id = None

    priority = data.get("priority", 5)
    try:
        priority = int(priority)
    except (TypeError, ValueError):
        priority = 5
    priority = max(1, min(10, priority))

    confidence = data.get("confidence", 0.8)
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.8
    confidence = max(0.0, min(1.0, confidence))

    return {
        "category_id":   cat_id,
        "category_name": data.get("category_name"),
        "priority":      priority,
        "confidence":    confidence,
        "ai_summary":    str(data.get("ai_summary", "")),
        "used_ai":       True,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Duplicate Detection
# ═══════════════════════════════════════════════════════════════════════════════

def detect_duplicates(
    db:          Session,
    title:       str,
    description: str,
    ward_id:     Optional[int],
) -> dict:
    """
    Check if a new complaint is a duplicate of existing open complaints.

    Returns:
        {
            "is_duplicate":           bool,
            "matched_complaint_id":   str | None,
            "similarity_score":       float | None,
            "used_ai":                bool,
        }
    """
    fallback = {
        "is_duplicate": False,
        "matched_complaint_id": None,
        "similarity_score": None,
        "used_ai": False,
    }

    if _get_client() is None:
        return fallback

    try:
        from app.models.complaint import Complaint, ComplaintStatus
        from sqlalchemy import desc

        q = db.query(Complaint).filter(
            Complaint.status.notin_([ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED])
        )
        if ward_id:
            q = q.filter(Complaint.ward_id == ward_id)

        recent = q.order_by(desc(Complaint.created_at)).limit(15).all()
        if not recent:
            return fallback

        candidates = "\n".join(
            f'  id="{c.id}" | "{c.title}" — {(c.description or "")[:100]}'
            for c in recent
        )
    except Exception as exc:
        logger.error("detect_duplicates: DB fetch error: %s", exc)
        return fallback

    prompt = f"""You are a deduplication assistant for a civic complaint system.

New complaint:
  Title: {title}
  Description: {(description or '')[:300]}

Existing open complaints in the same area:
{candidates}

Is the new complaint describing the SAME physical issue at the SAME location as any existing complaint?

Return ONLY raw JSON (no markdown, no code fences):
{{
  "is_duplicate": true or false,
  "matched_complaint_id": "<id string from list above, or null>",
  "similarity_score": <float 0.0-1.0, or null if not duplicate>
}}

Only flag as duplicate if clearly the SAME issue at the SAME location. Set is_duplicate=false if unsure."""

    text = _generate(prompt)
    if not text:
        return fallback

    data = _parse_json(text)
    if not data:
        return fallback

    return {
        "is_duplicate":         bool(data.get("is_duplicate", False)),
        "matched_complaint_id": data.get("matched_complaint_id"),
        "similarity_score":     data.get("similarity_score"),
        "used_ai":              True,
    }


# ── Availability check ────────────────────────────────────────────────────────

def is_available() -> bool:
    return _get_client() is not None
