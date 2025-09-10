from __future__ import annotations

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator
from bson import ObjectId

from mongo.database import DB
from models.base.ssbc_base_model import MongoBaseModel
from models.bible_note import BIBLE_BOOKS


def _validate_book_name(book: str) -> None:
    if book not in BIBLE_BOOKS:
        raise ValueError(f"Invalid Bible book: {book}")


class BiblePassage(BaseModel):
    id: str
    book: str
    chapter: int
    endChapter: Optional[int] = None
    startVerse: Optional[int] = None
    endVerse: Optional[int] = None
    reference: str

    model_config = ConfigDict(extra='ignore')

    @model_validator(mode='after')
    def _validate(self):
        _validate_book_name(self.book)
        if self.chapter < 1:
            raise ValueError("chapter must be >= 1")
        if self.endChapter is not None and self.endChapter < self.chapter:
            # Allow front-to-back ranges only
            raise ValueError("endChapter must be >= chapter")
        if self.startVerse is not None and self.startVerse < 1:
            raise ValueError("startVerse must be >= 1")
        if self.endVerse is not None and self.endVerse < 1:
            raise ValueError("endVerse must be >= 1")
        if self.startVerse is not None and self.endVerse is not None and self.endVerse < self.startVerse:
            # Only within a single chapter do we enforce ordering; cross-chapter ranges are represented via endChapter
            if self.endChapter is None or self.endChapter == self.chapter:
                raise ValueError("endVerse must be >= startVerse when within a single chapter")
        return self


class PlanDay(BaseModel):
    dayNumber: int = Field(..., ge=1)
    passages: List[BiblePassage] = Field(default_factory=list)


class ReadingPlanBase(BaseModel):
    name: str = Field('', min_length=0)
    duration: int = Field(..., ge=1)
    template: Optional[str] = ""
    # Allow extra fields like `id` from the frontend without failing validation
    model_config = ConfigDict(extra='ignore')


class ReadingPlanCreate(ReadingPlanBase):
    days: List[PlanDay] = Field(default_factory=list)


class ReadingPlanUpdate(BaseModel):
    name: Optional[str] = None
    duration: Optional[int] = Field(None, ge=1)
    template: Optional[str] = None
    days: Optional[List[PlanDay]] = None


class ReadingPlan(MongoBaseModel, ReadingPlanBase):
    user_id: str
    days: List[PlanDay] = Field(default_factory=list)


class ReadingPlanOut(BaseModel):
    id: str
    name: str
    duration: int
    template: Optional[str]
    days: List[PlanDay]
    user_id: str
    created_at: datetime
    updated_at: datetime


def _convert_plan_doc_to_out(doc: dict) -> ReadingPlanOut:
    return ReadingPlanOut(
        id=str(doc["_id"]),
        name=doc["name"],
        duration=doc["duration"],
        template=doc.get("template", ""),
        days=[PlanDay(**d) for d in doc.get("days", [])],
        user_id=doc["user_id"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


############################
# CRUD operations
############################

async def create_reading_plan(plan: ReadingPlanCreate, user_id: str) -> Optional[ReadingPlanOut]:
    try:
        name = (plan.name or "").strip() or "Untitled Plan"
        doc = {
            "name": name,
            "duration": plan.duration,
            "template": plan.template or "",
            "days": [d.model_dump() for d in plan.days],
            "user_id": user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        result = await DB.db.bible_plans.insert_one(doc)
        if result.inserted_id:
            created = await DB.db.bible_plans.find_one({"_id": result.inserted_id})
            if created:
                return _convert_plan_doc_to_out(created)
        return None
    except Exception as e:
        print(f"Error creating reading plan: {e}")
        return None


async def list_reading_plans(user_id: str, skip: int = 0, limit: int = 100) -> List[ReadingPlanOut]:
    try:
        cursor = (
            DB.db.bible_plans
            .find({"user_id": user_id})
            .skip(skip)
            .limit(limit)
            .sort([("created_at", -1)])
        )
        docs = await cursor.to_list(length=limit)
        return [_convert_plan_doc_to_out(d) for d in docs]
    except Exception as e:
        print(f"Error listing reading plans: {e}")
        return []


async def get_reading_plan_by_id(plan_id: str, user_id: str) -> Optional[ReadingPlanOut]:
    try:
        doc = await DB.db.bible_plans.find_one({"_id": ObjectId(plan_id), "user_id": user_id})
        return _convert_plan_doc_to_out(doc) if doc else None
    except Exception as e:
        print(f"Error fetching reading plan: {e}")
        return None


async def update_reading_plan(plan_id: str, user_id: str, update: ReadingPlanUpdate) -> Optional[ReadingPlanOut]:
    try:
        update_doc: dict = {"updated_at": datetime.now()}
        if update.name is not None:
            update_doc["name"] = update.name
        if update.duration is not None:
            update_doc["duration"] = update.duration
        if update.template is not None:
            update_doc["template"] = update.template
        if update.days is not None:
            update_doc["days"] = [d.model_dump() for d in update.days]

        result = await DB.db.bible_plans.update_one(
            {"_id": ObjectId(plan_id), "user_id": user_id},
            {"$set": update_doc},
        )
        if result.matched_count:
            doc = await DB.db.bible_plans.find_one({"_id": ObjectId(plan_id)})
            return _convert_plan_doc_to_out(doc) if doc else None
        return None
    except Exception as e:
        print(f"Error updating reading plan: {e}")
        return None


async def delete_reading_plan(plan_id: str, user_id: str) -> bool:
    try:
        result = await DB.db.bible_plans.delete_one({"_id": ObjectId(plan_id), "user_id": user_id})
        return result.deleted_count > 0
    except Exception as e:
        print(f"Error deleting reading plan: {e}")
        return False


