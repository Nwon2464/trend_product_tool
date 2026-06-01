from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/notification-logs", tags=["notification-logs"])


@router.get("", response_model=list[schemas.NotificationLogRead])
def list_notification_logs(
    product_id: int | None = Query(default=None, ge=1),
    channel: str | None = None,
    notification_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.NotificationLogRead]:
    return crud.list_notification_logs(
        db,
        product_id=product_id,
        channel=channel,
        status=notification_status,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=schemas.NotificationLogRead,
    status_code=status.HTTP_201_CREATED,
)
def create_notification_log(
    notification_log: schemas.NotificationLogCreate,
    db: Session = Depends(get_db),
) -> schemas.NotificationLogRead:
    db_product = crud.get_product(db, notification_log.product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return crud.create_notification_log(db, notification_log)


@router.get("/{notification_log_id}", response_model=schemas.NotificationLogRead)
def get_notification_log(
    notification_log_id: int,
    db: Session = Depends(get_db),
) -> schemas.NotificationLogRead:
    db_notification_log = crud.get_notification_log(db, notification_log_id)
    if db_notification_log is None:
        raise HTTPException(status_code=404, detail="Notification log not found")
    return db_notification_log


@router.put("/{notification_log_id}", response_model=schemas.NotificationLogRead)
def update_notification_log(
    notification_log_id: int,
    notification_log: schemas.NotificationLogUpdate,
    db: Session = Depends(get_db),
) -> schemas.NotificationLogRead:
    db_notification_log = crud.get_notification_log(db, notification_log_id)
    if db_notification_log is None:
        raise HTTPException(status_code=404, detail="Notification log not found")
    return crud.update_notification_log(db, db_notification_log, notification_log)


@router.delete("/{notification_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification_log(
    notification_log_id: int,
    db: Session = Depends(get_db),
) -> None:
    db_notification_log = crud.get_notification_log(db, notification_log_id)
    if db_notification_log is None:
        raise HTTPException(status_code=404, detail="Notification log not found")
    crud.delete_notification_log(db, db_notification_log)
