from __future__ import annotations

from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import HTTPException, status

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


class ReadingPlanBase(BaseModel):
    name: str = Field('', min_length=0)
    duration: int = Field(..., ge=1)
    visible: bool = Field(default=False)

class ReadingPlanCreate(ReadingPlanBase):
    readings: Dict[str, List[BiblePassage]] = Field(default_factory=dict)

class ReadingPlanUpdate(BaseModel):
    name: Optional[str] = None
    duration: Optional[int] = Field(None, ge=1)
    readings: Optional[Dict[str, List[BiblePassage]]] = None
    visible: Optional[bool] = None

class ReadingPlan(MongoBaseModel, ReadingPlanBase):
    user_id: str
    readings: Dict[str, List[BiblePassage]] = Field(default_factory=dict)


class ReadingPlanOut(BaseModel):
    id: str
    name: str
    duration: int
    readings: Dict[str, List[BiblePassage]]
    user_id: str
    visible: bool
    created_at: datetime
    updated_at: datetime

class ReadingPlanTemplateOut(BaseModel):
    id: Optional[str] = None
    name: str
    duration: int
    readings: Dict[str, List[BiblePassage]] = Field(default_factory=dict)


def _convert_plan_doc_to_out(doc: dict) -> ReadingPlanOut:
    raw_readings = doc.get("readings", {})
    readings: Dict[str, List[BiblePassage]] = {}
    for k, v in raw_readings.items():
        readings[str(k)] = [BiblePassage(**p) if not isinstance(p, BiblePassage) else p for p in (v or [])]
    return ReadingPlanOut(
        id=str(doc["_id"]),
        name=doc["name"],
        duration=doc["duration"],
        readings=readings,
        user_id=doc["user_id"],
        visible=doc.get("visible", False),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


############################
# CRUD operations
############################

async def create_reading_plan(plan: ReadingPlanCreate, user_id: str) -> Optional[ReadingPlanOut]:
    try:
        # Ensure composite uniqueness index (user_id + name)
        try:
            await DB.db.bible_plans.create_index([
                ("user_id", 1), ("name", 1)
            ], unique=True, name="uniq_user_plan_name")
        except Exception:
            pass  # index already exists or cannot be created now

        name = (plan.name or "").strip() or "Untitled Plan"
        doc = {
            "name": name,
            "duration": plan.duration,
            "readings": {k: [p.model_dump() for p in v] for k, v in plan.readings.items()},
            "user_id": user_id,
            "visible": plan.visible,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        try:
            result = await DB.db.bible_plans.insert_one(doc)
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate reading plan name for user")

        if result.inserted_id:
            created = await DB.db.bible_plans.find_one({"_id": result.inserted_id})
            if created:
                return _convert_plan_doc_to_out(created)

        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error creating reading plan: {e}")


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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error listing reading plans: {e}")


async def get_reading_plan_by_id(plan_id: str, user_id: str) -> Optional[ReadingPlanOut]:
    try:
        doc = await DB.db.bible_plans.find_one({"_id": ObjectId(plan_id), "user_id": user_id})
        return _convert_plan_doc_to_out(doc) if doc else None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching reading plan: {e}")

async def get_reading_plans_from_user(user_id: str) -> List[ReadingPlanOut]:
    try:
        cursor = DB.db.bible_plans.find({"user_id": user_id}).sort([("created_at", -1)])
        docs = await cursor.to_list(length=None)
        return [_convert_plan_doc_to_out(d) for d in docs]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching reading plans for user: {e}")


async def update_reading_plan(plan_id: str, user_id: str, update: ReadingPlanUpdate) -> Optional[ReadingPlanOut]:
    try:
        # Ensure composite uniqueness index (user_id + name)
        await DB.db.bible_plans.create_index([
            ("user_id", 1), ("name", 1)
        ], unique=True, name="uniq_user_plan_name")
    except Exception:
        pass  # index already exists or cannot be created now
    
    try:
        update_doc: dict = {"updated_at": datetime.now()}
        if update.name is not None:
            update_doc["name"] = update.name
        if update.duration is not None:
            update_doc["duration"] = update.duration
        if update.readings is not None:
            update_doc["readings"] = {k: [p.model_dump() for p in v] for k, v in update.readings.items()}
        if update.visible is not None:
            update_doc["visible"] = update.visible
        
        result = await DB.db.bible_plans.update_one(
            {"_id": ObjectId(plan_id), "user_id": user_id},
            {"$set": update_doc},
        )
        
        if result.matched_count:
            doc = await DB.db.bible_plans.find_one({"_id": ObjectId(plan_id)})
            return _convert_plan_doc_to_out(doc) if doc else None
        return None
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate reading plan name for user on update")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating reading plan: {e}")


async def delete_reading_plan(plan_id: str, user_id: str) -> bool:
    try:
        result = await DB.db.bible_plans.delete_one({"_id": ObjectId(plan_id), "user_id": user_id})
        return result.deleted_count > 0
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting reading plan: {e}")


async def get_all_reading_plans() -> List[ReadingPlanOut]:
    """Get all bible plans from all users"""
    try:
        cursor = DB.db.bible_plans.find({}).sort([("created_at", -1)])
        docs = await cursor.to_list(length=None)
        return [_convert_plan_doc_to_out(d) for d in docs]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching all reading plans: {e}")


async def duplicate_reading_plan(plan_id: str, user_id: str) -> Optional[ReadingPlanOut]:
    """Duplicate a reading plan for the same user"""
    try:
        # Get the original plan
        original = await DB.db.bible_plans.find_one({"_id": ObjectId(plan_id)})
        if not original:
            return None
        
        # Create a copy with a new name
        original_name = original.get("name", "Untitled Plan")
        new_name = f"{original_name} (Copy)"
        
        # Check for duplicate names and add a number if needed
        counter = 1
        while await DB.db.bible_plans.find_one({"user_id": user_id, "name": new_name}):
            counter += 1
            new_name = f"{original_name} (Copy {counter})"
        
        doc = {
            "name": new_name,
            "duration": original["duration"],
            "readings": original.get("readings", {}),
            "user_id": user_id,
            "visible": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        
        result = await DB.db.bible_plans.insert_one(doc)
        if result.inserted_id:
            created = await DB.db.bible_plans.find_one({"_id": result.inserted_id})
            if created:
                return _convert_plan_doc_to_out(created)
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error duplicating reading plan: {e}")


async def get_all_bible_plan_templates() -> List[ReadingPlanTemplateOut]:
    try:
        result = await DB.db.bible_plan_templates.find({}).to_list(length=None)
        out: List[ReadingPlanTemplateOut] = []
        for doc in result:
            readings = {k: [BiblePassage(**p) for p in v] for k, v in doc.get("readings", {}).items()}
            out.append(ReadingPlanTemplateOut(id=str(doc.get("_id")), name=doc["name"], duration=doc["duration"], readings=readings))
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching bible plan templates: {e}")

async def get_bible_plan_template_by_name(template_name: str) -> Optional[ReadingPlanTemplateOut]:
    try:
        doc = await DB.db.bible_plan_templates.find_one({"name": template_name})
        if not doc:
            return None
        readings = {k: [BiblePassage(**p) for p in v] for k, v in doc.get("readings", {}).items()}
        return ReadingPlanTemplateOut(id=str(doc.get("_id")), name=doc["name"], duration=doc["duration"], readings=readings)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching bible plan template by name: {e}")

async def get_bible_plan_template_by_id(template_id: str) -> Optional[ReadingPlanTemplateOut]:
    try:
        doc = await DB.db.bible_plan_templates.find_one({"_id": ObjectId(template_id)})
        if not doc:
            return None
        readings = {k: [BiblePassage(**p) for p in v] for k, v in doc.get("readings", {}).items()}
        return ReadingPlanTemplateOut(id=str(doc.get("_id")), name=doc["name"], duration=doc["duration"], readings=readings)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching bible plan template by id: {e}")


async def get_published_reading_plans() -> List[ReadingPlanOut]:
    """Get all published Bible plans (visible=True) for public access"""
    try:
        cursor = DB.db.bible_plans.find({"visible": True}).sort([("name", -1)])
        docs = await cursor.to_list(length=None)
        return [_convert_plan_doc_to_out(d) for d in docs]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching published reading plans: {e}")


async def create_template_from_plan(plan_id: str, user_id: str) -> Optional[ReadingPlanTemplateOut]:
    """Create a template from an existing Bible plan"""
    try:
        # Get the plan
        plan = await get_reading_plan_by_id(plan_id, user_id)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
        
        # Create template document (without user_id, created_at, updated_at, visible)
        template_doc = {
            "name": plan.name,
            "duration": plan.duration,
            "readings": {k: [p.model_dump() for p in v] for k, v in plan.readings.items()}
        }
        
        # Insert into bible_plan_templates collection
        try:
            result = await DB.db.bible_plan_templates.insert_one(template_doc)
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A template with this name already exists")
        
        if result.inserted_id:
            created = await DB.db.bible_plan_templates.find_one({"_id": result.inserted_id})
            if created:
                readings = {k: [BiblePassage(**p) for p in v] for k, v in created.get("readings", {}).items()}
                return ReadingPlanTemplateOut(
                    id=str(created.get("_id")),
                    name=created["name"],
                    duration=created["duration"],
                    readings=readings
                )
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error creating template from plan: {e}")


async def update_bible_plan_template(template_id: str, name: str) -> Optional[ReadingPlanTemplateOut]:
    """Update a Bible plan template's name"""
    try:
        tid = ObjectId(template_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid template ID")
    
    try:
        result = await DB.db.bible_plan_templates.update_one(
            {"_id": tid},
            {"$set": {"name": name}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        
        updated = await DB.db.bible_plan_templates.find_one({"_id": tid})
        if updated:
            readings = {k: [BiblePassage(**p) for p in v] for k, v in updated.get("readings", {}).items()}
            return ReadingPlanTemplateOut(
                id=str(updated.get("_id")),
                name=updated["name"],
                duration=updated["duration"],
                readings=readings
            )
        return None
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A template with this name already exists")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating template: {e}")


async def delete_bible_plan_template(template_id: str) -> bool:
    """Delete a Bible plan template"""
    try:
        tid = ObjectId(template_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid template ID")
    
    try:
        result = await DB.db.bible_plan_templates.delete_one({"_id": tid})
        return result.deleted_count > 0
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting template: {e}")

