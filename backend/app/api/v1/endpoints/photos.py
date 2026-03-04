from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.api.deps import require_warehouse_membership
from app.core.config import settings
from app.schemas.photo import PhotoUploadResponse

router = APIRouter(prefix="/photos", tags=["photos"])

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@router.post("/upload", response_model=PhotoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    request: Request,
    warehouse_id: str,
    file: UploadFile = File(...),
    _membership=Depends(require_warehouse_membership),
) -> PhotoUploadResponse:
    content_type = (file.content_type or "").lower()
    ext = _ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image content type")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(payload) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image exceeds 10MB limit")

    warehouse_dir = Path(settings.media_root) / warehouse_id
    warehouse_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    target = warehouse_dir / filename
    target.write_bytes(payload)

    relative_url = f"{settings.media_url_path.rstrip('/')}/{warehouse_id}/{filename}"
    photo_url = f"{str(request.base_url).rstrip('/')}{relative_url}"
    return PhotoUploadResponse(
        photo_url=photo_url,
        content_type=content_type,
        size_bytes=len(payload),
    )
