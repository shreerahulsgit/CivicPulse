"""
api/categories.py — Category Routes

Endpoints:
  GET /categories   List all complaint categories (public)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database.session import get_db
from app.models.category import Category

router = APIRouter(prefix="/categories", tags=["Categories"])


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None = None


@router.get("", response_model=list[CategoryResponse], summary="List all categories")
def list_categories(db: Session = Depends(get_db)) -> list[CategoryResponse]:
    return db.query(Category).order_by(Category.id).all()
