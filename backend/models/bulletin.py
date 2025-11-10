from __future__ import annotations

import os
from datetime import datetime, time, timedelta
from typing import List, Optional, Set

from bson import ObjectId
from pydantic import BaseModel, Field, HttpUrl
from pymongo.errors import DuplicateKeyError

from helpers.MongoHelper import serialize_objectid_deep
from helpers.timezone_utils import get_local_now, normalize_to_local_midnight, strip_timezone_for_mongo
from mongo.database import DB


class AttachmentItem(BaseModel):
	"""Individual attachment with title and URL"""
	title: str
	url: HttpUrl


class BulletinBase(BaseModel):
	headline: str
	body: str
	publish_date: datetime  # Exact publication date (not normalized)
	expire_at: Optional[datetime] = None
	published: bool
	order: int = 0  # Display order for drag-and-drop reordering
	roles: List[str] = Field(default_factory=list)
	ministries: List[str] = Field(default_factory=list)
	attachments: List[AttachmentItem] = Field(default_factory=list)
	
	# Media library integration
	image_id: Optional[str] = Field(None, description="Media library image ID (24-char ObjectId)")


class BulletinCreate(BulletinBase):
	pass


class BulletinUpdate(BaseModel):
	headline: Optional[str] = None
	body: Optional[str] = None
	publish_date: Optional[datetime] = None
	expire_at: Optional[datetime] = None
	published: Optional[bool] = None
	order: Optional[int] = None
	roles: Optional[List[str]] = None
	ministries: Optional[List[str]] = None
	attachments: Optional[List[AttachmentItem]] = None
	image_id: Optional[str] = None


class BulletinOut(BulletinBase):
	id: str
	created_at: datetime
	updated_at: datetime
	# Computed fields for image URLs
	image_url: Optional[str] = None
	thumbnail_url: Optional[str] = None


class BulletinFeedOut(BaseModel):
	"""Unified response schema for bulletins feed with optional services"""
	services: List = Field(default_factory=list)  # List[ServiceBulletinOut] to avoid circular import
	bulletins: List[BulletinOut] = Field(default_factory=list)


