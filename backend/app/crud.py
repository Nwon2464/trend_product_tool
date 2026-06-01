from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import models, schemas


def list_products(
    db: Session,
    *,
    category: str | None = None,
    keyword: str | None = None,
    status: str | None = None,
    sales_store: str | None = None,
    min_score: int | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    limit: int = 100,
    offset: int = 0,
) -> list[models.Product]:
    statement = select(models.Product)

    if category:
        statement = statement.where(models.Product.category == category)
    if keyword:
        keyword_pattern = f"%{keyword}%"
        statement = statement.where(
            or_(
                models.Product.product_name.like(keyword_pattern),
                models.Product.brand.like(keyword_pattern),
                models.Product.memo.like(keyword_pattern),
            )
        )
    if status:
        statement = statement.where(models.Product.status == status)
    if sales_store:
        statement = statement.where(models.Product.sales_store.like(f"%{sales_store}%"))
    if min_score is not None:
        statement = statement.where(models.Product.trend_score >= min_score)

    sort_columns = {
        "created_at": models.Product.created_at,
        "release_date": models.Product.release_date,
        "trend_score": models.Product.trend_score,
    }
    sort_column = sort_columns.get(sort_by, models.Product.created_at)
    order_expression = sort_column.asc() if sort_order == "asc" else sort_column.desc()

    statement = statement.order_by(order_expression).offset(offset).limit(limit)
    return list(db.scalars(statement))


def get_product(db: Session, product_id: int) -> models.Product | None:
    return db.get(models.Product, product_id)


