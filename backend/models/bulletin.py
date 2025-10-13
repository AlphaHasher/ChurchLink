from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import List, Optional, Set

from bson import ObjectId
from pydantic import BaseModel, Field, HttpUrl

from helpers.MongoHelper import serialize_objectid_deep
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
	pinned: bool = False
	roles: List[str] = Field(default_factory=list)
	ministries: List[str] = Field(default_factory=list)
	attachments: List[AttachmentItem] = Field(default_factory=list)
	
	# Localization fields
	ru_headline: Optional[str] = None
	ru_body: Optional[str] = None


class BulletinCreate(BulletinBase):
	pass


class BulletinUpdate(BaseModel):
	headline: Optional[str] = None
	body: Optional[str] = None
	publish_date: Optional[datetime] = None
	expire_at: Optional[datetime] = None
	published: Optional[bool] = None
	pinned: Optional[bool] = None
	roles: Optional[List[str]] = None
	ministries: Optional[List[str]] = None
	attachments: Optional[List[AttachmentItem]] = None
	ru_headline: Optional[str] = None
	ru_body: Optional[str] = None


class BulletinOut(BulletinBase):
	id: str
	created_at: datetime
	updated_at: datetime


class BulletinFeedOut(BaseModel):
	"""Unified response schema for bulletins feed with optional services"""
	services: List = Field(default_factory=list)  # List[ServiceBulletinOut] to avoid circular import
	bulletins: List[BulletinOut] = Field(default_factory=list)


def canonicalize_week_start(dt: datetime) -> datetime:
	"""
	Normalize datetime to the Monday 00:00:00 of the same week.
	This ensures Bulletin Announcments are grouped consistently.
	"""
	# Find Monday (weekday 0) of the week containing dt
	days_since_monday = dt.weekday()
	monday = dt - timedelta(days=days_since_monday)
	return datetime.combine(monday.date(), time.min)


async def _fetch_bulletin_document(filter_query: dict) -> Optional[BulletinOut]:
	if DB.db is None:
		return None

	document = await DB.db["bulletins"].find_one(filter_query)
	if not document:
		return None
	
	document["id"] = str(document.pop("_id"))
	serialized = serialize_objectid_deep(document)
	return BulletinOut(**serialized)


async def create_bulletin(bulletin: BulletinCreate) -> Optional[BulletinOut]:
	if DB.db is None:
		return None

	payload = bulletin.model_dump()
	
	# Keep the exact publish_date as specified
	payload["publish_date"] = bulletin.publish_date
	
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
	
	now = datetime.utcnow()
	payload["created_at"] = now
	payload["updated_at"] = now

	try:
		inserted_id = await DB.insert_document("bulletins", payload)
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


async def get_bulletin_by_headline_and_week(headline: str, publish_date: datetime) -> Optional[BulletinOut]:
	"""Check for duplicate headline with the exact same publish date"""
	if DB.db is None:
		return None
	
	# Check for exact date match (no longer normalizing to week start)
	return await _fetch_bulletin_document({
		"headline": headline,
		"publish_date": publish_date
	})


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

	# Keep the exact publish_date if provided (no normalization)
	# publish_date is already in update_payload as-is
	
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

	try:
		result = await DB.db["bulletins"].update_one({"_id": object_id}, {"$set": update_payload})
		return result.modified_count > 0
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
	pinned_only: bool = False,
	upcoming_only: bool = False,
	skip_expiration_filter: bool = False,
) -> List[BulletinOut]:
	"""
	List bulletins with optional filters.
	- query_text: text search across headline and summary
	- week_start/week_end: filter by exact publish_date range (used for services, not bulletins)
	- pinned_only: return only pinned bulletins
	- upcoming_only: filter for publish_date <= today (bulletins that have been published)
	- skip_expiration_filter: if True, show expired bulletins too (for admin dashboard)
	- Automatically filters out expired bulletins (expire_at < now) unless skip_expiration_filter=True
	"""
	query: dict = {}

	# Add text search if query_text is provided
	if query_text:
		query["$text"] = {"$search": query_text}

	if ministry:
		query["ministries"] = {"$in": [ministry]}
	if published is not None:
		query["published"] = published
	if pinned_only:
		query["pinned"] = True
	if upcoming_only:
		# For bulletins: show if publish_date <= now (already published)
		query.setdefault("publish_date", {})["$lte"] = datetime.utcnow()

	# Use exact date filtering (no longer normalize to week boundaries)
	if week_start:
		query.setdefault("publish_date", {})["$gte"] = week_start
	if week_end:
		query.setdefault("publish_date", {})["$lte"] = week_end

	# Filter out expired bulletins (expire_at in the past)
	# Show bulletin if: publish_date <= now AND (expire_at is null OR expire_at > now)
	# Skip this filter for admin dashboard
	if not skip_expiration_filter:
		now = datetime.utcnow()
		query["$or"] = [
			{"expire_at": {"$exists": False}},  # No expiration date set
			{"expire_at": None},  # Expiration date is null
			{"expire_at": {"$gt": now}}  # Expiration date is in the future
		]

	if DB.db is None:
		return []

	# Sort by text score if searching, otherwise by publish_date descending, then pinned first
	if query_text:
		cursor = DB.db["bulletins"].find(query).sort([("score", {"$meta": "textScore"})])
	else:
		cursor = DB.db["bulletins"].find(query).sort([("publish_date", -1), ("pinned", -1)])
	
	if skip:
		cursor = cursor.skip(skip)
	if limit:
		cursor = cursor.limit(limit)

	documents = await cursor.to_list(length=limit or None)
	bulletins: List[BulletinOut] = []
	for document in documents:
		document["id"] = str(document.pop("_id"))
		serialized = serialize_objectid_deep(document)
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
	pinned_only: bool = False,
) -> List[BulletinOut]:
	"""Text search across bulletin headlines and summaries"""
	query: dict = {"$text": {"$search": query_text}}

	if ministry:
		query["ministries"] = {"$in": [ministry]}
	if published is not None:
		query["published"] = published
	if pinned_only:
		query["pinned"] = True

	# Filter out expired bulletins (expire_at in the past)
	now = datetime.utcnow()
	query["$or"] = [
		{"expire_at": {"$exists": False}},  # No expiration date set
		{"expire_at": None},  # Expiration date is null
		{"expire_at": {"$gt": now}}  # Expiration date is in the future
	]

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
		bulletin = BulletinOut(**serialized)
		bulletins.append(bulletin)
	return bulletins
