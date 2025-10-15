import os
from typing import Optional, List, Dict, Any
from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from bson import ObjectId

from mongo.database import DB

# =========================
# Collection wiring
# =========================

COLLECTION_NAME = "image_data"

_indexes_ensured = False

async def _get_collection():
    """
    Return the Motor collection handle from your shared DB wrapper.
    Assumes DB.init_db() has been called by the app on startup.
    """
    global _indexes_ensured
    coll = DB.db[COLLECTION_NAME]
    if not _indexes_ensured:
        await coll.create_index("path")
        await coll.create_index("created_at")
        _indexes_ensured = True
    return coll

# =========================
# Core Image Models
# =========================

class ImageData(BaseModel):
    name: str
    description: Optional[str] = None
    extension: str
    path: str


class ImageDataInDB(ImageData):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# =========================
# Request / Response Models
# =========================

class UploadImageRequest(BaseModel):
    folder: Optional[str] = None
    description: Optional[str] = None

    @field_validator("folder")
    @classmethod
    def _clean_folder(cls, v):
        if v is None:
            return None
        v = v.strip().strip("/")
        return v or ""


class ImageResponse(BaseModel):
    id: str
    name: str
    extension: str
    description: Optional[str] = None
    folder: str
    path: str
    public_url: str
    thumb_url: str


class ImageUpdateRequest(BaseModel):
    new_name: Optional[str] = None
    new_description: Optional[str] = None
    move_to_folder: Optional[str] = None

    @field_validator("move_to_folder")
    @classmethod
    def _clean_move_to(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().strip("/")
        return v


class FolderCreateRequest(BaseModel):
    path: str

    @field_validator("path")
    @classmethod
    def _clean_path(cls, v):
        v = v.strip().strip("/")
        if not v:
            raise ValueError("path must not be empty or root")
        return v


class FolderRenameRequest(BaseModel):
    path: str
    new_name: str

    @field_validator("path", "new_name")
    @classmethod
    def _no_blank(cls, v):
        v = v.strip().strip("/")
        if not v:
            raise ValueError("value must not be empty")
        return v


class FolderMoveRequest(BaseModel):
    path: str
    new_parent: Optional[str] = ""

    @field_validator("path")
    @classmethod
    def _clean_and_require_path(cls, v):
        v = v.strip().strip("/")
        if not v:
            raise ValueError("value must not be empty or root")
        return v

    @field_validator("new_parent")
    @classmethod
    def _clean_parent(cls, v):
        if v is None:
            return ""
        return v.strip().strip("/")


class FolderDeleteRequest(BaseModel):
    path: str
    delete_within: bool

    @field_validator("path")
    @classmethod
    def _clean_del_path(cls, v):
        v = v.strip().strip("/")
        if not v:
            raise ValueError("path must not be empty or root")
        return v


class FolderResponse(BaseModel):
    path: str
    action: str
    details: Optional[Dict[str, Any]] = None

# =================================
# CRUD for single images in MongoDB
# =================================

async def create_image_data_with_id(_id: ObjectId, payload: ImageData) -> str:
    col = await _get_collection()
    doc = {
        "_id": _id,
        "name": payload.name,
        "description": payload.description,
        "extension": payload.extension,
        "path": payload.path,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await col.insert_one(doc)
    return str(_id)

async def get_image_data(id_str: str) -> Optional[Dict[str, Any]]:
    col = await _get_collection()
    try:
        _id = ObjectId(id_str)
    except Exception:
        return None
    doc = await col.find_one({"_id": _id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc

async def list_image_data(limit: Optional[int] = None, folder: Optional[str] = None) -> List[Dict[str, Any]]:
    col = await _get_collection()
    query: Dict[str, Any] = {}
    if folder is not None:
        prefix = "data/assets/" if folder == "" else f"data/assets/{folder.strip('/')}/"
        query["path"] = {"$regex": f"^{prefix}"}
    cursor = col.find(query).sort("created_at", -1)
    if limit:
        cursor = cursor.limit(limit)
    results = []
    async for d in cursor:
        d["_id"] = str(d["_id"])
        results.append(d)
    return results

async def update_image_data(id_str: str, updates: Dict[str, Any]) -> bool:
    col = await _get_collection()
    try:
        _id = ObjectId(id_str)
    except Exception:
        return False
    updates = {k: v for k, v in updates.items() if v is not None}
    if not updates:
        return True
    updates["updated_at"] = datetime.utcnow()
    res = await col.update_one({"_id": _id}, {"$set": updates})
    return res.modified_count > 0

async def delete_image_data(id_str: str) -> bool:
    col = await _get_collection()
    try:
        _id = ObjectId(id_str)
    except Exception:
        return False
    res = await col.delete_one({"_id": _id})
    return res.deleted_count > 0

# ==================================
# Bulk path edits for folder changes
# ==================================

async def bulk_repath_prefix(old_prefix: str, new_prefix: str) -> int:
    col = await _get_collection()
    cursor = col.find({"path": {"$regex": f"^{old_prefix}"}})
    docs = [d async for d in cursor]
    modified = 0
    for d in docs:
        _id = d["_id"]
        path = d["path"]
        new_path = new_prefix + path[len(old_prefix):]
        res = await col.update_one({"_id": ObjectId(_id) if isinstance(_id, str) else _id},
                                   {"$set": {"path": new_path, "updated_at": datetime.utcnow()}})
        modified += res.modified_count
    return modified

async def bulk_delete_by_prefix(prefix: str) -> int:
    col = await _get_collection()
    res = await col.delete_many({"path": {"$regex": f"^{prefix}"}})
    return res.deleted_count
