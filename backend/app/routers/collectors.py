from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import collectors, crud, schemas
from ..database import get_db

router = APIRouter(prefix="/collectors", tags=["collectors"])


@router.post("/run", response_model=schemas.CollectorRunResponse)
def run_collector(
    request: schemas.CollectorRunRequest,
    db: Session = Depends(get_db),
) -> schemas.CollectorRunResponse:
    db_source = crud.get_source(db, request.source_id)
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    if not db_source.is_active:
        raise HTTPException(status_code=400, detail="Source is inactive")

    try:
        return collectors.run_collector(
            db,
            source=db_source,
            max_items=request.max_items,
            max_candidates=request.max_candidates,
            respect_robots=request.respect_robots,
            minimum_interval_seconds=request.minimum_interval_seconds,
            selected_statuses=request.selected_statuses,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Collector failed: {exc}") from exc
