"""
services/firebase_service.py -- Firebase Admin SDK integration

Verifies Firebase ID tokens issued by the frontend Google Sign-In flow.
The decoded token gives us: uid, email, name, picture.

Setup:
  1. Create a Firebase project at https://console.firebase.google.com
  2. Enable Google Sign-In under Authentication > Providers
  3. Download service account JSON: Project Settings > Service Accounts > Generate New Private Key
  4. Set FIREBASE_CREDENTIALS_PATH in backend/.env
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# ── Load config ──────────────────────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
load_dotenv(os.path.join(_BASE_DIR, ".env"))

_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "")

# ── Initialize Firebase Admin SDK ────────────────────────────────────────────────
_firebase_app = None

try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth, credentials

    def _init_firebase(cred_path: str) -> object:
        """Initialize Firebase app, reusing existing if already initialized."""
        try:
            # App already exists (uvicorn hot-reload) — reuse it
            return firebase_admin.get_app()
        except ValueError:
            pass  # App doesn't exist yet, create it
        cred = credentials.Certificate(cred_path)
        return firebase_admin.initialize_app(cred)

    if _CREDENTIALS_PATH and os.path.exists(_CREDENTIALS_PATH):
        _firebase_app = _init_firebase(_CREDENTIALS_PATH)
        logger.info("Firebase Admin SDK initialized: %s", _CREDENTIALS_PATH)
    elif _CREDENTIALS_PATH:
        abs_path = os.path.join(_BASE_DIR, _CREDENTIALS_PATH)
        if os.path.exists(abs_path):
            _firebase_app = _init_firebase(abs_path)
            logger.info("Firebase Admin SDK initialized: %s", abs_path)
        else:
            logger.warning(
                "FIREBASE_CREDENTIALS_PATH set but file not found: %s (or %s)",
                _CREDENTIALS_PATH, abs_path,
            )
    else:
        logger.warning(
            "FIREBASE_CREDENTIALS_PATH not set in .env. "
            "Google Sign-In will not work until configured."
        )
except ImportError:
    logger.error(
        "firebase-admin package not installed. "
        "Run: pip install firebase-admin"
    )
except Exception as e:
    logger.error("Firebase Admin SDK init failed: %s", e)


# ── Decoded token result ─────────────────────────────────────────────────────────

@dataclass
class FirebaseUser:
    """Decoded Firebase ID token data."""
    uid:     str
    email:   str
    name:    str
    picture: Optional[str] = None


# ── Token verification ───────────────────────────────────────────────────────────

def verify_google_token(id_token: str) -> FirebaseUser:
    """
    Verify a Firebase ID token and extract user info.

    Args:
        id_token: The Firebase ID token string from the frontend.

    Returns:
        FirebaseUser with uid, email, name, picture.

    Raises:
        ValueError: If the token is invalid, expired, or Firebase is not configured.
    """
    if _firebase_app is None:
        raise ValueError(
            "Firebase Admin SDK is not initialized. "
            "Check FIREBASE_CREDENTIALS_PATH in .env"
        )

    try:
        # clock_skew_seconds tolerates minor clock differences between
        # the client machine and Firebase's servers (common on dev machines)
        decoded = firebase_auth.verify_id_token(id_token, clock_skew_seconds=60)
    except firebase_auth.ExpiredIdTokenError as e:
        logger.warning("Firebase token expired: %s", e)
        raise ValueError("Firebase token has expired. Please sign in again.")
    except firebase_auth.RevokedIdTokenError as e:
        logger.warning("Firebase token revoked: %s", e)
        raise ValueError("Firebase token has been revoked.")
    except firebase_auth.InvalidIdTokenError as e:
        logger.warning("Firebase token invalid: %s", e)
        raise ValueError(f"Invalid Firebase token: {e}")
    except firebase_auth.CertificateFetchError as e:
        logger.error("Firebase certificate fetch error: %s", e)
        raise ValueError("Could not verify token (certificate error). Try again.")
    except Exception as e:
        logger.error("Firebase token verification failed: %s | type=%s", e, type(e).__name__, exc_info=True)
        raise ValueError(f"Token verification failed: {str(e)}")

    email = decoded.get("email")
    if not email:
        raise ValueError("Google account does not have an email address.")

    if not decoded.get("email_verified", False):
        raise ValueError("Email address is not verified by Google.")

    return FirebaseUser(
        uid     = decoded["uid"],
        email   = email.lower().strip(),
        name    = decoded.get("name", email.split("@")[0]),
        picture = decoded.get("picture"),
    )


def is_configured() -> bool:
    """Check if Firebase Admin SDK is properly initialized."""
    return _firebase_app is not None
