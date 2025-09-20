from __future__ import annotations

from typing import Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId

from mongo.database import DB
from models.base.ssbc_base_model import MongoBaseModel


class FormBase(BaseModel):
    title: str = Field(...)
    ru_title: Optional[str] = Field(None)
    folder: Optional[str] = Field(None)
    description: Optional[str] = Field(None)
    visible: bool = Field(True)


class FormCreate(FormBase):
    data: Any = Field(default_factory=dict)


class FormUpdate(BaseModel):
    title: Optional[str] = None
    ru_title: Optional[str] = None
    folder: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    data: Optional[Any] = None


class Form(MongoBaseModel, FormBase):
    user_id: str
    data: Any = Field(default_factory=dict)
    responses: List[Any] = Field(default_factory=list)


class FormOut(BaseModel):
    id: str
    title: str
    ru_title: Optional[str]
    folder: Optional[str]
    description: Optional[str]
    user_id: str
    visible: bool
    data: Any
    responses: List[Any]
    created_at: datetime
    updated_at: datetime


def _doc_to_out(doc: dict) -> FormOut:
    return FormOut(
        id=str(doc.get("_id")),
        title=doc.get("title"),
            ru_title=doc.get("ru_title"),
            folder=doc.get("folder"),
            description=doc.get("description"),
        user_id=doc.get("user_id"),
        visible=doc.get("visible", True),
        data=doc.get("data", {}),
        responses=doc.get("responses", []),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


############################
# CRUD operations
############################


async def create_form(form: FormCreate, user_id: str) -> Optional[FormOut]:
    try:
        doc = {
            "title": (form.title or "").strip() or "Untitled Form",
            "ru_title": form.ru_title,
            "folder": form.folder,
            "description": form.description,
            "user_id": user_id,
            "visible": form.visible if hasattr(form, "visible") else True,
            # Remove any meta/title/description fields from data to avoid duplicate metadata storage
            "data": ({k: v for k, v in (form.data or {}).items() if k not in ['meta', 'title', 'description']} if isinstance(form.data, dict) else form.data),
            "responses": [],
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        result = await DB.db.forms.insert_one(doc)
        if result.inserted_id:
            created = await DB.db.forms.find_one({"_id": result.inserted_id})
            if created:
                return _doc_to_out(created)
        return None
    except Exception as e:
        print(f"Error creating form: {e}")
        return None


async def list_forms(user_id: str, skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        cursor = DB.db.forms.find({"user_id": user_id}).skip(skip).limit(limit).sort([("created_at", -1)])
        docs = await cursor.to_list(length=limit)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        print(f"Error listing forms: {e}")
        return []


async def search_forms(user_id: str, name: Optional[str] = None, folder: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        query: dict = {"user_id": user_id}
        if name:
            # case-insensitive partial match on title
            query["title"] = {"$regex": name, "$options": "i"}
        if folder:
            query["folder"] = {"$regex": f"^{folder}$", "$options": "i"}

        cursor = DB.db.forms.find(query).skip(skip).limit(limit).sort([("created_at", -1)])
        docs = await cursor.to_list(length=limit)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        print(f"Error searching forms: {e}")
        return []


###########################
# Folder management
###########################


async def create_folder(user_id: str, name: str) -> Optional[dict]:
    try:
        # Prevent duplicate folder names for the same user (case-insensitive)
        existing = await DB.db.form_folders.find_one({"user_id": user_id, "name": {"$regex": f"^{name}$", "$options": "i"}})
        if existing:
            return None

        doc = {"user_id": user_id, "name": name, "created_at": datetime.now()}
        result = await DB.db.form_folders.insert_one(doc)
        if result.inserted_id:
            created = await DB.db.form_folders.find_one({"_id": result.inserted_id})
            if created:
                return {"_id": str(created.get("_id")), "name": created.get("name"), "created_at": created.get("created_at")}
        return None
    except Exception as e:
        print(f"Error creating folder: {e}")
        return None


async def list_folders(user_id: str) -> List[dict]:
    try:
        cursor = DB.db.form_folders.find({"user_id": user_id}).sort([("created_at", -1)])
        docs = await cursor.to_list(length=None)
        # Convert ObjectId to string for JSON serialization
        out = []
        for d in docs:
            out.append({"_id": str(d.get("_id")), "name": d.get("name"), "created_at": d.get("created_at")})
        return out
    except Exception as e:
        print(f"Error listing folders: {e}")
        return []


async def get_form_by_id(form_id: str, user_id: str) -> Optional[FormOut]:
    try:
        doc = await DB.db.forms.find_one({"_id": ObjectId(form_id), "user_id": user_id})
        return _doc_to_out(doc) if doc else None
    except Exception as e:
        print(f"Error fetching form: {e}")
        return None


async def update_form(form_id: str, user_id: str, update: FormUpdate) -> Optional[FormOut]:
    try:
        update_doc = {"updated_at": datetime.now()}
        if update.title is not None:
            update_doc["title"] = update.title
        if update.ru_title is not None:
            update_doc["ru_title"] = update.ru_title
        if update.description is not None:
            update_doc["description"] = update.description
        if update.visible is not None:
            update_doc["visible"] = update.visible
        if update.data is not None:
            # Strip any meta/title/description keys from incoming data
            update_doc["data"] = ({k: v for k, v in (update.data or {}).items() if k not in ['meta', 'title', 'description']} if isinstance(update.data, dict) else update.data)

        result = await DB.db.forms.update_one({"_id": ObjectId(form_id), "user_id": user_id}, {"$set": update_doc})
        if result.matched_count:
            doc = await DB.db.forms.find_one({"_id": ObjectId(form_id)})
            return _doc_to_out(doc) if doc else None
        return None
    except Exception as e:
        print(f"Error updating form: {e}")
        return None


async def delete_form(form_id: str, user_id: str) -> bool:
    try:
        result = await DB.db.forms.delete_one({"_id": ObjectId(form_id), "user_id": user_id})
        return result.deleted_count > 0
    except Exception as e:
        print(f"Error deleting form: {e}")
        return False
