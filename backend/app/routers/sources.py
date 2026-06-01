from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[schemas.SourceRead])
def list_sources(
    target_category: str | None = None,
    source_type: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.SourceRead]:
    return crud.list_sources(
        db,
        target_category=target_category,
        source_type=source_type,
        is_active=is_active,
    )


@router.post("", response_model=schemas.SourceRead, status_code=status.HTTP_201_CREATED)
def create_source(
    source: schemas.SourceCreate,
    db: Session = Depends(get_db),
) -> schemas.SourceRead:
    return crud.create_source(db, source)


@router.get("/{source_id}", response_model=schemas.SourceRead)
def get_source(source_id: int, db: Session = Depends(get_db)) -> schemas.SourceRead:
    db_source = crud.get_source(db, source_id)
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return db_source


@router.put("/{source_id}", response_model=schemas.SourceRead)
def update_source(
    source_id: int,
    source: schemas.SourceUpdate,
    db: Session = Depends(get_db),
) -> schemas.SourceRead:
    db_source = crud.get_source(db, source_id)
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return crud.update_source(db, db_source, source)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(source_id: int, db: Session = Depends(get_db)) -> None:
    db_source = crud.get_source(db, source_id)
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    crud.delete_source(db, db_source)