def _build_image_urls(image_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
	"""Convert image_id to public and thumbnail URLs"""
	normalized_id = _normalize_image_id(image_id)
	if not normalized_id:
		return None, None
	
	base = os.getenv("BACKEND_URL", "").rstrip('/')
	if not base:
		# Fallback to localhost if not configured
		base = "http://localhost:8000"
	
	image_url = f"{base}/api/v1/assets/public/id/{normalized_id}"
	thumbnail_url = f"{base}/api/v1/assets/public/id/{normalized_id}?thumbnail=true"
	
	return image_url, thumbnail_url


def _normalize_image_id(image_id: Optional[str]) -> Optional[str]:
	"""Return a sanitized 24-character image ID or None when invalid/empty."""
	if not image_id:
		return None

	if isinstance(image_id, ObjectId):
		raw = str(image_id)
	elif isinstance(image_id, str):
		raw = image_id
	else:
		return None

	trimmed = raw.strip()
	if len(trimmed) != 24:
		return None

	try:
		ObjectId(trimmed)
	except Exception:
		return None

	return trimmed


async def _fetch_bulletin_document(filter_query: dict) -> Optional[BulletinOut]:
	if DB.db is None:
		return None

	document = await DB.db["bulletins"].find_one(filter_query)
	if not document:
		return None
	
	document["id"] = str(document.pop("_id"))
	serialized = serialize_objectid_deep(document)
	
	# Add computed image URLs
	image_url, thumbnail_url = _build_image_urls(serialized.get("image_id"))
	serialized["image_url"] = image_url
	serialized["thumbnail_url"] = thumbnail_url
	
	return BulletinOut(**serialized)


async def create_bulletin(bulletin: BulletinCreate) -> Optional[BulletinOut]:
	if DB.db is None:
		return None

	payload = bulletin.model_dump()
	
	# Normalize publish_date to midnight in local timezone, then strip for MongoDB
	# This ensures dates like "2025-11-10" are interpreted in church's local time, not UTC
	payload["publish_date"] = strip_timezone_for_mongo(normalize_to_local_midnight(bulletin.publish_date))
	
	# Also normalize expire_at if provided
	if bulletin.expire_at:
		payload["expire_at"] = strip_timezone_for_mongo(normalize_to_local_midnight(bulletin.expire_at))
	image_id = _normalize_image_id(payload.get("image_id"))
	if image_id is None:
		payload.pop("image_id", None)
	else:
		payload["image_id"] = image_id
	
	# Serialize attachments
	serialized_attachments = []
	for att in bulletin.attachments:
		# Handle both AttachmentItem objects and dict objects (defensive)
		if isinstance(att, dict):
			serialized_attachments.append({
				"title": att.get("title", ""),
				"url": str(att.get("url", "")),
			})
		else:
			serialized_attachments.append({
				"title": att.title,
				"url": str(att.url),
			})
	payload["attachments"] = serialized_attachments

	# Assign order to the end of the list when not explicitly provided
	order_value = payload.get("order")
	if not isinstance(order_value, int) or order_value <= 0:
		max_order_doc = None
		try:
			if DB.db is not None:
				max_order_doc = await DB.db["bulletins"].find_one({}, sort=[("order", -1)], projection={"order": 1})
		except Exception as exc:
			print(f"Error fetching max bulletin order: {exc}")

		if max_order_doc and isinstance(max_order_doc.get("order"), int):
			payload["order"] = max(max_order_doc.get("order", -1) + 1, 0)
		else:
			payload["order"] = 0
	
	now = datetime.utcnow()
	payload["created_at"] = now
	payload["updated_at"] = now

	try:
		inserted_id = await DB.insert_document("bulletins", payload)
	except DuplicateKeyError:
		# Database unique index violation (duplicate headline)
		print(f"Error: Bulletin with headline '{bulletin.headline}' already exists (duplicate key)")
		return None
	except Exception as exc:
		print(f"Error inserting bulletin: {exc}")
		return None

	if not inserted_id:
		return None

	return await get_bulletin_by_id(str(inserted_id))


async def get_bulletin_by_id(bulletin_id: str) -> Optional[BulletinOut]:
	if DB.db is None:
		return None

	try:
		object_id = ObjectId(bulletin_id)
	except Exception:
		return None
	return await _fetch_bulletin_document({"_id": object_id})


async def get_bulletin_by_headline(headline: str, exclude_id: Optional[str] = None) -> Optional[BulletinOut]:
	"""
	Check for duplicate headline globally (case-insensitive).
	
	Args:
		headline: The headline to search for
		exclude_id: Optional bulletin ID to exclude from search (for update operations)
	
	Returns:
		BulletinOut if a matching bulletin exists, None otherwise
	"""
	if DB.db is None:
		return None
	
	# Build query with case-insensitive regex match
	# Trim whitespace and use exact match with case-insensitive flag
	query = {
		"headline": {
			"$regex": f"^{headline.strip()}$",
			"$options": "i"  # Case-insensitive
		}
	}
	
	# Exclude specific bulletin ID if provided (for update operations)
	if exclude_id:
		try:
			query["_id"] = {"$ne": ObjectId(exclude_id)}
		except Exception:
			pass  # Invalid ObjectId, ignore
	
	return await _fetch_bulletin_document(query)


async def update_bulletin(bulletin_id: str, updates: BulletinUpdate) -> bool:
	if DB.db is None:
		return False

	try:
		object_id = ObjectId(bulletin_id)
	except Exception:
		return False

	update_payload = updates.model_dump(exclude_unset=True)

	if not update_payload:
		return False

	unset_payload: dict[str, str] = {}
	if "image_id" in update_payload:
		normalized_image_id = _normalize_image_id(update_payload.get("image_id"))
		if normalized_image_id is None:
			update_payload.pop("image_id", None)
			unset_payload["image_id"] = ""
		else:
			update_payload["image_id"] = normalized_image_id

	# Normalize publish_date to local midnight if provided
	if "publish_date" in update_payload:
		update_payload["publish_date"] = strip_timezone_for_mongo(normalize_to_local_midnight(update_payload["publish_date"]))
	
	# Normalize expire_at to local midnight if provided
	if "expire_at" in update_payload and update_payload["expire_at"] is not None:
		update_payload["expire_at"] = strip_timezone_for_mongo(normalize_to_local_midnight(update_payload["expire_at"]))
	
	# Serialize attachments if provided
	if "attachments" in update_payload and update_payload["attachments"] is not None:
		serialized_attachments = []
		for att in update_payload["attachments"]:
			# Handle both AttachmentItem objects and dict objects
			if isinstance(att, dict):
				# Already a dict, just ensure it has the required fields
				serialized_attachments.append({
					"title": att.get("title", ""),
					"url": str(att.get("url", "")),
				})
			else:
				# AttachmentItem object, access attributes
				serialized_attachments.append({
					"title": att.title,
					"url": str(att.url),
				})
		update_payload["attachments"] = serialized_attachments

	update_payload["updated_at"] = datetime.utcnow()
	update_doc: dict[str, dict] = {"$set": update_payload}
	if unset_payload:
		update_doc["$unset"] = unset_payload

	try:
		result = await DB.db["bulletins"].update_one({"_id": object_id}, update_doc)
		return result.matched_count > 0
	except DuplicateKeyError:
		# Database unique index violation (duplicate headline during update)
		print(f"Error: Bulletin headline already exists (duplicate key during update)")
		return False
	except Exception as exc:
		print(f"Error updating bulletin {bulletin_id}: {exc}")
		return False


async def delete_bulletin(bulletin_id: str) -> bool:
	if DB.db is None:
		return False

	try:
		object_id = ObjectId(bulletin_id)
	except Exception:
		return False

	try:
		result = await DB.db["bulletins"].delete_one({"_id": object_id})
		return result.deleted_count > 0
	except Exception as exc:
		print(f"Error deleting bulletin {bulletin_id}: {exc}")
		return False


async def list_bulletins(
	*,
	skip: int = 0,
	limit: int = 100,
	ministry: Optional[str] = None,
	query_text: Optional[str] = None,
	week_start: Optional[datetime] = None,
	week_end: Optional[datetime] = None,
	published: Optional[bool] = None,
	upcoming_only: bool = False,
	skip_expiration_filter: bool = False,
) -> List[BulletinOut]:
	"""
	List bulletins with optional filters.
	- query_text: text search across headline and summary
	- week_start/week_end: filter by exact publish_date range (used for services, not bulletins)
	- upcoming_only: filter for publish_date <= today (bulletins that have been published)
	- skip_expiration_filter: if True, show expired bulletins too (for admin dashboard)
	- Automatically filters out expired bulletins (expire_at < now) unless skip_expiration_filter=True
	- Sorted by order field ascending (for drag-and-drop reordering)
	"""
	query: dict = {}

	# Add text search if query_text is provided
	if query_text:
		query["$text"] = {"$search": query_text}

	if ministry:
		query["ministries"] = {"$in": [ministry]}
	if published is not None:
		query["published"] = published
	if upcoming_only:
		# For bulletins: show if publish_date <= now (already published)
		# Use local timezone to avoid timezone mismatch issues
		local_now = get_local_now()
		query.setdefault("publish_date", {})["$lte"] = strip_timezone_for_mongo(local_now)

	# Use exact date filtering (no longer normalize to week boundaries)
	if week_start:
		query.setdefault("publish_date", {})["$gte"] = week_start
	if week_end:
		query.setdefault("publish_date", {})["$lte"] = week_end

	# Filter out expired bulletins (expire_at in the past)
	# Show bulletin if: publish_date <= now AND (expire_at is null OR expire_at > now)
	# Skip this filter for admin dashboard
	# Use local timezone to avoid timezone mismatch issues
	if not skip_expiration_filter:
		local_now = get_local_now()
		now_mongo = strip_timezone_for_mongo(local_now)
		# Use $and to properly combine with existing query conditions
		expiration_filter = {
			"$or": [
				{"expire_at": {"$exists": False}},  # No expiration date set
				{"expire_at": None},  # Expiration date is null
				{"expire_at": {"$gt": now_mongo}}  # Expiration date is in the future (local time)
			]
		}
		# If query already has conditions, wrap in $and
		if query:
			query = {"$and": [query, expiration_filter]}
		else:
			query = expiration_filter

	if DB.db is None:
		return []

	# Sort by text score if searching, otherwise by order ascending (drag-and-drop order)
	if query_text:
		cursor = DB.db["bulletins"].find(query).sort([("score", {"$meta": "textScore"})])
	else:
		cursor = DB.db["bulletins"].find(query).sort([("order", 1)])
	
	if skip:
		cursor = cursor.skip(skip)
	if limit:
		cursor = cursor.limit(limit)

	documents = await cursor.to_list(length=limit or None)
	bulletins: List[BulletinOut] = []
	for document in documents:
		document["id"] = str(document.pop("_id"))
		serialized = serialize_objectid_deep(document)
		
		# Add computed image URLs
		image_url, thumbnail_url = _build_image_urls(serialized.get("image_id"))
		serialized["image_url"] = image_url
		serialized["thumbnail_url"] = thumbnail_url
		
		bulletin = BulletinOut(**serialized)
		bulletins.append(bulletin)
	return bulletins


async def search_bulletins(
	query_text: str,
	*,
	skip: int = 0,
	limit: int = 100,
	ministry: Optional[str] = None,
	published: Optional[bool] = None,
) -> List[BulletinOut]:
	"""Text search across bulletin headlines and summaries"""
	query: dict = {"$text": {"$search": query_text}}

	if ministry:
		query["ministries"] = {"$in": [ministry]}
	if published is not None:
		query["published"] = published

	# Filter out expired bulletins (expire_at in the past)
	# Use local timezone to avoid timezone mismatch issues
	local_now = get_local_now()
	now_mongo = strip_timezone_for_mongo(local_now)
	# Use $and to properly combine with existing query conditions
	expiration_filter = {
		"$or": [
			{"expire_at": {"$exists": False}},  # No expiration date set
			{"expire_at": None},  # Expiration date is null
			{"expire_at": {"$gt": now_mongo}}  # Expiration date is in the future (local time)
		]
	}
	# If query already has conditions, wrap in $and
	if query:
		query = {"$and": [query, expiration_filter]}
	else:
		query = expiration_filter

	if DB.db is None:
		return []

	cursor = DB.db["bulletins"].find(query).sort([("score", {"$meta": "textScore"})])
	if skip:
		cursor = cursor.skip(skip)
	if limit:
		cursor = cursor.limit(limit)

	documents = await cursor.to_list(length=limit or None)
	bulletins: List[BulletinOut] = []
	for document in documents:
		document["id"] = str(document.pop("_id"))
		serialized = serialize_objectid_deep(document)
		
		# Add computed image URLs
		image_url, thumbnail_url = _build_image_urls(serialized.get("image_id"))
		serialized["image_url"] = image_url
		serialized["thumbnail_url"] = thumbnail_url
		
		bulletin = BulletinOut(**serialized)
		bulletins.append(bulletin)
	return bulletins


async def reorder_bulletins(bulletin_ids: List[str]) -> bool:
	"""
	Reorder bulletins by updating their order field.
	bulletin_ids should be in desired display order.
	"""
	if DB.db is None:
		return False

	# Validate all ObjectIds upfront before modifying database
	try:
		object_ids = [ObjectId(bid) for bid in bulletin_ids]
	except Exception as exc:
		print(f"Error: Invalid bulletin ID format in reorder: {exc}")
		return False

	try:
		for idx, object_id in enumerate(object_ids):
			await DB.db["bulletins"].update_one(
				{"_id": object_id},
				{"$set": {"order": idx, "updated_at": datetime.utcnow()}}
			)
		return True
	except Exception as exc:
		print(f"Error reordering bulletins: {exc}")
		return False
