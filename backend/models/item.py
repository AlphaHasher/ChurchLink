from typing import Optional
from pydantic import BaseModel
# from helpers.DB import DB
# from bson import ObjectId


##this is an example only
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

    def __repr__(self):
        return f"Name={self.name}, description={self.description}"

    @staticmethod
    def to_out(item_data):
        return ItemOut(id=str(item_data.id), **item_data)


class ItemCreate(ItemBase):
    pass  # No 'id' in this model, used for creating a Item


class ItemOut(ItemBase):
    id: str  # We add 'id' here to include it when reading a Item


# CRUD Operations examples
async def create_item(item: ItemCreate):
    result = await DB.db["items"].insert_one(item.model_dump())
    item_data = await DB.db["items"].find_one({"_id": result.inserted_id})
    return ItemOut(id=str(item_data["_id"]), **item_data)

async def get_item_by_id(item_id: str):
    item = await DB.db["items"].find_one({"_id": ObjectId(item_id)})
    if item:
        return ItemOut(id=str(item["_id"]), **item)
    return None

async def update_item(item_id: str, item: ItemCreate):
    result = await DB.db["items"].update_one({"_id": ObjectId(item_id)}, {"$set": item.model_dump()})
    return result.modified_count > 0

async def get_items(skip: int = 0, limit: int = 100):
    items_cursor = DB.db["items"].find().skip(skip).limit(limit)
    items = await items_cursor.to_list(length=limit)
    return [ItemOut(id=str(item["_id"]), **item) for item in items]

async def delete_item(item_id: str):
    result = await DB.db["items"].delete_one({"_id": ObjectId(item_id)})
    return result.deleted_count > 0
