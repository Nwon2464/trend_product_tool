from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _localhost_filter(column):
    return or_(
        column.like("%localhost%"),
        column.like("%127.0.0.1%"),
    )


def _count(query) -> int:
    return int(query.count())


def _delete(query, dry_run: bool) -> int:
    count = _count(query)
    if not dry_run and count > 0:
        query.delete(synchronize_session=False)
    return count


@router.post("/cleanup", response_model=schemas.MaintenanceCleanupResponse)
def cleanup(
    request: schemas.MaintenanceCleanupRequest,
    db: Session = Depends(get_db),
) -> schemas.MaintenanceCleanupResponse:
    if request.confirm != "DELETE":
        raise HTTPException(status_code=400, detail='confirm must be "DELETE"')

    result = schemas.MaintenanceCleanupResponse(dry_run=request.dry_run)

    if request.delete_product_candidates:
        result.deleted_product_candidates = _delete(
            db.query(models.ProductCandidate),
            request.dry_run,
        )

    if request.delete_source_logs:
        result.deleted_source_logs = _delete(
            db.query(models.SourceLog),
            request.dry_run,
        )

    if request.delete_scraping_jobs:
        result.deleted_scraping_job_events = _delete(
            db.query(models.ScrapingJobEvent),
            request.dry_run,
        )
        result.deleted_scraping_jobs = _delete(
            db.query(models.ScrapingJob),
            request.dry_run,
        )

    if request.delete_collection_runs:
        result.deleted_collection_runs = _delete(
            db.query(models.CollectionRun),
            request.dry_run,
        )

    if request.delete_notification_logs:
        result.deleted_notification_logs = _delete(
            db.query(models.NotificationLog),
            request.dry_run,
        )

    if request.delete_test_products:
        result.deleted_test_products = _delete(
            db.query(models.Product).filter(
                or_(
                    models.Product.product_name == "test1",
                    _localhost_filter(models.Product.source_url),
                )
            ),
            request.dry_run,
        )

    if request.delete_localhost_sources:
        result.deleted_localhost_sources = _delete(
            db.query(models.Source).filter(_localhost_filter(models.Source.url)),
            request.dry_run,
        )

    if not request.dry_run:
        db.commit()

    return result
