from fastapi import APIRouter
from models.item import ItemCreate, get_items, create_item

item_router = APIRouter(prefix="/items")


@item_router.get("/")
async def get_items_route():
    return await get_items()


@item_router.post("/")
async def create_item_route(item: ItemCreate):
    return await create_item(item)
