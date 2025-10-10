from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import List, Literal, Optional

from bson import ObjectId
from pydantic import BaseModel, Field

from helpers.MongoHelper import serialize_objectid_deep
from mongo.database import DB


def canonicalize_week_start(dt: datetime) -> datetime:
	"""
	Normalize datetime to the Monday 00:00:00 of the same week.
	This ensures weekly services are grouped consistently.
	"""
	days_since_monday = dt.weekday()
	monday = dt - timedelta(days=days_since_monday)
	return datetime.combine(monday.date(), time.min)


class ServiceBulletinBase(BaseModel):
	title: str
	day_of_week: str  # Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
	time_of_day: str  # HH:MM format (24-hour time)
	description: Optional[str] = None
	timeline_notes: Optional[str] = None  # Markdown-formatted service timeline
	display_week: datetime  # Weekly anchor, normalized to Monday 00:00
	order: int = 0  # Display order within the week
	published: bool = True
	visibility_mode: Literal['always', 'specific_weeks'] = 'specific_weeks'  # Control when service appears
	
	# Localization fields
	ru_title: Optional[str] = None
	ru_description: Optional[str] = None
	ru_timeline_notes: Optional[str] = None


class ServiceBulletinCreate(ServiceBulletinBase):
	pass


class ServiceBulletinUpdate(BaseModel):
	title: Optional[str] = None
	day_of_week: Optional[str] = None
	time_of_day: Optional[str] = None
	description: Optional[str] = None
	timeline_notes: Optional[str] = None
	display_week: Optional[datetime] = None
	order: Optional[int] = None
	published: Optional[bool] = None
	visibility_mode: Optional[Literal['always', 'specific_weeks']] = None
	ru_title: Optional[str] = None
	ru_description: Optional[str] = None
	ru_timeline_notes: Optional[str] = None


class ServiceBulletinOut(ServiceBulletinBase):
	id: str
	created_at: datetime
	updated_at: datetime


async def _fetch_service_document(filter_query: dict) -> Optional[ServiceBulletinOut]:
	"""Fetch a single service document from MongoDB"""
	if DB.db is None:
		return None

	document = await DB.db["service_bulletins"].find_one(filter_query)
	if not document:
		return None
	
	document["id"] = str(document.pop("_id"))
	serialized = serialize_objectid_deep(document)
	return ServiceBulletinOut(**serialized)


async def create_service(service: ServiceBulletinCreate) -> Optional[ServiceBulletinOut]:
	"""Create a new service bulletin"""
	if DB.db is None:
		return None

	payload = service.model_dump()
	
	# Normalize display_week to Monday 00:00
	payload["display_week"] = canonicalize_week_start(service.display_week)
	
	now = datetime.utcnow()
	payload["created_at"] = now
	payload["updated_at"] = now

	try:
		inserted_id = await DB.insert_document("service_bulletins", payload)
	except Exception as exc:
		print(f"Error inserting service bulletin: {exc}")
		return None

	if not inserted_id:
		return None

	return await get_service_by_id(str(inserted_id))


async def get_service_by_id(service_id: str) -> Optional[ServiceBulletinOut]:
	"""Fetch service by ID"""
	if DB.db is None:
		return None

	try:
		object_id = ObjectId(service_id)
	except Exception:
		return None
	return await _fetch_service_document({"_id": object_id})


async def get_service_by_title_and_week(title: str, display_week: datetime) -> Optional[ServiceBulletinOut]:
	"""Check for duplicate title within the same week"""
	if DB.db is None:
		return None
	
	week_start = canonicalize_week_start(display_week)
	return await _fetch_service_document({
		"title": title,
		"display_week": week_start
	})


async def update_service(service_id: str, updates: ServiceBulletinUpdate) -> bool:
	"""Update an existing service bulletin"""
	if DB.db is None:
		return False

	try:
		object_id = ObjectId(service_id)
	except Exception:
		return False

	update_payload = updates.model_dump(exclude_unset=True)

	if not update_payload:
		return False

	# Normalize display_week if provided
	if "display_week" in update_payload:
		update_payload["display_week"] = canonicalize_week_start(update_payload["display_week"])

	update_payload["updated_at"] = datetime.utcnow()

	try:
		result = await DB.db["service_bulletins"].update_one(
			{"_id": object_id},
			{"$set": update_payload}
		)
		return result.modified_count > 0
	except Exception as exc:
		print(f"Error updating service bulletin {service_id}: {exc}")
		return False


