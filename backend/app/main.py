"""
main.py — CivicPulse FastAPI Application Entry Point

Startup sequence:
  1. Configure structured logging.
  2. Verify database connectivity (fails fast if MySQL is down).
  3. Mount all API routers.

Running locally:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.connection import verify_connection
from app.api.auth import router as auth_router
from app.api.complaints import router as complaints_router
from app.api.uploads import router as uploads_router
from app.api.officer import officer_router, citizen_router
from app.api.analytics import router as analytics_router
from app.api.notifications import notif_router, pref_router
from app.api.admin import router as admin_router
from app.api.administration import (
    dept_router,
    jurisdiction_router,
    ward_router,
    officer_router as admin_officer_router,
)
from app.api.geo import router as geo_router
from app.api.categories import router as categories_router
from app.api.zonal_officer import router as zonal_router
from app.api.forum import router as forum_router
from app.services.cloudinary_service import configure_cloudinary
from app.scheduler import start_scheduler, stop_scheduler

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("civicpulse")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting CivicPulse API…")
    verify_connection()
    logger.info("Database connection verified ✓")
    configure_cloudinary()
    logger.info("Cloudinary SDK configured ✓")
    start_scheduler(interval_minutes=30)
    logger.info("Background scheduler started ✓")
    yield
    # Shutdown
    stop_scheduler()
    logger.info("CivicPulse API shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "CivicPulse API",
    description = "AI-Powered Civic Issue Reporting, Prioritization & Resolution Platform",
    version     = "1.0.0",
    lifespan    = lifespan,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS (adjust origins before production) ───────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://localhost:5173"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(complaints_router)
app.include_router(citizen_router)        # GET /complaints/{id}/timeline
app.include_router(officer_router)        # /officer/complaints/*
app.include_router(uploads_router)
app.include_router(dept_router)
app.include_router(jurisdiction_router)
app.include_router(ward_router)
app.include_router(admin_officer_router)  # /officers GET/POST (admin assign)
app.include_router(analytics_router)      # /analytics/* (admin only)
app.include_router(notif_router)          # /notifications/*
app.include_router(pref_router)           # /notification-preferences
app.include_router(admin_router)          # /admin/* (admin only)
app.include_router(geo_router)            # /geo/resolve (geospatial)
app.include_router(categories_router)     # /categories (public)
app.include_router(zonal_router)          # /zonal/* (zonal officer)
app.include_router(forum_router)          # /forum/* + WS /forum/ws/*


# ── Health endpoints ──────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root():
    return {"message": "Welcome to CivicPulse API", "docs": "/docs"}


@app.get("/health", tags=["Root"])
def health():
    return {"status": "ok"}