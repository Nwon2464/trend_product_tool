import asyncio
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import crud, schemas, scraping_jobs
from ..database import SessionLocal, get_db

router = APIRouter(prefix="/scraping-jobs", tags=["scraping-jobs"])


def _format_sse(event_name: str, data: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.post("", response_model=schemas.ScrapingJobCreateResponse)
def create_scraping_job(
    request: schemas.ScrapingJobCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> schemas.ScrapingJobCreateResponse:
    missing_source_ids = [
        source_id for source_id in request.source_ids if crud.get_source(db, source_id) is None
    ]
    if missing_source_ids:
        raise HTTPException(status_code=404, detail=f"Sources not found: {missing_source_ids}")

    job = scraping_jobs.create_scraping_job(db, request)
    background_tasks.add_task(
        scraping_jobs.run_scraping_job,
        job.job_uid,
        max_items_per_source=request.max_items_per_source,
        max_candidates_per_source=request.max_candidates_per_source,
        respect_robots=request.respect_robots,
        minimum_interval_seconds=request.minimum_interval_seconds,
    )
    return schemas.ScrapingJobCreateResponse(
        job_id=job.job_uid,
        status=job.status,
        total_sources=job.total_sources,
        message="Scraping job queued",
    )


@router.get("", response_model=list[schemas.ScrapingJobRead])
def list_scraping_jobs(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.ScrapingJobRead]:
    return [scraping_jobs.to_job_read(job) for job in crud.list_scraping_jobs(db, limit=limit, offset=offset)]


@router.get("/{job_id}", response_model=schemas.ScrapingJobRead)
def get_scraping_job(
    job_id: str,
    db: Session = Depends(get_db),
) -> schemas.ScrapingJobRead:
    job = crud.get_scraping_job_by_uid(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Scraping job not found")
    return scraping_jobs.to_job_read(job)


@router.get("/{job_id}/events")
async def stream_scraping_job_events(job_id: str) -> StreamingResponse:
    async def event_generator():
        last_event_id = 0
        terminal_statuses = {"completed", "failed", "cancelled"}
        while True:
            with SessionLocal() as db:
                job = crud.get_scraping_job_by_uid(db, job_id)
                if job is None:
                    yield _format_sse("done", {"status": "failed", "message": "Scraping job not found"})
                    return

                events = crud.list_scraping_job_events(db, job_id=job.id, after_id=last_event_id)
                for event in events:
                    last_event_id = event.id
                    yield _format_sse("progress", scraping_jobs.to_event_read(event).model_dump())

                if job.status in terminal_statuses:
                    yield _format_sse(
                        "done",
                        {
                            "status": job.status,
                            "message": "Scraping job completed" if job.status == "completed" else job.error_message,
                            "completed_sources": job.completed_sources,
                            "failed_sources": job.failed_sources,
                            "skipped_sources": job.skipped_sources,
                            "created_candidates_count": job.created_candidates_count,
                        },
                    )
                    return

            yield ": heartbeat\n\n"
            await asyncio.sleep(0.75)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
