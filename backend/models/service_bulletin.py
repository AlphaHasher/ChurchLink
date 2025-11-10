from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import List, Literal, Optional
import re

from bson import ObjectId
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from helpers.MongoHelper import serialize_objectid_deep
from helpers.timezone_utils import normalize_to_local_week_start, strip_timezone_for_mongo, get_local_now
from mongo.database import DB

# Valid days of the week
VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class ServiceBulletinBase(BaseModel):
	title: str
	day_of_week: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
	time_of_day: str  # HH:MM format (24-hour time)
	description: Optional[str] = None
	timeline_notes: Optional[str] = None  # Markdown-formatted service timeline
	display_week: datetime  # Weekly anchor, normalized to Monday 00:00
	order: int = 0  # Display order within the week
	published: bool = True
	visibility_mode: Literal['always', 'specific_weeks'] = 'specific_weeks'  # Control when service appears
	
	@field_validator('time_of_day')
	@classmethod
	def validate_time_format(cls, v: str) -> str:
		"""Validate time_of_day is in HH:MM format (24-hour time)"""
		if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', v):
			raise ValueError('time_of_day must be in HH:MM format (24-hour time)')
		return v


class ServiceBulletinCreate(ServiceBulletinBase):
	pass


class ServiceBulletinUpdate(BaseModel):
	title: Optional[str] = None
	day_of_week: Optional[Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]] = None
	time_of_day: Optional[str] = None
	description: Optional[str] = None
	timeline_notes: Optional[str] = None
	display_week: Optional[datetime] = None
	order: Optional[int] = None
	published: Optional[bool] = None
	visibility_mode: Optional[Literal['always', 'specific_weeks']] = None
	
	@field_validator('time_of_day')
	@classmethod
	def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
		"""Validate time_of_day is in HH:MM format (24-hour time)"""
		if v is not None and not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', v):
			raise ValueError('time_of_day must be in HH:MM format (24-hour time)')
		return v


class ServiceBulletinOut(ServiceBulletinBase):
	id: str
	created_at: datetime
	updated_at: datetime
	
	def model_post_init(self, __context) -> None:
		"""
		Post-initialization hook to dynamically compute display_week for 'always' visibility mode.
		
		This ensures the API returns the CURRENT week's Monday for services that are "always visible",
		BUT only if the service has already started (current week >= original display_week).
		This prevents future services from showing before their configured start week.
		"""
		super().model_post_init(__context)
		
		# If visibility_mode is 'always', update display_week to current week's Monday
		# BUT only if the service has started (current week >= stored display_week)
		if self.visibility_mode == 'always':
			# Get current time in local timezone
			local_now = get_local_now()
			# Calculate current week's Monday in local timezone
			current_week_monday = normalize_to_local_week_start(local_now)
			current_week_monday_naive = strip_timezone_for_mongo(current_week_monday)
			
			# Only update display_week if current week >= stored display_week
			# This respects display_week as the "start showing from this week" date
			# e.g., service configured for week 11/10 won't show on 11/09
			if current_week_monday_naive >= self.display_week:
				self.display_week = current_week_monday_naive


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
	
	# Normalize display_week to Monday 00:00 in local timezone
	# This ensures week boundaries match the church's local timezone, not UTC
	payload["display_week"] = strip_timezone_for_mongo(normalize_to_local_week_start(service.display_week))

	# Ensure new services append to the end of the ordering sequence
	order_value = payload.get("order")
	if not isinstance(order_value, int) or order_value <= 0:
		max_order_doc = None
		try:
			if DB.db is not None:
				max_order_doc = await DB.db["service_bulletins"].find_one({}, sort=[("order", -1)], projection={"order": 1})
		except Exception as exc:
			print(f"Error fetching max service order: {exc}")

		if max_order_doc and isinstance(max_order_doc.get("order"), int):
			payload["order"] = max(max_order_doc.get("order", -1) + 1, 0)
		else:
			payload["order"] = 0
	
	now = datetime.utcnow()
	payload["created_at"] = now
	payload["updated_at"] = now

	try:
		inserted_id = await DB.insert_document("service_bulletins", payload)
	except DuplicateKeyError:
		# Database unique index violation (duplicate title)
		print(f"Error: Service with title '{service.title}' already exists (duplicate key)")
		return None
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


