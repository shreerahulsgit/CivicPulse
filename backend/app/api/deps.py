"""
api/deps.py -- Shared FastAPI Dependencies

Reusable dependency functions injected into protected routes via Depends().

get_current_user    -- JWT -> User ORM object. Raises 401.
require_admin       -- Asserts role is admin. Raises 403.
require_officer     -- Asserts role is ward/zonal officer, dept_head, or admin. Raises 403.
require_zonal_officer -- Asserts role is zonal_officer, dept_head, or admin. Raises 403.
require_dept_head   -- Asserts role is dept_head or admin. Raises 403.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.services.auth_service import verify_token

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Role sets for permission checks ──────────────────────────────────────────
_ADMIN_ROLES     = {UserRole.ADMIN}
_OFFICER_ROLES   = {UserRole.WARD_OFFICER, UserRole.ZONAL_OFFICER, UserRole.DEPT_HEAD, UserRole.ADMIN}
_ZONAL_ROLES     = {UserRole.ZONAL_OFFICER, UserRole.DEPT_HEAD, UserRole.ADMIN}
_DEPT_HEAD_ROLES = {UserRole.DEPT_HEAD, UserRole.ADMIN}


def get_current_user(
    token: str = Depends(_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """JWT -> User dependency. Raises 401 on any failure."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        claims  = verify_token(token)
        user_id = claims.get("sub")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exc

    return user


def verify_token_string(token: str, db: Session) -> User:
    """
    Authenticate from a raw token string (for WebSocket ?token= query param).
    Raises ValueError on any failure.
    """
    from jose import JWTError
    try:
        claims  = verify_token(token)
        user_id = claims.get("sub")
        if not user_id:
            raise ValueError("Invalid token")
    except JWTError as e:
        raise ValueError(f"Token error: {e}")

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise ValueError("User not found or inactive")
    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Asserts the current user has admin role. Raises 403 otherwise."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user


def require_officer(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Asserts the current user is an officer (ward/zonal/dept_head) or admin.
    Citizens cannot access officer endpoints.
    """
    if current_user.role not in _OFFICER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer privileges required.",
        )
    return current_user


def require_zonal_officer(
    current_user: User = Depends(get_current_user),
) -> User:
    """Asserts role is at least zonal_officer. Raises 403 for ward officers and citizens."""
    if current_user.role not in _ZONAL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zonal officer or higher privileges required.",
        )
    return current_user


def require_dept_head(
    current_user: User = Depends(get_current_user),
) -> User:
    """Asserts role is dept_head or admin. Raises 403 otherwise."""
    if current_user.role not in _DEPT_HEAD_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Department head or admin privileges required.",
        )
    return current_user
