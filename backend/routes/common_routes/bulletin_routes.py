from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional, Union

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.security import HTTPBearer
from firebase_admin import auth as firebase_auth
from bson import ObjectId
from pydantic import BaseModel

from controllers.bulletin_functions import (
	process_create_bulletin,
	process_delete_bulletin,
	process_edit_bulletin,
	process_publish_toggle,
	process_reorder_bulletins,
)
from controllers.service_bulletin_functions import (
	process_create_service,
	process_delete_service,
	process_edit_service,
	process_publish_toggle as process_service_publish_toggle,
	process_reorder_services,
)
from models.bulletin import (
	BulletinCreate,
	BulletinFeedOut,
	BulletinUpdate,
	get_bulletin_by_id,
	list_bulletins,
	search_bulletins,
)
from models.service_bulletin import (
	ServiceBulletinCreate,
	ServiceBulletinUpdate,
	get_service_by_id,
	list_services,
)
from mongo.churchuser import UserHandler
from helpers.timezone_utils import get_local_now, normalize_to_local_week_start


bulletin_editing_router = APIRouter(prefix="/bulletins", tags=["Bulletins Admin Routes"])
public_bulletin_router = APIRouter(prefix="/bulletins", tags=["Bulletins Public Routes"])
service_bulletin_editing_router = APIRouter(prefix="/services", tags=["Services Admin Routes"])
public_service_router = APIRouter(prefix="/services", tags=["Services Public Routes"])


bearer_scheme = HTTPBearer(auto_error=False)


class BulletinPublishToggle(BaseModel):
	published: bool


class BulletinReorderPayload(BaseModel):
	bulletin_ids: List[str]


def _combine_date_and_time(value: Optional[date], *, end_of_day: bool = False) -> Optional[datetime]:
	"""Convert date to datetime with time component"""
	if value is None:
		return None
	if end_of_day:
		return datetime.combine(value, time.max)
	return datetime.combine(value, time.min)


async def _extract_uid_from_request(request: Request) -> Optional[str]:
	"""Extract Firebase UID from request bearer token"""
	credentials = await bearer_scheme(request)
	if not credentials:
		return None
	token = credentials.credentials
	if not token:
		return None
	try:
		decoded = firebase_auth.verify_id_token(token)
	except Exception:
		return None
	uid = decoded.get("uid")
	if uid:
		request.state.uid = uid
	return uid


# PUBLIC ROUTES

@public_bulletin_router.get("/current_week")
async def get_current_week(request: Request):
	"""
	Get the server's current week information based on the configured local timezone.
	This endpoint ensures frontend-backend synchronization for week calculations.
	
	Returns:
	- current_date: Current date/time in server's local timezone
	- week_start: Monday of current week at 00:00:00 in local timezone
	- week_end: Sunday of current week at 23:59:59 in local timezone
	- week_label: Formatted string for "For the week of {date}"
	"""
	# Get current time in server's local timezone
	now = get_local_now()
	
	# Get Monday of current week
	week_start = normalize_to_local_week_start(now)
	
	# Calculate Sunday (end of week)
	from datetime import timedelta
	week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
	
	# Format the week label
	week_label = week_start.strftime("%b %d, %Y")
	
	return {
		"current_date": now.isoformat(),
		"week_start": week_start.isoformat(),
		"week_end": week_end.isoformat(),
		"week_label": f"For the week of {week_label}",
		"timezone": str(now.tzinfo)
	}

@public_bulletin_router.get("/", response_model=Union[List, BulletinFeedOut])
async def get_bulletins(
	request: Request,
	skip: int = 0,
	limit: int = 100,
	ministry: Optional[str] = None,
	query: Optional[str] = None,
	week_start: Optional[date] = None,
	week_end: Optional[date] = None,
	published: Optional[bool] = True,
	upcoming_only: bool = False,
	skip_expiration_filter: bool = False,
	include_services: bool = False,
):
	"""
	List bulletins with optional filters.
	When include_services=True, returns BulletinFeedOut with services and bulletins.
	When include_services=False (default), returns List[BulletinOut] for backward compatibility.
	
	IMPORTANT: week_start/week_end are used ONLY for services, NOT for bulletins.
	Bulletins use upcoming_only for date-based filtering (publish_date <= today).
	Bulletins are sorted by order field (ascending) for drag-and-drop reordering.
	"""
	# For bulletins: ignore week_start/week_end when upcoming_only is True (date-based filtering)
	# Only use week filters for bulletins when explicitly querying a specific date range
	bulletin_week_start = None if upcoming_only else week_start
	bulletin_week_end = None if upcoming_only else week_end
	
	bulletins = await list_bulletins(
		skip=skip,
		limit=limit,
		ministry=ministry,
		query_text=query,
		week_start=_combine_date_and_time(bulletin_week_start),
		week_end=_combine_date_and_time(bulletin_week_end, end_of_day=True),
		published=published,
		upcoming_only=upcoming_only,
		skip_expiration_filter=skip_expiration_filter,
	)
	
	if not include_services:
		# Legacy response: just bulletins array
		return bulletins
	
	# New unified feed response
	# For services: ALWAYS use week_start/week_end (services are week-based)
	services = await list_services(
		skip=0,
		limit=100,
		week_start=_combine_date_and_time(week_start),
		week_end=_combine_date_and_time(week_end, end_of_day=True),
		published=published,
		upcoming_only=upcoming_only,
	)
	
	return BulletinFeedOut(services=services, bulletins=bulletins)


@public_bulletin_router.get("/search")
async def search_bulletins_route(
	request: Request,
	query: str,
	skip: int = 0,
	limit: int = 100,
	ministry: Optional[str] = None,
	published: Optional[bool] = True,
):
	"""Search bulletins by text"""
	return await search_bulletins(
		query,
		skip=skip,
		limit=limit,
		ministry=ministry,
		published=published,
	)