async def get_service_by_title(title: str, exclude_id: Optional[str] = None) -> Optional[ServiceBulletinOut]:
	"""
	Check for duplicate title globally (case-insensitive).
	
	Args:
		title: The title to search for
		exclude_id: Optional service ID to exclude from search (for update operations)
	
	Returns:
		ServiceBulletinOut if a matching service exists, None otherwise
	"""
	if DB.db is None:
		return None
	
	# Build query with case-insensitive regex match
	# Trim whitespace and use exact match with case-insensitive flag
	query = {
		"title": {
			"$regex": f"^{title.strip()}$",
			"$options": "i"  # Case-insensitive
		}
	}
	
	# Exclude specific service ID if provided (for update operations)
	if exclude_id:
		try:
			query["_id"] = {"$ne": ObjectId(exclude_id)}
		except Exception:
			pass  # Invalid ObjectId, ignore
	
	return await _fetch_service_document(query)


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

	# Normalize display_week to Monday 00:00 in local timezone if provided
	if "display_week" in update_payload:
		update_payload["display_week"] = strip_timezone_for_mongo(normalize_to_local_week_start(update_payload["display_week"]))

	update_payload["updated_at"] = datetime.utcnow()

	try:
		result = await DB.db["service_bulletins"].update_one(
			{"_id": object_id},
			{"$set": update_payload}
		)
		# Return True if document was found (matched_count > 0), regardless of whether values changed
		return result.matched_count > 0
	except DuplicateKeyError:
		# Database unique index violation (duplicate title during update)
		print(f"Error: Service title already exists (duplicate key during update)")
		return False
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
) -> List[ServiceBulletinOut]:
	"""
	List service bulletins with optional filters.
	- week_start/week_end: filter by display_week range (with visibility_mode logic)
	- published: filter by published status
	
	Visibility logic:
	- visibility_mode='always': always included regardless of week filters
	- visibility_mode='specific_weeks': only included if display_week matches week filters
	"""
	query: dict = {}

	if published is not None:
		query["published"] = published

	# Handle visibility mode filtering with week filters
	if week_start or week_end:
		# CRITICAL: display_week is ALWAYS stored as Monday 00:00 in UTC
		# So we need to normalize week_start to find the Monday of the requested week
		# week_end is NOT used for display_week comparison since there's only ONE Monday per week
		
		# Normalize week_start to Monday of the week (if provided)
		normalized_week_monday = None
		if week_start:
			normalized_week_monday = strip_timezone_for_mongo(normalize_to_local_week_start(week_start))
		elif week_end:
			# If only week_end provided, find its Monday
			normalized_week_monday = strip_timezone_for_mongo(normalize_to_local_week_start(week_end))
		
		if normalized_week_monday is None:
			# No valid week specified, skip filtering
			pass
		else:
			# Build the week filter conditions
			week_conditions = []
			
			# Condition 1: visibility_mode is 'always' AND display_week <= current week's Monday
			# This ensures 'always' services only show starting from their configured week
			# e.g., service configured for week 11/10 won't show on 11/09
			always_condition: dict = {
				"visibility_mode": "always",
				"display_week": {"$lte": normalized_week_monday}
			}
			week_conditions.append(always_condition)
			
			# Condition 2: visibility_mode is 'specific_weeks' AND display_week equals the Monday
			# Since display_week is always a Monday, we just check for exact match
			specific_week_condition: dict = {
				"visibility_mode": "specific_weeks",
				"display_week": normalized_week_monday  # Exact match, not a range!
			}
			week_conditions.append(specific_week_condition)
			
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

	# Validate all ObjectIds upfront before modifying database
	try:
		object_ids = [ObjectId(sid) for sid in service_ids]
	except Exception as exc:
		print(f"Error: Invalid service ID format in reorder: {exc}")
		return False

	try:
		for idx, object_id in enumerate(object_ids):
			await DB.db["service_bulletins"].update_one(
				{"_id": object_id},
				{"$set": {"order": idx, "updated_at": datetime.utcnow()}}
			)
		return True
	except Exception as exc:
		print(f"Error reordering services: {exc}")
		return False
