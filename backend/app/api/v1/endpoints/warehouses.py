from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.db.session import get_db
from app.models.membership import Membership
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.warehouse import MemberResponse, WarehouseCreateRequest, WarehouseResponse

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehouseResponse])
def list_warehouses(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WarehouseResponse]:
    rows = db.scalars(
        select(Warehouse)
        .join(Membership, Membership.warehouse_id == Warehouse.id)
        .where(Membership.user_id == current_user.id)
        .order_by(Warehouse.created_at.desc())
    )
    return [WarehouseResponse.model_validate(r) for r in rows.all()]


@router.post("", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseResponse:
    warehouse = Warehouse(name=payload.name.strip(), created_by=current_user.id)
    db.add(warehouse)
    db.flush()

    membership = Membership(user_id=current_user.id, warehouse_id=warehouse.id)
    db.add(membership)
    db.commit()
    db.refresh(warehouse)
    return WarehouseResponse.model_validate(warehouse)


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: str,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> WarehouseResponse:
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return WarehouseResponse.model_validate(warehouse)


@router.get("/{warehouse_id}/members", response_model=list[MemberResponse])
def get_members(
    warehouse_id: str,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[MemberResponse]:
    members = db.scalars(select(Membership).where(Membership.warehouse_id == warehouse_id))
    return [
        MemberResponse(user_id=m.user_id, warehouse_id=m.warehouse_id, created_at=m.created_at)
        for m in members.all()
    ]