def create_product(db: Session, product: schemas.ProductCreate) -> models.Product:
    data = product.model_dump()
    if data.get("source_url") is not None:
        data["source_url"] = str(data["source_url"])

    db_product = models.Product(**data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


def update_product(
    db: Session,
    db_product: models.Product,
    product: schemas.ProductUpdate,
) -> models.Product:
    update_data = product.model_dump(exclude_unset=True)
    if update_data.get("source_url") is not None:
        update_data["source_url"] = str(update_data["source_url"])

    for field, value in update_data.items():
        setattr(db_product, field, value)

    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


def delete_product(db: Session, db_product: models.Product) -> None:
    db.delete(db_product)
    db.commit()


def list_keywords(
    db: Session,
    *,
    category: str | None = None,
    is_active: bool | None = None,
) -> list[models.Keyword]:
    statement = select(models.Keyword)
    if category:
        statement = statement.where(models.Keyword.category == category)
    if is_active is not None:
        statement = statement.where(models.Keyword.is_active == is_active)
    statement = statement.order_by(models.Keyword.priority.asc(), models.Keyword.keyword.asc())
    return list(db.scalars(statement))


def list_active_keywords(db: Session) -> list[models.Keyword]:
    return list_keywords(db, is_active=True)


def get_keyword(db: Session, keyword_id: int) -> models.Keyword | None:
    return db.get(models.Keyword, keyword_id)


def create_keyword(db: Session, keyword: schemas.KeywordCreate) -> models.Keyword:
    db_keyword = models.Keyword(**keyword.model_dump())
    db.add(db_keyword)
    db.commit()
    db.refresh(db_keyword)
    return db_keyword


def update_keyword(
    db: Session,
    db_keyword: models.Keyword,
    keyword: schemas.KeywordUpdate,
) -> models.Keyword:
    for field, value in keyword.model_dump(exclude_unset=True).items():
        setattr(db_keyword, field, value)
    db.add(db_keyword)
    db.commit()
    db.refresh(db_keyword)
    return db_keyword


def delete_keyword(db: Session, db_keyword: models.Keyword) -> None:
    db.delete(db_keyword)
    db.commit()


def list_sources(
    db: Session,
    *,
    target_category: str | None = None,
    source_type: str | None = None,
    is_active: bool | None = None,
) -> list[models.Source]:
    statement = select(models.Source)
    if target_category:
        statement = statement.where(models.Source.target_category == target_category)
    if source_type:
        statement = statement.where(models.Source.source_type == source_type)
    if is_active is not None:
        statement = statement.where(models.Source.is_active == is_active)
    statement = statement.order_by(models.Source.priority.asc(), models.Source.source_name.asc())
    return list(db.scalars(statement))


def get_source(db: Session, source_id: int) -> models.Source | None:
    return db.get(models.Source, source_id)


def create_source(db: Session, source: schemas.SourceCreate) -> models.Source:
    data = source.model_dump()
    data["url"] = str(data["url"])
    db_source = models.Source(**data)
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


def update_source(
    db: Session,
    db_source: models.Source,
    source: schemas.SourceUpdate,
) -> models.Source:
    update_data = source.model_dump(exclude_unset=True)
    if update_data.get("url") is not None:
        update_data["url"] = str(update_data["url"])
    for field, value in update_data.items():
        setattr(db_source, field, value)
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


def delete_source(db: Session, db_source: models.Source) -> None:
    db.delete(db_source)
    db.commit()


def list_source_logs(
    db: Session,
    *,
    source_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[models.SourceLog]:
    statement = select(models.SourceLog)
    if source_id is not None:
        statement = statement.where(models.SourceLog.source_id == source_id)
    statement = (
        statement.order_by(models.SourceLog.detected_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement))


def get_source_log(db: Session, source_log_id: int) -> models.SourceLog | None:
    return db.get(models.SourceLog, source_log_id)


def get_latest_source_log(db: Session, source_id: int) -> models.SourceLog | None:
    statement = (
        select(models.SourceLog)
        .where(models.SourceLog.source_id == source_id)
        .order_by(models.SourceLog.detected_at.desc())
        .limit(1)
    )
    return db.scalar(statement)


def get_source_log_by_url(
    db: Session,
    *,
    source_id: int,
    url: str,
) -> models.SourceLog | None:
    statement = (
        select(models.SourceLog)
        .where(models.SourceLog.source_id == source_id, models.SourceLog.url == url)
        .limit(1)
    )
    return db.scalar(statement)


def create_source_log(db: Session, source_log: schemas.SourceLogCreate) -> models.SourceLog:
    data = source_log.model_dump()
    data["url"] = str(data["url"])
    db_source_log = models.SourceLog(**data)
    db.add(db_source_log)
    db.commit()
    db.refresh(db_source_log)
    return db_source_log


def delete_source_log(db: Session, db_source_log: models.SourceLog) -> None:
    db.delete(db_source_log)
    db.commit()


def create_collection_run(
    db: Session,
    *,
    source_id: int,
    fetched_url: str,
    selected_statuses: str | None,
    started_at,
) -> models.CollectionRun:
    db_collection_run = models.CollectionRun(
        source_id=source_id,
        fetched_url=fetched_url,
        selected_statuses=selected_statuses,
        started_at=started_at,
        status="running",
    )
    db.add(db_collection_run)
    db.commit()
    db.refresh(db_collection_run)
    return db_collection_run


def finish_collection_run(
    db: Session,
    db_collection_run: models.CollectionRun,
    *,
    status: str,
    finished_at,
    created_count: int = 0,
    skipped_count: int = 0,
    skipped_reason: str | None = None,
    error_message: str | None = None,
) -> models.CollectionRun:
    db_collection_run.status = status
    db_collection_run.finished_at = finished_at
    db_collection_run.created_count = created_count
    db_collection_run.skipped_count = skipped_count
    db_collection_run.skipped_reason = skipped_reason
    db_collection_run.error_message = error_message
    db.add(db_collection_run)
    db.commit()
    db.refresh(db_collection_run)
    return db_collection_run


def create_scraping_job(
    db: Session,
    *,
    job_uid: str,
    target_category: str | None,
    selected_statuses: str | None,
    source_ids: str,
    total_sources: int,
) -> models.ScrapingJob:
    db_job = models.ScrapingJob(
        job_uid=job_uid,
        status="queued",
        target_category=target_category,
        selected_statuses=selected_statuses,
        source_ids=source_ids,
        total_sources=total_sources,
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


def get_scraping_job_by_uid(db: Session, job_uid: str) -> models.ScrapingJob | None:
    statement = select(models.ScrapingJob).where(models.ScrapingJob.job_uid == job_uid).limit(1)
    return db.scalar(statement)


def list_scraping_jobs(db: Session, *, limit: int = 50, offset: int = 0) -> list[models.ScrapingJob]:
    statement = (
        select(models.ScrapingJob)
        .order_by(models.ScrapingJob.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement))


def save_scraping_job(db: Session, db_job: models.ScrapingJob) -> models.ScrapingJob:
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


def create_scraping_job_event(
    db: Session,
    *,
    job_id: int,
    event_type: str,
    level: str,
    message: str,
    source_id: int | None = None,
    source_name: str | None = None,
    source_url: str | None = None,
    payload: str | None = None,
) -> models.ScrapingJobEvent:
    db_event = models.ScrapingJobEvent(
        job_id=job_id,
        event_type=event_type,
        level=level,
        message=message,
        source_id=source_id,
        source_name=source_name,
        source_url=source_url,
        payload=payload,
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


def list_scraping_job_events(
    db: Session,
    *,
    job_id: int,
    after_id: int = 0,
) -> list[models.ScrapingJobEvent]:
    statement = (
        select(models.ScrapingJobEvent)
        .where(models.ScrapingJobEvent.job_id == job_id, models.ScrapingJobEvent.id > after_id)
        .order_by(models.ScrapingJobEvent.id.asc())
    )
    return list(db.scalars(statement))


def list_product_candidates(
    db: Session,
    *,
    category: str | None = None,
    candidate_status: str | None = None,
    min_expectation: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[models.ProductCandidate]:
    statement = select(models.ProductCandidate)
    if category:
        statement = statement.where(models.ProductCandidate.category == category)
    if candidate_status:
        statement = statement.where(models.ProductCandidate.candidate_status == candidate_status)
    if min_expectation is not None:
        statement = statement.where(models.ProductCandidate.profit_expectation >= min_expectation)
    statement = (
        statement.order_by(models.ProductCandidate.profit_expectation.desc(), models.ProductCandidate.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement))


def get_product_candidate_by_source_url(
    db: Session,
    source_url: str,
) -> models.ProductCandidate | None:
    statement = (
        select(models.ProductCandidate)
        .where(models.ProductCandidate.source_url == str(source_url))
        .limit(1)
    )
    return db.scalar(statement)


def get_product_candidate(
    db: Session,
    product_candidate_id: int,
) -> models.ProductCandidate | None:
    return db.get(models.ProductCandidate, product_candidate_id)


def create_product_candidate(
    db: Session,
    product_candidate: schemas.ProductCandidateCreate,
) -> models.ProductCandidate:
    data = product_candidate.model_dump()
    data["source_url"] = str(data["source_url"])
    db_product_candidate = models.ProductCandidate(**data)
    db.add(db_product_candidate)
    db.commit()
    db.refresh(db_product_candidate)
    return db_product_candidate


def update_product_candidate(
    db: Session,
    db_product_candidate: models.ProductCandidate,
    product_candidate: schemas.ProductCandidateUpdate,
) -> models.ProductCandidate:
    for field, value in product_candidate.model_dump(exclude_unset=True).items():
        setattr(db_product_candidate, field, value)
    db.add(db_product_candidate)
    db.commit()
    db.refresh(db_product_candidate)
    return db_product_candidate


def delete_product_candidate(
    db: Session,
    db_product_candidate: models.ProductCandidate,
) -> None:
    db.delete(db_product_candidate)
    db.commit()


def list_notification_logs(
    db: Session,
    *,
    product_id: int | None = None,
    channel: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[models.NotificationLog]:
    statement = select(models.NotificationLog)
    if product_id is not None:
        statement = statement.where(models.NotificationLog.product_id == product_id)
    if channel:
        statement = statement.where(models.NotificationLog.channel == channel)
    if status:
        statement = statement.where(models.NotificationLog.status == status)
    statement = (
        statement.order_by(models.NotificationLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement))


def get_notification_log(
    db: Session,
    notification_log_id: int,
) -> models.NotificationLog | None:
    return db.get(models.NotificationLog, notification_log_id)


def get_duplicate_notification_log(
    db: Session,
    notification_log: schemas.NotificationLogCreate,
) -> models.NotificationLog | None:
    statement = (
        select(models.NotificationLog)
        .where(models.NotificationLog.product_id == notification_log.product_id)
        .where(models.NotificationLog.message == notification_log.message)
        .where(models.NotificationLog.channel == notification_log.channel)
        .order_by(models.NotificationLog.created_at.desc())
        .limit(1)
    )
    return db.scalars(statement).first()


def create_notification_log(
    db: Session,
    notification_log: schemas.NotificationLogCreate,
) -> models.NotificationLog:
    db_notification_log = models.NotificationLog(**notification_log.model_dump())
    db.add(db_notification_log)
    db.commit()
    db.refresh(db_notification_log)
    return db_notification_log


def update_notification_log(
    db: Session,
    db_notification_log: models.NotificationLog,
    notification_log: schemas.NotificationLogUpdate,
) -> models.NotificationLog:
    for field, value in notification_log.model_dump(exclude_unset=True).items():
        setattr(db_notification_log, field, value)
    db.add(db_notification_log)
    db.commit()
    db.refresh(db_notification_log)
    return db_notification_log


def delete_notification_log(
    db: Session,
    db_notification_log: models.NotificationLog,
) -> None:
    db.delete(db_notification_log)
    db.commit()
