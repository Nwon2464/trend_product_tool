from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class ProductBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    price: int | None = Field(default=None, ge=0)
    release_date: date | None = None
    sales_store: str | None = Field(default=None, max_length=150)
    status: str = Field(default="不明", min_length=1, max_length=50)
    source_name: str | None = Field(default=None, max_length=150)
    source_url: HttpUrl | None = None
    trend_score: int = Field(default=0, ge=0, le=100)
    memo: str | None = None

    @field_validator(
        "category",
        "product_name",
        "brand",
        "sales_store",
        "status",
        "source_name",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=100)
    product_name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    price: int | None = Field(default=None, ge=0)
    release_date: date | None = None
    sales_store: str | None = Field(default=None, max_length=150)
    status: str | None = Field(default=None, min_length=1, max_length=50)
    source_name: str | None = Field(default=None, max_length=150)
    source_url: HttpUrl | None = None
    trend_score: int | None = Field(default=None, ge=0, le=100)
    memo: str | None = None

    @field_validator(
        "category",
        "product_name",
        "brand",
        "sales_store",
        "status",
        "source_name",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_url: str | None = None
    created_at: datetime
    updated_at: datetime


class KeywordBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    keyword: str = Field(..., min_length=1, max_length=150)
    priority: int = Field(default=2, ge=1, le=3)
    is_active: bool = True
    memo: str | None = None

    @field_validator("category", "keyword", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class KeywordCreate(KeywordBase):
    pass


class KeywordUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=100)
    keyword: str | None = Field(default=None, min_length=1, max_length=150)
    priority: int | None = Field(default=None, ge=1, le=3)
    is_active: bool | None = None
    memo: str | None = None

    @field_validator("category", "keyword", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class KeywordRead(KeywordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class SourceBase(BaseModel):
    source_name: str = Field(..., min_length=1, max_length=150)
    source_type: str = Field(default="manual", min_length=1, max_length=50)
    url: HttpUrl
    target_category: str = Field(..., min_length=1, max_length=100)
    priority: int = Field(default=2, ge=1, le=3)
    is_active: bool = True
    memo: str | None = None

    @field_validator("source_name", "source_type", "target_category", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    source_name: str | None = Field(default=None, min_length=1, max_length=150)
    source_type: str | None = Field(default=None, min_length=1, max_length=50)
    url: HttpUrl | None = None
    target_category: str | None = Field(default=None, min_length=1, max_length=100)
    priority: int | None = Field(default=None, ge=1, le=3)
    is_active: bool | None = None
    memo: str | None = None

    @field_validator("source_name", "source_type", "target_category", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class SourceRead(SourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    created_at: datetime
    updated_at: datetime


class SourceLogBase(BaseModel):
    source_id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=255)
    url: HttpUrl
    raw_text: str | None = None
    detected_at: datetime

    @field_validator("title", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class SourceLogCreate(SourceLogBase):
    pass


class SourceLogRead(SourceLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    created_at: datetime


class CollectorRunRequest(BaseModel):
    source_id: int = Field(..., ge=1)
    max_items: int = Field(default=10, ge=1, le=30)
    respect_robots: bool = True
    minimum_interval_seconds: int = Field(default=300, ge=0, le=86400)


class CollectorRunResponse(BaseModel):
    source_id: int
    fetched_url: str
    created_count: int
    skipped_count: int
    skipped_reason: str | None = None
    skipped_details: list[str] = Field(default_factory=list)
    logs: list[SourceLogRead]


class ProductCandidateBase(BaseModel):
    source_log_id: int = Field(..., ge=1)
    category: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=255)
    price: int | None = Field(default=None, ge=0)
    release_date: date | None = None
    sales_store: str | None = Field(default=None, max_length=150)
    source_url: HttpUrl
    detected_reason: str = Field(..., min_length=1)
    detected_keywords: str | None = None
    profit_expectation: int = Field(default=0, ge=0, le=100)
    candidate_status: str = Field(default="new", min_length=1, max_length=50)

    @field_validator("category", "product_name", "sales_store", "candidate_status", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class ProductCandidateCreate(ProductCandidateBase):
    pass


class ProductCandidateRead(ProductCandidateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_url: str
    created_at: datetime
    updated_at: datetime


class NotificationLogBase(BaseModel):
    product_id: int = Field(..., ge=1)
    message: str = Field(..., min_length=1)
    channel: str = Field(default="manual", min_length=1, max_length=50)
    status: str = Field(default="pending", min_length=1, max_length=50)
    sent_at: datetime | None = None

    @field_validator("channel", "status", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class NotificationLogCreate(NotificationLogBase):
    pass


class NotificationLogUpdate(BaseModel):
    message: str | None = Field(default=None, min_length=1)
    channel: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, min_length=1, max_length=50)
    sent_at: datetime | None = None

    @field_validator("channel", "status", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value


class NotificationLogRead(NotificationLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
