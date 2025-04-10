from fastapi import APIRouter
from models.item import ItemCreate, get_items, create_item, get_item_by_id, update_item, delete_item

item_router = APIRouter(prefix="/items", tags=["Items"])


@item_router.get("/")
async def get_items_route():
    return await get_items()


@item_router.post("/")
async def create_item_route(item: ItemCreate):
    return await create_item(item)


@item_router.get("/{item_id}")
async def get_item_route(item_id: str):
    return await get_item_by_id(item_id)


@item_router.put("/{item_id}")
async def update_item_route(item_id: str, item: ItemCreate):
    return await update_item(item_id, item)


@item_router.patch("/{item_id}")
async def patch_item_route(item_id: str, item: ItemCreate):
    return await update_item(item_id, item)


@item_router.delete("/{item_id}")
async def delete_item_route(item_id: str):
    return await delete_item(item_id)
