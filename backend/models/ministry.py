from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, field_validator

from mongo.database import DB

logger = logging.getLogger(__name__)


class MinistryConflictError(Exception):
    """Raised when attempting to create or rename a ministry to a duplicate name."""


class MinistryNotFoundError(Exception):
    """Raised when a ministry cannot be found for an operation."""


class MinistryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        cleaned = " ".join(value.split()).strip()
        if not cleaned:
            raise ValueError("Ministry name cannot be empty")
        return cleaned


class MinistryCreate(MinistryBase):
    pass


class MinistryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = " ".join(value.split()).strip()
        if not cleaned:
            raise ValueError("Ministry name cannot be empty")
        return cleaned


class MinistryOut(MinistryBase):
    id: str
    created_at: datetime
    updated_at: datetime


def _normalize(name: str) -> tuple[str, str]:
    cleaned = " ".join(name.split()).strip()
    normalized = cleaned.lower()
    return cleaned, normalized


def _doc_to_out(doc: dict) -> MinistryOut:
    return MinistryOut(
        id=str(doc.get("_id")),
        name=doc.get("name"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


async def list_ministries(
    skip: int = 0, limit: Optional[int] = None
) -> List[MinistryOut]:
    if DB.db is None:
        return []
    cursor = DB.db["ministries"].find({}).sort("name", 1)
    if skip:
        cursor = cursor.skip(int(skip))
    if limit is not None:
        cursor = cursor.limit(int(limit))
    documents = await cursor.to_list(length=limit or None)
    return [_doc_to_out(doc) for doc in documents]


async def get_ministry_by_id(ministry_id: str) -> Optional[MinistryOut]:
    if DB.db is None:
        return None
    try:
        oid = ObjectId(ministry_id)
    except Exception:
        return None
    doc = await DB.db["ministries"].find_one({"_id": oid})
    if not doc:
        return None
    return _doc_to_out(doc)


async def _ensure_connection() -> None:
    if DB.db is None:
        raise RuntimeError("Database not initialized")


async def create_ministry(payload: MinistryCreate) -> MinistryOut:
    await _ensure_connection()
    name, normalized = _normalize(payload.name)
    existing = await DB.db["ministries"].find_one({"normalized_name": normalized})
    if existing:
        raise MinistryConflictError("Ministry already exists")

    now = datetime.utcnow()
    doc = {
        "name": name,
        "normalized_name": normalized,
        "created_at": now,
        "updated_at": now,
    }
    result = await DB.db["ministries"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_out(doc)


async def update_ministry(ministry_id: str, update: MinistryUpdate) -> MinistryOut:
    await _ensure_connection()
    try:
        oid = ObjectId(ministry_id)
    except Exception as exc:  # pragma: no cover - defensive
        raise MinistryNotFoundError("Invalid ministry id") from exc

    current = await DB.db["ministries"].find_one({"_id": oid})
    if not current:
        raise MinistryNotFoundError("Ministry not found")

    if update.name is None:
        return _doc_to_out(current)

    new_name, normalized = _normalize(update.name)
    existing = await DB.db["ministries"].find_one(
        {
            "normalized_name": normalized,
            "_id": {"$ne": oid},
        }
    )
    if existing:
        raise MinistryConflictError("Ministry already exists")

    await DB.db["ministries"].update_one(
        {"_id": oid},
        {
            "$set": {
                "name": new_name,
                "normalized_name": normalized,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    try:
        await _replace_ministry_name_in_references(current.get("name"), new_name)
    except Exception as exc:  # pragma: no cover - best effort logging
        logger.error(
            "Failed to propagate ministry rename from '%s' to '%s': %s",
            current.get("name"),
            new_name,
            exc,
        )

    updated = await DB.db["ministries"].find_one({"_id": oid})
    return _doc_to_out(updated)


async def delete_ministry(ministry_id: str) -> bool:
    await _ensure_connection()
    try:
        oid = ObjectId(ministry_id)
    except Exception:
        return False

    doc = await DB.db["ministries"].find_one({"_id": oid})
    if not doc:
        return False

    result = await DB.db["ministries"].delete_one({"_id": oid})
    if result.deleted_count:
        try:
            # Remove ministry reference from all associated content (don't delete the content)
            await _remove_ministry_from_references(ministry_id)
        except Exception as exc:  # pragma: no cover - best effort logging
            logger.error(
                "Failed to remove ministry '%s' (ID: %s) from references: %s",
                doc.get("name"),
                ministry_id,
                exc,
            )
        return True
    return False


async def canonicalize_ministry_names(raw_names: Optional[List[str]]) -> List[str]:
    await _ensure_connection()
    if not raw_names:
        return []

    normalized_order: List[str] = []
    normalized_to_cleaned: dict[str, str] = {}
    for raw in raw_names:
        if raw is None:
            continue
        cleaned, normalized = _normalize(str(raw))
        if normalized in normalized_to_cleaned:
            continue
        normalized_to_cleaned[normalized] = cleaned
        normalized_order.append(normalized)

    if not normalized_order:
        return []

    cursor = DB.db["ministries"].find({"normalized_name": {"$in": normalized_order}})
    docs = await cursor.to_list(length=None)
    lookup = {doc.get("normalized_name"): doc.get("name") for doc in docs}

    missing = [normalized_to_cleaned[n] for n in normalized_order if n not in lookup]
    if missing:
        raise MinistryNotFoundError(f"Unknown ministries: {', '.join(missing)}")

    return [lookup[n] for n in normalized_order]


async def resolve_ministry_name(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    try:
        canonical = await canonicalize_ministry_names([name])
    except MinistryNotFoundError:
        return None
    return canonical[0] if canonical else None


async def canonicalize_ministry_ids(raw_names: Optional[List[str]]) -> List[str]:
    """
    Convert ministry names to their ObjectId hex strings.

    Args:
        raw_names: List of ministry names

    Returns:
        List of ObjectId hex strings corresponding to the ministries

    Raises:
        MinistryNotFoundError: If any ministry name doesn't exist
    """
    await _ensure_connection()
    if not raw_names:
        return []

    normalized_order: List[str] = []
    normalized_to_cleaned: dict[str, str] = {}
    for raw in raw_names:
        if raw is None:
            continue
        cleaned, normalized = _normalize(str(raw))
        if normalized in normalized_to_cleaned:
            continue
        normalized_to_cleaned[normalized] = cleaned
        normalized_order.append(normalized)

    if not normalized_order:
        return []

    cursor = DB.db["ministries"].find({"normalized_name": {"$in": normalized_order}})
    docs = await cursor.to_list(length=None)
    lookup = {doc.get("normalized_name"): str(doc.get("_id")) for doc in docs}

    missing = [normalized_to_cleaned[n] for n in normalized_order if n not in lookup]
    if missing:
        raise MinistryNotFoundError(f"Unknown ministries: {', '.join(missing)}")

    return [lookup[n] for n in normalized_order]


async def denormalize_ministry_ids(ministry_ids: Optional[List[str]]) -> List[str]:
    """
    Convert ministry ObjectId hex strings to their names.

    Args:
        ministry_ids: List of ObjectId hex strings

    Returns:
        List of ministry names corresponding to the IDs
    """
    await _ensure_connection()
    if not ministry_ids:
        return []

    # Filter valid ObjectIds
    valid_ids = []
    for mid in ministry_ids:
        if mid is None:
            continue
        try:
            ObjectId(mid)
            valid_ids.append(mid)
        except Exception:
            continue

    if not valid_ids:
        return []

    # Convert to ObjectId objects
    oid_list = [ObjectId(mid) for mid in valid_ids]

    cursor = DB.db["ministries"].find({"_id": {"$in": oid_list}})
    docs = await cursor.to_list(length=None)

    # Map IDs to names preserving order
    id_to_name = {str(doc.get("_id")): doc.get("name") for doc in docs}
    return [id_to_name[mid] for mid in valid_ids if mid in id_to_name]


async def _replace_ministry_name_in_references(
    old_name: Optional[str], new_name: str
) -> None:
    # Note: Since all collections now store ObjectIds, ministry renames don't require
    # updating references in forms, events, sermons, or bulletins.
    # The ObjectId remains constant even when the ministry name changes.
    pass


async def _remove_ministry_from_references(ministry_id: str) -> None:
    """Remove ministry ObjectId from all references (used when ministry is deleted without cascade)."""
    if not ministry_id or DB.db is None:
        return
    await DB.db["events"].update_many({}, {"$pull": {"ministries": ministry_id}})
    await DB.db["sermons"].update_many({}, {"$pull": {"ministry": ministry_id}})
    await DB.db["bulletins"].update_many({}, {"$pull": {"ministries": ministry_id}})
    await DB.db["forms"].update_many({}, {"$pull": {"ministries": ministry_id}})