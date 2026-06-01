from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/product-candidates", tags=["product-candidates"])


@router.get("", response_model=list[schemas.ProductCandidateRead])
def list_product_candidates(
    category: str | None = None,
    candidate_status: str | None = None,
    min_expectation: int | None = Query(default=None, ge=0, le=100),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.ProductCandidateRead]:
    return crud.list_product_candidates(
        db,
        category=category,
        candidate_status=candidate_status,
        min_expectation=min_expectation,
        limit=limit,
        offset=offset,
    )
