from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.security import HTTPBearer
from firebase_admin import auth as firebase_auth  # type: ignore[import]
from bson import ObjectId  # type: ignore[import]
from pydantic import BaseModel

from controllers.sermon_functions import (
	process_create_sermon,
	process_delete_sermon,
	process_edit_sermon,
	process_publish_toggle,
	register_sermon_favorite,
	remove_sermon_favorite,
)
from models.sermon import (
	SermonCreate,
	SermonUpdate,
	get_sermon_by_id,
	list_sermons,
	search_sermons,
)
from mongo.churchuser import UserHandler


sermon_editing_router = APIRouter(prefix="/sermons", tags=["Sermons Admin Routes"])
public_sermon_router = APIRouter(prefix="/sermons", tags=["Sermons Public Routes"])
private_sermon_router = APIRouter(prefix="/sermons", tags=["Sermons Auth Routes"])


bearer_scheme = HTTPBearer(auto_error=False)


class SermonPublishToggle(BaseModel):
	published: bool


def _combine_date_and_time(value: Optional[date], *, end_of_day: bool = False) -> Optional[datetime]:
	if value is None:
		return None
	if end_of_day:
		return datetime.combine(value, time.max)
	return datetime.combine(value, time.min)


async def _extract_uid_from_request(request: Request) -> Optional[str]:
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


async def _collect_favorite_sermon_ids(request: Request) -> Optional[set[str]]:
	uid = getattr(request.state, "uid", None)
	if not uid:
		uid = await _extract_uid_from_request(request)
	if not uid:
		return None
	try:
		favorites = await UserHandler.list_sermon_favorites(uid, expand=False)
	except Exception:
		return None
	favorite_ids: set[str] = set()
	for entry in favorites:
		sermon_id = entry.get("sermon_id")
		if isinstance(sermon_id, ObjectId):
			favorite_ids.add(str(sermon_id))
		elif isinstance(sermon_id, str):
			favorite_ids.add(sermon_id)
	return favorite_ids


@public_sermon_router.get("/")
async def get_sermons(
	request: Request,
	skip: int = 0,
	limit: int = 100,
	ministry_id: Optional[str] = None,
	speaker: Optional[str] = None,
	tags: Optional[List[str]] = Query(default=None),
	date_after: Optional[date] = None,
	date_before: Optional[date] = None,
	published: Optional[bool] = True,
	favorites_only: Optional[bool] = None,
):
	favorite_ids = await _collect_favorite_sermon_ids(request)
	return await list_sermons(
		skip=skip,
		limit=limit,
		ministry_id=ministry_id,
		speaker=speaker,
		tags=tags,
		date_after=_combine_date_and_time(date_after),
		date_before=_combine_date_and_time(date_before, end_of_day=True),
		published=published,
		favorite_ids=favorite_ids,
		favorites_only=favorites_only,
	)


@public_sermon_router.get("/search")
async def search_sermons_route(
	request: Request,
	query: str,
	skip: int = 0,
	limit: int = 100,
	ministry_id: Optional[str] = None,
	speaker: Optional[str] = None,
	tags: Optional[List[str]] = Query(default=None),
	published: Optional[bool] = True,
	favorites_only: Optional[bool] = None,
):
	favorite_ids = await _collect_favorite_sermon_ids(request)
	return await search_sermons(
		query,
		skip=skip,
		limit=limit,
		ministry_id=ministry_id,
		speaker=speaker,
		tags=tags,
		published=published,
		favorite_ids=favorite_ids,
		favorites_only=favorites_only,
	)


@public_sermon_router.get("/{sermon_id}")
async def get_sermon_detail(sermon_id: str, request: Request):
	sermon = await get_sermon_by_id(sermon_id)
	if sermon is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Sermon not found",
		)

	payload = sermon.model_dump()
	payload["embed_url"] = f"https://www.youtube.com/embed/{sermon.video_id}"
	payload["share_url"] = f"https://youtu.be/{sermon.video_id}"
	favorite_ids = await _collect_favorite_sermon_ids(request)
	payload["is_favorited"] = bool(favorite_ids and sermon.id in favorite_ids)
	return payload


@private_sermon_router.post("/{sermon_id}/favorite")
async def favorite_sermon(sermon_id: str, request: Request):
	return await register_sermon_favorite(sermon_id, request)


@private_sermon_router.delete("/{sermon_id}/favorite")
async def unfavorite_sermon(sermon_id: str, request: Request):
	return await remove_sermon_favorite(sermon_id, request)


@sermon_editing_router.post("/")
async def create_sermon_route(sermon: SermonCreate, request: Request):
	return await process_create_sermon(sermon, request)


@sermon_editing_router.put("/{sermon_id}")
async def edit_sermon_route(sermon_id: str, sermon: SermonUpdate, request: Request):
	return await process_edit_sermon(sermon_id, sermon, request)


@sermon_editing_router.delete("/{sermon_id}")
async def delete_sermon_route(sermon_id: str, request: Request):
	return await process_delete_sermon(sermon_id, request)


@sermon_editing_router.patch("/{sermon_id}/publish")
async def toggle_sermon_publish(
	sermon_id: str,
	payload: SermonPublishToggle,
	request: Request,
):
	return await process_publish_toggle(
		sermon_id,
		published=payload.published,
		request=request,
	)

