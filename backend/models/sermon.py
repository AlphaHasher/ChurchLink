from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Set
from urllib.parse import parse_qs, urlparse

from bson import ObjectId  # type: ignore[import]
from pydantic import BaseModel, Field, HttpUrl

from helpers.MongoHelper import serialize_objectid_deep
from mongo.database import DB
from models.ministry import canonicalize_ministry_ids


class SermonBase(BaseModel):
    title: str
    description: str
    speaker: str
    ministry: List[str]
    youtube_url: HttpUrl
    date_posted: datetime
    published: bool
    roles: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[HttpUrl] = None
    tags: List[str] = Field(default_factory=list)
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    summary: Optional[str] = None


class SermonCreate(SermonBase):
    video_id: Optional[str] = None


class SermonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    speaker: Optional[str] = None
    ministry: Optional[List[str]] = None
    youtube_url: Optional[HttpUrl] = None
    video_id: Optional[str] = None
    date_posted: Optional[datetime] = None
    published: Optional[bool] = None
    roles: Optional[List[str]] = None
    thumbnail_url: Optional[HttpUrl] = None
    tags: Optional[List[str]] = None
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    summary: Optional[str] = None


class SermonOut(SermonBase):
    id: str
    video_id: str
    created_at: datetime
    updated_at: datetime
    is_favorited: Optional[bool] = None


def normalize_youtube_video_id(url_or_id: str) -> str:
    """Extract a canonical YouTube video ID from a URL or bare ID string."""
    candidate = (url_or_id or "").strip()
    if not candidate:
        raise ValueError("YouTube URL or ID is required")

    # Bare video ID (11 characters, no URL components)
    if "//" not in candidate and "?" not in candidate and "/" not in candidate:
        if len(candidate) == 11:
            return candidate
        raise ValueError("Invalid YouTube video ID format")

    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()

    if host in {"youtu.be", "www.youtu.be"}:
        path_part = parsed.path.lstrip("/")
        if path_part:
            return path_part.split("/")[0]

    if "youtube.com" in host:
        if parsed.path.startswith("/embed/"):
            return parsed.path.split("/embed/")[-1].split("/")[0]
        if parsed.path.startswith("/shorts/"):
            return parsed.path.split("/shorts/")[-1].split("/")[0]
        query = parse_qs(parsed.query)
        video_values = query.get("v")
        if video_values:
            return video_values[0]

    raise ValueError("Unable to determine YouTube video ID")


async def _fetch_sermon_document(filter_query: dict) -> Optional[SermonOut]:
    if DB.db is None:
        return None

    document = await DB.db["sermons"].find_one(filter_query)
    if not document:
        return None
    document["id"] = str(document.pop("_id"))
    serialized = serialize_objectid_deep(document)
    return SermonOut(**serialized)


async def create_sermon(sermon: SermonCreate) -> Optional[SermonOut]:
    if DB.db is None:
        return None

    try:
        video_id = sermon.video_id or normalize_youtube_video_id(
            str(sermon.youtube_url)
        )
    except ValueError:
        return None

    payload = sermon.model_dump()
    payload["video_id"] = video_id
    payload["youtube_url"] = str(sermon.youtube_url)
    if sermon.thumbnail_url is not None:
        payload["thumbnail_url"] = str(sermon.thumbnail_url)

    # Convert ministry names to ObjectIds
    ministry_ids = payload.get("ministry", [])
    try:
        ministry_ids = await canonicalize_ministry_ids(ministry_ids)
        payload["ministry"] = ministry_ids
    except Exception as exc:
        print(f"Error converting ministry IDs: {exc}")
        return None

    now = datetime.utcnow()
    payload["created_at"] = now
    payload["updated_at"] = now

    try:
        inserted_id = await DB.insert_document("sermons", payload)
    except Exception as exc:
        print(f"Error inserting sermon: {exc}")
        return None

    if not inserted_id:
        return None

    return await get_sermon_by_id(str(inserted_id))


async def get_sermon_by_id(sermon_id: str) -> Optional[SermonOut]:
    if DB.db is None:
        return None

    try:
        object_id = ObjectId(sermon_id)
    except Exception:
        return None
    return await _fetch_sermon_document({"_id": object_id})


async def get_sermon_by_video_id(video_id: str) -> Optional[SermonOut]:
    if DB.db is None:
        return None
    return await _fetch_sermon_document({"video_id": video_id})


async def get_sermon_by_title(title: str) -> Optional[SermonOut]:
    if DB.db is None:
        return None
    return await _fetch_sermon_document({"title": title})