async def delete_service(service_id: str) -> bool:
	"""Delete a service bulletin"""
	if DB.db is None:
		return False

	try:
		object_id = ObjectId(service_id)
	except Exception:
		return False

	try:
		result = await DB.db["service_bulletins"].delete_one({"_id": object_id})
		return result.deleted_count > 0
	except Exception as exc:
		print(f"Error deleting service bulletin {service_id}: {exc}")
		return False


async def list_services(
	*,
	skip: int = 0,
	limit: int = 100,
	week_start: Optional[datetime] = None,
	week_end: Optional[datetime] = None,
	published: Optional[bool] = None,
	upcoming_only: bool = False,
) -> List[ServiceBulletinOut]:
	"""
	List service bulletins with optional filters.
	- week_start/week_end: filter by display_week range (with visibility_mode logic)
	- published: filter by published status
	- upcoming_only: deprecated (kept for backward compatibility, ignored)
	
	Visibility logic:
	- visibility_mode='always': always included regardless of week filters
	- visibility_mode='specific_weeks': only included if display_week matches week filters
	"""
	query: dict = {}

	if published is not None:
		query["published"] = published
	
	# Note: upcoming_only is now deprecated as service_time is no longer a datetime
	# Services are now defined by day_of_week and time_of_day, not specific dates

	# Handle visibility mode filtering with week filters
	if week_start or week_end:
		# Build the week filter conditions
		week_conditions = []
		
		# Condition 1: visibility_mode is 'always' (always visible, ignore week filters)
		always_condition = {"visibility_mode": "always"}
		week_conditions.append(always_condition)
		
		# Condition 2: visibility_mode is 'specific_weeks' AND display_week is in range
		specific_week_condition: dict = {"visibility_mode": "specific_weeks"}
		display_week_filter: dict = {}
		
		if week_start:
			normalized_start = canonicalize_week_start(week_start)
			display_week_filter["$gte"] = normalized_start
		if week_end:
			normalized_end = canonicalize_week_start(week_end)
			display_week_filter["$lte"] = normalized_end
		
		if display_week_filter:
			specific_week_condition["display_week"] = display_week_filter
		
		week_conditions.append(specific_week_condition)
		
		# Condition 3: Handle legacy services without visibility_mode (treat as 'always')
		legacy_condition = {"visibility_mode": {"$exists": False}}
		week_conditions.append(legacy_condition)
		
		# Combine with OR
		query["$or"] = week_conditions
	

	if DB.db is None:
		return []

	# Sort by order ascending, then by day of week (Monday=0, Sunday=6), then by time_of_day
	# MongoDB sort with custom day order via aggregation pipeline
	day_order = {
		"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
		"Friday": 4, "Saturday": 5, "Sunday": 6
	}
	
	# Use aggregation pipeline to add sortable day field
	pipeline = [
		{"$match": query},
		{
			"$addFields": {
				"day_sort_value": {
					"$switch": {
						"branches": [
							{"case": {"$eq": ["$day_of_week", "Monday"]}, "then": 0},
							{"case": {"$eq": ["$day_of_week", "Tuesday"]}, "then": 1},
							{"case": {"$eq": ["$day_of_week", "Wednesday"]}, "then": 2},
							{"case": {"$eq": ["$day_of_week", "Thursday"]}, "then": 3},
							{"case": {"$eq": ["$day_of_week", "Friday"]}, "then": 4},
							{"case": {"$eq": ["$day_of_week", "Saturday"]}, "then": 5},
							{"case": {"$eq": ["$day_of_week", "Sunday"]}, "then": 6},
						],
						"default": 7
					}
				}
			}
		},
		{"$sort": {"order": 1, "day_sort_value": 1, "time_of_day": 1}},
	]
	
	if skip:
		pipeline.append({"$skip": skip})
	if limit:
		pipeline.append({"$limit": limit})

	documents = await DB.db["service_bulletins"].aggregate(pipeline).to_list(length=None)
	services: List[ServiceBulletinOut] = []
	for document in documents:
		document["id"] = str(document.pop("_id"))
		# Remove the temporary sort field
		document.pop("day_sort_value", None)
		serialized = serialize_objectid_deep(document)
		service = ServiceBulletinOut(**serialized)
		services.append(service)
	
	return services


async def reorder_services(service_ids: List[str]) -> bool:
	"""
	Reorder services by updating their order field.
	service_ids should be in desired display order.
	"""
	if DB.db is None:
		return False

	try:
		for idx, service_id in enumerate(service_ids):
			object_id = ObjectId(service_id)
			await DB.db["service_bulletins"].update_one(
				{"_id": object_id},
				{"$set": {"order": idx, "updated_at": datetime.utcnow()}}
			)
		return True
	except Exception as exc:
		print(f"Error reordering services: {exc}")
		return False
