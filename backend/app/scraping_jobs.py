from datetime import datetime, timezone
import json
import uuid

from sqlalchemy.orm import Session

from . import collectors, crud, models, schemas
from .database import SessionLocal


def _json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads_list(value: str | None) -> list:
    if not value:
        return []
    parsed = json.loads(value)
    return parsed if isinstance(parsed, list) else []


def to_job_read(job: models.ScrapingJob) -> schemas.ScrapingJobRead:
    return schemas.ScrapingJobRead(
        job_id=job.job_uid,
        status=job.status,
        target_category=job.target_category,
        selected_statuses=_json_loads_list(job.selected_statuses),
        total_sources=job.total_sources,
        completed_sources=job.completed_sources,
        failed_sources=job.failed_sources,
        skipped_sources=job.skipped_sources,
        created_logs_count=job.created_logs_count,
        created_candidates_count=job.created_candidates_count,
        started_at=job.started_at,
        finished_at=job.finished_at,
        error_message=job.error_message,
    )


def to_event_read(event: models.ScrapingJobEvent) -> schemas.ScrapingJobEventRead:
    payload = None
    if event.payload:
        try:
            payload = json.loads(event.payload)
        except json.JSONDecodeError:
            payload = {"raw": event.payload}
    return schemas.ScrapingJobEventRead(
        id=event.id,
        event_type=event.event_type,
        level=event.level,
        message=event.message,
        source_id=event.source_id,
        source_name=event.source_name,
        source_url=event.source_url,
        payload=payload,
        created_at=event.created_at,
    )


def append_job_event(
    db: Session,
    job: models.ScrapingJob,
    *,
    event_type: str,
    level: str,
    message: str,
    source: models.Source | None = None,
    payload: dict | None = None,
) -> models.ScrapingJobEvent:
    return crud.create_scraping_job_event(
        db,
        job_id=job.id,
        event_type=event_type,
        level=level,
        message=message,
        source_id=source.id if source else None,
        source_name=source.source_name if source else None,
        source_url=source.url if source else None,
        payload=_json_dumps(payload) if payload is not None else None,
    )


def create_scraping_job(
    db: Session,
    request: schemas.ScrapingJobCreateRequest,
) -> models.ScrapingJob:
    unique_source_ids = list(dict.fromkeys(request.source_ids))
    job = crud.create_scraping_job(
        db,
        job_uid=f"job_{uuid.uuid4().hex}",
        target_category=request.target_category,
        selected_statuses=_json_dumps(request.selected_statuses or []),
        source_ids=_json_dumps(unique_source_ids),
        total_sources=len(unique_source_ids),
    )
    append_job_event(
        db,
        job,
        event_type="queued",
        level="info",
        message=f"Scraping job created: {job.job_uid}",
        payload={"source_ids": unique_source_ids},
    )
    return job


def run_scraping_job(
    job_uid: str,
    *,
    max_items_per_source: int,
    respect_robots: bool,
    minimum_interval_seconds: int,
) -> None:
    with SessionLocal() as db:
        job = crud.get_scraping_job_by_uid(db, job_uid)
        if job is None:
            return

        source_ids = [int(source_id) for source_id in _json_loads_list(job.source_ids)]
        selected_statuses = [str(status) for status in _json_loads_list(job.selected_statuses)]
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        crud.save_scraping_job(db, job)
        append_job_event(
            db,
            job,
            event_type="start",
            level="info",
            message=f"Batch scraping started: {len(source_ids)} sources",
        )

        try:
            for index, source_id in enumerate(source_ids, start=1):
                source = crud.get_source(db, source_id)
                if source is None:
                    job.failed_sources += 1
                    crud.save_scraping_job(db, job)
                    append_job_event(
                        db,
                        job,
                        event_type="error",
                        level="error",
                        message=f"{index}/{len(source_ids)} source not found: {source_id}",
                        payload={"source_id": source_id},
                    )
                    continue
                if not source.is_active:
                    job.skipped_sources += 1
                    crud.save_scraping_job(db, job)
                    append_job_event(
                        db,
                        job,
                        event_type="skip",
                        level="warn",
                        message=f"{index}/{len(source_ids)} skipped inactive source: {source.source_name}",
                        source=source,
                        payload={"reason": "source_inactive"},
                    )
                    continue

                append_job_event(
                    db,
                    job,
                    event_type="source_start",
                    level="info",
                    message=f"{index}/{len(source_ids)} {source.source_name}",
                    source=source,
                )
                append_job_event(
                    db,
                    job,
                    event_type="fetch",
                    level="info",
                    message="HTML取得開始",
                    source=source,
                )
                append_job_event(
                    db,
                    job,
                    event_type="parse",
                    level="info",
                    message="本文解析中",
                    source=source,
                )

                try:
                    result = collectors.run_collector(
                        db,
                        source=source,
                        max_items=max_items_per_source,
                        respect_robots=respect_robots,
                        minimum_interval_seconds=minimum_interval_seconds,
                        selected_statuses=selected_statuses or None,
                    )
                except Exception as exc:
                    job.failed_sources += 1
                    crud.save_scraping_job(db, job)
                    append_job_event(
                        db,
                        job,
                        event_type="error",
                        level="error",
                        message=f"{index}/{len(source_ids)} failed: {exc}",
                        source=source,
                    )
                    continue

                job.created_logs_count += result.created_count
                job.created_candidates_count += len(result.candidates)
                if result.skipped_reason:
                    job.skipped_sources += 1
                    append_job_event(
                        db,
                        job,
                        event_type="skip",
                        level="warn",
                        message=f"Skipped: {result.skipped_reason}",
                        source=source,
                        payload={"reason": result.skipped_reason, "details": result.skipped_details},
                    )
                else:
                    job.completed_sources += 1
                    if result.skipped_count > 0:
                        append_job_event(
                            db,
                            job,
                            event_type="warn",
                            level="warn",
                            message=f"Skipped items: {result.skipped_count}",
                            source=source,
                            payload={"details": result.skipped_details},
                        )
                    append_job_event(
                        db,
                        job,
                        event_type="candidate",
                        level="success" if result.candidates else "info",
                        message=f"商品候補 {len(result.candidates)}件作成",
                        source=source,
                        payload={"created_logs_count": result.created_count, "created_candidates_count": len(result.candidates)},
                    )
                    append_job_event(
                        db,
                        job,
                        event_type="source_done",
                        level="success",
                        message=f"{index}/{len(source_ids)} completed",
                        source=source,
                    )
                crud.save_scraping_job(db, job)

            job.status = "completed"
            job.finished_at = datetime.now(timezone.utc)
            crud.save_scraping_job(db, job)
            append_job_event(
                db,
                job,
                event_type="done",
                level="success",
                message="Scraping job completed",
                payload={
                    "completed_sources": job.completed_sources,
                    "failed_sources": job.failed_sources,
                    "skipped_sources": job.skipped_sources,
                    "created_candidates_count": job.created_candidates_count,
                },
            )
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            crud.save_scraping_job(db, job)
            append_job_event(
                db,
                job,
                event_type="error",
                level="error",
                message=f"Scraping job failed: {exc}",
            )
