from __future__ import annotations

from typing import Optional

from bson import ObjectId  # type: ignore[import]
from fastapi import HTTPException, Request, status

from models.sermon import (
	SermonCreate,
	SermonUpdate,
	create_sermon,
	delete_sermon,
	get_sermon_by_id,
	get_sermon_by_title,
	get_sermon_by_video_id,
	normalize_youtube_video_id,
	update_sermon,
)
from mongo.churchuser import UserHandler


def _require_sermon_permissions(request: Request) -> tuple[dict, list[str]]:
	user_perms = getattr(request.state, "perms", {})
	user_roles = getattr(request.state, "roles", [])

	if not (
		user_perms.get("admin")
		or user_perms.get("sermon_editing")
		or user_perms.get("sermon_management")
	):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error processing sermon: Invalid permissions",
		)

	return user_perms, user_roles


async def _ensure_role_assignment_allowed(
	*,
	requested_roles: list[str],
	user_roles: list[str],
	user_perms: dict,
	action_detail: str,
) -> None:
	if user_perms.get("admin") or user_perms.get("sermon_management"):
		return

	missing = [role for role in requested_roles if role not in user_roles]
	if missing:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Error {action_detail}: Tried to add a permission role you do not have access to",
		)


async def process_create_sermon(sermon: SermonCreate, request: Request):
	user_perms, user_roles = _require_sermon_permissions(request)
	if sermon.roles:
		await _ensure_role_assignment_allowed(
			requested_roles=sermon.roles,
			user_roles=user_roles,
			user_perms=user_perms,
			action_detail="creating sermon",
		)

	try:
		video_id = normalize_youtube_video_id(str(sermon.youtube_url))
	except ValueError as exc:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Error creating sermon: {exc}",
		) from exc

	existing_video = await get_sermon_by_video_id(video_id)
	if existing_video is not None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Sermon already exists",
		)

	existing_title = await get_sermon_by_title(sermon.title)
	if existing_title is not None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Sermon already exists",
		)

	sermon.video_id = video_id
	created_sermon = await create_sermon(sermon)
	if created_sermon is None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error creating sermon",
		)
	return created_sermon


async def process_edit_sermon(
	sermon_id: str,
	sermon_update: SermonUpdate,
	request: Request,
):
	if not sermon_update.model_dump(exclude_unset=True):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error editing sermon: No updates provided",
		)

	user_perms, user_roles = _require_sermon_permissions(request)

	existing_sermon = await get_sermon_by_id(sermon_id)
	if existing_sermon is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Sermon not found",
		)

	if not (user_perms.get("admin") or user_perms.get("sermon_management")):
		if not any(role in user_roles for role in existing_sermon.roles):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Error editing sermon: User does not have permission access to sermon",
			)

	desired_roles = existing_sermon.roles if sermon_update.roles is None else sermon_update.roles
	if desired_roles:
		await _ensure_role_assignment_allowed(
			requested_roles=desired_roles,
			user_roles=user_roles,
			user_perms=user_perms,
			action_detail="editing sermon",
		)

	update_payload = sermon_update.model_dump(exclude_unset=True)

	target_video_id: Optional[str] = None
	if "video_id" in update_payload and update_payload["video_id"]:
		target_video_id = update_payload["video_id"]
	if "youtube_url" in update_payload:
		try:
			target_video_id = normalize_youtube_video_id(str(update_payload["youtube_url"]))
		except ValueError as exc:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"Error editing sermon: {exc}",
			) from exc

	if target_video_id and target_video_id != existing_sermon.video_id:
		duplicate_video = await get_sermon_by_video_id(target_video_id)
		if duplicate_video and duplicate_video.id != existing_sermon.id:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Sermon already exists",
			)
		update_payload["video_id"] = target_video_id

	target_title = update_payload.get("title")
	if target_title and target_title != existing_sermon.title:
		duplicate_title = await get_sermon_by_title(target_title)
		if duplicate_title and duplicate_title.id != existing_sermon.id:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Sermon already exists",
			)

	success = await update_sermon(sermon_id, SermonUpdate(**update_payload))
	if not success:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error editing sermon",
		)
	return {"message": "Sermon updated successfully", "success": True}


async def process_delete_sermon(sermon_id: str, request: Request):
	user_perms, user_roles = _require_sermon_permissions(request)

	existing_sermon = await get_sermon_by_id(sermon_id)
	if existing_sermon is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Sermon not found",
		)

	if not (user_perms.get("admin") or user_perms.get("sermon_management")):
		if not any(role in user_roles for role in existing_sermon.roles):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Error deleting sermon: User does not have permission access to sermon",
			)

	success = await delete_sermon(sermon_id)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error deleting sermon",
		)
	return {"message": "Sermon deleted successfully", "success": True}


async def process_publish_toggle(
	sermon_id: str,
	*,
	published: bool,
	request: Request,
):
	await process_edit_sermon(
		sermon_id,
		SermonUpdate(published=published),
		request,
	)
	return {"message": "Sermon publish state updated", "success": True}


async def register_sermon_favorite(sermon_id: str, request: Request):
	sermon = await get_sermon_by_id(sermon_id)
	if sermon is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Sermon not found",
		)

	try:
		added = await UserHandler.add_to_sermon_favorites(
			uid=request.state.uid,
			sermon_id=ObjectId(sermon_id),
		)
	except Exception as exc:  # Propagate as HTTP error
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Error favoriting sermon: {exc}",
		) from exc

	if not added:
		return {"success": False, "message": "Sermon already favorited"}

	return {"success": True}


async def remove_sermon_favorite(sermon_id: str, request: Request):
	sermon = await get_sermon_by_id(sermon_id)
	if sermon is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Sermon not found",
		)

	try:
		removed = await UserHandler.remove_from_sermon_favorites(
			uid=request.state.uid,
			sermon_id=ObjectId(sermon_id),
		)
	except Exception as exc:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Error removing sermon favorite: {exc}",
		) from exc

	return {"success": removed}
