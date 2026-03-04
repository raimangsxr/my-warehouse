from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings

cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
if not cors_origins:
    cors_origins = [settings.frontend_url]

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)

media_root = Path(settings.media_root)
media_root.mkdir(parents=True, exist_ok=True)
app.mount(settings.media_url_path, StaticFiles(directory=str(media_root)), name="media")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
