from typing import List

from fastapi import APIRouter, HTTPException, status

from models.ministry import (
    MinistryConflictError,
    MinistryCreate,
    MinistryNotFoundError,
    MinistryOut,
    MinistryUpdate,
    create_ministry,
    delete_ministry,
    list_ministries,
    update_ministry,
)

public_ministry_router = APIRouter(prefix="/ministries", tags=["Ministries"])
mod_ministry_router = APIRouter(prefix="/ministries", tags=["Ministries"])


@public_ministry_router.get("/ministry-names", summary="Get all unique ministry names")
async def get_ministry_names_route():
    try:
        ministries = await list_ministries()
        return [m.name for m in ministries]
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to fetch ministries", "reason": str(exc)},
        ) from exc
    
@public_ministry_router.get("/ministries", summary="Get all unique ministries")
async def get_ministries_route():
    try:
        ministries = await list_ministries()
        return ministries
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to fetch ministries", "reason": str(exc)},
        ) from exc

@public_ministry_router.get("", response_model=List[MinistryOut])
async def get_ministries(skip: int = 0, limit: int | None = None) -> List[MinistryOut]:
    return await list_ministries(skip=skip, limit=limit)


@mod_ministry_router.post("", response_model=MinistryOut, status_code=status.HTTP_201_CREATED)
async def create_ministry_route(payload: MinistryCreate) -> MinistryOut:
    try:
        return await create_ministry(payload)
    except MinistryConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@mod_ministry_router.patch("/{ministry_id}", response_model=MinistryOut)
async def rename_ministry_route(ministry_id: str, payload: MinistryUpdate) -> MinistryOut:
    try:
        return await update_ministry(ministry_id, payload)
    except MinistryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except MinistryConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@mod_ministry_router.delete("/{ministry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ministry_route(ministry_id: str) -> None:
    deleted = await delete_ministry(ministry_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ministry not found")


__all__ = [
    "public_ministry_router",
    "mod_ministry_router",
]
