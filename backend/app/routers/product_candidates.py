from fastapi import APIRouter, Depends, HTTPException, Query, status
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


@router.put("/{product_candidate_id}", response_model=schemas.ProductCandidateRead)
def update_product_candidate(
    product_candidate_id: int,
    product_candidate: schemas.ProductCandidateUpdate,
    db: Session = Depends(get_db),
) -> schemas.ProductCandidateRead:
    db_product_candidate = crud.get_product_candidate(db, product_candidate_id)
    if db_product_candidate is None:
        raise HTTPException(status_code=404, detail="Product candidate not found")
    return crud.update_product_candidate(db, db_product_candidate, product_candidate)


@router.delete("/{product_candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_candidate(
    product_candidate_id: int,
    db: Session = Depends(get_db),
) -> None:
    db_product_candidate = crud.get_product_candidate(db, product_candidate_id)
    if db_product_candidate is None:
        raise HTTPException(status_code=404, detail="Product candidate not found")
    crud.delete_product_candidate(db, db_product_candidate)