async def update_sermon(sermon_id: str, updates: SermonUpdate) -> bool:
    if DB.db is None:
        return False

    try:
        object_id = ObjectId(sermon_id)
    except Exception:
        return False

    update_payload = updates.model_dump(exclude_unset=True)

    if "youtube_url" in update_payload and not update_payload.get("video_id"):
        try:
            update_payload["video_id"] = normalize_youtube_video_id(
                str(update_payload["youtube_url"])
            )
        except ValueError:
            return False

    # Convert ministry names to ObjectIds if present
    if "ministry" in update_payload and update_payload["ministry"]:
        try:
            update_payload["ministry"] = await canonicalize_ministry_ids(
                update_payload["ministry"]
            )
        except Exception as exc:
            print(f"Error converting ministry IDs: {exc}")
            return False

    if not update_payload:
        return False

    update_payload["updated_at"] = datetime.utcnow()
    if "youtube_url" in update_payload and update_payload["youtube_url"] is not None:
        update_payload["youtube_url"] = str(update_payload["youtube_url"])
    if (
        "thumbnail_url" in update_payload
        and update_payload["thumbnail_url"] is not None
    ):
        update_payload["thumbnail_url"] = str(update_payload["thumbnail_url"])

    try:
        result = await DB.db["sermons"].update_one(
            {"_id": object_id}, {"$set": update_payload}
        )
        return result.modified_count > 0
    except Exception as exc:
        print(f"Error updating sermon {sermon_id}: {exc}")
        return False


async def delete_sermon(sermon_id: str) -> bool:
    if DB.db is None:
        return False

    try:
        object_id = ObjectId(sermon_id)
    except Exception:
        return False

    try:
        result = await DB.db["sermons"].delete_one({"_id": object_id})
        return result.deleted_count > 0
    except Exception as exc:
        print(f"Error deleting sermon {sermon_id}: {exc}")
        return False


async def list_sermons(
    *,
    skip: int = 0,
    limit: int = 100,
    ministry: Optional[str] = None,
    speaker: Optional[str] = None,
    tags: Optional[List[str]] = None,
    date_after: Optional[datetime] = None,
    date_before: Optional[datetime] = None,
    published: Optional[bool] = None,
    favorite_ids: Optional[Set[str]] = None,
    favorites_only: Optional[bool] = None,
) -> List[SermonOut]:
    query: dict = {}

    if ministry:
        query["ministry"] = {"$in": [ministry]}
    if speaker:
        query["speaker"] = {"$regex": speaker, "$options": "i"}
    if tags:
        query["tags"] = {"$all": tags}
    if published is not None:
        query["published"] = published

    if date_after:
        query.setdefault("date_posted", {})["$gte"] = date_after
    if date_before:
        query.setdefault("date_posted", {})["$lte"] = date_before

    if favorites_only and favorite_ids:
        query["_id"] = {"$in": [ObjectId(fid) for fid in favorite_ids]}

    if DB.db is None:
        return []

    cursor = DB.db["sermons"].find(query).sort("date_posted", -1)
    if skip:
        cursor = cursor.skip(skip)
    if limit:
        cursor = cursor.limit(limit)

    documents = await cursor.to_list(length=limit or None)
    sermons: List[SermonOut] = []
    for document in documents:
        document["id"] = str(document.pop("_id"))
        serialized = serialize_objectid_deep(document)
        if favorite_ids is not None:
            serialized["is_favorited"] = serialized.get("id") in favorite_ids
        sermons.append(SermonOut(**serialized))
    return sermons


async def search_sermons(
    query_text: str,
    *,
    skip: int = 0,
    limit: int = 100,
    ministry: Optional[str] = None,
    speaker: Optional[str] = None,
    tags: Optional[List[str]] = None,
    published: Optional[bool] = None,
    favorite_ids: Optional[Set[str]] = None,
    favorites_only: Optional[bool] = None,
) -> List[SermonOut]:
    query: dict = {"$text": {"$search": query_text}}

    if ministry:
        query["ministry"] = {"$in": [ministry]}
    if speaker:
        query["speaker"] = {"$regex": speaker, "$options": "i"}
    if tags:
        query["tags"] = {"$all": tags}
    if published is not None:
        query["published"] = published

    if favorites_only and favorite_ids:
        query["_id"] = {"$in": [ObjectId(fid) for fid in favorite_ids]}

    if DB.db is None:
        return []

    cursor = DB.db["sermons"].find(query).sort([("score", {"$meta": "textScore"})])
    if skip:
        cursor = cursor.skip(skip)
    if limit:
        cursor = cursor.limit(limit)

    documents = await cursor.to_list(length=limit or None)
    sermons: List[SermonOut] = []
    for document in documents:
        document["id"] = str(document.pop("_id"))
        serialized = serialize_objectid_deep(document)
        if favorite_ids is not None:
            serialized["is_favorited"] = serialized.get("id") in favorite_ids
        sermons.append(SermonOut(**serialized))
    return sermons
