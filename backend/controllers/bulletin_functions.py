from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, Request, status

from models.bulletin import (
	BulletinCreate,
	BulletinUpdate,
	create_bulletin,
	delete_bulletin,
	get_bulletin_by_id,
	get_bulletin_by_headline_and_week,
	update_bulletin,
)
from mongo.churchuser import UserHandler


def _require_bulletin_permissions(request: Request) -> tuple[dict, list[str]]:
	"""Validate user has bulletin_editing or admin permission"""
	user_perms = getattr(request.state, "perms", {})
	user_roles = getattr(request.state, "roles", [])

	if not (
		user_perms.get("admin")
		or user_perms.get("bulletin_editing")
	):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error processing bulletin: Invalid permissions",
		)

	return user_perms, user_roles


async def _ensure_role_assignment_allowed(
	*,
	requested_roles: list[str],
	user_roles: list[str],
	user_perms: dict,
	action_detail: str,
) -> None:
	"""Prevent non-admins from assigning roles they don't possess"""
	if user_perms.get("admin"):
		return

	missing = [role for role in requested_roles if role not in user_roles]
	if missing:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Error {action_detail}: Tried to add a permission role you do not have access to",
		)


async def process_create_bulletin(bulletin: BulletinCreate, request: Request):
	"""Create new bulletin with permission and uniqueness validation"""
	user_perms, user_roles = _require_bulletin_permissions(request)
	
	if bulletin.roles:
		await _ensure_role_assignment_allowed(
			requested_roles=bulletin.roles,
			user_roles=user_roles,
			user_perms=user_perms,
			action_detail="creating bulletin",
		)

	# Check for duplicate headline in the same week
	existing = await get_bulletin_by_headline_and_week(bulletin.headline, bulletin.publish_date)
	if existing is not None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Bulletin already exists",
		)

	created_bulletin = await create_bulletin(bulletin)
	if created_bulletin is None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error creating bulletin",
		)
	return created_bulletin


async def process_edit_bulletin(
	bulletin_id: str,
	bulletin_update: BulletinUpdate,
	request: Request,
):
	"""Update bulletin with role alignment and uniqueness checks"""
	if not bulletin_update.model_dump(exclude_unset=True):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error editing bulletin: No updates provided",
		)

	user_perms, user_roles = _require_bulletin_permissions(request)

	existing_bulletin = await get_bulletin_by_id(bulletin_id)
	if existing_bulletin is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Bulletin not found",
		)

	# Non-admins must share at least one role with the bulletin
	has_admin = user_perms.get("admin")
	if not has_admin and existing_bulletin.roles:
		if not any(role in user_roles for role in existing_bulletin.roles):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Error editing bulletin: User does not have permission access to bulletin",
			)

	desired_roles = existing_bulletin.roles if bulletin_update.roles is None else bulletin_update.roles
	if desired_roles:
		await _ensure_role_assignment_allowed(
			requested_roles=desired_roles,
			user_roles=user_roles,
			user_perms=user_perms,
			action_detail="editing bulletin",
		)

	update_payload = bulletin_update.model_dump(exclude_unset=True)

	# Check for duplicate headline if changing headline or publish_date
	target_headline = update_payload.get("headline")
	target_publish_date = update_payload.get("publish_date", existing_bulletin.publish_date)
	
	if target_headline and target_headline != existing_bulletin.headline:
		duplicate_headline = await get_bulletin_by_headline_and_week(target_headline, target_publish_date)
		if duplicate_headline and duplicate_headline.id != existing_bulletin.id:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Bulletin already exists",
			)
	elif update_payload.get("publish_date") and update_payload["publish_date"] != existing_bulletin.publish_date:
		# Check if moving to a different week with same headline
		duplicate_headline = await get_bulletin_by_headline_and_week(existing_bulletin.headline, target_publish_date)
		if duplicate_headline and duplicate_headline.id != existing_bulletin.id:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Bulletin already exists",
			)

	success = await update_bulletin(bulletin_id, BulletinUpdate(**update_payload))
	if not success:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error editing bulletin",
		)
	return {"message": "Bulletin updated successfully", "success": True}


async def process_delete_bulletin(bulletin_id: str, request: Request):
	"""Delete bulletin with role alignment check"""
	user_perms, user_roles = _require_bulletin_permissions(request)

	existing_bulletin = await get_bulletin_by_id(bulletin_id)
	if existing_bulletin is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Bulletin not found",
		)

	has_admin = user_perms.get("admin")
	if not has_admin and existing_bulletin.roles:
		if not any(role in user_roles for role in existing_bulletin.roles):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Error deleting bulletin: User does not have permission access to bulletin",
			)

	success = await delete_bulletin(bulletin_id)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Error deleting bulletin",
		)
	return {"message": "Bulletin deleted successfully", "success": True}


async def process_publish_toggle(
	bulletin_id: str,
	*,
	published: bool,
	request: Request,
):
	"""Toggle published status"""
	await process_edit_bulletin(
		bulletin_id,
		BulletinUpdate(published=published),
		request,
	)
	return {"message": "Bulletin publish state updated", "success": True}


async def process_pin_toggle(
	bulletin_id: str,
	*,
	pinned: bool,
	request: Request,
):
	"""Toggle pinned status"""
	await process_edit_bulletin(
		bulletin_id,
		BulletinUpdate(pinned=pinned),
		request,
	)
	return {"message": "Bulletin pinned state updated", "success": True}
