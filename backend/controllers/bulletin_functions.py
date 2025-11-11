from __future__ import annotations

from typing import List, Optional

from bson import ObjectId
from fastapi import HTTPException, Request, status

from models.bulletin import (
	BulletinCreate,
	BulletinUpdate,
	create_bulletin,
	delete_bulletin,
	get_bulletin_by_id,
	get_bulletin_by_headline,
	reorder_bulletins,
	update_bulletin,
)
from mongo.churchuser import UserHandler
from helpers.permission_helpers import require_bulletin_permissions


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
			status_code=status.HTTP_403_FORBIDDEN,
			detail=f"Cannot {action_detail}: Missing required role permissions",
		)


async def process_create_bulletin(bulletin: BulletinCreate, request: Request):
	"""Create new bulletin with permission validation"""
	user_perms, user_roles = require_bulletin_permissions(request)
	
	if bulletin.roles:
		await _ensure_role_assignment_allowed(
			requested_roles=bulletin.roles,
			user_roles=user_roles,
			user_perms=user_perms,
			action_detail="creating bulletin",
		)

	created_bulletin = await create_bulletin(bulletin)
	if created_bulletin is None:
		# Model returns None for duplicate key errors or other failures
		# Check if it's a duplicate by attempting to find the bulletin
		existing = await get_bulletin_by_headline(bulletin.headline)
		if existing is not None:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail=f"A bulletin with the headline '{bulletin.headline}' already exists. Please use a unique headline.",
			)
		# Otherwise it's an internal server error
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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

	user_perms, user_roles = require_bulletin_permissions(request)

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
				status_code=status.HTTP_403_FORBIDDEN,
				detail="Insufficient permissions to edit this bulletin",
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

	success = await update_bulletin(bulletin_id, BulletinUpdate(**update_payload))
	if not success:
		# Check if it's a duplicate key error
		if "headline" in update_payload and update_payload["headline"] != existing_bulletin.headline:
			duplicate = await get_bulletin_by_headline(update_payload["headline"], exclude_id=bulletin_id)
			if duplicate:
				raise HTTPException(
					status_code=status.HTTP_409_CONFLICT,
					detail=f"A bulletin with the headline '{update_payload['headline']}' already exists. Please use a unique headline.",
				)
		# Otherwise it's an internal server error
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error updating bulletin",
		)
	return {"message": "Bulletin updated successfully", "success": True}


async def process_delete_bulletin(bulletin_id: str, request: Request):
	"""Delete bulletin with role alignment check"""
	user_perms, user_roles = require_bulletin_permissions(request)

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
				status_code=status.HTTP_403_FORBIDDEN,
				detail="Insufficient permissions to delete this bulletin",
			)

	success = await delete_bulletin(bulletin_id)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


async def process_reorder_bulletins(bulletin_ids: List[str], request: Request):
	"""Reorder bulletins by updating order field"""
	require_bulletin_permissions(request)

	if not bulletin_ids:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="No bulletin IDs provided",
		)

	success = await reorder_bulletins(bulletin_ids)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error reordering bulletins",
		)

	return {"message": "Bulletins reordered successfully"}
