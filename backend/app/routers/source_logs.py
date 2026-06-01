from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/source-logs", tags=["source-logs"])


@router.get("", response_model=list[schemas.SourceLogRead])
def list_source_logs(
    source_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.SourceLogRead]:
    return crud.list_source_logs(db, source_id=source_id, limit=limit, offset=offset)


@router.get("/{source_log_id}", response_model=schemas.SourceLogRead)
def get_source_log(source_log_id: int, db: Session = Depends(get_db)) -> schemas.SourceLogRead:
    db_source_log = crud.get_source_log(db, source_log_id)
    if db_source_log is None:
        raise HTTPException(status_code=404, detail="Source log not found")
    return db_source_log


@router.delete("/{source_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source_log(source_log_id: int, db: Session = Depends(get_db)) -> None:
    db_source_log = crud.get_source_log(db, source_log_id)
    if db_source_log is None:
        raise HTTPException(status_code=404, detail="Source log not found")
    crud.delete_source_log(db, db_source_log)
