"""
api/auth.py -- Authentication Routes

Endpoints:
  POST /auth/google   Google Sign-In via Firebase ID token (citizens + officers)
  POST /auth/login    Email + password (admin only, Swagger compatible)
  GET  /auth/me       Return current authenticated user's profile

Flow:
  Citizens/Officers: Frontend Firebase Google Sign-In -> POST /auth/google
  Admin:             Email + password form -> POST /auth/login
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole, AuthProvider
from app.schemas.user import GoogleAuthRequest, TokenResponse, UserLogin, UserResponse
from app.services.auth_service import (
    create_access_token,
    get_user_by_email,
    hash_password,
    verify_password,
    verify_token,
)
from app.services.firebase_service import verify_google_token, FirebaseUser

logger         = logging.getLogger(__name__)
router         = APIRouter(prefix="/auth", tags=["Authentication"])
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password.",
    headers={"WWW-Authenticate": "Bearer"},
)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/google — Firebase Google Sign-In
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Google Sign-In (Firebase)",
    description=(
        "Accepts a Firebase ID token from the frontend Google Sign-In flow. "
        "If the user exists, logs them in. If not, auto-creates a citizen account. "
        "Returns a JWT bearer token."
    ),
)
def google_login(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    # 1. Verify Firebase ID token
    try:
        firebase_user: FirebaseUser = verify_google_token(payload.id_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Find or create user
    user = get_user_by_email(db, firebase_user.email)

    if user:
        # Existing user — update avatar if changed
        if firebase_user.picture and user.avatar_url != firebase_user.picture:
            user.avatar_url = firebase_user.picture
            db.flush()

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Contact admin.",
            )

        logger.info(
            "Google login: id=%s email=%s role=%s",
            user.id, user.email, user.role.value,
        )
    else:
        # Auto-create citizen account
        user = User(
            id            = str(uuid.uuid4()),
            full_name     = firebase_user.name,
            email         = firebase_user.email,
            auth_provider = AuthProvider.GOOGLE,
            avatar_url    = firebase_user.picture,
            role          = UserRole.CITIZEN,
            is_active     = True,
        )
        db.add(user)
        db.flush()
        db.refresh(user)
        logger.info(
            "Google auto-register: id=%s email=%s name=%s",
            user.id, user.email, user.full_name,
        )

    # 3. Issue JWT
    token = create_access_token({"sub": user.id, "role": user.role.value})

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/login — Admin email+password (Swagger compatible)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin Login (email + password)",
    description=(
        "Email + password login for admin accounts only. "
        "Accepts OAuth2 form fields (username=email, password). "
        "Citizens and officers should use /auth/google instead."
    ),
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    email = form_data.username.lower().strip()
    user  = get_user_by_email(db, email)

    if not user or not user.is_active:
        raise _CREDENTIALS_ERROR

    # Only email-auth users can use password login
    if user.auth_provider != AuthProvider.EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please use the Google login button.",
        )

    if not user.password_hash or not verify_password(form_data.password, user.password_hash):
        raise _CREDENTIALS_ERROR

    token = create_access_token({"sub": user.id, "role": user.role.value})
    logger.info("Admin login: id=%s email=%s", user.id, user.email)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/login/json — Admin JSON login (for React frontend)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/login/json",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin Login JSON (for frontend)",
    description="JSON body login for admin accounts. Use from the admin login form.",
)
def login_json(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower().strip()
    user  = get_user_by_email(db, email)

    if not user or not user.is_active:
        raise _CREDENTIALS_ERROR

    if user.auth_provider != AuthProvider.EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please use the Google login button.",
        )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise _CREDENTIALS_ERROR

    token = create_access_token({"sub": user.id, "role": user.role.value})
    logger.info("Email login (JSON): id=%s email=%s role=%s", user.id, user.email, user.role.value)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/register — Citizen self-registration
# ═══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel as _BaseModel, Field as _Field

class CitizenRegisterRequest(_BaseModel):
    full_name: str  = _Field(..., min_length=2, max_length=100)
    email:     str  = _Field(..., description="Unique email address")
    phone:     str | None = _Field(None)
    password:  str  = _Field(..., min_length=8, max_length=100)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Citizen self-registration (email + password)",
    description="Create a new citizen account with email and password. Returns a JWT token immediately.",
)
def register_citizen(
    payload: CitizenRegisterRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    email = payload.email.lower().strip()

    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        id            = str(uuid.uuid4()),
        full_name     = payload.full_name,
        email         = email,
        phone         = payload.phone,
        password_hash = hash_password(payload.password),
        auth_provider = AuthProvider.EMAIL,
        role          = UserRole.CITIZEN,
        is_active     = True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Citizen self-register: id=%s email=%s", user.id, user.email)

    token = create_access_token({"sub": user.id, "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )



# ═══════════════════════════════════════════════════════════════════════════════
# GET /auth/me
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user",
)
def get_me(
    token: str = Depends(_oauth2_scheme),
    db: Session = Depends(get_db),
) -> UserResponse:
    try:
        claims  = verify_token(token)
        user_id = claims.get("sub")
        if not user_id:
            raise JWTError("Missing 'sub' claim.")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserResponse.model_validate(user)
