
from fastapi import APIRouter
from models.item import ItemCreate, get_items, create_item

user_router = APIRouter(prefix="/items")


@user_router.get("/")
async def get_items_route():
    return await get_items()


@user_router.post("/")
async def create_item_route(item: ItemCreate):
    return await create_item(item)




