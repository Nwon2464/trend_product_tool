from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/keywords", tags=["keywords"])


@router.get("", response_model=list[schemas.KeywordRead])
def list_keywords(
    category: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.KeywordRead]:
    return crud.list_keywords(db, category=category, is_active=is_active)


@router.post("", response_model=schemas.KeywordRead, status_code=status.HTTP_201_CREATED)
def create_keyword(
    keyword: schemas.KeywordCreate,
    db: Session = Depends(get_db),
) -> schemas.KeywordRead:
    try:
        return crud.create_keyword(db, keyword)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Keyword already exists") from exc


@router.get("/{keyword_id}", response_model=schemas.KeywordRead)
def get_keyword(keyword_id: int, db: Session = Depends(get_db)) -> schemas.KeywordRead:
    db_keyword = crud.get_keyword(db, keyword_id)
    if db_keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return db_keyword


@router.put("/{keyword_id}", response_model=schemas.KeywordRead)
def update_keyword(
    keyword_id: int,
    keyword: schemas.KeywordUpdate,
    db: Session = Depends(get_db),
) -> schemas.KeywordRead:
    db_keyword = crud.get_keyword(db, keyword_id)
    if db_keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")
    try:
        return crud.update_keyword(db, db_keyword, keyword)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Keyword already exists") from exc


@router.delete("/{keyword_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)) -> None:
    db_keyword = crud.get_keyword(db, keyword_id)
    if db_keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")
    crud.delete_keyword(db, db_keyword)
