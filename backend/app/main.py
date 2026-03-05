from pathlib import Path
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings

_LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"


def _configure_logging() -> None:
    level_name = settings.log_level.strip().upper()
    level = getattr(logging, level_name, logging.INFO)
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(level=level, format=_LOG_FORMAT)
    root_logger.setLevel(level)


_configure_logging()
logger = logging.getLogger(__name__)

cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
if not cors_origins:
    cors_origins = [settings.frontend_url]
logger.debug("CORS origins configured: %s", cors_origins)

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
logger.info("API started app=%s api_prefix=%s log_level=%s", settings.app_name, settings.api_v1_prefix, settings.log_level)
logger.debug("Media mount configured at path=%s root=%s", settings.media_url_path, media_root)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