@public_bulletin_router.get("/{bulletin_id}")
async def get_bulletin_detail(bulletin_id: str, request: Request):
	"""Get bulletin by ID"""
	bulletin = await get_bulletin_by_id(bulletin_id)
	if bulletin is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Bulletin not found",
		)

	return bulletin


# EDITING ROUTES (BULLETIN_EDITING PERMISSION)

@bulletin_editing_router.get("/editing/list")
async def list_all_bulletins_for_editing(
	request: Request,
	skip: int = 0,
	limit: int = 100,
	ministry: Optional[str] = None,
	week_start: Optional[date] = None,
	week_end: Optional[date] = None,
	published: Optional[bool] = None,
	upcoming_only: bool = False,
	skip_expiration_filter: bool = False,
):
	"""List ALL bulletins (published and unpublished) for admin editing, sorted by order field"""
	return await list_bulletins(
		skip=skip,
		limit=limit,
		ministry=ministry,
		week_start=_combine_date_and_time(week_start),
		week_end=_combine_date_and_time(week_end, end_of_day=True),
		published=published,  # None allows both published and unpublished
		upcoming_only=upcoming_only,
		skip_expiration_filter=skip_expiration_filter,
	)


@bulletin_editing_router.post("/")
async def create_bulletin_route(bulletin: BulletinCreate, request: Request):
	"""Create new bulletin"""
	return await process_create_bulletin(bulletin, request)


@bulletin_editing_router.put("/{bulletin_id}")
async def edit_bulletin_route(bulletin_id: str, bulletin: BulletinUpdate, request: Request):
	"""Update existing bulletin"""
	return await process_edit_bulletin(bulletin_id, bulletin, request)


@bulletin_editing_router.delete("/{bulletin_id}")
async def delete_bulletin_route(bulletin_id: str, request: Request):
	"""Delete bulletin"""
	return await process_delete_bulletin(bulletin_id, request)


@bulletin_editing_router.patch("/{bulletin_id}/publish")
async def toggle_bulletin_publish(
	bulletin_id: str,
	payload: BulletinPublishToggle,
	request: Request,
):
	"""Toggle bulletin published status"""
	return await process_publish_toggle(
		bulletin_id,
		published=payload.published,
		request=request,
	)


@bulletin_editing_router.patch("/reorder")
async def reorder_bulletins_route(
	payload: BulletinReorderPayload,
	request: Request,
):
	"""Reorder bulletins by updating order field"""
	return await process_reorder_bulletins(payload.bulletin_ids, request)


# PUBLIC SERVICE ROUTES

@public_service_router.get("/")
async def get_services(
	request: Request,
	skip: int = 0,
	limit: int = 100,
	week_start: Optional[date] = None,
	week_end: Optional[date] = None,
	published: Optional[bool] = True,
	upcoming_only: bool = False,
):
	"""List service bulletins with optional filters"""
	return await list_services(
		skip=skip,
		limit=limit,
		week_start=_combine_date_and_time(week_start),
		week_end=_combine_date_and_time(week_end, end_of_day=True),
		published=published,
		upcoming_only=upcoming_only,
	)


@public_service_router.get("/{service_id}")
async def get_service_detail(service_id: str, request: Request):
	"""Get service by ID"""
	service = await get_service_by_id(service_id)
	if service is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Service not found",
		)
	return service


# SERVICE EDITING ROUTES (BULLETIN_EDITING PERMISSION)

class ServicePublishToggle(BaseModel):
	published: bool


class ServiceReorderPayload(BaseModel):
	service_ids: List[str]


@service_bulletin_editing_router.get("/")
async def get_services_admin(
	request: Request,
	skip: int = 0,
	limit: int = 100,
	week_start: Optional[date] = None,
	week_end: Optional[date] = None,
	published: Optional[bool] = None,  # Allow fetching both published and unpublished
	upcoming_only: bool = False,
):
	"""List service bulletins with optional filters (admin view - includes unpublished)"""
	return await list_services(
		skip=skip,
		limit=limit,
		week_start=_combine_date_and_time(week_start),
		week_end=_combine_date_and_time(week_end, end_of_day=True),
		published=published,
		upcoming_only=upcoming_only,
	)


@service_bulletin_editing_router.get("/{service_id}")
async def get_service_detail_admin(service_id: str, request: Request):
	"""Get service by ID (admin view)"""
	service = await get_service_by_id(service_id)
	if service is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Service not found",
		)
	return service


@service_bulletin_editing_router.post("/")
async def create_service_route(service: ServiceBulletinCreate, request: Request):
	"""Create new service"""
	return await process_create_service(service, request)


@service_bulletin_editing_router.put("/{service_id}")
async def edit_service_route(service_id: str, service: ServiceBulletinUpdate, request: Request):
	"""Update existing service"""
	return await process_edit_service(service_id, service, request)


@service_bulletin_editing_router.delete("/{service_id}")
async def delete_service_route(service_id: str, request: Request):
	"""Delete service"""
	return await process_delete_service(service_id, request)


@service_bulletin_editing_router.patch("/{service_id}/publish")
async def toggle_service_publish(
	service_id: str,
	payload: ServicePublishToggle,
	request: Request,
):
	"""Toggle service published status"""
	return await process_service_publish_toggle(
		service_id,
		published=payload.published,
		request=request,
	)


@service_bulletin_editing_router.patch("/reorder")
async def reorder_services_route(
	payload: ServiceReorderPayload,
	request: Request,
):
	"""Reorder services by updating order field"""
	return await process_reorder_services(payload.service_ids, request)
