from fastapi import APIRouter

from app.api.v1.endpoints import auth, boxes, items, settings, tags, warehouses

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(warehouses.router)
api_router.include_router(warehouses.invites_router)
api_router.include_router(boxes.router)
api_router.include_router(boxes.qr_router)
api_router.include_router(items.router)
api_router.include_router(settings.router)
api_router.include_router(tags.router)
