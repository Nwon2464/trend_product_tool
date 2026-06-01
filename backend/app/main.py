import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import collectors, keywords, maintenance, notification_logs, product_candidates, products, scraping_jobs, source_logs, sources
from .seed import seed_initial_keywords, seed_initial_sources

Base.metadata.create_all(bind=engine)

if os.getenv("ENABLE_SEED_DATA", "false").lower() == "true":
    with SessionLocal() as db:
        seed_initial_keywords(db)
        seed_initial_sources(db)

app = FastAPI(title="Trend Product Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(keywords.router)
app.include_router(sources.router)
app.include_router(notification_logs.router)
app.include_router(source_logs.router)
app.include_router(collectors.router)
app.include_router(product_candidates.router)
app.include_router(scraping_jobs.router)
app.include_router(maintenance.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
